"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Tool } from "@/lib/studio-store";

export type BrushCursorHandle = {
  show: (point: THREE.Vector3, normal: THREE.Vector3, radius: number, color: string, tool: Tool) => void;
  refresh: (radius: number, color: string) => void;
  hide: () => void;
};

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Surface-aligned ring that shows the true world-space size of the brush. */
export const BrushCursor = forwardRef<BrushCursorHandle>(function BrushCursor(_, ref) {
  const group = useRef<THREE.Group>(null);
  const toolRef = useRef<Tool>("brush");

  const materials = useMemo(
    () => ({
      fill: new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.28,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
      outer: new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
      inner: new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    }),
    []
  );

  useImperativeHandle(ref, () => ({
    show(point, normal, radius, color, tool) {
      const g = group.current;
      if (!g) return;
      toolRef.current = tool;
      g.visible = true;
      g.position.copy(point).addScaledVector(normal, 0.002);
      g.quaternion.setFromUnitVectors(Z_AXIS, normal);
      g.scale.setScalar(radius);
      materials.fill.color.set(color);
      materials.fill.opacity = tool === "picker" ? 0 : 0.28;
    },
    refresh(radius, color) {
      const g = group.current;
      if (!g || !g.visible || toolRef.current === "picker") return;
      g.scale.setScalar(radius);
      materials.fill.color.set(color);
    },
    hide() {
      if (group.current) group.current.visible = false;
    },
  }));

  return (
    <group ref={group} name="brush-cursor" visible={false} renderOrder={999}>
      <mesh material={materials.fill} renderOrder={999}>
        <circleGeometry args={[1, 48]} />
      </mesh>
      <mesh material={materials.inner} renderOrder={1000}>
        <ringGeometry args={[0.86, 0.93, 64]} />
      </mesh>
      <mesh material={materials.outer} renderOrder={1001}>
        <ringGeometry args={[0.93, 1, 64]} />
      </mesh>
    </group>
  );
});
