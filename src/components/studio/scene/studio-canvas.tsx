"use client";

import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { toast } from "sonner";
import { DEFAULT_MODEL, useStudio } from "@/lib/studio-store";
import { CameraRig, HOME } from "./camera-rig";
import { PaintableModel } from "./paintable-model";
import { Stage } from "./stage";

class ModelErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    const { model } = useStudio.getState();
    if (model.url !== DEFAULT_MODEL.url) {
      URL.revokeObjectURL(model.url);
      toast.error("Couldn't open that model", {
        description: "Make sure it is a valid .glb file. Switched back to the default miniature.",
      });
      useStudio.setState({ model: DEFAULT_MODEL });
    } else {
      toast.error("The miniature failed to load", { description: "Check your connection and reload." });
      useStudio.setState({ modelStatus: "error" });
    }
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function StudioCanvas() {
  const model = useStudio((s) => s.model);

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.05, far: 40, position: [...HOME.position] }}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
      className="touch-none"
      aria-label="3D miniature painting canvas"
    >
      <Stage />
      <ModelErrorBoundary resetKey={model.storageKey}>
        <Suspense fallback={null}>
          <PaintableModel key={model.storageKey} url={model.url} storageKey={model.storageKey} />
        </Suspense>
      </ModelErrorBoundary>
      <CameraRig />
    </Canvas>
  );
}
