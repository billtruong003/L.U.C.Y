import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import SpriteText from 'three-spritetext'

// ---- palette + layout ----
// tông Iron Man: cyan ngả xanh lá
const COLORS: Record<string, string> = {
  core: '#bff8ff', zone: '#9fe9ff', model: '#36d4d0', voice: '#41e3b0', channel: '#46c6ec', api: '#62e89a',
}
const col3 = (g: string) => new THREE.Color(COLORS[g] || '#7fb0d0')
const RING = 78
// pseudo-random ổn định theo chuỗi (FNV) -> [0,1)
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000000) / 1000000
}

type GNode = { id: string; label: string; group: string; val: number; active?: boolean; load?: number; zone?: string; status?: string }
type GLink = { source: string; target: string; active?: boolean; flow?: number }
type Tele = { nodes: GNode[]; links: GLink[]; running: { model: string; prompt: string; elapsed: number }[] }

// ---- GLSL: simplex noise 3D (Ashima) ----
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

const FBM = `
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*snoise(p); p*=2.02; a*=0.5; } return s; }`
const ORB_VERT = `
varying vec3 vN; varying vec3 vView; varying vec3 vPos;
void main(){
  vN = normalize(normalMatrix*normal);
  vec4 mv = modelViewMatrix*vec4(position,1.0);
  vView = normalize(-mv.xyz); vPos = position;
  gl_Position = projectionMatrix*mv;
}`
const ORB_FRAG = SNOISE + FBM + `
uniform vec3 uColor; uniform float uTime; uniform float uActive; uniform float uCore;
varying vec3 vN; varying vec3 vView; varying vec3 vPos;
void main(){
  vec3 d = normalize(vPos);                                  // mẫu noise trên mặt cầu -> đều theo bán kính
  float n  = fbm(d*3.2 + vec3(0.0,uTime*0.45,0.0));
  float n2 = fbm(d*8.0 - vec3(uTime*0.35,0.0,uTime*0.2));
  float e = (n*0.6 + n2*0.4)*0.5 + 0.5;
  float fres = pow(1.0-max(dot(vN,vView),0.0), 2.0);
  float pulse = 0.5+0.5*sin(uTime*2.2);
  vec3 col = uColor*(0.12 + 0.95*e);                         // tương phản rõ -> thấy vân plasma
  col += uColor*fres*(1.2 + uActive*1.6);
  col += vec3(1.0)*fres*0.15;
  col += smoothstep(0.74,0.96,n2)*0.7;                       // đốm sáng lấp lánh
  float lum = 0.55 + uActive*(0.35+0.3*pulse);
  gl_FragColor = vec4(col*lum, 1.0);
}`
const GLOW_FRAG = `
uniform vec3 uColor; uniform float uActive; uniform float uTime;
varying vec3 vN; varying vec3 vView; varying vec3 vPos;
void main(){
  float fres = pow(1.0-max(dot(vN,vView),0.0), 6.0);   // NÉT: rim mỏng sắc
  float pulse = 0.5+0.5*sin(uTime*2.2);
  float a = fres*(0.4 + uActive*(0.3+0.25*pulse));
  gl_FragColor = vec4(uColor*1.15, a);
}`
// năng lượng volumetric: sáng giữa mờ rìa (cảm giác khối) + noise cuộn, additive
const ENERGY_FRAG = SNOISE + FBM + `
uniform vec3 uColor; uniform float uTime; uniform float uActive; uniform float uBoost; uniform float uSeed;
varying vec3 vN; varying vec3 vView; varying vec3 vPos;
void main(){
  vec3 d = normalize(vPos);
  float ndv = max(dot(normalize(vN), normalize(vView)), 0.0);
  float n = fbm(d*3.0 + vec3(0.0,uTime*0.5,0.0))*0.6 + fbm(d*7.5 - vec3(uTime*0.4))*0.4;
  n = n*0.5+0.5;
  float core = pow(ndv, 1.2);
  float rim  = pow(1.0-ndv, 2.3);
  float energy = 0.06 + core*(0.42 + 0.85*n) + rim*0.5;     // nền vừa -> nổi nhưng không cháy
  float pulse = 0.82 + 0.18*sin(uTime*2.0 + uSeed*6.2831);  // breathing lệch pha mỗi node
  energy *= (0.92 + uBoost*0.7 + uActive*0.75) * pulse;
  vec3 col = uColor * energy;
  col += vec3(1.0) * pow(n,3.0) * 0.2 * (core+0.2);
  gl_FragColor = vec4(col, clamp(energy,0.0,1.0));
}`
const GLOW_VERT = ORB_VERT
const LINK_VERT = `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
const LINK_FRAG = `
uniform vec3 uColor; uniform float uTime; uniform float uActive; uniform float uFlow; uniform float uSeed;
varying vec2 vUv;
void main(){
  float base = 0.06;                                   // dây nổi nhẹ trên nền
  float speed = (uActive>0.5 ? 1.2 + uFlow*0.5 : 0.55);
  float amt   = (uActive>0.5 ? 1.2 : 0.45);            // idle VẪN có synapse chạy (firing nền)
  // 2 hạt synapse lệch pha cho cảm giác xung liên tục
  float p1 = fract(vUv.y*1.6 - uTime*speed - uSeed*3.1);
  float p2 = fract(vUv.y*1.6 - uTime*speed - uSeed*3.1 + 0.5);
  float bead = (smoothstep(0.0,0.10,p1)*smoothstep(0.36,0.10,p1) + 0.6*smoothstep(0.0,0.08,p2)*smoothstep(0.30,0.08,p2)) * amt;
  float a = base + bead;
  gl_FragColor = vec4(uColor*(0.45+bead), a);
}`

// ---- METAL bling (stylized: specular + highlight + rim + sweep óng ánh) ----
const METAL_VERT = `
varying vec3 vWN; varying vec3 vWP;
void main(){ vWN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`
const METAL_FRAG = SNOISE + FBM + `
uniform vec3 uBase; uniform vec3 uSpec; uniform vec3 uHigh; uniform vec3 uRim; uniform vec3 uLight; uniform float uTime; uniform float uBoost; uniform float uActive;
varying vec3 vWN; varying vec3 vWP;
void main(){
  vec3 N=normalize(vWN); vec3 V=normalize(cameraPosition-vWP); vec3 L=normalize(uLight);
  vec3 d = normalize(vWP);
  float ndv=max(dot(N,V),0.0);
  float marb = fbm(d*4.0)*0.10;
  float spec=smoothstep(0.48+marb,0.60+marb,ndv);
  vec3 H=normalize(V+L);
  float hi=smoothstep(0.85,0.93,max(dot(N,H),0.0));
  float rim=pow(1.0-ndv,2.4);
  float spark=smoothstep(0.74,0.97, fbm(d*16.0 + uTime*0.7));
  float sweep=0.5+0.5*sin(atan(d.z,d.x)*4.0 + uTime*1.5);
  vec3 col=mix(uBase,uSpec,spec);
  col+=uHigh*hi*(1.5+uBoost*0.7);
  col+=uRim*rim*0.85;
  col+=uSpec*(sweep*0.35 + spark*(1.4+uBoost*1.1));
  col*= (1.0 + uBoost*0.3 + uActive*0.5);                 // active/lõi sáng hơn
  gl_FragColor=vec4(col,1.0);
}`

export default function BrainViz({ visible }: { visible: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState<Tele['running']>([])
  const R = useRef<any>({})   // three refs giữ qua render

  // init three một lần
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x060912, 0.0016)
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000)
    camera.position.set(0, 95, 165)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.45
    controls.enablePan = false; controls.minDistance = 70; controls.maxDistance = 480

    // sao nền
    const N = 1300, pos = new Float32Array(N * 3)
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 2200
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x5f9fd0, size: 1.4, transparent: true, opacity: 0.4, sizeAttenuation: true })))
    // (không khung cầu — node tự rải trong khối không gian như cụm thiên thạch)

    R.current = { scene, camera, renderer, controls, nodes: new Map(), links: new Map(), labels: new Map(), tmats: [], topo: '', clock: new THREE.Clock() }

    // render loop
    let raf = 0
    const tmp = new THREE.Vector3(); const dir = new THREE.Vector3(); const UP = new THREE.Vector3(0, 1, 0)
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const r = R.current
      if (!r.visible) return
      const t = r.clock.getElapsedTime()
      for (const m of r.tmats) m.uniforms.uTime.value = t
      // physics bouncy: lò xo về home + trôi sin nhẹ; kéo thả -> nảy về
      if (r.home) {
        for (const [id, g] of r.nodes) {
          const pos = r.pos.get(id), home = r.home.get(id), ph = r.phase.get(id) || 0
          if (id !== r.dragId && pos && home) {
            const amp = id === r.coreId ? 1.6 : 3.6   // trôi nhẹ, tần số thấp
            tmp.set(home.x + Math.sin(t * 0.5 + ph) * amp, home.y + Math.cos(t * 0.42 + ph) * amp, home.z + Math.sin(t * 0.6 + ph) * amp)
            pos.lerp(tmp, 0.08)   // ease mượt -> hết jitter, kéo thả về cũng êm
          }
          if (pos) g.position.copy(pos)
          const lbl = r.labels.get(id); if (lbl && pos) lbl.position.set(pos.x, pos.y + (r.rad.get(id) || 6) + 6, pos.z)
        }
        for (const lr of r.linkRefs) {
          const a = r.pos.get(lr.a), b = r.pos.get(lr.b); if (!a || !b) continue
          dir.subVectors(b, a); const len = dir.length() || 0.001
          lr.mesh.position.copy(a).addScaledVector(dir, 0.5)         // xoay cylinder sẵn -> KHÔNG tạo geometry mỗi frame
          lr.mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
          lr.mesh.scale.set(1, len, 1)
        }
      }
      controls.update()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    // ---- kéo node (raycast) — dây thẳng tự nối lại ----
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2()
    let drag: { id: string; plane: THREE.Plane } | null = null
    const setNdc = (e: PointerEvent) => {
      const b = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1)
    }
    const onDown = (e: PointerEvent) => {
      const r = R.current; if (!r.visible || !r.orbPick) return
      setNdc(e); ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects(r.orbPick.map((o: any) => o.mesh), false)
      if (!hits.length) return
      const id = r.orbPick.find((o: any) => o.mesh === hits[0].object)?.id; if (!id) return
      const n = new THREE.Vector3(); camera.getWorldDirection(n)
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, r.pos.get(id).clone())
      drag = { id, plane }; r.dragId = id; r.vel.get(id)?.set(0, 0, 0)
      controls.enabled = false; r.autoSave = controls.autoRotate; controls.autoRotate = false
    }
    const onMove = (e: PointerEvent) => {
      if (!drag) return; const r = R.current
      setNdc(e); ray.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (ray.ray.intersectPlane(drag.plane, hit)) r.pos.get(drag.id)?.copy(hit)   // loop lo phần còn lại
    }
    const onUp = () => { if (drag) { R.current.dragId = null; drag = null; controls.enabled = true; controls.autoRotate = R.current.autoSave ?? true } }
    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp)
      renderer.dispose(); mount.removeChild(renderer.domElement)
    }
  }, [])

  // bật/tắt loop theo tab
  useEffect(() => { if (R.current) R.current.visible = visible }, [visible])

  // poll telemetry
  useEffect(() => {
    if (!visible) return
    let alive = true
    const pull = async () => {
      try {
        const res = await fetch('/api/telemetry'); if (!res.ok) return
        const t: Tele = await res.json(); if (!alive) return
        setRunning(t.running || []); sync(t)
      } catch { /* */ }
    }
    pull(); const iv = setInterval(pull, 1500)
    return () => { alive = false; clearInterval(iv) }
  }, [visible])

  function posOf(nodes: GNode[]): Map<string, THREE.Vector3> {
    const map = new Map<string, THREE.Vector3>()
    map.set(nodes.find((n) => n.group === 'core')?.id || 'lucy', new THREE.Vector3(0, 0, 0))
    // PHÂN VÙNG: zone toả quanh lõi, node con cụm quanh zone của nó
    const zones = nodes.filter((n) => n.group === 'zone')
    const Z = Math.max(1, zones.length); const ga = Math.PI * (3 - Math.sqrt(5))
    const zoneAnchor = new Map<string, THREE.Vector3>()
    zones.forEach((z, i) => {
      const y = 1 - (i / Math.max(1, Z - 1)) * 2, rr = Math.sqrt(Math.max(0, 1 - y * y)), phi = i * ga
      const v = new THREE.Vector3(Math.cos(phi) * rr, y, Math.sin(phi) * rr).multiplyScalar(RING * 0.55)
      zoneAnchor.set(z.id, v); map.set(z.id, v)
    })
    for (const n of nodes) {
      if (n.group === 'core' || n.group === 'zone') continue
      const anchor = (n.zone && zoneAnchor.get(n.zone)) || new THREE.Vector3()
      const u = hash01(n.id + 'x'), v = hash01(n.id + 'y'), w = hash01(n.id + 'z')
      const theta = u * Math.PI * 2, phi = Math.acos(2 * v - 1), rad = RING * 0.32 * (0.4 + 0.6 * Math.cbrt(w))
      const off = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).multiplyScalar(rad)
      map.set(n.id, anchor.clone().add(off))
    }
    return map
  }

  function sync(t: Tele) {
    const r = R.current; if (!r?.scene) return
    const topo = t.nodes.map((n) => n.id).sort().join(',') + '|' + t.links.map((l) => l.source + '>' + l.target).sort().join(',')
    const P = posOf(t.nodes)

    if (topo !== r.topo) {
      r.topo = topo
      // dọn cũ
      for (const o of r.nodes.values()) r.scene.remove(o)
      for (const o of r.links.values()) r.scene.remove(o)
      for (const o of r.labels.values()) r.scene.remove(o)
      r.nodes.clear(); r.links.clear(); r.labels.clear(); r.tmats = []
      r.pos = new Map(); r.home = new Map(); r.vel = new Map(); r.phase = new Map()
      r.orbPick = []; r.linkRefs = []; r.rad = new Map(); r.coreId = 'lucy'

      for (const n of t.nodes) {
        const isCore = n.group === 'core'
        const isZone = n.group === 'zone'
        const planned = !!n.status && n.status !== 'live'   // idea/roadmap -> mờ + wireframe
        if (isCore) r.coreId = n.id
        const c = col3(n.group); const rad = Math.cbrt(n.val || 8) * 1.7 * (isCore ? 1.7 : isZone ? 1.18 : 1) * (planned ? 0.85 : 1)
        const anchor = (P.get(n.id) || new THREE.Vector3()).clone()
        const p = isCore ? anchor.clone() : anchor.clone().multiplyScalar(0.12)   // bung ra = nảy
        r.home.set(n.id, anchor); r.pos.set(n.id, p); r.vel.set(n.id, new THREE.Vector3())
        r.phase.set(n.id, hash01(n.id) * Math.PI * 2); r.rad.set(n.id, rad)
        const g = new THREE.Group(); g.position.copy(p)

        const orbColor = planned ? c.clone().multiplyScalar(0.72) : c.clone()
        const orbMat = new THREE.ShaderMaterial({ vertexShader: ORB_VERT, fragmentShader: ENERGY_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: {
          uColor: { value: orbColor }, uTime: { value: 0 }, uActive: { value: n.active ? 1 : 0 }, uBoost: { value: isCore ? 0.3 : isZone ? 0.12 : 0 }, uSeed: { value: hash01(n.id) } } })
        const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(rad, isCore ? 96 : 48, isCore ? 96 : 48), orbMat)
        g.add(orbMesh)
        const glowMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, uniforms: { uColor: { value: c.clone() }, uTime: { value: 0 }, uActive: { value: planned ? 0 : (isCore || isZone ? 1 : (n.active ? 1 : 0)) } } })
        g.add(new THREE.Mesh(new THREE.SphereGeometry(rad * 1.12, 32, 32), glowMat))
        // node "idea/planned" -> wireframe blueprint
        if (planned) {
          g.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(rad * 1.02, 12, 9)), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.32 })))
        }
        r.scene.add(g); r.nodes.set(n.id, g); r.tmats.push(orbMat, glowMat)
        ;(g as any).__mats = { orb: orbMat, glow: glowMat }
        r.orbPick.push({ mesh: orbMesh, id: n.id })

        const label = new SpriteText(n.label)
        label.color = isZone ? '#dff6ff' : planned ? '#7f97ac' : '#cfe6f5'
        label.textHeight = isCore ? 5.5 : isZone ? 4.8 : n.val > 12 ? 3.6 : 3
        ;(label.material as THREE.Material).depthWrite = false
        label.position.copy(p).add(new THREE.Vector3(0, rad + 6, 0))
        r.scene.add(label); r.labels.set(n.id, label)
      }
      for (const l of t.links) {
        const geo = new THREE.CylinderGeometry(0.22, 0.22, 1, 6, 1, true)   // unit cylinder, xoay mỗi frame
        const mat = new THREE.ShaderMaterial({ vertexShader: LINK_VERT, fragmentShader: LINK_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { uColor: { value: col3(t.nodes.find((n) => n.id === l.target)?.group || 'model') }, uTime: { value: 0 }, uActive: { value: l.active ? 1 : 0 }, uFlow: { value: l.flow || 0 }, uSeed: { value: hash01(l.source + '>' + l.target) } } })
        const mesh = new THREE.Mesh(geo, mat)
        r.scene.add(mesh); r.links.set(l.source + '>' + l.target, mesh); r.tmats.push(mat)
        r.linkRefs.push({ a: l.source, b: l.target, mesh })
      }
    }
    // cập nhật active (không rebuild)
    for (const n of t.nodes) {
      const g = r.nodes.get(n.id)
      if (g?.__mats) {
        const planned = !!n.status && n.status !== 'live'
        if (g.__mats.orb.uniforms.uActive) g.__mats.orb.uniforms.uActive.value = n.active ? 1 : 0
        g.__mats.glow.uniforms.uActive.value = planned ? 0 : (n.group === 'core' || n.group === 'zone' ? 1 : (n.active ? 1 : 0))
      }
    }
    for (const l of t.links) {
      const m = r.links.get(l.source + '>' + l.target) as any
      if (m) { m.material.uniforms.uActive.value = l.active ? 1 : 0; m.material.uniforms.uFlow.value = l.flow || 0 }
    }
  }

  return (
    <div ref={mountRef} className="relative h-full w-full overflow-hidden" style={{ background: 'radial-gradient(120% 120% at 50% 46%, #0b1322 0%, #070b14 55%, #05070d 100%)' }}>
      <div className="absolute top-3 left-4 pointer-events-none select-none">
        <div className="text-cyan tracking-[0.3em] text-sm" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 12px rgba(63,211,255,.6)' }}>NEURAL CORE</div>
        <div className="text-[11px] mt-1" style={{ color: running.length ? '#7fe6b0' : '#5b7287' }}>
          {running.length ? `⚡ ${running.length} luồng đang chạy` : '○ idle — chờ lệnh'}
        </div>
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex flex-col gap-1 pointer-events-none">
        {running.slice(0, 4).map((j, i) => (
          <div key={i} className="text-[11px] px-2 py-1 border border-cyan/25 bg-black/40 backdrop-blur-sm self-start max-w-[90%] truncate"
            style={{ color: j.model === 'opus' ? '#62e89a' : '#36d4d0' }}>
            ⚡ {j.model.toUpperCase()} · {j.elapsed}s — {j.prompt}
          </div>
        ))}
      </div>
      <div className="absolute top-3 right-4 flex flex-col gap-1 text-[10px] pointer-events-none">
        {Object.entries(COLORS).map(([g, c]) => (
          <div key={g} className="flex items-center gap-1" style={{ color: c }}>
            <span style={{ width: 8, height: 8, borderRadius: 9, background: c, boxShadow: `0 0 6px ${c}` }} /> {g}
          </div>
        ))}
      </div>
    </div>
  )
}
