import * as THREE from "three"

const TURBO_GLSL = /* glsl */ `
vec3 turbo(float x) {
  const vec4 kr4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
  const vec2 kr2 = vec2(-152.94239396, 59.28637943);
  const vec4 kg4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
  const vec2 kg2 = vec2(4.27729857, 2.82956604);
  const vec4 kb4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
  const vec2 kb2 = vec2(-89.90310912, 27.34824973);
  x = clamp(x, 0.0, 1.0);
  vec4 v4 = vec4(1.0, x, x * x, x * x * x);
  vec2 v2 = v4.zw * v4.z;
  return clamp(vec3(dot(v4, kr4) + dot(v2, kr2), dot(v4, kg4) + dot(v2, kg2), dot(v4, kb4) + dot(v2, kb2)), 0.0, 1.0);
}
`

/** Range of pressure coefficient shown on the surface map */
export const CP_RANGE: [number, number] = [-2.2, 1]

/**
 * Approximate surface pressure coefficient: stagnation on faces that meet
 * the flow, suction over shoulders, strong suction on the floor underside
 * and on the lower (suction) side of the wings.
 */
export function createPressureMaterial(isWing: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFloor: { value: 0.6 },
      uWing: { value: 0.6 },
      uIsWing: { value: isWing ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFloor;
      uniform float uWing;
      uniform float uIsWing;
      varying vec3 vNormal;
      varying vec3 vWorld;
      ${TURBO_GLSL}
      void main() {
        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;
        // Flow comes from +z in world space
        float c = n.z;
        float cp = c > 0.0 ? 2.0 * c * c - 1.0 : -0.3 + 0.2 * c;
        // Floor and diffuser suction
        float under = smoothstep(0.2, 0.9, -n.y) * (1.0 - smoothstep(0.08, 0.3, vWorld.y));
        cp -= under * (0.5 + 1.6 * uFloor);
        // Wing elements: suction underneath, pressure on top
        if (uIsWing > 0.5) {
          cp -= smoothstep(0.0, 0.8, -n.y) * (0.6 + 1.6 * uWing);
          cp += smoothstep(0.0, 0.8, n.y) * (0.2 + 0.5 * uWing);
        }
        float t = (cp - ${CP_RANGE[0].toFixed(2)}) / (${(CP_RANGE[1] - CP_RANGE[0]).toFixed(2)});
        vec3 col = turbo(t);
        col = pow(col, vec3(2.2)); // sRGB → linear
        float shade = 0.6 + 0.4 * max(dot(n, normalize(vec3(0.3, 1.0, 0.4))), 0.0);
        gl_FragColor = vec4(col * shade, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  })
}

/** Streamline material: additive, fades along each trail, HDR so it blooms */
export function createStreamlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: { value: 1.6 },
    },
    vertexShader: /* glsl */ `
      attribute float age;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAge;
      void main() {
        vColor = color;
        vAge = age;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying vec3 vColor;
      varying float vAge;
      void main() {
        float fade = pow(clamp(1.0 - vAge, 0.0, 1.0), 1.4);
        vec3 col = pow(clamp(vColor, 0.0, 1.0), vec3(2.2)) * fade * uIntensity;
        if (any(isnan(col))) discard;
        gl_FragColor = vec4(min(col, vec3(4.0)), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    // Add colour only; leave destination alpha alone so overlapping trails
    // can't push it out of range (which poisons the bloom pass)
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    toneMapped: false,
  })
}
