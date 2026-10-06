"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Boxes, ChevronDown, Pause, Play } from "lucide-react"
import Scene, { type CameraView } from "@/components/sim/scene"
import type { FlowState } from "@/components/sim/flow"
import type { CarPose } from "@/components/sim/car"
import { Legend, PartsPanel, Segmented, SetupPanel, TelemetryPanel, type VisualSettings } from "@/components/control-panel"
import { Slider } from "@/components/ui/slider"
import type { PartId } from "@/lib/parts"
import { computeAero, DEFAULT_CONFIG, toKgf, type AeroConfig } from "@/lib/aero"
import { useMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const VIEW_OPTIONS: { value: CameraView; label: string }[] = [
  { value: "three-quarter", label: "3/4" },
  { value: "side", label: "Side" },
  { value: "front", label: "Front" },
  { value: "top", label: "Top" },
  { value: "rear", label: "Rear" },
  { value: "floor", label: "Floor" },
]

/** Visual particle speed (m/s in scene units) for a given air speed — slowed so the flow stays readable */
const visualSpeed = (kmh: number) => kmh / 40

function formatClock(s: number) {
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

export default function WindTunnelSimulator() {
  const isMobile = useMobile()
  const [config, setConfig] = useState<AeroConfig>(DEFAULT_CONFIG)
  const [visual, setVisual] = useState<VisualSettings>({ flow: "streamlines", pressure: false, smokeX: 0.3 })
  const [view, setView] = useState<CameraView>("three-quarter")
  const [running, setRunning] = useState(true)
  const [intro, setIntro] = useState(true)
  const [runTime, setRunTime] = useState(0)
  const [sheet, setSheet] = useState<"data" | "setup" | "parts">("data")
  const [explode, setExplode] = useState(0)
  const [selected, setSelected] = useState<PartId | null>(null)
  const [hovered, setHovered] = useState<PartId | null>(null)
  const exploded = explode > 0
  const partsMode = exploded || selected !== null

  const toggleExplode = () => {
    setExplode((e) => (e > 0 ? 0 : 0.8))
    if (explode > 0) setSelected(null)
    else setSheet("parts")
  }
  const selectPart = (id: PartId | null) => {
    setSelected(id)
    if (id) setSheet("parts")
  }
  const [sheetOpen, setSheetOpen] = useState(true)

  const aero = useMemo(() => computeAero(config), [config])

  // Phones start with the sheet collapsed so the car is visible
  useEffect(() => {
    if (isMobile) setSheetOpen(false)
  }, [isMobile])

  const pose: CarPose = {
    frontWing: config.frontWing,
    rearWing: config.rearWing,
    rideHeight: config.rideHeight / 1000,
    rake: config.rake,
    yaw: config.yaw,
    straight: config.mode === "straight",
    pressure: visual.pressure,
    floorLoad: aero.floorLoad,
    wingLoad: (aero.frontWingLoad + aero.rearWingLoad) / 2,
  }

  // The render loop reads these refs every frame, so slider drags never re-render the flow
  const flowSpeedRef = useRef(0)
  const flowStateRef = useRef<FlowState>({
    field: { yaw: 0, rideHeight: 0.035, floorLoad: 0.6, frontWingLoad: 0.5, rearWingLoad: 0.5, straight: false },
    speed: 0,
    running: true,
    smokeX: visual.smokeX,
  })
  useEffect(() => {
    flowSpeedRef.current = running ? visualSpeed(config.speed) : 0
    flowStateRef.current = {
      field: {
        yaw: (config.yaw * Math.PI) / 180,
        rideHeight: config.rideHeight / 1000,
        floorLoad: aero.floorLoad,
        frontWingLoad: aero.frontWingLoad,
        rearWingLoad: aero.rearWingLoad,
        straight: config.mode === "straight",
      },
      speed: visualSpeed(config.speed),
      running,
      smokeX: visual.smokeX,
    }
  }, [config, aero, running, visual.smokeX])

  useEffect(() => {
    if (!running || intro) return
    const id = setInterval(() => setRunTime((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [running, intro])

  // Keyboard: space = run/pause, 1–6 = camera views
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return
      if (e.key === "e" || e.key === "E") toggleExplode()
      if (e.key === "Escape") setSelected(null)
      if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setRunning((r) => !r)
      }
      const n = Number(e.key)
      if (n >= 1 && n <= VIEW_OPTIONS.length) setView(VIEW_OPTIONS[n - 1].value)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const patch = (p: Partial<AeroConfig>) => setConfig((c) => ({ ...c, ...p }))
  const patchVisual = (p: Partial<VisualSettings>) => setVisual((v) => ({ ...v, ...p }))

  const setup = (
    <SetupPanel config={config} onChange={patch} onReset={() => setConfig(DEFAULT_CONFIG)} visual={visual} onVisualChange={patchVisual} />
  )
  const telemetry = <TelemetryPanel aero={aero} config={config} />
  const parts = (
    <PartsPanel aero={aero} config={config} selected={selected} hovered={hovered} onSelect={selectPart} onHover={setHovered} />
  )

  const explodeButton = (
    <button
      onClick={toggleExplode}
      aria-pressed={exploded}
      title="Take the car apart (E)"
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
        exploded ? "border-ink/40 bg-white/15 text-ink" : "border-line-strong bg-white/5 text-ink hover:bg-white/10",
      )}
    >
      <Boxes className="size-3.5" />
      <span className="hidden sm:inline">{exploded ? "Assemble" : "Explode"}</span>
    </button>
  )

  const runButton = (
    <button
      onClick={() => setRunning((r) => !r)}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
        running ? "border border-line-strong bg-white/5 text-ink hover:bg-white/10" : "bg-accent text-white hover:bg-accent-hover",
      )}
    >
      {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      {running ? "Pause" : "Run"}
    </button>
  )

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <div className="absolute inset-0">
        <Scene
          pose={pose}
          flowMode={visual.flow}
          flowStateRef={flowStateRef}
          flowSpeedRef={flowSpeedRef}
          view={view}
          explode={explode}
          selected={selected}
          hovered={hovered}
          onSelect={selectPart}
          onHover={setHovered}
        />
      </div>

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 md:p-4">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-accent">
            <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">AeroSim</div>
            <div className="text-[11px] text-ink-3">Wind tunnel · test section 1</div>
          </div>
        </div>

        {!isMobile && (
          <Segmented className="panel pointer-events-auto !rounded-xl" size="sm" value={view} onChange={setView} options={VIEW_OPTIONS} />
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="panel hidden h-8 items-center gap-2 !rounded-lg px-3 sm:flex">
            <span className={cn("size-1.5 rounded-full", running ? "bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]" : "bg-ink-3")} />
            <span className="tabular text-[11.5px] text-ink-2">
              {running ? "RUN" : "HOLD"} {formatClock(runTime)}
            </span>
            <span className="tabular text-[11.5px] text-ink-3">· {config.speed} km/h</span>
          </div>
          {explodeButton}
          {runButton}
        </div>
      </header>

      {isMobile ? (
        /* Mobile: one bottom sheet with Data / Setup tabs */
        <div className="absolute inset-x-0 bottom-0 z-10 p-2">
          {!sheetOpen && !exploded && (
            <div className="mb-2">
              <Legend visual={visual} />
            </div>
          )}
          <div className="panel overflow-hidden !rounded-2xl">
            <div className="flex items-center gap-2 p-2">
              <Segmented
                className="flex-1"
                size="sm"
                value={sheet}
                onChange={(s) => {
                  setSheet(s)
                  setSheetOpen(true)
                }}
                options={[
                  { value: "data", label: `Data · ${Math.round(toKgf(aero.downforce)).toLocaleString("en-US")} kgf` },
                  { value: "setup", label: "Setup" },
                  { value: "parts", label: "Parts" },
                ]}
              />
              <button
                onClick={() => setSheetOpen((o) => !o)}
                aria-label={sheetOpen ? "Collapse panel" : "Expand panel"}
                className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-white/5"
              >
                <ChevronDown className={cn("size-4 transition-transform", !sheetOpen && "rotate-180")} />
              </button>
            </div>
            {sheetOpen && (
              <div className="scroll-thin max-h-[42dvh] overflow-y-auto border-t border-line">
                {sheet === "data" ? telemetry : sheet === "setup" ? setup : parts}
                {sheet === "setup" && (
                  <div className="border-t border-line p-4">
                    <div className="label-xs mb-3">Camera</div>
                    <Segmented size="sm" value={view} onChange={setView} options={VIEW_OPTIONS} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <aside className="panel scroll-thin absolute top-16 right-4 bottom-4 z-10 w-[300px] overflow-y-auto">
            {partsMode ? (
              <>
                {parts}
                <div className="border-t border-line px-4 py-3">
                  <button
                    onClick={() => {
                      setExplode(0)
                      setSelected(null)
                    }}
                    className="text-[12px] text-ink-3 hover:text-ink-2"
                  >
                    ← Back to car setup
                  </button>
                </div>
              </>
            ) : (
              setup
            )}
          </aside>
          <div className="absolute bottom-4 left-4 z-10 flex items-end gap-3">
            <div className="panel w-[340px]">{telemetry}</div>
            {!exploded && <Legend visual={visual} />}
          </div>
        </>
      )}

      {/* Explode slider */}
      <AnimatePresence>
        {exploded && (
          <motion.div
            className={cn(
              "panel absolute z-10 flex items-center gap-3 px-4 py-2.5",
              isMobile ? "inset-x-2 top-14" : "bottom-4 left-1/2 w-[320px] -translate-x-1/2",
            )}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-[11px] text-ink-3">Assembled</span>
            <Slider value={[explode]} min={0.05} max={1} step={0.01} onValueChange={(v) => setExplode(v[0])} aria-label="Explode amount" />
            <span className="text-[11px] text-ink-3">Exploded</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intro */}
      <AnimatePresence>
        {intro && (
          <motion.div
            className="absolute inset-0 z-20 flex items-center bg-gradient-to-r from-bg/95 via-bg/70 to-transparent px-6 md:px-14"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <motion.div
              className="max-w-md"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
            >
              <div className="label-xs mb-4 text-accent!">F1 aerodynamics lab</div>
              <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                Put a Formula 1 car in the wind tunnel.
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                Change wing angles, ride height, rake and yaw, and watch the airflow, surface pressure and forces respond.
                The numbers are tuned to real F1 ranges — around two tonnes of downforce at 300 km/h.
              </p>
              <div className="mt-7 flex items-center gap-4">
                <button
                  onClick={() => setIntro(false)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.97]"
                >
                  <Play className="size-4" /> Enter the tunnel
                </button>
                <span className="hidden text-xs text-ink-3 md:inline">Space pause · E explode · 1–6 views</span>
              </div>
              <a
                href="https://github.com/jonymusky/f1-wind-tunnel"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-10 inline-block text-xs text-ink-3 hover:text-ink-2"
              >
                Source on GitHub · @jonymusky
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
