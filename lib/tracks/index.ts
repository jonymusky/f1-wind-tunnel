import type { TrackGeometry } from "../lap/sim"

export interface TrackInfo {
  id: string
  name: string
  place: string
  /** Official lap length, km */
  length: number
  /** Metres above sea level: thinner air means less downforce and less drag */
  altitude: number
  /** 2025 pole position lap, seconds, with the driver who set it */
  pole: number
  poleBy: string
  note: string
}

// Racing lines come from the TUM FTM racetrack database (see scripts/build-tracks.mjs).
// Pole laps are the 2025 Grand Prix qualifying results.
export const TRACKS: TrackInfo[] = [
  { id: "monza", name: "Monza", place: "Italy", length: 5.793, altitude: 162, pole: 78.792, poleBy: "Verstappen", note: "Lowest downforce of the year: long straights, three chicanes." },
  { id: "spa", name: "Spa-Francorchamps", place: "Belgium", length: 7.004, altitude: 401, pole: 100.562, poleBy: "Norris", note: "Long, fast, and a compromise: straights in sectors 1 and 3, corners in sector 2." },
  { id: "silverstone", name: "Silverstone", place: "Great Britain", length: 5.891, altitude: 153, pole: 84.892, poleBy: "Verstappen", note: "High-speed direction changes; rewards efficient downforce." },
  { id: "suzuka", name: "Suzuka", place: "Japan", length: 5.807, altitude: 45, pole: 86.983, poleBy: "Verstappen", note: "The esses punish a car without front-end grip." },
  { id: "hungaroring", name: "Hungaroring", place: "Hungary", length: 4.381, altitude: 264, pole: 75.372, poleBy: "Leclerc", note: "Maximum downforce: one short straight, corner after corner." },
  { id: "spielberg", name: "Red Bull Ring", place: "Austria", length: 4.326, altitude: 678, pole: 63.971, poleBy: "Norris", note: "Short lap, three straights uphill into heavy braking." },
  { id: "sakhir", name: "Bahrain", place: "Sakhir", length: 5.412, altitude: 7, pole: 89.841, poleBy: "Piastri", note: "Traction and braking; rear tyres do the work." },
  { id: "interlagos", name: "Interlagos", place: "Brazil", length: 4.309, altitude: 785, pole: 69.511, poleBy: "Norris", note: "Anticlockwise, with a long flat-out climb to the line." },
  { id: "montreal", name: "Montréal", place: "Canada", length: 4.361, altitude: 13, pole: 70.899, poleBy: "Russell", note: "Stop-and-go: chicanes, a hairpin and long straights." },
  { id: "austin", name: "Circuit of the Americas", place: "United States", length: 5.513, altitude: 161, pole: 92.51, poleBy: "Verstappen", note: "Fast esses in sector 1, a long back straight, a slow stadium." },
  { id: "mexico", name: "Mexico City", place: "Mexico", length: 4.304, altitude: 2238, pole: 75.586, poleBy: "Norris", note: "2,200 m up: a quarter less air, so maximum wing gives Monza-level load." },
  { id: "shanghai", name: "Shanghai", place: "China", length: 5.451, altitude: 5, pole: 90.641, poleBy: "Piastri", note: "A never-ending first corner and a 1.2 km back straight." },
]

export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t])) as Record<string, TrackInfo>

// One explicit import per circuit so the bundler emits one chunk each
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  monza: () => import("./data/monza.json"),
  spa: () => import("./data/spa.json"),
  silverstone: () => import("./data/silverstone.json"),
  suzuka: () => import("./data/suzuka.json"),
  hungaroring: () => import("./data/hungaroring.json"),
  spielberg: () => import("./data/spielberg.json"),
  sakhir: () => import("./data/sakhir.json"),
  interlagos: () => import("./data/interlagos.json"),
  montreal: () => import("./data/montreal.json"),
  austin: () => import("./data/austin.json"),
  mexico: () => import("./data/mexico.json"),
  shanghai: () => import("./data/shanghai.json"),
}

const cache = new Map<string, Promise<TrackGeometry>>()

/** Geometry is loaded on demand, one small JSON per circuit. */
export function loadTrack(id: string): Promise<TrackGeometry> {
  let p = cache.get(id)
  if (!p) {
    p = LOADERS[id]().then((m) => m.default as TrackGeometry)
    cache.set(id, p)
  }
  return p
}
