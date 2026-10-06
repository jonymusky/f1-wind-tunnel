// Simplified full-scale aerodynamic model of a current-generation F1 car.
//
// Numbers are tuned to land in publicly reported ranges: CdA ≈ 1.0–1.4 m²,
// ClA ≈ 3.5–5 m², L/D ≈ 3–4, ~40–46% front aero balance, and roughly
// 2× the car's weight in downforce at 300 km/h. It's a teaching model,
// not CFD — each component is a smooth fit, not a solved flow.

export type AeroMode = "corner" | "straight"

export interface AeroConfig {
  /** Free-stream speed, km/h */
  speed: number
  /** Front wing flap angle, degrees */
  frontWing: number
  /** Rear wing angle of attack, degrees */
  rearWing: number
  /** Floor ride height at the reference point, mm */
  rideHeight: number
  /** Rake (rear higher than front), degrees */
  rake: number
  /** Turntable yaw angle (crosswind), degrees */
  yaw: number
  /** Active aero: corner (high downforce) or straight (flaps open) */
  mode: AeroMode
}

export interface AeroResult {
  /** Component downforce areas, m² */
  clA: { floor: number; frontWing: number; rearWing: number; total: number }
  cdA: number
  /** Coefficients against the reference frontal area */
  cl: number
  cd: number
  /** Forces, newtons */
  downforce: number
  drag: number
  sideForce: number
  /** Aero balance, fraction of downforce on the front axle */
  frontBalance: number
  liftToDrag: number
  /** Power absorbed by drag, kW */
  dragPower: number
  /** Downforce / car weight */
  downforceToWeight: number
  /** Speed at which downforce equals the car's weight, km/h */
  invertedSpeed: number
  /** Floor below its stall height — porpoising territory */
  floorStall: boolean
  /** 0–1 floor loading, used by the flow visualisation */
  floorLoad: number
  /** 0–1 wing loadings, used by the flow visualisation */
  frontWingLoad: number
  rearWingLoad: number
}

export const AIR_DENSITY = 1.225 // kg/m³, ISA sea level
export const FRONTAL_AREA = 1.5 // m²
export const CAR_MASS = 800 // kg, minimum mass incl. driver
export const G = 9.81

export const DEFAULT_CONFIG: AeroConfig = {
  speed: 250,
  frontWing: 16,
  rearWing: 22,
  rideHeight: 35,
  rake: 0.6,
  yaw: 0,
  mode: "corner",
}

const STALL_HEIGHT = 24 // mm
const deg = Math.PI / 180

function floorFactor(h: number) {
  // Ground effect: the floor gains load as it approaches the ground, then
  // the diffuser flow separates and load drops off sharply below stall.
  if (h >= STALL_HEIGHT) return 0.62 + 0.6 * Math.exp(-(h - STALL_HEIGHT) / 38)
  const below = STALL_HEIGHT - h
  return Math.max(0.55, 1.22 - 0.022 * Math.pow(below, 1.5))
}

function wingStall(angle: number, stallAngle: number) {
  // Lift falls off progressively once the element passes its stall angle
  if (angle <= stallAngle) return 1
  return Math.max(0.6, 1 - 0.06 * (angle - stallAngle))
}

export function computeAero(cfg: AeroConfig): AeroResult {
  const straight = cfg.mode === "straight"
  const yawRad = cfg.yaw * deg

  // Floor: biggest single contributor; rake pulls load forward and up
  const floorK = floorFactor(cfg.rideHeight)
  const floor = 2.15 * floorK * (1 + 0.12 * cfg.rake)

  // Wings: roughly linear with flap angle until they stall
  let frontWing = (0.32 + 0.046 * cfg.frontWing) * wingStall(cfg.frontWing, 26)
  let rearWing = (0.28 + 0.05 * cfg.rearWing) * wingStall(cfg.rearWing, 32)
  if (straight) {
    frontWing *= 0.55
    rearWing *= 0.3
  }

  // Yaw costs downforce as the floor edges and wings see crossflow
  const yawLoss = Math.cos(yawRad) ** 2 * (1 - 0.012 * Math.abs(cfg.yaw))
  const clTotal = (floor + frontWing + rearWing) * yawLoss

  // Drag: wheels/body baseline plus induced drag from each lifting surface
  const cdBody = 0.6
  const cdFloor = 0.07 * floor
  const cdFront = 0.04 + 0.09 * frontWing ** 2
  const cdRear = 0.05 + 0.17 * rearWing ** 2
  const cdA = (cdBody + cdFloor + cdFront + cdRear) * (1 + 0.004 * cfg.yaw ** 2)

  const v = cfg.speed / 3.6
  const q = 0.5 * AIR_DENSITY * v * v
  const downforce = clTotal * q
  const drag = cdA * q
  const sideForce = 0.085 * cfg.yaw * q

  // Balance: front wing all front, rear wing slightly negative on the front
  // axle (it levers around the rear), floor split shifts forward with rake
  const floorFront = 0.4 + 0.05 * cfg.rake
  const front = frontWing + floor * floorFront - rearWing * 0.08
  const frontBalance = clTotal > 0 ? (front * yawLoss) / clTotal : 0.5

  const weight = CAR_MASS * G
  const invertedV = Math.sqrt((2 * weight) / (AIR_DENSITY * Math.max(clTotal, 0.01)))

  return {
    clA: {
      floor: floor * yawLoss,
      frontWing: frontWing * yawLoss,
      rearWing: rearWing * yawLoss,
      total: clTotal,
    },
    cdA,
    cl: clTotal / FRONTAL_AREA,
    cd: cdA / FRONTAL_AREA,
    downforce,
    drag,
    sideForce,
    frontBalance,
    liftToDrag: drag > 0 ? downforce / drag : clTotal / cdA,
    dragPower: (drag * v) / 1000,
    downforceToWeight: downforce / weight,
    invertedSpeed: invertedV * 3.6,
    floorStall: cfg.rideHeight < STALL_HEIGHT,
    floorLoad: Math.min(1, floor / 3),
    frontWingLoad: Math.min(1, frontWing / 1.6),
    rearWingLoad: Math.min(1, rearWing / 2),
  }
}

export const toKgf = (newtons: number) => newtons / G
