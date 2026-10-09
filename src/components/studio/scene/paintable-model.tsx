"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { toast } from "sonner";
import { PaintEngine } from "@/lib/paint/engine";
import { prepareModel } from "@/lib/paint/geometry";
import { PRIMER, brushHardnessFromSoftness, brushRadiusFromSize } from "@/lib/paint/paints";
import { PaintSession } from "@/lib/paint/session";
import { useStudio } from "@/lib/studio-store";
import { BrushCursor, type BrushCursorHandle } from "./brush-cursor";

type Controls = { enabled: boolean } | null;

type Hit = { point: THREE.Vector3; normal: THREE.Vector3; uv: THREE.Vector2 };

export function PaintableModel({ url, storageKey }: { url: string; storageKey: string }) {
  const gltf = useGLTF(url);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls;
  const cursorRef = useRef<BrushCursorHandle>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const prepared = useMemo(() => {
    const result = prepareModel(gltf.scene);
    if (result) result.geometry.boundsTree = new MeshBVH(result.geometry);
    return result;
  }, [gltf.scene]);

  const [resources, setResources] = useState<{
    engine: PaintEngine;
    material: THREE.MeshStandardMaterial;
  } | null>(null);
  const sessionRef = useRef<PaintSession | null>(null);

  useEffect(() => {
    if (!prepared) {
      useStudio.setState({ modelStatus: "error" });
      toast.error("This model has no paintable geometry.");
      return;
    }
    useStudio.setState({ footprintRadius: prepared.footprintRadius });
  }, [prepared]);

  useEffect(() => {
    if (!prepared) return;
    const engine = new PaintEngine(
      gl,
      prepared.geometry,
      Math.min(2048, gl.capabilities.maxTextureSize)
    );
    const material = new THREE.MeshStandardMaterial({
      map: engine.colorTarget.texture,
      roughnessMap: engine.materialTarget.texture,
      metalnessMap: engine.materialTarget.texture,
      roughness: 1,
      metalness: 1,
    });
    const session = new PaintSession(engine, storageKey, (state) => useStudio.setState(state));
    sessionRef.current = session;
    setResources({ engine, material });
    useStudio.setState({ modelStatus: "loading", canUndo: false, canRedo: false });
    session.init().then(() => {
      if (sessionRef.current === session) useStudio.setState({ modelStatus: "ready" });
    });

    useStudio.getState().registerActions({
      undo: () => session.undo(),
      redo: () => session.redo(),
      clearPaint: () => {
        session.clear();
        toast("Back to primer", {
          description: "All paint was removed.",
          action: { label: "Undo", onClick: () => session.undo() },
        });
      },
    });

    return () => {
      session.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
      setResources(null);
      engine.dispose();
      material.dispose();
    };
  }, [prepared, gl, storageKey]);

  useEffect(() => {
    if (!resources || !meshRef.current) return;
    const mesh = meshRef.current;
    const { engine } = resources;
    const canvas = gl.domElement;
    const host = canvas.parentElement ?? canvas;
    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    const ndc = new THREE.Vector2();
    const normalMatrix = new THREE.Matrix3();

    mesh.raycast = acceleratedRaycast;

    const raycast = (clientX: number, clientY: number): Hit | null => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (!hit || !hit.uv || !hit.face) return null;
      const localPoint = mesh.worldToLocal(hit.point.clone());
      return { point: localPoint, normal: hit.face.normal.clone(), uv: hit.uv.clone() };
    };

    const toWorld = (hit: Hit) => {
      normalMatrix.getNormalMatrix(mesh.matrixWorld);
      return {
        point: mesh.localToWorld(hit.point.clone()),
        normal: hit.normal.clone().applyMatrix3(normalMatrix).normalize(),
      };
    };

    const radius = () => brushRadiusFromSize(useStudio.getState().size);

    let activePointer: number | null = null;
    let mode: "paint" | "pick" | null = null;
    let lastScreen = { x: 0, y: 0 };
    let lastHit: Hit | null = null;

    const updateCursor = (hit: Hit | null) => {
      const { tool, pickerHeld, orbitHeld, color } = useStudio.getState();
      const effectiveTool = pickerHeld ? "picker" : tool;
      if (!hit || orbitHeld) {
        cursorRef.current?.hide();
        canvas.style.cursor = orbitHeld ? "grab" : "";
        return;
      }
      const world = toWorld(hit);
      cursorRef.current?.show(
        world.point,
        world.normal,
        effectiveTool === "picker" ? 0.012 : radius(),
        effectiveTool === "eraser" ? PRIMER.color : color,
        effectiveTool
      );
      canvas.style.cursor = "crosshair";
    };

    const pick = (hit: Hit) => {
      const { hex, finish } = engine.sample(hit.uv);
      const state = useStudio.getState();
      state.setColor(hex, finish);
      state.commitRecentColor();
    };

    const paintTo = (clientX: number, clientY: number) => {
      const r = radius();
      const dx = clientX - lastScreen.x;
      const dy = clientY - lastScreen.y;
      const screenDistance = Math.hypot(dx, dy);

      let stepPx = 2;
      if (lastHit) {
        const world = toWorld(lastHit);
        const distance = world.point.distanceTo(camera.position);
        const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
        const worldPerPx =
          (2 * distance * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) / canvas.clientHeight;
        stepPx = Math.max(1, (r * 0.25) / worldPerPx);
      }
      const steps = Math.min(64, Math.max(1, Math.ceil(screenDistance / stepPx)));

      let latest: Hit | null = null;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const hit = raycast(lastScreen.x + dx * t, lastScreen.y + dy * t);
        if (hit) {
          engine.addDab(hit.point, hit.normal);
          latest = hit;
        }
      }
      lastScreen = { x: clientX, y: clientY };
      if (latest) lastHit = latest;
      return latest;
    };

    const endGesture = () => {
      if (mode === "paint") {
        engine.endStroke();
        sessionRef.current?.commit();
        useStudio.getState().commitRecentColor();
      }
      if (activePointer !== null && canvas.hasPointerCapture(activePointer)) {
        canvas.releasePointerCapture(activePointer);
      }
      activePointer = null;
      mode = null;
      lastHit = null;
      if (controls) controls.enabled = true;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.target !== canvas || activePointer !== null) return;
      const state = useStudio.getState();
      if (event.button !== 0 || state.orbitHeld || state.modelStatus !== "ready") return;
      if (sessionRef.current?.busy) return;

      const hit = raycast(event.clientX, event.clientY);
      if (!hit) return;

      // Claim the gesture before camera controls see it.
      if (controls) controls.enabled = false;
      activePointer = event.pointerId;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic or already-released pointers cannot be captured; painting still works.
      }

      const tool = state.pickerHeld || event.altKey ? "picker" : state.tool;
      if (tool === "picker") {
        mode = "pick";
        pick(hit);
        updateCursor(hit);
        return;
      }

      mode = "paint";
      const erasing = tool === "eraser";
      engine.beginStroke({
        color: erasing ? PRIMER.color : state.color,
        finish: erasing ? PRIMER.finish : state.finish,
        radius: radius(),
        hardness: brushHardnessFromSoftness(state.softness),
        opacity: erasing ? 1 : state.opacity / 100,
      });
      engine.addDab(hit.point, hit.normal);
      lastScreen = { x: event.clientX, y: event.clientY };
      lastHit = hit;
      updateCursor(hit);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activePointer !== null && event.pointerId !== activePointer) return;

      if (mode === "paint") {
        const events = event.getCoalescedEvents?.() ?? [event];
        let latest: Hit | null = null;
        for (const e of events.length ? events : [event]) {
          latest = paintTo(e.clientX, e.clientY) ?? latest;
        }
        updateCursor(latest ?? raycast(event.clientX, event.clientY));
        return;
      }

      if (mode === "pick") {
        const hit = raycast(event.clientX, event.clientY);
        if (hit) pick(hit);
        updateCursor(hit);
        return;
      }

      if (event.buttons !== 0 && event.pointerType !== "mouse") return;
      updateCursor(event.buttons === 0 ? raycast(event.clientX, event.clientY) : null);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return;
      endGesture();
      if (event.pointerType === "mouse") updateCursor(raycast(event.clientX, event.clientY));
      else cursorRef.current?.hide();
    };

    const onPointerLeave = () => {
      if (activePointer === null) cursorRef.current?.hide();
    };

    const onBlur = () => {
      if (activePointer !== null) endGesture();
    };

    host.addEventListener("pointerdown", onPointerDown, { capture: true });
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onBlur);

    const unsubscribe = useStudio.subscribe((state, prev) => {
      if (
        state.orbitHeld !== prev.orbitHeld ||
        state.tool !== prev.tool ||
        state.pickerHeld !== prev.pickerHeld
      ) {
        if (state.orbitHeld) cursorRef.current?.hide();
        canvas.style.cursor = state.orbitHeld ? "grab" : "";
      }
      if (state.size !== prev.size || state.color !== prev.color) {
        cursorRef.current?.refresh(
          brushRadiusFromSize(state.size),
          state.tool === "eraser" ? PRIMER.color : state.color
        );
      }
    });

    return () => {
      if (activePointer !== null) endGesture();
      host.removeEventListener("pointerdown", onPointerDown, { capture: true });
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onBlur);
      unsubscribe();
      canvas.style.cursor = "";
    };
  }, [resources, gl, camera, controls]);

  useFrame(() => {
    resources?.engine.flush();
  });

  if (!prepared || !resources) return null;

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={prepared.geometry}
        material={resources.material}
        castShadow
        receiveShadow
      />
      <BrushCursor ref={cursorRef} />
    </>
  );
}
