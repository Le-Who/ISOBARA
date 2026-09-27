from pathlib import Path
import subprocess,json,time,platform,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
report={'environment':{'os':platform.platform(),'python':sys.version},'commands':[]}
npm='npm.cmd' if platform.system()=='Windows' else 'npm'
commands=[('typecheck',[npm,'run','check'],80),('unit-and-generation',[npm,'test'],180),('campaign',['node','tests/playthrough.mjs'],180),('production-build',['node','tools/build.mjs'],90),('javascript-syntax',['node','--check','dist/game.js'],40)]
for name,command,timeout in commands:
 t=time.time()
 try:
  p=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=timeout)
  row={'name':name,'command':' '.join(command),'exitCode':p.returncode,'status':'passed' if p.returncode==0 else 'failed','seconds':round(time.time()-t,2)}
  (OUT/(name+'.log')).write_text(p.stdout+'\n'+p.stderr)
 except Exception as e:
  row={'name':name,'command':' '.join(command),'status':'unavailable','error':str(e),'seconds':round(time.time()-t,2)}
 report['commands'].append(row)
 (OUT/'release-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(row,ensure_ascii=False),flush=True)
