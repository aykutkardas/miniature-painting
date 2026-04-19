"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  Suspense,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Sidebar, { type Layer } from "./sidebar";

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
  layerLocked: boolean;
  layerVisible: boolean;
};

// Throttle localStorage writes: save at most once every 500 ms while painting.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(dataUrl: string) {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, dataUrl);
    saveTimer = null;
  }, 500);
}

function PaintableModel(
  {
    url,
    selectedColor,
    brushRadius,
    isSpacePressed,
    canvasRef,
    layerLocked,
    layerVisible,
  }: PaintableModelProps,
  ref: React.ForwardedRef<{ undo: () => void; redo: () => void }>
) {
  const { scene } = useGLTF(url) as unknown as GLTFResult;
  const meshRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const painting = useRef(false);

  // Each history entry is captured once per stroke (on pointerdown), not per pixel.
  const history = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  // Center the model when it loads.
  useEffect(() => {
    if (!meshRef.current) return;
    const box = new THREE.Box3().setFromObject(meshRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    meshRef.current.position.x = -center.x;
    meshRef.current.position.y = -center.y;
    meshRef.current.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.z = maxDim * 2;
  }, [scene, camera]);

  // Initialise the paint canvas once per mounted instance.
  useEffect(() => {
    const size = 1024;
    const offscreen = document.createElement("canvas");
    offscreen.width = offscreen.height = size;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const canvasTexture = new THREE.CanvasTexture(offscreen);
        setTexture(canvasTexture);
        canvasRef.current = { canvas: offscreen, ctx, texture: canvasTexture };
      };
      img.src = saved;
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const canvasTexture = new THREE.CanvasTexture(offscreen);
      setTexture(canvasTexture);
      canvasRef.current = { canvas: offscreen, ctx, texture: canvasTexture };
    }

    return () => {
      // Clean up texture when the component unmounts.
      canvasRef.current?.texture.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply texture to all meshes; dispose the old material to prevent GPU leaks.
  useEffect(() => {
    if (!texture || !meshRef.current) return;

    meshRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        if (mesh.geometry && !mesh.geometry.attributes.normal) {
          mesh.geometry.computeVertexNormals();
        }

        // Dispose previous material(s) before replacing.
        if (mesh.material) {
          const prev = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          prev.forEach((m) => m.dispose());
        }

        mesh.material = new THREE.MeshStandardMaterial({
          color: "white",
          map: texture,
          roughness: 0.2,
          metalness: 0.0,
        });
      }
    });
  }, [texture]);

  // Capture a snapshot at the START of a stroke (pointerdown), not per pixel.
  const captureStrokeStart = useCallback(() => {
    if (!canvasRef.current || layerLocked || !layerVisible) return;
    history.current.push(canvasRef.current.canvas.toDataURL());
    redoStack.current = [];
  }, [canvasRef, layerLocked, layerVisible]);

  const paintAt = useCallback(
    (event: PointerEvent) => {
      if (
        !painting.current ||
        isSpacePressed ||
        layerLocked ||
        !layerVisible ||
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
        const uv = intersects[0].uv;
        const { canvas: c, ctx, texture: tex } = canvasRef.current;
        const x = uv.x * c.width;
        const y = (1 - uv.y) * c.height;

        const uvRadius = brushRadius / c.width;
        const pixelRadius = uvRadius * c.width;

        ctx.fillStyle = selectedColor;
        ctx.beginPath();
        ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
        ctx.fill();
        tex.needsUpdate = true;

        // Throttled localStorage save.
        scheduleSave(c.toDataURL());
      }
    },
    [isSpacePressed, layerLocked, layerVisible, canvasRef, brushRadius, selectedColor, camera, gl]
  );

  const restoreFromDataUrl = useCallback(
    (dataUrl: string) => {
      if (!canvasRef.current) return;
      const { canvas: c, ctx, texture: tex } = canvasRef.current;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        tex.needsUpdate = true;
        localStorage.setItem(STORAGE_KEY, c.toDataURL());
      };
      img.src = dataUrl;
    },
    [canvasRef]
  );

  const undo = useCallback(() => {
    if (!canvasRef.current || history.current.length === 0) return;
    // Push current state onto redo stack before restoring.
    redoStack.current.push(canvasRef.current.canvas.toDataURL());
    const dataUrl = history.current.pop()!;
    restoreFromDataUrl(dataUrl);
  }, [canvasRef, restoreFromDataUrl]);

  const redo = useCallback(() => {
    if (!canvasRef.current || redoStack.current.length === 0) return;
    // Push current state onto history before restoring.
    history.current.push(canvasRef.current.canvas.toDataURL());
    const dataUrl = redoStack.current.pop()!;
    restoreFromDataUrl(dataUrl);
  }, [canvasRef, restoreFromDataUrl]);

  useImperativeHandle(ref, () => ({ undo, redo }), [undo, redo]);

  return (
    <group
      ref={meshRef}
      onPointerDown={(e) => {
        if (!isSpacePressed) {
          painting.current = true;
          captureStrokeStart();
          paintAt(e as unknown as PointerEvent);
        }
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) {
          paintAt(e as unknown as PointerEvent);
        }
      }}
      onPointerUp={() => (painting.current = false)}
      onPointerLeave={() => (painting.current = false)}
    >
      <primitive object={scene} />
    </group>
  );
}

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

  // Stable callback ref so the effect doesn't re-register on every render.
  const onExportRef = useRef(onExport);
  useEffect(() => {
    onExportRef.current = onExport;
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onExportRef.current(gl, scene, camera);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gl, scene, camera]);

  return null;
}

export default function PaintingBoard() {
  const [selectedColor, setSelectedColor] = useState<string>("#ff0000");
  const [brushRadius, setBrushRadius] = useState<number>(8);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([
    { id: "layer-base", name: "Base Layer", visible: true, locked: false, color: "#ff0000" },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("layer-base");
  const [modelUrl, setModelUrl] = useState<string>(
    "https://v3.fal.media/files/panda/BUZ_xt9BFOVvsX6dP3QFW_model.glb"
  );
  const modelRef = useRef<{ undo: () => void; redo: () => void }>(null);
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<CanvasRefType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Track the current object URL so we can revoke it when a new model is loaded.
  const objectUrlRef = useRef<string | null>(null);

  // Custom brush cursor — shows not-allowed when layer is locked or hidden.
  useEffect(() => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    const isBlocked = activeLayer?.locked || !activeLayer?.visible;

    const cursorStyle = isSpacePressed
      ? "default"
      : isBlocked
      ? "not-allowed"
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
  }, [isSpacePressed, brushRadius, layers, activeLayerId]);

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // Keyboard shortcuts for undo/redo.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isSpacePressed) return;
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
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isSpacePressed]);

  // Space toggles paint/view mode.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Revoke the previous object URL to free memory.
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    // Dispose the cached GLTF for the old URL so Three.js doesn't leak it.
    if (objectUrlRef.current) {
      useGLTF.clear(objectUrlRef.current);
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COLOR_STORAGE_KEY);

    const fileUrl = URL.createObjectURL(file);
    objectUrlRef.current = fileUrl;
    setModelUrl(fileUrl);

    if (controlsRef.current) {
      controlsRef.current.reset();
    }

    // Reset file input so the same file can be re-imported if needed.
    event.target.value = "";
  };

  const exportImage = useCallback(
    (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera
    ) => {
      renderer.render(scene, camera);
      const imageData = renderer.domElement.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imageData;
      link.download = `miniature-painting-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    []
  );

  // Trigger export directly without a synthetic keyboard event.
  const handleExportImage = useCallback(() => {
    if (!rendererRef.current) return;
    // Re-use the exportImage function; we need scene + camera from the renderer.
    // Dispatch the real shortcut so ExportHandler (which has scene/camera) fires it.
    const ev = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);
  }, []);

  return (
    <div className="relative" style={{ width: "calc(100vw - 220px)", height: "100vh" }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".glb"
        className="hidden"
      />
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          rendererRef.current = gl;
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.7} />

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
            layerLocked={layers.find((l) => l.id === activeLayerId)?.locked ?? false}
            layerVisible={layers.find((l) => l.id === activeLayerId)?.visible ?? true}
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enableZoom={true}
          enabled={isSpacePressed}
          enablePan={true}
          panSpeed={0.5}
          target={[0, 0, 0]}
          minDistance={1}
          maxDistance={10}
        />
        <ExportHandler onExport={exportImage} />
      </Canvas>
      <Sidebar
        selectedColor={selectedColor}
        setSelectedColor={(c) => {
          setSelectedColor(c);
          setLayers((prev) =>
            prev.map((l) => (l.id === activeLayerId ? { ...l, color: c } : l))
          );
        }}
        brushSize={brushRadius}
        setBrushSize={setBrushRadius}
        onUndo={() => modelRef.current?.undo()}
        onRedo={() => modelRef.current?.redo()}
        isSpacePressed={isSpacePressed}
        setIsSpacePressed={setIsSpacePressed}
        onResetCamera={resetCamera}
        onExportImage={handleExportImage}
        onImportModel={() => fileInputRef.current?.click()}
        layers={layers}
        activeLayerId={activeLayerId}
        onLayersChange={setLayers}
        onActiveLayerChange={(id) => {
          setActiveLayerId(id);
          const layer = layers.find((l) => l.id === id);
          if (layer) setSelectedColor(layer.color);
        }}
      />
    </div>
  );
}
