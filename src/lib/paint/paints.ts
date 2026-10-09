export type Finish = "matte" | "satin" | "gloss" | "metal";

export const FINISHES: Record<Finish, { label: string; roughness: number; metalness: number }> = {
  matte: { label: "Matte", roughness: 0.88, metalness: 0 },
  satin: { label: "Satin", roughness: 0.5, metalness: 0 },
  gloss: { label: "Gloss", roughness: 0.16, metalness: 0 },
  metal: { label: "Metal", roughness: 0.3, metalness: 1 },
};

export const PRIMER = { color: "#7e8285", finish: "matte" as Finish };

export type PaintPot = { name: string; color: string; finish: Finish };

export const PAINT_POTS: PaintPot[] = [
  { name: "Chalk White", color: "#ece8dc", finish: "matte" },
  { name: "Bone", color: "#d8c79c", finish: "matte" },
  { name: "Warm Flesh", color: "#d99b76", finish: "satin" },
  { name: "Ochre", color: "#c98a1e", finish: "matte" },
  { name: "Scarlet", color: "#b2202c", finish: "satin" },
  { name: "Wine", color: "#5e1622", finish: "satin" },
  { name: "Leather", color: "#6a4127", finish: "satin" },
  { name: "Moss", color: "#4f6b2c", finish: "matte" },
  { name: "Teal", color: "#1f6a6b", finish: "satin" },
  { name: "Ultramarine", color: "#22408f", finish: "satin" },
  { name: "Abyss Black", color: "#16171a", finish: "gloss" },
  { name: "Gunmetal", color: "#62676c", finish: "metal" },
  { name: "Silver", color: "#c4c8cc", finish: "metal" },
  { name: "Brass", color: "#c9952f", finish: "metal" },
  { name: "Copper", color: "#b5653b", finish: "metal" },
  { name: "Primer Grey", color: PRIMER.color, finish: "matte" },
];

/** Maps the 1–100 UI size to a world-space radius (model height = 1). */
export function brushRadiusFromSize(size: number) {
  const t = (Math.min(Math.max(size, 1), 100) - 1) / 99;
  return 0.0015 * Math.pow(100, t);
}

/** Maps 0–100 softness to the inner hard-core ratio of the brush. */
export function brushHardnessFromSoftness(softness: number) {
  return 0.95 - (Math.min(Math.max(softness, 0), 100) / 100) * 0.95;
}

export function normalizeHex(value: string) {
  const v = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(v)) {
    return `#${v
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  return null;
}
