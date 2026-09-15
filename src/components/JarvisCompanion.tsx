import { useEffect, useRef } from "react";
import type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";
export type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";

type Props = { state: AvatarState; mood: AvatarMood; level: number; onAsk?: (question: string) => void };
type Action = "idle" | "walk" | "sit" | "spin" | "jump" | "flip" | "wave";

type Vec3 = [number, number, number];

type Part = { pos: Vec3; rot: Vec3; scale: Vec3; color: [number, number, number] };

const clamp = (v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));

function mul(a:number[],b:number[]){const r=new Array<number>(16).fill(0);for(let c=0;c<4;c++)for(let rr=0;rr<4;rr++)for(let k=0;k<4;k++)r[c*4+rr]+=a[k*4+rr]*b[c*4+k];return r;}
function ident(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function tr(x:number,y:number,z:number){const m=ident();m[12]=x;m[13]=y;m[14]=z;return m;}
function sc(x:number,y:number,z:number){const m=ident();m[0]=x;m[5]=y;m[10]=z;return m;}
function rx(a:number){const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];}
function ry(a:number){const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];}
function rz(a:number){const c=Math.cos(a),s=Math.sin(a);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];}
function compose(p:Vec3,r:Vec3,s:Vec3){return mul(mul(mul(tr(...p),rz(r[2])),ry(r[1])),mul(rx(r[0]),sc(...s)));}
function perspective(fov:number,aspect:number,near:number,far:number){const f=1/Math.tan(fov/2),nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,(2*far*near)*nf,0];}
function lookAt(eye:Vec3,center:Vec3,up:Vec3){const z=norm([eye[0]-center[0],eye[1]-center[1],eye[2]-center[2]]),x=norm(cross(up,z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function cross(a:Vec3,b:Vec3):Vec3{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a:Vec3,b:Vec3){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function norm(a:Vec3){const d=Math.hypot(...a)||1;return [a[0]/d,a[1]/d,a[2]/d] as Vec3;}

const cubeVerts=new Float32Array([
-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1
]);
const cubeIdx=new Uint16Array([0,1,2,2,3,0,1,5,6,6,2,1,5,4,7,7,6,5,4,0,3,3,7,4,3,2,6,6,7,3,4,5,1,1,0,4]);

function addPart(parts:Part[],pos:Vec3,rot:Vec3,scale:Vec3,color:[number,number,number]){parts.push({pos,rot,scale,color});}

function drawHumanoid(gl:WebGLRenderingContext,program:WebGLProgram,loc:any,action:Action,t:number,level:number,mood:AvatarMood){
  const parts:Part[]=[]; const cyan:[number,number,number]=[0.15,0.92,1.0], dark:[number,number,number]=[0.035,0.07,0.13], white:[number,number,number]=[0.86,0.94,1.0], skin:[number,number,number]=[0.98,0.78,0.76], gold:[number,number,number]=[1.0,0.68,0.25];
  const w=Math.sin(t*7), q=Math.sin(t*7+Math.PI);
  addPart(parts,[0,2.65,0],[0,0,0],[0.72,1.05,0.42],dark);
  addPart(parts,[0,2.65,0.46],[0,0,0],[0.42,0.55,0.09],cyan);
  addPart(parts,[0,3.95,0],[0,0,0],[0.64,0.62,0.62],skin);
  addPart(parts,[-0.25,4.02,-0.55],[0,0,0],[0.11,0.16,0.06],cyan);
  addPart(parts,[0.25,4.02,-0.55],[0,0,0],[0.11,0.16,0.06],cyan);
  addPart(parts,[0,3.72,-0.58],[0,0,0],[0.16,0.055,0.04],dark);
  for(let i=-2;i<=2;i++) addPart(parts,[i*.23,4.15,0],[0,0,0],[0.23,0.72,0.26],white);
  addPart(parts,[-0.78,2.7,0],[0,0,0.08],[0.18,0.62,0.18],white); addPart(parts,[0.78,2.7,0],[0,0,-0.08],[0.18,0.62,0.18],white);
  addPart(parts,[-0.78,2.02,0],[0,0,0],[0.15,0.58,0.15],dark); addPart(parts,[0.78,2.02,0],[0,0,0],[0.15,0.58,0.15],dark);
  addPart(parts,[-0.32,1.45,0],[0,0,0],[0.22,0.7,0.22],white); addPart(parts,[0.32,1.45,0],[0,0,0],[0.22,0.7,0.22],white);
  addPart(parts,[-0.32,0.72,0],[0,0,0],[0.17,0.72,0.17],dark); addPart(parts,[0.32,0.72,0],[0,0,0],[0.17,0.72,0.17],dark);
  addPart(parts,[-0.32,0.02,-0.12],[0,0,0],[0.28,0.13,0.5],white); addPart(parts,[0.32,0.02,-0.12],[0,0,0],[0.28,0.13,0.5],white);

  if(action==='walk'){parts.forEach((p,i)=>{if(i===9)p.rot[0]=w*.7;if(i===10)p.rot[0]=q*.7;if(i===11)p.rot[0]=Math.max(0,-w)*.55;if(i===12)p.rot[0]=Math.max(0,-q)*.55;if(i===7)p.rot[0]=q*.5;if(i===8)p.rot[0]=w*.5;p.pos[1]+=Math.abs(w)*.06;});}
  if(action==='wave'){parts[7].rot[0]=-.35;parts[7].rot[2]=-.95;parts[8].rot[0]=-.25;parts[8].rot[2]=Math.sin(t*10)*.35-.75;}
  if(action==='sit'){for(const p of parts){if(p.pos[1]<1.3)p.pos[1]-=.6;p.rot[0]+=.2;}parts[9].rot[0]=-1.15;parts[10].rot[0]=-1.15;parts[11].rot[0]=1.2;parts[12].rot[0]=1.2;}
  if(action==='jump'){const y=Math.sin((t%1.2)/1.2*Math.PI)*1.1;parts.forEach(p=>p.pos[1]+=y);}
  if(action==='spin')parts.forEach(p=>p.rot[1]+=t*3.5);
  if(action==='flip')parts.forEach(p=>p.rot[0]+=t*6.2);
  if(mood==='sleep'&&action==='sit'){parts[2].rot[2]=.12;parts[2].rot[0]=.18;}
  parts[4].scale[1]*=1+level*.15; parts[5].scale[1]*=1+level*.15;

  const view=lookAt([0,2.4,10],[0,2.3,0],[0,1,0]); const proj=perspective(Math.PI/4,gl.canvas.width/gl.canvas.height,.1,100);
  for(const p of parts){let model=compose(p.pos,p.rot,p.scale);let mvp=mul(proj,mul(view,model));gl.uniformMatrix4fv(loc.uMvp,false,new Float32Array(mvp));gl.uniform3fv(loc.uColor,new Float32Array(p.color));gl.drawElements(gl.TRIANGLES,cubeIdx.length,gl.UNSIGNED_SHORT,0);}
}

export function JarvisCompanion({state,mood,level}:Props){
  const ref=useRef<HTMLCanvasElement|null>(null); const props=useRef({state,mood,level});
  useEffect(()=>{props.current={state,mood,level}},[state,mood,level]);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas)return;
    const gl=canvas.getContext("webgl",{antialias:true,alpha:true}); if(!gl)return;
    const vs=`attribute vec3 aPosition;uniform mat4 uMvp;void main(){gl_Position=uMvp*vec4(aPosition,1.0);}`;
    const fs=`precision mediump float;uniform vec3 uColor;void main(){float l=.65+.35*max(0.0,gl_FragCoord.y/1000.0);gl_FragColor=vec4(uColor*l,1.0);}`;
    const compile=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||"shader");return s;};
    const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;gl.useProgram(program);
    const vb=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,cubeVerts,gl.STATIC_DRAW);const ib=gl.createBuffer()!;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,cubeIdx,gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,"aPosition");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);const loc={uMvp:gl.getUniformLocation(program,"uMvp"),uColor:gl.getUniformLocation(program,"uColor")};gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
    let raf=0,start=performance.now()/1000,next=start+2.5,x=0,z=0,tx=0,tz=0,action:Action="idle",begin=start;
    const choose=(now:number)=>{const p=props.current;if(p.state!=="idle"){action="idle";begin=now;next=now+1;return;}const pool:Action[]=p.mood==="play"?["walk","walk","jump","spin","flip","wave"]:p.mood==="bored"?["walk","sit","wave","idle"]:p.mood==="sleep"?["sit","sit","idle"]:["walk","walk","wave","spin","idle"];action=pool[Math.floor(Math.random()*pool.length)]||"idle";begin=now;next=now+(action==="walk"?4+Math.random()*3:1.5+Math.random()*2);if(action==="walk"){tx=(Math.random()-.5)*6;tz=(Math.random()-.5)*2;}};
    const resize=()=>{const d=Math.min(devicePixelRatio,2),w=Math.max(1,Math.floor(innerWidth*d)),h=Math.max(1,Math.floor(innerHeight*d));canvas.width=w;canvas.height=h;canvas.style.width="100vw";canvas.style.height="100vh";gl.viewport(0,0,w,h);}; resize();addEventListener("resize",resize);
    const move=(e:PointerEvent)=>{const nx=e.clientX/innerWidth*2-1;const ny=e.clientY/innerHeight*2-1;tx=x-nx*.25;tz=z+ny*.15;};addEventListener("pointermove",move,{passive:true});choose(start);
    const loop=()=>{const now=performance.now()/1000;if(now>=next)choose(now);if(action==="walk"){const dx=tx-x,dz=tz-z,d=Math.hypot(dx,dz);if(d>.08){x+=(dx/d)*.018;z+=(dz/d)*.018;}}x=clamp(x,-3.3,3.3);z=clamp(z,-1.5,1.5);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);const p=props.current;drawHumanoid(gl,program,loc,action,now-begin,p.level,p.mood);raf=requestAnimationFrame(loop);};loop();
    return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("pointermove",move);gl.deleteBuffer(vb);gl.deleteBuffer(ib);gl.deleteProgram(program);};
  },[]);
  return <canvas ref={ref} className="jarvis-3d-layer" aria-label="Skutečný 3D Jarvis"/>;
}
