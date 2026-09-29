"""DOM-only integration smoke for 2.1. Imported fixtures are not campaign proof.
Requires dev server :4175, optional companion :8787, and make-fixtures.mjs.
"""
from pathlib import Path
import json, sys, traceback
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence/integration-2.1/features'
OUT.mkdir(parents=True,exist_ok=True)
report={'status':'running','method':'Public DOM actions and imported test fixtures; diagnostics read only. No gameplay mutation through browser evaluation.','checks':[],'errors':[]}
def check(name,value):
    report['checks'].append({'name':name,'passed':bool(value)})
    if not value: raise AssertionError(name)
def click(page,action): page.locator(f'[data-action="{action}"]:visible').first.click()
def snap(page): return page.evaluate('window.__isobara.snapshot()')
def screenshot(page,name):
    page.wait_for_timeout(350)
    page.screenshot(path=str(OUT/name),animations='disabled')
def key(page,code):
    previous=page.evaluate('window.__isobara.metrics().modal')
    page.keyboard.press(code,delay=80)
    page.wait_for_function('(previous)=>window.__isobara.metrics().modal!==previous',arg=previous,timeout=10000)

def import_file(page,name):
    with page.expect_file_chooser() as chooser: click(page,'import')
    chooser.value.set_files(str(ROOT/'evidence/fixtures'/name))
    click(page,'apply-import')
    page.wait_for_function('!window.__isobara.metrics().busy && window.__isobara.metrics().modal===null')
def export_state(page):
    with page.expect_download() as download: click(page,'export')
    file=OUT/'state.json';download.value.save_as(str(file))
    return json.loads(json.loads(file.read_text(encoding='utf-8'))['payload'])

try:
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
    page=ctx.new_page();requests=[]
    page.on('request',lambda r:requests.append(r.url))
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['errors'].append(m.text) if 'GL_INVALID' in m.text or 'THREE.WebGLProgram: Shader Error' in m.text else None)
    page.goto('http://127.0.0.1:4175/');page.wait_for_function('!!window.__isobara')
    check('Startup never probes a cloud endpoint',all(u.startswith(('http://127.0.0.1:4175/','data:','blob:')) for u in requests))
    import_file(page,'workshop.json')
    key(page,'i');click(page,'item:craft:19320422:1')
    before=next(i for i in snap(page)['inventory'] if i['id']=='craft:19320422:1')['damage']
    click(page,'refit:craft:19320422:1')
    page.wait_for_function('window.__isobara.snapshot().inventory.find(i=>i.id==="craft:19320422:1").refit===1')
    check('Refit works with real colon-containing IDs',next(i for i in snap(page)['inventory'] if i['id']=='craft:19320422:1')['damage']>before)
    click(page,'item:craft:19320422:3')
    page.locator('[data-action="retune:craft:19320422:3"][data-effect="battery"]').click()
    page.wait_for_function('window.__isobara.snapshot().inventory.find(i=>i.id==="craft:19320422:3").effect==="battery"')
    check('Retuning uses separate effect and full item identifier',True)
    screenshot(page,'01-workshop-item.png')
    click(page,'filter:shell')
    check('Slot filter shows only the selected slot',page.locator('.bag-grid [data-action^="item:"]').count()==1)
    click(page,'bulk-preview:1');check('Bulk preview lists only the selected unprotected shell',page.locator('.salvage-list li').count()==1)
    screenshot(page,'02-bulk-preview.png');click(page,'bulk-confirm')
    check('Bulk salvage keeps refitted, alternative-family and rare items',len(snap(page)['inventory'])==4)
    click(page,'station');screenshot(page,'03-station.png')
    click(page,'craft-slot:relic')
    page.wait_for_function('window.__isobara.metrics().modal==="inventory"')
    check('Directed craft produces a relic through actual UI',any(i['slot']=='relic' for i in snap(page)['inventory']))
    key(page,'Escape');key(page,'Escape')
    saved=export_state(page)
    check('Costs charged once through UI',saved['shards']==5000-35-95+6-90)
    click(page,'cloud');page.locator('#cloud-endpoint').fill('http://127.0.0.1:8787')
    click(page,'cloud-upload');page.locator('[aria-label="Код сохранённой копии"]').wait_for(timeout=20000)
    code=page.locator('[aria-label="Код сохранённой копии"]').input_value()
    check('Explicit cloud upload returns a recovery code',code.startswith('ISO2-'))
    check('Recovery secret is absent from all network URLs',all(code not in u for u in requests))
    click(page,'close');key(page,'Escape');click(page,'cloud')
    page.locator('#cloud-endpoint').fill('http://127.0.0.1:4175');page.locator('#cloud-code').fill(code)
    before=snap(page)['inventory'];click(page,'cloud-download');page.locator('#cloud-endpoint').wait_for(timeout=20000)
    check('Unavailable service leaves local inventory intact',snap(page)['inventory']==before)
    page.locator('#cloud-endpoint').fill('http://127.0.0.1:8787');page.locator('#cloud-code').fill(code)
    click(page,'cloud-download');page.locator('[data-action="apply-import"]:visible').wait_for(timeout=20000)
    check('Successful download requires import confirmation',snap(page)['inventory']==before)
    click(page,'apply-import');page.wait_for_function('!window.__isobara.metrics().busy && window.__isobara.metrics().modal===null')
    check('Cloud snapshot restores refit and chosen effect',snap(page)['inventory']==before)
    key(page,'Escape');click(page,'settings')
    page.locator('[data-setting="quality"]').select_option('low')
    page.locator('[data-setting="particles"]').uncheck();page.locator('[data-setting="shake"]').uncheck()
    key(page,'Escape');page.wait_for_timeout(1200)
    screenshot(page,'04-world-low.png')
    for quality in ['high','low']:
        key(page,'Escape');click(page,'settings');page.locator('[data-setting="quality"]').select_option(quality)
        key(page,'Escape');page.wait_for_timeout(1200)
    check('Quality low/high/low has no WebGL sampler or shader errors',not report['errors'])
    key(page,'Escape');import_file(page,'restored.json');page.wait_for_timeout(1600)
    screenshot(page,'05-restored-low.png')
    check('Restored world renders at low quality without particles',page.evaluate('window.__isobara.metrics().drawCalls')>0)
    check('No JS exceptions in feature flow',not report['errors'])
    report['browser']=browser.version;report['status']='passed';browser.close()
except Exception as e:
 report['status']='failed';report['failure']=str(e);report['traceback']=traceback.format_exc()
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False,indent=2))
sys.exit(0 if report['status']=='passed' else 1)
