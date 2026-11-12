// Runs the lap simulator on every circuit with one baseline car and compares
// against the 2025 pole laps. Usage: node scripts/validate-lap.mjs
import { registerHooks } from "node:module"
import fs from "node:fs"
import path from "node:path"

// let Node resolve the extensionless TypeScript imports the app uses
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const base = new URL(specifier, context.parentURL)
      if (fs.existsSync(new URL(base.href + ".ts"))) return next(specifier + ".ts", context)
    }
    return next(specifier, context)
  },
})

const { simulateLap, DEFAULT_SPEC, formatLap, PHYSICS } = await import("../lib/lap/sim.ts")
const { TRACKS } = await import("../lib/tracks/index.ts")
const { DEFAULT_CONFIG } = await import("../lib/aero.ts")

const geo = (id) => JSON.parse(fs.readFileSync(new URL(`../lib/tracks/data/${id}.json`, import.meta.url), "utf8"))
const base = { frontWing: DEFAULT_CONFIG.frontWing, rearWing: DEFAULT_CONFIG.rearWing, rideHeight: DEFAULT_CONFIG.rideHeight, rake: DEFAULT_CONFIG.rake }
const override = JSON.parse(process.argv[2] ?? "{}")
// optional second argument: physics overrides for calibration runs, e.g. '{"loadSensitivity":0.2}'
const tune = JSON.parse(process.argv[3] ?? "{}")
if (tune.mu) Object.assign(PHYSICS.mu, { soft: tune.mu, medium: tune.mu - 0.05, hard: tune.mu - 0.1 })
for (const [k, v] of Object.entries(tune)) if (k !== "mu" && k !== "spec") PHYSICS[k] = v
const SPEC = { ...DEFAULT_SPEC, ...(tune.spec ?? {}) }

/** Best wing level for a circuit, front wing following the rear to hold balance. */
function bestWings(track, alt) {
  let best = null
  for (let rear = 6; rear <= 36; rear += 2) {
    for (let front = 4; front <= 30; front += 2) {
      const lap = simulateLap(track, { ...base, ...override, frontWing: front, rearWing: rear }, SPEC, alt)
      if (!best || lap.lapTime < best.lap.lapTime) best = { lap, front, rear }
    }
  }
  return best
}

const rows = []
let sumSq = 0
for (const t of TRACKS) {
  const g = geo(t.id)
  const fixed = simulateLap(g, { ...base, ...override }, SPEC, t.altitude)
  const tuned = bestWings(g, t.altitude)
  const err = ((tuned.lap.lapTime - t.pole) / t.pole) * 100
  sumSq += err * err
  rows.push({
    track: t.id,
    pole: formatLap(t.pole),
    default_setup: formatLap(fixed.lapTime),
    best_wings: formatLap(tuned.lap.lapTime),
    "err_%": +err.toFixed(1),
    wings: `${tuned.front}/${tuned.rear}`,
    top_kmh: Math.round(tuned.lap.topSpeed),
    min_kmh: Math.round(tuned.lap.minSpeed),
    lat_g: +tuned.lap.maxLateralG.toFixed(1),
    brake_g: +tuned.lap.maxBrakingG.toFixed(1),
    "full_%": Math.round(tuned.lap.fullThrottle * 100),
    min_ride: +tuned.lap.minRide.toFixed(0),
  })
}
console.table(rows)
console.log("RMS error %:", Math.sqrt(sumSq / TRACKS.length).toFixed(2))
