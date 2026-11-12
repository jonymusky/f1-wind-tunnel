// Two-tone paint schemes in the colours of the 2025 grid. Colours only: no
// logos, sponsors or team marks. Not affiliated with any team.
export interface Livery {
  id: string
  name: string
  /** Main bodywork */
  paint: string
  /** Wing flaps, endplates and engine-cover fin */
  accent: string
}

export const LIVERIES: Livery[] = [
  { id: "lab", name: "Tunnel model", paint: "#c9ccd2", accent: "#d4140b" },
  { id: "mclaren", name: "McLaren", paint: "#ff8000", accent: "#2b2d33" },
  { id: "ferrari", name: "Ferrari", paint: "#dc0000", accent: "#f4f4f4" },
  { id: "redbull", name: "Red Bull", paint: "#1b2a52", accent: "#e21b1b" },
  { id: "mercedes", name: "Mercedes", paint: "#b9bec3", accent: "#00d2be" },
  { id: "astonmartin", name: "Aston Martin", paint: "#00594f", accent: "#cedc00" },
  { id: "alpine", name: "Alpine", paint: "#005ba9", accent: "#ff87bc" },
  { id: "williams", name: "Williams", paint: "#00275e", accent: "#00a0de" },
  { id: "racingbulls", name: "Racing Bulls", paint: "#f4f6fa", accent: "#1e41ff" },
  { id: "sauber", name: "Sauber", paint: "#00e701", accent: "#0a0a0a" },
  { id: "haas", name: "Haas", paint: "#f2f2f2", accent: "#e6002b" },
]

export const LIVERY_BY_ID = Object.fromEntries(LIVERIES.map((l) => [l.id, l])) as Record<string, Livery>
