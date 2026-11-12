// Builds lib/tracks/data/*.json from the TUM FTM racetrack database
// (https://github.com/TUMFTM/racetrack-database, LGPL-3.0): minimum-curvature
// racing lines computed from smoothed OpenStreetMap centre lines and track
// widths measured on satellite imagery.
//
// For each circuit: resample the line to a uniform step, compute signed
// curvature, smooth it lightly, and write compact arrays. Run with
//   node scripts/build-tracks.mjs
import fs from "node:fs"
import path from "node:path"

const COMMIT = "e59595d1f3573b30d1ded6a08984935b957688e0"
const BASE = `https://raw.githubusercontent.com/TUMFTM/racetrack-database/${COMMIT}`
const OUT = path.resolve(import.meta.dirname, "../lib/tracks/data")
const CACHE = path.resolve(import.meta.dirname, "../.cache/tracks")
const DS = 4 // metres between samples

// id → source file. Only circuits whose surveyed layout is still the Grand Prix layout.
const TRACKS = {
  monza: "Monza",
  spa: "Spa",
  silverstone: "Silverstone",
  suzuka: "Suzuka",
  hungaroring: "Budapest",
  spielberg: "Spielberg",
  sakhir: "Sakhir",
  interlagos: "SaoPaulo",
  montreal: "Montreal",
  austin: "Austin",
  mexico: "MexicoCity",
  shanghai: "Shanghai",
}

async function load(kind, name) {
  const file = path.join(CACHE, `${kind}-${name}.csv`)
  if (!fs.existsSync(file)) {
    const res = await fetch(`${BASE}/${kind}/${name}.csv`)
    if (!res.ok) throw new Error(`${kind}/${name}: HTTP ${res.status}`)
    fs.mkdirSync(CACHE, { recursive: true })
    fs.writeFileSync(file, await res.text())
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").map(Number))
}

function closedLength(pts) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return s
}

function resample(pts, n) {
  const cum = [0]
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = cum[pts.length]
  const out = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const s = (i * total) / n
    while (cum[j + 1] < s) j++
    const t = (s - cum[j]) / (cum[j + 1] - cum[j])
    const a = pts[j]
    const b = pts[(j + 1) % pts.length]
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return { pts: out, ds: total / n }
}

// Signed curvature of the circle through three points (positive = left turn)
function curvature(pts, span) {
  const n = pts.length
  return pts.map((p, i) => {
    const a = pts[(i - span + n) % n]
    const c = pts[(i + span) % n]
    const cross = (p[0] - a[0]) * (c[1] - a[1]) - (p[1] - a[1]) * (c[0] - a[0])
    const d = Math.hypot(p[0] - a[0], p[1] - a[1]) * Math.hypot(c[0] - p[0], c[1] - p[1]) * Math.hypot(c[0] - a[0], c[1] - a[1])
    return d > 0 ? (2 * cross) / d : 0
  })
}

function smooth(arr, half) {
  const n = arr.length
  return arr.map((_, i) => {
    let s = 0
    let w = 0
    for (let k = -half; k <= half; k++) {
      const wk = half + 1 - Math.abs(k)
      s += arr[(i + k + n) % n] * wk
      w += wk
    }
    return s / w
  })
}

fs.mkdirSync(OUT, { recursive: true })
const report = []
for (const [id, name] of Object.entries(TRACKS)) {
  const line = (await load("racelines", name)).map((r) => [r[0], r[1]])
  const centre = (await load("tracks", name)).map((r) => [r[0], r[1]])
  if (Math.hypot(line[0][0] - line.at(-1)[0], line[0][1] - line.at(-1)[1]) < 0.5) line.pop()
  const length = closedLength(line)
  const n = Math.round(length / DS)
  const { pts, ds } = resample(line, n)
  const k = smooth(curvature(pts, 2), 2)
  let area = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    area += a[0] * b[1] - b[0] * a[1]
  }
  const kMax = Math.max(...k.map(Math.abs))
  const firstCorner = k.findIndex((v) => Math.abs(v) > 1 / 120) * ds
  fs.writeFileSync(
    path.join(OUT, `${id}.json`),
    JSON.stringify({
      ds: +ds.toFixed(4),
      x: pts.map((p) => +p[0].toFixed(1)),
      y: pts.map((p) => +p[1].toFixed(1)),
      k: k.map((v) => +v.toFixed(5)),
    }),
  )
  report.push({
    id,
    centreline_m: Math.round(closedLength(centre)),
    raceline_m: Math.round(length),
    points: n,
    direction: area < 0 ? "clockwise" : "anticlockwise",
    tightest_radius_m: +(1 / kMax).toFixed(1),
    first_corner_at_m: Math.round(firstCorner),
  })
}
console.table(report)
