"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Wind, ChevronRight, Gauge, Layers, CornerDownRight } from "lucide-react"
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

// Fixed Wind Flow Line with better error handling and more visible physics
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
        
        // Update head point
        const headX = newPositions[0]
        const headY = newPositions[1]
        const headZ = newPositions[2]

        // Basic movement
        const speedEffect = speed * 0.02
        const newZ = headZ - speedEffect

        // Angle of attack effect
        const angleEffect = angleOfAttack * 0.1
        const newY = headY + (angleEffect * speedEffect)

        // Wing effects
        const frontWingEffect = (frontWing - 50) * 0.003
        const rearWingEffect = (rearWing - 50) * 0.003
        const wingEffect = (frontWingEffect + rearWingEffect) * speedEffect

        // Add turbulence
        const turbulence = 0.003 * speed
        const newX = headX + ((Math.random() - 0.5) * turbulence)

        // Reset if too far
        if (newZ < -15) {
          for (let i = 0; i < 50; i++) {
            const index = i * 3
            newPositions[index] = startPosition.x + (Math.random() - 0.5) * 0.2
            newPositions[index + 1] = startPosition.y + (Math.random() - 0.5) * 0.2
            newPositions[index + 2] = startPosition.z - (i * 0.1)
          }
        } else {
          // Shift all points back
          for (let i = newPositions.length - 3; i >= 3; i -= 3) {
            newPositions[i] = newPositions[i - 3]
            newPositions[i + 1] = newPositions[i - 2]
            newPositions[i + 2] = newPositions[i - 1]
          }

          // Update head point with more pronounced effects
          newPositions[0] = newX
          newPositions[1] = newY + wingEffect
          newPositions[2] = newZ
        }

        return newPositions
      })
    }, 16)

    return () => clearInterval(updateInterval)
  }, [startPosition, speed, angleOfAttack, frontWing, rearWing])

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
  const { scene } = useThree()
  const fanRef = useRef<THREE.Group>(null)
  const flowLinesRef = useRef<THREE.Group>(null)
  const [flowLines, setFlowLines] = useState<JSX.Element[]>([])

  // Generate flow lines with improved distribution
  useEffect(() => {
    if (!isSimulating) return

    const newFlowLines = []
    const count = 300 // Increased number of lines

    for (let i = 0; i < count; i++) {
      let x, y, z, color, type

      // Create more structured starting positions
      if (i % 4 === 0) {
        // Upper flow - red (high pressure)
        x = (Math.random() - 0.5) * 3
        y = Math.random() * 0.5 + 0.7
        z = Math.random() * 8 - 2
        color = "#ff0000"
        type = "pressure"
      } else if (i % 4 === 1) {
        // Lower flow - blue (low pressure)
        x = (Math.random() - 0.5) * 3
        y = Math.random() * 0.3
        z = Math.random() * 8 - 2
        color = "#0088ff"
        type = "pressure"
      } else if (i % 4 === 2) {
        // Side flow - purple/magenta (vortices)
        x = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.5)
        y = Math.random() * 0.8 + 0.2
        z = Math.random() * 8 - 2
        color = "#ff00ff"
        type = "vortex"
      } else {
        // Boundary layer - yellow/green
        x = (Math.random() - 0.5) * 3
        y = Math.random() * 0.1
        z = Math.random() * 8 - 2
        color = "#ffff00"
        type = "boundary"
      }

      // Adjust speed based on type and position
      let speed = config.windSpeed / 20
      if (type === "boundary") {
        speed *= 0.3 // Slower in boundary layer
      } else if (type === "vortex") {
        speed *= 1.5 // Faster in vortices
      }

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
  }, [isSimulating, config.windSpeed])

  // Animate fan with more visible speed changes
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
          <meshStandardMaterial color="#333333" />
        </mesh>
        <group position={[0, 0, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} rotation={[0, 0, ((Math.PI * 2) / 5) * i]}>
              <boxGeometry args={[0.2, 2, 0.05]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
          ))}
        </group>
      </group>

      {/* Floor with grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[30, 30, 30, 30]} />
        <meshStandardMaterial color="#333333" wireframe={true} opacity={0.3} transparent={true} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* Side walls */}
      <mesh position={[-5, 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4, 20]} />
        <meshStandardMaterial color="#111111" opacity={0.3} transparent={true} />
      </mesh>
      <mesh position={[5, 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4, 20]} />
        <meshStandardMaterial color="#111111" opacity={0.3} transparent={true} />
      </mesh>

      <group ref={flowLinesRef}>
        {flowLines}
      </group>
    </group>
  )
}

// Improved F1 Car component with more realistic shape
const F1Car = ({ config }) => {
  const carRef = useRef()
  const frontWingRef = useRef()
  const rearWingRef = useRef()
  const drsFlapRef = useRef()
  const [drsOpen, setDrsOpen] = useState(false)

  // Apply configuration changes to car model
  useEffect(() => {
    if (!carRef.current) return

    // Apply angle of attack rotation (more visible)
    carRef.current.rotation.x = THREE.MathUtils.degToRad(config.angleOfAttack * 0.5)

    // Apply wing adjustments
    if (frontWingRef.current) {
      // Adjust front wing angle based on setting
      frontWingRef.current.rotation.x = THREE.MathUtils.degToRad((config.frontWing - 50) * 0.1)
    }

    if (rearWingRef.current) {
      // Adjust rear wing angle based on setting
      rearWingRef.current.rotation.x = THREE.MathUtils.degToRad((config.rearWing - 50) * -0.1)
    }

    // Handle DRS
    if (drsFlapRef.current) {
      const drsAngle = (config.drsEnabled || drsOpen) ? THREE.MathUtils.degToRad(70) : 0
      drsFlapRef.current.rotation.x = drsAngle
    }
  }, [config, drsOpen])

  // Toggle DRS based on speed
  useEffect(() => {
    const shouldOpenDRS = config.windSpeed > 200
    setDrsOpen(shouldOpenDRS)
  }, [config.windSpeed])

  return (
    <group ref={carRef} position={[0, 0, 0]} scale={0.7}>
      {/* Main body - more F1-like shape */}
      <group>
        {/* Lower chassis */}
        <mesh castShadow position={[0, 0.15, 0]}>
          <boxGeometry args={[0.8, 0.1, 3]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
        </mesh>

        {/* Side pods with improved aerodynamics */}
        <mesh castShadow position={[0.5, 0.25, 0]}>
          <boxGeometry args={[0.3, 0.2, 1.5]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
        </mesh>
        <mesh castShadow position={[-0.5, 0.25, 0]}>
          <boxGeometry args={[0.3, 0.2, 1.5]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
        </mesh>

        <group position={[0, 0.15, 1.35]}>
          {/* back section wider, for smooth connection with the chassis */}
          <mesh castShadow position={[0, 0.025, -0.3]}>
            <cylinderGeometry args={[0.4, 0.5, 0.3, 16]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
          </mesh>

          {/* mid section */}
          <mesh castShadow position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.3, 0.4, 0.6, 16]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
          </mesh>

          {/* front section sharper */}
          <mesh castShadow position={[0, 0.025, 0.45]}>
            <coneGeometry args={[0.25, 0.5, 16]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
          </mesh>
        </group>

        {/* Cockpit */}
        <mesh castShadow position={[0, 0.35, 0.3]}>
          <boxGeometry args={[0.6, 0.3, 1]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
        </mesh>

        {/* Driver helmet */}
        <mesh castShadow position={[0, 0.55, 0.3]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Engine cover */}
        <mesh castShadow position={[0, 0.35, -0.7]}>
          <boxGeometry args={[0.6, 0.3, 1.5]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.2} />
        </mesh>

        {/* Airbox */}
        <mesh castShadow position={[0, 0.6, -0.2]}>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* Front wing - now with adjustable angle */}
      <group ref={frontWingRef} position={[0, 0.1, 1.5]}>
        <mesh castShadow>
          <boxGeometry args={[1.6, 0.05, 0.4]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Front wing elements */}
        <mesh castShadow position={[0, 0.05, 0]}>
          <boxGeometry args={[1.4, 0.02, 0.3]} />
          <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.1, 0]}>
          <boxGeometry args={[1.2, 0.02, 0.2]} />
          <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Front wing endplates */}
        <mesh castShadow position={[0.8, 0.1, 0]}>
          <boxGeometry args={[0.05, 0.2, 0.4]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[-0.8, 0.1, 0]}>
          <boxGeometry args={[0.05, 0.2, 0.4]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* Rear wing - now with adjustable angle and DRS */}
      <group ref={rearWingRef} position={[0, 0.6, -1.5]}>
        <mesh castShadow>
          <boxGeometry args={[1.4, 0.05, 0.3]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* DRS flap */}
        <group ref={drsFlapRef} position={[0, 0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 0.05, 0.2]} />
            <meshStandardMaterial color={drsOpen ? "#ff0000" : "#222222"} metalness={0.5} roughness={0.5} />
          </mesh>
        </group>

        {/* Rear wing endplates */}
        <mesh castShadow position={[0.7, 0, 0]}>
          <boxGeometry args={[0.05, 0.5, 0.4]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[-0.7, 0, 0]}>
          <boxGeometry args={[0.05, 0.5, 0.4]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* Wheels */}
      <group>
        {/* Front wheels */}
        <mesh castShadow position={[0.7, 0.2, 0.8]}>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
        <mesh castShadow position={[-0.7, 0.2, 0.8]}>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#111111" />
        </mesh>

        {/* Rear wheels */}
        <mesh castShadow position={[0.7, 0.2, -0.8]}>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
        <mesh castShadow position={[-0.7, 0.2, -0.8]}>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>

      {/* Diffuser with improved shape */}
      <mesh castShadow position={[0, 0.2, -1.3]}>
        <boxGeometry args={[1.2, 0.2, 0.4]} />
        <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

// Scene setup with camera controls
const Scene = ({ config, isSimulating }) => {
  const { camera } = useThree()

  // Set initial camera position
  useEffect(() => {
    camera.position.set(4, 2, 4)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#fff" />

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

export default function WindTunnelSimulator() {
  const isMobile = useMobile()
  const [started, setStarted] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
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

  // Calculate aerodynamic coefficients
  const calculateAerodynamicCoefficients = (config) => {
    // Base coefficients
    const baseCl = 2.5 // Base lift coefficient
    const baseCd = 0.8 // Base drag coefficient

    // Wing effects
    const frontWingEffect = (config.frontWing / 100) * 0.4
    const rearWingEffect = (config.rearWing / 100) * 0.5
    const sidepodsEffect = (config.sidepods / 100) * 0.1

    // Angle of attack effect
    const angleEffect = 1 - Math.abs(config.angleOfAttack) / 10
    const angleOfAttackRad = THREE.MathUtils.degToRad(config.angleOfAttack)

    // Calculate lift coefficient
    const cl = baseCl * (frontWingEffect + rearWingEffect + sidepodsEffect) * angleEffect

    // Calculate drag coefficient with induced drag
    const inducedDrag = Math.pow(cl, 2) / (Math.PI * 3.14) // Aspect ratio of 3.14
    const cd = baseCd * (frontWingEffect * 0.5 + rearWingEffect * 0.7 + sidepodsEffect * 0.3) + inducedDrag

    return { cl, cd }
  }

  // Update aerodynamic values when config changes
  useEffect(() => {
    if (!isSimulating && started) return

    // Get aerodynamic coefficients
    const { cl, cd } = calculateAerodynamicCoefficients(config)

    // Calculate dynamic pressure (q = 0.5 * rho * v^2)
    const airDensity = 1.225 // kg/m^3
    const velocity = config.windSpeed / 3.6 // Convert km/h to m/s
    const dynamicPressure = 0.5 * airDensity * Math.pow(velocity, 2)

    // Calculate forces
    const referenceArea = 1.5 // m^2
    const newDownforce = cl * dynamicPressure * referenceArea
    const newDrag = cd * dynamicPressure * referenceArea

    // Calculate efficiency
    const newEfficiency = newDownforce / (newDrag || 1)

    setDownforce(Math.round(newDownforce))
    setDrag(Math.round(newDrag))
    setEfficiency(Math.round(newEfficiency * 10) / 10)
  }, [config, isSimulating, started])

  // Handle config changes
  const handleConfigChange = (newConfig) => {
    setConfig(newConfig)
  }

  // Toggle DRS manually
  const toggleDRS = () => {
    setConfig(prev => ({
      ...prev,
      drsEnabled: !prev.drsEnabled
    }))
  }

  // Start/stop simulation
  const toggleSimulation = () => {
    setIsSimulating(!isSimulating)
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-black to-zinc-900">
      {/* Background grid effect */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-6">
        <div className="flex items-center">
          <Wind className="w-8 h-8 mr-2 text-red-500" />
          <h1 className="text-2xl font-bold tracking-tighter text-white">
            F1 AERO<span className="text-red-500">SIM</span>
          </h1>
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
            <div className="w-64 h-64 rounded-full bg-gradient-to-br from-red-500 to-red-700 opacity-20 animate-pulse"></div>
          </div>
        )}
      </div>

      {/* Instructions Overlay */}
      {started && (
        <div className="absolute top-20 left-6 z-10 bg-zinc-900/70 backdrop-blur-sm p-3 rounded-lg border border-zinc-800 text-white text-sm max-w-xs">
          <p className="mb-1 font-medium">Controls:</p>
          <ul className="text-zinc-300 text-xs space-y-1">
            <li>• Left-click + drag: Rotate view</li>
            <li>• Right-click + drag: Pan view</li>
            <li>• Scroll: Zoom in/out</li>
          </ul>
        </div>
      )}

      {/* Parameter Effects Guide */}
      {started && (
        <div className="absolute top-20 right-6 z-10 bg-zinc-900/70 backdrop-blur-sm p-3 rounded-lg border border-zinc-800 text-white text-sm max-w-xs">
          <p className="mb-1 font-medium">Effects of the Parameters:</p>
          <ul className="text-zinc-300 text-xs space-y-1">
            <li>
              • <span className="text-red-400">Wind Speed:</span> Affects the speed of the lines
            </li>
            <li>
              • <span className="text-red-400">Angle of Attack:</span> Changes the direction of the flow (up/down)
            </li>
            <li>
              • <span className="text-red-400">Wings:</span> Modify flow patterns and vortices
            </li>
          </ul>
        </div>
      )}

      {/* DRS Status Indicator */}
      {started && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 bg-zinc-900/70 backdrop-blur-sm p-3 rounded-lg border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${config.drsEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-white text-sm font-medium">DRS</span>
            </div>
            <Button
              size="sm"
              onClick={toggleDRS}
              className={`${
                config.drsEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              } text-white`}
            >
              {config.drsEnabled ? 'Deactivate DRS' : 'Activate DRS'}
            </Button>
          </div>
        </div>
      )}

      {/* Hero Content */}
      {!started ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight">
              Master the <span className="text-red-500">Aerodynamics</span> of Speed
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 mb-8 max-w-3xl mx-auto">
              Experience our hyper-realistic Formula 1 wind tunnel simulator. Visualize and control the invisible forces
              that define championship-winning cars.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                onClick={() => {
                  setStarted(true)
                  // Auto-start simulation after a short delay
                  setTimeout(() => setIsSimulating(true), 1000)
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-6 text-xl rounded-md"
              >
                Test the Tunnel Now <ChevronRight className="ml-2" />
              </Button>
            </motion.div>
            <p className="text-zinc-500 mt-4 italic">Feel the Speed. Master the Flow.</p>
          </motion.div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-5xl">
            <div className="bg-zinc-900/50 backdrop-blur-sm p-6 rounded-lg border border-zinc-800">
              <div className="flex justify-center">
                <Gauge className="w-10 h-10 text-red-500 mb-4" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Real-time Simulation</h3>
              <p className="text-zinc-400">
                Adjust parameters and see immediate aerodynamic effects on your F1 car design.
              </p>
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-sm p-6 rounded-lg border border-zinc-800">
              <div className="flex justify-center">
                <Layers className="w-10 h-10 text-red-500 mb-4" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Advanced Physics</h3>
              <p className="text-zinc-400">Powered by computational fluid dynamics algorithms used by F1 teams.</p>
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-sm p-6 rounded-lg border border-zinc-800">
              <div className="flex justify-center">
                <CornerDownRight className="w-10 h-10 text-red-500 mb-4" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Performance Insights</h3>
              <p className="text-zinc-400">
                Gain valuable data on downforce, drag, and overall aerodynamic efficiency.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 z-10">
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
        </div>
      )}

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-4 text-center text-zinc-500 text-sm">
        <a 
          href="https://github.com/jonymusky" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-red-500 transition-colors"
        >
          @jonymusky
        </a>
      </footer>
    </div>
  )
}
