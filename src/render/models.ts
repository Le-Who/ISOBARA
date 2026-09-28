// @ts-nocheck
// Procedural model kit. Shared geometry/material ownership is explicit; no imported 3D models.
import * as T from '../vendor/three.module.js';
import {CLASSES,THEMES} from '../core/content.js';
const GOLD=0xb69661,IVORY=0xe4dbc1,DARK=0x344846,TEAL=0x83dcca,RUST=0x765d49;
export class Kit {
 geos=new Map();materials=new Map();textures=new Set();
 geo(key,create){if(!this.geos.has(key)){const g=create();g.userData.shared=true;this.geos.set(key,g);}return this.geos.get(key);}
 mat(color,rough=.72,metal=.0,emissive=0,opacity=1){const key=[color,rough,metal,emissive,opacity].join(':');if(!this.materials.has(key)){const m=new T.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive,emissiveIntensity:emissive?1.3:0,transparent:opacity<1,opacity,depthWrite:opacity===1,flatShading:true});m.userData.shared=true;this.materials.set(key,m);}return this.materials.get(key);}
 basic(color,opacity=1){const key=`basic:${color}:${opacity}`;if(!this.materials.has(key)){const m=new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,side:T.DoubleSide});m.userData.shared=true;this.materials.set(key,m);}return this.materials.get(key);}
 box(){return this.geo('box',()=>new T.BoxGeometry(1,1,1));}
 cyl(n=10){return this.geo('cyl'+n,()=>new T.CylinderGeometry(.5,.5,1,n));}
 cone(n=8){return this.geo('cone'+n,()=>new T.ConeGeometry(.5,1,n));}
 ball(detail=1){return this.geo('ico'+detail,()=>new T.IcosahedronGeometry(1,detail));}
 torus(r=.5,tube=.05){return this.geo(`torus${r}:${tube}`,()=>new T.TorusGeometry(r,tube,5,36));}
 mesh(parent,geometry,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 boxAt(p,x,y,z,sx,sy,sz,color=IVORY){return this.mesh(p,this.box(),this.mat(color),x,y,z,sx,sy,sz);}
 rod(p,a,b,r=.06,color=GOLD){const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),m=this.mesh(p,this.cyl(6),this.mat(color,.4,.3),(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r*2,d.length(),r*2);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
 disk(p,x,y,z,r,color,opacity=1){const m=this.mesh(p,this.geo('circle',()=>new T.CircleGeometry(1,48)),this.basic(color,opacity),x,y,z,r,r,r);m.rotation.x=-Math.PI/2;m.castShadow=false;return m;}
 ring(p,x,y,z,r,color=GOLD,tube=.04){const m=this.mesh(p,this.torus(r,tube),this.mat(color,.34,.34),x,y,z);m.rotation.x=-Math.PI/2;return m;}
 glyph(text,color='#e9dfc4',size=1.6){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.font='500 30px Segoe UI, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=9;ctx.fillStyle=color;ctx.fillText(text,256,48);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.userData.owned=true;const material=new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false});const sprite=new T.Sprite(material);sprite.geometry.userData.shared=true;sprite.scale.set(size*4,size*.75,1);return sprite;}
 healthBar(group,y,width=1.3){const holder=new T.Group();holder.position.y=y;const bg=new T.Sprite(new T.SpriteMaterial({color:0x17262a,depthTest:false,transparent:true,opacity:.9}));bg.geometry.userData.shared=true;bg.scale.set(width,.10,1);holder.add(bg);const fill=new T.Sprite(new T.SpriteMaterial({color:0xeabb81,depthTest:false}));fill.scale.set(width*.96,.055,1);fill.position.z=.01;holder.add(fill);group.add(holder);holder.visible=false;return {holder,fill,width};}
 player(classId,family){
  const root=new T.Group(),accent=CLASSES[classId].color,limbs=[];
  this.disk(root,0,.04,0,.68,0x0c282b,.18);const marker=this.ring(root,0,.035,0,.66,accent,.023);marker.material=this.basic(accent,.8);marker.castShadow=false;
  for(const x of [-.17,.17]){const leg=new T.Group();leg.position.set(x,.67,0);this.mesh(leg,this.cyl(8),this.mat(DARK),0,-.22,0,.22,.45,.22);this.boxAt(leg,0,-.52,.08,.25,.20,.38,0x283733);root.add(leg);limbs.push(leg);}
  this.mesh(root,this.cyl(8),this.mat(IVORY),0,1.03,0,.76,.78,.59);this.ring(root,0,.91,0,.40,GOLD,.033);
  this.boxAt(root,0,1.02,-.35,.54,.55,.25,DARK);this.mesh(root,this.cyl(8),this.mat(accent,.38,.1,accent),-.16,1.03,-.50,.10,.4,.1);this.mesh(root,this.cyl(8),this.mat(accent,.38,.1,accent),.16,1.03,-.50,.10,.4,.1);
  this.mesh(root,this.ball(1),this.mat(IVORY),0,1.68,0,.30,.34,.30);this.mesh(root,this.cyl(12),this.mat(GOLD,.4,.3),0,1.76,0,.70,.07,.70);this.boxAt(root,0,1.65,.27,.43,.14,.06,0x2e5755);this.boxAt(root,0,1.65,.309,.30,.045,.015,accent);
  const capeGeo=this.geo('cape',()=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.36,0,0,.36,0,0,-.48,-.79,-.16,.48,-.79,-.16],3));g.setIndex([0,2,1,1,2,3]);g.computeVertexNormals();return g;});
  const cape=this.mesh(root,capeGeo,this.basic(classId==='harvester'?0x72817c:classId==='lineman'?0x588c82:0x847894),0,1.39,-.33);cape.castShadow=true;
  const arms=[];for(const x of [-.47,.47]){const arm=new T.Group();arm.position.set(x,1.3,0);this.mesh(arm,this.cyl(8),this.mat(IVORY),0,-.22,.07,.22,.47,.22);this.mesh(arm,this.ball(0),this.mat(GOLD),0,-.43,.12,.135,.14,.135);root.add(arm);arms.push(arm);}
  const tool=new T.Group();tool.position.set(.47,.91,.25);root.add(tool);
  if(family==='strippers'){
   for(const x of [-.15,.15]){this.rod(tool,[x,0,0],[x,0,.80],.055,DARK);this.rod(tool,[x,0,.60],[x*1.9,0,1.02],.055,GOLD);this.mesh(tool,this.cone(5),this.mat(accent,.32,.28),x*1.9,0,1.08,.17,.40,.17).rotation.x=Math.PI/2;}
   this.boxAt(tool,0,-.08,.18,.43,.16,.28,GOLD);
  }else if(family==='inductor'){
   this.boxAt(tool,0,0,.20,.40,.27,.42,DARK);for(const x of [-.24,.24]){this.rod(tool,[x,0,.28],[x,0,.86],.065,GOLD);this.mesh(tool,this.ball(0),this.mat(accent,.25,.1,accent),x,0,.89,.12,.12,.12);}for(let i=0;i<3;i++)this.mesh(tool,this.torus(.16+i*.026,.019),this.mat(accent,.3,.1,accent),0,0,.38+i*.13);
  }else if(family==='discs'){
   this.rod(tool,[0,0,0],[0,0,.58],.055,GOLD);for(const x of [-.23,.23]){const wheel=this.mesh(tool,this.torus(.28,.055),this.mat(accent,.35,.24),x,.03,.57);wheel.rotation.y=.25*x;this.mesh(tool,this.ball(0),this.mat(GOLD,.3,.4),x,.03,.57,.09,.09,.09);}this.boxAt(tool,0,-.09,.18,.32,.15,.33,DARK);
  }else if(classId==='harvester'){
   this.rod(tool,[0,0,0],[0,0,.75],.07,DARK);for(const x of [-.13,.13]){this.rod(tool,[0,0,.38],[x,0,.63],.05,GOLD);this.rod(tool,[x,0,.63],[x,0,1.15],.045,accent);}this.boxAt(tool,0,0,.61,.4,.13,.16,GOLD);
  }else if(classId==='lineman'){
   const barrel=this.mesh(tool,this.cyl(8),this.mat(GOLD,.3,.4),0,0,.35,.19,.85,.19);barrel.rotation.x=Math.PI/2;for(let i=0;i<4;i++){const ring=this.mesh(tool,this.torus(.115,.025),this.mat(accent,.4,.1,accent),0,0,.12+i*.12);}
   this.boxAt(tool,0,-.08,.0,.16,.24,.25,DARK);
  }else{const orb=this.mesh(tool,this.ball(1),this.mat(accent,.3,.2,0x473854),0,.07,.3,.3,.3,.3);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;this.rod(tool,[0,.07,.3],[Math.cos(a)*.55,.07+Math.sin(a)*.55,.3],.035,GOLD);}this.mesh(tool,this.torus(.38,.025),this.mat(GOLD,.3,.3),0,.07,.3);}
  root.userData={limbs,arms,tool,cape,attack:0,oldX:0,oldZ:0,classId,family};return root;
 }
 npc(id){
  if(id==='sa7'){
   const root=new T.Group();this.disk(root,0,.04,0,.72,0x0c282b,.18);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3,x=Math.sin(a),z=Math.cos(a);this.rod(root,[x*.28,.75,z*.28],[x*.53,.05,z*.53],.075,GOLD);this.mesh(root,this.ball(0),this.mat(DARK),x*.53,.10,z*.53,.12,.11,.12);}
   this.mesh(root,this.cyl(8),this.mat(IVORY),0,.98,0,.83,.78,.67);this.ring(root,0,1.36,0,.38,GOLD,.04);
   this.mesh(root,this.ball(1),this.mat(0x8ec5ae,.4,.16,0x4a806b),0,1.67,.10,.33,.34,.30);this.mesh(root,this.ball(0),this.mat(0xdbf8e7,.2,.1,0x95d7bc),0,1.67,.38,.14,.13,.08);
   for(const x of [-.50,.50]){this.rod(root,[x,1.15,0],[x*1.3,.72,.35],.07,GOLD);this.mesh(root,this.ball(0),this.mat(DARK),x*1.3,.70,.36,.13,.14,.13);}
   this.rod(root,[0,1.94,0],[0,2.24,0],.035,GOLD);this.mesh(root,this.ball(0),this.mat(0x8ee1be,.3,.1,0x8ee1be),0,2.28,0,.09,.10,.09);return root;
  }
  const root=this.player(id==='irma'?'harvester':'aerologist');const tool=root.userData.tool;this.release(tool);
  if(id==='irma'){
   this.boxAt(root,0,1.02,.34,.68,.68,.09,0x9c7145);this.boxAt(root,0,1.70,.32,.56,.18,.08,0x8d6942);this.rod(root,[.55,.83,.20],[.77,.83,.95],.055,GOLD);this.mesh(root,this.torus(.18,.055),this.mat(GOLD,.35,.4),.77,.84,1.01);
  }else{
   this.boxAt(root,0,1.03,.36,.66,.81,.07,0x786891);this.boxAt(root,0,1.65,.34,.55,.16,.06,0xb6a0db);this.boxAt(root,.59,.83,.40,.40,.09,.54,0xede1c4);this.rod(root,[.42,.79,.68],[.78,.79,.68],.018,GOLD);
  }
  return root;
 }
 enemy(kind,boss,elite=false){
  const root=new T.Group(),limbs=[],rotors=[];const hot=this.mat(0xffad75,.4,.12,0xee713b),brass=this.mat(GOLD,.38,.4),shell=this.mat(IVORY,.65),dark=this.mat(DARK,.7,.12);
  this.disk(root,0,.035,0,kind==='boss'?1.7:.8,0x142726,.22);
  const leg=(x,z,scale=1)=>{const pivot=new T.Group();pivot.position.set(x,.6*scale,z);this.rod(pivot,[0,0,0],[x*.5,-.35*scale,z*.4],.08*scale,GOLD);this.rod(pivot,[x*.5,-.35*scale,z*.4],[x*.7,-.6*scale,z*.7],.06*scale,DARK);root.add(pivot);limbs.push(pivot);};
  if(kind==='mite'){
   this.mesh(root,this.ball(1),dark,0,.58,0,.62,.40,.66);this.mesh(root,this.ball(1),shell,0,.73,-.07,.58,.32,.53);this.mesh(root,this.ball(0),hot,0,.67,.55,.18,.15,.1);
   for(const x of [-.55,.55])for(const z of [-.35,0,.35])leg(x,z,.85);
   this.rod(root,[-.22,.87,.38],[-.36,1.2,.7],.035,GOLD);this.rod(root,[.22,.87,.38],[.36,1.2,.7],.035,GOLD);
  }else if(kind==='sentry'){
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3;leg(Math.sin(a)*.4,Math.cos(a)*.4,1.4);}
   this.mesh(root,this.cyl(8),brass,0,1.15,0,.9,.8,.9);this.mesh(root,this.ball(1),hot,0,1.28,0,.35,.46,.35);
   for(let i=0;i<4;i++){const a=i*Math.PI/2;this.rod(root,[Math.sin(a)*.43,.9,Math.cos(a)*.43],[Math.sin(a)*.32,1.68,Math.cos(a)*.32],.045,IVORY);}
   this.mesh(root,this.cone(8),shell,0,1.83,0,1.0,.35,1.0);this.rod(root,[0,1.3,.4],[0,1.3,.88],.09,DARK);
  }else if(kind==='ram'){
   this.mesh(root,this.ball(1),shell,0,.95,0,.97,.82,1.10);this.boxAt(root,0,1.05,.72,1.25,.55,.34,GOLD);this.boxAt(root,0,1.19,.92,.77,.12,.07,0xe39862);
   for(const x of [-.8,.8])for(const z of [-.57,.57]){const w=this.mesh(root,this.cyl(10),dark,x,.46,z,.70,.33,.70);w.rotation.z=Math.PI/2;}
   for(const x of [-.65,.65])this.rod(root,[x,1.3,.35],[x,1.15,1.25],.15,GOLD);
   this.mesh(root,this.cone(5),brass,0,1.05,1.0,.48,.65,.48).rotation.x=Math.PI/2;
  }else if(kind==='mender'){
   for(let i=0;i<3;i++){const a=i*2.094;leg(Math.sin(a)*.5,Math.cos(a)*.5,1.1);}
   this.mesh(root,this.cyl(7),brass,0,.8,0,.93,.35,.93);this.mesh(root,this.ball(1),this.mat(0x9ab780),0,1.18,0,.52,.58,.52);
   for(let i=0;i<5;i++){const a=i*1.257,leaf=this.mesh(root,this.cone(3),this.mat(i%2?0x91b799:IVORY),Math.sin(a)*.3,1.6,Math.cos(a)*.3,.36,1.0,.12);leaf.rotation.z=Math.cos(a)*.65;leaf.rotation.x=Math.sin(a)*.65;}
   this.mesh(root,this.ball(1),hot,0,1.35,.43,.2,.23,.17);
  }else if(kind==='mortar'){
   for(const x of [-.43,.43])leg(x,0,1.6);this.mesh(root,this.cyl(8),brass,0,1.13,0,.98,1.1,.98);this.mesh(root,this.ball(1),hot,0,1.32,0,.4,.53,.4);
   const tube=this.mesh(root,this.cyl(8),shell,0,1.95,.26,.58,1.0,.58);tube.rotation.x=.65;this.mesh(root,this.torus(.32,.055),brass,0,2.3,.57).rotation.x=.65;this.rod(root,[-.4,.85,0],[-.65,2.12,.25],.055,GOLD);this.rod(root,[.4,.85,0],[.65,2.12,.25],.055,GOLD);
  }else if(kind==='warden'){
   for(const x of [-.53,.53])for(const z of [-.3,.3])leg(x,z,1.3);
   this.mesh(root,this.cyl(6),dark,0,1.05,0,1.18,1.12,1.18);this.mesh(root,this.ball(1),shell,0,1.7,0,.46,.43,.4);this.mesh(root,this.ball(0),hot,0,1.72,.39,.23,.07,.06);
   const shield=this.boxAt(root,0,1.08,.72,1.65,1.25,.25,IVORY);this.boxAt(root,0,1.08,.87,1.65,.11,.08,GOLD);for(const x of [-.65,.65])this.boxAt(root,x,1.08,.86,.09,1.2,.08,GOLD);
  }else{
   const b=boss??'gardener';
   if(b==='gardener'){
    for(let i=0;i<3;i++){const a=i*2.094;leg(Math.sin(a)*.9,Math.cos(a)*.9,2.2);}
    this.mesh(root,this.cyl(8),shell,0,1.35,0,2.1,1.35,2.1);this.ring(root,0,1.72,0,1.08,GOLD,.08);this.mesh(root,this.ball(1),hot,0,1.85,.75,.52,.6,.5);
    this.rod(root,[0,1.8,0],[0,3.25,0],.21,GOLD);const crown=new T.Group();crown.position.y=3.1;
    for(let i=0;i<7;i++){const a=i*2*Math.PI/7;this.rod(crown,[0,0,0],[Math.sin(a)*1.6,.55,Math.cos(a)*1.6],.065,GOLD);const petal=this.mesh(crown,this.cone(3),shell,Math.sin(a)*1.2,.45,Math.cos(a)*1.2,.85,1.7,.25);petal.rotation.z=-Math.sin(a)*.6;petal.rotation.x=Math.cos(a)*.6;}
    this.ring(crown,0,0,0,1.5,GOLD,.06);root.add(crown);rotors.push(crown);
   }else if(b==='herdsman'){
    for(let i=0;i<3;i++){const a=i*2.094;leg(Math.sin(a)*1.1,Math.cos(a)*1.1,3.4);}
    this.mesh(root,this.ball(1),shell,0,2.5,0,1.1,1.1,.7);this.mesh(root,this.ball(1),hot,0,2.4,.7,.43,.43,.22);
    const rotor=new T.Group();rotor.position.set(0,3.0,.4);this.mesh(rotor,this.torus(1.75,.06),brass);
    for(let i=0;i<3;i++){const a=i*2.094,blade=this.boxAt(rotor,Math.sin(a)*1.03,Math.cos(a)*1.03,0,.48,2.2,.18,IVORY);blade.rotation.z=-a;this.rod(rotor,[0,0,0],[Math.sin(a)*1.83,Math.cos(a)*1.83,0],.045,GOLD);}root.add(rotor);rotor.userData.axis='z';rotors.push(rotor);
   }else if(b==='stoker'){
    for(const x of [-1.1,1.1])for(const z of [-.65,.65])leg(x,z,2.5);
    this.mesh(root,this.cyl(10),brass,0,1.8,0,2.65,2.2,2.3);this.mesh(root,this.ball(1),hot,0,1.6,.95,.89,.85,.45);
    for(const x of [-.87,.87])this.boxAt(root,x,1.9,.75,.45,2.1,.72,IVORY);this.mesh(root,this.cyl(10),dark,-.7,3.2,-.3,.65,1.1,.65);this.mesh(root,this.cyl(10),shell,.55,3.45,-.3,.8,1.6,.8);
    for(let i=0;i<3;i++)this.ring(root,0,.85+i*.8,0,1.34,GOLD,.06);this.boxAt(root,0,2.82,.94,1.1,.18,.10,DARK);
   }else if(b==='archivist'){
    this.mesh(root,this.cone(6),dark,0,.7,0,2.3,1.4,2.3);const orbit=new T.Group();orbit.position.y=2.7;this.mesh(orbit,this.ball(1),this.mat(0x877d9b,.3,.3,0x392c55),0,0,0,1.12,1.12,1.12);
    for(let i=0;i<3;i++){const ring=this.mesh(orbit,this.torus(1.5+i*.18,.06),brass);ring.rotation.set(i*.8,i*.7,i*.5);}
    for(let i=0;i<6;i++){const a=i*Math.PI/3,plate=this.boxAt(orbit,Math.sin(a)*1.8,0,Math.cos(a)*1.8,.7,1.3,.12,IVORY);plate.rotation.y=a;this.mesh(orbit,this.ball(0),hot,Math.sin(a)*1.2,0,Math.cos(a)*1.2,.15,.15,.15);}root.add(orbit);rotors.push(orbit);
   }else if(b==='collector'){
    for(let i=0;i<4;i++){const a=i*Math.PI/2;leg(Math.sin(a),Math.cos(a),2.9);}
    this.mesh(root,this.ball(1),dark,0,2.0,0,1.1,1.3,.9);this.mesh(root,this.ball(1),hot,0,2.0,.85,.55,.8,.4);
    for(const x of [-1.6,1.6]){this.rod(root,[0,1.5,0],[x,2.5,0],.15,GOLD);this.mesh(root,this.cyl(8),shell,x,3,0,.46,2.0,.46);for(let i=0;i<4;i++)this.ring(root,x,2.25+i*.4,0,.43,GOLD,.05);}
    const ring=this.mesh(root,this.torus(2.15,.06),this.mat(0xb4ade0,.3,.4),0,2.8,0);rotors.push(ring);ring.userData.axis='z';
   }else{
    this.mesh(root,this.cone(8),brass,0,.65,0,2.8,1.3,2.8);const eye=new T.Group();eye.position.y=3.0;
    this.mesh(eye,this.ball(2),this.mat(0x262439,.26,.5,0x322151),0,0,0,1.2,1.2,1.2);this.mesh(eye,this.ball(1),this.mat(0xa68ce0,.3,.1,0x9465ec),0,0,1.08,.46,.46,.2);
    for(let i=0;i<4;i++){const ring=this.mesh(eye,this.torus(1.55+i*.18,.06),i%2?brass:shell);ring.rotation.set(i*.68,i*.87,i*.44);ring.userData.axis=i%2?'z':'y';rotors.push(ring);}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;this.mesh(eye,this.cone(3),shell,Math.sin(a)*2.2,Math.cos(a)*2.2,0,.4,.8,.2).rotation.z=-a;}
    root.add(eye);root.userData.floating=eye;
   }
  }
  const wind=this.ring(root,0,.09,0,kind==='boss'?2.1:.95,0xffb288,.035);wind.material=this.basic(0xff956a,.85);wind.visible=false;wind.castShadow=false;
  const health=kind==='boss'?null:this.healthBar(root,kind==='mortar'?2.9:2.45,1.35);
  if(elite){for(const x of [-.55,.55]){this.mesh(root,this.cone(5),this.mat(0xa878bb,.38,.25),x,2.02,0,.30,.69,.30);this.rod(root,[x*.65,1.48,.25],[x,2.17,0],.04,GOLD);}this.mesh(root,this.ball(0),this.mat(0xebcaff,.26,.15,0xa567c6),0,2.30,.07,.21,.22,.21);}
  root.userData={...root.userData,limbs,rotors,health,wind,flash:0,oldX:0,oldZ:0,base:1};return root;
 }
 portal(portal,cleared=false){
  const group=new T.Group(),accent=THEMES[portal.theme].accent;
  this.mesh(group,this.cyl(12),this.mat(0x849487),0,.1,0,4.8,.38,4.8);this.ring(group,0,.31,0,2.08,GOLD,.035);
  for(const x of [-1.65,1.65]){this.boxAt(group,x,1.25,0,.5,2.35,.72,IVORY);this.boxAt(group,x,1.25,.385,.13,1.8,.02,GOLD);this.mesh(group,this.ball(0),this.mat(accent,.4,.1,accent),x,2.55,0,.2,.28,.2);}
  const outer=this.mesh(group,this.torus(1.75,.13),this.mat(GOLD,.30,.45),0,2.25,0);
  const inner=this.mesh(group,this.torus(1.58,.035),this.mat(accent,.3,.1,accent),0,2.25,.025);
  const shader=new T.ShaderMaterial({uniforms:{time:{value:0},color:{value:new T.Color(accent)},rank:{value:portal.tier}},transparent:true,depthWrite:false,side:T.DoubleSide,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`varying vec2 vUv;uniform float time;uniform vec3 color;uniform float rank;void main(){vec2 p=vUv-.5;float r=length(p)*2.0;float a=atan(p.y,p.x);float swirl=sin(a*5.0-r*18.0+time*1.1)*.5+.5;float rip=pow(max(0.0,sin(r*38.0-time*1.8+a*2.0)),9.0);float rim=pow(r,5.0);vec3 c=mix(vec3(.025,.09,.115),color*.47,swirl*(.18+.55*r))+color*(rim*.85+rip*.17);float star=pow(max(0.0,sin(a*31.0+r*71.0+time*.3)),54.0)*.45;gl_FragColor=vec4(c+star*color,smoothstep(1.0,.93,r)*.91);}`});
  this.mesh(group,this.geo('portal-disk',()=>new T.CircleGeometry(1.5,64)),shader,0,2.25,.01).castShadow=false;
  for(let i=0;i<portal.tier;i++){const angle=(i-(portal.tier-1)/2)*.28;const x=Math.sin(angle)*1.78,y=2.25+Math.cos(angle)*1.78;this.mesh(group,this.ball(0),this.mat(accent,.4,.1,accent),x,y,.08,.065,.1,.065);}
  const label=this.glyph(`${portal.final?'◎':(['','I','II','III','IV','V'][portal.tier])}  ·  ${portal.title}`,cleared?'#b1e3c7':'#ece3ca',1.0);label.position.y=4.8;group.add(label);
  const beam=this.mesh(group,this.cyl(6),this.basic(accent,.11),0,9,0,.12,14,.12);beam.castShadow=false;
  group.userData={shader,inner,outer,portal,label,beam};return group;
 }
 station(seals=[]){
  const root=new T.Group();this.mesh(root,this.cyl(48),this.mat(0xd3c8a8,.88),0,-.08,0,16,.35,16);this.ring(root,0,.13,0,7.7,GOLD,.035);this.ring(root,0,.14,0,5.7,GOLD,.035);
  const tower=new T.Group();tower.position.set(-3,0,-2);root.add(tower);
  this.mesh(tower,this.cyl(10),this.mat(DARK,.5,.2),0,.5,0,2.7,1.0,2.7);this.mesh(tower,this.cyl(10),this.mat(IVORY),0,1.65,0,1.8,1.55,1.8);this.ring(tower,0,2.25,0,1.0,GOLD,.07);
  const core=this.mesh(tower,this.ball(1),this.mat(TEAL,.4,.15,0x408e7b),0,2.95,0,.7,.85,.7);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;this.rod(tower,[Math.sin(a),.7,Math.cos(a)],[Math.sin(a)*.55,3.8,Math.cos(a)*.55],.065,GOLD);}
  const crown=new T.Group();crown.position.y=4.1;this.ring(crown,0,0,0,2.2,GOLD,.06);this.ring(crown,0,.45,0,1.6,GOLD,.05);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const sail=this.mesh(crown,this.cone(3),this.mat(IVORY),Math.sin(a)*1.7,.12,Math.cos(a)*1.7,.8,1.6,.17);sail.rotation.x=Math.cos(a)*.8;sail.rotation.z=-Math.sin(a)*.8;}
  tower.add(crown);
  for(let i=0;i<5;i++){const a=Math.PI*.55+i*Math.PI*.225,x=-3+Math.cos(a)*4.7,z=-2+Math.sin(a)*4.7,col=seals.includes(i+1)?TEAL:0x87938a;
   this.mesh(root,this.cyl(8),this.mat(IVORY),x,.45,z,.95,.8,.95);this.mesh(root,this.ball(1),this.mat(col,.4,.1,seals.includes(i+1)?col:0),x,1.08,z,.24,.32,.24);this.disk(root,x,.91,z,.40,GOLD);}
  // Console and benches are low, traversable equipment, not invisible collision walls.
  this.boxAt(root,0,.36,3.0,1.45,.55,.75,IVORY);this.boxAt(root,0,.68,3.0,1.18,.08,.61,DARK);this.boxAt(root,0,.735,3.02,.72,.015,.3,0x88baac);
  for(const x of [3.8,5.7])this.boxAt(root,x,.25,3.6,.45,.5,2.3,0xb6ac91);
  const label=this.glyph('И З О Б А Р А','#e8dcc0',1.2);label.position.set(-3,6,-2);root.add(label);root.userData={crown,core};return root;
 }
 poi(poi,used=false){const root=new T.Group();
  if(poi.kind==='camp'){
   this.disk(root,0,.025,0,2.9,0xc6ba95);this.mesh(root,this.cyl(8),this.mat(IVORY),0,.5,0,1.0,1,1.0);this.mesh(root,this.ball(1),this.mat(TEAL,.3,.1,TEAL),0,1.2,0,.4,.45,.4);this.ring(root,0,.85,0,.7,GOLD,.04);
   for(const x of [-1.7,1.7])this.rod(root,[x,0,-1.1],[x,2.8,-1.1],.07,GOLD);const canopy=this.boxAt(root,0,2.75,-.4,4.1,.08,2.0,0xc5d5bd);canopy.rotation.z=.08;this.boxAt(root,-1.5,.2,1.4,1.5,.4,.6,0xa2967d);
  }else if(poi.kind==='archive'){
   this.mesh(root,this.cyl(6),this.mat(IVORY),0,.55,0,1.3,1.1,1.3);this.boxAt(root,0,1.35,0,1.2,.65,.4,DARK);this.boxAt(root,0,1.37,.22,.9,.35,.035,used?0x6b8b7d:0xb8e4c3);this.rod(root,[0,1.7,0],[0,3.5,0],.035,GOLD);this.mesh(root,this.torus(.46,.04),this.mat(GOLD),0,2.8,0);
  }else{
   this.boxAt(root,0,.35,0,1.5,.7,1.05,IVORY);this.boxAt(root,0,.4,.55,1.5,.10,.05,GOLD);this.boxAt(root,0,.55,.59,.30,.25,.08,used?DARK:0x8cbda1);this.boxAt(root,0,.74,0,1.6,.1,1.1,0x465c51);
  }
  return root;
 }
 beacon(kind){const g=new T.Group(),color=kind==='named'?0xd58cff:kind==='meteo'?0xffa15c:0xffc36b;
  const ground=new T.Mesh(this.geo('circle',()=>new T.CircleGeometry(1,48)),new T.MeshBasicMaterial({color,transparent:true,opacity:.26,depthWrite:false,side:T.DoubleSide}));ground.rotation.x=-Math.PI/2;ground.position.y=.06;ground.scale.setScalar(2.6);g.add(ground);
  this.ring(g,0,.09,0,2.6,GOLD,.05);this.rod(g,[0,0,0],[0,3.1,0],.05,GOLD);
  if(kind==='meteo'){for(let i=0;i<3;i++){const a=i*Math.PI*2/3,x=Math.sin(a),z=Math.cos(a);this.rod(g,[x*1.55,.1,z*1.55],[x*.65,2.18,z*.65],.06,IVORY);this.mesh(g,this.ball(0),this.mat(color,.35,.1,color),x*.65,2.18,z*.65,.14,.14,.14);}this.mesh(g,this.torus(.72,.055),this.mat(GOLD,.3,.3),0,2.18,0).rotation.x=Math.PI/2;}
  if(kind==='named'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.sin(a),z=Math.cos(a);this.rod(g,[x*1.2,.1,z*1.2],[x*.45,2.30,z*.45],.045,GOLD);this.mesh(g,this.cone(5),this.mat(0x9e72b6,.35,.2),x*.45,2.48,z*.45,.20,.54,.20);}this.mesh(g,this.ball(1),this.mat(color,.35,.15,color),0,2.42,0,.35,.42,.35);}
  const lamp=new T.Mesh(this.ball(1),new T.MeshBasicMaterial({color}));lamp.position.set(0,3.3,0);lamp.scale.setScalar(.27);g.add(lamp);g.userData={lamp,ground};return g;}
 node(){const g=new T.Group();this.boxAt(g,0,.6,0,.9,1.2,.6,DARK);this.boxAt(g,0,.95,.32,.62,.4,.05,IVORY);this.rod(g,[.55,0,0],[.55,1.7,0],.03,GOLD);
  const lamp=new T.Mesh(this.ball(1),new T.MeshBasicMaterial({color:0xffc36b}));lamp.position.set(0,1.45,0);lamp.scale.setScalar(.17);g.add(lamp);g.userData={lamp};return g;}
 npcMark(color){return new T.Mesh(new T.OctahedronGeometry(.26),new T.MeshBasicMaterial({color}));}
 release(root){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.userData.shared){for(const key of ['map','alphaMap'])if(m[key]?.userData.owned)m[key].dispose();m.dispose();}});root.removeFromParent();}
 dispose(){for(const g of this.geos.values())g.dispose();for(const m of this.materials.values())m.dispose();for(const t of this.textures)t.dispose();this.geos.clear();this.materials.clear();}
}
