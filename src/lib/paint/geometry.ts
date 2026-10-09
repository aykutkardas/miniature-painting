import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type PreparedModel = {
  geometry: THREE.BufferGeometry;
  footprintRadius: number;
  height: number;
};

/**
 * Collects every mesh of a loaded scene into a single non-indexed geometry
 * with a unique, non-overlapping UV layout, normalized to a height of 1 and
 * standing on y = 0. Normals are smoothed across UV seams so seams never show
 * up as shading creases.
 */
export function prepareModel(root: THREE.Object3D): PreparedModel | null {
  root.updateMatrixWorld(true);

  const parts: THREE.BufferGeometry[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;

    const source = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    source.applyMatrix4(mesh.matrixWorld);

    const part = new THREE.BufferGeometry();
    part.setAttribute("position", source.attributes.position.clone());

    const uv = source.attributes.uv;
    if (uv && uv.count === source.attributes.position.count) {
      part.setAttribute("uv", normalizeUvRange(uv));
    } else {
      part.setAttribute("uv", createTriangleAtlas(part.attributes.position.count / 3));
    }
    source.dispose();
    parts.push(part);
  });

  if (parts.length === 0) return null;

  if (parts.length > 1) packIntoGrid(parts);

  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (!merged) return null;

  const box = new THREE.Box3().setFromBufferAttribute(
    merged.attributes.position as THREE.BufferAttribute
  );
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 1 / Math.max(size.y, size.x, size.z, 1e-6);

  merged.translate(-center.x, -box.min.y, -center.z);
  merged.scale(scale, scale, scale);

  computeSeamlessNormals(merged);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  const positions = merged.attributes.position.array as Float32Array;
  let footprint = 0;
  for (let i = 0; i < positions.length; i += 3) {
    footprint = Math.max(footprint, Math.hypot(positions[i], positions[i + 2]));
  }

  return {
    geometry: merged,
    footprintRadius: footprint,
    height: size.y * scale,
  };
}

function normalizeUvRange(uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const count = uv.count;
  const out = new Float32Array(count * 2);
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    out[i * 2] = u;
    out[i * 2 + 1] = v;
    minU = Math.min(minU, u);
    minV = Math.min(minV, v);
    maxU = Math.max(maxU, u);
    maxV = Math.max(maxV, v);
  }

  const inRange = minU >= 0 && minV >= 0 && maxU <= 1 && maxV <= 1;
  if (!inRange) {
    const spanU = Math.max(maxU - minU, 1e-6);
    const spanV = Math.max(maxV - minV, 1e-6);
    for (let i = 0; i < count; i++) {
      out[i * 2] = (out[i * 2] - minU) / spanU;
      out[i * 2 + 1] = (out[i * 2 + 1] - minV) / spanV;
    }
  }
  return new THREE.BufferAttribute(out, 2);
}

/** Fallback for meshes without UVs: every triangle gets its own atlas cell. */
function createTriangleAtlas(triangleCount: number) {
  const cellsPerRow = Math.ceil(Math.sqrt(triangleCount / 2));
  const cell = 1 / cellsPerRow;
  const inset = cell * 0.12;
  const out = new Float32Array(triangleCount * 6);

  for (let t = 0; t < triangleCount; t++) {
    const slot = Math.floor(t / 2);
    const x = (slot % cellsPerRow) * cell;
    const y = Math.floor(slot / cellsPerRow) * cell;
    const a = inset;
    const b = cell - inset;
    const o = t * 6;
    if (t % 2 === 0) {
      out.set([x + a, y + a, x + b - inset, y + a, x + a, y + b - inset], o);
    } else {
      out.set([x + b, y + b, x + a + inset, y + b, x + b, y + a + inset], o);
    }
  }
  return new THREE.BufferAttribute(out, 2);
}

function packIntoGrid(parts: THREE.BufferGeometry[]) {
  const cols = Math.ceil(Math.sqrt(parts.length));
  const cell = 1 / cols;
  const margin = cell * 0.02;
  parts.forEach((part, index) => {
    const uv = part.attributes.uv as THREE.BufferAttribute;
    const ox = (index % cols) * cell + margin;
    const oy = Math.floor(index / cols) * cell + margin;
    const span = cell - margin * 2;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, ox + uv.getX(i) * span, oy + uv.getY(i) * span);
    }
    uv.needsUpdate = true;
  });
}

/** Area-weighted normals that ignore UV seams (vertices welded by position). */
function computeSeamlessNormals(geometry: THREE.BufferGeometry) {
  const pos = geometry.attributes.position.array as Float32Array;
  const vertexCount = pos.length / 3;
  const keyToId = new Map<string, number>();
  const ids = new Uint32Array(vertexCount);
  const precision = 1e5;

  for (let i = 0; i < vertexCount; i++) {
    const key = `${Math.round(pos[i * 3] * precision)}|${Math.round(
      pos[i * 3 + 1] * precision
    )}|${Math.round(pos[i * 3 + 2] * precision)}`;
    let id = keyToId.get(key);
    if (id === undefined) {
      id = keyToId.size;
      keyToId.set(key, id);
    }
    ids[i] = id;
  }

  const accum = new Float32Array(keyToId.size * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  for (let i = 0; i < vertexCount; i += 3) {
    a.fromArray(pos, i * 3);
    b.fromArray(pos, (i + 1) * 3);
    c.fromArray(pos, (i + 2) * 3);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    ab.cross(ac);
    for (let k = 0; k < 3; k++) {
      const id = ids[i + k] * 3;
      accum[id] += ab.x;
      accum[id + 1] += ab.y;
      accum[id + 2] += ab.z;
    }
  }

  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const id = ids[i] * 3;
    const x = accum[id];
    const y = accum[id + 1];
    const z = accum[id + 2];
    const len = Math.hypot(x, y, z) || 1;
    normals[i * 3] = x / len;
    normals[i * 3 + 1] = y / len;
    normals[i * 3 + 2] = z / len;
  }
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
}

/**
 * Builds the UV-space geometry used by the paint pass. Each triangle is
 * scaled around its UV incenter so it also covers a few gutter texels outside
 * its island. Positions, normals and barycentrics are extrapolated with the
 * same affine map, so gutter texels receive the color of the surface they
 * border. This eliminates visible seams under bilinear filtering and mipmaps.
 */
export function createPaintGeometry(
  source: THREE.BufferGeometry,
  textureSize: number,
  padTexels = 3
) {
  const pos = source.attributes.position.array as Float32Array;
  const nor = source.attributes.normal.array as Float32Array;
  const uvs = source.attributes.uv.array as Float32Array;
  const vertexCount = pos.length / 3;

  const outPos = new Float32Array(vertexCount * 3);
  const outNor = new Float32Array(vertexCount * 3);
  const outUv = new Float32Array(vertexCount * 2);
  const outBary = new Float32Array(vertexCount * 3);

  for (let t = 0; t < vertexCount; t += 3) {
    const ax = uvs[t * 2] * textureSize;
    const ay = uvs[t * 2 + 1] * textureSize;
    const bx = uvs[(t + 1) * 2] * textureSize;
    const by = uvs[(t + 1) * 2 + 1] * textureSize;
    const cx = uvs[(t + 2) * 2] * textureSize;
    const cy = uvs[(t + 2) * 2 + 1] * textureSize;

    const la = Math.hypot(cx - bx, cy - by);
    const lb = Math.hypot(ax - cx, ay - cy);
    const lc = Math.hypot(bx - ax, by - ay);
    const perimeter = la + lb + lc;
    const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;

    let w0 = 1 / 3;
    let w1 = 1 / 3;
    let w2 = 1 / 3;
    let s = 1;

    if (perimeter > 1e-9 && area > 1e-9) {
      w0 = la / perimeter;
      w1 = lb / perimeter;
      w2 = lc / perimeter;
      const inradius = (2 * area) / perimeter;
      const ix = w0 * ax + w1 * bx + w2 * cx;
      const iy = w0 * ay + w1 * by + w2 * cy;
      const maxCorner = Math.max(
        Math.hypot(ax - ix, ay - iy),
        Math.hypot(bx - ix, by - iy),
        Math.hypot(cx - ix, cy - iy)
      );
      s = Math.min(1 + padTexels / inradius, 1 + (padTexels * 3) / maxCorner);
    }

    for (let k = 0; k < 3; k++) {
      const b0 = w0 + ((k === 0 ? 1 : 0) - w0) * s;
      const b1 = w1 + ((k === 1 ? 1 : 0) - w1) * s;
      const b2 = w2 + ((k === 2 ? 1 : 0) - w2) * s;
      const o = (t + k) * 3;

      for (let axis = 0; axis < 3; axis++) {
        outPos[o + axis] =
          b0 * pos[t * 3 + axis] +
          b1 * pos[(t + 1) * 3 + axis] +
          b2 * pos[(t + 2) * 3 + axis];
        outNor[o + axis] =
          b0 * nor[t * 3 + axis] +
          b1 * nor[(t + 1) * 3 + axis] +
          b2 * nor[(t + 2) * 3 + axis];
      }
      for (let axis = 0; axis < 2; axis++) {
        outUv[(t + k) * 2 + axis] =
          b0 * uvs[t * 2 + axis] +
          b1 * uvs[(t + 1) * 2 + axis] +
          b2 * uvs[(t + 2) * 2 + axis];
      }
      outBary[o] = b0;
      outBary[o + 1] = b1;
      outBary[o + 2] = b2;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(outNor, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(outUv, 2));
  geometry.setAttribute("bary", new THREE.BufferAttribute(outBary, 3));
  return geometry;
}
