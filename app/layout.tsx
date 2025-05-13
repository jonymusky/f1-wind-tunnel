import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'F1 AERO SIM',
  description: 'F1 AERO SIM is a web application that allows you to simulate the F1 car in a wind tunnel.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
