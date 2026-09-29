// @ts-nocheck
import * as T from '../vendor/three.module.js';
import {Kit} from './models.js';
import {THEMES,CLASSES} from '../core/content.js';
import {CHUNK,heightAt,regionAt,roadDistance,finalPortal} from '../world/world.js';
import {RNG,hash,noise,clamp,lerp,dist} from '../core/math.js';
import {NPC_SPOTS} from '../world/encounters.js';
import {NPCS} from '../core/dialogue.js';
const GOLD=0xb69661,IVORY=0xe1d7bb;
function polygon(r){const w=r.w/2,d=r.d/2;
 if(r.shape==='octagon'){const c=Math.min(w,d)*.66;return [[-c,-d],[c,-d],[w,-c],[w,c],[c,d],[-c,d],[-w,c],[-w,-c]];}
 if(r.shape==='cross'){const a=5.5;return [[-a,-d],[a,-d],[a,-a],[w,-a],[w,a],[a,a],[a,d],[-a,d],[-a,a],[-w,a],[-w,-a],[-a,-a]];}
 return [[-w,-d],[w,-d],[w,d],[-w,d]];
}
export class GameView {
 renderer;scene;camera;kit=new Kit();env=new T.Group();actors=new T.Group();effects=new T.Group();mode='world';sim;settings;player;
 yaw=.34;distance=29;target=new T.Vector3();elapsed=0;menu=true;shake=0;chunks=new Map();queue=[];enemyViews=new Map();hazardViews=new Map();portals=[];roomViews=[];
 particleData=[];particles;bulletFriendly;bulletEnemy;bulletDiscs;fx=[];dummy=new T.Object3D();color=new T.Color();raycaster=new T.Raycaster();mouse=new T.Vector2();groundPlane=new T.Plane();windTime={value:0};metrics={fps:0,frameMs:0,drawCalls:0,triangles:0,geometries:0,textures:0,chunks:0};
 constructor(container,settings){
  this.settings=settings;
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.renderer.domElement.setAttribute('aria-label','Трёхмерный мир игры «Изобара»');this.renderer.domElement.id='game-canvas';this.renderer.domElement.tabIndex=0;container.appendChild(this.renderer.domElement);
  this.scene=new T.Scene();this.scene.background=new T.Color(0x94afa9);this.scene.fog=new T.Fog(0x94afa9,45,100);
  this.camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.15,240);
  this.scene.add(new T.HemisphereLight(0xe8f0dd,0x637269,2.1));this.sun=new T.DirectionalLight(0xffe3bc,3.3);this.sun.castShadow=true;this.sun.shadow.camera.left=-35;this.sun.shadow.camera.right=35;this.sun.shadow.camera.top=35;this.sun.shadow.camera.bottom=-35;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=135;this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);this.scene.add(this.env,this.actors,this.effects);
  this.createWater();this.createPollen();this.createParticles();this.createProjectiles();this.applySettings(settings);this.resize();window.addEventListener('resize',()=>this.resize());
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();window.dispatchEvent(new CustomEvent('isobara-context-lost'));});
  this.renderer.domElement.addEventListener('webglcontextrestored',()=>window.dispatchEvent(new CustomEvent('isobara-context-restored')));
 }
 applySettings(settings){this.settings=settings;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6)*settings.scale);const shadows=settings.quality!=='low',changed=this.renderer.shadowMap.enabled!==shadows;this.renderer.shadowMap.enabled=shadows;this.renderer.shadowMap.type=T.PCFShadowMap;const size=settings.quality==='high'?2048:1024;if(this.sun.shadow.mapSize.width!==size){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(size,size);}
  // Changing renderer shadow flags does not invalidate cached material programs.
  // Include inactive Kit materials so returning chunks also get the correct shader.
  if(changed){const materials=new Set(this.kit.materials.values());if(this.grassMaterial)materials.add(this.grassMaterial);this.scene.traverse(o=>{if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});for(const m of materials)m.needsUpdate=true;}
  this.pollen.visible=settings.particles;this.resize();if(this.sim&&this.mode==='world')this.updateChunks(true);}
 resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
 createWater(){this.waterMat=new T.ShaderMaterial({uniforms:{time:this.windTime,color:{value:new T.Color(0x507f7c)},fogColor:{value:new T.Color(0x94afa9)},eye:{value:new T.Vector3()}},vertexShader:'varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:`varying vec3 vWorld;uniform float time;uniform vec3 color;uniform vec3 fogColor;uniform vec3 eye;void main(){float a=sin(vWorld.x*.38+vWorld.z*.17+time*.3);float b=sin(vWorld.z*.66-vWorld.x*.14-time*.21);float line=pow(max(0.,a*.5+b*.5),14.);vec3 c=color+line*.09;float fog=smoothstep(38.,100.,distance(eye,vWorld));gl_FragColor=vec4(mix(c,fogColor,fog),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace('1.);#include','1.);\n#include')});const water=new T.Mesh(new T.PlaneGeometry(2000,2000),this.waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.6;this.scene.add(water);this.water=water;}
 createPollen(){const rng=new RNG(97),g=new T.BufferGeometry(),pos=[];for(let i=0;i<130;i++)pos.push(rng.range(-65,65),rng.range(2,20),rng.range(-65,65));g.setAttribute('position',new T.Float32BufferAttribute(pos,3));this.pollen=new T.Points(g,new T.PointsMaterial({color:0xe8d5a5,size:.085,transparent:true,opacity:.40,depthWrite:false}));this.scene.add(this.pollen);}
 createParticles(){this.particles=new T.InstancedMesh(this.kit.ball(0),this.kit.basic(0xffffff),480);this.particles.instanceMatrix.setUsage(T.DynamicDrawUsage);this.particles.count=0;this.particles.frustumCulled=false;this.scene.add(this.particles);}
 createProjectiles(){this.bulletFriendly=new T.InstancedMesh(this.kit.ball(0),this.kit.basic(0x9fedda),220);this.bulletEnemy=new T.InstancedMesh(this.kit.ball(0),this.kit.basic(0xffa478),220);this.bulletDiscs=new T.InstancedMesh(this.kit.torus(.36,.075),this.kit.basic(0xd7bbff),220);for(const mesh of [this.bulletFriendly,this.bulletEnemy,this.bulletDiscs]){mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.scene.add(mesh);}}
 setSimulation(sim){this.sim=sim;if(this.player)this.kit.release(this.player);this.player=this.kit.player(sim.p.classId,sim.st.family);this.actors.add(this.player);this.rebuild();}
 rebuild(){
  if(!this.sim)return;for(const c of [...this.env.children])this.kit.release(c);for(const root of this.enemyViews.values())this.kit.release(root);this.enemyViews.clear();for(const root of this.hazardViews.values())this.kit.release(root);this.hazardViews.clear();this.chunks.clear();this.queue=[];this.portals=[];this.roomViews=[];
  this.mode=this.sim.layout?'expedition':'world';this.water.position.y=this.mode==='world'?-.6:-11;
  const p=this.sim.p;this.target.set(p.x,this.y(p.x,p.z)+.9,p.z);this.particles.count=0;this.particleData=[];
  if(this.mode==='world'){
   const station=this.kit.station(this.sim.state.seals);station.position.y=heightAt(0,0,this.sim.state.seed);this.env.add(station);this.station=station;
   if(this.sim.state.seals.length===5){const desc=finalPortal(this.sim.state.seed),root=this.kit.portal(desc,this.sim.state.finalCleared);root.position.set(desc.x,this.y(desc.x,desc.z),desc.z);this.env.add(root);this.portals.push(root);}
   this.npcViews=[];for(const [id,pos] of Object.entries(NPC_SPOTS)){const def=NPCS[id],actor=this.kit.npc(id);actor.position.set(pos.x,this.y(pos.x,pos.z),pos.z);
    if(actor.userData.health)actor.userData.health.holder.visible=false;if(actor.userData.wind)actor.userData.wind.visible=false;
    const mark=this.kit.npcMark(def.color);mark.position.y=2.9;actor.add(mark);const label=this.kit.glyph(def.name,`#${def.color.toString(16).padStart(6,'0')}`,.7);label.position.y=3.65;actor.add(label);this.env.add(actor);this.npcViews.push({actor,pos,mark});}
   this.updateChunks(true);for(let i=0;i<9&&this.queue.length;i++)this.buildQueuedChunk();
  }else{this.station=null;this.buildDungeon();for(const e of this.sim.enemies()){const actor=this.kit.enemy(e.kind,e.boss);this.actors.add(actor);this.enemyViews.set(e.id,actor);}}
 }
 y(x,z){return this.mode==='world'?heightAt(x,z,this.sim?.state.seed??1):0;}
 updateChunks(force=false){if(this.mode!=='world'||!this.sim)return;const p=this.menu?{x:6,z:-6}:this.sim.p,cx=Math.floor(p.x/CHUNK),cz=Math.floor(p.z/CHUNK),rad=this.settings.quality==='low'?1:2,key=`${cx},${cz}:${rad}`;if(!force&&this.chunkKey===key)return;this.chunkKey=key;
  const wanted=new Set(),pending=[];for(let dx=-rad;dx<=rad;dx++)for(let dz=-rad;dz<=rad;dz++){const x=cx+dx,z=cz+dz,k=`${x},${z}`;wanted.add(k);if(!this.chunks.has(k))pending.push({x,z,key:k,d:Math.hypot(dx,dz)});}
  this.queue=pending.sort((a,b)=>a.d-b.d);for(const [id,root] of this.chunks)if(!wanted.has(id)){this.portals=this.portals.filter(p=>p.parent!==root);this.kit.release(root);this.chunks.delete(id);}
 }
 buildQueuedChunk(){if(!this.queue.length)return;const {x,z,key}=this.queue.shift();if(this.chunks.has(key))return;const desc={...this.sim.world.chunk(x,z),cx:x,cz:z},root=new T.Group();this.buildTerrain(root,desc);this.buildProps(root,desc);
  for(const p of desc.portals){const model=this.kit.portal(p,!!this.sim.state.completions[p.id]);model.position.set(p.x,this.y(p.x,p.z),p.z);root.add(model);this.portals.push(model);}
  for(const p of desc.pois)if(p.id!=='home'){const model=this.kit.poi(p,this.sim.state.collected.includes(p.id));model.position.set(p.x,this.y(p.x,p.z),p.z);root.add(model);}
  root.userData.marks=[];
  for(const enc of desc.encounters){const b=this.kit.beacon(enc.kind);b.position.set(enc.x,this.y(enc.x,enc.z),enc.z);root.add(b);root.userData.marks.push({enc,model:b,type:'beacon'});
   if(enc.device){const n=this.kit.node();n.position.set(enc.device.x,this.y(enc.device.x,enc.device.z),enc.device.z);root.add(n);root.userData.marks.push({enc,model:n,type:'node'});}}
  this.chunks.set(key,root);this.env.add(root);
 }
 syncEnemyViews(){const list=this.sim.worldEnemies,ids=new Set(list.map(e=>e.id));
  for(const e of list)if(!this.enemyViews.has(e.id)){const a=this.kit.enemy(e.kind,e.boss,!!e.elite);this.actors.add(a);this.enemyViews.set(e.id,a);}
  for(const [id,root] of [...this.enemyViews])if(!ids.has(id)){this.kit.release(root);this.enemyViews.delete(id);}}
 updateMarks(){const st=this.sim.state,calm=Math.max(0,st.seals.length-1);
  for(const root of this.chunks.values())for(const m of root.userData.marks??[]){const done=!!st.encounters[m.enc.id]?.done,calmed=!done&&m.enc.kind!=='named'&&!m.enc.fixed&&m.enc.tier<=calm;
   const awake=this.sim.worldEnemies.some(e=>!e.dead&&this.sim.awake.has(e.id)&&this.sim.encOf(e)===m.enc);
   const color=done||calmed?0x8ee6b0:awake?0xff7a5c:m.enc.kind==='named'?0xd58cff:m.type==='node'?0xffe08a:0xffc36b,d=m.model.userData;
   d.lamp.material.color.setHex(color);if(d.ground)d.ground.material.color.setHex(color);m.model.visible=!(m.type==='node'&&done&&false);
   d.lamp.scale.setScalar((m.type==='node'?.17:.27)*(done||calmed?.8:1+Math.sin(this.elapsed*3)*.12));}}
 buildTerrain(parent,c){const n=16,positions=[],colors=[],indices=[],seed=this.sim.state.seed,color=new T.Color(),a=new T.Color(),b=new T.Color();
  for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){const x=c.cx*32+ix*2,z=c.cz*32+iz*2,y=heightAt(x,z,seed);positions.push(x,y,z);const r=Math.hypot(x,z),variation=noise(x*.21,z*.21,seed+7)*.08+noise(x*.047,z*.047,seed+33)*.11;
   if(r<65)color.setHex(0x8aa68b);else if(r<80){a.setHex(0x8aa68b);b.setHex(0xbd9d76);color.copy(a).lerp(b,(r-65)/15);}else if(r<140)color.setHex(0xbd9d76);else if(r<155){a.setHex(0xbd9d76);b.setHex(0x9195aa);color.copy(a).lerp(b,(r-140)/15);}else color.setHex(0x9195aa);
   color.multiplyScalar(1+variation);const road=roadDistance(x,z,seed);if(road<3.5)color.lerp(new T.Color(0xd2c7a6),clamp((3.5-road)/2.2,0,.9));if(r>225)color.lerp(new T.Color(0xc7bb91),clamp((r-225)/6,0,1));colors.push(color.r,color.g,color.b);
  }
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const mat=this.kit.mat(0xffffff,.97);mat.vertexColors=true;const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;parent.add(mesh);
 }
 instances(parent,geo,material,list){if(!list.length)return;const mesh=new T.InstancedMesh(geo,material,list.length);for(let i=0;i<list.length;i++){const a=list[i];this.dummy.position.set(a.x,a.y,a.z);this.dummy.rotation.set(a.rx??0,a.ry??0,a.rz??0);this.dummy.scale.set(a.sx??1,a.sy??1,a.sz??1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);if(a.color!==undefined){this.color.setHex(a.color);mesh.setColorAt(i,this.color);}}
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 buildProps(root,c){const trunk=[],canopy=[],rocks=[],grass=[],reeds=[],tips=[],machines=[],vanes=[],shadows=[],theme=regionAt(c.cx*32+16,c.cz*32+16);
  const colors=theme==='garden'?[0x4e8170,0x6c9984,0xa4b58b,0x548777]:theme==='foundry'?[0xb8aa80,0xa08d6d,0xc1b590,0x7e947e]:[0x949cc1,0xabb2c6,0x748c9d,0xbbacd0];
  for(const original of c.props??[]){const p={...original,kind:original.kind??original.type,scale:original.scale??original.s??1,rot:original.rot??original.angle??0,color:Math.abs(Math.floor(Number(original.color??original.variant??0)))%4};if(!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;const h=this.y(p.x,p.z),s=p.scale;
   if(p.kind==='tree'){
    trunk.push({x:p.x,y:h+1.0*s,z:p.z,sx:.30*s,sy:2.0*s,sz:.30*s,color:0x7a7661});
    if(theme==='archive'){for(let j=0;j<3;j++)canopy.push({x:p.x+Math.sin(p.rot+j*2.1)*.35*s,y:h+(1.9+j*.5)*s,z:p.z+Math.cos(p.rot+j*2.1)*.35*s,sx:.43*s,sy:.95*s,sz:.43*s,ry:p.rot,color:colors[(p.color+j)%4]});}
    else{canopy.push({x:p.x,y:h+2.7*s,z:p.z,sx:1.23*s,sy:1.55*s,sz:1.1*s,ry:p.rot,color:colors[p.color]});canopy.push({x:p.x+.50*s,y:h+2.12*s,z:p.z-.35*s,sx:.92*s,sy:1.0*s,sz:.83*s,ry:p.rot,color:colors[(p.color+1)%4]});}
    shadows.push({x:p.x,y:h+.027,z:p.z,sx:1.55*s,sy:1.55*s,sz:1,rx:-Math.PI/2,color:0x405f50});
   }else if(p.kind==='rock'){rocks.push({x:p.x,y:h+.36*s,z:p.z,sx:.9*s,sy:.67*s,sz:.78*s,ry:p.rot,color:theme==='archive'?0xbbbac4:theme==='foundry'?0xcab48f:0xaab3a0});}
   else if(p.kind==='machine'){
    machines.push({x:p.x,y:h+1.0*s,z:p.z,sx:1.02*s,sy:2*s,sz:1.02*s,ry:p.rot,color:0xded4b9});trunk.push({x:p.x,y:h+2.25*s,z:p.z,sx:.12*s,sy:1.3*s,sz:.12*s,color:GOLD});
    for(let j=0;j<3;j++)vanes.push({x:p.x+Math.sin(p.rot+j*2.09)*.5*s,y:h+2.85*s,z:p.z+Math.cos(p.rot+j*2.09)*.5*s,sx:.24*s,sy:.1*s,sz:1.35*s,ry:p.rot+j*2.09,color:0xc3b384});
   }else if(p.kind==='grass'){
    if(this.settings.quality==='low'&&p.color%2)continue;for(let j=0;j<3;j++)grass.push({x:p.x+(j-1)*.15,y:h,z:p.z,sx:.20*s,sy:.46*s*(1+j*.2),sz:1,ry:p.rot+j*1.1,color:colors[(p.color+1)%4]});
   }else if(p.kind==='reed'){reeds.push({x:p.x,y:h+.68*s,z:p.z,sx:.065*s,sy:1.4*s,sz:.065*s,color:0xb7b798});tips.push({x:p.x,y:h+1.42*s,z:p.z,sx:.12*s,sy:.28*s,sz:.12*s,ry:p.rot,color:0xe9d6a6});}
   else tips.push({x:p.x,y:h+.26*s,z:p.z,sx:.19*s,sy:.23*s,sz:.19*s,color:theme==='archive'?0xd1c0df:0xe7ce92});
  }
  const white=this.kit.mat(0xffffff,.91);this.instances(root,this.kit.cyl(6),white,trunk);this.instances(root,theme==='archive'?this.kit.geo('oct',()=>new T.OctahedronGeometry(1)):this.kit.ball(0),white,canopy);this.instances(root,this.kit.ball(0),white,rocks);this.instances(root,this.kit.cyl(5),white,reeds);this.instances(root,this.kit.ball(0),white,tips);this.instances(root,this.kit.cyl(7),white,machines);this.instances(root,this.kit.box(),white,vanes);
  if(!this.grassMaterial){this.grassMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:1,side:T.DoubleSide});this.grassMaterial.userData.shared=true;this.grassMaterial.onBeforeCompile=shader=>{shader.uniforms.uWindTime=this.windTime;shader.vertexShader='uniform float uWindTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\n transformed.x += sin(uWindTime*1.7+instanceMatrix[3].x*.11+instanceMatrix[3].z*.07)*position.y*position.y*.12;\n#endif');};this.grassMaterial.customProgramCacheKey=()=> 'isobara-grass-v1';}
  const blade=this.kit.geo('blade',()=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.5,0,0,.5,0,0,.18,1,0],3));g.computeVertexNormals();return g;});this.instances(root,blade,this.grassMaterial,grass);
 }
 buildDungeon(){const l=this.sim.layout,theme=THEMES[l.theme];this.dungeonTheme=theme;const base=this.kit.mat(theme.floor,.86),edge=this.kit.mat(IVORY,.8);
  for(const r of l.rooms){const group=new T.Group();group.position.set(r.x,0,r.z);this.env.add(group);this.roomViews.push(group);const pts=polygon(r),shape=new T.Shape();shape.moveTo(pts[0][0],-pts[0][1]);for(let i=1;i<pts.length;i++)shape.lineTo(pts[i][0],-pts[i][1]);shape.closePath();
   const geo=new T.ExtrudeGeometry(shape,{depth:.65,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.13,bevelThickness:.09});geo.rotateX(-Math.PI/2);const floor=new T.Mesh(geo,base);floor.position.y=-.73;floor.receiveShadow=true;floor.castShadow=true;group.add(floor);
   this.kit.mesh(group,this.kit.ball(0),this.kit.mat(theme.edge,.94),0,-2.1,0,r.w*.43,1.9,r.d*.43).castShadow=false;
   const linked=l.corridors.filter(c=>c.from===r.id||c.to===r.id).map(c=>l.rooms[c.from===r.id?c.to:c.from]);
   for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],dx=b[0]-a[0],dz=b[1]-a[1];let spans=[[a,b]];
    if(dx===0&&Math.abs(a[0])===r.w/2&&linked.some(s=>Math.sign(s.x-r.x)===Math.sign(a[0])&&s.z===r.z)){
     const zlo=Math.min(a[1],b[1]),zhi=Math.max(a[1],b[1]);spans=[[[a[0],zlo],[a[0],-3.25]],[[a[0],3.25],[a[0],zhi]]];
    }else if(dz===0&&Math.abs(a[1])===r.d/2&&linked.some(s=>Math.sign(s.z-r.z)===Math.sign(a[1])&&s.x===r.x)){
     const xlo=Math.min(a[0],b[0]),xhi=Math.max(a[0],b[0]);spans=[[[xlo,a[1]],[-3.25,a[1]]],[[3.25,a[1]],[xhi,a[1]]]];
    }
    for(const [p,q] of spans){const len=Math.hypot(q[0]-p[0],q[1]-p[1]);if(len<.1)continue;const rail=this.kit.boxAt(group,(p[0]+q[0])/2,.38,(p[1]+q[1])/2,.33,.64,len,IVORY);rail.rotation.y=Math.atan2(q[0]-p[0],q[1]-p[1]);const trim=this.kit.boxAt(group,(p[0]+q[0])/2,.73,(p[1]+q[1])/2,.12,.07,len,GOLD);trim.rotation.y=rail.rotation.y;}
   }
   // Floor inlays and module-specific architectural silhouettes.
   this.kit.ring(group,0,.02,0,r.role==='boss'?8.8:r.role==='rest'?3:3.6,GOLD,.022);
   this.kit.ring(group,0,.025,0,r.role==='boss'?9.3:3.9,theme.accent,.014);
   for(const o of r.obstacles){const x=o.x-r.x,z=o.z-r.z,rad=o.r;
    this.kit.mesh(group,this.kit.cyl(8),this.kit.mat(GOLD,.5,.3),x,.3,z,rad*1.7,.55,rad*1.7);this.kit.mesh(group,this.kit.cyl(10),this.kit.mat(IVORY),x,1.3,z,rad*1.55,1.8,rad*1.55);this.kit.ring(group,x,2.22,z,rad*.87,GOLD,.06);
    if(l.theme==='garden'){this.kit.mesh(group,this.kit.ball(1),this.kit.mat(theme.accent,.3,.0,0x2c5344),x,2.65,z,rad*.63,.65,rad*.63);for(let j=0;j<3;j++){const a=j*2.094,leaf=this.kit.mesh(group,this.kit.cone(3),this.kit.mat(0x8eb89c),x+Math.sin(a)*.3,2.7,z+Math.cos(a)*.3,.5,1.2,.14);leaf.rotation.z=Math.sin(a)*.7;}}
    else if(l.theme==='foundry'){this.kit.mesh(group,this.kit.cyl(6),this.kit.mat(0x58625a),x,2.75,z,rad*.65,1.2,rad*.65);this.kit.boxAt(group,x,1.6,z+rad*.81,rad,.52,.05,0xcd9f65);}
    else {const orbit=this.kit.mesh(group,this.kit.torus(rad*.8,.06),this.kit.mat(theme.accent,.3,.3),x,2.9,z);orbit.rotation.y=.5;this.kit.mesh(group,this.kit.ball(0),this.kit.mat(theme.accent,.4,.2,0x403752),x,2.9,z,.35,.4,.35);}
   }
   if(['glasshouse','gallery','archive'].includes(r.module)){
    // An open roof skeleton: the camera never has to see through an opaque ceiling.
    for(const z of [-r.d/2+1,r.d/2-1]){this.kit.rod(group,[-r.w/2+1,.65,z],[-r.w/2+1,3.3,z],.065,GOLD);this.kit.rod(group,[r.w/2-1,.65,z],[r.w/2-1,3.3,z],.065,GOLD);this.kit.rod(group,[-r.w/2+1,3.3,z],[0,5.1,z],.055,GOLD);this.kit.rod(group,[0,5.1,z],[r.w/2-1,3.3,z],.055,GOLD);}
   }
   if(r.role==='rest'){const station=this.kit.poi({kind:'camp'});group.add(station);}
   if(r.role==='entry'){const back=this.kit.portal({...this.sim.state.run.portal,title:'Возвращение',tier:1});back.scale.setScalar(.7);back.position.set(0,0,-2);group.add(back);this.portals.push(back);}
   if(r.role==='boss'){
    for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,x=Math.sin(a)*10,z=Math.cos(a)*10;this.kit.mesh(group,this.kit.cyl(7),this.kit.mat(IVORY),x,1.3,z,1.1,2.6,1.1);this.kit.mesh(group,this.kit.ball(1),this.kit.mat(theme.accent,.4,.1,theme.accent),x,2.9,z,.3,.45,.3);}
   }
   group.userData.room=r;
  }
  for(const c of l.corridors){const a=l.rooms[c.from],b=l.rooms[c.to],dx=Math.sign(b.x-a.x),dz=Math.sign(b.z-a.z),ha=dx?a.w/2:a.d/2,hb=dx?b.w/2:b.d/2,ax=a.x+dx*ha,az=a.z+dz*ha,bx=b.x-dx*hb,bz=b.z-dz*hb,len=Math.hypot(bx-ax,bz-az),g=new T.Group();g.position.set((ax+bx)/2,0,(az+bz)/2);g.rotation.y=Math.atan2(dx,dz);this.env.add(g);
   this.kit.boxAt(g,0,-.24,0,6.25,.40,len,theme.edge);this.kit.boxAt(g,0,-.025,0,5.6,.06,len,0xc5bfa9);
   for(const x of [-3,3]){this.kit.boxAt(g,x,.4,0,.13,.08,len,GOLD);for(let z=-len/2;z<=len/2;z+=3)this.kit.boxAt(g,x,.17,z,.12,.54,.12,IVORY);}
   for(let z=-len/2+1;z<len/2;z+=2.4)this.kit.boxAt(g,0,.015,z,4.8,.024,.05,GOLD);
  }
 }
 event(e){
  if(e.type==='hit'){const nearest=[...this.enemyViews.values()].sort((a,b)=>Math.hypot(a.position.x-e.x,a.position.z-e.z)-Math.hypot(b.position.x-e.x,b.position.z-e.z))[0];if(nearest)nearest.userData.flash=.15;this.emitParticles(e,5,1.1);}
  if(e.type==='kill')this.emitParticles(e,20,2.3);
  if(e.type==='dash'){this.emitParticles(e,14,.7);}
  if(e.type==='heal'||e.type==='level'||e.type==='loot')this.emitParticles(e,24,2.0);
  if(e.type==='warning'&&e.value!==undefined&&this.settings.shake)this.shake=.18;
  if(e.type==='shot'){this.player.userData.attack=.15;this.emitParticles({x:e.x+(e.dx??0),z:e.z+(e.dz??0),color:e.color},3,.5);}
  if(e.type==='slash'){if(Math.hypot(e.x-this.sim.p.x,e.z-this.sim.p.z)<.3)this.player.userData.attack=.25;this.transientArc(e);}
  if(e.type==='cast'){this.emitParticles(e,24,2);if(e.visual)this.transientSkill(e);else if(e.dx!==undefined)this.transientBeam(e);else this.transientRing(e);}
  if(e.type==='combo'&&e.visual==='finisher')this.transientSkill(e);
 }
 emitParticles(e,count,spread){if(!this.settings.particles)return;const rng=new RNG(hash(this.seqCounter=(this.seqCounter??0)+1,Math.round(this.elapsed*1000)));const limit=this.settings.quality==='low'?120:460;
  for(let i=0;i<count&&this.particleData.length<limit;i++)this.particleData.push({x:e.x,y:this.y(e.x,e.z)+.8,z:e.z,vx:rng.range(-spread,spread),vy:rng.range(1,4),vz:rng.range(-spread,spread),life:rng.range(.25,.8),full:.8,size:rng.range(.035,.12),color:e.color??0x9fe4cb});
 }
 transientRing(e){const geo=this.kit.geo('fx-ring',()=>new T.RingGeometry(.9,1,56)),mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:e.color??0xacebd6,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(e.x,this.y(e.x,e.z)+.12,e.z);this.effects.add(mesh);this.fx.push({mesh,life:.55,full:.55,size:e.radius??4,ring:true});}
 transientArc(e){const geo=new T.RingGeometry((e.radius??3)*.8,e.radius??3,28,1,-.9,1.8);geo.rotateX(-Math.PI/2);const mat=new T.MeshBasicMaterial({color:e.color??CLASSES[this.sim.p.classId].color,side:T.DoubleSide,transparent:true,opacity:.62,depthWrite:false});const mesh=new T.Mesh(geo,mat);mesh.position.set(e.x,this.y(e.x,e.z)+.56,e.z);mesh.rotation.y=-Math.atan2(e.dz??1,e.dx??0);this.effects.add(mesh);this.fx.push({mesh,life:.18,full:.18});}
 transientBeam(e){const a=new T.Vector3(e.x,this.y(e.x,e.z)+1.3,e.z),b=new T.Vector3(e.x+e.dx,this.y(e.x+e.dx,e.z+e.dz)+1.1,e.z+e.dz),geo=new T.BufferGeometry().setFromPoints([a,b]),mesh=new T.Line(geo,new T.LineBasicMaterial({color:e.color??0xd0fff1,transparent:true,opacity:1,depthTest:false}));this.effects.add(mesh);this.fx.push({mesh,life:.23,full:.23});}
 transientSkill(e){
  if(e.visual==='anchor'){
   for(let i=0;i<3;i++){const mesh=new T.Mesh(this.kit.geo('fx-ring',()=>new T.RingGeometry(.9,1,56)),new T.MeshBasicMaterial({color:i===0?0xf3cb83:0xffe3ae,transparent:true,opacity:.76,side:T.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(e.x,this.y(e.x,e.z)+.13+i*.08,e.z);mesh.scale.setScalar(9.5-i*1.5);this.effects.add(mesh);this.fx.push({mesh,life:.55+i*.08,full:.55+i*.08,size:9.5-i*1.5,ring:true,reverse:true});}
   return;
  }
  if(e.visual==='lance'||e.visual==='gust'||e.visual==='finisher'){
   const length=Math.hypot(e.dx,e.dz)||1,nx=-(e.dz??0)/length,nz=(e.dx??0)/length,color=e.color??0xb4fff0;
   for(const offset of e.visual==='lance'?[-.22,0,.22]:e.visual==='gust'?[-.58,0,.58]:[-.15,.15])this.transientBeam({...e,x:e.x+nx*offset,z:e.z+nz*offset,color});
   if(e.visual==='lance'){
    const tip=new T.Mesh(this.kit.cone(8),new T.MeshBasicMaterial({color:0xd6fff6,transparent:true,opacity:.88,depthWrite:false}));tip.position.set(e.x+e.dx,this.y(e.x+e.dx,e.z+e.dz)+1.1,e.z+e.dz);tip.rotation.x=Math.PI/2;tip.rotation.y=Math.atan2(e.dx,e.dz);tip.scale.set(.48,1.2,.48);this.effects.add(tip);this.fx.push({mesh:tip,life:.30,full:.30});
   }else if(e.visual==='gust'){
    this.transientRing({...e,radius:2.3,color});for(const q of [.33,.66,1])this.transientArc({...e,x:e.x+e.dx*q,z:e.z+e.dz*q,radius:1.9,color});
   }else{this.transientRing({...e,x:e.x+e.dx,z:e.z+e.dz,radius:2.1,color});this.emitParticles({x:e.x+e.dx,z:e.z+e.dz,color},14,1.1);}
  }
 }
 updateParticles(dt){for(const p of this.particleData){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=5*dt;}this.particleData=this.particleData.filter(p=>p.life>0);this.particles.count=this.particleData.length;
  for(let i=0;i<this.particleData.length;i++){const p=this.particleData[i];this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(p.size*Math.min(1,p.life*5));this.dummy.updateMatrix();this.particles.setMatrixAt(i,this.dummy.matrix);this.color.setHex(p.color);this.particles.setColorAt(i,this.color);}if(this.particles.count){this.particles.instanceMatrix.needsUpdate=true;this.particles.instanceColor.needsUpdate=true;}
  for(const f of this.fx){f.life-=dt;f.mesh.material.opacity=Math.max(0,f.life/f.full)*.7;if(f.ring)f.mesh.scale.setScalar(f.size*(f.reverse?f.life/f.full:1-f.life/f.full));}for(const f of this.fx.filter(f=>f.life<=0))this.kit.release(f.mesh);this.fx=this.fx.filter(f=>f.life>0);
 }
 updateBullets(){let f=0,e=0,d=0;for(const p of this.sim.projectiles){const disc=!p.enemy&&p.turn!==undefined,mesh=p.enemy?this.bulletEnemy:disc?this.bulletDiscs:this.bulletFriendly,index=p.enemy?e++:disc?d++:f++;if(index>=220)continue;this.dummy.position.set(p.x,this.y(p.x,p.z)+1.15,p.z);this.dummy.rotation.set(disc?-.3:0,Math.atan2(p.vx,p.vz)+(disc?this.elapsed*13:0),disc?.35:0);this.dummy.scale.set(disc?1:p.enemy?.20:.105,disc?1:p.enemy?.20:.105,disc?1:p.enemy?.33:.44);this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);}for(const [mesh,count] of [[this.bulletFriendly,f],[this.bulletEnemy,e],[this.bulletDiscs,d]]){mesh.count=Math.min(count,220);mesh.instanceMatrix.needsUpdate=true;}}
 updateHazards(){const keep=new Set();for(const h of this.sim.hazards){keep.add(h.id);let group=this.hazardViews.get(h.id);if(!group){group=new T.Group();const color=h.enemy?0xf28b6f:0x98d6c8;
   if(h.kind==='line'){const fill=new T.Mesh(this.kit.geo('hazard-plane',()=>new T.PlaneGeometry(1,1)),new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:.3,depthWrite:false}));fill.rotation.x=-Math.PI/2;group.add(fill);group.userData={fill};}
   else{const fill=new T.Mesh(this.kit.geo('circle',()=>new T.CircleGeometry(1,48)),new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:.12,depthWrite:false}));fill.rotation.x=-Math.PI/2;const ring=new T.Mesh(this.kit.geo('warning-ring',()=>new T.RingGeometry(.93,1,64)),new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.01;group.add(fill,ring);group.userData={fill,ring};}
   this.effects.add(group);this.hazardViews.set(h.id,group);
  }
  const rad=h.kind==='ring'&&h.delay>0?h.length:h.radius;
  if(h.kind==='line'){group.position.set(h.x+h.dx*h.length/2,this.y(h.x,h.z)+.12,h.z+h.dz*h.length/2);group.rotation.y=Math.atan2(h.dx,h.dz);group.userData.fill.scale.set(h.radius*2,h.length,1);group.userData.fill.material.opacity=h.delay>0?.22+.12*Math.sin(this.elapsed*7):.8;}
  else{group.position.set(h.x,this.y(h.x,h.z)+.07,h.z);group.scale.setScalar(rad);group.userData.fill.material.opacity=h.kind==='ring'?.018:h.delay>0?.11:.28;group.userData.ring.material.opacity=h.delay>0?.65:.95;}
 }
 for(const [id,group] of this.hazardViews)if(!keep.has(id)){this.kit.release(group);this.hazardViews.delete(id);}}
 animateActor(root,pos,dt,isPlayer=false){const data=root.userData,h=this.y(pos.x,pos.z);const speed=Math.hypot(pos.x-data.oldX,pos.z-data.oldZ)/(dt||.016);data.oldX=pos.x;data.oldZ=pos.z;root.position.set(pos.x,h,pos.z);const face=isPlayer?Math.atan2(pos.faceX,pos.faceZ):Math.atan2(pos.dx,pos.dz);let delta=face-root.rotation.y;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;root.rotation.y+=delta*(1-Math.exp(-dt*15));
  data.walking=(data.walking??0)+(clamp(speed/5,0,1)-(data.walking??0))*(1-Math.exp(-dt*16));const walking=data.walking,swing=Math.sin(this.elapsed*11)*walking;
  data.limbs?.forEach((leg,i)=>leg.rotation.x=(i%2?1:-1)*swing*.48);
  data.rotors?.forEach((rotor,i)=>rotor.rotation[rotor.userData.axis??'y']+=dt*(.23+i*.07));
  if(data.floating)data.floating.position.y=3+Math.sin(this.elapsed*1.1)*.17;
  if(isPlayer){data.attack=Math.max(0,data.attack-dt);data.arms[0].rotation.x=swing*.30;data.arms[1].rotation.x+=((data.attack>0?-.65:-swing*.25)-data.arms[1].rotation.x)*(1-Math.exp(-dt*24));const toolTarget=pos.classId==='harvester'&&data.attack>0?Math.sin(data.attack*24)*.55:0;data.tool.rotation.y+=(toolTarget-data.tool.rotation.y)*(1-Math.exp(-dt*28));data.cape.rotation.x=.08+walking*.2+Math.sin(this.elapsed*2)*.045;}
  else{data.flash=Math.max(0,data.flash-dt);root.scale.setScalar((pos.elite?1.35:1)*(1+data.flash*.22));data.wind.visible=pos.windup>0;data.wind.scale.setScalar(1+Math.sin(this.elapsed*8)*.05);if(data.health){data.health.holder.visible=pos.hp<pos.maxHp||pos.windup>0;data.health.fill.scale.x=data.health.width*.96*clamp(pos.hp/pos.maxHp,0,1);}}
 }
 update(dt){if(!this.sim)return;this.elapsed+=dt;this.windTime.value=this.elapsed;this.updateChunks();if(this.queue.length)this.buildQueuedChunk();
  const p=this.sim.p;if(this.player.userData.family!==this.sim.st.family){this.kit.release(this.player);this.player=this.kit.player(p.classId,this.sim.st.family);this.actors.add(this.player);}this.animateActor(this.player,p,dt,true);
  if(this.mode==='world'){this.syncEnemyViews();this.updateMarks();for(const n of this.npcViews??[]){n.actor.rotation.y=Math.atan2(p.x-n.pos.x,p.z-n.pos.z);n.mark.position.y=2.9+Math.sin(this.elapsed*2)*.12;n.mark.rotation.y+=dt;}}
  for(const e of this.sim.enemies()){const root=this.enemyViews.get(e.id);if(root){root.visible=!e.dead;if(!e.dead)this.animateActor(root,e,dt);}}
  for(const root of this.portals){const d=root.userData;d.shader.uniforms.time.value=this.elapsed;d.inner.rotation.z=this.elapsed*.25;d.outer.rotation.z=Math.sin(this.elapsed*.22)*.08;d.label.visible=this.menu||dist({x:root.getWorldPosition(new T.Vector3()).x,z:root.getWorldPosition(new T.Vector3()).z},p)<34;}
  if(this.station){this.station.userData.crown.rotation.y=this.elapsed*.11;this.station.userData.core.position.y=2.95+Math.sin(this.elapsed*.9)*.12;}
  this.updateBullets();this.updateHazards();this.updateParticles(dt);this.pollen.position.set(p.x,0,p.z);this.pollen.rotation.y=this.elapsed*.003;
  const layout=this.sim.layout,region=regionAt(p.x,p.z),zone=layout?.theme??region;const fog=new T.Color(layout?THEMES[zone].fog:region==='garden'?0x94afa9:region==='foundry'?0xb2a392:0x919bab);const restored=layout?0:this.sim.state.seals.length/5;fog.lerp(new T.Color(0xc3d9ca),restored*.22);this.sun.intensity+=(3.3+restored*.35-this.sun.intensity)*(1-Math.exp(-dt*2));this.scene.background.lerp(fog,1-Math.exp(-dt*2));this.scene.fog.color.copy(this.scene.background);this.waterMat.uniforms.fogColor.value.copy(this.scene.background);this.scene.fog.near=this.settings.quality==='low'?25:this.mode==='world'?48:42;this.scene.fog.far=this.settings.quality==='low'?58:110;
  if(this.menu){const x=7,z=-5;this.target.lerp(new T.Vector3(x,3.8,z),1-Math.exp(-dt*3));const a=.65+Math.sin(this.elapsed*.025)*.08;this.camera.position.set(x+Math.sin(a)*43,31,z+Math.cos(a)*43);}
  else{this.target.lerp(new T.Vector3(p.x,this.y(p.x,p.z)+.7,p.z),1-Math.exp(-dt*9));this.camera.position.set(this.target.x+Math.sin(this.yaw)*this.distance,this.target.y+this.distance*.83,this.target.z+Math.cos(this.yaw)*this.distance);}
  this.shake=Math.max(0,this.shake-dt);if(this.shake>0){this.camera.position.x+=Math.sin(this.elapsed*101)*this.shake*.7;this.camera.position.z+=Math.cos(this.elapsed*81)*this.shake*.5;}
  this.camera.lookAt(this.target);this.camera.updateMatrixWorld();this.waterMat.uniforms.eye.value.copy(this.camera.position);this.sun.position.set(p.x-26,this.y(p.x,p.z)+58,p.z+21);this.sun.target.position.set(p.x,this.y(p.x,p.z),p.z);this.sun.target.updateMatrixWorld();
 }
 render(){const start=performance.now();this.renderer.render(this.scene,this.camera);const info=this.renderer.info;this.metrics.drawCalls=info.render.calls;this.metrics.triangles=info.render.triangles;this.metrics.geometries=info.memory.geometries;this.metrics.textures=info.memory.textures;this.metrics.chunks=this.chunks.size;this.metrics.frameMs=performance.now()-start;}
 project(x,z,y=1.5){const v=new T.Vector3(x,this.y(x,z)+y,z).project(this.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,visible:v.z<1&&v.z>-1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1};}
 aim(clientX,clientY){this.mouse.set(clientX/innerWidth*2-1,-clientY/innerHeight*2+1);this.raycaster.setFromCamera(this.mouse,this.camera);this.groundPlane.set(new T.Vector3(0,1,0),-this.y(this.sim.p.x,this.sim.p.z)-.7);const point=new T.Vector3();if(this.raycaster.ray.intersectPlane(this.groundPlane,point)){const dx=point.x-this.sim.p.x,dz=point.z-this.sim.p.z;return {x:dx,z:dz,distance:Math.hypot(dx,dz)};}return {x:this.sim.p.faceX,z:this.sim.p.faceZ,distance:10};}
 dispose(){this.kit.release(this.env);this.kit.release(this.actors);this.kit.release(this.effects);this.kit.dispose();this.grassMaterial?.dispose();this.waterMat.dispose();this.water.geometry.dispose();this.pollen.geometry.dispose();this.pollen.material.dispose();this.renderer.dispose();}
}
