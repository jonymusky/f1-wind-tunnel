"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Boxes, ChevronDown, Flag, Pause, Play, Wind } from "lucide-react"
import { LapPanel, TrackSetupPanel, TrackStage, type ColorBy } from "@/components/track/track-mode"
import { DEFAULT_SPEC, formatLap, simulateLap, type CarSpec, type Setup, type TrackGeometry } from "@/lib/lap/sim"
import { loadTrack, TRACK_BY_ID } from "@/lib/tracks"
import { LIVERY_BY_ID } from "@/lib/liveries"
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

  // Track mode: the same car, driven around a circuit by the lap simulator
  const [place, setPlace] = useState<"tunnel" | "track">("tunnel")
  const onTrack = place === "track"
  const [trackId, setTrackId] = useState("silverstone")
  const [spec, setSpec] = useState<CarSpec>(DEFAULT_SPEC)
  const [colorBy, setColorBy] = useState<ColorBy>("speed")
  const [rate, setRate] = useState(1)
  const [geometry, setGeometry] = useState<{ id: string; track: TrackGeometry } | null>(null)
  const [optimising, setOptimising] = useState(false)
  const [liveryId, setLiveryId] = useState("lab")
  const livery = LIVERY_BY_ID[liveryId]
  const trackInfo = TRACK_BY_ID[trackId]
  // Loaded in the tunnel too, so the lap time of the current setup is always on screen
  useEffect(() => {
    let live = true
    loadTrack(trackId).then((track) => live && setGeometry({ id: trackId, track }))
    return () => {
      live = false
    }
  }, [trackId])

  // #track and #track=monza open the track directly, and the address follows what is on screen
  useEffect(() => {
    const read = () => {
      const m = /^#track(?:=([a-z]+))?$/.exec(window.location.hash)
      if (m) {
        setPlace("track")
        setIntro(false)
        if (m[1] && TRACK_BY_ID[m[1]]) setTrackId(m[1])
      } else if (window.location.hash === "#tunnel") {
        setPlace("tunnel")
        setIntro(false)
      }
    }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])
  useEffect(() => {
    if (intro) return
    const hash = onTrack ? `#track=${trackId}` : "#tunnel"
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash)
  }, [intro, onTrack, trackId])
  const track = geometry?.id === trackId ? geometry.track : null
  const carSetup: Setup = useMemo(
    () => ({ frontWing: config.frontWing, rearWing: config.rearWing, rideHeight: config.rideHeight, rake: config.rake }),
    [config.frontWing, config.rearWing, config.rideHeight, config.rake],
  )
  const lap = useMemo(() => (track ? simulateLap(track, carSetup, spec, trackInfo.altitude) : null), [track, carSetup, spec, trackInfo.altitude])
  const baseline = useMemo(
    () => (track ? simulateLap(track, { frontWing: DEFAULT_CONFIG.frontWing, rearWing: DEFAULT_CONFIG.rearWing, rideHeight: DEFAULT_CONFIG.rideHeight, rake: DEFAULT_CONFIG.rake }, DEFAULT_SPEC, trackInfo.altitude) : null),
    [track, trackInfo.altitude],
  )
  const optimise = () => {
    if (!track) return
    setOptimising(true)
    // a couple of hundred laps: defer so the button can show its busy state first
    setTimeout(() => {
      let best = { time: Infinity, frontWing: config.frontWing, rearWing: config.rearWing }
      for (let rearWing = 6; rearWing <= 36; rearWing += 2) {
        for (let frontWing = 4; frontWing <= 30; frontWing += 2) {
          const time = simulateLap(track, { ...carSetup, frontWing, rearWing }, spec, trackInfo.altitude).lapTime
          if (time < best.time) best = { time, frontWing, rearWing }
        }
      }
      setConfig((c) => ({ ...c, frontWing: best.frontWing, rearWing: best.rearWing }))
      setOptimising(false)
    }, 30)
  }

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
    paint: livery.paint,
    accent: livery.accent,
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return
      if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setRunning((r) => !r)
      }
      // the rest are tunnel shortcuts: exploded view and camera
      if (onTrack) return
      if (e.key === "e" || e.key === "E") toggleExplode()
      if (e.key === "Escape") setSelected(null)
      const n = Number(e.key)
      if (n >= 1 && n <= VIEW_OPTIONS.length) setView(VIEW_OPTIONS[n - 1].value)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const patch = (p: Partial<AeroConfig>) => setConfig((c) => ({ ...c, ...p }))
  const patchVisual = (p: Partial<VisualSettings>) => setVisual((v) => ({ ...v, ...p }))

  const setup = onTrack ? (
    <>
      <TrackSetupPanel
        spec={spec}
        onSpec={(p) => setSpec((sp) => ({ ...sp, ...p }))}
        onReset={() => {
          setSpec(DEFAULT_SPEC)
          setConfig(DEFAULT_CONFIG)
        }}
        onOptimise={optimise}
        optimising={optimising}
      />
      <div className="border-t border-line">
        <SetupPanel config={config} onChange={patch} onReset={() => setConfig(DEFAULT_CONFIG)} visual={visual} onVisualChange={patchVisual} context="track" livery={liveryId} onLivery={setLiveryId} />
      </div>
    </>
  ) : (
    <SetupPanel config={config} onChange={patch} onReset={() => setConfig(DEFAULT_CONFIG)} visual={visual} onVisualChange={patchVisual} livery={liveryId} onLivery={setLiveryId} />
  )
  const stage = (
    <TrackStage
      track={track}
      lap={lap}
      baseline={baseline}
      info={trackInfo}
      running={running}
      rate={rate}
      colorBy={colorBy}
      compact={isMobile}
      livery={livery}
      onTrack={setTrackId}
      onColorBy={setColorBy}
      onRate={setRate}
    />
  )
  const goTo = (p: "tunnel" | "track") => {
    setPlace(p)
    if (p === "track") {
      setExplode(0)
      setSelected(null)
      if (sheet === "parts") setSheet("data")
    }
  }
  const lapDelta = lap && baseline ? lap.lapTime - baseline.lapTime : 0
  // In the tunnel: what the setup on screen is worth on track, one click from driving it
  const lapCard = (
    <button
      onClick={() => goTo("track")}
      className="group flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-white/5"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-white">
        <Flag className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] text-ink-3">This setup at {trackInfo.name}</span>
        <span className="tabular block text-[17px] leading-tight font-medium text-ink">
          {lap ? formatLap(lap.lapTime) : "…"}
          {lap && Math.abs(lapDelta) >= 0.0005 && (
            <span className={cn("ml-2 text-[12px]", lapDelta < 0 ? "text-emerald-400" : "text-accent-hover")}>
              {lapDelta > 0 ? "+" : "−"}
              {Math.abs(lapDelta).toFixed(3)} s
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-1 text-[12px] font-medium text-ink-2 group-hover:text-ink">
        Drive it <ArrowRight className="size-3.5" />
      </span>
    </button>
  )
  const telemetry = onTrack ? (
    <LapPanel lap={lap} baseline={baseline} info={trackInfo} />
  ) : (
    <>
      {lapCard}
      <TelemetryPanel aero={aero} config={config} />
    </>
  )
  // Primary navigation: the two places the car can be
  const placeSwitch = (
    <nav aria-label="Where the car is" className="panel pointer-events-auto flex gap-1 !rounded-xl p-1">
      {(
        [
          { value: "tunnel", label: "Wind tunnel", icon: Wind },
          { value: "track", label: "Race track", icon: Flag },
        ] as const
      ).map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => goTo(value)}
          aria-current={place === value ? "page" : undefined}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-medium whitespace-nowrap transition-colors",
            place === value ? "bg-accent text-white" : "text-ink-2 hover:bg-white/8 hover:text-ink",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </nav>
  )

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
      {onTrack && (
        <div className={cn("absolute z-0", isMobile ? "inset-x-3 top-[116px] bottom-[76px]" : "top-[76px] right-[336px] bottom-4 left-6")}>{stage}</div>
      )}
      {!onTrack && (
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
      )}

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
            <div className="text-[11px] text-ink-3">{onTrack ? `Track · ${trackInfo.name}` : "Wind tunnel · test section 1"}</div>
          </div>
        </div>

        {!isMobile && (
          <div className="flex items-center gap-2">{placeSwitch}</div>
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="panel hidden h-8 items-center gap-2 !rounded-lg px-3 sm:flex">
            <span className={cn("size-1.5 rounded-full", running ? "bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]" : "bg-ink-3")} />
            <span className="tabular text-[11.5px] text-ink-2">
              {running ? "RUN" : "HOLD"} {formatClock(runTime)}
            </span>
            <span className="tabular text-[11.5px] text-ink-3">· {onTrack ? (lap ? formatLap(lap.lapTime) : "…") : `${config.speed} km/h`}</span>
          </div>
          {!onTrack && !isMobile && (
            <Segmented className="panel pointer-events-auto !rounded-xl" size="sm" value={view} onChange={setView} options={VIEW_OPTIONS} />
          )}
          {!onTrack && explodeButton}
          {runButton}
        </div>
      </header>

      {isMobile && <div className="absolute inset-x-3 top-14 z-10 [&>nav]:w-full">{placeSwitch}</div>}

      {isMobile ? (
        /* Mobile: one bottom sheet with Data / Setup tabs */
        <div className="absolute inset-x-0 bottom-0 z-10 p-2">
          {!sheetOpen && !exploded && !onTrack && (
            <div className="mb-2">
              <Legend visual={visual} />
            </div>
          )}
          <div className={cn("panel overflow-hidden !rounded-2xl", onTrack && "!bg-panel-solid")}>
            <div className="flex items-center gap-2 p-2">
              <Segmented
                className="flex-1"
                size="sm"
                value={sheet}
                onChange={(s) => {
                  setSheet(s)
                  setSheetOpen(true)
                }}
                options={
                  onTrack
                    ? [
                        { value: "data", label: `Lap · ${lap ? formatLap(lap.lapTime) : "…"}` },
                        { value: "setup", label: "Car & circuit" },
                      ]
                    : [
                        { value: "data", label: `Data · ${Math.round(toKgf(aero.downforce)).toLocaleString("en-US")} kgf` },
                        { value: "setup", label: "Setup" },
                        { value: "parts", label: "Parts" },
                      ]
                }
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
                {sheet === "setup" && !onTrack && (
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
            {partsMode && !onTrack ? (
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
          {!onTrack && (
            <div className="absolute bottom-4 left-4 z-10 flex items-end gap-3">
              <div className="panel w-[340px]">{telemetry}</div>
              {!exploded && <Legend visual={visual} />}
            </div>
          )}
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
            className="absolute inset-0 z-20 flex items-start overflow-y-auto bg-bg/92 px-6 py-8 md:px-14 lg:items-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <motion.div
              className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-12"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
            >
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">Set up a Formula 1 car. Then find out what it is worth.</h1>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                  Trim the wings, ride height and rake in the wind tunnel and watch the air respond. Take the same car to twelve Grand Prix
                  circuits and see the lap time move.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => {
                      goTo("tunnel")
                      setIntro(false)
                    }}
                    className="group rounded-xl bg-accent p-4 text-left text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.98]"
                  >
                    <Wind className="size-5" />
                    <span className="mt-3 block text-[15px] font-semibold">Wind tunnel</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-white/80">Airflow, pressure and forces on the car, in 3D.</span>
                  </button>
                  <button
                    onClick={() => {
                      goTo("track")
                      setIntro(false)
                    }}
                    className="group rounded-xl border border-line-strong bg-white/8 p-4 text-left text-ink transition-[background-color,transform] hover:bg-white/14 active:scale-[0.98]"
                  >
                    <Flag className="size-5" />
                    <span className="mt-3 block text-[15px] font-semibold">Race track</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">Lap times and telemetry at twelve circuits.</span>
                  </button>
                </div>
                <a
                  href="https://github.com/jonymusky/f1-wind-tunnel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-block text-xs text-ink-3 hover:text-ink-2"
                >
                  Source on GitHub, by @jonymusky
                </a>
              </div>
              <IntroVideo />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The feature tour. Decorative: entry never waits for it, and it stays a still image when motion is unwelcome. */
function IntroVideo() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])
  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-black shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
      {reduced ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/tour-poster.jpg" alt="The wind tunnel and the race track views" className="block aspect-video w-full object-cover" />
      ) : (
        <video
          className="block aspect-video w-full object-cover"
          src="/tour.mp4"
          poster="/tour-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="A 40-second tour: airflow in the tunnel, the exploded car, and a lap of a Grand Prix circuit"
        />
      )}
    </div>
  )
}
