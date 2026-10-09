"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { useStudio } from "@/lib/studio-store";
import { createBasingTextures, createCuttingMatTexture } from "./textures";

export const BASE_HEIGHT = 0.07;
const BACKDROP = "#121715";

function CuttingMat() {
  const gl = useThree((s) => s.gl);
  const texture = useMemo(
    () => createCuttingMatTexture(gl.capabilities.getMaxAnisotropy()),
    [gl]
  );
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-BASE_HEIGHT} receiveShadow>
      <planeGeometry args={[6, 6]} />
      <meshStandardMaterial map={texture} roughness={0.92} metalness={0} />
    </mesh>
  );
}

function MiniatureBase() {
  const footprint = useStudio((s) => s.footprintRadius);
  const radius = Math.max(0.28, footprint * 1.1);
  const textures = useMemo(() => createBasingTextures(), []);
  useEffect(
    () => () => {
      textures.map.dispose();
      textures.bumpMap.dispose();
    },
    [textures]
  );

  return (
    <group position-y={-BASE_HEIGHT}>
      <mesh position-y={BASE_HEIGHT / 2} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.07, BASE_HEIGHT, 96, 1]} />
        <meshStandardMaterial color="#141416" roughness={0.38} metalness={0.05} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={BASE_HEIGHT + 0.0005} receiveShadow>
        <circleGeometry args={[radius * 0.985, 96]} />
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={2.5}
          roughness={0.95}
        />
      </mesh>
    </group>
  );
}

function DeskLamp() {
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(0, 0.4, 0);
    return object;
  }, []);

  return (
    <>
      <primitive object={target} />
      <spotLight
        position={[-2.1, 3.1, 2.3]}
        target={target}
        angle={0.36}
        penumbra={0.75}
        intensity={70}
        color="#ffe7cc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.015}
        shadow-camera-near={1}
        shadow-camera-far={10}
      />
    </>
  );
}

export function Stage() {
  return (
    <>
      <color attach="background" args={[BACKDROP]} />
      <fog attach="fog" args={[BACKDROP, 3.2, 8]} />

      <hemisphereLight args={["#cfd9ff", "#2b2219", 0.45]} />
      <DeskLamp />
      <directionalLight position={[2.4, 1.8, -2.8]} intensity={1.8} color="#9dbcff" />
      <directionalLight position={[1.5, 0.6, 2.5]} intensity={0.35} color="#ffffff" />

      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={3} color="#ffe2bf" position={[-3, 4, 3]} scale={[4, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2} color="#a9c4ff" position={[4, 2, -3]} scale={[2, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 5, 0]} scale={[6, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.2} color="#ffd29a" position={[2, 1, 4]} scale={1.5} target={[0, 0, 0]} />
      </Environment>

      <CuttingMat />
      <MiniatureBase />
    </>
  );
}
