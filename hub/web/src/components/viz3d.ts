// viz3d.ts — tiện ích three.js dùng cho Galaxy (tinh hà tri thức). Shader energy-orb/plasma + starfield +
// force-layout 3D nhẹ (tự viết, node ít → khỏi thêm lib). Tách riêng để KHÔNG đụng BrainViz đang chạy.
import * as THREE from 'three'

// ── GLSL: simplex noise 3D (Ashima) + fbm — cùng kỹ thuật BrainViz cho glow volumetric ──
const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`
const FBM = `float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*snoise(p); p*=2.02; a*=0.5; } return s; }`

export const ORB_VERT = `
varying vec3 vN; varying vec3 vView; varying vec3 vPos;
void main(){
  vN = normalize(normalMatrix*normal);
  vec4 mv = modelViewMatrix*vec4(position,1.0);
  vView = normalize(-mv.xyz); vPos = position;
  gl_Position = projectionMatrix*mv;
}`

// hành tinh tri thức: lõi sáng + rìa mờ + noise cuộn. uBright = độ tin/độ-mới, uActive = đang được recall.
export const PLANET_FRAG = SNOISE + FBM + `
uniform vec3 uColor; uniform float uTime; uniform float uActive; uniform float uBright; uniform float uSeed;
varying vec3 vN; varying vec3 vView; varying vec3 vPos;
void main(){
  vec3 d = normalize(vPos);
  float ndv = max(dot(normalize(vN), normalize(vView)), 0.0);
  float n = fbm(d*3.0 + vec3(0.0,uTime*0.35,0.0))*0.6 + fbm(d*7.0 - vec3(uTime*0.3))*0.4;
  n = n*0.5+0.5;
  float core = pow(ndv, 1.3);
  float rim  = pow(1.0-ndv, 2.2);
  float energy = 0.08 + core*(0.35 + 0.8*n) + rim*0.55;
  float pulse = 0.82 + 0.18*sin(uTime*2.0 + uSeed*6.2831);
  energy *= (0.45 + uBright*0.75 + uActive*1.1) * pulse;
  vec3 col = uColor * energy;
  col += vec3(1.0) * pow(n,3.0) * 0.22 * (core+0.2);
  col += uColor * uActive * rim * 0.9;            // recall → rìa bừng sáng
  gl_FragColor = vec4(col, clamp(energy,0.0,1.0));
}`

// lõi tinh hà (hành tinh trung tâm — node nhiều liên kết nhất): plasma cuộn, sáng sâu.
export const CORE_FRAG = SNOISE + FBM + `
uniform vec3 uColor; uniform float uTime;
varying vec3 vN; varying vec3 vView; varying vec3 vPos;
void main(){
  vec3 d = normalize(vPos); vec3 q = d*2.2;
  vec3 w = vec3(fbm(q+vec3(0.0,uTime*0.28,0.0)), fbm(q+vec3(5.2,uTime*0.22,1.3)), fbm(q+vec3(1.7,uTime*0.25,8.3)));
  float n = fbm(q*1.5 + w*1.9 + vec3(0.0,uTime*0.32,0.0)); n=n*0.5+0.5;
  float fil = fbm(d*6.0 + w*2.2 - vec3(uTime*0.45));
  float ndv = max(dot(normalize(vN), normalize(vView)),0.0);
  float rim = pow(1.0-ndv,2.0);
  vec3 col = mix(uColor*0.3, uColor, smoothstep(0.22,0.82,n));
  col += uColor*smoothstep(0.62,0.95,fil)*0.7;
  col += vec3(0.8,0.95,1.0)*rim*0.8;
  col *= (0.42+0.58*n);
  gl_FragColor = vec4(col, clamp(0.5+n*0.42+rim*0.5,0.0,1.0));
}`

// màu theo zone (chòm sao) — gold = lõi/người, cyan = dự án, lục = đã học, tím = entity…
export const ZONE_COLOR: Record<string, string> = {
  context: '#ffd27f', projects: '#3fd3ff', learned: '#5fe39a', entities: '#b48bff',
  skills: '#ffae6b', timeline: '#7fb0d0', decisions: '#ff8bd0', memory: '#5fd9c9', ghost: '#46566a',
}
export const zoneCol = (z: string) => new THREE.Color(ZONE_COLOR[z] || '#7fb0d0')

export function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000000) / 1000000
}

// nền sao bay (parallax) — như BrainViz, làm tinh hà có chiều sâu.
export function makeStars(scene: THREE.Scene, n: number, spread: number, size: number, op: number, color: number): THREE.Points {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) a[i] = (Math.random() - 0.5) * spread
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3))
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: op, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  scene.add(pts); return pts
}

// ── FORCE-LAYOUT 3D nhẹ: charge repulsion + link spring + center gravity + disk-flatten (Y) ──
// Giữ vị trí cũ (prev) cho node đã có → tinh hà NỞ mượt, không nhảy loạn khi thêm node.
export type FNode = { id: string; mass: number }
export type FLink = { source: string; target: string; weight: number }
export function forceLayout3D(nodes: FNode[], links: FLink[], prev: Map<string, THREE.Vector3>, iters = 220): Map<string, THREE.Vector3> {
  const pos = new Map<string, THREE.Vector3>()
  const idx = new Map<string, number>()
  nodes.forEach((n, i) => {
    idx.set(n.id, i)
    const p = prev.get(n.id)
    // node mới: gieo trên đĩa quanh tâm (góc theo hash → ổn định giữa các lần)
    if (p) pos.set(n.id, p.clone())
    else { const a = hash01(n.id) * Math.PI * 2, r = 20 + hash01(n.id + 'r') * 40; pos.set(n.id, new THREE.Vector3(Math.cos(a) * r, (hash01(n.id + 'y') - 0.5) * 12, Math.sin(a) * r)) }
  })
  const arr = nodes.map((n) => pos.get(n.id)!)
  const vel = arr.map(() => new THREE.Vector3())
  const adj = links.map((l) => ({ a: idx.get(l.source), b: idx.get(l.target), w: l.weight })).filter((e) => e.a !== undefined && e.b !== undefined) as { a: number; b: number; w: number }[]
  const K_REP = 2600, K_LINK = 0.045, REST = 26, CENTER = 0.012, FLATTEN = 0.82, DAMP = 0.86
  const tmp = new THREE.Vector3()
  for (let it = 0; it < iters; it++) {
    // repulsion (O(n²) — node ít nên ổn)
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      tmp.copy(arr[i]).sub(arr[j]); let d2 = tmp.lengthSq(); if (d2 < 1) d2 = 1
      const f = (K_REP * (nodes[i].mass / 14) * (nodes[j].mass / 14)) / d2
      tmp.multiplyScalar(f / Math.sqrt(d2)); vel[i].add(tmp); vel[j].sub(tmp)
    }
    // link spring (kéo node nối nhau lại — cụm theo cấu trúc THẬT)
    for (const e of adj) {
      tmp.copy(arr[e.b]).sub(arr[e.a]); const d = tmp.length() || 1
      tmp.multiplyScalar((K_LINK * (0.5 + e.w) * (d - REST)) / d)
      vel[e.a].add(tmp); vel[e.b].sub(tmp)
    }
    for (let i = 0; i < arr.length; i++) {
      vel[i].x -= arr[i].x * CENTER; vel[i].z -= arr[i].z * CENTER; vel[i].y -= arr[i].y * CENTER * 2.5 // hút về đĩa
      vel[i].multiplyScalar(DAMP)
      arr[i].add(tmp.copy(vel[i]).clampLength(0, 6))
      arr[i].y *= FLATTEN // ép dẹt thành đĩa tinh hà
    }
  }
  return pos
}
