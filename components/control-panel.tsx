"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Slider } from "@/components/ui/slider"
import {
  Wind,
  ArrowDown,
  ArrowUp,
  Gauge,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Activity,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings2
} from "lucide-react"

interface ControlPanelProps {
  config: {
    windSpeed: number
    angleOfAttack: number
    frontWing: number
    rearWing: number
    sidepods: number
    drsEnabled: boolean
  }
  setConfig: (config: ControlPanelProps['config']) => void
  downforce: number
  drag: number
  efficiency: number
  isMobile: boolean
  onToggleSimulation: () => void
  isSimulating: boolean
}

// Telemetry gauge component
const TelemetryGauge = ({
  value,
  max,
  label,
  unit,
  color,
  icon: Icon
}: {
  value: number
  max: number
  label: string
  unit: string
  color: 'red' | 'cyan' | 'green' | 'amber'
  icon: React.ElementType
}) => {
  const percentage = Math.min((value / max) * 100, 100)
  const colorMap = {
    red: {
      text: 'text-[#e10600]',
      bg: 'bg-[#e10600]',
      glow: 'shadow-[0_0_15px_rgba(225,6,0,0.5)]',
      gradient: 'from-[#e10600] to-[#8b0000]'
    },
    cyan: {
      text: 'text-[#00d4ff]',
      bg: 'bg-[#00d4ff]',
      glow: 'shadow-[0_0_15px_rgba(0,212,255,0.5)]',
      gradient: 'from-[#00d4ff] to-[#0088aa]'
    },
    green: {
      text: 'text-[#00ff88]',
      bg: 'bg-[#00ff88]',
      glow: 'shadow-[0_0_15px_rgba(0,255,136,0.5)]',
      gradient: 'from-[#00ff88] to-[#00aa55]'
    },
    amber: {
      text: 'text-[#ff8c00]',
      bg: 'bg-[#ff8c00]',
      glow: 'shadow-[0_0_15px_rgba(255,140,0,0.5)]',
      gradient: 'from-[#ff8c00] to-[#cc6600]'
    }
  }

  const colors = colorMap[color]

  return (
    <div className="hud-border rounded-lg p-4 relative overflow-hidden group hover:border-[#3a3a3a] transition-colors">
      {/* Background glow effect */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${colors.bg}`}
        style={{ filter: 'blur(20px)' }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${colors.text}`} />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-display">
              {label}
            </span>
          </div>
        </div>

        {/* Value display */}
        <div className="flex items-baseline gap-1 mb-3">
          <motion.span
            key={value}
            initial={{ opacity: 0.5, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-3xl font-telemetry font-bold ${colors.text}`}
            style={{
              textShadow: color === 'cyan' ? '0 0 10px rgba(0,212,255,0.5)' :
                          color === 'red' ? '0 0 10px rgba(225,6,0,0.5)' :
                          color === 'green' ? '0 0 10px rgba(0,255,136,0.5)' :
                          '0 0 10px rgba(255,140,0,0.5)'
            }}
          >
            {value}
          </motion.span>
          <span className="text-sm text-[#555] font-telemetry">{unit}</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${colors.gradient}`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {/* Animated glow */}
          <motion.div
            className={`absolute inset-y-0 w-4 ${colors.bg} opacity-50`}
            animate={{
              left: ['0%', `${percentage}%`],
              opacity: [0, 0.8, 0]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ filter: 'blur(4px)' }}
          />
        </div>
      </div>
    </div>
  )
}

// Parameter slider component
const ParameterSlider = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  icon: Icon,
  color = 'cyan'
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number[]) => void
  icon: React.ElementType
  color?: 'cyan' | 'red'
}) => {
  const colorClasses = color === 'cyan'
    ? 'text-[#00d4ff]'
    : 'text-[#e10600]'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colorClasses}`} />
          <span className="text-xs uppercase tracking-[0.15em] text-[#888] font-display">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-1 px-3 py-1 bg-[#1a1a1a] rounded">
          <span className={`font-telemetry text-sm font-bold ${colorClasses}`}>
            {value}
          </span>
          <span className="text-[10px] text-[#555] font-telemetry">{unit}</span>
        </div>
      </div>

      <div className="relative">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={onChange}
          className="w-full"
        />
        {/* Track marks */}
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[8px] text-[#333] font-telemetry">{min}</span>
          <span className="text-[8px] text-[#333] font-telemetry">{max}</span>
        </div>
      </div>
    </div>
  )
}

export default function ControlPanel({
  config,
  setConfig,
  downforce,
  drag,
  efficiency,
  isMobile,
  onToggleSimulation,
  isSimulating,
}: ControlPanelProps) {
  const [expanded, setExpanded] = useState(!isMobile)
  const [activeTab, setActiveTab] = useState<'primary' | 'advanced'>('primary')

  const handleWindSpeedChange = (value: number[]) => {
    setConfig({ ...config, windSpeed: value[0] })
  }

  const handleAngleChange = (value: number[]) => {
    setConfig({ ...config, angleOfAttack: value[0] })
  }

  const handleFrontWingChange = (value: number[]) => {
    setConfig({ ...config, frontWing: value[0] })
  }

  const handleRearWingChange = (value: number[]) => {
    setConfig({ ...config, rearWing: value[0] })
  }

  const handleSidepodsChange = (value: number[]) => {
    setConfig({ ...config, sidepods: value[0] })
  }

  return (
    <motion.div
      className="bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/95 to-transparent backdrop-blur-md"
    >
      {/* Top accent line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-[#e10600] to-transparent" />

      <div className="p-4 md:p-6">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Simulation control button */}
            <motion.button
              onClick={onToggleSimulation}
              className={`flex items-center gap-3 px-6 py-3 rounded font-display text-sm uppercase tracking-wider transition-all ${
                isSimulating
                  ? 'bg-[#1a1a1a] text-[#888] border border-[#333] hover:border-[#555]'
                  : 'bg-[#e10600] text-white hover:shadow-[0_0_30px_rgba(225,6,0,0.4)]'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSimulating ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start</span>
                </>
              )}
            </motion.button>

            {/* Status */}
            <div className="hidden md:flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-[#00ff88] animate-pulse' : 'bg-[#e10600]'}`} />
              <span className="text-xs text-[#555] font-telemetry uppercase">
                {isSimulating ? 'Simulation Active' : 'Simulation Paused'}
              </span>
            </div>
          </div>

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 px-3 py-2 rounded text-[#555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <span className="text-xs font-display uppercase tracking-wider hidden md:block">
              {expanded ? 'Collapse' : 'Expand'}
            </span>
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Tab selector */}
              <div className="flex gap-1 mb-6 p-1 bg-[#0a0a0a] rounded-lg inline-flex">
                <button
                  onClick={() => setActiveTab('primary')}
                  className={`px-4 py-2 rounded text-xs font-display uppercase tracking-wider transition-all ${
                    activeTab === 'primary'
                      ? 'bg-[#e10600] text-white'
                      : 'text-[#555] hover:text-white'
                  }`}
                >
                  Primary
                </button>
                <button
                  onClick={() => setActiveTab('advanced')}
                  className={`px-4 py-2 rounded text-xs font-display uppercase tracking-wider transition-all ${
                    activeTab === 'advanced'
                      ? 'bg-[#e10600] text-white'
                      : 'text-[#555] hover:text-white'
                  }`}
                >
                  Advanced
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Controls section */}
                <div className="lg:col-span-7">
                  <AnimatePresence mode="wait">
                    {activeTab === 'primary' ? (
                      <motion.div
                        key="primary"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                      >
                        <div className="hud-border rounded-lg p-4">
                          <ParameterSlider
                            label="Wind Speed"
                            value={config.windSpeed}
                            min={0}
                            max={320}
                            step={5}
                            unit="km/h"
                            onChange={handleWindSpeedChange}
                            icon={Wind}
                            color="cyan"
                          />
                        </div>

                        <div className="hud-border rounded-lg p-4">
                          <ParameterSlider
                            label="Angle of Attack"
                            value={config.angleOfAttack}
                            min={-10}
                            max={10}
                            step={0.5}
                            unit="deg"
                            onChange={handleAngleChange}
                            icon={ArrowUp}
                            color="red"
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="advanced"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                      >
                        <div className="hud-border rounded-lg p-4">
                          <ParameterSlider
                            label="Front Wing"
                            value={config.frontWing}
                            min={0}
                            max={100}
                            step={1}
                            unit="%"
                            onChange={handleFrontWingChange}
                            icon={Settings2}
                            color="cyan"
                          />
                        </div>

                        <div className="hud-border rounded-lg p-4">
                          <ParameterSlider
                            label="Rear Wing"
                            value={config.rearWing}
                            min={0}
                            max={100}
                            step={1}
                            unit="%"
                            onChange={handleRearWingChange}
                            icon={Settings2}
                            color="cyan"
                          />
                        </div>

                        <div className="hud-border rounded-lg p-4">
                          <ParameterSlider
                            label="Sidepods"
                            value={config.sidepods}
                            min={0}
                            max={100}
                            step={1}
                            unit="%"
                            onChange={handleSidepodsChange}
                            icon={Settings2}
                            color="cyan"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Telemetry section */}
                <div className="lg:col-span-5">
                  <div className="grid grid-cols-3 gap-3">
                    <TelemetryGauge
                      value={downforce}
                      max={1000}
                      label="Downforce"
                      unit="kg"
                      color="green"
                      icon={ArrowDown}
                    />

                    <TelemetryGauge
                      value={drag}
                      max={500}
                      label="Drag"
                      unit="kg"
                      color="red"
                      icon={Wind}
                    />

                    <TelemetryGauge
                      value={efficiency}
                      max={5}
                      label="L/D Ratio"
                      unit=":1"
                      color="cyan"
                      icon={Activity}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed mini-display */}
        {!expanded && (
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-[#00ff88]" />
              <span className="font-telemetry text-sm text-[#00ff88]">{downforce}</span>
              <span className="text-[10px] text-[#555]">kg</span>
            </div>
            <div className="w-[1px] h-4 bg-[#333]" />
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-[#e10600]" />
              <span className="font-telemetry text-sm text-[#e10600]">{drag}</span>
              <span className="text-[10px] text-[#555]">kg</span>
            </div>
            <div className="w-[1px] h-4 bg-[#333]" />
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00d4ff]" />
              <span className="font-telemetry text-sm text-[#00d4ff]">{efficiency}:1</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
