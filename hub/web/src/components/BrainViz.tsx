import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line, OrbitControls, Stars, MeshDistortMaterial } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { jobs } from '../api'

const AGENTS = [
  { label: 'Lucy', color: '#3fd3ff' },
  { label: 'Sonnet', color: '#7af0c0' },
  { label: 'Opus', color: '#ff2d7e' },
  { label: 'Claude', color: '#ffd166' },
  { label: 'Web', color: '#a78bfa' },
  { label: 'Tools', color: '#ffffff' },
]

function Core({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((s) => { ref.current.rotation.y += active ? 0.012 : 0.004; ref.current.rotation.x += 0.002 })
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.25, 8]} />
      <MeshDistortMaterial color="#0b3550" emissive="#3fd3ff" emissiveIntensity={active ? 2.6 : 1.1}
        distort={active ? 0.5 : 0.28} speed={active ? 4 : 1.4} roughness={0.15} metalness={0.85} />
    </mesh>
  )
}

function InnerWire() {
  const r = useRef<THREE.Mesh>(null!)
  useFrame(() => { r.current.rotation.y -= 0.006; r.current.rotation.x += 0.003 })
  return (
    <mesh ref={r}>
      <icosahedronGeometry args={[1.7, 1]} />
      <meshBasicMaterial color="#3fd3ff" wireframe transparent opacity={0.22} />
    </mesh>
  )
}

function Pulse({ pos, color, active, offset }: { pos: THREE.Vector3; color: string; active: boolean; offset: number }) {
  const r = useRef<THREE.Mesh>(null!)
  useFrame((s) => {
    const t = ((s.clock.elapsedTime * (active ? 1.1 : 0.4) + offset) % 1)
    r.current.position.set(pos.x * t, pos.y * t, pos.z * t)
    r.current.visible = active
  })
  return <mesh ref={r}><sphereGeometry args={[0.09, 10, 10]} /><meshBasicMaterial color={color} /></mesh>
}

function Agent({ i, n, color, label, active }: { i: number; n: number; color: string; label: string; active: boolean }) {
  const a = (i / n) * Math.PI * 2
  const pos = useMemo(() => new THREE.Vector3(Math.cos(a) * 3.6, Math.sin(a * 1.4) * 1.0, Math.sin(a) * 3.6), [a])
  const r = useRef<THREE.Mesh>(null!)
  useFrame(() => { r.current.rotation.y += 0.02; r.current.rotation.x += 0.01 })
  return (
    <group>
      <Line points={[[0, 0, 0], [pos.x, pos.y, pos.z]]} color={color} lineWidth={active ? 1.6 : 0.5} transparent opacity={active ? 0.85 : 0.22} />
      <Pulse pos={pos} color={color} active={active} offset={i / n} />
      <group position={pos}>
        <mesh ref={r}>
          <octahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} roughness={0.3} metalness={0.6} />
        </mesh>
        <Html center distanceFactor={9}>
          <div style={{ color, fontSize: 11, fontFamily: '"Share Tech Mono", monospace', whiteSpace: 'nowrap', textShadow: `0 0 8px ${color}` }}>{label}</div>
        </Html>
      </group>
    </group>
  )
}

export default function BrainViz({ visible }: { visible: boolean }) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const f = () => jobs().then((d) => setActive((d.jobs || []).some((j) => j.status === 'running'))).catch(() => {})
    f(); const t = setInterval(f, 2500); return () => clearInterval(t)
  }, [])
  return (
    <div className="h-full relative">
      <div className="absolute top-3 left-4 z-10 text-cyan" style={{ fontFamily: 'Orbitron, sans-serif' }}>
        🧠 BRAIN-VIZ {active && <span className="text-pink text-xs ml-2 animate-pulse">● ACTIVE</span>}
      </div>
      <Canvas dpr={[1, 2]} frameloop={visible ? 'always' : 'never'} camera={{ position: [0, 1.6, 8], fov: 50 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#02040c']} />
        <ambientLight intensity={0.3} />
        <pointLight position={[6, 6, 6]} intensity={1.6} color="#3fd3ff" />
        <pointLight position={[-6, -4, -6]} intensity={0.8} color="#ff2d7e" />
        <Stars radius={60} depth={40} count={1800} factor={3} fade speed={active ? 1.6 : 0.4} />
        <Core active={active} />
        <InnerWire />
        {AGENTS.map((ag, i) => <Agent key={ag.label} i={i} n={AGENTS.length} color={ag.color} label={ag.label} active={active} />)}
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={active ? 1.4 : 0.5} minDistance={5} maxDistance={14} />
        <EffectComposer>
          <Bloom intensity={active ? 1.7 : 1.0} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
