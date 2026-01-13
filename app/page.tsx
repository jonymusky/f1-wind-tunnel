"use client"

import dynamic from "next/dynamic"

const WindTunnelSimulator = dynamic(
  () => import("@/components/wind-tunnel-simulator"),
  { ssr: false }
)

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050505]">
      <WindTunnelSimulator />
    </div>
  )
}
