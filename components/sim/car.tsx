"use client"

import { createContext, useContext, useEffect, useMemo, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import { CAR } from "@/lib/car-dimensions"
import { PART_BY_ID, type PartId } from "@/lib/parts"
import { floorGeometry, loftGeometry, plateGeometry, tubeGeometry, tyreGeometry, wingGeometry } from "./geometry"
import { createPressureMaterial } from "./materials"

export interface CarPose {
  frontWing: number
  rearWing: number
  /** metres */
  rideHeight: number
  /** degrees */
  rake: number
  /** degrees */
  yaw: number
  straight: boolean
  pressure: boolean
  floorLoad: number
  wingLoad: number
}

interface CarProps {
  pose: CarPose
  /** Visual flow speed in m/s, drives wheel spin */
  flowSpeedRef: MutableRefObject<number>
  /** 0 = assembled, 1 = fully exploded */
  explode: number
  selected: PartId | null
  hovered: PartId | null
  onSelect: (id: PartId | null) => void
  onHover: (id: PartId | null) => void
}

const deg = THREE.MathUtils.degToRad
const damp = THREE.MathUtils.damp

function useCarMaterials() {
  return useMemo(() => {
    const paint = new THREE.MeshPhysicalMaterial({
      color: "#c9ccd2",
      metalness: 0.55,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    })
    const accent = new THREE.MeshPhysicalMaterial({
      color: "#d4140b",
      metalness: 0.2,
      roughness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    })
    const carbon = new THREE.MeshPhysicalMaterial({
      color: "#15171a",
      metalness: 0.3,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    })
    const tyre = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
    const rim = new THREE.MeshStandardMaterial({ color: "#2a2c30", roughness: 0.35, metalness: 0.9 })
    const compound = new THREE.MeshStandardMaterial({ color: "#f2c200", roughness: 0.6, side: THREE.DoubleSide })
    const visor = new THREE.MeshPhysicalMaterial({ color: "#050608", roughness: 0.05, metalness: 0.5, clearcoat: 1 })
    const helmet = new THREE.MeshPhysicalMaterial({ color: "#f4f4f4", roughness: 0.3, clearcoat: 1 })
    const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.15, 0.1), toneMapped: false })
    const opening = new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.9 })
    const pressureBody = createPressureMaterial(false)
    const pressureWing = createPressureMaterial(true)
    return { paint, accent, carbon, tyre, rim, compound, visor, helmet, light, opening, pressureBody, pressureWing }
  }, [])
}

function useCarGeometry() {
  return useMemo(() => {
    // One continuous body profile, split into nose / tub / gearbox so they can separate
    const bodyKeys = [
      { z: 2.76, w: 0.08, h: 0.05, y: 0.17, n: 2.2 },
      { z: 2.5, w: 0.19, h: 0.11, y: 0.19 },
      { z: 2.1, w: 0.27, h: 0.17, y: 0.22 },
      { z: 1.6, w: 0.34, h: 0.25, y: 0.27, n: 2.6 },
      { z: 1.1, w: 0.46, h: 0.38, y: 0.33, n: 2.8 },
      { z: 0.7, w: 0.56, h: 0.48, y: 0.37, n: 3 },
      { z: 0.2, w: 0.6, h: 0.52, y: 0.38, n: 3 },
      { z: -0.4, w: 0.52, h: 0.5, y: 0.37, n: 3 },
      { z: -1.0, w: 0.36, h: 0.38, y: 0.33, n: 2.8 },
      { z: -1.6, w: 0.24, h: 0.26, y: 0.3, n: 2.6 },
      { z: -2.05, w: 0.14, h: 0.16, y: 0.3 },
      { z: -2.2, w: 0.08, h: 0.08, y: 0.3 },
    ]
    const nose = loftGeometry(bodyKeys.slice(0, 4))
    const tub = loftGeometry(bodyKeys.slice(3, 8))
    const gearbox = loftGeometry(bodyKeys.slice(7))
    const engineCover = loftGeometry([
      { z: 0.05, w: 0.22, h: 0.26, y: 0.76, n: 2.6 },
      { z: -0.2, w: 0.26, h: 0.34, y: 0.76, n: 2.8 },
      { z: -0.65, w: 0.28, h: 0.36, y: 0.66, n: 3 },
      { z: -1.15, w: 0.22, h: 0.26, y: 0.52, n: 2.8 },
      { z: -1.65, w: 0.12, h: 0.12, y: 0.42 },
      { z: -1.9, w: 0.04, h: 0.05, y: 0.37 },
    ])
    const sidepod = (sign: number) =>
      loftGeometry([
        { z: 0.72, x: sign * 0.5, w: 0.26, h: 0.2, y: 0.42, n: 3.2 },
        { z: 0.5, x: sign * 0.52, w: 0.34, h: 0.3, y: 0.39, n: 3.4 },
        { z: 0.05, x: sign * 0.52, w: 0.36, h: 0.3, y: 0.36, n: 3.4 },
        { z: -0.5, x: sign * 0.46, w: 0.3, h: 0.24, y: 0.3, n: 3 },
        { z: -1.05, x: sign * 0.36, w: 0.2, h: 0.16, y: 0.24, n: 2.8 },
        { z: -1.5, x: sign * 0.26, w: 0.08, h: 0.06, y: 0.2 },
      ])
    const inlet = (sign: number) =>
      loftGeometry(
        [
          { z: 0.735, x: sign * 0.5, w: 0.2, h: 0.14, y: 0.42, n: 3.2 },
          { z: 0.7, x: sign * 0.5, w: 0.2, h: 0.14, y: 0.42, n: 3.2 },
        ],
        32,
        1,
      )
    const airboxInlet = loftGeometry(
      [
        { z: 0.07, w: 0.15, h: 0.17, y: 0.78, n: 2.4 },
        { z: 0.03, w: 0.15, h: 0.17, y: 0.78, n: 2.4 },
      ],
      32,
      1,
    )
    const floor = floorGeometry(
      [
        [-0.42, 1.32],
        [0.42, 1.32],
        [0.82, 1.0],
        [0.92, 0.7],
        [0.92, -1.2],
        [0.63, -1.45],
        [0.56, -1.95],
        [-0.56, -1.95],
        [-0.63, -1.45],
        [-0.92, -1.2],
        [-0.92, 0.7],
        [-0.82, 1.0],
      ],
      0.025,
    )
    const sharkFin = plateGeometry(
      [
        [-0.45, 0.88],
        [-1.75, 0.62],
        [-1.85, 0.4],
        [-1.0, 0.45],
      ],
      0.008,
    )
    const frontEndplate = plateGeometry(
      [
        [2.8, 0.02],
        [2.8, 0.16],
        [2.6, 0.29],
        [2.24, 0.31],
        [2.16, 0.24],
        [2.2, 0.02],
      ],
      0.012,
    )
    const nosePylon = plateGeometry(
      [
        [2.62, 0.07],
        [2.62, 0.18],
        [2.32, 0.21],
        [2.28, 0.07],
      ],
      0.012,
    )
    const rearEndplate = plateGeometry(
      [
        [-1.92, 0.34],
        [-1.94, 0.86],
        [-2.02, 1.0],
        [-2.48, 1.0],
        [-2.54, 0.88],
        [-2.46, 0.34],
      ],
      0.014,
    )
    const swanNeck = plateGeometry(
      [
        [-2.0, 0.3],
        [-2.08, 0.55],
        [-2.12, 0.86],
        [-2.2, 0.86],
        [-2.22, 0.55],
        [-2.16, 0.3],
      ],
      0.02,
    )
    const diffuserStrake = plateGeometry(
      [
        [-1.35, 0.025],
        [-2.0, 0.025],
        [-2.05, 0.3],
        [-1.95, 0.3],
      ],
      0.008,
    )
    const halo = tubeGeometry(
      [
        [-0.24, 0.62, -0.08],
        [-0.25, 0.77, 0.12],
        [-0.17, 0.82, 0.42],
        [0, 0.825, 0.53],
        [0.17, 0.82, 0.42],
        [0.25, 0.77, 0.12],
        [0.24, 0.62, -0.08],
      ],
      0.022,
    )
    const haloPillar = tubeGeometry(
      [
        [0, 0.825, 0.53],
        [0, 0.76, 0.66],
        [0, 0.64, 0.74],
      ],
      0.022,
      16,
    )
    return {
      nose,
      tub,
      gearbox,
      engineCover,
      sidepodL: sidepod(1),
      sidepodR: sidepod(-1),
      inletL: inlet(1),
      inletR: inlet(-1),
      airboxInlet,
      floor,
      sharkFin,
      frontEndplate,
      nosePylon,
      rearEndplate,
      swanNeck,
      diffuserStrake,
      halo,
      haloPillar,
      fwMain: wingGeometry(CAR.frontWingSpan, 0.28, 0.1, 0.05),
      fwFlap1: wingGeometry(CAR.frontWingSpan - 0.12, 0.2, 0.1, 0.06),
      fwFlap2: wingGeometry(CAR.frontWingSpan - 0.24, 0.15, 0.1, 0.06),
      rwMain: wingGeometry(CAR.rearWingSpan, 0.3, 0.11, 0.07),
      rwFlap: wingGeometry(CAR.rearWingSpan, 0.2, 0.1, 0.06),
      beamWing: wingGeometry(0.82, 0.16, 0.12, 0.05),
      frontTyre: tyreGeometry(CAR.tyreRadius, CAR.rimRadius, CAR.frontTyreWidth),
      rearTyre: tyreGeometry(CAR.tyreRadius, CAR.rimRadius, CAR.rearTyreWidth),
    }
  }, [])
}

/** Thin cylinder between two points (suspension members) */
function Strut({ a, b, r = 0.012, material }: { a: THREE.Vector3Tuple; b: THREE.Vector3Tuple; r?: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    return { position: va.add(vb).multiplyScalar(0.5), quaternion: q, length: dir.length() }
  }, [a, b])
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[r, r, length, 8]} />
    </mesh>
  )
}

function Wheel({
  side,
  front,
  tyreGeo,
  mats,
  spinRef,
}: {
  side: 1 | -1
  front: boolean
  tyreGeo: THREE.BufferGeometry
  mats: ReturnType<typeof useCarMaterials>
  spinRef: MutableRefObject<THREE.Group[]>
}) {
  const width = front ? CAR.frontTyreWidth : CAR.rearTyreWidth
  const register = (g: THREE.Group | null) => {
    if (g && !spinRef.current.includes(g)) spinRef.current.push(g)
  }
  return (
    <group ref={register}>
      <mesh geometry={tyreGeo} material={mats.tyre} castShadow />
      {/* Rim barrel and outer face */}
      <mesh rotation={[0, 0, Math.PI / 2]} material={mats.rim}>
        <cylinderGeometry args={[CAR.rimRadius, CAR.rimRadius, width * 0.9, 40, 1, true]} />
      </mesh>
      <mesh position={[side * width * 0.42, 0, 0]} rotation={[0, (side * Math.PI) / 2, 0]} material={mats.rim}>
        <circleGeometry args={[CAR.rimRadius, 40]} />
      </mesh>
      {/* Spokes, so the rotation reads */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[side * width * 0.44, 0, 0]}
          rotation={[(i / 5) * Math.PI * 2, 0, 0]}
          material={mats.carbon}
        >
          <boxGeometry args={[0.01, CAR.rimRadius * 1.9, 0.035]} />
        </mesh>
      ))}
      <mesh position={[side * width * 0.46, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.accent}>
        <cylinderGeometry args={[0.03, 0.03, 0.03, 16]} />
      </mesh>
      {/* Compound band on the sidewall */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * width * 0.515, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]} material={mats.compound}>
          <ringGeometry args={[0.27, 0.283, 64]} />
        </mesh>
      ))}
    </group>
  )
}

interface PartsContext {
  explode: MutableRefObject<number>
  selected: PartId | null
  hovered: PartId | null
  labels: boolean
  onSelect: (id: PartId | null) => void
  onHover: (id: PartId | null) => void
}

const PartsCtx = createContext<PartsContext | null>(null)

const highlightCache = { strong: new WeakMap<THREE.Material, THREE.Material>(), soft: new WeakMap<THREE.Material, THREE.Material>() }
function highlighted(m: THREE.Material, strong: boolean) {
  if (!(m instanceof THREE.MeshStandardMaterial)) return m
  const cache = strong ? highlightCache.strong : highlightCache.soft
  let h = cache.get(m)
  if (!h) {
    const c = m.clone()
    c.emissive = new THREE.Color("#ff2a1a")
    c.emissiveIntensity = strong ? 0.5 : 0.22
    h = c
    cache.set(m, h)
  }
  return h
}

/**
 * A named component of the car: moves out along its explode vector,
 * highlights on hover/selection and carries its label in the exploded view.
 */
function Part({
  id,
  mirror = 1,
  label = true,
  children,
}: {
  id: PartId
  mirror?: 1 | -1
  label?: boolean
  children: React.ReactNode
}) {
  const ctx = useContext(PartsCtx)!
  const group = useRef<THREE.Group>(null)
  const info = PART_BY_ID[id]
  const [ex, ey, ez] = info.explode

  useFrame(() => {
    const e = ctx.explode.current
    group.current?.position.set(ex * mirror * e, ey * e, ez * e)
  })

  const isSelected = ctx.selected === id
  const isHovered = ctx.hovered === id

  // Swap in emissive copies of the materials while highlighted
  useEffect(() => {
    const g = group.current
    if (!g) return
    const swapped: [THREE.Mesh, THREE.Material, THREE.Material][] = []
    if (isSelected || isHovered) {
      g.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh || Array.isArray(mesh.material)) return
        const h = highlighted(mesh.material, isSelected)
        swapped.push([mesh, mesh.material, h])
        mesh.material = h
      })
    }
    return () => {
      // Only undo our swap; React may already have applied a new material (e.g. pressure view)
      for (const [mesh, original, h] of swapped) if (mesh.material === h) mesh.material = original
    }
  })

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation()
        ctx.onHover(id)
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        ctx.onHover(null)
        document.body.style.cursor = ""
      }}
      onClick={(e) => {
        if (e.delta > 4) return // was an orbit drag
        e.stopPropagation()
        ctx.onSelect(isSelected ? null : id)
      }}
    >
      {children}
      {label && ctx.labels && (
        <Html position={[info.anchor[0] * mirror, info.anchor[1], info.anchor[2]]} zIndexRange={[5, 0]} center>
          <button
            data-part-label
            onClick={() => ctx.onSelect(isSelected ? null : id)}
            onPointerEnter={() => ctx.onHover(id)}
            onPointerLeave={() => ctx.onHover(null)}
            className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-md transition-colors ${
              isSelected
                ? "border-accent bg-accent text-white"
                : isHovered
                  ? "border-white/30 bg-black/70 text-white"
                  : "border-white/10 bg-black/55 text-ink-2"
            }`}
          >
            {info.name}
          </button>
        </Html>
      )}
    </group>
  )
}

export default function F1Car({ pose, flowSpeedRef, explode, selected, hovered, onSelect, onHover }: CarProps) {
  const mats = useCarMaterials()
  const geo = useCarGeometry()

  const root = useRef<THREE.Group>(null)
  const chassis = useRef<THREE.Group>(null)
  const fwFlap1 = useRef<THREE.Group>(null)
  const fwFlap2 = useRef<THREE.Group>(null)
  const rwMain = useRef<THREE.Group>(null)
  const rwFlap = useRef<THREE.Group>(null)
  const wheelSpin = useRef<THREE.Group[]>([])
  const wheelMounts = useRef<(THREE.Group | null)[]>([])
  const rainLight = useRef<THREE.Mesh>(null)
  const explodeAmt = useRef(0)

  const p = pose
  const body = p.pressure ? mats.pressureBody : mats.paint
  const trim = p.pressure ? mats.pressureBody : mats.carbon
  const accent = p.pressure ? mats.pressureBody : mats.accent
  const wing = p.pressure ? mats.pressureWing : mats.carbon
  const wingAccent = p.pressure ? mats.pressureWing : mats.accent

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05)
    explodeAmt.current = damp(explodeAmt.current, explode, 5, d)
    const e = explodeAmt.current
    // Smoothly animate pose changes rather than snapping
    if (root.current) {
      root.current.rotation.y = damp(root.current.rotation.y, deg(p.yaw), 6, d)
      // Lift the car when exploded so the floor can drop clear of the road
      root.current.position.y = damp(root.current.position.y, p.rideHeight + 0.75 * explode, 6, d)
    }
    const rake = deg(p.rake) * (1 - e)
    if (chassis.current) chassis.current.rotation.x = damp(chassis.current.rotation.x, rake, 6, d)

    // Front flaps follow the setting; in straight mode they unload
    const f1 = p.straight ? 5 : 7 + p.frontWing * 0.55
    const f2 = p.straight ? 8 : 12 + p.frontWing * 1.0
    if (fwFlap1.current) fwFlap1.current.rotation.x = damp(fwFlap1.current.rotation.x, deg(f1), 8, d)
    if (fwFlap2.current) fwFlap2.current.rotation.x = damp(fwFlap2.current.rotation.x, deg(f2), 8, d)
    // Rear: main plane angle from the setting, flap opens flat in straight mode
    if (rwMain.current) rwMain.current.rotation.x = damp(rwMain.current.rotation.x, deg(2 + p.rearWing * 0.45), 8, d)
    if (rwFlap.current) rwFlap.current.rotation.x = damp(rwFlap.current.rotation.x, deg(p.straight ? -2 : 12 + p.rearWing * 1.1), 10, d)

    // Keep the tyres on the road as ride height / rake change (until exploded)
    const carY = (root.current?.position.y ?? p.rideHeight) - 0.75 * e
    const theta = chassis.current?.rotation.x ?? rake
    wheelMounts.current.forEach((m, i) => {
      if (!m) return
      const z = i < 2 ? CAR.frontAxle : CAR.rearAxle
      m.position.y = CAR.tyreRadius - carY + z * theta
    })

    const spin = (flowSpeedRef.current / CAR.tyreRadius) * d * (1 - e)
    for (const w of wheelSpin.current) w.rotation.x -= spin

    if (rainLight.current) {
      const on = Math.sin(state.clock.elapsedTime * 7) > 0.2
      ;(rainLight.current.material as THREE.MeshBasicMaterial).color.setRGB(on ? 4 : 0.6, on ? 0.15 : 0.02, on ? 0.1 : 0.02)
    }

    mats.pressureBody.uniforms.uFloor.value = p.floorLoad
    mats.pressureWing.uniforms.uFloor.value = p.floorLoad
    mats.pressureWing.uniforms.uWing.value = p.wingLoad
  })

  const ctx: PartsContext = {
    explode: explodeAmt,
    selected,
    hovered,
    labels: explode > 0.3,
    onSelect,
    onHover,
  }

  const wheels: { x: number; z: number; front: boolean; side: 1 | -1 }[] = [
    { x: CAR.frontTrack, z: CAR.frontAxle, front: true, side: 1 },
    { x: -CAR.frontTrack, z: CAR.frontAxle, front: true, side: -1 },
    { x: CAR.rearTrack, z: CAR.rearAxle, front: false, side: 1 },
    { x: -CAR.rearTrack, z: CAR.rearAxle, front: false, side: -1 },
  ]

  return (
    <PartsCtx.Provider value={ctx}>
      <group ref={root} position={[0, p.rideHeight, 0]}>
        <group ref={chassis}>
          <Part id="nose">
            <mesh geometry={geo.nose} material={body} castShadow />
            {[1, -1].map((s) => (
              <mesh key={s} geometry={geo.nosePylon} material={trim} position={[s * 0.09, 0, 0]} />
            ))}
          </Part>

          <Part id="chassis">
            <mesh geometry={geo.tub} material={body} castShadow receiveShadow />
            {/* Cockpit opening + driver */}
            <mesh position={[0, 0.62, 0.3]} scale={[0.2, 0.03, 0.42]} material={mats.opening}>
              <sphereGeometry args={[1, 32, 16]} />
            </mesh>
            <group position={[0, 0.69, 0.18]}>
              <mesh material={mats.helmet} castShadow>
                <sphereGeometry args={[0.125, 32, 24]} />
              </mesh>
              <mesh position={[0, 0.015, 0.06]} scale={[1, 0.38, 0.7]} material={mats.visor}>
                <sphereGeometry args={[0.122, 32, 16]} />
              </mesh>
            </group>
            {/* Mirrors */}
            {[1, -1].map((s) => (
              <group key={s} position={[s * 0.42, 0.6, 0.62]}>
                <mesh material={trim}>
                  <boxGeometry args={[0.13, 0.055, 0.04]} />
                </mesh>
                <Strut a={[-s * 0.1, -0.07, 0]} b={[0, 0, 0]} r={0.008} material={trim} />
              </group>
            ))}
          </Part>

          <Part id="halo">
            <mesh geometry={geo.halo} material={trim} castShadow />
            <mesh geometry={geo.haloPillar} material={trim} castShadow />
          </Part>

          <Part id="sidepods" mirror={1}>
            <mesh geometry={geo.sidepodL} material={body} castShadow />
            <mesh geometry={geo.inletL} material={mats.opening} />
          </Part>
          <Part id="sidepods" mirror={-1} label={false}>
            <mesh geometry={geo.sidepodR} material={body} castShadow />
            <mesh geometry={geo.inletR} material={mats.opening} />
          </Part>

          <Part id="engineCover">
            <mesh geometry={geo.engineCover} material={body} castShadow />
            <mesh geometry={geo.airboxInlet} material={mats.opening} />
            <mesh geometry={geo.sharkFin} material={accent} castShadow />
          </Part>

          <Part id="floor">
            <mesh geometry={geo.floor} material={trim} castShadow receiveShadow />
            <mesh position={[0, 0.16, -1.7]} rotation={[-0.36, 0, 0]} material={trim}>
              <boxGeometry args={[1.08, 0.012, 0.75]} />
            </mesh>
            {[-0.36, -0.12, 0.12, 0.36].map((x) => (
              <mesh key={x} geometry={geo.diffuserStrake} material={trim} position={[x, 0, 0]} />
            ))}
          </Part>

          <Part id="gearbox">
            <mesh geometry={geo.gearbox} material={body} castShadow />
            <mesh ref={rainLight} position={[0, 0.3, -2.215]} material={mats.light}>
              <boxGeometry args={[0.07, 0.04, 0.02]} />
            </mesh>
          </Part>

          <Part id="frontWing">
            <group position={[0, 0.06, CAR.frontWingZ]} rotation={[deg(3), 0, 0]}>
              <mesh geometry={geo.fwMain} material={wing} castShadow />
            </group>
            <group ref={fwFlap1} position={[0, 0.105, 2.46]}>
              <mesh geometry={geo.fwFlap1} material={wing} castShadow />
            </group>
            <group ref={fwFlap2} position={[0, 0.16, 2.31]}>
              <mesh geometry={geo.fwFlap2} material={wingAccent} castShadow />
            </group>
            {[1, -1].map((s) => (
              <mesh key={s} geometry={geo.frontEndplate} material={wingAccent} position={[s * (CAR.frontWingSpan / 2), 0, 0]} castShadow />
            ))}
          </Part>

          <Part id="rearWing">
            <group ref={rwMain} position={[0, 0.8, CAR.rearWingZ]}>
              <mesh geometry={geo.rwMain} material={wing} castShadow />
            </group>
            <group ref={rwFlap} position={[0, 0.9, CAR.rearWingZ - 0.24]}>
              <mesh geometry={geo.rwFlap} material={wingAccent} castShadow />
            </group>
            {[1, -1].map((s) => (
              <mesh key={s} geometry={geo.rearEndplate} material={wingAccent} position={[s * (CAR.rearWingSpan / 2 + 0.01), 0, 0]} castShadow />
            ))}
            <mesh geometry={geo.swanNeck} material={trim} />
          </Part>

          <Part id="beamWing">
            <group position={[0, 0.4, CAR.rearWingZ - 0.02]} rotation={[deg(8), 0, 0]}>
              <mesh geometry={geo.beamWing} material={wing} castShadow />
            </group>
          </Part>

          <Part id="frontSuspension">
            {[1, -1].map((s) => (
              <group key={s}>
                <Strut a={[s * 0.14, 0.38, CAR.frontAxle + 0.18]} b={[s * 0.66, 0.42, CAR.frontAxle]} material={trim} />
                <Strut a={[s * 0.14, 0.38, CAR.frontAxle - 0.28]} b={[s * 0.66, 0.42, CAR.frontAxle]} material={trim} />
                <Strut a={[s * 0.12, 0.2, CAR.frontAxle + 0.22]} b={[s * 0.68, 0.22, CAR.frontAxle]} material={trim} />
                <Strut a={[s * 0.12, 0.2, CAR.frontAxle - 0.32]} b={[s * 0.68, 0.22, CAR.frontAxle]} material={trim} />
              </group>
            ))}
          </Part>
          <Part id="rearSuspension">
            {[1, -1].map((s) => (
              <group key={s}>
                <Strut a={[s * 0.12, 0.38, CAR.rearAxle + 0.3]} b={[s * 0.62, 0.42, CAR.rearAxle]} material={trim} />
                <Strut a={[s * 0.12, 0.38, CAR.rearAxle - 0.15]} b={[s * 0.62, 0.42, CAR.rearAxle]} material={trim} />
                <Strut a={[s * 0.1, 0.18, CAR.rearAxle + 0.3]} b={[s * 0.62, 0.2, CAR.rearAxle]} material={trim} />
                <Strut a={[s * 0.1, 0.18, CAR.rearAxle - 0.2]} b={[s * 0.62, 0.2, CAR.rearAxle]} material={trim} />
              </group>
            ))}
          </Part>

          {wheels.map((w, i) => (
            <Part key={i} id={w.front ? "frontTyres" : "rearTyres"} mirror={w.side} label={w.side === 1}>
              <group
                ref={(g) => {
                  wheelMounts.current[i] = g
                }}
                position={[w.x, CAR.tyreRadius - p.rideHeight, w.z]}
              >
                <Wheel side={w.side} front={w.front} tyreGeo={w.front ? geo.frontTyre : geo.rearTyre} mats={mats} spinRef={wheelSpin} />
              </group>
            </Part>
          ))}
        </group>
      </group>
    </PartsCtx.Provider>
  )
}
