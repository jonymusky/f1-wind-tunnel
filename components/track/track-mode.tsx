"use client"

import { useEffect, useRef } from "react"
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Segmented } from "@/components/control-panel"
import { turbo } from "@/lib/flow-field"
import { G } from "@/lib/aero"
import { formatLap, type CarSpec, type LapResult, type Limit, type StraightAero, type TrackGeometry, type Tyre } from "@/lib/lap/sim"
import { TRACKS, type TrackInfo } from "@/lib/tracks"
import { cn } from "@/lib/utils"

export type ColorBy = "speed" | "limit"

const LIMIT_COLOR: Record<Limit, string> = {
  front: "#5aa9ff",
  rear: "#ff9f43",
  traction: "#f5d547",
  power: "#7d828c",
  brake: "#e10600",
}

export const LIMIT_LABEL: Record<Limit, string> = {
  power: "Full throttle",
  traction: "Traction-limited",
  brake: "Braking",
  front: "Front grip (understeer)",
  rear: "Rear grip (oversteer)",
}

const V_LO = 60 / 3.6
const V_HI = 350 / 3.6
const rgb: [number, number, number] = [0, 0, 0]
function speedColor(v: number) {
  turbo((v - V_LO) / (V_HI - V_LO), rgb)
  return `rgb(${Math.round(rgb[0] * 255)} ${Math.round(rgb[1] * 255)} ${Math.round(rgb[2] * 255)})`
}

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

/* ---------- stage: map, live readouts, speed trace ---------- */

export function TrackStage({
  track,
  lap,
  baseline,
  info,
  running,
  rate,
  colorBy,
  compact,
}: {
  track: TrackGeometry | null
  lap: LapResult | null
  baseline: LapResult | null
  info: TrackInfo
  running: boolean
  rate: number
  colorBy: ColorBy
  compact: boolean
}) {
  const mapRef = useRef<HTMLCanvasElement>(null)
  const traceRef = useRef<HTMLCanvasElement>(null)
  const hud = useRef<Record<string, HTMLElement | null>>({})
  // The animation reads everything through this ref, so React never re-renders per frame
  const live = useRef({ track, lap, baseline, running, rate, colorBy, pos: 0, dirty: true })
  useEffect(() => {
    Object.assign(live.current, { track, lap, baseline, running, rate, colorBy, dirty: true })
  }, [track, lap, baseline, running, rate, colorBy])

  useEffect(() => {
    const map = mapRef.current
    const trace = traceRef.current
    if (!map) return
    const mapCtx = map.getContext("2d")!
    const traceCtx = trace?.getContext("2d") ?? null
    const mapLayer = document.createElement("canvas")
    const traceLayer = document.createElement("canvas")
    let raf = 0
    let last = performance.now()
    let fit = { scale: 1, ox: 0, oy: 0 }

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      for (const c of [map, trace]) {
        if (!c) continue
        const r = c.getBoundingClientRect()
        c.width = Math.max(1, Math.round(r.width * dpr))
        c.height = Math.max(1, Math.round(r.height * dpr))
      }
      live.current.dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(map)
    if (trace) ro.observe(trace)
    resize()

    const drawStatic = () => {
      const { track: tr, lap: lp, baseline: base, colorBy: mode } = live.current
      mapLayer.width = map.width
      mapLayer.height = map.height
      const g = mapLayer.getContext("2d")!
      g.clearRect(0, 0, map.width, map.height)
      if (tr && lp) {
        const n = tr.x.length
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        for (let i = 0; i < n; i++) {
          minX = Math.min(minX, tr.x[i])
          maxX = Math.max(maxX, tr.x[i])
          minY = Math.min(minY, tr.y[i])
          maxY = Math.max(maxY, tr.y[i])
        }
        const pad = Math.min(map.width, map.height) * 0.09 + 12
        const scale = Math.min((map.width - 2 * pad) / (maxX - minX), (map.height - 2 * pad) / (maxY - minY))
        fit = {
          scale,
          ox: (map.width - (maxX - minX) * scale) / 2 - minX * scale,
          oy: (map.height + (maxY - minY) * scale) / 2 + minY * scale,
        }
        const px = (i: number) => tr.x[i] * fit.scale + fit.ox
        const py = (i: number) => -tr.y[i] * fit.scale + fit.oy
        const w = Math.max(3, Math.min(map.width, map.height) * 0.011)
        g.lineCap = "round"
        g.lineJoin = "round"
        // tarmac underlay
        g.strokeStyle = "#1c1e24"
        g.lineWidth = w * 2.6
        g.beginPath()
        for (let i = 0; i <= n; i++) (i ? g.lineTo : g.moveTo).call(g, px(i % n), py(i % n))
        g.stroke()
        g.lineWidth = w
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n
          g.strokeStyle = mode === "speed" ? speedColor(lp.v[i]) : LIMIT_COLOR[lp.limit[i]]
          g.beginPath()
          g.moveTo(px(i), py(i))
          g.lineTo(px(j), py(j))
          g.stroke()
        }
        // start/finish tick
        const nx = -(py(1) - py(0))
        const ny = px(1) - px(0)
        const nl = Math.hypot(nx, ny) || 1
        g.strokeStyle = "#ecedf0"
        g.lineWidth = Math.max(2, w * 0.45)
        g.beginPath()
        g.moveTo(px(0) - (nx / nl) * w * 2.4, py(0) - (ny / nl) * w * 2.4)
        g.lineTo(px(0) + (nx / nl) * w * 2.4, py(0) + (ny / nl) * w * 2.4)
        g.stroke()
      }

      if (trace) {
        traceLayer.width = trace.width
        traceLayer.height = trace.height
        const t = traceLayer.getContext("2d")!
        const W = trace.width
        const H = trace.height
        t.clearRect(0, 0, W, H)
        if (tr && lp) {
          const n = lp.v.length
          const y = (v: number) => H - 4 - ((v * 3.6) / 370) * (H - 8)
          t.strokeStyle = "rgba(255,255,255,0.06)"
          t.lineWidth = 1
          for (const kmh of [100, 200, 300]) {
            t.beginPath()
            t.moveTo(0, y(kmh / 3.6))
            t.lineTo(W, y(kmh / 3.6))
            t.stroke()
          }
          // flap-open zones
          t.fillStyle = "rgba(255,255,255,0.05)"
          for (let i = 0; i < n; i++) if (lp.straightMode[i]) t.fillRect((i / n) * W, 0, W / n + 1, H)
          if (base && base !== lp && base.v.length === n) {
            t.strokeStyle = "rgba(163,167,176,0.55)"
            t.lineWidth = Math.max(1, W / 900)
            t.setLineDash([4, 4])
            t.beginPath()
            for (let i = 0; i < n; i++) (i ? t.lineTo : t.moveTo).call(t, (i / n) * W, y(base.v[i]))
            t.stroke()
            t.setLineDash([])
          }
          t.lineWidth = Math.max(1.5, W / 520)
          for (let i = 0; i < n - 1; i++) {
            t.strokeStyle = mode === "speed" ? speedColor(lp.v[i]) : LIMIT_COLOR[lp.limit[i]]
            t.beginPath()
            t.moveTo((i / n) * W, y(lp.v[i]))
            t.lineTo(((i + 1) / n) * W, y(lp.v[i + 1]))
            t.stroke()
          }
        }
      }
      live.current.dirty = false
    }

    const set = (key: string, text: string) => {
      const el = hud.current[key]
      if (el && el.textContent !== text) el.textContent = text
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = live.current
      if (s.dirty) drawStatic()
      mapCtx.clearRect(0, 0, map.width, map.height)
      mapCtx.drawImage(mapLayer, 0, 0)
      const { track: tr, lap: lp } = s
      if (!tr || !lp) return
      const n = tr.x.length
      if (s.pos >= n) s.pos = 0
      const i = Math.floor(s.pos)
      const j = (i + 1) % n
      const f = s.pos - i
      const v = lp.v[i] + (lp.v[j] - lp.v[i]) * f
      if (s.running) {
        s.pos += (v * dt * s.rate) / tr.ds
        if (s.pos >= n) s.pos -= n
      }
      const x = (tr.x[i] + (tr.x[j] - tr.x[i]) * f) * fit.scale + fit.ox
      const y = -(tr.y[i] + (tr.y[j] - tr.y[i]) * f) * fit.scale + fit.oy
      const r = Math.max(5, Math.min(map.width, map.height) * 0.014)
      const braking = lp.limit[i] === "brake"
      mapCtx.fillStyle = braking ? "rgba(225,6,0,0.35)" : "rgba(236,237,240,0.22)"
      mapCtx.beginPath()
      mapCtx.arc(x, y, r * 2.1, 0, Math.PI * 2)
      mapCtx.fill()
      mapCtx.fillStyle = "#ecedf0"
      mapCtx.strokeStyle = "#0b0c0f"
      mapCtx.lineWidth = r * 0.35
      mapCtx.beginPath()
      mapCtx.arc(x, y, r, 0, Math.PI * 2)
      mapCtx.fill()
      mapCtx.stroke()

      if (traceCtx && trace) {
        traceCtx.clearRect(0, 0, trace.width, trace.height)
        traceCtx.drawImage(traceLayer, 0, 0)
        const cx = (s.pos / n) * trace.width
        traceCtx.strokeStyle = "#ecedf0"
        traceCtx.lineWidth = Math.max(1, trace.width / 700)
        traceCtx.beginPath()
        traceCtx.moveTo(cx, 0)
        traceCtx.lineTo(cx, trace.height)
        traceCtx.stroke()
      }

      const kmh = v * 3.6
      set("speed", String(Math.round(kmh)))
      set("gear", String(Math.min(8, Math.max(1, Math.ceil(kmh / 42)))))
      const tNow = lp.t[i] + ((j ? lp.t[j] : lp.lapTime) - lp.t[i]) * f
      set("clock", formatLap(tNow))
      set("lat", (Math.abs(lp.ay[i]) / G).toFixed(1))
      set("long", (lp.ax[i] / G).toFixed(1))
      set("state", lp.straightMode[i] ? `${LIMIT_LABEL[lp.limit[i]]} · flap open` : LIMIT_LABEL[lp.limit[i]])
      set("ride", `${lp.ride[i].toFixed(0)} mm`)
      set("load", `${fmt(lp.downforce[i] / G)} kgf`)
      const th = hud.current.throttle
      const br = hud.current.brake
      if (th) th.style.width = `${Math.round(lp.throttle[i] * 100)}%`
      if (br) br.style.width = `${Math.round(lp.brake[i] * 100)}%`
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const ref = (key: string) => (el: HTMLElement | null) => {
    hud.current[key] = el
  }

  const readouts = (
    <div className={cn("panel flex items-center gap-4 px-4 py-3", compact && "gap-3 px-3 py-2")}>
      <div className={compact ? "w-[84px]" : "w-[112px]"}>
        <div className="flex items-baseline gap-1">
          <span ref={ref("speed")} className={cn("tabular leading-none font-medium tracking-tight text-ink", compact ? "text-[24px]" : "text-[34px]")}>
            0
          </span>
          <span className="tabular text-[11px] text-ink-3">km/h</span>
        </div>
        <div className="tabular mt-1 text-[11px] text-ink-3">
          gear <span ref={ref("gear")} className="text-ink-2">1</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="label-xs w-7">Thr</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-strong">
            <div ref={ref("throttle")} className="h-full bg-emerald-400" style={{ width: "0%" }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-xs w-7">Brk</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-strong">
            <div ref={ref("brake")} className="h-full bg-accent" style={{ width: "0%" }} />
          </div>
        </div>
        <div ref={ref("state")} className="truncate text-[11.5px] text-ink-2">
          —
        </div>
      </div>
      <div className="tabular text-right text-[11px] leading-[1.55] text-ink-3">
        <div ref={ref("clock")} className="text-[15px] text-ink">
          0:00.000
        </div>
        {!compact && (
          <>
            <div>
              lat <span ref={ref("lat")} className="text-ink-2">0.0</span> g · long <span ref={ref("long")} className="text-ink-2">0.0</span> g
            </div>
            <div>
              ride <span ref={ref("ride")} className="text-ink-2">—</span> · <span ref={ref("load")} className="text-ink-2">—</span>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative min-h-0 flex-1">
        <canvas ref={mapRef} className="absolute inset-0 size-full" aria-label={`Racing line at ${info.name}, coloured by ${colorBy}`} role="img" />
        {!track && <div className="absolute inset-0 grid place-items-center text-xs text-ink-3">Loading circuit…</div>}
        <div className="pointer-events-none absolute top-0 left-0">
          <div className="text-[15px] font-semibold tracking-tight">{info.name}</div>
          <div className="text-[11.5px] text-ink-3">
            {info.place} · {info.length.toFixed(3)} km · {fmt(info.altitude)} m
          </div>
        </div>
        <MapLegend colorBy={colorBy} className="absolute right-0 bottom-0" />
      </div>
      {readouts}
      {!compact && (
        <div className="panel px-3 pt-2.5 pb-2">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="label-xs">Speed over the lap</span>
            <span className="text-[10.5px] text-ink-3">dashed: baseline setup · shaded: flap open</span>
          </div>
          <canvas ref={traceRef} className="block h-[104px] w-full" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

function MapLegend({ colorBy, className }: { colorBy: ColorBy; className?: string }) {
  if (colorBy === "limit") {
    return (
      <div className={cn("panel space-y-1 px-3 py-2.5", className)}>
        {(Object.keys(LIMIT_LABEL) as Limit[]).map((k) => (
          <div key={k} className="flex items-center gap-2 text-[10.5px] text-ink-2">
            <span className="h-1.5 w-4 rounded-full" style={{ background: LIMIT_COLOR[k] }} />
            {LIMIT_LABEL[k]}
          </div>
        ))}
      </div>
    )
  }
  const stops = Array.from({ length: 9 }, (_, i) => `${speedColor(V_LO + ((V_HI - V_LO) * i) / 8)} ${(i / 8) * 100}%`).join(",")
  return (
    <div className={cn("panel w-44 px-3 py-2.5", className)}>
      <div className="h-1.5 rounded-sm" style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <div className="tabular mt-1 flex justify-between text-[10px] text-ink-3">
        <span>60</span>
        <span>km/h</span>
        <span>350</span>
      </div>
    </div>
  )
}

/* ---------- lap report ---------- */

function Readout({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="label-xs">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="tabular text-[19px] leading-none font-medium text-ink">{value}</span>
        {unit && <span className="tabular text-[11px] text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="tabular mt-1 text-[11px] leading-snug text-ink-3">{sub}</div>}
    </div>
  )
}

export function LapPanel({ lap, baseline, info }: { lap: LapResult | null; baseline: LapResult | null; info: TrackInfo }) {
  if (!lap) return <div className="p-4 text-xs text-ink-3">Loading circuit…</div>
  const delta = baseline ? lap.lapTime - baseline.lapTime : 0
  const vsPole = ((lap.lapTime - info.pole) / info.pole) * 100
  const neutral = Math.abs(delta) < 0.0005
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="label-xs">Lap time</div>
          <div className="tabular mt-1.5 text-[34px] leading-none font-medium tracking-tight text-ink">{formatLap(lap.lapTime)}</div>
        </div>
        <div className="text-right">
          <div className={cn("tabular text-[15px] font-medium", neutral ? "text-ink-3" : delta < 0 ? "text-emerald-400" : "text-accent-hover")}>
            {neutral ? "baseline" : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(3)} s`}
          </div>
          <div className="text-[11px] text-ink-3">vs baseline setup</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4">
        {lap.sectors.map((s, i) => {
          const d = baseline ? s - baseline.sectors[i] : 0
          return (
            <Readout
              key={i}
              label={`Sector ${i + 1}`}
              value={s.toFixed(3)}
              unit="s"
              sub={Math.abs(d) < 0.0005 ? " " : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(3)}`}
            />
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-4 border-t border-line pt-3">
        <Readout label="Top speed" value={fmt(lap.topSpeed)} unit="km/h" />
        <Readout label="Slowest corner" value={fmt(lap.minSpeed)} unit="km/h" />
        <Readout label="Full throttle" value={fmt(lap.fullThrottle * 100)} unit="%" sub="of the lap" />
        <Readout label="Peak lateral" value={fmt(lap.maxLateralG, 1)} unit="g" />
        <Readout label="Peak braking" value={fmt(lap.maxBrakingG, 1)} unit="g" />
        <Readout label="Lowest ride" value={fmt(lap.minRide)} unit="mm" sub="under load" />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="label-xs">Which axle gives up first</span>
          <span className="tabular text-[11px] text-ink-3">in corners</span>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line-strong">
          <div style={{ width: `${(lap.understeer / Math.max(0.0001, lap.understeer + lap.oversteer)) * 100}%`, background: LIMIT_COLOR.front }} />
          <div className="flex-1" style={{ background: lap.oversteer > 0 ? LIMIT_COLOR.rear : "transparent" }} />
        </div>
        <div className="tabular mt-1 flex justify-between text-[10.5px] text-ink-3">
          <span>front {fmt(lap.understeer * 100)}% · understeer</span>
          <span>oversteer · rear {fmt(lap.oversteer * 100)}%</span>
        </div>
      </div>

      <p className="text-[11px] leading-snug text-ink-3">
        2025 pole here: <span className="tabular text-ink-2">{formatLap(info.pole)}</span> ({info.poleBy}). This lap is{" "}
        <span className="tabular text-ink-2">
          {Math.abs(vsPole).toFixed(1)}% {vsPole > 0 ? "slower" : "faster"}
        </span>
        . The model is a flat-track, constant-power approximation; trust the differences between setups more than the absolute time.
      </p>

      {lap.stallShare > 0.01 && (
        <div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 px-2.5 py-2 text-[11.5px] text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>
            In fast corners the aero load squashes the floor below 24 mm ({fmt(lap.stallShare * 100)}% of the lap). It stalls there and gives
            downforce away exactly when you need it: raise the ride height.
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------- car and circuit ---------- */

function Field({ label, value, unit, min, max, step, onChange, hint }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12.5px] text-ink-2" title={hint}>
          {label}
        </label>
        <span className="tabular text-[12.5px] text-ink">
          {value}
          <span className="ml-1 text-ink-3">{unit}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} aria-label={label} />
    </div>
  )
}

export function TrackSetupPanel({
  trackId,
  onTrack,
  spec,
  onSpec,
  colorBy,
  onColorBy,
  rate,
  onRate,
  onReset,
  onOptimise,
  optimising,
}: {
  trackId: string
  onTrack: (id: string) => void
  spec: CarSpec
  onSpec: (patch: Partial<CarSpec>) => void
  colorBy: ColorBy
  onColorBy: (c: ColorBy) => void
  rate: number
  onRate: (r: number) => void
  onReset: () => void
  onOptimise: () => void
  optimising: boolean
}) {
  const info = TRACKS.find((t) => t.id === trackId)!
  return (
    <div>
      <section className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <h3 className="label-xs">Circuit</h3>
          <button onClick={onReset} className="flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink-2">
            <RotateCcw className="size-3" /> Reset car
          </button>
        </div>
        <select
          value={trackId}
          onChange={(e) => onTrack(e.target.value)}
          aria-label="Circuit"
          className="h-9 w-full rounded-lg border border-line-strong bg-black/30 px-2.5 text-[13px] text-ink"
        >
          {TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.place}
            </option>
          ))}
        </select>
        <p className="text-[11.5px] leading-snug text-ink-3">{info.note}</p>
        <div className="grid grid-cols-2 gap-2">
          <Segmented<ColorBy>
            size="sm"
            value={colorBy}
            onChange={onColorBy}
            options={[
              { value: "speed", label: "Speed" },
              { value: "limit", label: "Limit" },
            ]}
          />
          <Segmented
            size="sm"
            value={String(rate)}
            onChange={(r) => onRate(Number(r))}
            options={[
              { value: "1", label: "1×" },
              { value: "4", label: "4×" },
              { value: "12", label: "12×" },
            ]}
          />
        </div>
      </section>

      <section className="space-y-3.5 border-t border-line px-4 py-4">
        <h3 className="label-xs">Car</h3>
        <Field label="Power" value={spec.power} unit={`kW · ${Math.round(spec.power * 1.341)} hp`} min={450} max={800} step={5} onChange={(power) => onSpec({ power })} hint="Peak power-unit output" />
        <Field label="Car + driver" value={spec.mass} unit="kg" min={720} max={900} step={2} onChange={(mass) => onSpec({ mass })} hint="2025 minimum was 800 kg" />
        <Field label="Fuel" value={spec.fuel} unit="kg" min={0} max={110} step={1} onChange={(fuel) => onSpec({ fuel })} hint="A race start is about 100 kg; qualifying a few kilos" />
        <div className="space-y-1.5">
          <span className="text-[12.5px] text-ink-2">Tyre compound</span>
          <Segmented<Tyre>
            value={spec.tyre}
            onChange={(tyre) => onSpec({ tyre })}
            options={[
              { value: "soft", label: "Soft" },
              { value: "medium", label: "Medium" },
              { value: "hard", label: "Hard" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] text-ink-2">On the straights</span>
            <span className="text-[11px] text-ink-3">{spec.straightAero === "drs" ? "rear flap opens" : spec.straightAero === "active" ? "both wings open" : "wings fixed"}</span>
          </div>
          <Segmented<StraightAero>
            value={spec.straightAero}
            onChange={(straightAero) => onSpec({ straightAero })}
            options={[
              { value: "none", label: "Fixed" },
              { value: "drs", label: "DRS" },
              { value: "active", label: "Active aero" },
            ]}
          />
        </div>
        <button
          onClick={onOptimise}
          disabled={optimising}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-white/5 text-xs font-medium text-ink transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {optimising ? "Searching…" : "Find the fastest wing angles"}
        </button>
      </section>
    </div>
  )
}
