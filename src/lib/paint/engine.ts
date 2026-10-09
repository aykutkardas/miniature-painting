import * as THREE from "three";
import { createPaintGeometry } from "./geometry";
import { FINISHES, type Finish } from "./paints";

const MAX_DABS = 32;

export type StrokeParams = {
  color: string;
  finish: Finish;
  radius: number;
  hardness: number;
  opacity: number;
};

export type PaintSnapshot = {
  size: number;
  color: Uint8Array;
  material: Uint8Array;
};

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const uvSpaceVertex = /* glsl */ `
  attribute vec3 bary;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vBary;
  void main() {
    vPos = position;
    vNormal = normal;
    vBary = bary;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  }
`;

const dabFragment = /* glsl */ `
  #define MAX_DABS ${MAX_DABS}
  uniform vec3 uCenters[MAX_DABS];
  uniform vec3 uNormals[MAX_DABS];
  uniform int uCount;
  uniform float uRadius;
  uniform float uHardness;
  uniform sampler2D uCoverage;
  uniform vec2 uResolution;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vBary;

  void main() {
    float minBary = min(vBary.x, min(vBary.y, vBary.z));
    if (minBary < -1e-4) {
      // Extrapolated gutter fragment: never overwrite texels owned by an island.
      if (texture2D(uCoverage, gl_FragCoord.xy / uResolution).r > 0.5) discard;
    }

    vec3 n = normalize(vNormal);
    float strength = 0.0;
    for (int i = 0; i < MAX_DABS; i++) {
      if (i >= uCount) break;
      float d = distance(vPos, uCenters[i]);
      float falloff = 1.0 - smoothstep(uRadius * uHardness, uRadius, d);
      // Keeps paint from bleeding through to the back of thin parts.
      float facing = smoothstep(-0.35, 0.05, dot(n, uNormals[i]));
      strength = max(strength, falloff * facing);
    }
    if (strength <= 0.0) discard;
    gl_FragColor = vec4(strength);
  }
`;

const coverageFragment = /* glsl */ `
  void main() { gl_FragColor = vec4(1.0); }
`;

const compositeFragment = /* glsl */ `
  uniform sampler2D uBase;
  uniform sampler2D uMask;
  uniform vec3 uValue;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec3 base = texture2D(uBase, vUv).rgb;
    float amount = texture2D(uMask, vUv).r * uOpacity;
    gl_FragColor = vec4(mix(base, uValue, amount), 1.0);
  }
`;

const copyFragment = /* glsl */ `
  uniform sampler2D uSource;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(uSource, vUv).rgb, 1.0); }
`;

const fillFragment = /* glsl */ `
  uniform vec4 uValue;
  void main() { gl_FragColor = uValue; }
`;

function createTarget(size: number, options: { srgb?: boolean; mipmaps?: boolean } = {}) {
  const target = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: false,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    colorSpace: options.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
    generateMipmaps: !!options.mipmaps,
    minFilter: options.mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  return target;
}

function shaderMaterial(params: THREE.ShaderMaterialParameters) {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.NoBlending,
    ...params,
  });
}

/**
 * GPU texture painter. Brush dabs are evaluated in object space (a sphere
 * around the hit point) while rasterizing the mesh in UV space, so brush size
 * is consistent across UV islands and strokes cross seams cleanly.
 *
 * Each stroke accumulates into a stroke mask with MAX blending and is then
 * composited over a copy of the pre-stroke texture. Overlapping dabs never
 * build up, which keeps semi-transparent strokes perfectly even.
 */
export class PaintEngine {
  readonly size: number;
  readonly colorTarget: THREE.WebGLRenderTarget;
  readonly materialTarget: THREE.WebGLRenderTarget;

  private renderer: THREE.WebGLRenderer;
  private baseColorTarget: THREE.WebGLRenderTarget;
  private baseMaterialTarget: THREE.WebGLRenderTarget;
  private strokeTarget: THREE.WebGLRenderTarget;
  private coverageTarget: THREE.WebGLRenderTarget;

  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private uvScene = new THREE.Scene();
  private uvMesh: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quad: THREE.Mesh;

  private dabMaterial: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;
  private copyMaterial: THREE.ShaderMaterial;
  private fillMaterial: THREE.ShaderMaterial;

  private stroke: (StrokeParams & { colorLinear: THREE.Vector3; materialValue: THREE.Vector3 }) | null = null;
  private pending: { center: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  private lastDab: THREE.Vector3 | null = null;
  private strokeDirty = false;

  constructor(renderer: THREE.WebGLRenderer, geometry: THREE.BufferGeometry, size: number) {
    this.renderer = renderer;
    this.size = size;

    this.colorTarget = createTarget(size, { srgb: true, mipmaps: true });
    this.materialTarget = createTarget(size, { mipmaps: true });
    this.colorTarget.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.baseColorTarget = createTarget(size, { srgb: true });
    this.baseMaterialTarget = createTarget(size);
    this.strokeTarget = createTarget(size);
    this.coverageTarget = createTarget(size);

    const paintGeometry = createPaintGeometry(geometry, size);

    const centers = Array.from({ length: MAX_DABS }, () => new THREE.Vector3());
    const normals = Array.from({ length: MAX_DABS }, () => new THREE.Vector3(0, 1, 0));
    this.dabMaterial = shaderMaterial({
      vertexShader: uvSpaceVertex,
      fragmentShader: dabFragment,
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      side: THREE.DoubleSide,
      uniforms: {
        uCenters: { value: centers },
        uNormals: { value: normals },
        uCount: { value: 0 },
        uRadius: { value: 0.02 },
        uHardness: { value: 0.6 },
        uCoverage: { value: this.coverageTarget.texture },
        uResolution: { value: new THREE.Vector2(size, size) },
      },
    });

    this.uvMesh = new THREE.Mesh(paintGeometry, this.dabMaterial);
    this.uvMesh.frustumCulled = false;
    this.uvScene.add(this.uvMesh);

    const quadGeometry = new THREE.BufferGeometry();
    quadGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    quadGeometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2)
    );

    this.compositeMaterial = shaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: compositeFragment,
      uniforms: {
        uBase: { value: null },
        uMask: { value: this.strokeTarget.texture },
        uValue: { value: new THREE.Vector3() },
        uOpacity: { value: 1 },
      },
    });
    this.copyMaterial = shaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: copyFragment,
      uniforms: { uSource: { value: null } },
    });
    this.fillMaterial = shaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: fillFragment,
      uniforms: { uValue: { value: new THREE.Vector4() } },
    });

    this.quad = new THREE.Mesh(quadGeometry, this.fillMaterial);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.bakeCoverage(geometry);
  }

  private render(target: THREE.WebGLRenderTarget, scene: THREE.Scene) {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.render(scene, this.camera);
    renderer.setRenderTarget(previousTarget);
    renderer.autoClear = previousAutoClear;
    renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
  }

  private drawQuad(target: THREE.WebGLRenderTarget, material: THREE.ShaderMaterial) {
    this.quad.material = material;
    this.render(target, this.quadScene);
  }

  private fill(target: THREE.WebGLRenderTarget, x: number, y: number, z: number, w = 1) {
    this.fillMaterial.uniforms.uValue.value.set(x, y, z, w);
    this.drawQuad(target, this.fillMaterial);
  }

  private copy(source: THREE.Texture, target: THREE.WebGLRenderTarget) {
    this.copyMaterial.uniforms.uSource.value = source;
    this.drawQuad(target, this.copyMaterial);
  }

  private bakeCoverage(geometry: THREE.BufferGeometry) {
    this.fill(this.coverageTarget, 0, 0, 0, 0);
    const coverageGeometry = new THREE.BufferGeometry();
    coverageGeometry.setAttribute("position", geometry.attributes.position);
    coverageGeometry.setAttribute("normal", geometry.attributes.normal);
    coverageGeometry.setAttribute("uv", geometry.attributes.uv);
    coverageGeometry.setAttribute(
      "bary",
      new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3)
    );
    const material = shaderMaterial({
      vertexShader: uvSpaceVertex,
      fragmentShader: coverageFragment,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(coverageGeometry, material);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    this.render(this.coverageTarget, scene);
    material.dispose();
  }

  clear(color: string, finish: Finish) {
    const linear = new THREE.Color(color);
    const { roughness, metalness } = FINISHES[finish];
    this.fill(this.colorTarget, linear.r, linear.g, linear.b, 1);
    this.fill(this.materialTarget, 0, roughness, metalness, 1);
  }

  get isStroking() {
    return this.stroke !== null;
  }

  beginStroke(params: StrokeParams) {
    const linear = new THREE.Color(params.color);
    const { roughness, metalness } = FINISHES[params.finish];
    this.stroke = {
      ...params,
      colorLinear: new THREE.Vector3(linear.r, linear.g, linear.b),
      materialValue: new THREE.Vector3(0, roughness, metalness),
    };
    this.pending = [];
    this.lastDab = null;
    this.copy(this.colorTarget.texture, this.baseColorTarget);
    this.copy(this.materialTarget.texture, this.baseMaterialTarget);
    this.fill(this.strokeTarget, 0, 0, 0, 0);
  }

  /** Queue a dab in object space. Dabs too close to the previous one are skipped. */
  addDab(center: THREE.Vector3, normal: THREE.Vector3) {
    if (!this.stroke) return;
    const minSpacing = this.stroke.radius * 0.12;
    if (this.lastDab && this.lastDab.distanceTo(center) < minSpacing) return;
    this.lastDab = center.clone();
    this.pending.push({ center: center.clone(), normal: normal.clone() });
  }

  /** Renders queued dabs. Call once per frame. */
  flush() {
    const stroke = this.stroke;
    if (!stroke) return;

    if (this.pending.length > 0) {
      const uniforms = this.dabMaterial.uniforms;
      uniforms.uRadius.value = stroke.radius;
      uniforms.uHardness.value = stroke.hardness;

      while (this.pending.length > 0) {
        const batch = this.pending.splice(0, MAX_DABS);
        batch.forEach((dab, i) => {
          uniforms.uCenters.value[i].copy(dab.center);
          uniforms.uNormals.value[i].copy(dab.normal);
        });
        uniforms.uCount.value = batch.length;
        this.uvMesh.material = this.dabMaterial;
        this.render(this.strokeTarget, this.uvScene);
      }
      this.strokeDirty = true;
    }

    if (!this.strokeDirty) return;
    this.strokeDirty = false;

    const composite = this.compositeMaterial.uniforms;
    composite.uOpacity.value = stroke.opacity;

    composite.uBase.value = this.baseColorTarget.texture;
    composite.uValue.value.copy(stroke.colorLinear);
    this.drawQuad(this.colorTarget, this.compositeMaterial);

    composite.uBase.value = this.baseMaterialTarget.texture;
    composite.uValue.value.copy(stroke.materialValue);
    this.drawQuad(this.materialTarget, this.compositeMaterial);
  }

  endStroke() {
    this.flush();
    this.stroke = null;
    this.pending = [];
    this.lastDab = null;
  }

  readSnapshot(): PaintSnapshot {
    const color = new Uint8Array(this.size * this.size * 4);
    const material = new Uint8Array(this.size * this.size * 4);
    this.renderer.readRenderTargetPixels(this.colorTarget, 0, 0, this.size, this.size, color);
    this.renderer.readRenderTargetPixels(this.materialTarget, 0, 0, this.size, this.size, material);
    return { size: this.size, color, material };
  }

  writeSnapshot(snapshot: PaintSnapshot) {
    if (snapshot.size !== this.size) return false;
    const upload = (data: Uint8Array, colorSpace: THREE.ColorSpace, target: THREE.WebGLRenderTarget) => {
      const texture = new THREE.DataTexture(data, this.size, this.size, THREE.RGBAFormat);
      texture.colorSpace = colorSpace;
      texture.needsUpdate = true;
      this.copy(texture, target);
      texture.dispose();
    };
    upload(snapshot.color, THREE.SRGBColorSpace, this.colorTarget);
    upload(snapshot.material, THREE.NoColorSpace, this.materialTarget);
    return true;
  }

  /** Reads the painted color and finish at a UV coordinate. */
  sample(uv: THREE.Vector2) {
    const x = THREE.MathUtils.clamp(Math.floor(uv.x * this.size), 0, this.size - 1);
    const y = THREE.MathUtils.clamp(Math.floor(uv.y * this.size), 0, this.size - 1);
    const color = new Uint8Array(4);
    const material = new Uint8Array(4);
    this.renderer.readRenderTargetPixels(this.colorTarget, x, y, 1, 1, color);
    this.renderer.readRenderTargetPixels(this.materialTarget, x, y, 1, 1, material);
    const hex = `#${[color[0], color[1], color[2]]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")}`;
    const roughness = material[1] / 255;
    const metalness = material[2] / 255;

    let finish: Finish = "matte";
    let best = Infinity;
    (Object.keys(FINISHES) as Finish[]).forEach((key) => {
      const f = FINISHES[key];
      const d = Math.abs(f.roughness - roughness) + Math.abs(f.metalness - metalness) * 2;
      if (d < best) {
        best = d;
        finish = key;
      }
    });
    return { hex, finish };
  }

  dispose() {
    [
      this.colorTarget,
      this.materialTarget,
      this.baseColorTarget,
      this.baseMaterialTarget,
      this.strokeTarget,
      this.coverageTarget,
    ].forEach((t) => t.dispose());
    this.uvMesh.geometry.dispose();
    this.quad.geometry.dispose();
    [this.dabMaterial, this.compositeMaterial, this.copyMaterial, this.fillMaterial].forEach((m) =>
      m.dispose()
    );
  }
}
