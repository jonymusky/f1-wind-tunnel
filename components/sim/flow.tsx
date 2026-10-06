"use client"

import { useEffect, useMemo, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { prepareField, sampleVelocity, SPEED_RANGE, turbo, type FieldParams, type Vec3 } from "@/lib/flow-field"
import { createStreamlineMaterial } from "./materials"

export type FlowMode = "streamlines" | "smoke" | "off"

export interface FlowState {
  field: FieldParams
  /** Visual flow speed, m/s */
  speed: number
  running: boolean
  /** Lateral position of the smoke wand, metres */
  smokeX: number
}

const INLET_Z = 5.5
const OUTLET_Z = -8
const SUBSTEPS = 2

const LAYOUT: Record<Exclude<FlowMode, "off">, { count: number; length: number }> = {
  streamlines: { count: 480, length: 40 },
  smoke: { count: 44, length: 140 },
}

export default function Flow({ mode, stateRef }: { mode: Exclude<FlowMode, "off">; stateRef: MutableRefObject<FlowState> }) {
  const { count, length } = LAYOUT[mode]
  const material = useMemo(() => {
    const m = createStreamlineMaterial()
    m.uniforms.uIntensity.value = mode === "smoke" ? 0.7 : 1.15
    return m
  }, [mode])

  const sim = useMemo(() => {
    const positions = new Float32Array(count * length * 3)
    const colors = new Float32Array(count * length * 3)
    const age = new Float32Array(count * length)
    const index = new Uint32Array(count * (length - 1) * 2)
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < length; j++) age[i * length + j] = j / (length - 1)
      for (let j = 0; j < length - 1; j++) {
        const k = (i * (length - 1) + j) * 2
        index[k] = i * length + j
        index[k + 1] = i * length + j + 1
      }
    }
    const geometry = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
    const colAttr = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute("position", posAttr)
    geometry.setAttribute("color", colAttr)
    geometry.setAttribute("age", new THREE.BufferAttribute(age, 1))
    geometry.setIndex(new THREE.BufferAttribute(index, 1))
    // Trails move every frame; skip culling instead of recomputing bounds
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 20)
    return { geometry, positions, colors, posAttr, colAttr, head: new Float32Array(count * 3) }
  }, [count, length])

  useEffect(() => () => sim.geometry.dispose(), [sim])
  useEffect(() => () => material.dispose(), [material])

  // Seeding: streamlines fill the region around the car, biased low where the
  // interesting flow is; smoke comes from a vertical wand like a real tunnel.
  const seed = (i: number, out: Vec3, scatterZ: boolean) => {
    const s = stateRef.current
    if (mode === "smoke") {
      const row = i / (count - 1)
      out.x = s.smokeX + (Math.random() - 0.5) * 0.004
      out.y = 0.01 + row * 1.3
      out.z = INLET_Z - 1.5
    } else {
      const r = Math.random()
      if (r < 0.07) {
        // Thin layer that feeds the underfloor channel
        out.x = (Math.random() - 0.5) * 1.6
        out.y = 0.004 + Math.random() * Math.max(0.01, s.field.rideHeight - 0.006)
      } else {
        const u = Math.random() * 2 - 1
        out.x = Math.sign(u) * Math.abs(u) ** 1.3 * 1.25
        out.y = 0.01 + Math.random() ** 1.5 * 1.2
      }
      out.z = scatterZ ? OUTLET_Z + Math.random() * (INLET_Z - OUTLET_Z) : INLET_Z + Math.random() * 0.6
    }
  }

  const reset = useMemo(() => {
    return () => {
      const p: Vec3 = { x: 0, y: 0, z: 0 }
      for (let i = 0; i < count; i++) {
        seed(i, p, mode === "streamlines")
        sim.head[i * 3] = p.x
        sim.head[i * 3 + 1] = p.y
        sim.head[i * 3 + 2] = p.z
        for (let j = 0; j < length; j++) {
          const k = (i * length + j) * 3
          sim.positions[k] = p.x
          sim.positions[k + 1] = p.y
          sim.positions[k + 2] = p.z
          sim.colors[k] = sim.colors[k + 1] = sim.colors[k + 2] = 0
        }
      }
      sim.posAttr.needsUpdate = true
      sim.colAttr.needsUpdate = true
    }
    // seed reads from refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, count, length, mode])

  useEffect(() => reset(), [reset])

  const scratch = useMemo(() => ({ v: { x: 0, y: 0, z: 0 } as Vec3, p: { x: 0, y: 0, z: 0 } as Vec3, rgb: [0, 0, 0] as [number, number, number] }), [])

  useFrame((state, delta) => {
    const s = stateRef.current
    if (!s.running) return
    const dt = Math.min(delta, 1 / 30)
    const t = state.clock.elapsedTime
    const field = prepareField(s.field)
    const h = (dt * s.speed) / SUBSTEPS
    const { positions, colors, head } = sim
    const { v, p, rgb } = scratch
    const stride = length * 3
    const [lo, hi] = SPEED_RANGE

    for (let i = 0; i < count; i++) {
      let x = head[i * 3]
      let y = head[i * 3 + 1]
      let z = head[i * 3 + 2]
      let speed = 1
      for (let k = 0; k < SUBSTEPS; k++) {
        // Midpoint (RK2) integration keeps trails smooth around curved bodies
        sampleVelocity(x, y, z, t, field, v)
        const mx = x + v.x * h * 0.5
        const my = y + v.y * h * 0.5
        const mz = z + v.z * h * 0.5
        sampleVelocity(mx, my, mz, t, field, v)
        x += v.x * h
        y += v.y * h
        z += v.z * h
        speed = Math.hypot(v.x, v.y, v.z)
      }
      if (y < 0.003) y = 0.003

      const base = i * stride
      // Shift the trail back by one sample
      positions.copyWithin(base + 3, base, base + stride - 3)
      colors.copyWithin(base + 3, base, base + stride - 3)

      const out = z < OUTLET_Z || Math.abs(x) > 3.2 || y > 2.6
      if (out) {
        seed(i, p, false)
        x = p.x
        y = p.y
        z = p.z
        // Black (invisible under additive blending) on both ends of the jump
        colors[base + 3] = colors[base + 4] = colors[base + 5] = 0
        colors[base] = colors[base + 1] = colors[base + 2] = 0
      } else if (mode === "smoke") {
        const shade = 0.75 + 0.25 * Math.min(1, speed)
        colors[base] = shade
        colors[base + 1] = shade
        colors[base + 2] = shade * 1.04
      } else {
        turbo((speed - lo) / (hi - lo), rgb)
        colors[base] = rgb[0]
        colors[base + 1] = rgb[1]
        colors[base + 2] = rgb[2]
      }
      positions[base] = x
      positions[base + 1] = y
      positions[base + 2] = z
      head[i * 3] = x
      head[i * 3 + 1] = y
      head[i * 3 + 2] = z
    }
    sim.posAttr.needsUpdate = true
    sim.colAttr.needsUpdate = true
  })

  return <lineSegments geometry={sim.geometry} material={material} frustumCulled={false} renderOrder={2} />
}
