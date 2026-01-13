"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { motion, AnimatePresence } from "framer-motion"
import { Wind, Zap, Activity, Timer, Gauge, ChevronRight } from "lucide-react"
import ControlPanel from "@/components/control-panel"
import { useMobile } from "@/hooks/use-mobile"
import * as THREE from "three"

interface WindFlowLineProps {
  startPosition: { x: number; y: number; z: number }
  color: string
  speed: number
  angleOfAttack: number
  frontWing: number
  rearWing: number
}

const WindFlowLine = ({ startPosition, color, speed, angleOfAttack, frontWing, rearWing }: WindFlowLineProps) => {
  const lineRef = useRef<THREE.Line>(null)
  const [positions, setPositions] = useState<Float32Array>(new Float32Array(50 * 3))
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      const initialPositions = new Float32Array(50 * 3)
      for (let i = 0; i < 50; i++) {
        const index = i * 3
        initialPositions[index] = startPosition.x
        initialPositions[index + 1] = startPosition.y
        initialPositions[index + 2] = startPosition.z + (i * 0.1)
      }
      setPositions(initialPositions)
      setInitialized(true)
    }

    const updateInterval = setInterval(() => {
      setPositions(prevPositions => {
        const newPositions = new Float32Array(prevPositions)

        const headX = newPositions[0]
        const headY = newPositions[1]
        const headZ = newPositions[2]

        const speedEffect = speed * 0.02
        const newZ = headZ - speedEffect

        const angleEffect = angleOfAttack * 0.1
        const newY = headY + (angleEffect * speedEffect)

        const frontWingEffect = (frontWing - 50) * 0.003
        const rearWingEffect = (rearWing - 50) * 0.003
        const wingEffect = (frontWingEffect + rearWingEffect) * speedEffect

        const turbulence = 0.003 * speed
        const newX = headX + ((Math.random() - 0.5) * turbulence)

        if (newZ < -15) {
          for (let i = 0; i < 50; i++) {
            const index = i * 3
            newPositions[index] = startPosition.x + (Math.random() - 0.5) * 0.2
            newPositions[index + 1] = startPosition.y + (Math.random() - 0.5) * 0.2
            newPositions[index + 2] = startPosition.z - (i * 0.1)
          }
        } else {
          for (let i = newPositions.length - 3; i >= 3; i -= 3) {
            newPositions[i] = newPositions[i - 3]
            newPositions[i + 1] = newPositions[i - 2]
            newPositions[i + 2] = newPositions[i - 1]
          }

          newPositions[0] = newX
          newPositions[1] = newY + wingEffect
          newPositions[2] = newZ
        }

        return newPositions
      })
    }, 16)

    return () => clearInterval(updateInterval)
  }, [startPosition, speed, angleOfAttack, frontWing, rearWing, initialized])

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
          usage={THREE.DynamicDrawUsage}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent={true}
        opacity={0.8}
        linewidth={2}
        depthWrite={false}
      />
    </line>
  )
}

interface CFDVisualizationProps {
  config: {
    windSpeed: number
    angleOfAttack: number
    frontWing: number
    rearWing: number
    drsEnabled?: boolean
  }
  isSimulating: boolean
}

const CFDVisualization = ({ config, isSimulating }: CFDVisualizationProps) => {
  const fanRef = useRef<THREE.Group>(null)
  const flowLinesRef = useRef<THREE.Group>(null)
  const [flowLines, setFlowLines] = useState<JSX.Element[]>([])

  useEffect(() => {
    if (!isSimulating) return

    const newFlowLines = []
    const count = 300

    for (let i = 0; i < count; i++) {
      let x, y, z, color

      if (i % 4 === 0) {
        x = (Math.random() - 0.5) * 3
        y = Math.random() * 0.5 + 0.7
        z = Math.random() * 8 - 2
        color = "#e10600"
      } else if (i % 4 === 1) {
        x = (Math.random() - 0.5) * 3
        y = Math.random() * 0.3
        z = Math.random() * 8 - 2
        color = "#00d4ff"
      } else if (i % 4 === 2) {
        x = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.5)
        y = Math.random() * 0.8 + 0.2
        z = Math.random() * 8 - 2
        color = "#ff00ff"
      } else {
        x = (Math.random() - 0.5) * 3
        y = Math.random() * 0.1
        z = Math.random() * 8 - 2
        color = "#00ff88"
      }

      let speed = config.windSpeed / 20
      if (i % 4 === 3) speed *= 0.3
      else if (i % 4 === 2) speed *= 1.5

      newFlowLines.push(
        <WindFlowLine
          key={i}
          startPosition={{ x, y, z }}
          color={color}
          speed={speed}
          angleOfAttack={config.angleOfAttack}
          frontWing={config.frontWing}
          rearWing={config.rearWing}
        />
      )
    }

    setFlowLines(newFlowLines)
  }, [isSimulating, config.windSpeed, config.angleOfAttack, config.frontWing, config.rearWing])

  useFrame((state, delta) => {
    if (fanRef.current && isSimulating) {
      fanRef.current.rotation.z += delta * (config.windSpeed / 30)
    }
  })

  return (
    <group>
      <group ref={fanRef} position={[0, 2, -10]}>
        <mesh>
          <boxGeometry args={[6, 6, 0.5]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
        </mesh>
        <group position={[0, 0, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
            <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.1} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} rotation={[0, 0, ((Math.PI * 2) / 5) * i]}>
              <boxGeometry args={[0.2, 2, 0.05]} />
              <meshStandardMaterial color="#252525" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
        </group>
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[30, 30, 30, 30]} />
        <meshStandardMaterial color="#1a1a1a" wireframe={true} opacity={0.3} transparent={true} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} roughness={0.8} />
      </mesh>

      <mesh position={[-5, 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4, 20]} />
        <meshStandardMaterial color="#121212" opacity={0.4} transparent={true} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[5, 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4, 20]} />
        <meshStandardMaterial color="#121212" opacity={0.4} transparent={true} metalness={0.6} roughness={0.4} />
      </mesh>

      <group ref={flowLinesRef}>
        {flowLines}
      </group>
    </group>
  )
}

interface F1CarProps {
  config: {
    angleOfAttack: number
    frontWing: number
    rearWing: number
    drsEnabled?: boolean
    windSpeed: number
  }
}

const F1Car = ({ config }: F1CarProps) => {
  const carRef = useRef<THREE.Group>(null)
  const frontWingRef = useRef<THREE.Group>(null)
  const rearWingRef = useRef<THREE.Group>(null)
  const drsFlapRef = useRef<THREE.Group>(null)
  const [drsOpen, setDrsOpen] = useState(false)

  useEffect(() => {
    if (!carRef.current) return

    carRef.current.rotation.x = THREE.MathUtils.degToRad(config.angleOfAttack * 0.5)

    if (frontWingRef.current) {
      frontWingRef.current.rotation.x = THREE.MathUtils.degToRad((config.frontWing - 50) * 0.1)
    }

    if (rearWingRef.current) {
      rearWingRef.current.rotation.x = THREE.MathUtils.degToRad((config.rearWing - 50) * -0.1)
    }

    if (drsFlapRef.current) {
      const drsAngle = (config.drsEnabled || drsOpen) ? THREE.MathUtils.degToRad(70) : 0
      drsFlapRef.current.rotation.x = drsAngle
    }
  }, [config, drsOpen])

  useEffect(() => {
    const shouldOpenDRS = config.windSpeed > 200
    setDrsOpen(shouldOpenDRS)
  }, [config.windSpeed])

  const bodyColor = "#e0e0e0"
  const carbonColor = "#1a1a1a"
  const accentColor = "#e10600"

  return (
    <group ref={carRef} position={[0, 0, 0]} scale={0.7}>
      <group>
        <mesh castShadow position={[0, 0.15, 0]}>
          <boxGeometry args={[0.8, 0.1, 3]} />
          <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
        </mesh>

        <mesh castShadow position={[0.5, 0.25, 0]}>
          <boxGeometry args={[0.3, 0.2, 1.5]} />
          <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh castShadow position={[-0.5, 0.25, 0]}>
          <boxGeometry args={[0.3, 0.2, 1.5]} />
          <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
        </mesh>

        <group position={[0, 0.15, 1.35]}>
          <mesh castShadow position={[0, 0.025, -0.3]}>
            <cylinderGeometry args={[0.4, 0.5, 0.3, 16]} />
            <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
          </mesh>

          <mesh castShadow position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.3, 0.4, 0.6, 16]} />
            <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
          </mesh>

          <mesh castShadow position={[0, 0.025, 0.45]}>
            <coneGeometry args={[0.25, 0.5, 16]} />
            <meshStandardMaterial color={accentColor} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>

        <mesh castShadow position={[0, 0.35, 0.3]}>
          <boxGeometry args={[0.6, 0.3, 1]} />
          <meshStandardMaterial color={carbonColor} metalness={0.6} roughness={0.4} />
        </mesh>

        <mesh castShadow position={[0, 0.55, 0.3]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#050505" metalness={0.3} roughness={0.7} />
        </mesh>

        <mesh castShadow position={[0, 0.35, -0.7]}>
          <boxGeometry args={[0.6, 0.3, 1.5]} />
          <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
        </mesh>

        <mesh castShadow position={[0, 0.6, -0.2]}>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color={carbonColor} metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      <group ref={frontWingRef} position={[0, 0.1, 1.5]}>
        <mesh castShadow>
          <boxGeometry args={[1.6, 0.05, 0.4]} />
          <meshStandardMaterial color={carbonColor} metalness={0.6} roughness={0.4} />
        </mesh>

        <mesh castShadow position={[0, 0.05, 0]}>
          <boxGeometry args={[1.4, 0.02, 0.3]} />
          <meshStandardMaterial color={accentColor} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0, 0.1, 0]}>
          <boxGeometry args={[1.2, 0.02, 0.2]} />
          <meshStandardMaterial color={carbonColor} metalness={0.6} roughness={0.4} />
        </mesh>

        <mesh castShadow position={[0.8, 0.1, 0]}>
          <boxGeometry args={[0.05, 0.2, 0.4]} />
          <meshStandardMaterial color={accentColor} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[-0.8, 0.1, 0]}>
          <boxGeometry args={[0.05, 0.2, 0.4]} />
          <meshStandardMaterial color={accentColor} metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      <group ref={rearWingRef} position={[0, 0.6, -1.5]}>
        <mesh castShadow>
          <boxGeometry args={[1.4, 0.05, 0.3]} />
          <meshStandardMaterial color={carbonColor} metalness={0.6} roughness={0.4} />
        </mesh>

        <group ref={drsFlapRef} position={[0, 0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 0.05, 0.2]} />
            <meshStandardMaterial color={drsOpen ? "#00ff88" : carbonColor} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>

        <mesh castShadow position={[0.7, 0, 0]}>
          <boxGeometry args={[0.05, 0.5, 0.4]} />
          <meshStandardMaterial color={accentColor} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[-0.7, 0, 0]}>
          <boxGeometry args={[0.05, 0.5, 0.4]} />
          <meshStandardMaterial color={accentColor} metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      <group>
        <mesh castShadow position={[0.7, 0.2, 0.8]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[-0.7, 0.2, 0.8]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.9} />
        </mesh>

        <mesh castShadow position={[0.7, 0.2, -0.8]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[-0.7, 0.2, -0.8]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.9} />
        </mesh>
      </group>

      <mesh castShadow position={[0, 0.2, -1.3]}>
        <boxGeometry args={[1.2, 0.2, 0.4]} />
        <meshStandardMaterial color={carbonColor} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

interface SceneProps {
  config: {
    windSpeed: number
    angleOfAttack: number
    frontWing: number
    rearWing: number
    sidepods: number
    drsEnabled: boolean
  }
  isSimulating: boolean
}

const Scene = ({ config, isSimulating }: SceneProps) => {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(4, 2, 4)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.3} color="#00d4ff" />
      <pointLight position={[5, 3, 5]} intensity={0.2} color="#e10600" />

      <F1Car config={config} />
      <CFDVisualization config={config} isSimulating={isSimulating} />

      <OrbitControls
        enableZoom={true}
        enablePan={true}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        panSpeed={0.5}
        minDistance={2}
        maxDistance={20}
      />
    </>
  )
}

// Telemetry display component
const TelemetryValue = ({ label, value, unit, color = "cyan" }: { label: string; value: string | number; unit: string; color?: string }) => {
  const colorClasses = {
    cyan: "text-[#00d4ff] text-glow-cyan",
    red: "text-[#e10600] text-glow-red",
    green: "text-[#00ff88] text-glow-green",
    amber: "text-[#ff8c00]"
  }

  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-display">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-telemetry font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
          {value}
        </span>
        <span className="text-xs text-[#555] font-telemetry">{unit}</span>
      </div>
    </div>
  )
}

// Speed lines animation for hero
const SpeedLines = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-[1px] bg-gradient-to-r from-transparent via-[#e10600] to-transparent"
          style={{
            top: `${Math.random() * 100}%`,
            left: '-100px',
            width: `${50 + Math.random() * 150}px`,
          }}
          animate={{
            x: ['0vw', '120vw'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "linear",
          }}
        />
      ))}
    </div>
  )
}

export default function WindTunnelSimulator() {
  const isMobile = useMobile()
  const [started, setStarted] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [config, setConfig] = useState({
    windSpeed: 60,
    angleOfAttack: 0,
    frontWing: 50,
    rearWing: 50,
    sidepods: 50,
    drsEnabled: false
  })

  const [downforce, setDownforce] = useState(100)
  const [drag, setDrag] = useState(50)
  const [efficiency, setEfficiency] = useState(2.0)

  // Session timer
  useEffect(() => {
    if (isSimulating) {
      const timer = setInterval(() => {
        setSessionTime(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isSimulating])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const calculateAerodynamicCoefficients = (cfg: typeof config) => {
    const baseCl = 2.5
    const baseCd = 0.8

    const frontWingEffect = (cfg.frontWing / 100) * 0.4
    const rearWingEffect = (cfg.rearWing / 100) * 0.5
    const sidepodsEffect = (cfg.sidepods / 100) * 0.1

    const angleEffect = 1 - Math.abs(cfg.angleOfAttack) / 10

    const cl = baseCl * (frontWingEffect + rearWingEffect + sidepodsEffect) * angleEffect

    const inducedDrag = Math.pow(cl, 2) / (Math.PI * 3.14)
    const cd = baseCd * (frontWingEffect * 0.5 + rearWingEffect * 0.7 + sidepodsEffect * 0.3) + inducedDrag

    return { cl, cd }
  }

  useEffect(() => {
    if (!isSimulating && started) return

    const { cl, cd } = calculateAerodynamicCoefficients(config)

    const airDensity = 1.225
    const velocity = config.windSpeed / 3.6
    const dynamicPressure = 0.5 * airDensity * Math.pow(velocity, 2)

    const referenceArea = 1.5
    const newDownforce = cl * dynamicPressure * referenceArea
    const newDrag = cd * dynamicPressure * referenceArea

    const newEfficiency = newDownforce / (newDrag || 1)

    setDownforce(Math.round(newDownforce))
    setDrag(Math.round(newDrag))
    setEfficiency(Math.round(newEfficiency * 10) / 10)
  }, [config, isSimulating, started])

  const handleConfigChange = (newConfig: typeof config) => {
    setConfig(newConfig)
  }

  const toggleDRS = () => {
    setConfig(prev => ({
      ...prev,
      drsEnabled: !prev.drsEnabled
    }))
  }

  const toggleSimulation = () => {
    setIsSimulating(!isSimulating)
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050505]">
      {/* Carbon fiber background */}
      <div className="absolute inset-0 bg-carbon-fiber" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* Header - Always visible */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="relative">
              <div className="w-10 h-10 rounded bg-gradient-to-br from-[#e10600] to-[#8b0000] flex items-center justify-center">
                <Wind className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -inset-1 bg-[#e10600] rounded opacity-30 blur-md -z-10" />
            </div>
            <div>
              <h1 className="font-display text-lg md:text-xl font-bold tracking-wider text-white">
                AERO<span className="text-[#e10600]">SIM</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#555]">Wind Tunnel Lab</p>
            </div>
          </div>

          {started && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-6"
            >
              {/* Session timer */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 hud-border rounded">
                <Timer className="w-4 h-4 text-[#555]" />
                <span className="font-telemetry text-sm text-[#00d4ff] text-glow-cyan">
                  {formatTime(sessionTime)}
                </span>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2 px-4 py-2 hud-border rounded">
                <div className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-[#00ff88] animate-pulse' : 'bg-[#e10600]'}`} />
                <span className="font-display text-xs uppercase tracking-wider text-[#aaa]">
                  {isSimulating ? 'LIVE' : 'STANDBY'}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </header>

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        {started ? (
          <Canvas shadows camera={{ fov: 45 }}>
            <Scene config={config} isSimulating={isSimulating} />
          </Canvas>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {/* Animated background elements */}
            <SpeedLines />

            {/* Glowing orb */}
            <motion.div
              className="absolute w-[600px] h-[600px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(225, 6, 0, 0.15) 0%, transparent 70%)',
              }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        )}
      </div>

      {/* Left side telemetry panel - Only when simulation started */}
      <AnimatePresence>
        {started && (
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
            className="absolute top-24 left-4 md:left-6 z-10 w-[180px]"
          >
            <div className="hud-border rounded-lg p-4 racing-stripe">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-display">Controls</span>
                </div>
                <div className="space-y-2 text-[11px] text-[#888]">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#252525] flex items-center justify-center text-[8px]">L</div>
                    <span>Rotate view</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#252525] flex items-center justify-center text-[8px]">R</div>
                    <span>Pan view</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#252525] flex items-center justify-center text-[8px] font-telemetry">+/-</div>
                    <span>Zoom</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flow legend */}
            <div className="hud-border rounded-lg p-4 mt-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-display">Flow Types</span>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-[2px] bg-[#e10600]" />
                  <span className="text-[10px] text-[#888]">High pressure</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-[2px] bg-[#00d4ff]" />
                  <span className="text-[10px] text-[#888]">Low pressure</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-[2px] bg-[#ff00ff]" />
                  <span className="text-[10px] text-[#888]">Vortices</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-[2px] bg-[#00ff88]" />
                  <span className="text-[10px] text-[#888]">Boundary layer</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right side DRS panel - Only when simulation started */}
      <AnimatePresence>
        {started && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.5 }}
            className="absolute top-24 right-4 md:right-6 z-10"
          >
            <div className={`hud-border rounded-lg p-4 transition-all duration-300 ${config.drsEnabled ? 'hud-border-active' : ''}`}>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-display mb-2">DRS</span>
                  <div className={`w-4 h-4 rounded-full ${config.drsEnabled ? 'bg-[#00ff88] shadow-[0_0_15px_rgba(0,255,136,0.7)]' : 'bg-[#e10600]'} transition-all`} />
                </div>
                <button
                  onClick={toggleDRS}
                  className={`px-4 py-2 rounded font-display text-xs uppercase tracking-wider transition-all ${
                    config.drsEnabled
                      ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 hover:bg-[#00ff88]/30'
                      : 'bg-[#e10600]/20 text-[#e10600] border border-[#e10600]/50 hover:bg-[#e10600]/30'
                  }`}
                >
                  {config.drsEnabled ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Content - Before simulation starts */}
      <AnimatePresence>
        {!started && (
          <motion.div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="max-w-4xl"
            >
              {/* Pre-title */}
              <motion.div
                className="flex items-center justify-center gap-3 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#e10600]" />
                <span className="font-display text-xs uppercase tracking-[0.4em] text-[#e10600]">
                  F1 Engineering Lab
                </span>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#e10600]" />
              </motion.div>

              {/* Main title */}
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight leading-none">
                <span className="block">WIND</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#e10600] to-[#ff4040]">
                  TUNNEL
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-[#888] mb-10 max-w-2xl mx-auto leading-relaxed">
                Experience precision aerodynamics simulation. Visualize airflow dynamics,
                optimize downforce configurations, and master the invisible forces of speed.
              </p>

              {/* CTA Button */}
              <motion.button
                onClick={() => {
                  setStarted(true)
                  setTimeout(() => setIsSimulating(true), 1000)
                }}
                className="group relative px-10 py-4 bg-[#e10600] rounded font-display text-sm uppercase tracking-[0.2em] text-white overflow-hidden transition-all hover:shadow-[0_0_40px_rgba(225,6,0,0.5)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="relative z-10 flex items-center gap-3">
                  Initialize Tunnel
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-[#e10600] via-[#ff4040] to-[#e10600]"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  style={{ opacity: 0.5 }}
                />
              </motion.button>

              {/* Tech specs teaser */}
              <motion.div
                className="flex items-center justify-center gap-8 mt-16"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.8 }}
              >
                <div className="flex items-center gap-2 text-[#555]">
                  <Gauge className="w-4 h-4" />
                  <span className="font-telemetry text-xs">0-320 km/h</span>
                </div>
                <div className="w-[1px] h-4 bg-[#333]" />
                <div className="flex items-center gap-2 text-[#555]">
                  <Activity className="w-4 h-4" />
                  <span className="font-telemetry text-xs">Real-time CFD</span>
                </div>
                <div className="w-[1px] h-4 bg-[#333]" />
                <div className="flex items-center gap-2 text-[#555]">
                  <Zap className="w-4 h-4" />
                  <span className="font-telemetry text-xs">DRS Simulation</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Panel - Bottom of screen when simulation started */}
      <AnimatePresence>
        {started && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.5 }}
            className="absolute bottom-0 left-0 right-0 z-10"
          >
            <ControlPanel
              config={config}
              setConfig={handleConfigChange}
              downforce={downforce}
              drag={drag}
              efficiency={efficiency}
              isMobile={isMobile}
              onToggleSimulation={toggleSimulation}
              isSimulating={isSimulating}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0 z-5 text-center pointer-events-none">
        {!started && (
          <a
            href="https://github.com/jonymusky"
            target="_blank"
            rel="noopener noreferrer"
            className="font-telemetry text-xs text-[#333] hover:text-[#e10600] transition-colors pointer-events-auto"
          >
            @jonymusky
          </a>
        )}
      </footer>
    </div>
  )
}
