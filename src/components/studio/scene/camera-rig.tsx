"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import * as THREE from "three";
import { toast } from "sonner";
import { useStudio } from "@/lib/studio-store";

export const HOME = { position: [1.25, 1.05, 2.45] as const, target: [0, 0.44, 0] as const };

export function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.setLookAt(...HOME.position, ...HOME.target, false);
    // Keeps zoom-to-cursor and panning from drifting the miniature out of frame.
    controls.setBoundary(new THREE.Box3(new THREE.Vector3(-0.55, -0.05, -0.55), new THREE.Vector3(0.55, 1.05, 0.55)));

    useStudio.getState().registerActions({
      resetView: () => {
        controls.setLookAt(...HOME.position, ...HOME.target, true);
      },
      screenshot: () => {
        const cursor = scene.getObjectByName("brush-cursor");
        const wasVisible = cursor?.visible ?? false;
        if (cursor) cursor.visible = false;
        gl.render(scene, camera);
        const url = gl.domElement.toDataURL("image/png");
        if (cursor) cursor.visible = wasVisible;

        const link = document.createElement("a");
        link.href = url;
        link.download = `miniature-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
        link.click();
        toast.success("Photo saved", { description: "Your miniature was saved as a PNG." });
      },
    });
  }, [gl, scene, camera]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={0.35}
      maxDistance={3.6}
      maxPolarAngle={Math.PI * 0.54}
      smoothTime={0.18}
      draggingSmoothTime={0.08}
      dollySpeed={0.6}
      mouseButtons={{
        left: CameraControlsImpl.ACTION.ROTATE,
        middle: CameraControlsImpl.ACTION.DOLLY,
        right: CameraControlsImpl.ACTION.TRUCK,
        wheel: CameraControlsImpl.ACTION.DOLLY,
      }}
      touches={{
        one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
        two: CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK,
        three: CameraControlsImpl.ACTION.TOUCH_TRUCK,
      }}
    />
  );
}
