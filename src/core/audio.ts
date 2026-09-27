import type {Settings} from './types.js';
export class AudioSystem {
 private ctx:AudioContext|null=null;private master:GainNode|null=null;private music:GainNode|null=null;private effects:GainNode|null=null;private nextChord=0;private chord=0;private paused=false;private last:Record<string,number>={};
 constructor(private settings:Settings){}
 async start(){try{if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);this.music=this.ctx.createGain();this.music.connect(this.master);this.effects=this.ctx.createGain();this.effects.connect(this.master);this.apply(this.settings);}if(this.ctx.state==='suspended')await this.ctx.resume();this.paused=false;this.master!.gain.setTargetAtTime(1,this.ctx.currentTime,.06);}catch{/* Sound failure must not prevent the game from running. */}}
 apply(settings:Settings){this.settings=settings;if(this.ctx){this.music!.gain.setTargetAtTime(settings.music*.65,this.ctx.currentTime,.08);this.effects!.gain.setTargetAtTime(settings.sound,this.ctx.currentTime,.04);}}
 pause(value:boolean){this.paused=value;if(this.ctx)this.master!.gain.setTargetAtTime(value?0:1,this.ctx.currentTime,.04);}
 private tone(freq:number,end:number,duration:number,gain:number,type:OscillatorType='sine',music=false,delay=0){if(!this.ctx)return;const time=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,time);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration);g.gain.setValueAtTime(.00001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0001,gain),time+(music?.9:.008));g.gain.exponentialRampToValueAtTime(.00001,time+duration);o.connect(g);g.connect(music?this.music!:this.effects!);o.start(time);o.stop(time+duration+.03);o.onended=()=>{o.disconnect();g.disconnect();};}
 sfx(type:string){if(!this.ctx||this.paused||this.settings.sound===0)return;const now=this.ctx.currentTime;if((this.last[type]??-100)>now-.045)return;this.last[type]=now;
  if(type==='shot')this.tone(430,150,.095,.045,'triangle');
  else if(type==='slash')this.tone(190,65,.15,.055,'sawtooth');
  else if(type==='hit')this.tone(130,60,.075,.07,'triangle');
  else if(type==='warning')this.tone(120,66,.19,.10,'sine');
  else if(type==='dash')this.tone(150,600,.16,.05,'sine');
  else if(type==='kill'){this.tone(185,75,.14,.06,'triangle');this.tone(750,460,.12,.02,'sine');}
  else if(type==='heal'){for(let i=0;i<3;i++)this.tone(330*2**(i/6),330*2**(i/6),.36,.04,'sine',false,i*.10);}
  else if(type==='level'||type==='loot'||type==='room'){for(let i=0;i<4;i++)this.tone(293.66*[1,1.25,1.5,2][i],293.66*[1,1.25,1.5,2][i],.65,.04,'sine',false,i*.10);}
  else if(type==='cast'){this.tone(90,290,.36,.075,'triangle');this.tone(700,1100,.4,.026,'sine');}
  else if(type==='portal'){this.tone(70,380,.85,.10,'sine');this.tone(500,90,.85,.04,'triangle');}
  else if(type==='ui')this.tone(600,720,.07,.025,'sine');
  else if(type==='step')this.tone(100,45,.04,.019,'triangle');
 }
 tick(combat=false){if(!this.ctx||this.paused||this.settings.music===0)return;const now=this.ctx.currentTime;if(now<this.nextChord)return;this.nextChord=now+7.5;const roots=[146.832,130.813,174.614,164.814],root=roots[this.chord++%4];for(const ratio of [1,1.5,2.25])this.tone(root*ratio,root*ratio,8,.025,'sine',true);if(combat)this.tone(root/2,root/2,7.3,.035,'triangle',true);this.tone(root*4,root*4,1.8,.014,'sine',true,1.8);this.tone(root*3,root*3,1.7,.01,'sine',true,4.4);}
 status(){return this.ctx?.state??'not-started';}
}
