"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wind, ArrowDown, ArrowUp, Gauge, Maximize2, Minimize2, Play, Pause, BarChart2 } from "lucide-react"

export default function ControlPanel({
  config,
  setConfig,
  downforce,
  drag,
  efficiency,
  isMobile,
  onToggleSimulation,
  isSimulating,
}) {
  const [expanded, setExpanded] = useState(!isMobile)
  const [animateValues, setAnimateValues] = useState(false)

  // Animate values when simulation starts
  useEffect(() => {
    if (isSimulating) {
      setAnimateValues(true)
      const timer = setTimeout(() => setAnimateValues(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isSimulating])

  const handleWindSpeedChange = (value) => {
    setConfig({ ...config, windSpeed: value[0] })
  }

  const handleAngleChange = (value) => {
    setConfig({ ...config, angleOfAttack: value[0] })
  }

  const handleFrontWingChange = (value) => {
    setConfig({ ...config, frontWing: value[0] })
  }

  const handleRearWingChange = (value) => {
    setConfig({ ...config, rearWing: value[0] })
  }

  const handleSidepodsChange = (value) => {
    setConfig({ ...config, sidepods: value[0] })
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800 text-white p-4 md:p-6"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <Gauge className="w-5 h-5 mr-2 text-red-500" />
          <h2 className="text-lg font-bold">Wind Tunnel Controls</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-400 hover:text-white"
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>

      {expanded && (
        <>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="basic">Basic Controls</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm text-zinc-400">Wind Speed</label>
                    <span className="text-sm font-mono">{config.windSpeed} km/h</span>
                  </div>
                  <div className="flex items-center">
                    <Wind className="w-4 h-4 mr-2 text-blue-400" />
                    <Slider
                      value={[config.windSpeed]}
                      min={0}
                      max={320}
                      step={5}
                      onValueChange={handleWindSpeedChange}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm text-zinc-400">Angle of Attack</label>
                    <span className="text-sm font-mono">{config.angleOfAttack}°</span>
                  </div>
                  <div className="flex items-center">
                    <ArrowUp className="w-4 h-4 mr-2 text-green-400" />
                    <Slider
                      value={[config.angleOfAttack]}
                      min={-10}
                      max={10}
                      step={0.5}
                      onValueChange={handleAngleChange}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm text-zinc-400">Front Wing</label>
                    <span className="text-sm font-mono">{config.frontWing}%</span>
                  </div>
                  <Slider value={[config.frontWing]} min={0} max={100} step={1} onValueChange={handleFrontWingChange} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm text-zinc-400">Rear Wing</label>
                    <span className="text-sm font-mono">{config.rearWing}%</span>
                  </div>
                  <Slider value={[config.rearWing]} min={0} max={100} step={1} onValueChange={handleRearWingChange} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm text-zinc-400">Sidepods</label>
                    <span className="text-sm font-mono">{config.sidepods}%</span>
                  </div>
                  <Slider value={[config.sidepods]} min={0} max={100} step={1} onValueChange={handleSidepodsChange} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <motion.div
              className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700"
              animate={
                animateValues
                  ? {
                      scale: [1, 1.05, 1],
                      borderColor: ["#374151", "#22c55e", "#374151"],
                    }
                  : {}
              }
              transition={{ duration: 1 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <ArrowDown className="w-4 h-4 mr-2 text-green-500" />
                  <h3 className="font-medium">Downforce</h3>
                </div>
                <motion.span
                  className="text-xl font-bold font-mono text-green-500"
                  animate={animateValues ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1 }}
                >
                  {downforce} kg
                </motion.span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2">
                <motion.div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, downforce / 10)}%` }}
                  animate={
                    animateValues
                      ? {
                          backgroundColor: ["#22c55e", "#4ade80", "#22c55e"],
                        }
                      : {}
                  }
                  transition={{ duration: 1 }}
                />
              </div>
            </motion.div>

            <motion.div
              className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700"
              animate={
                animateValues
                  ? {
                      scale: [1, 1.05, 1],
                      borderColor: ["#374151", "#ef4444", "#374151"],
                    }
                  : {}
              }
              transition={{ duration: 1 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Wind className="w-4 h-4 mr-2 text-red-500" />
                  <h3 className="font-medium">Drag</h3>
                </div>
                <motion.span
                  className="text-xl font-bold font-mono text-red-500"
                  animate={animateValues ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1 }}
                >
                  {drag} kg
                </motion.span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2">
                <motion.div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, drag / 5)}%` }}
                  animate={
                    animateValues
                      ? {
                          backgroundColor: ["#ef4444", "#f87171", "#ef4444"],
                        }
                      : {}
                  }
                  transition={{ duration: 1 }}
                />
              </div>
            </motion.div>

            <motion.div
              className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700"
              animate={
                animateValues
                  ? {
                      scale: [1, 1.05, 1],
                      borderColor: ["#374151", "#3b82f6", "#374151"],
                    }
                  : {}
              }
              transition={{ duration: 1 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <BarChart2 className="w-4 h-4 mr-2 text-blue-500" />
                  <h3 className="font-medium">Efficiency</h3>
                </div>
                <motion.span
                  className="text-xl font-bold font-mono text-blue-500"
                  animate={animateValues ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1 }}
                >
                  {efficiency}:1
                </motion.span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2">
                <motion.div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, efficiency * 10)}%` }}
                  animate={
                    animateValues
                      ? {
                          backgroundColor: ["#3b82f6", "#60a5fa", "#3b82f6"],
                        }
                      : {}
                  }
                  transition={{ duration: 1 }}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}

      <div className="mt-6 flex justify-center">
        <Button
          size="lg"
          className={`${isSimulating ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500 hover:bg-red-600"} text-white px-8 transition-all`}
          onClick={onToggleSimulation}
        >
          {isSimulating ? (
            <>
              <Pause className="w-5 h-5 mr-2" /> Simulation Running
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" /> Start Simulation
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}
