import * as THREE from "three";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A self-healing hobby cutting mat: 1 cm grid, 5 cm major lines, 45° guides,
 * ruler numbers along the edges and a fine speckle for material grain.
 * The mat covers 60 × 60 cm, mapped to 6 × 6 world units.
 */
export function createCuttingMatTexture(maxAnisotropy: number) {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(7);

  ctx.fillStyle = "#24493f";
  ctx.fillRect(0, 0, size, size);

  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);

  const cm = size / 60;
  const margin = cm * 2;

  ctx.lineCap = "square";
  for (let i = 0; i <= 56; i++) {
    const p = margin + i * cm;
    const major = i % 5 === 0;
    ctx.strokeStyle = major ? "rgba(196, 226, 211, 0.55)" : "rgba(160, 205, 186, 0.22)";
    ctx.lineWidth = major ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(p, margin);
    ctx.lineTo(p, size - margin);
    ctx.moveTo(margin, p);
    ctx.lineTo(size - margin, p);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, margin, size - margin * 2, size - margin * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(196, 226, 211, 0.18)";
  ctx.lineWidth = 1.4;
  for (let i = -56; i <= 56; i += 10) {
    ctx.beginPath();
    ctx.moveTo(margin + i * cm, margin);
    ctx.lineTo(margin + (i + 56) * cm, size - margin);
    ctx.moveTo(size - margin - i * cm, margin);
    ctx.lineTo(size - margin - (i + 56) * cm, size - margin);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(210, 234, 222, 0.7)";
  ctx.font = `600 ${Math.round(cm * 0.55)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 56; i += 5) {
    const p = margin + i * cm;
    ctx.fillText(String(i), p, margin * 0.5);
    ctx.fillText(String(i), p, size - margin * 0.5);
    ctx.fillText(String(i), margin * 0.5, p);
    ctx.fillText(String(i), size - margin * 0.5, p);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Basing sand with scattered gravel: color map plus a matching bump map. */
export function createBasingTextures() {
  const size = 1024;
  const rand = mulberry32(42);

  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  color.width = color.height = bump.width = bump.height = size;
  const c = color.getContext("2d")!;
  const b = bump.getContext("2d")!;

  c.fillStyle = "#5b4a36";
  c.fillRect(0, 0, size, size);
  b.fillStyle = "#606060";
  b.fillRect(0, 0, size, size);

  for (let i = 0; i < 26000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 2.2;
    const tone = 70 + rand() * 70;
    c.fillStyle = `rgb(${tone + 22}, ${tone + 8}, ${tone - 14})`;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    const h = 90 + rand() * 120;
    b.fillStyle = `rgb(${h}, ${h}, ${h})`;
    b.beginPath();
    b.arc(x, y, r, 0, Math.PI * 2);
    b.fill();
  }

  for (let i = 0; i < 70; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 6 + rand() * 14;
    const tone = 95 + rand() * 60;
    const gradient = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gradient.addColorStop(0, `rgb(${tone + 30}, ${tone + 24}, ${tone + 14})`);
    gradient.addColorStop(1, `rgb(${tone - 30}, ${tone - 34}, ${tone - 40})`);
    c.fillStyle = gradient;
    c.beginPath();
    c.ellipse(x, y, r, r * (0.6 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
    c.fill();

    const bg = b.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#6a6a6a");
    b.fillStyle = bg;
    b.beginPath();
    b.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    b.fill();
  }

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
}
