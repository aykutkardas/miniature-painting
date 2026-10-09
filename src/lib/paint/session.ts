import type { PaintEngine, PaintSnapshot } from "./engine";
import { PRIMER } from "./paints";
import { idbDelete, idbGet, idbSet } from "./storage";

const MAX_HISTORY = 60;

type EncodedSnapshot = { size: number; color: Blob; material: Blob };

async function encode(data: Uint8Array): Promise<Blob> {
  const blob = new Blob([data as BlobPart]);
  if (typeof CompressionStream === "undefined") return blob;
  return new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

async function decode(blob: Blob, compressed: boolean): Promise<Uint8Array> {
  const stream = compressed
    ? blob.stream().pipeThrough(new DecompressionStream("gzip"))
    : blob.stream();
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const isCompressed = () => typeof CompressionStream !== "undefined";

async function encodeSnapshot(snapshot: PaintSnapshot): Promise<EncodedSnapshot> {
  const [color, material] = await Promise.all([encode(snapshot.color), encode(snapshot.material)]);
  return { size: snapshot.size, color, material };
}

async function decodeSnapshot(encoded: EncodedSnapshot): Promise<PaintSnapshot> {
  const compressed = isCompressed();
  const [color, material] = await Promise.all([
    decode(encoded.color, compressed),
    decode(encoded.material, compressed),
  ]);
  return { size: encoded.size, color, material };
}

export type HistoryState = { canUndo: boolean; canRedo: boolean };

/**
 * Undo/redo + persistence around a PaintEngine. Snapshots are read
 * synchronously at commit time, then compressed off the hot path, so history
 * stays small (flat paint compresses extremely well) and painting never waits.
 */
export class PaintSession {
  private states: Promise<EncodedSnapshot>[] = [];
  private index = -1;
  private restoreToken = 0;
  private restoring = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private engine: PaintEngine,
    private storageKey: string,
    private onChange: (state: HistoryState) => void
  ) {}

  get busy() {
    return this.restoring > 0;
  }

  async init() {
    this.engine.clear(PRIMER.color, PRIMER.finish);
    this.restoring++;
    try {
      const saved = await idbGet<EncodedSnapshot>(this.storageKey);
      if (saved && saved.size === this.engine.size && !this.disposed) {
        this.engine.writeSnapshot(await decodeSnapshot(saved));
      }
    } catch (error) {
      console.warn("Could not restore saved paint, starting from primer.", error);
      this.engine.clear(PRIMER.color, PRIMER.finish);
    } finally {
      this.restoring--;
    }
    if (this.disposed) return;
    this.commit({ persist: false });
  }

  commit({ persist = true } = {}) {
    const encoded = encodeSnapshot(this.engine.readSnapshot());
    this.states = this.states.slice(0, this.index + 1);
    this.states.push(encoded);
    if (this.states.length > MAX_HISTORY) this.states.shift();
    this.index = this.states.length - 1;
    this.emit();
    if (persist) this.scheduleSave();
  }

  clear() {
    this.engine.clear(PRIMER.color, PRIMER.finish);
    this.commit();
  }

  undo() {
    if (this.index <= 0 || this.engine.isStroking) return;
    this.index--;
    this.applyCurrent();
  }

  redo() {
    if (this.index >= this.states.length - 1 || this.engine.isStroking) return;
    this.index++;
    this.applyCurrent();
  }

  private async applyCurrent() {
    const token = ++this.restoreToken;
    const target = this.states[this.index];
    this.emit();
    this.restoring++;
    try {
      const snapshot = await decodeSnapshot(await target);
      if (token === this.restoreToken && !this.disposed) {
        this.engine.writeSnapshot(snapshot);
        this.scheduleSave();
      }
    } finally {
      this.restoring--;
    }
  }

  private emit() {
    this.onChange({
      canUndo: this.index > 0,
      canRedo: this.index < this.states.length - 1,
    });
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      const current = this.states[this.index];
      if (!current) return;
      try {
        await idbSet(this.storageKey, await current);
      } catch (error) {
        console.warn("Could not save paint.", error);
      }
    }, 500);
  }

  async forget() {
    await idbDelete(this.storageKey);
  }

  dispose() {
    this.disposed = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      const current = this.states[this.index];
      if (current) current.then((s) => idbSet(this.storageKey, s)).catch(() => {});
    }
  }
}
