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

const CANVAS_SIZE = 1024;

type GLTFResult = {
  scene: THREE.Group;
  nodes: { [key: string]: THREE.Mesh };
};

export type LightingConfig = {
  ambientIntensity: number;
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
};

export type MaterialConfig = {
  roughness: number;
  metalness: number;
};

// ─── Per-layer canvas storage ─────────────────────────────────────────────────
// Keyed by layer id. Lives outside React so it is shared between
// PaintableModel (painter) and PaintingBoard (compositor).
export const layerCanvases = new Map<
  string,
  { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }
>();

// Output composite canvas fed into the Three.js texture.
let compositeCanvas: HTMLCanvasElement | null = null;
let compositeCtx: CanvasRenderingContext2D | null = null;
let compositeTexture: THREE.CanvasTexture | null = null;

/** Flatten all visible layers onto compositeCanvas and mark the texture dirty. */
export function recomposite(layers: Layer[]) {
  if (!compositeCtx || !compositeCanvas || !compositeTexture) return;
  const w = compositeCanvas.width;
  const h = compositeCanvas.height;
  // Start with white base
  compositeCtx.fillStyle = "#ffffff";
  compositeCtx.fillRect(0, 0, w, h);
  for (const layer of layers) {
    if (!layer.visible) continue;
    const lc = layerCanvases.get(layer.id);
    if (lc) compositeCtx.drawImage(lc.canvas, 0, 0);
  }
  compositeTexture.needsUpdate = true;
}

/** Schedule a recomposite via rAF — at most one per frame, no stale-closure risk. */
let rafPending = false;
let pendingLayers: Layer[] | null = null;
export function scheduleRecomposite(layers: Layer[]) {
  pendingLayers = layers;
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    if (pendingLayers) recomposite(pendingLayers);
    rafPending = false;
    pendingLayers = null;
  });
}

// ─── Ensure a layer canvas exists ────────────────────────────────────────────
function ensureLayerCanvas(layerId: string) {
  if (layerCanvases.has(layerId)) return layerCanvases.get(layerId)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;
  // Transparent by default
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  layerCanvases.set(layerId, { canvas, ctx });
  return { canvas, ctx };
}

// ─── PaintableModel ───────────────────────────────────────────────────────────
type PaintableModelProps = {
  url: string;
  selectedColor: string;
  brushRadius: number;
  isSpacePressed: boolean;
  layerLocked: boolean;
  layerVisible: boolean;
  activeLayerId: string;
  layersRef: React.RefObject<Layer[]>;
  modelScaleRef: React.RefObject<number>;
  materialConfig: MaterialConfig;
  onTextureReady: (tex: THREE.CanvasTexture) => void;
};

function PaintableModel(
  {
    url,
    selectedColor,
    brushRadius,
    isSpacePressed,
    layerLocked,
    layerVisible,
    activeLayerId,
    layersRef,
    modelScaleRef,
    materialConfig,
    onTextureReady,
  }: PaintableModelProps,
  ref: React.ForwardedRef<{ undo: () => void; redo: () => void }>
) {
  const { scene } = useGLTF(url) as unknown as GLTFResult;
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const painting = useRef(false);

  // Per-layer undo/redo stacks  { layerId -> dataUrl[] }
  const history = useRef<Map<string, string[]>>(new Map());
  const redoStack = useRef<Map<string, string[]>>(new Map());

  // Initialise composite canvas once on mount.
  useEffect(() => {
    if (!compositeCanvas) {
      compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = compositeCanvas.height = CANVAS_SIZE;
      compositeCtx = compositeCanvas.getContext("2d")!;
      compositeCtx.fillStyle = "#ffffff";
      compositeCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    if (!compositeTexture) {
      compositeTexture = new THREE.CanvasTexture(compositeCanvas);
    }
    // Ensure the initial base layer canvas exists.
    layersRef.current?.forEach((l) => ensureLayerCanvas(l.id));
    recomposite(layersRef.current ?? []);
    setTexture(compositeTexture);
    onTextureReady(compositeTexture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center model and record bounding dim for potential future use.
  useEffect(() => {
    if (!meshRef.current) return;
    const box = new THREE.Box3().setFromObject(meshRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    meshRef.current.position.x = -center.x;
    meshRef.current.position.y = -center.y;
    meshRef.current.position.z = -center.z;
    const maxDim = Math.max(size.x, size.y, size.z);
    modelScaleRef.current = maxDim;
    camera.position.z = maxDim * 2;
  }, [scene, camera, modelScaleRef]);

  // Re-apply material when texture or material config changes.
  useEffect(() => {
    if (!texture || !meshRef.current) return;
    meshRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry && !mesh.geometry.attributes.normal) {
          mesh.geometry.computeVertexNormals();
        }
        if (mesh.material) {
          const prev = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          prev.forEach((m) => m.dispose());
        }
        mesh.material = new THREE.MeshStandardMaterial({
          color: "white",
          map: texture,
          roughness: materialConfig.roughness,
          metalness: materialConfig.metalness,
        });
      }
    });
  }, [texture, materialConfig]);

  const captureStrokeStart = useCallback(() => {
    if (layerLocked || !layerVisible) return;
    const lc = layerCanvases.get(activeLayerId);
    if (!lc) return;
    const stack = history.current.get(activeLayerId) ?? [];
    stack.push(lc.canvas.toDataURL());
    history.current.set(activeLayerId, stack);
    redoStack.current.set(activeLayerId, []);
  }, [activeLayerId, layerLocked, layerVisible]);

  const paintAt = useCallback(
    (uv: THREE.Vector2) => {
      if (!painting.current || isSpacePressed || layerLocked || !layerVisible) return;
      const lc = layerCanvases.get(activeLayerId);
      if (!lc) return;
      const x = uv.x * CANVAS_SIZE;
      const y = (1 - uv.y) * CANVAS_SIZE;
      lc.ctx.fillStyle = selectedColor;
      lc.ctx.beginPath();
      lc.ctx.arc(x, y, Math.max(1, brushRadius), 0, Math.PI * 2);
      lc.ctx.fill();
      // Use ref so this callback is never recreated just because layers changed.
      scheduleRecomposite(layersRef.current ?? []);
    },
    [isSpacePressed, layerLocked, layerVisible, activeLayerId, brushRadius, selectedColor, layersRef]
  );

  const restoreLayerFromDataUrl = useCallback(
    (layerId: string, dataUrl: string) => {
      const lc = layerCanvases.get(layerId);
      if (!lc) return;
      const img = new Image();
      img.onload = () => {
        lc.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        lc.ctx.drawImage(img, 0, 0);
        recomposite(layersRef.current ?? []);
      };
      img.src = dataUrl;
    },
    [layersRef]
  );

  const clearLayerCanvas = useCallback(
    (layerId: string) => {
      const lc = layerCanvases.get(layerId);
      if (!lc) return;
      lc.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      recomposite(layersRef.current ?? []);
    },
    [layersRef]
  );

  const undo = useCallback(() => {
    const stack = history.current.get(activeLayerId);
    if (!stack || stack.length === 0) return;
    const lc = layerCanvases.get(activeLayerId);
    const current = lc?.canvas.toDataURL() ?? "";
    const redo = redoStack.current.get(activeLayerId) ?? [];
    redo.push(current);
    redoStack.current.set(activeLayerId, redo);
    const prev = stack.pop()!;
    history.current.set(activeLayerId, stack);
    restoreLayerFromDataUrl(activeLayerId, prev);
  }, [activeLayerId, restoreLayerFromDataUrl]);

  const redo = useCallback(() => {
    const stack = redoStack.current.get(activeLayerId);
    if (!stack || stack.length === 0) return;
    const lc = layerCanvases.get(activeLayerId);
    const current = lc?.canvas.toDataURL() ?? "";
    const hist = history.current.get(activeLayerId) ?? [];
    hist.push(current);
    history.current.set(activeLayerId, hist);
    const next = stack.pop()!;
    redoStack.current.set(activeLayerId, stack);
    restoreLayerFromDataUrl(activeLayerId, next);
  }, [activeLayerId, restoreLayerFromDataUrl]);

  useImperativeHandle(
    ref,
    () => ({ undo, redo, clearLayerCanvas }),
    [undo, redo, clearLayerCanvas]
  );

  return (
    <group
      ref={meshRef}
      onPointerDown={(e) => {
        if (!isSpacePressed && e.uv) {
          e.stopPropagation();
          painting.current = true;
          captureStrokeStart();
          paintAt(e.uv);
        }
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1 && e.uv) {
          e.stopPropagation();
          paintAt(e.uv);
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        painting.current = false;
      }}
      onPointerLeave={() => (painting.current = false)}
    >
      <primitive object={scene} />
    </group>
  );
}

const PaintableModelWithRef = forwardRef(PaintableModel);

// ─── ExportHandler ─────────────────────────────────────────────────────────────
function ExportHandler({
  onExport,
}: {
  onExport: (r: THREE.WebGLRenderer, s: THREE.Scene, c: THREE.Camera) => void;
}) {
  const { gl, scene, camera } = useThree();
  const onExportRef = useRef(onExport);
  useEffect(() => { onExportRef.current = onExport; });
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

// ─── PaintingBoard ─────────────────────────────────────────────────────────────
export default function PaintingBoard() {
  const [selectedColor, setSelectedColor] = useState<string>("#ff0000");
  const [brushRadius, setBrushRadius] = useState<number>(10);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([
    { id: "layer-base", name: "Base Layer", visible: true, locked: false, color: "#ff0000" },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("layer-base");
  const [lightingConfig, setLightingConfig] = useState<LightingConfig>({
    ambientIntensity: 0.7,
    keyIntensity: 0.8,
    fillIntensity: 0.6,
    rimIntensity: 0.4,
  });
  const [materialConfig, setMaterialConfig] = useState<MaterialConfig>({
    roughness: 0.7,
    metalness: 0.0,
  });
  const [modelUrl, setModelUrl] = useState<string>(
    "https://v3b.fal.media/files/b/0a96e030/OHi5fn45b9ZKx5KPpsv31_model.glb"
  );

  const modelRef = useRef<{ undo: () => void; redo: () => void; clearLayerCanvas: (id: string) => void }>(null);
  const controlsRef = useRef<any>(null);
  const modelScaleRef = useRef<number>(1);
  // Always-current ref so paintAt callbacks never need to be recreated on layer change.
  const layersRef = useRef<Layer[]>(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Recomposite whenever layer visibility changes.
  useEffect(() => {
    recomposite(layers);
  }, [layers]);

  // Custom brush cursor.
  useEffect(() => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    const isBlocked = activeLayer?.locked || !activeLayer?.visible;
    const cursorStyle = isSpacePressed
      ? "default"
      : isBlocked
        ? "not-allowed"
        : `url("data:image/svg+xml,%3Csvg width='${brushRadius * 2}' height='${brushRadius * 2}' viewBox='0 0 ${brushRadius * 2} ${brushRadius * 2}' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='${brushRadius}' cy='${brushRadius}' r='${brushRadius - 1}' stroke='white' stroke-width='1' fill='none'/%3E%3C/svg%3E") ${brushRadius} ${brushRadius}, auto`;
    document.body.style.cursor = cursorStyle;
    return () => { document.body.style.cursor = "default"; };
  }, [isSpacePressed, brushRadius, layers, activeLayerId]);

  const resetCamera = () => { if (controlsRef.current) controlsRef.current.reset(); };

  // Undo/redo keyboard shortcuts.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isSpacePressed) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? modelRef.current?.redo() : modelRef.current?.undo();
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
      if (e.code === "Space") { e.preventDefault(); setIsSpacePressed((p) => !p); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      useGLTF.clear(objectUrlRef.current);
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COLOR_STORAGE_KEY);
    // Clear all layer canvases for the new model.
    layerCanvases.forEach((lc) => lc.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE));
    const fileUrl = URL.createObjectURL(file);
    objectUrlRef.current = fileUrl;
    setModelUrl(fileUrl);
    if (controlsRef.current) controlsRef.current.reset();
    event.target.value = "";
  };

  const exportImage = useCallback(
    (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
      renderer.render(scene, camera);
      const link = document.createElement("a");
      link.href = renderer.domElement.toDataURL("image/png");
      link.download = `miniature-painting-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    []
  );

  const handleExportImage = useCallback(() => {
    const ev = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);
  }, []);

  // When layers change (add/remove/visibility), ensure layer canvases exist and recomposite.
  const handleLayersChange = useCallback((newLayers: Layer[]) => {
    // Ensure a canvas exists for any new layer.
    newLayers.forEach((l) => ensureLayerCanvas(l.id));
    // Remove canvases for deleted layers.
    const newIds = new Set(newLayers.map((l) => l.id));
    layerCanvases.forEach((_, id) => {
      if (!newIds.has(id)) layerCanvases.delete(id);
    });
    setLayers(newLayers);
    // Recomposite is triggered by the layers useEffect above.
  }, []);

  return (
    <div
      className="flex w-full h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".glb"
        className="hidden"
      />
      {/* Canvas area — grows to fill available width */}
      <div className="relative flex-1">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          rendererRef.current = gl;
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={lightingConfig.ambientIntensity} />
        <directionalLight position={[5, 5, 5]} intensity={lightingConfig.keyIntensity} />
        <directionalLight position={[-5, 3, 3]} intensity={lightingConfig.fillIntensity} />
        <directionalLight position={[0, 2, -6]} intensity={lightingConfig.rimIntensity} />

        <Suspense fallback={null}>
          <PaintableModelWithRef
            ref={modelRef}
            url={modelUrl}
            selectedColor={selectedColor}
            brushRadius={brushRadius}
            isSpacePressed={isSpacePressed}
            layerLocked={layers.find((l) => l.id === activeLayerId)?.locked ?? false}
            layerVisible={layers.find((l) => l.id === activeLayerId)?.visible ?? true}
            activeLayerId={activeLayerId}
            layersRef={layersRef}
            modelScaleRef={modelScaleRef}
            materialConfig={materialConfig}
            onTextureReady={() => {}}
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enableZoom={true}
          enabled={isSpacePressed}
          enablePan={true}
          panSpeed={0.5}
          target={[0, 0, 0]}
        />
        <ExportHandler onExport={exportImage} />
      </Canvas>
      </div>{/* end canvas wrapper */}
      <Sidebar
        selectedColor={selectedColor}
        setSelectedColor={(c) => {
          setSelectedColor(c);
          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, color: c } : l)));
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
        onLayersChange={handleLayersChange}
        onActiveLayerChange={(id) => {
          setActiveLayerId(id);
          const layer = layers.find((l) => l.id === id);
          if (layer) setSelectedColor(layer.color);
        }}
        lightingConfig={lightingConfig}
        onLightingChange={setLightingConfig}
        materialConfig={materialConfig}
        onMaterialChange={setMaterialConfig}
      />
    </div>
  );
}
