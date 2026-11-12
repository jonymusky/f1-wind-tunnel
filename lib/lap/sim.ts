// Quasi-steady-state lap simulator.
//
// The car is a point mass with two axles. At every point of the racing line
// it is either at the grip limit of one axle, at full throttle (limited by
// power or rear traction), or braking at the limit of the friction ellipse.
// Aero comes from the same model the wind tunnel shows (`computeAero`), with
// one addition: the floor is carried on springs, so ride height falls as
// downforce builds and a car set too low stalls its floor at speed.
//
// Not modelled: elevation and banking, kerbs, tyre temperature and wear,
// transient weight transfer, gear ratios, and hybrid energy deployment (power
// is constant). Lap times land within a few percent of real qualifying laps;
// the *differences* between setups are the trustworthy part.

import { computeAero, G, type AeroConfig } from "../aero"

export type Tyre = "soft" | "medium" | "hard"

export interface CarSpec {
  /** Peak power-unit output, kW */
  power: number
  /** Car plus driver, no fuel, kg */
  mass: number
  /** Fuel on board, kg */
  fuel: number
  tyre: Tyre
  /** What opens on the straights: nothing, the rear flap (DRS, 2011–2025), or both wings (active aero, 2026) */
  straightAero: StraightAero
}

export type StraightAero = "none" | "drs" | "active"

export type Setup = Pick<AeroConfig, "frontWing" | "rearWing" | "rideHeight" | "rake">

export const DEFAULT_SPEC: CarSpec = { power: 710, mass: 800, fuel: 5, tyre: "soft", straightAero: "drs" }

export interface TrackGeometry {
  /** Sample spacing along the racing line, m */
  ds: number
  x: number[]
  y: number[]
  /** Signed curvature, 1/m (positive = left) */
  k: number[]
}

export type Limit = "front" | "rear" | "traction" | "power" | "brake"

export interface LapResult {
  lapTime: number
  /** Per-sample channels, index 0 = start of the data */
  v: Float32Array
  /** Elapsed time at each sample, s */
  t: Float32Array
  /** Longitudinal and lateral acceleration, m/s² (ay signed, positive = left) */
  ax: Float32Array
  ay: Float32Array
  throttle: Float32Array
  brake: Float32Array
  /** Running floor height, mm */
  ride: Float32Array
  /** Aero downforce, N */
  downforce: Float32Array
  straightMode: Uint8Array
  limit: Limit[]
  sectors: [number, number, number]
  topSpeed: number
  minSpeed: number
  maxLateralG: number
  maxBrakingG: number
  fullThrottle: number
  /** Share of the lap spent limited by the front / rear axle */
  understeer: number
  oversteer: number
  /** Lowest running ride height, and whether the floor stalled in a corner */
  minRide: number
  floorStalled: boolean
  /** Share of lap distance spent cornering hard with the floor stalled */
  stallShare: number
}

// ---- vehicle constants (one set for every circuit) ----
export const WEIGHT_FRONT = 0.455 // static weight on the front axle
const WHEELBASE = 3.4 // m
const CG_HEIGHT = 0.28 // m
const MIN_RIDE = 4 // mm, the plank
const ROLLING = 0.013
const FZ_REF = 4000 // N per axle, about the static load
const V_CAP = 120 // m/s, numerical ceiling
const STALL_HEIGHT = 24 // mm, same threshold as lib/aero.ts

/** Calibrated against the 2025 pole laps (scripts/validate-lap.mjs). */
export const PHYSICS = {
  /** N/m: how far aero load squashes the car onto its floor */
  heaveStiffness: 2.1e6,
  driveEfficiency: 0.94,
  /** Grip coefficient at the reference load, by compound */
  mu: { soft: 2.0, medium: 1.965, hard: 1.93 } as Record<Tyre, number>,
  /** Grip coefficient falls as load rises: mu ∝ load^-n */
  loadSensitivity: 0.2,
  /** Share of peak grip usable in a straight-line stop (brake balance, pitch, locking margin) */
  brakeEfficiency: 0.72,
}

export const airDensity = (altitude: number) => 1.225 * Math.pow(1 - 2.2558e-5 * altitude, 4.2559)

interface AeroPoint {
  clA: number
  cdA: number
  balance: number
  ride: number
}

/** Aero coefficients against speed, with the ride height settled under its own load. */
function aeroTable(setup: Setup, mode: AeroConfig["mode"], rho: number): AeroPoint[] {
  const table: AeroPoint[] = []
  for (let v = 0; v <= V_CAP; v++) {
    let ride = setup.rideHeight
    let r = computeAero({ ...setup, rideHeight: ride, yaw: 0, speed: v * 3.6, mode })
    for (let i = 0; i < 14; i++) {
      const load = 0.5 * rho * v * v * r.clA.total
      const target = Math.max(MIN_RIDE, setup.rideHeight - (load / PHYSICS.heaveStiffness) * 1000)
      ride += (target - ride) * 0.5
      r = computeAero({ ...setup, rideHeight: ride, yaw: 0, speed: v * 3.6, mode })
    }
    table.push({ clA: r.clA.total, cdA: r.cdA, balance: r.frontBalance, ride })
  }
  return table
}

function lookup(table: AeroPoint[], v: number): AeroPoint {
  const c = Math.min(V_CAP - 1e-6, Math.max(0, v))
  const i = Math.floor(c)
  const f = c - i
  const a = table[i]
  const b = table[i + 1]
  return {
    clA: a.clA + (b.clA - a.clA) * f,
    cdA: a.cdA + (b.cdA - a.cdA) * f,
    balance: a.balance + (b.balance - a.balance) * f,
    ride: a.ride + (b.ride - a.ride) * f,
  }
}

/** Runs of near-straight track long enough for the flaps to open. */
export function straightZones(track: TrackGeometry): Uint8Array {
  const n = track.k.length
  const zone = new Uint8Array(n)
  const gentle = (i: number) => Math.abs(track.k[i]) < 0.0011
  const minRun = Math.round(200 / track.ds)
  // start scanning from a point that is not gentle so a run never straddles the seam
  let start = 0
  while (start < n && gentle(start)) start++
  if (start === n) return zone.fill(1)
  let run = 0
  for (let j = 1; j <= n; j++) {
    const i = (start + j) % n
    if (gentle(i)) run++
    else {
      if (run >= minRun) for (let b = 1; b <= run; b++) zone[(i - b + n) % n] = 1
      run = 0
    }
  }
  return zone
}

export function simulateLap(track: TrackGeometry, setup: Setup, spec: CarSpec, altitude = 0): LapResult {
  const n = track.k.length
  const ds = track.ds
  const rho = airDensity(altitude)
  const m = spec.mass + spec.fuel
  const weight = m * G
  const mu0 = PHYSICS.mu[spec.tyre]
  const cornerAero = aeroTable(setup, "corner", rho)
  const straightAero = spec.straightAero === "none" ? cornerAero : aeroTable(setup, spec.straightAero === "drs" ? "drs" : "straight", rho)
  const zone = spec.straightAero === "none" ? new Uint8Array(n) : straightZones(track)

  const mu = (load: number) => mu0 * Math.pow(Math.max(load, 1) / FZ_REF, -PHYSICS.loadSensitivity)

  /** Everything the tyres and the air can do at speed v. */
  const state = (v: number, straight: boolean) => {
    const a = lookup(straight ? straightAero : cornerAero, v)
    const q = 0.5 * rho * v * v
    const down = q * a.clA
    const nf = weight * WEIGHT_FRONT + down * a.balance
    const nr = weight * (1 - WEIGHT_FRONT) + down * (1 - a.balance)
    const gripF = mu(nf) * nf
    const gripR = mu(nr) * nr
    const ayF = gripF / (m * WEIGHT_FRONT)
    const ayR = gripR / (m * (1 - WEIGHT_FRONT))
    return { a, down, drag: q * a.cdA, rolling: ROLLING * (weight + down), nr, gripF, gripR, ayMax: Math.min(ayF, ayR), frontLimited: ayF <= ayR }
  }

  // 1. Cornering speed limit at every sample
  const vLim = new Float32Array(n)
  const frontLimited = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const kappa = Math.abs(track.k[i])
    const straight = zone[i] === 1
    const margin = (v: number) => state(v, straight).ayMax - v * v * kappa
    let lo = 5
    let hi = V_CAP
    if (kappa < 1e-5 || margin(V_CAP) >= 0) {
      // Downforce can outrun the demand entirely: scan for a real crossing before trusting that
      let crossed = false
      for (let v = 10; v <= V_CAP && kappa >= 1e-5; v += 5) {
        if (margin(v) < 0) {
          hi = v
          lo = v - 5
          crossed = true
          break
        }
      }
      if (!crossed) {
        vLim[i] = V_CAP
        continue
      }
    } else {
      for (let v = 10; v <= V_CAP; v += 5) {
        if (margin(v) < 0) {
          hi = v
          lo = v - 5
          break
        }
      }
    }
    for (let it = 0; it < 22; it++) {
      const mid = (lo + hi) / 2
      if (margin(mid) >= 0) lo = mid
      else hi = mid
    }
    vLim[i] = lo
    frontLimited[i] = state(lo, straight).frontLimited ? 1 : 0
  }

  const ellipse = (v: number, i: number, ayMax: number) => {
    const used = (v * v * Math.abs(track.k[i])) / ayMax
    return Math.sqrt(Math.max(0, 1 - used * used))
  }

  /** Best forward acceleration at speed v on sample i, and what caps it. */
  const drive = (v: number, i: number) => {
    const s = state(v, zone[i] === 1)
    const e = ellipse(v, i, s.ayMax)
    const muR = s.gripR / s.nr
    const traction = ((s.gripR * e) / (1 - (muR * e * CG_HEIGHT) / WHEELBASE))
    const engine = (spec.power * 1000 * PHYSICS.driveEfficiency) / Math.max(v, 8)
    const force = Math.min(engine, traction)
    return { a: (force - s.drag - s.rolling) / m, tractionLimited: traction < engine, force, engine, s }
  }

  /** Strongest deceleration at speed v on sample i (flaps closed). */
  const brake = (v: number, i: number) => {
    const s = state(v, false)
    return ((s.gripF + s.gripR) * PHYSICS.brakeEfficiency * ellipse(v, i, s.ayMax) + s.drag + s.rolling) / m
  }

  // 2. Forward and backward passes from the slowest corner of the lap
  let i0 = 0
  for (let i = 1; i < n; i++) if (vLim[i] < vLim[i0]) i0 = i
  const vf = new Float32Array(n)
  const vb = new Float32Array(n)
  vf[i0] = vLim[i0]
  vb[i0] = vLim[i0]
  for (let j = 1; j < n; j++) {
    const i = (i0 + j) % n
    const p = (i - 1 + n) % n
    const a = drive(vf[p], p).a
    vf[i] = Math.min(vLim[i], Math.sqrt(Math.max(4, vf[p] * vf[p] + 2 * a * ds)))
  }
  for (let j = 1; j < n; j++) {
    const i = (i0 - j + n) % n
    const nx = (i + 1) % n
    const d = brake(vb[nx], i)
    vb[i] = Math.min(vLim[i], Math.sqrt(vb[nx] * vb[nx] + 2 * d * ds))
  }

  // 3. Channels
  const v = new Float32Array(n)
  for (let i = 0; i < n; i++) v[i] = Math.min(vf[i], vb[i])
  const t = new Float32Array(n)
  const ax = new Float32Array(n)
  const ay = new Float32Array(n)
  const throttle = new Float32Array(n)
  const brakeCh = new Float32Array(n)
  const ride = new Float32Array(n)
  const downforce = new Float32Array(n)
  const straightMode = new Uint8Array(n)
  const limit: Limit[] = new Array(n)
  let time = 0
  let fullThrottle = 0
  let under = 0
  let over = 0
  let stalled = 0
  let maxBrake = 0
  let maxLat = 0
  const sectors: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    const nx = (i + 1) % n
    t[i] = time
    const dt = (2 * ds) / (v[i] + v[nx])
    time += dt
    sectors[Math.min(2, Math.floor((i * 3) / n))] += dt
    ax[i] = (v[nx] * v[nx] - v[i] * v[i]) / (2 * ds)
    ay[i] = v[i] * v[i] * track.k[i]
    const braking = vb[i] < vf[i] - 0.05 && ax[i] < -1.5
    const isStraight = zone[i] === 1 && !braking
    straightMode[i] = isStraight ? 1 : 0
    const d = drive(v[i], i)
    const s = isStraight ? d.s : state(v[i], false)
    ride[i] = s.a.ride
    downforce[i] = s.down
    // how much of the available lateral grip this point uses
    const usage = Math.abs(ay[i]) / s.ayMax
    // a stalled floor only costs lap time where the car is leaning on its downforce
    if (s.a.ride < STALL_HEIGHT && usage > 0.5) stalled++
    const cornering = usage > 0.9
    frontLimited[i] = s.frontLimited ? 1 : 0
    if (braking) {
      limit[i] = "brake"
      const capacity = brake(v[i], i)
      brakeCh[i] = Math.min(1, Math.max(0, (-ax[i] - (s.drag + s.rolling) / m) / Math.max(1, capacity - (s.drag + s.rolling) / m)))
      maxBrake = Math.max(maxBrake, -ax[i])
    } else if (cornering) {
      limit[i] = frontLimited[i] ? "front" : "rear"
      if (frontLimited[i]) under++
      else over++
      throttle[i] = Math.min(1, Math.max(0, (m * ax[i] + s.drag + s.rolling) / Math.max(1, d.engine)))
    } else {
      limit[i] = d.tractionLimited ? "traction" : "power"
      throttle[i] = d.tractionLimited ? Math.min(1, d.force / d.engine) : 1
      if (!d.tractionLimited) fullThrottle++
    }
    maxLat = Math.max(maxLat, Math.abs(ay[i]))
  }

  let top = 0
  let min = Infinity
  let minRide = Infinity
  for (let i = 0; i < n; i++) {
    if (v[i] > top) top = v[i]
    if (v[i] < min) min = v[i]
    if (ride[i] < minRide) minRide = ride[i]
  }

  return {
    lapTime: time,
    v,
    t,
    ax,
    ay,
    throttle,
    brake: brakeCh,
    ride,
    downforce,
    straightMode,
    limit,
    sectors,
    topSpeed: top * 3.6,
    minSpeed: min * 3.6,
    maxLateralG: maxLat / G,
    maxBrakingG: maxBrake / G,
    fullThrottle: fullThrottle / n,
    understeer: under / n,
    oversteer: over / n,
    minRide,
    floorStalled: stalled > 0,
    stallShare: stalled / n,
  }
}

export function formatLap(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(3).padStart(6, "0")}`
}
