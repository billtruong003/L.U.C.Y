import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import SpriteText from 'three-spritetext'
import { ORB_VERT, PLANET_FRAG, CORE_FRAG, ZONE_COLOR, zoneCol, hash01, makeStars, forceLayout3D, type FNode, type FLink } from './viz3d'
import { brainGraph, brainRecall, brainFile, type GraphNode, type GraphLink } from '../api'
import Markdown from './Markdown'

// ════════ TINH HÀ TRI THỨC (NEURAL_GALAXY.md) ════════
// Hành tinh = note THẬT · đường sao = wikilink [[...]] THẬT · độ sáng = confidence/độ-mới.
// Force-layout 3D (cấu trúc thật) + styling galaxy. Recall trúng → hành tinh bừng sáng (neuron bắn xung).
// Càng dùng (thêm note/preference) → càng nhiều hành tinh: tinh hà NỞ.

const ZONE_LABEL: Record<string, string> = {
  context: 'Bối cảnh', projects: 'Dự án', learned: 'Đã học', entities: 'Thực thể',
  skills: 'Kỹ năng', timeline: 'Nhật ký', decisions: 'Quyết định', memory: 'Ký ức', ghost: 'Chưa viết',
}

type Hover = { label: string; zone: string; kind: string; obs: number; extra?: string } | null

export default function Galaxy({ visible }: { visible: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const R = useRef<any>({})
  const [hover, setHover] = useState<Hover>(null)
  const [meta, setMeta] = useState({ nodes: 0, links: 0, learned: 0, configured: true, offline: false })
  const [sel, setSel] = useState<{ node: GraphNode; doc: string } | null>(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<number | null>(null)

  // ---- init three (1 lần) ----
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x05070e, 0.0016)
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 5000)
    camera.position.set(0, 60, 170)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    const w0 = mount.clientWidth || 800, h0 = mount.clientHeight || 600
    renderer.setSize(w0, h0); camera.aspect = w0 / h0; camera.updateProjectionMatrix()
    mount.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enablePan = false
    controls.minDistance = 60; controls.maxDistance = 460; controls.zoomSpeed = 0.8
    controls.autoRotate = true; controls.autoRotateSpeed = 0.35

    const stars1 = makeStars(scene, 1400, 3200, 1.1, 0.32, 0x6f9fcf)
    const stars2 = makeStars(scene, 800, 2000, 1.7, 0.48, 0x8fc4ee)
    const stars3 = makeStars(scene, 360, 1100, 2.4, 0.66, 0xcdecff)
    const galaxy = new THREE.Group(); scene.add(galaxy)

    R.current = { scene, camera, renderer, controls, galaxy, planets: new Map(), pick: [], mats: [], pos: new Map(), edgeMat: null, topo: '', clock: new THREE.Clock(), hoverId: null, stars1, stars2, stars3, visible: false }

    const tmp = new THREE.Vector3()
    const tick = () => {
      R.current.raf = requestAnimationFrame(tick)
      const r = R.current; if (!r.visible) return
      const t = r.clock.getElapsedTime()
      for (const m of r.mats) m.uniforms.uTime.value = t
      r.stars1.rotation.y = t * 0.005; r.stars2.rotation.y = -t * 0.009; r.stars3.rotation.y = t * 0.016
      if (r.edgeMat) r.edgeMat.opacity = 0.16 + 0.06 * Math.sin(t * 1.3)
      const now = performance.now()
      for (const [id, p] of r.planets) {
        // born: scale 0→1 trong ~1.4s; hover: phóng to; pulse recall: uActive giảm dần
        const age = (now - p.bornAt) / 1400
        const grow = age < 1 ? easeOut(age) : 1
        const hov = id === r.hoverId ? 1.7 : 1
        p.mesh.scale.lerp(tmp.set(grow * hov, grow * hov, grow * hov), 0.16)
        if (p.label) p.label.material.opacity = THREE.MathUtils.lerp(p.label.material.opacity, id === r.hoverId ? 1 : p.baseLabelOp, 0.1)
        const pulse = Math.max(0, (p.pulseUntil - now) / 2600)
        if (p.mat.uniforms.uActive) p.mat.uniforms.uActive.value = pulse
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
        setHover(p ? hoverOf(p.n) : null)
      }
    }
    const onDown = () => { R.current.dragging = false; R.current.downAt = performance.now() }
    const onUp = (e: PointerEvent) => {
      const r = R.current
      if (performance.now() - (r.downAt || 0) < 250 && !r.dragging) { // click (không phải kéo)
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

  // ---- poll graph ----
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

  // ---- dựng/đồng bộ tinh hà ----
  function sync(nodes: GraphNode[], links: GraphLink[]) {
    const r = R.current; if (!r?.galaxy) return
    const topo = nodes.map((n) => n.id).sort().join(',') + '|' + links.length
    if (topo === r.topo) { // chỉ cập nhật brightness (không rebuild)
      for (const n of nodes) { const p = r.planets.get(n.id); if (p?.mat.uniforms.uBright) p.mat.uniforms.uBright.value = n.brightness }
      return
    }
    const prevIds = new Set(r.planets.keys())
    r.topo = topo
    for (const c of [...r.galaxy.children]) r.galaxy.remove(c)
    r.planets = new Map(); r.pick = []; r.mats = []

    // degree → hành tinh trung tâm (lõi tinh hà) = node nhiều liên kết nhất
    const deg = new Map<string, number>()
    for (const l of links) { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1) }
    let coreId = ''; let best = -1
    for (const n of nodes) { const d = deg.get(n.id) || 0; if (!n.ghost && d > best) { best = d; coreId = n.id } }

    // layout giữ vị trí cũ → nở mượt
    const fn: FNode[] = nodes.map((n) => ({ id: n.id, mass: n.mass }))
    const fl: FLink[] = links.map((l) => ({ source: l.source, target: l.target, weight: l.weight }))
    const pos = forceLayout3D(fn, fl, r.pos)
    r.pos = pos

    const now = performance.now()
    for (const n of nodes) {
      const p = pos.get(n.id)!; const isCore = n.id === coreId
      const rad = (isCore ? 5.2 : 1.4 + Math.cbrt(n.mass) * 0.7) * (n.ghost ? 0.6 : 1)
      const mat = new THREE.ShaderMaterial({
        vertexShader: ORB_VERT, fragmentShader: isCore ? CORE_FRAG : PLANET_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        uniforms: isCore
          ? { uColor: { value: zoneCol(n.zone) }, uTime: { value: 0 } }
          : { uColor: { value: n.ghost ? new THREE.Color('#46566a') : zoneCol(n.zone) }, uTime: { value: 0 }, uActive: { value: 0 }, uBright: { value: n.brightness }, uSeed: { value: hash01(n.id) } },
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, isCore ? 48 : 20, isCore ? 48 : 20), mat)
      mesh.position.copy(p); mesh.userData.id = n.id
      r.galaxy.add(mesh); r.mats.push(mat)

      let label: any = null // SpriteText — three untyped trong project → any (như BrainViz)
      const baseLabelOp = isCore ? 0.95 : 0.42
      if (!n.ghost) {
        label = new SpriteText(n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label)
        label.color = ZONE_COLOR[n.zone] || '#cfe6f5'
        label.textHeight = isCore ? 5 : 2.6 + Math.cbrt(n.mass) * 0.3
        label.fontFace = 'Space Grotesk, sans-serif'
        label.material.depthWrite = false; label.material.transparent = true
        label.material.opacity = 0
        label.position.copy(p).add(new THREE.Vector3(0, rad + 3, 0))
        r.galaxy.add(label)
      }
      const bornAt = prevIds.size && !prevIds.has(n.id) ? now : now - 2000 // node mới → animate ló sáng
      r.planets.set(n.id, { mesh, mat, n, label, baseLabelOp, bornAt, pulseUntil: 0 })
      if (!n.ghost || true) r.pick.push(mesh)
    }

    // đường sao = wikilink. real = liền sáng, derived (pref→dự án) = mờ hơn.
    const seg: number[] = []; const col: number[] = []
    for (const l of links) {
      const a = pos.get(l.source), b = pos.get(l.target); if (!a || !b) continue
      const c = new THREE.Color(l.real ? '#5fd0ff' : '#3a6f7a')
      seg.push(a.x, a.y, a.z, b.x, b.y, b.z); col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    const eg = new THREE.BufferGeometry()
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3))
    eg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3))
    const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    r.edgeMat = edgeMat; r.galaxy.add(new THREE.LineSegments(eg, edgeMat))
  }

  async function openNote(n: GraphNode) {
    setSel({ node: n, doc: '…' })
    if (!n.path) { setSel({ node: n, doc: '_(không có file)_' }); return }
    const d = await brainFile(n.path)
    setSel({ node: n, doc: d.content || '_(không đọc được)_' })
  }

  // recall → hành tinh trúng bắn xung + ngắm camera vào cái đầu
  async function doSearch() {
    const term = q.trim(); if (!term) { setFound(null); return }
    const d = await brainRecall(term); const hits = d.hits || []
    const r = R.current; const now = performance.now()
    // map file_path → node id (permalink). Pulse mọi node có path khớp.
    const ids = new Set<string>()
    for (const h of hits) for (const [id, p] of r.planets) if (p.n.path === h.file_path) ids.add(id)
    for (const id of ids) { const p = r.planets.get(id); if (p) p.pulseUntil = now + 2600 }
    // A7 graph-walk: note nối hit (1 bước wikilink) → pulse NGẮN hơn (lan truyền mờ dần như xung neuron)
    for (const rel of d.related || []) for (const [id, p] of r.planets) {
      if (p.n.path === rel.file_path && !ids.has(id)) p.pulseUntil = Math.max(p.pulseUntil, now + 1300)
    }
    setFound(ids.size)
    // ngắm camera tới hành tinh đầu
    const first = [...ids][0]; const fp = first && r.pos.get(first)
    if (fp && r.controls) { r.controls.target.lerp(fp, 0.8) }
  }

  if (!meta.configured) return (
    <div className="h-full grid place-items-center px-6">
      <div className="card max-w-md p-6 text-center">
        <div className="text-3xl mb-2">🌌</div>
        <div className="display text-cyan tracking-wide mb-2">TINH HÀ CHƯA BẬT</div>
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
            <div className="text-[15px] font-semibold tracking-wide" style={{ color: ZONE_COLOR[hover.zone] || '#cfe6f5', textShadow: `0 0 12px ${(ZONE_COLOR[hover.zone] || '#3fd3ff')}88` }}>{hover.label}</div>
            <div className="text-[11px] mt-0.5 text-inkdim">{ZONE_LABEL[hover.zone] || hover.zone} · {hover.kind}{hover.obs ? ` · ${hover.obs} quan sát` : ''}{hover.extra ? ` · ${hover.extra}` : ''}</div>
            <div className="text-[10px] text-inkfaint mt-0.5">click để mở</div>
          </div>
        ) : (
          <div className="text-[11px] text-inkfaint">{meta.nodes} hành tinh · {meta.links} đường sao · {meta.learned} đã học{meta.offline ? ' · offline' : ''}</div>
        )}
      </div>

      {/* legend zone */}
      <div className="absolute top-3 right-4 flex flex-col gap-1 text-[10px] pointer-events-none z-20">
        {Object.entries(ZONE_LABEL).filter(([z]) => z !== 'ghost').map(([z, lb]) => (
          <div key={z} className="flex items-center gap-1.5" style={{ color: ZONE_COLOR[z] }}>
            <span style={{ width: 8, height: 8, borderRadius: 9, background: ZONE_COLOR[z], boxShadow: `0 0 6px ${ZONE_COLOR[z]}` }} /> {lb}
          </div>
        ))}
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
function stripFm(md: string): string { return md.replace(/^---[\s\S]*?\n---\n/, '').trim() }
