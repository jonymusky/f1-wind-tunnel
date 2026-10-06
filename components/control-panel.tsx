"use client"

import { AlertTriangle, ChevronLeft, RotateCcw } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { toKgf, type AeroConfig, type AeroResult } from "@/lib/aero"
import { SPEED_RANGE, turbo } from "@/lib/flow-field"
import { CP_RANGE } from "@/components/sim/materials"
import type { FlowMode } from "@/components/sim/flow"
import { PART_BY_ID, PARTS, type PartId } from "@/lib/parts"

export interface VisualSettings {
  flow: FlowMode
  pressure: boolean
  smokeX: number
}

/* ---------- primitives ---------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
  size?: "sm" | "md"
}) {
  return (
    <div role="radiogroup" className={cn("flex rounded-lg border border-line bg-black/30 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md font-medium transition-colors",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
            value === o.value ? "bg-white/10 text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Param({
  label,
  hint,
  value,
  display,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  display?: string
  unit: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12.5px] text-ink-2" title={hint}>
          {label}
        </label>
        <span className="tabular text-[12.5px] text-ink">
          {display ?? value}
          <span className="ml-1 text-ink-3">{unit}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} aria-label={label} />
    </div>
  )
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-3.5 border-t border-line px-4 py-4 first:border-t-0">
      <div className="flex items-center justify-between">
        <h3 className="label-xs">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/* ---------- setup ---------- */

export function SetupPanel({
  config,
  onChange,
  onReset,
  visual,
  onVisualChange,
}: {
  config: AeroConfig
  onChange: (patch: Partial<AeroConfig>) => void
  onReset: () => void
  visual: VisualSettings
  onVisualChange: (patch: Partial<VisualSettings>) => void
}) {
  return (
    <div>
      <Section
        title="Tunnel"
        aside={
          <button onClick={onReset} className="flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink-2">
            <RotateCcw className="size-3" /> Reset
          </button>
        }
      >
        <Param label="Air speed" value={config.speed} unit="km/h" min={50} max={350} step={5} onChange={(v) => onChange({ speed: v })} />
        <Param
          label="Yaw"
          hint="Turntable angle — simulates crosswind or a car sliding through a corner"
          value={config.yaw}
          display={config.yaw.toFixed(1)}
          unit="°"
          min={-8}
          max={8}
          step={0.5}
          onChange={(v) => onChange({ yaw: v })}
        />
      </Section>

      <Section title="Car setup">
        <Param
          label="Front wing flap"
          value={config.frontWing}
          unit="°"
          min={4}
          max={30}
          step={1}
          onChange={(v) => onChange({ frontWing: v })}
        />
        <Param
          label="Rear wing angle"
          value={config.rearWing}
          unit="°"
          min={6}
          max={36}
          step={1}
          onChange={(v) => onChange({ rearWing: v })}
        />
        <Param
          label="Ride height"
          hint="Floor height above the road. Lower = more ground effect, until the floor stalls"
          value={config.rideHeight}
          unit="mm"
          min={14}
          max={80}
          step={1}
          onChange={(v) => onChange({ rideHeight: v })}
        />
        <Param
          label="Rake"
          hint="Rear higher than front"
          value={config.rake}
          display={config.rake.toFixed(1)}
          unit="°"
          min={-0.5}
          max={2}
          step={0.1}
          onChange={(v) => onChange({ rake: v })}
        />
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] text-ink-2">Active aero</span>
            <span className="text-[11px] text-ink-3">{config.mode === "straight" ? "flaps open" : "full load"}</span>
          </div>
          <Segmented
            value={config.mode}
            onChange={(mode) => onChange({ mode })}
            options={[
              { value: "corner", label: "Corner mode" },
              { value: "straight", label: "Straight mode" },
            ]}
          />
        </div>
      </Section>

      <Section title="Visualisation">
        <Segmented
          value={visual.flow}
          onChange={(flow) => onVisualChange({ flow })}
          options={[
            { value: "streamlines", label: "Streamlines" },
            { value: "smoke", label: "Smoke wand" },
            { value: "off", label: "Off" },
          ]}
        />
        {visual.flow === "smoke" && (
          <Param
            label="Wand position"
            value={visual.smokeX}
            display={(visual.smokeX * 100).toFixed(0)}
            unit="cm"
            min={-1}
            max={1}
            step={0.02}
            onChange={(v) => onVisualChange({ smokeX: v })}
          />
        )}
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-[12.5px] text-ink-2">Surface pressure (Cp)</span>
          <button
            role="switch"
            aria-checked={visual.pressure}
            onClick={() => onVisualChange({ pressure: !visual.pressure })}
            className={cn(
              "relative h-5 w-9 rounded-full border transition-colors",
              visual.pressure ? "border-transparent bg-ink-2" : "border-line-strong bg-black/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-3.5 rounded-full transition-transform",
                visual.pressure ? "translate-x-4 bg-bg" : "bg-ink-3",
              )}
            />
          </button>
        </label>
      </Section>
    </div>
  )
}

/* ---------- telemetry ---------- */

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

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

export function TelemetryPanel({ aero, config }: { aero: AeroResult; config: AeroConfig }) {
  const front = aero.frontBalance * 100
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="label-xs">Downforce</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="tabular text-[34px] leading-none font-medium tracking-tight text-ink">{fmt(toKgf(aero.downforce))}</span>
            <span className="tabular text-xs text-ink-3">kgf</span>
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-[11px] text-ink-3">{fmt(aero.downforce / 1000, 1)} kN</div>
          <div className="tabular text-[11px] text-ink-3">{fmt(aero.downforceToWeight, 2)}× car weight</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-4">
        <Readout label="Drag" value={fmt(toKgf(aero.drag))} unit="kgf" sub={`${fmt(aero.dragPower)} kW`} />
        <Readout label="L/D" value={fmt(aero.liftToDrag, 2)} sub={`CL ${fmt(aero.cl, 2)} · CD ${fmt(aero.cd, 2)}`} />
        <Readout label="Side force" value={fmt(toKgf(Math.abs(aero.sideForce)))} unit="kgf" sub={config.yaw === 0 ? "no yaw" : `${config.yaw > 0 ? "right" : "left"}`} />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="label-xs">Aero balance</span>
          <span className="tabular text-[12px] text-ink">
            {fmt(front, 1)}% <span className="text-ink-3">front</span>
          </span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-line-strong">
          {/* Typical working window */}
          <div className="absolute inset-y-0 rounded-full bg-white/12" style={{ left: "40%", width: "7%" }} />
          <div
            className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink transition-[left] duration-300"
            style={{ left: `${Math.min(70, Math.max(25, front))}%` }}
          />
        </div>
        <div className="tabular mt-1 flex justify-between text-[10px] text-ink-3">
          <span>rear</span>
          <span>window 40–47%</span>
          <span>front</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4 border-t border-line pt-3">
        <Readout label="Floor" value={fmt(aero.clA.floor, 2)} unit="m²" />
        <Readout label="Front wing" value={fmt(aero.clA.frontWing, 2)} unit="m²" />
        <Readout label="Rear wing" value={fmt(aero.clA.rearWing, 2)} unit="m²" />
      </div>
      <p className="text-[11px] leading-snug text-ink-3">
        CL·A by component · CD·A {fmt(aero.cdA, 2)} m². Downforce exceeds weight above{" "}
        <span className="tabular text-ink-2">{fmt(aero.invertedSpeed)} km/h</span> — fast enough to drive on the ceiling.
      </p>

      {aero.floorStall && (
        <div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 px-2.5 py-2 text-[11.5px] text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>Floor stalled below 24 mm — diffuser flow separates. On track this is porpoising.</span>
        </div>
      )}
    </div>
  )
}

/* ---------- legend ---------- */

function gradient(steps = 12) {
  const stops: string[] = []
  const rgb: [number, number, number] = [0, 0, 0]
  for (let i = 0; i <= steps; i++) {
    turbo(i / steps, rgb)
    stops.push(`rgb(${Math.round(rgb[0] * 255)} ${Math.round(rgb[1] * 255)} ${Math.round(rgb[2] * 255)}) ${((i / steps) * 100).toFixed(0)}%`)
  }
  return `linear-gradient(90deg, ${stops.join(",")})`
}
const GRADIENT = gradient()

export function Legend({ visual }: { visual: VisualSettings }) {
  const items: { title: string; lo: string; mid: string; hi: string; loLabel: string; hiLabel: string }[] = []
  if (visual.flow === "streamlines") {
    items.push({
      title: "Local velocity  V / V∞",
      lo: SPEED_RANGE[0].toFixed(1),
      mid: "1.0",
      hi: SPEED_RANGE[1].toFixed(1),
      loLabel: "slower",
      hiLabel: "faster",
    })
  }
  if (visual.pressure) {
    items.push({
      title: "Surface pressure  Cp",
      lo: CP_RANGE[0].toFixed(1),
      mid: "0",
      hi: `+${CP_RANGE[1].toFixed(1)}`,
      loLabel: "suction",
      hiLabel: "stagnation",
    })
  }
  if (!items.length) return null
  return (
    <div className="panel space-y-3 px-3.5 py-3">
      {items.map((it) => {
        const midPct =
          it.title.startsWith("Local")
            ? ((1 - SPEED_RANGE[0]) / (SPEED_RANGE[1] - SPEED_RANGE[0])) * 100
            : ((0 - CP_RANGE[0]) / (CP_RANGE[1] - CP_RANGE[0])) * 100
        return (
          <div key={it.title} className="w-56">
            <div className="label-xs normal-case tracking-normal">{it.title}</div>
            <div className="mt-2 h-2 rounded-sm" style={{ background: GRADIENT }} />
            <div className="tabular relative mt-1 h-3 text-[10px] text-ink-3">
              <span className="absolute left-0">{it.lo}</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${midPct}%` }}>
                {it.mid}
              </span>
              <span className="absolute right-0">{it.hi}</span>
            </div>
            <div className="flex justify-between text-[10px] text-ink-3">
              <span>{it.loLabel}</span>
              <span>{it.hiLabel}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- exploded view: components ---------- */

export function PartsPanel({
  aero,
  config,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  aero: AeroResult
  config: AeroConfig
  selected: PartId | null
  hovered: PartId | null
  onSelect: (id: PartId | null) => void
  onHover: (id: PartId | null) => void
}) {
  const part = selected ? PART_BY_ID[selected] : null
  return (
    <div>
      {part ? (
        <div className="space-y-3 border-b border-line px-4 py-4">
          <button onClick={() => onSelect(null)} className="flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink-2">
            <ChevronLeft className="size-3" /> All components
          </button>
          <div>
            <div className="label-xs text-accent!">{String(PARTS.indexOf(part) + 1).padStart(2, "0")}</div>
            <h3 className="mt-1.5 text-[17px] font-semibold tracking-tight">{part.name}</h3>
            <div className="mt-0.5 text-[12.5px] text-ink-2">{part.role}</div>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-2">{part.body}</p>
          {part.live && (
            <div className="rounded-md border border-line bg-black/25 px-3 py-2">
              <div className="label-xs">Live, current setup</div>
              <div className="tabular mt-1.5 text-[12px] leading-snug text-ink">{part.live(aero, config)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="border-b border-line px-4 py-4">
          <h3 className="label-xs">Components</h3>
          <p className="mt-2 text-[12.5px] leading-snug text-ink-2">
            Pick a part, here or on the car, to see what it does. Drag the slider to take the car apart.
          </p>
        </div>
      )}
      <ol className="py-1.5">
        {PARTS.map((p, i) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(selected === p.id ? null : p.id)}
              onPointerEnter={() => onHover(p.id)}
              onPointerLeave={() => onHover(null)}
              className={cn(
                "flex w-full items-baseline gap-3 px-4 py-1.5 text-left transition-colors",
                selected === p.id ? "bg-white/8" : hovered === p.id ? "bg-white/4" : "",
              )}
            >
              <span className="tabular w-5 shrink-0 text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className={cn("block text-[13px]", selected === p.id ? "text-ink" : "text-ink-2")}>{p.name}</span>
                <span className="block truncate text-[11.5px] text-ink-3">{p.role}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
