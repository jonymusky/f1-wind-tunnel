// Analytic velocity field around the car, normalised to the free stream (|U∞| = 1).
//
// This is not a Navier–Stokes solve: it composes the effects you'd see in a
// tunnel smoke test — flow deflecting around the body, stagnation ahead of
// blunt faces, acceleration under the floor, wing upwash/downwash, tip
// vortices and a turbulent wake — and drives them from the same component
// loadings the force model uses, so what you see tracks the numbers.

import { CAR } from "./car-dimensions"

export interface FieldParams {
  /** Turntable yaw, radians */
  yaw: number
  /** Ride height, metres */
  rideHeight: number
  floorLoad: number
  frontWingLoad: number
  rearWingLoad: number
  straight: boolean
}

interface Ellipsoid {
  c: [number, number, number]
  r: [number, number, number]
}

interface Vortex {
  x: number
  y: number
  z0: number
  gamma: number
  core: number
  decay: number
}

// Body volumes in car-local coordinates (floor underside at y = 0, nose at +z)
const BODY: Ellipsoid[] = [
  { c: [0, 0.2, 1.95], r: [0.15, 0.11, 0.85] }, // nose
  { c: [0, 0.38, 0.55], r: [0.32, 0.27, 1.05] }, // monocoque / cockpit
  { c: [0, 0.6, -0.45], r: [0.17, 0.36, 0.95] }, // airbox / engine cover
  { c: [0, 0.34, -1.1], r: [0.26, 0.22, 1.0] }, // gearbox
  { c: [0.5, 0.34, -0.25], r: [0.25, 0.2, 1.0] }, // sidepods
  { c: [-0.5, 0.34, -0.25], r: [0.25, 0.2, 1.0] },
  { c: [0, 0.018, -0.3], r: [0.9, 0.022, 1.55] }, // floor
  { c: [0, 0.7, 0.2], r: [0.13, 0.14, 0.15] }, // helmet
]

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface PreparedField {
  params: FieldParams
  wheels: Ellipsoid[]
  vortices: Vortex[]
}

/** Precomputes the per-frame parts of the field (wheel positions, vortex strengths) */
export function prepareField(p: FieldParams): PreparedField {
  const h = p.rideHeight
  // Wheels: rotating cylinders approximated as ellipsoids, centre follows ride height
  const wheelY = CAR.tyreRadius - h
  const wheels: Ellipsoid[] = [
    { c: [CAR.frontTrack, wheelY, CAR.frontAxle], r: [CAR.frontTyreWidth * 0.6, CAR.tyreRadius, CAR.tyreRadius] },
    { c: [-CAR.frontTrack, wheelY, CAR.frontAxle], r: [CAR.frontTyreWidth * 0.6, CAR.tyreRadius, CAR.tyreRadius] },
    { c: [CAR.rearTrack, wheelY, CAR.rearAxle], r: [CAR.rearTyreWidth * 0.6, CAR.tyreRadius, CAR.tyreRadius] },
    { c: [-CAR.rearTrack, wheelY, CAR.rearAxle], r: [CAR.rearTyreWidth * 0.6, CAR.tyreRadius, CAR.tyreRadius] },
  ]


  // Vortices (axis along z), each spun up by the surface that sheds it
  const vortices: Vortex[] = [
    // Front wing endplates
    { x: 0.88, y: 0.24, z0: CAR.frontWingZ - 0.5, gamma: -0.06 * (0.3 + p.frontWingLoad), core: 0.06, decay: 5 },
    { x: -0.88, y: 0.24, z0: CAR.frontWingZ - 0.5, gamma: 0.06 * (0.3 + p.frontWingLoad), core: 0.06, decay: 5 },
    // Y250 (inboard front wing)
    { x: 0.26, y: 0.12, z0: CAR.frontWingZ - 0.4, gamma: 0.04 * (0.3 + p.frontWingLoad), core: 0.05, decay: 3 },
    { x: -0.26, y: 0.12, z0: CAR.frontWingZ - 0.4, gamma: -0.04 * (0.3 + p.frontWingLoad), core: 0.05, decay: 3 },
    // Floor edges
    { x: 0.9, y: 0.03, z0: 0.9, gamma: 0.035 * p.floorLoad, core: 0.05, decay: 3 },
    { x: -0.9, y: 0.03, z0: 0.9, gamma: -0.035 * p.floorLoad, core: 0.05, decay: 3 },
    // Rear wing tips
    { x: 0.5, y: 0.95, z0: CAR.rearWingZ - 0.35, gamma: -0.1 * (0.15 + p.rearWingLoad), core: 0.07, decay: 9 },
    { x: -0.5, y: 0.95, z0: CAR.rearWingZ - 0.35, gamma: 0.1 * (0.15 + p.rearWingLoad), core: 0.07, decay: 9 },
  ]
  return { params: p, wheels, vortices }
}

/**
 * Writes the velocity at world position (px, py, pz) into `out`.
 * The car sits at the origin, rotated by yaw on the turntable; the tunnel
 * flow always runs along -z in world space.
 */
export function sampleVelocity(px: number, py: number, pz: number, t: number, f: PreparedField, out: Vec3) {
  const p = f.params
  const cy = Math.cos(p.yaw)
  const sy = Math.sin(p.yaw)
  const h = p.rideHeight

  // World → car-local (rotate by -yaw, drop ride height)
  const x = px * cy - pz * sy
  const z = px * sy + pz * cy
  const y = py - h

  // Free stream in car-local frame
  let vx = -sy
  let vy = 0
  let vz = -cy
  // Unit free-stream direction (for stagnation tests)
  const ux = vx
  const uz = vz

  let speed = 1

  const deflect = (e: Ellipsoid) => {
    const dx = x - e.c[0]
    const dy = y - e.c[1]
    const dz = z - e.c[2]
    const qx = dx / e.r[0]
    const qy = dy / e.r[1]
    const qz = dz / e.r[2]
    const s = Math.sqrt(qx * qx + qy * qy + qz * qz)
    if (s > 2.2) return
    const minR = Math.min(e.r[0], e.r[1], e.r[2])
    const d = (s - 1) * minR
    let nx = dx / (e.r[0] * e.r[0])
    let ny = dy / (e.r[1] * e.r[1])
    let nz = dz / (e.r[2] * e.r[2])
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl
    ny /= nl
    nz /= nl
    const delta = Math.min(0.16, Math.max(0.05, minR * 0.6))
    const w = d <= 0 ? 1 : Math.exp(-d / delta)
    const vn = vx * nx + vy * ny + vz * nz
    if (vn < 0) {
      vx -= nx * vn * w
      vy -= ny * vn * w
      vz -= nz * vn * w
    }
    if (d < 0) {
      // Inside the body: push out firmly
      const push = 0.6 + (2 * -d) / minR
      vx += nx * push
      vy += ny * push
      vz += nz * push
    }
    const facing = nx * ux + nz * uz // < 0 on faces pointing into the flow
    if (facing < 0) speed *= 1 - 0.75 * w * facing * facing
    else speed *= 1 + 0.32 * w * (1 - Math.abs(facing))
  }

  for (const e of BODY) deflect(e)
  for (const e of f.wheels) deflect(e)

  const ax = Math.abs(x)

  // Underfloor: the channel between floor and ground accelerates hard
  if (y < 0.01 && ax < 0.85 && z < 1.25 && z > -1.9) {
    const k = smooth(1.25, 0.8, z) * smooth(0.85, 0.7, ax)
    speed *= 1 + k * (0.35 + 0.95 * p.floorLoad)
  }

  // Diffuser expansion: flow kicks upward behind the floor
  if (z < -1.3 && z > -3.5 && ax < 0.65 && y < 0.6) {
    const k = smooth(-1.3, -1.9, z) * Math.exp((z + 1.9) / 1.4) * smooth(0.65, 0.4, ax) * smooth(0.6, 0.1, y)
    vy += k * (0.12 + 0.3 * p.floorLoad)
    speed *= 1 + 0.25 * k * p.floorLoad
  }

  // Front wing: downwash ahead, upwash behind, faster air under the elements
  {
    const zc = CAR.frontWingZ - 0.2
    const env = smooth(1.0, 0.85, ax) * Math.exp(-(((y - 0.13) / 0.2) ** 2))
    if (env > 0.001) {
      const dz = z - zc
      const k = (0.04 + 0.12 * p.frontWingLoad) * env
      vy += (-k * dz) / (dz * dz + 0.05)
      if (Math.abs(dz) < 0.35) {
        speed *= y < 0.13 ? 1 + 0.45 * p.frontWingLoad * env : 1 - 0.25 * p.frontWingLoad * env
      }
      // Outwash around the endplates
      if (ax > 0.55 && dz < 0.2) vx += Math.sign(x) * 0.18 * p.frontWingLoad * env * Math.exp(dz / 1.2)
    }
  }

  // Rear wing + beam wing: strong upwash that persists downstream
  {
    const zc = CAR.rearWingZ - 0.15
    const env = smooth(0.62, 0.45, ax) * Math.exp(-(((y - 0.82) / 0.32) ** 2))
    if (env > 0.001) {
      const dz = z - zc
      const k = (0.03 + 0.16 * p.rearWingLoad) * env
      vy += (-k * dz) / (dz * dz + 0.06)
      if (dz < 0) vy += (0.05 + 0.32 * p.rearWingLoad) * env * Math.exp(dz / 3)
      if (Math.abs(dz) < 0.3) {
        speed *= y < 0.82 ? 1 + 0.4 * p.rearWingLoad * env : 1 - 0.3 * p.rearWingLoad * env
      }
    }
  }

  for (const v of f.vortices) {
    if (z > v.z0 + 0.3) continue
    const along = v.z0 - z
    // Vortex cores drift upward behind the rear wing with the upwash
    const yCore = v.y + (v.z0 < 0 ? along * 0.05 * (0.3 + p.rearWingLoad) : 0)
    const dx = x - v.x
    const dy = y - yCore
    const r2 = dx * dx + dy * dy
    if (r2 > 0.36) continue
    const k = (v.gamma * smooth(0.3, 0, -along) * Math.exp(-Math.max(0, along) / v.decay)) / (r2 + v.core * v.core)
    vx += -dy * k
    vy += dx * k
  }

  // Wake: velocity deficit and unsteady turbulence behind the car and wheels
  const tailZ = CAR.rearWingZ - 0.3
  if (z < tailZ) {
    const dzw = tailZ - z
    const env = smooth(1.0, 0.5, ax) * smooth(1.25, 0.8, y)
    const k = env * Math.exp(-dzw / 5)
    if (k > 0.001) {
      speed *= 1 - 0.5 * k
      const a = 0.22 * k
      vx += a * Math.sin(x * 9.1 + t * 6.3 + z * 2.1) * Math.cos(y * 7.3 - t * 4.1)
      vy += a * Math.sin(y * 8.7 + t * 5.7 - z * 1.7) * Math.cos(x * 6.1 + t * 3.3)
    }
  }
  for (const wz of [CAR.frontAxle, CAR.rearAxle]) {
    const track = wz > 0 ? CAR.frontTrack : CAR.rearTrack
    const behind = wz - CAR.tyreRadius - z
    if (behind > 0 && behind < 3 && Math.abs(ax - track) < 0.3 && y < 0.75) {
      const k = Math.exp(-behind / 1.2) * smooth(0.3, 0.1, Math.abs(ax - track))
      speed *= 1 - 0.4 * k
      vx += 0.15 * k * Math.sin(t * 7 + z * 4 + y * 5)
      vy += 0.15 * k * Math.cos(t * 6 + z * 3 + x * 5)
    }
  }

  // Normalise direction, apply speed scaling
  const len = Math.hypot(vx, vy, vz) || 1
  const mag = speed * Math.min(1.6, Math.max(0.7, len))
  vx = (vx / len) * mag
  vy = (vy / len) * mag
  vz = (vz / len) * mag

  // Rolling road moves with the flow: no ground boundary layer, just no-penetration
  if (py < 0.006 && vy < 0) vy = 0

  // Car-local → world
  out.x = vx * cy + vz * sy
  out.y = vy
  out.z = -vx * sy + vz * cy
}

/** Turbo colormap (Google, polynomial fit), x in [0, 1] → sRGB [0, 1] */
export function turbo(x: number, out: [number, number, number] = [0, 0, 0]) {
  const t = Math.min(1, Math.max(0, x))
  const t2 = t * t
  const t3 = t2 * t
  const t4 = t3 * t
  const t5 = t4 * t
  out[0] = 0.13572138 + 4.6153926 * t - 42.66032258 * t2 + 132.13108234 * t3 - 152.94239396 * t4 + 59.28637943 * t5
  out[1] = 0.09140261 + 2.19418839 * t + 4.84296658 * t2 - 14.18503333 * t3 + 4.27729857 * t4 + 2.82956604 * t5
  out[2] = 0.1066733 + 12.64194608 * t - 60.58204836 * t2 + 110.36276771 * t3 - 89.90310912 * t4 + 27.34824973 * t5
  out[0] = Math.min(1, Math.max(0, out[0]))
  out[1] = Math.min(1, Math.max(0, out[1]))
  out[2] = Math.min(1, Math.max(0, out[2]))
  return out
}

/** Velocity ratio range mapped onto the colour scale */
export const SPEED_RANGE: [number, number] = [0.3, 1.6]
