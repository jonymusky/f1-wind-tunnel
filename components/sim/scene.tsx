"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { CameraControls, Environment, Lightformer } from "@react-three/drei"
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing"
import { ToneMappingMode } from "postprocessing"
import type { PartId } from "@/lib/parts"
import F1Car, { type CarPose } from "./car"
import Flow, { type FlowMode, type FlowState } from "./flow"
import Tunnel from "./tunnel"

export type CameraView = "three-quarter" | "side" | "front" | "top" | "rear" | "floor"

const VIEWS: Record<CameraView, { pos: [number, number, number]; target: [number, number, number] }> = {
  "three-quarter": { pos: [6.8, 2.6, 7.2], target: [0, 0.3, -0.2] },
  side: { pos: [9.5, 0.9, -0.2], target: [0, 0.4, -0.2] },
  front: { pos: [0.01, 1.1, 9.5], target: [0, 0.35, 0] },
  top: { pos: [0, 11.5, -0.2], target: [0, 0, -0.2] },
  rear: { pos: [-4.2, 2.1, -8.6], target: [0, 0.5, -0.6] },
  floor: { pos: [4.4, 0.12, 4.8], target: [0, 0.05, -0.3] },
}

function CameraRig({ view, exploded }: { view: CameraView; exploded: boolean }) {
  const controls = useRef<CameraControls>(null)
  const { size } = useThree()
  useEffect(() => {
    const v = VIEWS[view]
    // Portrait screens back off to fit the car's length; exploded parts need more room
    const portrait = size.width / size.height < 1
    const k = (portrait ? 1.6 : 1) * (exploded ? 1.2 : 1)
    // On phones the bottom sheet covers the lower screen: frame the car higher
    controls.current?.setFocalOffset(0, portrait ? -1.4 : 0, 0, true)
    const lift = exploded ? 0.6 : 0
    controls.current?.setLookAt(
      v.pos[0] * k,
      (view === "top" ? v.pos[1] * k : v.pos[1]) + lift,
      v.pos[2] * k,
      v.target[0],
      v.target[1] + lift,
      v.target[2],
      true,
    )
  }, [view, exploded, size.width, size.height])
  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={2.2}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2 - 0.01}
      smoothTime={0.6}
    />
  )
}

interface SceneProps {
  pose: CarPose
  flowMode: FlowMode
  flowStateRef: MutableRefObject<FlowState>
  flowSpeedRef: MutableRefObject<number>
  view: CameraView
  explode: number
  selected: PartId | null
  hovered: PartId | null
  onSelect: (id: PartId | null) => void
  onHover: (id: PartId | null) => void
}

export default function Scene({ pose, flowMode, flowStateRef, flowSpeedRef, view, explode, selected, hovered, onSelect, onHover }: SceneProps) {
  const exploded = explode > 0
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 32, position: VIEWS["three-quarter"].pos, near: 0.05, far: 80 }}
      onPointerMissed={(e) => {
        // Clicks on the HTML part labels also land here; they aren't "empty space"
        if ((e.target as HTMLElement | null)?.closest?.("[data-part-label]")) return
        onSelect(null)
      }}
    >
      <color attach="background" args={["#0b0c0f"]} />
      <fog attach="fog" args={["#0b0c0f", 16, 40]} />

      <ambientLight intensity={0.12} />
      <directionalLight
        position={[2.5, 8, 3]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />

      {/* Procedural reflections: the tunnel's light strips, no HDR download */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#0d0e10"]} />
        {[-2.6, -0.9, 0.9, 2.6].map((x) => (
          <Lightformer key={x} form="rect" intensity={3} position={[x, 5, 0]} rotation-x={Math.PI / 2} scale={[0.4, 20, 1]} />
        ))}
        <Lightformer form="rect" intensity={0.8} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} color="#9fb4d0" />
        <Lightformer form="rect" intensity={0.8} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} color="#d0c4b4" />
        <Lightformer form="ring" intensity={2} position={[0, 2, 9]} scale={3} />
      </Environment>

      <Tunnel yaw={pose.yaw} flowSpeedRef={flowSpeedRef} sting={!exploded} />
      <F1Car
        pose={pose}
        flowSpeedRef={flowSpeedRef}
        explode={explode}
        selected={selected}
        hovered={hovered}
        onSelect={onSelect}
        onHover={onHover}
      />
      {flowMode !== "off" && !exploded && <Flow key={flowMode} mode={flowMode} stateRef={flowStateRef} />}

      <CameraRig view={view} exploded={exploded} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.65} />
        <Vignette offset={0.3} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </Canvas>
  )
}
