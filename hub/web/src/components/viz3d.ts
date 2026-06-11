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
  skills: '#ffae6b', timeline: '#7fb0d0', decisions: '#ff8bd0', ghost: '#46566a',
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

// ════════ DẢI NGÂN HÀ PROCEDURAL — generator tham số hóa (1 galaxy bây giờ, N galaxy = vũ trụ sau) ════════
// Triết lý: vault ÍT note vẫn phải nhìn như Milky Way thật → cấu trúc xoắn ốc đến từ BỤI SAO procedural
// (deterministic theo seed), còn note THẬT = hành tinh sáng NEO trên cánh tay. Storage = tài nguyên trong vũ trụ.

export type GalaxyOpts = {
  seed: number
  arms: number       // số cánh tay xoắn ốc
  rIn: number        // bán kính lõi (bulge)
  rOut: number       // bán kính rìa
  windings: number   // độ xoắn (vòng quanh tâm của 1 cánh tay, đơn vị vòng)
  thickness: number  // bề dày đĩa
}
export const GALAXY_DEFAULT: GalaxyOpts = { seed: 7, arms: 4, rIn: 16, rOut: 130, windings: 0.52, thickness: 5 }

// PRNG deterministic (mulberry32) — cùng seed = cùng dải ngân hà, không nhảy giữa các lần load.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (rng: () => number) => (rng() + rng() + rng() - 1.5) / 1.5 // ~chuẩn, [-1,1]

// điểm trên cánh tay: arm ∈ [0,arms), t ∈ [0,1] dọc cánh tay → vị trí thế giới (đĩa nằm trên mặt XZ)
function armPoint(arm: number, t: number, o: GalaxyOpts, jr: number, ja: number, jy: number): THREE.Vector3 {
  const angle = (arm / o.arms) * Math.PI * 2 + t * o.windings * Math.PI * 2 + ja
  const r = o.rIn + (o.rOut - o.rIn) * Math.pow(t, 0.85) + jr
  return new THREE.Vector3(Math.cos(angle) * r, jy, Math.sin(angle) * r)
}

// màu cánh tay (lặp vòng) — cyan chủ đạo + lạnh/ấm xen kẽ cho có nhịp
const ARM_PALETTE = ['#3fd3ff', '#7fb0d0', '#b48bff', '#5fe39a']

// BỤI SAO dải ngân hà: 3 lớp Points (bụi mịn + sparks sáng + bulge ấm) — ~10k hạt, GPU lo, rẻ.
export function makeGalaxyDust(group: THREE.Group, o: GalaxyOpts = GALAXY_DEFAULT): THREE.Points[] {
  const rng = mulberry32(o.seed)
  const layer = (count: number, size: number, opacity: number, bulge: boolean) => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const c = new THREE.Color(); const warm = new THREE.Color('#ffd9a0')
    for (let i = 0; i < count; i++) {
      let p: THREE.Vector3
      if (bulge) { // lõi phình: cầu gauss ấm quanh tâm
        p = new THREE.Vector3(gauss(rng) * o.rIn * 0.9, gauss(rng) * o.rIn * 0.45, gauss(rng) * o.rIn * 0.9)
        c.copy(warm).multiplyScalar(0.5 + rng() * 0.5)
      } else {
        const arm = Math.floor(rng() * o.arms)
        const t = Math.pow(rng(), 0.72) // dồn hạt về phía trong (mật độ thật của ngân hà)
        const spread = 2.2 + t * 8
        p = armPoint(arm, t, o, gauss(rng) * spread, gauss(rng) * 0.1, gauss(rng) * o.thickness * (1 - t * 0.45))
        c.set(ARM_PALETTE[arm % ARM_PALETTE.length])
        if (t < 0.3) c.lerp(warm, 1 - t / 0.3) // gần tâm → ấm dần (như ảnh thiên văn thật)
        c.multiplyScalar((0.35 + rng() * 0.65) * (1 - t * 0.35)) // rìa mờ dần
      }
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size, transparent: true, opacity, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    group.add(pts)
    return pts
  }
  return [
    layer(7000, 0.85, 0.55, false), // bụi mịn — vẽ nên hình xoắn ốc
    layer(1600, 1.8, 0.8, false),   // sao sáng rải rác
    layer(1600, 1.15, 0.7, true),   // bulge lõi ấm
  ]
}

// texture glow mềm (canvas radial) — dùng cho nebula + quầng lõi. Cache 1 lần.
let _glowTex: THREE.Texture | null = null
export function glowTexture(): THREE.Texture {
  if (_glowTex) return _glowTex
  const cv = document.createElement('canvas'); cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
  _glowTex = new THREE.CanvasTexture(cv)
  return _glowTex
}

// mây nebula: vài sprite glow to, mờ, tint theo màu cánh tay — cho tinh hà "có khí", hết khô.
export function makeNebulae(group: THREE.Group, o: GalaxyOpts = GALAXY_DEFAULT, count = 7): THREE.Sprite[] {
  const rng = mulberry32(o.seed + 99)
  const out: THREE.Sprite[] = []
  for (let i = 0; i < count; i++) {
    const arm = Math.floor(rng() * o.arms)
    const t = 0.2 + rng() * 0.6
    const p = armPoint(arm, t, o, gauss(rng) * 6, gauss(rng) * 0.08, gauss(rng) * 2)
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(ARM_PALETTE[arm % ARM_PALETTE.length]), transparent: true, opacity: 0.05 + rng() * 0.05, depthWrite: false, blending: THREE.AdditiveBlending })
    const sp = new THREE.Sprite(mat)
    sp.position.copy(p); sp.scale.setScalar(34 + rng() * 55)
    group.add(sp); out.push(sp)
  }
  return out
}

// NEO 1 note thật lên cánh tay: zone → cánh tay cố định, hash(id) → vị trí dọc cánh tay.
// Deterministic → hành tinh KHÔNG đổi chỗ giữa các lần load; note mới chen vào đúng "địa chỉ vũ trụ" của nó.
export function armAnchor(zone: string, id: string, o: GalaxyOpts = GALAXY_DEFAULT): THREE.Vector3 {
  const arm = Math.floor(hash01('zone:' + zone) * o.arms)
  const t = 0.18 + hash01(id) * 0.74
  const jr = (hash01(id + ':r') - 0.5) * 7
  const ja = (hash01(id + ':a') - 0.5) * 0.14
  const jy = (hash01(id + ':y') - 0.5) * (o.thickness * 0.9)
  return armPoint(arm, t, o, jr, ja, jy)
}

// màu node LIVE (telemetry — đồng bộ palette BrainViz để 2 thế giới khớp ngôn ngữ màu)
export const LIVE_COLOR: Record<string, string> = {
  core: '#bff8ff', zone: '#9fe9ff', model: '#36d4d0', voice: '#41e3b0', channel: '#46c6ec', api: '#62e89a',
}
