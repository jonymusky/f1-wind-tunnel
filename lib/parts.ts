import { toKgf, type AeroConfig, type AeroResult } from "./aero"

export type PartId =
  | "frontWing"
  | "nose"
  | "chassis"
  | "halo"
  | "sidepods"
  | "engineCover"
  | "floor"
  | "gearbox"
  | "beamWing"
  | "rearWing"
  | "frontSuspension"
  | "rearSuspension"
  | "frontTyres"
  | "rearTyres"

export interface PartInfo {
  id: PartId
  name: string
  /** One-line role, shown in lists and labels */
  role: string
  /** What it does and why it matters */
  body: string
  /** Live figure tied to the current setup */
  live?: (aero: AeroResult, cfg: AeroConfig) => string
  /** Direction the part moves in the exploded view, metres at full explode (car-local) */
  explode: [number, number, number]
  /** Where its label sits, car-local, before exploding */
  anchor: [number, number, number]
}

const share = (part: number, aero: AeroResult) => `${Math.round((part / aero.clA.total) * 100)}%`
const kgf = (n: number) => Math.round(toKgf(n)).toLocaleString("en-US")

export const PARTS: PartInfo[] = [
  {
    id: "frontWing",
    name: "Front wing",
    role: "First contact with the air",
    body:
      "Multi-element wing running in ground effect. It makes around a fifth of the car's downforce, but its bigger job is conditioning the flow for everything behind it: the endplates push the turbulent front-tyre wake outboard (outwash) and shed vortices that help seal the floor. The flaps are adjustable to trim balance between front and rear, and with active aero they unload on the straights.",
    live: (a, c) => {
      const q = 0.5 * 1.225 * (c.speed / 3.6) ** 2
      return `${a.clA.frontWing.toFixed(2)} m² CL·A · ${share(a.clA.frontWing, a)} of downforce · ${kgf(a.clA.frontWing * q)} kgf at ${c.speed} km/h`
    },
    explode: [0, 0.2, 1.5],
    anchor: [0.75, 0.3, 2.5],
  },
  {
    id: "nose",
    name: "Nose",
    role: "Crash structure + airflow to the floor",
    body:
      "A carbon crash structure that has to pass FIA impact tests before the car can race. Its height and underside shape decide how much clean air reaches the leading edge of the floor, and it carries the front wing on two pylons.",
    explode: [0, 0.25, 0.85],
    anchor: [0, 0.32, 2.1],
  },
  {
    id: "chassis",
    name: "Monocoque",
    role: "Survival cell, driver and fuel",
    body:
      "The carbon-fibre tub the driver sits in, with the fuel cell behind the seat. Everything else bolts to it: front suspension, power unit, sidepods. It is the car's structural backbone and its safety cell.",
    explode: [0, 0, 0],
    anchor: [0.3, 0.68, 0.9],
  },
  {
    id: "halo",
    name: "Halo",
    role: "Head protection",
    body:
      "Titanium hoop mandatory since 2018, strong enough to support the weight of a London bus. Aerodynamically it's a bluff tube right in front of the airbox, so teams fit small fairings to keep the flow into the engine intake clean.",
    explode: [0, 0.6, 0.15],
    anchor: [0.22, 0.85, 0.45],
  },
  {
    id: "sidepods",
    name: "Sidepods",
    role: "Radiators and flow to the rear",
    body:
      "House the radiators that cool the power unit. Inlet size is a cooling-versus-drag trade-off. The upper surface and the undercut beneath guide air rearward: either down onto the floor edge and diffuser, or over the top towards the beam wing, depending on the team's concept.",
    explode: [0.75, 0.05, 0],
    anchor: [0.7, 0.5, 0.3],
  },
  {
    id: "engineCover",
    name: "Engine cover & airbox",
    role: "Power-unit intake, rear packaging",
    body:
      "The airbox above the driver's head feeds the turbocharged V6 hybrid power unit. Behind it the bodywork tapers into the 'coke-bottle' shape to accelerate air towards the rear wing and beam wing. The shark fin adds directional stability when the car is yawed.",
    explode: [0, 0.75, -0.35],
    anchor: [0, 1.0, -0.4],
  },
  {
    id: "floor",
    name: "Floor & diffuser",
    role: "The biggest source of downforce",
    body:
      "Venturi tunnels under the floor accelerate the air, dropping its pressure and sucking the car onto the road (ground effect). The diffuser at the back expands and slows the flow back down. It works harder the closer it runs to the road, until the flow separates: the floor stalls, loses load, rises, re-attaches and stalls again. That cycle is porpoising.",
    live: (a, c) =>
      `${a.clA.floor.toFixed(2)} m² CL·A · ${share(a.clA.floor, a)} of downforce · ride height ${c.rideHeight} mm${a.floorStall ? " (stalled)" : ""}`,
    explode: [0, -0.55, 0],
    anchor: [0.95, 0.02, -0.4],
  },
  {
    id: "gearbox",
    name: "Gearbox & crash structure",
    role: "Drivetrain, rear impact, rain light",
    body:
      "Eight-speed seamless-shift gearbox, a stressed member that carries the rear suspension. Behind it sits the rear impact structure with the rain light, which also flashes when the hybrid system is harvesting energy.",
    explode: [0, 0, -0.65],
    anchor: [0.2, 0.4, -1.7],
  },
  {
    id: "beamWing",
    name: "Beam wing",
    role: "Works with the diffuser",
    body:
      "Small wing below the main rear wing. Its suction side sits right above the diffuser exit, pulling the underfloor flow up and out, so the floor can run harder without separating. A small drag cost for a big gain in floor efficiency.",
    explode: [0, 0.1, -1.25],
    anchor: [0.35, 0.4, -2.05],
  },
  {
    id: "rearWing",
    name: "Rear wing",
    role: "High downforce, high drag",
    body:
      "Main plane plus an adjustable flap between two endplates. It's the most efficient place to trim rear downforce but also the biggest drag item on the car. In straight mode the flap opens nearly flat, cutting drag. Its tip vortices are the spirals you see trailing behind the car.",
    live: (a, c) =>
      `${a.clA.rearWing.toFixed(2)} m² CL·A · ${share(a.clA.rearWing, a)} of downforce · flap ${c.mode === "straight" ? "open" : "closed"}`,
    explode: [0, 0.7, -1.0],
    anchor: [0.5, 1.02, -2.2],
  },
  {
    id: "frontSuspension",
    name: "Front suspension",
    role: "Wishbones and push-rods",
    body:
      "Carbon double wishbones with aerofoil-section legs. Besides locating the wheels, their position and angle steer the air coming off the front wing, and the suspension geometry controls how the car pitches under braking, and with it the floor's ride height.",
    explode: [0, -0.2, 0.35],
    anchor: [0.45, 0.42, 1.65],
  },
  {
    id: "rearSuspension",
    name: "Rear suspension",
    role: "Holds the rear ride height",
    body:
      "Mounted to the gearbox. Its stiffness is a constant compromise: soft enough to ride kerbs and keep the tyres working, stiff enough to hold the floor at its ideal ride height under up to two tonnes of aero load.",
    explode: [0, -0.2, -0.35],
    anchor: [0.45, 0.42, -1.75],
  },
  {
    id: "frontTyres",
    name: "Front tyres",
    role: "Grip, and the biggest wake",
    body:
      "18-inch Pirelli tyres. A rotating, deforming tyre throws a large turbulent wake. Keeping that wake away from the floor is one of aerodynamicists' main headaches, and the reason much of the front wing exists.",
    explode: [0.85, 0, 0.3],
    anchor: [0.95, 0.75, 1.6],
  },
  {
    id: "rearTyres",
    name: "Rear tyres",
    role: "Traction, and the diffuser's neighbour",
    body:
      "Wider than the fronts to put the power down. Their wake interacts with the diffuser's outer edges ('tyre squirt'), so the floor's rear corners are shaped to keep it out.",
    explode: [0.85, 0, -0.3],
    anchor: [0.95, 0.75, -1.8],
  },
]

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, PartInfo>
