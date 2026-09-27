import type {Action,InputFrame,Settings} from './types.js';
export class Input {
 held=new Set<string>();pressed=new Set<string>();pulses=new Set<Action>();mouse={x:innerWidth/2,y:innerHeight/2-90};capture:((code:string|null)=>void)|null=null;
 constructor(public settings:Settings,public canvas:HTMLCanvasElement){
  window.addEventListener('keydown',e=>{if(this.capture){e.preventDefault();e.stopPropagation();const cb=this.capture;this.capture=null;cb(e.code==='Escape'?null:e.code);this.reset();return;}
   const target=e.target as HTMLElement;if(target.closest('button')&&e.code==='Space')return;if(target.matches('input,textarea,select')||target.isContentEditable){if(e.code==='Escape')this.pressed.add(e.code);return;}
   if(!e.repeat)this.pressed.add(e.code);this.held.add(e.code);if(Object.values(this.settings.bindings).includes(e.code)||e.code==='Tab'||e.code==='Escape')e.preventDefault();
  });
  window.addEventListener('keyup',e=>this.held.delete(e.code));
  window.addEventListener('mousemove',e=>{this.mouse.x=e.clientX;this.mouse.y=e.clientY;});
  window.addEventListener('mousedown',e=>{if(this.capture){e.preventDefault();const cb=this.capture;this.capture=null;cb(`Mouse${e.button}`);this.reset();return;}if(e.target!==this.canvas)return;const code=`Mouse${e.button}`;this.held.add(code);this.pressed.add(code);this.canvas.focus({preventScroll:true});});
  window.addEventListener('mouseup',e=>this.held.delete(`Mouse${e.button}`));
  canvas.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('blur',()=>this.reset());document.addEventListener('visibilitychange',()=>this.reset());
 }
 reset(){this.held.clear();this.pressed.clear();this.pulses.clear();}
 take(code:string){const has=this.pressed.has(code);this.pressed.delete(code);return has;}
 action(action:Action){const v=this.take(this.settings.bindings[action])||this.pulses.has(action);this.pulses.delete(action);return v;}
 pulse(action:Action){this.pulses.add(action);}
 frame(yaw:number,aim:{x:number;z:number;distance:number}):InputFrame {
  const b=this.settings.bindings,axis=(a:Action,c:Action)=>(this.held.has(b[a])?1:0)-(this.held.has(b[c])?1:0),forward=axis('up','down'),right=axis('right','left'),sin=Math.sin(yaw),cos=Math.cos(yaw);
  return {mx:right*cos-forward*sin,mz:-right*sin-forward*cos,ax:aim.x,az:aim.z,aimDistance:aim.distance,attack:this.held.has(b.attack)||this.action('attack'),skill:this.action('skill'),burst:this.action('burst'),dash:this.action('dash'),heal:this.action('heal')};
 }
 endFrame(){this.pressed.clear();this.pulses.clear();}
}
