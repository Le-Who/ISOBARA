import type {Vec} from './types.js';
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.z-b.z);
export const dist2=(a:Vec,b:Vec)=>(a.x-b.x)**2+(a.z-b.z)**2;
export const norm=(x:number,z:number):Vec=>{const d=Math.hypot(x,z);return d>1e-8?{x:x/d,z:z/d}:{x:0,z:0};};
export function hash(...values:(number|string)[]):number {
 let h=2166136261;for(const value of values){const s=String(value);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=124;h=Math.imul(h,16777619);}return h>>>0;
}
export class RNG {
 state:number; constructor(seed:number){this.state=seed>>>0;}
 next(){let t=this.state=(this.state+0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
 int(a:number,b:number){return a+Math.floor(this.next()*(b-a+1));}
 range(a:number,b:number){return lerp(a,b,this.next());}
 pick<T>(v:readonly T[]):T { if(!v.length)throw new Error('Empty RNG selection');return v[this.int(0,v.length-1)]; }
 shuffle<T>(v:readonly T[]):T[]{const a=[...v];for(let i=a.length-1;i>0;i--){const j=this.int(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
 weighted<T>(items:readonly T[],weights:readonly number[]):T {if(items.length!==weights.length||!items.length||weights.some(x=>!Number.isFinite(x)||x<0))throw new Error('Invalid weights');const sum=weights.reduce((a,b)=>a+b,0);if(sum<=0)throw new Error('Zero weight');let r=this.next()*sum;for(let i=0;i<items.length;i++){r-=weights[i];if(r<0)return items[i];}return items[items.length-1];}
}
function fade(t:number){return t*t*(3-2*t);}
export function noise(x:number,z:number,seed:number){const ix=Math.floor(x),iz=Math.floor(z),u=fade(x-ix),v=fade(z-iz);const n=(a:number,b:number)=>hash(seed,a,b)/4294967295*2-1;return lerp(lerp(n(ix,iz),n(ix+1,iz),u),lerp(n(ix,iz+1),n(ix+1,iz+1),u),v);}
export function segmentDistance(p:Vec,a:Vec,b:Vec){const x=b.x-a.x,z=b.z-a.z;const t=clamp(((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z||1),0,1);return Math.hypot(p.x-(a.x+x*t),p.z-(a.z+z*t));}
export const roman=(n:number)=>['','I','II','III','IV','V'][n]??String(n);
export const unique=<T>(a:T[])=>[...new Set(a)];
