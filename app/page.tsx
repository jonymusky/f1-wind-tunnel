"use client"

import dynamic from "next/dynamic"

const WindTunnelSimulator = dynamic(() => import("@/components/wind-tunnel-simulator"), {
  ssr: false,
  loading: () => <div className="h-dvh w-full bg-bg" />,
})

export default function Home() {
  return <WindTunnelSimulator />
}
