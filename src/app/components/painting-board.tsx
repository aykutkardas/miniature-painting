"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { SketchPicker } from "react-color";
import * as THREE from "three";
import BottomBar from "./bottom-bar";
const STORAGE_KEY = "paint-canvas";

type GLTFResult = {
  scene: THREE.Group;
  nodes: { [key: string]: THREE.Mesh };
};

type CanvasRefType = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
};

type PaintableModelProps = {
  url: string;
  selectedColor: string;
  brushRadius: number;
};

function PaintableModel({
  url,
  selectedColor,
  brushRadius,
}: PaintableModelProps) {
  const { scene } = useGLTF(url) as unknown as GLTFResult;
  const meshRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<CanvasRefType | null>(null);
  const painting = useRef(false);
  const history = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  useEffect(() => {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Restore from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const canvasTexture = new THREE.CanvasTexture(canvas);
        setTexture(canvasTexture);
        canvasRef.current = { canvas, ctx, texture: canvasTexture };
      };
      img.src = saved;
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const canvasTexture = new THREE.CanvasTexture(canvas);
      setTexture(canvasTexture);
      canvasRef.current = { canvas, ctx, texture: canvasTexture };
    }
  }, []);

  useEffect(() => {
    if (texture && meshRef.current) {
      meshRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;

          if (mesh.geometry && !mesh.geometry.attributes.normal) {
            mesh.geometry.computeVertexNormals();
          }

          mesh.material = new THREE.MeshStandardMaterial({
            color: "white",
            map: texture,
            roughness: 0.4,
            metalness: 0.0,
          });
        }
      });
    }
  }, [texture]);

  const handlePointerMove = (e: THREE.Event & PointerEvent) => {
    if (e.buttons === 1) {
      paintAt(e);
    }
  };

  const paintAt = (event: THREE.Event & PointerEvent) => {
    if (
      !painting.current ||
      event.altKey ||
      !canvasRef.current ||
      !meshRef.current
    )
      return;

    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const bounds = gl.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(meshRef.current, true);

    if (intersects.length > 0 && intersects[0].uv) {
      // Save current state for undo
      const dataUrl = canvasRef.current.canvas.toDataURL();
      history.current.push(dataUrl);
      redoStack.current = []; // clear redo on new paint

      const uv = intersects[0].uv;
      const x = uv.x * canvasRef.current.canvas.width;
      const y = (1 - uv.y) * canvasRef.current.canvas.height;

      const uvRadius = brushRadius / canvasRef.current.canvas.width;
      const pixelRadius = uvRadius * canvasRef.current.canvas.width;

      const { ctx, texture } = canvasRef.current;
      ctx.fillStyle = selectedColor;
      ctx.beginPath();
      ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
      ctx.fill();
      texture.needsUpdate = true;

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, canvasRef.current.canvas.toDataURL());
    }
  };

  const undo = () => {
    if (!canvasRef.current || history.current.length === 0) return;
    const dataUrl = history.current.pop();
    if (!dataUrl) return;
    redoStack.current.push(canvasRef.current.canvas.toDataURL());
    const img = new Image();
    img.onload = () => {
      const { ctx, texture } = canvasRef.current!;
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0);
      texture.needsUpdate = true;
      localStorage.setItem(STORAGE_KEY, canvasRef.current!.canvas.toDataURL());
    };
    img.src = dataUrl;
  };

  const redo = () => {
    if (!canvasRef.current || redoStack.current.length === 0) return;
    const dataUrl = redoStack.current.pop();
    if (!dataUrl) return;
    history.current.push(canvasRef.current.canvas.toDataURL());
    const img = new Image();
    img.onload = () => {
      const { ctx, texture } = canvasRef.current!;
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0);
      texture.needsUpdate = true;
      localStorage.setItem(STORAGE_KEY, canvasRef.current!.canvas.toDataURL());
    };
    img.src = dataUrl;
  };

  // Key bindings for undo/redo
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") undo();
      if (e.ctrlKey && e.key === "y") redo();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <group
      ref={meshRef}
      onPointerDown={(e) => {
        if (!e.altKey) {
          painting.current = true;
          paintAt(e);
        }
      }}
      onPointerMove={(e) => handlePointerMove(e)}
      onPointerUp={() => (painting.current = false)}
      onPointerLeave={() => (painting.current = false)}
    >
      <primitive object={scene} />
    </group>
  );
}

export default function PaintingBoard() {
  const [selectedColor, setSelectedColor] = useState<string>("#ff0000");
  const [brushRadius, setBrushRadius] = useState<number>(15);
  const [isAltPressed, setIsAltPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsAltPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsAltPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div className="relative" style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 60 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <pointLight position={[-3, -3, -3]} intensity={0.6} />
        <Suspense fallback={null}>
          <PaintableModel
            url="https://v3.fal.media/files/panda/PpIDlsfwmAMku_o_PMHxX_model.glb"
            selectedColor={selectedColor}
            brushRadius={brushRadius}
          />
        </Suspense>
        <OrbitControls
          enableZoom={true}
          enabled={isAltPressed}
          enablePan={false}
        />
      </Canvas>
      <BottomBar
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        brushSize={brushRadius}
        setBrushSize={setBrushRadius}
        onUndo={() => {
          const undoButton = document.querySelector('[title="Undo"]');
          if (undoButton) {
            (undoButton as HTMLElement).click();
          }
        }}
        onRedo={() => {
          const redoButton = document.querySelector('[title="Redo"]');
          if (redoButton) {
            (redoButton as HTMLElement).click();
          }
        }}
      />
    </div>
  );
}
