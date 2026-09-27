from pathlib import Path
import subprocess,json,time,hashlib,zipfile,shutil,datetime
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
release={}
for name,cmd in [('typecheck',['npm','run','check']),('production-build',['node','tools/build.mjs']),('javascript-syntax',['node','--check','dist/game.js'])]:
 t=time.time()
 try:
  p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=90)
  release[name]={'status':'passed' if p.returncode==0 else 'failed','exitCode':p.returncode,'seconds':round(time.time()-t,2)}
  (OUT/('final-'+name+'.log')).write_text(p.stdout+'\n'+p.stderr)
 except Exception as e:release[name]={'status':'unavailable','error':str(e)}
(OUT/'final-build-checks.json').write_text(json.dumps(release,ensure_ascii=False,indent=2))
if release.get('production-build',{}).get('status')!='passed':
 raise RuntimeError('Release build failed; packaging an old HTML would be misleading. See evidence/final-production-build.log.')
html=ROOT/'dist/Isobara.html'
assert html.exists() and html.stat().st_size>100_000,'Missing standalone product'
source=list((ROOT/'src').rglob('*.ts'))
assert len(source)>=10,'Source tree is incomplete'
assets=[]
for path in sorted((ROOT/'public/assets').glob('*')):
 if path.suffix.lower() not in ('.png','.webp'):continue
 try:
  with Image.open(path) as im:
   alpha=im.getchannel('A') if 'A' in im.getbands() else None
   assets.append({'file':path.relative_to(ROOT).as_posix(),'size':list(im.size),'mode':im.mode,'transparent':alpha is not None and alpha.getextrema()[0]<255,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 except Exception:pass
(OUT/'asset-manifest.json').write_text(json.dumps({'origin':'Built-in image generation tool; exact internal model ID not exposed','assets':assets},ensure_ascii=False,indent=2))
asset_lines=['# Изображения и звук','', 'Изображения предметов и улучшений подготовлены встроенным инструментом генерации изображений. Конкретный внутренний идентификатор модели не подтверждён; они не маркируются неподтверждённым названием GPT-Image 2.5 или GPT-Image 2.','', 'Генерация запрашивалась с прозрачностью. Из общего исходника подготовлены отдельные изображения, сохранённые локально. Фактическое наличие альфа-прозрачности перечислено ниже; внешняя модель во время игры не вызывается.','', '| Файл | Размер | Альфа-прозрачность |','|---|---|---|']
for a in assets:asset_lines.append(f"| `{a['file']}` | {a['size'][0]} × {a['size'][1]} | {'Да' if a['transparent'] else 'Нет'} |")
asset_lines+=['','Трёхмерные модели и декоративные компоненты строятся собственным программным набором. Сгенерированные картинки используются в интерфейсе и представлении предметов; они не выдаются за готовые 3D-модели.','', 'Звук синтезируется локально через Web Audio: музыкальные ноты, огибающие и короткие эффекты. Сторонние музыкальные записи не используются.','', 'В архиве нет распространяемых файлов системных шрифтов.']
(ROOT/'ASSETS.md').write_text('\n'.join(asset_lines)+'\n')
reports={}
for filename in ['release-checks.json','campaign-tests.json','browser-tests.json','core-tests.json','coretests.json']:
 p=OUT/filename
 if p.exists():
  try:reports[filename]=json.loads(p.read_text())
  except Exception:reports[filename]={'status':'unreadable'}
status_ru={'passed':'Успешно','failed':'Ошибка / условие не выполнено','unavailable':'Результат не получен','not-run':'Не выполнено'}
lines=['# Отчёт о проверках ИЗОБАРЫ','', 'Это отчёт о фактически записанных результатах. Отсутствующий или прерванный прогон не считается успешным. Испытания симуляции, проверки интерфейса на импортированных тестовых данных и ручное прохождение — разные виды свидетельств.','', '## Финальная сборка','', '| Проверка | Статус |','|---|---|']
for name,row in release.items():lines.append(f"| {name} | {status_ru.get(row['status'],row['status'])} |")
lines+=['','## Генерация и игровые правила','']
commands=reports.get('release-checks.json',{}).get('commands',[])
unit=next((r for r in commands if r.get('name')=='unit-and-generation'),None)
lines.append(status_ru.get(unit.get('status'),'Неизвестный статус') if unit else 'Итоговый статус команды не записан. См. доступные журналы в evidence/.')
lines.append('Тесты проверяют большую выборку начальных значений генератора, конечность и достижимость планов, резервную генерацию, допустимость наград, сохранения и ряд пограничных состояний. Такая выборка не доказывает корректность абсолютно всех возможных миров; проверки каждой новой локации и резервный вариант остаются частью самой игры.')
lines+=['','## Прохождение игровой симуляции','']
campaign=reports.get('campaign-tests.json',{})
results=campaign.get('results',[])
if results:
 lines+=['| Специализация | Зерно | Результат | Примечание |','|---|---:|---|---|']
 for r in results:lines.append(f"| {r.get('classId')} | {r.get('seed')} | {'Финал достигнут' if r.get('passed') else 'Прогон не завершил кампанию'} | {r.get('reason','Обычные входные действия и игровые операции')} |")
else:lines.append('Завершённые результаты кампании не записаны. Не следует считать прохождение подтверждённым.')
lines.append('\nЭтот тест управляет производственной симуляцией: движение, атаки, способности, лечение, обычные переходы, выбор наград и экипировка. Это не ручное прохождение и не визуальный end-to-end тест браузера.')
lines+=['','## Браузерный интерфейс и рендер','']
browser=reports.get('browser-tests.json',{})
lines.append('Статус: **'+status_ru.get(browser.get('status','not-run'),'Неизвестно')+'**.')
if browser.get('browser'):lines.append('Браузер из отчёта: '+str(browser['browser'])+'.')
for c in browser.get('checks',[]):lines.append(f"- {'PASS' if c.get('passed') else 'FAIL'}: {c.get('name')}")
if browser.get('failure'):lines.append('\nПричина незавершённости / ошибки: `'+str(browser['failure']).replace('`','\'')[:1400]+'`.')
lines.append('\nЭкран награды, переполненная сумка и часть переходов проверяются с явно импортированными тестовыми сохранениями. Скриншоты этих экранов не являются доказательством прохождения соответствующего боя. Браузерный тест не заявляет полное прохождение кампании за человека.')
lines+=['','## Что здесь не подтверждено','', 'Отдельное ручное прохождение пользователем, запуск на его Windows-компьютере, совместимость со всеми видеодрайверами и гарантированная частота кадров не проверены. Отчёт не заменяет эти проверки. При неуспешных статусах выше соответствующая проверка остаётся открытой, даже если архив и HTML успешно собраны.','', 'Исходные машинные результаты и журналы находятся в evidence/.']
report='\n'.join(lines)+'\n';(ROOT/'TEST_REPORT.md').write_text(report)
Path('/mnt/data/ISOBARA_TEST_REPORT.txt').write_text(report)
shutil.copy2(html,'/mnt/data/ISOBARA.html')
# Optional reference prompt supplied in the conversation.
ref=Path('/mnt/data/threejs_portal_rpg_gpt6_astra_prompt_ru.txt')
if ref.exists():shutil.copy2(ref,ROOT/'docs/ORIGINAL_PROMPT.txt')
exclude_parts={'node_modules','.git','.test-build','dev-dist','__pycache__','fixtures'}
exclude_names={'server.log','server.pid','browser-export.json'}
all_files=[]
for p in ROOT.rglob('*'):
 if not p.is_file():continue
 rel=p.relative_to(ROOT)
 if any(x in exclude_parts for x in rel.parts) or p.name in exclude_names:continue
 if p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.pyc'}:continue
 all_files.append(p)
hashes=[]
for p in all_files:hashes.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(ROOT).as_posix())
(ROOT/'SHA256SUMS.txt').write_text('\n'.join(hashes)+'\n');all_files.append(ROOT/'SHA256SUMS.txt')
archive=Path('/mnt/data/ISOBARA_1.0.0.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=8) as z:
 for p in sorted(all_files):z.write(p,Path('ISOBARA-1.0.0')/p.relative_to(ROOT))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert 'ISOBARA-1.0.0/dist/Isobara.html' in z.namelist()
result={'archive':str(archive),'archiveBytes':archive.stat().st_size,'html':'/mnt/data/ISOBARA.html','htmlBytes':html.stat().st_size,'files':len(all_files),'sourceFiles':len(source),'assetFiles':len(assets),'build':release,'browserStatus':browser.get('status','not-run')}
Path('/mnt/data/ISOBARA_RELEASE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
