import * as THREE from "three"

export interface LoftSection {
  z: number
  /** Full width */
  w: number
  /** Full height */
  h: number
  /** Vertical centre */
  y: number
  /** Lateral centre */
  x?: number
  /** Superellipse exponent: 2 = ellipse, higher = boxier */
  n?: number
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/**
 * Builds a smooth closed body by sweeping superellipse cross-sections along z.
 * Sections are Catmull-Rom interpolated so a handful of keys gives a clean,
 * continuous surface.
 */
export function loftGeometry(keys: LoftSection[], radial = 40, perSpan = 8): THREE.BufferGeometry {
  const sections: Required<LoftSection>[] = []
  const k = keys.map((s) => ({ x: 0, n: 2.4, ...s }))
  for (let i = 0; i < k.length - 1; i++) {
    const p0 = k[Math.max(0, i - 1)]
    const p1 = k[i]
    const p2 = k[i + 1]
    const p3 = k[Math.min(k.length - 1, i + 2)]
    for (let j = 0; j < perSpan; j++) {
      const t = j / perSpan
      const lerp = (key: keyof LoftSection) =>
        catmull(p0[key] as number, p1[key] as number, p2[key] as number, p3[key] as number, t)
      sections.push({ z: lerp("z"), w: Math.max(lerp("w"), 0.001), h: Math.max(lerp("h"), 0.001), y: lerp("y"), x: lerp("x"), n: lerp("n") })
    }
  }
  sections.push(k[k.length - 1] as Required<LoftSection>)

  const positions: number[] = []
  const indices: number[] = []
  for (const s of sections) {
    for (let r = 0; r < radial; r++) {
      const a = (r / radial) * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const e = 2 / s.n
      positions.push(
        s.x + (s.w / 2) * Math.sign(c) * Math.abs(c) ** e,
        s.y + (s.h / 2) * Math.sign(sn) * Math.abs(sn) ** e,
        s.z,
      )
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let r = 0; r < radial; r++) {
      const a = i * radial + r
      const b = i * radial + ((r + 1) % radial)
      const c = (i + 1) * radial + r
      const d = (i + 1) * radial + ((r + 1) % radial)
      indices.push(a, c, b, b, c, d)
    }
  }
  // Caps
  const capFor = (ring: number, flip: boolean) => {
    const s = sections[ring]
    const center = positions.length / 3
    positions.push(s.x, s.y, s.z)
    for (let r = 0; r < radial; r++) {
      const a = ring * radial + r
      const b = ring * radial + ((r + 1) % radial)
      if (flip) indices.push(center, b, a)
      else indices.push(center, a, b)
    }
  }
  capFor(0, true)
  capFor(sections.length - 1, false)

  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Inverted (downforce) NACA 4-digit style profile, leading edge at origin */
export function airfoilShape(chord: number, thickness = 0.12, camber = 0.06, camberPos = 0.4, points = 28) {
  const upper: THREE.Vector2[] = []
  const lower: THREE.Vector2[] = []
  for (let i = 0; i <= points; i++) {
    const beta = (i / points) * Math.PI
    const x = (1 - Math.cos(beta)) / 2 // cosine spacing, denser at the edges
    const yt = 5 * thickness * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4)
    const yc =
      x < camberPos
        ? (camber / camberPos ** 2) * (2 * camberPos * x - x ** 2)
        : (camber / (1 - camberPos) ** 2) * (1 - 2 * camberPos + 2 * camberPos * x - x ** 2)
    // Negative camber: suction side faces the ground
    upper.push(new THREE.Vector2(x * chord, (-yc + yt) * chord))
    lower.push(new THREE.Vector2(x * chord, (-yc - yt) * chord))
  }
  const shape = new THREE.Shape()
  shape.moveTo(upper[0].x, upper[0].y)
  for (let i = 1; i < upper.length; i++) shape.lineTo(upper[i].x, upper[i].y)
  for (let i = lower.length - 1; i >= 0; i--) shape.lineTo(lower[i].x, lower[i].y)
  return shape
}

/**
 * Wing element spanning x, leading edge at the local origin, chord running
 * towards -z so that rotating about x pivots around the leading edge.
 */
export function wingGeometry(span: number, chord: number, thickness = 0.12, camber = 0.06) {
  const g = new THREE.ExtrudeGeometry(airfoilShape(chord, thickness, camber), {
    depth: span,
    bevelEnabled: false,
    curveSegments: 1,
  })
  g.rotateY(Math.PI / 2)
  g.translate(-span / 2, 0, 0)
  g.computeVertexNormals()
  return g
}

/** Flat plate from an outline in the (z, y) plane, extruded along x */
export function plateGeometry(outline: [number, number][], thickness: number) {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(-z, y)))
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.3,
    bevelSize: thickness * 0.3,
    bevelSegments: 1,
  })
  g.rotateY(Math.PI / 2)
  g.translate(-thickness / 2, 0, 0)
  g.computeVertexNormals()
  return g
}

/** Flat plate from an outline in the (x, z) plane, extruded upward along y */
export function floorGeometry(outline: [number, number][], thickness: number) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  g.rotateX(Math.PI / 2)
  g.translate(0, thickness, 0)
  g.computeVertexNormals()
  return g
}

/** Tyre with rounded shoulders, axis along x */
export function tyreGeometry(radius: number, rimRadius: number, width: number) {
  // Half superellipse in (radius, axial) space: squared-off tread, rounded shoulders
  const pts: THREE.Vector2[] = []
  const depth = radius - rimRadius
  const hw = width / 2
  const e = 2 / 5
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI
    const c = Math.cos(a)
    const s = Math.sin(a)
    pts.push(new THREE.Vector2(rimRadius + depth * Math.abs(c) ** e, hw * Math.sign(s) * Math.abs(s) ** e))
  }
  const g = new THREE.LatheGeometry(pts, 64)
  g.rotateZ(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Tube through a list of points */
export function tubeGeometry(points: [number, number, number][], radius: number, segments = 48) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, segments, radius, 12, false)
}
