"""Browser integration and rendering checks.
Uses public DOM controls. Imported fixtures test persistence, not combat completion.
No local state editing or privileged gameplay helpers are used during transitions.
"""
from pathlib import Path
import json, os, time, traceback, shutil, sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('ISOBARA_EVIDENCE_DIR',str(ROOT/'evidence')));OUT.mkdir(parents=True,exist_ok=True)
report={'method':'DOM input and explicit imported fixtures; this is not a human playtest or proof of a full combat campaign.', 'status':'not-run','checks':[],'errors':[],'network':[],'cycles':[]}

def check(name, passed, **details):
    report['checks'].append({'name':name,'passed':bool(passed),**details})
    (OUT/'browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    if not passed: raise AssertionError(name)

def key(page,code):
    previous=page.evaluate('window.__isobara.metrics().modal')
    page.keyboard.press(code,delay=80)
    page.wait_for_function('(previous)=>window.__isobara.metrics().modal!==previous',arg=previous,timeout=10000)

def import_file(page,file):
    with page.expect_file_chooser() as chooser:
        page.locator('[data-action="import"]:visible').first.click()
    chooser.value.set_files(str(file))
    page.locator('[data-action="apply-import"]').wait_for(timeout=10000)
    page.locator('[data-action="apply-import"]').click()
    page.wait_for_function('window.__isobara && !window.__isobara.metrics().busy',timeout=20000)
    page.wait_for_timeout(500)

try:
 with sync_playwright() as p:
    args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']
    try: browser=p.chromium.launch(headless=True,args=args)
    except Exception as original:
      candidates=[shutil.which(n) for n in ['chromium','chromium-browser','google-chrome','google-chrome-stable']]
      candidates += [str(x) for base in ['/opt','/usr/lib','/home/oai/.cache','/root/.cache','/tmp'] if Path(base).exists() for x in Path(base).glob('**/chrome') if x.is_file()]
      candidates += [str(x) for base in ['/home/oai/.cache','/root/.cache','/tmp'] if Path(base).exists() for x in Path(base).glob('**/chrome-headless-shell') if x.is_file()]
      candidates=[x for x in candidates if x and os.access(x,os.X_OK)]
      if not candidates: raise original
      browser=p.chromium.launch(headless=True,args=args,executable_path=candidates[0])
    report['browser']=browser.version
    ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
    page=ctx.new_page()
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' or 'GL_INVALID' in m.text or 'THREE.WebGLProgram: Shader Error' in m.text else None)
    page.on('request',lambda r:report['network'].append(r.url) if not r.url.startswith(('http://127.0.0.1:4175/','data:','blob:')) else None)
    page.goto('http://127.0.0.1:4175/',wait_until='load',timeout=30000)
    page.wait_for_function('!!window.__isobara',timeout=25000)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT/'01-title.png'))
    check('Title screen and Three.js renderer start',page.locator('[data-action="new"]').count()>0 and page.evaluate('window.__isobara.metrics().drawCalls')>0)
    page.locator('[data-action="settings"]').first.click()
    page.locator('[data-setting="quality"]').select_option('low')
    page.locator('[data-setting="scale"]').evaluate("el => { el.value='0.65'; el.dispatchEvent(new Event('input',{bubbles:true})); }")
    key(page,'Escape')
    page.locator('[data-action="new"]').click()
    page.locator('#world-seed').fill('19320422')
    page.screenshot(path=str(OUT/'02-classes.png'))
    check('All three specializations selectable',page.locator('.class-card').count()==3)
    page.locator('[data-action="start-new"]').click()
    page.locator('[data-action="close"]').filter(has_text='Выйти в сады').click(timeout=25000)
    page.wait_for_timeout(700)
    before=page.evaluate('window.__isobara.snapshot().player')
    page.keyboard.down('w');page.wait_for_timeout(700);page.keyboard.up('w')
    after=page.evaluate('window.__isobara.snapshot().player')
    check('Keyboard moves the player',abs(before['x']-after['x'])+abs(before['z']-after['z'])>.3)
    key(page,'Escape');page.wait_for_timeout(250)
    frozen=page.evaluate('window.__isobara.snapshot().player')
    page.wait_for_timeout(600)
    check('Pause freezes movement and timers',frozen==page.evaluate('window.__isobara.snapshot().player'))
    with page.expect_file_chooser() as chooser:page.locator('[data-action="import"]:visible').first.click()
    chooser.value.set_files(str(ROOT/'evidence/fixtures/invalid.json'));page.wait_for_timeout(450)
    check('Invalid import does not replace the character',page.evaluate('window.__isobara.snapshot().seed')==19320422)
    import_file(page,ROOT/'evidence/fixtures/pending-reward-full-bag.json')
    check('Pending reward restores from a file',page.locator('.upgrade-card').count()==3)
    offers=page.locator('.upgrade-card').all_text_contents();page.screenshot(path=str(OUT/'04-reward.png'))
    page.reload(wait_until='load');page.wait_for_function('!!window.__isobara',timeout=25000)
    page.locator('[data-action="resume"]').click()
    page.locator('.upgrade-card').first.wait_for(timeout=20000)
    check('Reload preserves all offered improvements',offers==page.locator('.upgrade-card').all_text_contents())
    page.locator('[data-action="reward-select:0"]').click();page.locator('[data-action="claim:0"]').click()
    page.wait_for_function('window.__isobara.snapshot().phase==="world" && !window.__isobara.metrics().busy && window.__isobara.metrics().modal===null',timeout=20000)
    snap=page.evaluate('window.__isobara.snapshot()')
    check('Reward is applied once and excess loot is retained',snap['progress']['portals']==1 and len(snap['mailbox'])==1 and len(snap['inventory'])==24)
    key(page,'i');page.locator('.inventory').wait_for();page.screenshot(path=str(OUT/'05-inventory.png'))
    missing=page.evaluate('Array.from(document.querySelectorAll("img")).filter(i=>!i.complete||i.naturalWidth===0).length')
    check('All generated item images decode with the UI',missing==0,missing=missing)
    key(page,'Escape');key(page,'m');page.locator('#large-map').wait_for();page.screenshot(path=str(OUT/'06-map.png'));key(page,'Escape')
    key(page,'Escape')
    with page.expect_download() as download:page.locator('[data-action="export"]:visible').click()
    saved_path=OUT/'browser-export.json';download.value.save_as(str(saved_path))
    check('Save export creates a valid envelope',json.loads(saved_path.read_text())['format']=='isobara-save')
    second=ctx.new_page();second.goto('http://127.0.0.1:4175/',wait_until='load');second.wait_for_function('!!window.__isobara',timeout=25000)
    check('Second tab cannot become another save writer',second.evaluate('window.__isobara.metrics().saveReadOnly'))
    second.close();page.bring_to_front()
    import_file(page,ROOT/'evidence/fixtures/near-portal.json')
    page.wait_for_timeout(700);page.screenshot(path=str(OUT/'03-world.png'))
    for i in range(20):
      key(page,'e')
      page.locator('[data-action^="enter:"]').click(timeout=10000)
      page.wait_for_function('window.__isobara.snapshot().phase==="expedition" && !window.__isobara.metrics().busy',timeout=20000)
      page.wait_for_timeout(250)
      if i==0:
        page.screenshot(path=str(OUT/'07-expedition.png'))
        key(page,'Escape');page.locator('[data-action="settings"]:visible').click()
        page.locator('[data-setting="quality"]').select_option('high');key(page,'Escape')
      key(page,'Escape');page.locator('[data-action="abandon-confirm"]').click();page.locator('[data-action="abandon"]').click()
      page.wait_for_function('window.__isobara.snapshot().phase==="world" && !window.__isobara.metrics().busy && window.__isobara.metrics().modal===null',timeout=20000)
      page.wait_for_timeout(250)
      if i==0:
        key(page,'Escape');page.locator('[data-action="settings"]:visible').click()
        page.locator('[data-setting="quality"]').select_option('low');key(page,'Escape')
      report['cycles'].append(page.evaluate('window.__isobara.metrics()'))
    tail=report['cycles'][5:]
    check('20 portal transitions complete',len(report['cycles'])==20)
    check('Renderer resource counts remain bounded after warmup',max(x['geometries'] for x in tail)-min(x['geometries'] for x in tail)<20 and max(x['textures'] for x in tail)-min(x['textures'] for x in tail)<10)
    check('No external network dependencies are requested',not report['network'])
    check('No JavaScript or WebGL errors during integration tests',not report['errors'],errors=report['errors'])
    report['status']='passed'
    browser.close()
except Exception as e:
 report['status']='unavailable' if not report.get('browser') else 'failed'
 report['failure']=str(e)
 report['traceback']=traceback.format_exc()
finally:
 (OUT/'browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False,indent=2))

sys.exit(0 if report['status']=='passed' else 1)
