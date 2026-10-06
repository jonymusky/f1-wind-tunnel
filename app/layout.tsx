import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  title: "F1 Wind Tunnel — AeroSim",
  description:
    "Interactive F1 wind tunnel: tune wings, ride height, rake and yaw, and watch streamlines, smoke and surface pressure respond in real time.",
}

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
