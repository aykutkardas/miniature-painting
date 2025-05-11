"use client";

import {
  useRef,
  useState,
  useEffect,
  Suspense,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { SketchPicker } from "react-color";
import * as THREE from "three";
import BottomBar from "./bottom-bar";
export const STORAGE_KEY = "paint-canvas";
export const COLOR_STORAGE_KEY = "paint-color";

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
  isSpacePressed: boolean;
  canvasRef: React.RefObject<CanvasRefType | null>;
};

function PaintableModel(
  {
    url,
    selectedColor,
    brushRadius,
    isSpacePressed,
    canvasRef,
  }: PaintableModelProps,
  ref: React.ForwardedRef<{ undo: () => void; redo: () => void }>
) {
  const { scene } = useGLTF(url) as unknown as GLTFResult;
  const meshRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const painting = useRef(false);
  const history = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  // Add step counter refs
  const lastUndoTime = useRef<number>(0);
  const lastRedoTime = useRef<number>(0);
  const undoStepCount = useRef<number>(1);
  const redoStepCount = useRef<number>(1);
  const CLICK_TIMEOUT = 3000; // 3 seconds

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
            roughness: 0.2,
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
      isSpacePressed ||
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

    const now = Date.now();
    if (now - lastUndoTime.current < CLICK_TIMEOUT) {
      // Increase step count if clicked within timeout
      undoStepCount.current += 2;
    } else {
      // Reset step count if timeout passed
      undoStepCount.current = 1;
    }
    lastUndoTime.current = now;

    // Perform multiple undos based on step count
    for (let i = 0; i < undoStepCount.current; i++) {
      if (history.current.length === 0) break;
      const dataUrl = history.current.pop();
      if (!dataUrl) break;
      redoStack.current.push(canvasRef.current.canvas.toDataURL());
      const img = new Image();
      img.onload = () => {
        const { ctx, texture } = canvasRef.current!;
        ctx.clearRect(0, 0, 1024, 1024);
        ctx.drawImage(img, 0, 0);
        texture.needsUpdate = true;
        localStorage.setItem(
          STORAGE_KEY,
          canvasRef.current!.canvas.toDataURL()
        );
      };
      img.src = dataUrl;
    }
  };

  const redo = () => {
    if (!canvasRef.current || redoStack.current.length === 0) return;

    const now = Date.now();
    if (now - lastRedoTime.current < CLICK_TIMEOUT) {
      // Increase step count if clicked within timeout
      redoStepCount.current += 2;
    } else {
      // Reset step count if timeout passed
      redoStepCount.current = 1;
    }
    lastRedoTime.current = now;

    // Perform multiple redos based on step count
    for (let i = 0; i < redoStepCount.current; i++) {
      if (redoStack.current.length === 0) break;
      const dataUrl = redoStack.current.pop();
      if (!dataUrl) break;
      history.current.push(canvasRef.current.canvas.toDataURL());
      const img = new Image();
      img.onload = () => {
        const { ctx, texture } = canvasRef.current!;
        ctx.clearRect(0, 0, 1024, 1024);
        ctx.drawImage(img, 0, 0);
        texture.needsUpdate = true;
        localStorage.setItem(
          STORAGE_KEY,
          canvasRef.current!.canvas.toDataURL()
        );
      };
      img.src = dataUrl;
    }
  };

  // Reset step counts after timeout
  useEffect(() => {
    const resetUndoSteps = () => {
      if (Date.now() - lastUndoTime.current >= CLICK_TIMEOUT) {
        undoStepCount.current = 1;
      }
    };

    const resetRedoSteps = () => {
      if (Date.now() - lastRedoTime.current >= CLICK_TIMEOUT) {
        redoStepCount.current = 1;
      }
    };

    const interval = setInterval(() => {
      resetUndoSteps();
      resetRedoSteps();
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  // Expose undo/redo functions to parent component
  useImperativeHandle(ref, () => ({
    undo,
    redo,
  }));

  return (
    <group
      ref={meshRef}
      onPointerDown={(e) => {
        if (!isSpacePressed) {
          painting.current = true;
          paintAt(e as unknown as PointerEvent);
        }
      }}
      onPointerMove={(e) => handlePointerMove(e as unknown as PointerEvent)}
      onPointerUp={() => (painting.current = false)}
      onPointerLeave={() => (painting.current = false)}
    >
      <primitive object={scene} />
    </group>
  );
}

// Create a forwardRef wrapper for PaintableModel
const PaintableModelWithRef = forwardRef(PaintableModel);

function ExportHandler({
  onExport,
}: {
  onExport: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) => void;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onExport(gl, scene, camera);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gl, scene, camera, onExport]);

  return null;
}

export default function PaintingBoard() {
  const [selectedColor, setSelectedColor] = useState<string>("#ff0000");
  const [brushRadius, setBrushRadius] = useState<number>(8);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [modelUrl, setModelUrl] = useState<string>(
    "https://v3.fal.media/files/panda/BUZ_xt9BFOVvsX6dP3QFW_model.glb"
  );
  const modelRef = useRef<{ undo: () => void; redo: () => void }>(null);
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<CanvasRefType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Add cursor style based on mode and brush size
  useEffect(() => {
    const cursorStyle = isSpacePressed
      ? "default"
      : `url("data:image/svg+xml,%3Csvg width='${brushRadius * 2}' height='${
          brushRadius * 2
        }' viewBox='0 0 ${brushRadius * 2} ${
          brushRadius * 2
        }' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='${brushRadius}' cy='${brushRadius}' r='${
          brushRadius - 1
        }' stroke='white' stroke-width='1' fill='none'/%3E%3C/svg%3E") ${brushRadius} ${brushRadius}, auto`;

    document.body.style.cursor = cursorStyle;

    return () => {
      document.body.style.cursor = "default";
    };
  }, [isSpacePressed, brushRadius]);

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isSpacePressed) {
        if ((e.metaKey || e.ctrlKey) && e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            modelRef.current?.redo();
          } else {
            modelRef.current?.undo();
          }
        } else if ((e.metaKey || e.ctrlKey) && e.key === "y") {
          e.preventDefault();
          modelRef.current?.redo();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isSpacePressed, modelRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // Prevent page scroll
        setIsSpacePressed((prev) => !prev); // Toggle the state
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the canvas and storage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COLOR_STORAGE_KEY);

    // Create a URL for the file
    const fileUrl = URL.createObjectURL(file);
    setModelUrl(fileUrl);

    // Reset camera position
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const exportImage = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) => {
    // Render the scene
    renderer.render(scene, camera);

    // Get the image data
    const imageData = renderer.domElement.toDataURL("image/png");

    // Create download link
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `miniature-painting-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative" style={{ width: "100vw", height: "100vh" }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".glb"
        className="hidden"
      />
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        onCreated={({ gl }) => {
          rendererRef.current = gl;
        }}
      >
        {/* Ambient light for base illumination */}
        <ambientLight intensity={0.4} />

        {/* Main directional lights from different angles */}
        <directionalLight
          position={[5, 5, 5]}
          intensity={0.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight
          position={[-5, 5, -5]}
          intensity={0.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight
          position={[0, -5, 0]}
          intensity={0.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* Fill lights for better detail visibility */}
        <pointLight position={[-3, -3, -3]} intensity={0.3} />
        <pointLight position={[3, 3, 3]} intensity={0.3} />
        <pointLight position={[0, 0, 5]} intensity={0.2} />

        <Suspense fallback={null}>
          <PaintableModelWithRef
            ref={modelRef}
            url={modelUrl}
            selectedColor={selectedColor}
            brushRadius={brushRadius}
            isSpacePressed={isSpacePressed}
            canvasRef={canvasRef}
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enableZoom={true}
          enabled={isSpacePressed}
          enablePan={true}
          panSpeed={0.5}
        />
        <ExportHandler onExport={exportImage} />
      </Canvas>
      <BottomBar
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        brushSize={brushRadius}
        setBrushSize={setBrushRadius}
        onUndo={() => modelRef.current?.undo()}
        onRedo={() => modelRef.current?.redo()}
        isSpacePressed={isSpacePressed}
        setIsSpacePressed={setIsSpacePressed}
        onResetCamera={resetCamera}
        onExportImage={() => {
          const event = new KeyboardEvent("keydown", {
            key: "s",
            metaKey: true,
          });
          window.dispatchEvent(event);
        }}
        onImportModel={() => fileInputRef.current?.click()}
      />
    </div>
  );
}
