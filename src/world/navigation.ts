import type {Vec,Layout,Room,NavGrid} from '../core/types.js';
import {clamp} from '../core/math.js';
export function inRoom(room:Room,x:number,z:number,margin=0){
 const dx=Math.abs(x-room.x),dz=Math.abs(z-room.z),hw=room.w/2-margin,hd=room.d/2-margin;
 if(dx>hw||dz>hd)return false;
 if(room.shape==='octagon')return dx+dz<Math.min(hw,hd)*1.66;
 if(room.shape==='cross')return dx<5.5-margin||dz<5.5-margin;
 return true;
}
export function onFloor(l:Layout,x:number,z:number){
 for(const room of l.rooms)if(inRoom(room,x,z))return true;
 for(const c of l.corridors)if(Math.abs(x-c.x)<=c.w/2&&Math.abs(z-c.z)<=c.d/2)return true;
 return false;
}
export function canWalk(l:Layout,x:number,z:number,r=.46){
 if(!onFloor(l,x,z))return false;
 const k=.707106781;
 for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r],[r*k,r*k],[-r*k,r*k],[r*k,-r*k],[-r*k,-r*k]])if(!onFloor(l,x+dx,z+dz))return false;
 for(const room of l.rooms){if(Math.abs(x-room.x)>room.w/2+2||Math.abs(z-room.z)>room.d/2+2)continue;for(const o of room.obstacles)if(Math.hypot(x-o.x,z-o.z)<o.r+r)return false;}
 return true;
}
export function buildNav(l:Layout,cell=1):NavGrid {
 const minX=Math.min(...l.rooms.map(r=>r.x-r.w/2))-3,minZ=Math.min(...l.rooms.map(r=>r.z-r.d/2))-3;
 const maxX=Math.max(...l.rooms.map(r=>r.x+r.w/2))+3,maxZ=Math.max(...l.rooms.map(r=>r.z+r.d/2))+3;
 const x0=Math.floor(minX),z0=Math.floor(minZ),w=Math.ceil((maxX-x0)/cell)+1,h=Math.ceil((maxZ-z0)/cell)+1;
 if(w*h>350000)throw new Error('Navigation grid exceeds finite budget');
 const walk=new Uint8Array(w*h);let count=0;
 for(let iz=0;iz<h;iz++)for(let ix=0;ix<w;ix++)if(canWalk(l,x0+ix*cell,z0+iz*cell,.55)){walk[iz*w+ix]=1;count++;}
 return {x0,z0,w,h,cell,walk,count};
}
export function navIndex(nav:NavGrid,p:Vec){const x=Math.round((p.x-nav.x0)/nav.cell),z=Math.round((p.z-nav.z0)/nav.cell);return x>=0&&z>=0&&x<nav.w&&z<nav.h?z*nav.w+x:-1;}
export function navPoint(n:NavGrid,i:number):Vec{return {x:n.x0+(i%n.w)*n.cell,z:n.z0+Math.floor(i/n.w)*n.cell};}
export function nearestIndex(n:NavGrid,p:Vec){const direct=navIndex(n,p);if(direct>=0&&n.walk[direct])return direct;const cx=Math.round((p.x-n.x0)/n.cell),cz=Math.round((p.z-n.z0)/n.cell);for(let r=1;r<=8;r++)for(let z=cz-r;z<=cz+r;z++)for(let x=cx-r;x<=cx+r;x++){if(x<0||z<0||x>=n.w||z>=n.h)continue;const i=z*n.w+x;if(n.walk[i])return i;}return -1;}
export function flowField(n:NavGrid,target:Vec){
 const costs=new Int32Array(n.w*n.h);costs.fill(-1);const start=nearestIndex(n,target);if(start<0)return costs;
 const q=new Int32Array(n.w*n.h);let a=0,b=0;q[b++]=start;costs[start]=0;
 while(a<b){const i=q[a++],x=i%n.w,z=Math.floor(i/n.w);for(const j of [x>0?i-1:-1,x<n.w-1?i+1:-1,z>0?i-n.w:-1,z<n.h-1?i+n.w:-1]){if(j>=0&&n.walk[j]&&costs[j]<0){costs[j]=costs[i]+1;q[b++]=j;}}}
 return costs;
}
export function nextOnFlow(n:NavGrid,flow:Int32Array,p:Vec,target:Vec):Vec {
 const i=nearestIndex(n,p);if(i<0||flow[i]<0)return p;if(flow[i]===0)return target;
 const x=i%n.w,z=Math.floor(i/n.w);let best=i;
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=n.w||nz>=n.h)continue;const j=nz*n.w+nx;if(!n.walk[j]||flow[j]<0)continue;if(dx&&dz&&(!n.walk[z*n.w+nx]||!n.walk[nz*n.w+x]))continue;if(flow[j]<flow[best])best=j;}
 return navPoint(n,best);
}
export function pathTo(n:NavGrid,from:Vec,to:Vec,max=3000):Vec[]{const flow=flowField(n,to);let i=nearestIndex(n,from);if(i<0||flow[i]<0)return [];const points:Vec[]=[];for(let step=0;step<max&&flow[i]>0;step++){const p=nextOnFlow(n,flow,navPoint(n,i),to),j=navIndex(n,p);if(j===i||j<0)break;points.push(p);i=j;}return points;}
export function move(pos:Vec,dx:number,dz:number,valid:(x:number,z:number)=>boolean){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22)),sx=dx/steps,sz=dz/steps;
 for(let i=0;i<steps;i++){if(valid(pos.x+sx,pos.z+sz)){pos.x+=sx;pos.z+=sz;}else{if(valid(pos.x+sx,pos.z))pos.x+=sx;if(valid(pos.x,pos.z+sz))pos.z+=sz;}}
}
export function lineClear(l:Layout,a:Vec,b:Vec,rad=.12){const d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(d/.45));for(let i=1;i<=n;i++){const t=i/n;if(!canWalk(l,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,rad))return false;}return true;}
