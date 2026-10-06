"use client"

import { useEffect, useMemo, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { Grid } from "@react-three/drei"
import * as THREE from "three"

const TUNNEL_W = 20
const TUNNEL_H = 7
const TUNNEL_L = 44
const BELT_W = 1.5
const BELT_L = 6.4
const TURNTABLE_R = 3.6

function useBeltTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 256
    c.height = 512
    const ctx = c.getContext("2d")!
    ctx.fillStyle = "#1a1b1e"
    ctx.fillRect(0, 0, c.width, c.height)
    // Fine grain so the moving belt reads at speed
    for (let i = 0; i < 2600; i++) {
      const v = 30 + Math.random() * 30
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + Math.random() * 0.4})`
      ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 2, 2 + Math.random() * 10)
    }
    // Edge tracking marks
    ctx.fillStyle = "rgba(220,220,225,0.55)"
    for (let y = 0; y < c.height; y += 64) {
      ctx.fillRect(6, y, 10, 22)
      ctx.fillRect(c.width - 16, y, 10, 22)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 4)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [])
}

function useShadowBlob() {
  return useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 128
    c.height = 256
    const ctx = c.getContext("2d")!
    const g = ctx.createRadialGradient(64, 128, 10, 64, 128, 128)
    g.addColorStop(0, "rgba(0,0,0,0.85)")
    g.addColorStop(0.6, "rgba(0,0,0,0.45)")
    g.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, c.width, c.height)
    return new THREE.CanvasTexture(c)
  }, [])
}

/**
 * Closed test section: rolling road on a turntable, overhead sting, light
 * strips on the ceiling. The turntable carries the belt and the sting, so
 * yawing the car rotates all three relative to the airflow — as in a real tunnel.
 */
export default function Tunnel({ yaw, flowSpeedRef, sting = true }: { yaw: number; flowSpeedRef: MutableRefObject<number>; sting?: boolean }) {
  const belt = useBeltTexture()
  const blob = useShadowBlob()
  const turntable = useRef<THREE.Group>(null)

  useEffect(() => () => belt.dispose(), [belt])
  useEffect(() => () => blob.dispose(), [blob])

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    // Belt runs at the same speed as the air, as on a rolling road
    belt.offset.y += (flowSpeedRef.current * d) / (BELT_L / belt.repeat.y)
    if (turntable.current) {
      turntable.current.rotation.y = THREE.MathUtils.damp(turntable.current.rotation.y, THREE.MathUtils.degToRad(yaw), 6, d)
    }
  })

  const panel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.7, metalness: 0.2 }), [])
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: "#24272c", roughness: 0.5, metalness: 0.6 }), [])
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.5), toneMapped: false }), [])

  return (
    <group>
      {/* Test section floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[TUNNEL_W, TUNNEL_L]} />
        <meshStandardMaterial color="#0f1013" roughness={0.85} metalness={0.1} />
      </mesh>
      <Grid
        position={[0, 0.0005, 0]}
        args={[TUNNEL_W, TUNNEL_L]}
        cellSize={0.25}
        cellThickness={0.6}
        cellColor="#1c1f24"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#2a2e35"
        fadeDistance={22}
        fadeStrength={1.5}
      />

      {/* Turntable, rolling road, sting */}
      <group ref={turntable}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <ringGeometry args={[TURNTABLE_R - 0.04, TURNTABLE_R, 128]} />
          <meshStandardMaterial color="#3a3e46" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Yaw scale ticks */}
        {Array.from({ length: 13 }, (_, i) => (i - 6) * 2.5).map((a) => (
          <mesh
            key={a}
            position={[Math.sin(THREE.MathUtils.degToRad(a)) * (TURNTABLE_R - 0.12), 0.0015, Math.cos(THREE.MathUtils.degToRad(a)) * (TURNTABLE_R - 0.12)]}
            rotation={[-Math.PI / 2, 0, -THREE.MathUtils.degToRad(a)]}
          >
            <planeGeometry args={[0.012, a === 0 ? 0.18 : 0.1]} />
            <meshBasicMaterial color={a === 0 ? "#e8e8ea" : "#5b606a"} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -0.2]} receiveShadow>
          <planeGeometry args={[BELT_W, BELT_L]} />
          <meshStandardMaterial map={belt} roughness={0.75} metalness={0.15} />
        </mesh>
        {/* Belt rollers housing edges */}
        {[1, -1].map((s) => (
          <mesh key={s} position={[s * (BELT_W / 2 + 0.04), 0.006, -0.2]} castShadow receiveShadow>
            <boxGeometry args={[0.06, 0.012, BELT_L + 0.1]} />
            <meshStandardMaterial color="#2c3037" roughness={0.4} metalness={0.8} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -0.2]}>
          <planeGeometry args={[2.6, 6.2]} />
          <meshBasicMaterial map={blob} transparent depthWrite={false} opacity={0.75} />
        </mesh>
        {/* Overhead sting: streamlined blade down to the roll hoop */}
        {sting && (
          <mesh position={[0, (TUNNEL_H + 0.95) / 2 + 0.05, -0.15]} castShadow material={frame}>
            <boxGeometry args={[0.05, TUNNEL_H - 0.95, 0.26]} />
          </mesh>
        )}
      </group>

      {/* Walls and ceiling */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * (TUNNEL_W / 2), TUNNEL_H / 2, 0]} rotation={[0, -s * (Math.PI / 2), 0]} material={panel} receiveShadow>
          <planeGeometry args={[TUNNEL_L, TUNNEL_H]} />
        </mesh>
      ))}
      <mesh position={[0, TUNNEL_H, 0]} rotation={[Math.PI / 2, 0, 0]} material={panel}>
        <planeGeometry args={[TUNNEL_W, TUNNEL_L]} />
      </mesh>
      {/* Panel seams along the walls */}
      {Array.from({ length: 15 }, (_, i) => -TUNNEL_L / 2 + 1 + i * 3).flatMap((z) =>
        [1, -1].map((s) => (
          <mesh key={`${z}${s}`} position={[s * (TUNNEL_W / 2 - 0.01), TUNNEL_H / 2, z]} material={frame}>
            <boxGeometry args={[0.02, TUNNEL_H, 0.04]} />
          </mesh>
        )),
      )}
      {/* Ceiling light strips */}
      {[-4.5, -1.5, 1.5, 4.5].map((x) => (
        <mesh key={x} position={[x, TUNNEL_H - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={lamp}>
          <planeGeometry args={[0.2, TUNNEL_L * 0.8]} />
        </mesh>
      ))}
      {/* Contraction outlet (upstream) with honeycomb flow straightener hint */}
      <mesh position={[0, TUNNEL_H / 2, TUNNEL_L / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[TUNNEL_W, TUNNEL_H]} />
        <meshStandardMaterial color="#0b0c0e" roughness={0.95} />
      </mesh>
    </group>
  )
}
