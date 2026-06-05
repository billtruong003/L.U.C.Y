import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { jobs } from '../api'

const AGENTS = [
  { label: 'Lucy', color: '#3fd3ff' },
  { label: 'Sonnet', color: '#7af0c0' },
  { label: 'Opus', color: '#ff2d7e' },
  { label: 'Claude', color: '#ffd166' },
]

function Core({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((s) => {
    ref.current.rotation.y += active ? 0.02 : 0.005
    ref.current.rotation.x += 0.002
    const p = 1 + Math.sin(s.clock.elapsedTime * (active ? 6 : 2)) * (active ? 0.13 : 0.05)
    ref.current.scale.setScalar(p)
  })
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.1, 2]} />
      <meshStandardMaterial color="#3fd3ff" emissive="#3fd3ff" emissiveIntensity={active ? 2.4 : 0.9} wireframe />
    </mesh>
  )
}

function Agent({ i, n, color, label, active }: { i: number; n: number; color: string; label: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const a = (i / n) * Math.PI * 2
  const pos = useMemo(() => new THREE.Vector3(Math.cos(a) * 3.2, Math.sin(a) * 0.7, Math.sin(a) * 3.2), [a])
  useFrame(() => { if (ref.current) ref.current.rotation.y += 0.02 })
  return (
    <group>
      <Line points={[[0, 0, 0], [pos.x, pos.y, pos.z]]} color={color} lineWidth={active ? 2.2 : 0.7} transparent opacity={active ? 0.95 : 0.35} />
      <group position={pos}>
        <mesh ref={ref}>
          <octahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} />
        </mesh>
        <Html center distanceFactor={9}>
          <div style={{ color, fontSize: 11, fontFamily: '"Share Tech Mono", monospace', whiteSpace: 'nowrap', textShadow: `0 0 8px ${color}` }}>{label}</div>
        </Html>
      </group>
    </group>
  )
}

export default function BrainViz() {
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
      <Canvas camera={{ position: [0, 1.5, 7], fov: 55 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.4} color="#3fd3ff" />
        <pointLight position={[-5, -3, -5]} intensity={0.6} color="#ff2d7e" />
        <Core active={active} />
        {AGENTS.map((ag, i) => (
          <Agent key={ag.label} i={i} n={AGENTS.length} color={ag.color} label={ag.label} active={active} />
        ))}
      </Canvas>
    </div>
  )
}
