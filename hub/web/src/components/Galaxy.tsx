import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import SpriteText from 'three-spritetext'
import {
  ORB_VERT, PLANET_FRAG, CORE_FRAG, ZONE_COLOR, zoneCol, hash01, makeStars,
  makeGalaxyDust, makeNebulae, armAnchor, glowTexture, GALAXY_DEFAULT, LIVE_COLOR,
} from './viz3d'
import { brainGraph, brainRecall, brainFile, type GraphNode, type GraphLink } from '../api'
import Markdown from './Markdown'

// ════════ VŨ TRỤ LUCY — tinh hà tri thức + neural live GỘP 1 SCENE ════════
// • Dải ngân hà = STORAGE: bụi sao procedural vẽ hình xoắn ốc (đầy trời dù vault ít note),
//   note/preference THẬT = hành tinh sáng NEO trên cánh tay (zone = cánh tay) — tài nguyên trong vũ trụ.
// • Tâm = lõi L.U.C.Y plasma + node LIVE (agents/channels/API từ /api/telemetry) quay quanh như vệ tinh.
// • Generator tham số hóa (GALAXY_DEFAULT) → sau này mỗi project = 1 dải ngân hà riêng, zoom out = cả vũ trụ.

const ZONE_LABEL: Record<string, string> = {
  context: 'Bối cảnh', projects: 'Dự án', learned: 'Đã học', entities: 'Thực thể',
  skills: 'Kỹ năng', timeline: 'Nhật ký', decisions: 'Quyết định', ghost: 'Chưa viết',
}

type Hover = { label: string; zone: string; kind: string; obs: number; extra?: string; live?: boolean } | null
type TeleNode = { id: string; label: string; group: string; val: number; active?: boolean; status?: string }
type Tele = { nodes: TeleNode[]; links: unknown[]; running: { model: string; prompt: string; elapsed: number }[] }

export default function Galaxy({ visible }: { visible: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const R = useRef<any>({})
  const [hover, setHover] = useState<Hover>(null)
  const [meta, setMeta] = useState({ nodes: 0, links: 0, learned: 0, configured: true, offline: false })
  const [live, setLive] = useState({ total: 0, active: 0 })
  const [running, setRunning] = useState<Tele['running']>([])
  const [sel, setSel] = useState<{ node: GraphNode; doc: string } | null>(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<number | null>(null)

  // ---- init three (1 lần) ----
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x05070e, 0.0012)
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 6000)
    camera.position.set(0, 95, 195)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    const w0 = mount.clientWidth || 800, h0 = mount.clientHeight || 600
    renderer.setSize(w0, h0); camera.aspect = w0 / h0; camera.updateProjectionMatrix()
    mount.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enablePan = false
    controls.minDistance = 30; controls.maxDistance = 700; controls.zoomSpeed = 0.8
    controls.autoRotate = true; controls.autoRotateSpeed = 0.18

    // nền vũ trụ xa (parallax)
    const stars1 = makeStars(scene, 1600, 4200, 1.1, 0.3, 0x6f9fcf)
    const stars2 = makeStars(scene, 900, 2600, 1.7, 0.45, 0x8fc4ee)
    const stars3 = makeStars(scene, 400, 1400, 2.4, 0.6, 0xcdecff)

    // ── DẢI NGÂN HÀ (group quay chậm cả khối: bụi + hành tinh + đường sao DÍNH nhau) ──
    const galaxy = new THREE.Group()
    galaxy.rotation.x = 0.06 // nghiêng nhẹ cho cinematic
    scene.add(galaxy)
    makeGalaxyDust(galaxy, GALAXY_DEFAULT)
    makeNebulae(galaxy, GALAXY_DEFAULT)
    const planetsGrp = new THREE.Group(); galaxy.add(planetsGrp)

    // ── LÕI L.U.C.Y plasma + quầng sáng + vành đai LIVE ──
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: ORB_VERT, fragmentShader: CORE_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color('#46d8ff') }, uTime: { value: 0 } },
    })
    const core = new THREE.Mesh(new THREE.SphereGeometry(6.2, 48, 48), coreMat)
    scene.add(core)
    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#7fe2ff'), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }))
    coreGlow.scale.setScalar(46); scene.add(coreGlow)
    const liveGrp = new THREE.Group(); scene.add(liveGrp)

    R.current = {
      scene, camera, renderer, controls, galaxy, planetsGrp, liveGrp, core,
      planets: new Map(), pick: [], mats: [coreMat], pos: new Map(), edgeMat: null, topo: '',
      liveDots: new Map(), liveTopo: '', clock: new THREE.Clock(), hoverId: null, stars1, stars2, stars3, visible: false,
    }

    const tmp = new THREE.Vector3()
    const tick = () => {
      R.current.raf = requestAnimationFrame(tick)
      const r = R.current; if (!r.visible) return
      const t = r.clock.getElapsedTime()
      for (const m of r.mats) m.uniforms.uTime.value = t
      r.stars1.rotation.y = t * 0.004; r.stars2.rotation.y = -t * 0.007; r.stars3.rotation.y = t * 0.012
      r.galaxy.rotation.y = t * 0.011 // dải ngân hà tự quay — storage sống, không tĩnh
      if (r.edgeMat) r.edgeMat.opacity = 0.15 + 0.06 * Math.sin(t * 1.3)
      const now = performance.now()
      for (const [id, p] of r.planets) {
        const age = (now - p.bornAt) / 1400
        const grow = age < 1 ? easeOut(age) : 1
        const hov = id === r.hoverId ? 1.7 : 1
        p.mesh.scale.lerp(tmp.set(grow * hov, grow * hov, grow * hov), 0.16)
        if (p.label) p.label.material.opacity = THREE.MathUtils.lerp(p.label.material.opacity, id === r.hoverId ? 1 : p.baseLabelOp, 0.1)
        const pulse = Math.max(0, (p.pulseUntil - now) / 2600)
        if (p.mat.uniforms.uActive) p.mat.uniforms.uActive.value = pulse
      }
      // node live quay quanh lõi (vệ tinh) — mỗi node 1 quỹ đạo/vận tốc riêng theo hash
      for (const [id, d] of r.liveDots) {
        const a = d.baseA + t * d.speed
        d.mesh.position.set(Math.cos(a) * d.orbit, d.y, Math.sin(a) * d.orbit)
        const hov = id === r.hoverId ? 2 : 1
        d.mesh.scale.lerp(tmp.set(hov, hov, hov), 0.18)
        if (d.label) {
          d.label.position.copy(d.mesh.position).add(tmp.set(0, d.rad + 2.2, 0))
          d.label.material.opacity = THREE.MathUtils.lerp(d.label.material.opacity, id === r.hoverId ? 1 : 0, 0.12)
        }
      }
      controls.update(); renderer.render(scene, camera)
    }
    R.current.raf = requestAnimationFrame(tick)

    const ro = new ResizeObserver(() => { const w = mount.clientWidth, h = mount.clientHeight; if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() } })
    ro.observe(mount)

    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2()
    const pickAt = (e: PointerEvent) => {
      const r = R.current; const b = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects(r.pick, false)
      return hits.length ? hits[0].object.userData.id as string : null
    }
    const onMove = (e: PointerEvent) => {
      const r = R.current; if (!r.visible || r.dragging) return
      const id = pickAt(e)
      if (id !== r.hoverId) {
        r.hoverId = id; renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
        const p = id && r.planets.get(id)
        const d = id && r.liveDots.get(id)
        setHover(p ? hoverOf(p.n) : d ? hoverOfLive(d.n) : null)
      }
    }
    const onDown = () => { R.current.dragging = false; R.current.downAt = performance.now() }
    const onUp = (e: PointerEvent) => {
      const r = R.current
      if (performance.now() - (r.downAt || 0) < 250 && !r.dragging) {
        const id = pickAt(e); const p = id && r.planets.get(id)
        if (p && !p.n.ghost) openNote(p.n)
      }
    }
    const onDrag = () => { R.current.dragging = true; if (R.current.hoverId) { R.current.hoverId = null; setHover(null) } }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    controls.addEventListener('start', onDrag)

    return () => {
      cancelAnimationFrame(R.current.raf); ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.removeEventListener('start', onDrag)
      renderer.dispose(); try { mount.removeChild(renderer.domElement) } catch { /* */ }
    }
  }, [])

  useEffect(() => { if (R.current) { R.current.visible = visible; R.current.controls && (R.current.controls.autoRotate = visible) } }, [visible])

  // ---- poll graph trí nhớ (storage) ----
  useEffect(() => {
    if (!visible) return
    let alive = true
    const pull = async () => {
      try {
        const g = await brainGraph(); if (!alive) return
        if (g.configured === false) { setMeta((m) => ({ ...m, configured: false, offline: !!g.offline })); return }
        const nodes = g.nodes || [], links = g.links || []
        setMeta({ nodes: nodes.length, links: links.length, learned: nodes.filter((n) => n.kind === 'preference').length, configured: true, offline: false })
        sync(nodes, links)
      } catch { if (alive) setMeta((m) => ({ ...m, offline: true })) }
    }
    pull(); const iv = setInterval(pull, 4000)
    return () => { alive = false; clearInterval(iv) }
  }, [visible])

  // ---- poll telemetry (live — vành đai quanh lõi). Lỗi/chưa có → vành đai trống, không chết view. ----
  useEffect(() => {
    if (!visible) return
    let alive = true
    const pull = async () => {
      try {
        const res = await fetch('/api/telemetry'); if (!res.ok) throw 0
        const t: Tele = await res.json(); if (!alive) return
        setRunning(t.running || [])
        const ns = (t.nodes || []).filter((n) => n.group !== 'core' && n.group !== 'zone')
        setLive({ total: ns.length, active: ns.filter((n) => n.active).length })
        syncLive(ns)
      } catch { if (alive) { setRunning([]); setLive({ total: 0, active: 0 }); syncLive([]) } }
    }
    pull(); const iv = setInterval(pull, 2500)
    return () => { alive = false; clearInterval(iv) }
  }, [visible])

  // ---- dựng/đồng bộ HÀNH TINH trí nhớ: neo trên cánh tay xoắn ốc (deterministic, không force-layout) ----
  function sync(nodes: GraphNode[], links: GraphLink[]) {
    const r = R.current; if (!r?.planetsGrp) return
    const topo = nodes.map((n) => n.id).sort().join(',') + '|' + links.length
    if (topo === r.topo) {
      for (const n of nodes) { const p = r.planets.get(n.id); if (p?.mat.uniforms.uBright) p.mat.uniforms.uBright.value = n.brightness }
      return
    }
    const prevIds = new Set(r.planets.keys())
    r.topo = topo
    for (const c of [...r.planetsGrp.children]) r.planetsGrp.remove(c)
    const livePickOld = [...r.pick].filter((m: THREE.Mesh) => r.liveDots.has(m.userData.id))
    r.planets = new Map(); r.pos = new Map(); r.pick = livePickOld
    r.mats = r.mats.filter((m: THREE.ShaderMaterial) => m === r.core.material || [...r.liveDots.values()].some((d: any) => d.mat === m))

    const now = performance.now()
    for (const n of nodes) {
      const p = armAnchor(n.zone, n.id) // địa chỉ vũ trụ cố định theo zone+id
      r.pos.set(n.id, p)
      const rad = (1.5 + Math.cbrt(n.mass) * 0.75) * (n.ghost ? 0.55 : 1)
      const mat = new THREE.ShaderMaterial({
        vertexShader: ORB_VERT, fragmentShader: PLANET_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        uniforms: { uColor: { value: n.ghost ? new THREE.Color('#46566a') : zoneCol(n.zone) }, uTime: { value: 0 }, uActive: { value: 0 }, uBright: { value: n.brightness }, uSeed: { value: hash01(n.id) } },
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 20, 20), mat)
      mesh.position.copy(p); mesh.userData.id = n.id
      r.planetsGrp.add(mesh); r.mats.push(mat)

      let label: any = null
      const baseLabelOp = n.ghost ? 0 : 0.5
      if (!n.ghost) {
        label = new SpriteText(n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label)
        label.color = ZONE_COLOR[n.zone] || '#cfe6f5'
        label.textHeight = 2.6 + Math.cbrt(n.mass) * 0.3
        label.fontFace = 'Space Grotesk, sans-serif'
        label.material.depthWrite = false; label.material.transparent = true
        label.material.opacity = 0
        label.position.copy(p).add(new THREE.Vector3(0, rad + 3, 0))
        r.planetsGrp.add(label)
      }
      const bornAt = prevIds.size && !prevIds.has(n.id) ? now : now - 2000
      r.planets.set(n.id, { mesh, mat, n, label, baseLabelOp, bornAt, pulseUntil: 0 })
      r.pick.push(mesh)
    }

    // đường sao = wikilink THẬT giữa các hành tinh (cùng group quay với dải ngân hà)
    const seg: number[] = []; const col: number[] = []
    for (const l of links) {
      const a = r.pos.get(l.source), b = r.pos.get(l.target); if (!a || !b) continue
      const c = new THREE.Color(l.real ? '#5fd0ff' : '#3a6f7a')
      seg.push(a.x, a.y, a.z, b.x, b.y, b.z); col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    const eg = new THREE.BufferGeometry()
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3))
    eg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3))
    const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    r.edgeMat = edgeMat; r.planetsGrp.add(new THREE.LineSegments(eg, edgeMat))
  }

  // ---- dựng/đồng bộ vành đai LIVE quanh lõi ----
  function syncLive(nodes: TeleNode[]) {
    const r = R.current; if (!r?.liveGrp) return
    const topo = nodes.map((n) => n.id + (n.status || '')).sort().join(',')
    if (topo === r.liveTopo) { // chỉ cập nhật active
      for (const n of nodes) { const d = r.liveDots.get(n.id); if (d?.mat.uniforms.uActive) d.mat.uniforms.uActive.value = n.active ? 1.2 : 0 }
      return
    }
    r.liveTopo = topo
    for (const c of [...r.liveGrp.children]) r.liveGrp.remove(c)
    r.pick = [...r.pick].filter((m: THREE.Mesh) => !r.liveDots.has(m.userData.id))
    r.mats = r.mats.filter((m: THREE.ShaderMaterial) => ![...r.liveDots.values()].some((d: any) => d.mat === m))
    r.liveDots = new Map()
    nodes.forEach((n, i) => {
      const planned = !!n.status && n.status !== 'live'
      const c = new THREE.Color(LIVE_COLOR[n.group] || '#7fb0d0'); if (planned) c.multiplyScalar(0.6)
      const rad = 0.85 + Math.cbrt(n.val || 8) * 0.32
      const mat = new THREE.ShaderMaterial({
        vertexShader: ORB_VERT, fragmentShader: PLANET_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        uniforms: { uColor: { value: c }, uTime: { value: 0 }, uActive: { value: n.active ? 1.2 : 0 }, uBright: { value: planned ? 0.45 : 0.95 }, uSeed: { value: hash01(n.id) } },
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 16), mat)
      mesh.userData.id = n.id
      const label = new SpriteText(n.label)
      label.color = LIVE_COLOR[n.group] || '#cfe6f5'; label.textHeight = 2
      label.fontFace = 'Space Grotesk, sans-serif'
      label.material.depthWrite = false; label.material.transparent = true; label.material.opacity = 0
      r.liveGrp.add(mesh); r.liveGrp.add(label); r.mats.push(mat); r.pick.push(mesh)
      r.liveDots.set(n.id, {
        mesh, mat, n, label, rad,
        orbit: 10.5 + (i % 3) * 2.6 + hash01(n.id + 'o') * 1.6, // 3 vành đai xen kẽ
        baseA: hash01(n.id) * Math.PI * 2,
        speed: 0.10 + hash01(n.id + 's') * 0.10,
        y: (hash01(n.id + 'y') - 0.5) * 4,
      })
    })
  }

  async function openNote(n: GraphNode) {
    setSel({ node: n, doc: '…' })
    if (!n.path) { setSel({ node: n, doc: '_(không có file)_' }); return }
    const d = await brainFile(n.path)
    setSel({ node: n, doc: d.content || '_(không đọc được)_' })
  }

  // recall → hành tinh trúng bắn xung + camera ngắm vào (toạ độ WORLD vì galaxy đang quay)
  async function doSearch() {
    const term = q.trim(); if (!term) { setFound(null); return }
    const d = await brainRecall(term); const hits = d.hits || []
    const r = R.current; const now = performance.now()
    const ids = new Set<string>()
    for (const h of hits) for (const [id, p] of r.planets) if (p.n.path === h.file_path) ids.add(id)
    for (const id of ids) { const p = r.planets.get(id); if (p) p.pulseUntil = now + 2600 }
    setFound(ids.size)
    const first = [...ids][0]; const fp = first && r.planets.get(first)
    if (fp && r.controls) { const w = new THREE.Vector3(); fp.mesh.getWorldPosition(w); r.controls.target.lerp(w, 0.8) }
  }

  if (!meta.configured) return (
    <div className="h-full grid place-items-center px-6">
      <div className="card max-w-md p-6 text-center">
        <div className="text-3xl mb-2">🌌</div>
        <div className="display text-cyan tracking-wide mb-2">VŨ TRỤ CHƯA BẬT</div>
        <p className="text-[13px] text-inkdim leading-relaxed">Đặt <code className="text-cyan">LUCY_VAULT</code> cho coordinator rồi restart.{meta.offline && <span className="block mt-2 text-pink">· coordinator offline.</span>}</p>
      </div>
    </div>
  )

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: 'radial-gradient(130% 130% at 50% 42%, #0a1120 0%, #070b14 55%, #04060c 100%)', cursor: 'grab' }}>
      <div ref={mountRef} className="absolute inset-0" />

      {/* search recall — gõ → hành tinh trúng bắn xung */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 w-[min(420px,80%)]">
        <input className="input !py-1.5 text-[13px] flex-1 bg-black/40 backdrop-blur" placeholder="recall — chiếu sáng hành tinh khớp…"
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} />
        <button className="btn btn-primary !py-1.5 !text-[12px] shrink-0" onClick={doSearch}>🔎</button>
        {found !== null && <span className="chip shrink-0 bg-black/40">{found} ⚡</span>}
      </div>

      {/* hover info */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-20 pointer-events-none text-center">
        {hover ? (
          <div key={hover.label}>
            <div className="text-[15px] font-semibold tracking-wide" style={{ color: (hover.live ? LIVE_COLOR[hover.zone] : ZONE_COLOR[hover.zone]) || '#cfe6f5', textShadow: `0 0 12px ${((hover.live ? LIVE_COLOR[hover.zone] : ZONE_COLOR[hover.zone]) || '#3fd3ff')}88` }}>{hover.label}</div>
            <div className="text-[11px] mt-0.5 text-inkdim">{hover.live ? `hệ thống · ${hover.zone}` : `${ZONE_LABEL[hover.zone] || hover.zone} · ${hover.kind}`}{hover.obs ? ` · ${hover.obs} quan sát` : ''}{hover.extra ? ` · ${hover.extra}` : ''}</div>
            {!hover.live && <div className="text-[10px] text-inkfaint mt-0.5">click để mở</div>}
          </div>
        ) : (
          <div className="text-[11px] text-inkfaint">
            {meta.nodes} hành tinh · {meta.links} đường sao · {meta.learned} đã học
            {live.total > 0 && <> · <span className="text-cyan/80">{live.active}/{live.total} hệ thống ⚡</span></>}
            {meta.offline ? ' · offline' : ''}
          </div>
        )}
      </div>

      {/* job đang chạy (live) — góc dưới trái */}
      <div className="absolute bottom-3 left-4 right-4 flex flex-col gap-1 pointer-events-none z-20">
        {running.slice(0, 4).map((j, i) => (
          <div key={i} className="text-[11px] px-2 py-1 rounded border border-cyan/25 bg-black/40 backdrop-blur-sm self-start max-w-[90%] truncate"
            style={{ color: j.model === 'opus' ? '#62e89a' : '#36d4d0' }}>
            ⚡ {j.model.toUpperCase()} · {j.elapsed}s — {j.prompt}
          </div>
        ))}
      </div>

      {/* legend zone (trí nhớ) + live */}
      <div className="absolute top-3 right-4 flex flex-col gap-1 text-[10px] pointer-events-none z-20">
        {Object.entries(ZONE_LABEL).filter(([z]) => z !== 'ghost').map(([z, lb]) => (
          <div key={z} className="flex items-center gap-1.5" style={{ color: ZONE_COLOR[z] }}>
            <span style={{ width: 8, height: 8, borderRadius: 9, background: ZONE_COLOR[z], boxShadow: `0 0 6px ${ZONE_COLOR[z]}` }} /> {lb}
          </div>
        ))}
        {live.total > 0 && <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-line/60" style={{ color: '#9fe9ff' }}>
          <span style={{ width: 8, height: 8, borderRadius: 9, background: '#46d8ff', boxShadow: '0 0 6px #46d8ff' }} /> live (quanh lõi)
        </div>}
      </div>

      {/* note panel (click hành tinh) */}
      {sel && (
        <div className="absolute top-0 right-0 h-full w-[min(440px,92%)] z-30 bg-panel/95 backdrop-blur border-l border-line flex flex-col shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
            <span style={{ color: ZONE_COLOR[sel.node.zone] }}>●</span>
            <span className="text-[13px] text-cyan font-medium truncate flex-1">{sel.node.label}</span>
            <span className="text-[10px] text-inkfaint mono truncate max-w-[40%]">{sel.node.path}</span>
            <button className="btn btn-icon !w-8 !h-8 shrink-0" onClick={() => setSel(null)}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4"><div className="card p-4"><Markdown>{stripFm(sel.doc)}</Markdown></div></div>
        </div>
      )}
    </div>
  )
}

function easeOut(t: number) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3) }
function hoverOf(n: GraphNode): Hover {
  const extra = n.kind === 'preference' ? `${n.status} ${n.confidence ?? 0} (${n.band})` : n.ghost ? 'chưa viết' : undefined
  return { label: n.label, zone: n.zone, kind: n.kind, obs: n.obs, extra }
}
function hoverOfLive(n: TeleNode): Hover {
  return { label: n.label, zone: n.group, kind: 'live', obs: 0, extra: n.active ? '⚡ active' : n.status || 'live', live: true }
}
function stripFm(md: string): string { return md.replace(/^---[\s\S]*?\n---\n/, '').trim() }
