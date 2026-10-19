"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const GRID_W = 128;
const GRID_H = 64;
const ROW_BYTES = GRID_W / 8; // 16 bytes per row
const HALF_ROWS = GRID_H / 2; // 32 — top half is rows 0–31, bottom half rows 32–63
const HALF_BYTES = ROW_BYTES * HALF_ROWS; // 512
const FULL_BYTES = ROW_BYTES * GRID_H; // 1024
/** Parent rows drawn at full strength as the continuity hint (rows 29–31). */
const HINT_FIRST_ROW = HALF_ROWS - 3;

type Mode = "start" | "continue";

export interface PassDoodleCanvasProps {
  /**
   * "continue": parentDoodleData carries the half-doodle's top half and the
   * tool edits rows 32–63, emitting the merged full bitmask.
   * "start": the tool edits rows 0–31, emitting a top-half-only bitmask
   * (rows 32–63 blank) that becomes a PARENT pass-doodle capsule.
   */
  mode?: Mode;
  /** Full 1024-byte-when-decoded base64 bitmask of the pending parent. */
  parentDoodleData?: string;
  onChange: (mergedData: string | null) => void;
}

/**
 * Base64 → exactly one 1024-byte bitmask, null for anything else.
 * The parent's ink lives only in rows 0–31 (encoded by PixelCanvas:
 * byte = row*16 + (col >> 3), bit = col & 7, set = ink).
 */
function decodeParentMask(base64: string): Uint8Array | null {
  if (
    base64.length === 0 ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    return null;
  }
  try {
    const raw = atob(base64);
    if (raw.length !== FULL_BYTES) return null;
    const bytes = new Uint8Array(FULL_BYTES);
    for (let i = 0; i < FULL_BYTES; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Re-encode the full 1024-byte bitmask as base64 (chunked, like PixelCanvas).
 */
function encodeMask(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 1024;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

function hasAnyInk(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) return true;
  }
  return false;
}

/**
 * Pass-the-Doodle drawing board (PRD §3.3 P2).
 *
 * Continue mode: the incoming parent's top half is shown as a faded locked
 * preview, with its final three rows (29–31) at full strength as a
 * continuity hint at the boundary. The bottom half is drawn fresh; on
 * pointer-up the halves are merged into one 128×64 bitmask:
 *
 *   merged rows 0–31  = the parent's decoded top half, untouched
 *   merged rows 32–63 = this tool's ink
 *   byte = row*16 + (col >> 3), bit set at col & 7 = ink
 *
 * Start mode: the same tool edits rows 0–31 and emits a full-size bitmask
 * with rows 32–63 blank (the `isTopHalfOnly` envelope createCapsule checks).
 */
export default function PassDoodleCanvas({
  mode = "start",
  parentDoodleData = "",
  onChange,
}: PassDoodleCanvasProps) {
  const parentBits = useRef<Uint8Array | null>(decodeParentMask(parentDoodleData));
  const effectiveMode: Mode =
    mode === "continue" && parentBits.current ? "continue" : "start";

  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bitsRef = useRef<Uint8Array>(new Uint8Array(HALF_BYTES));
  const drawingRef = useRef(false);
  const lastCellRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"DRAW" | "ERASER">("DRAW");

  const redrawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const parent = parentBits.current;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, GRID_W, HALF_ROWS);
    ctx.fillStyle = getComputedStyle(canvas).color;
    for (let row = 0; row < HALF_ROWS; row++) {
      // Top of the half is faded; the last 3 rows read at full strength so
      // the next artist can meet the boundary lines.
      ctx.globalAlpha = row < HINT_FIRST_ROW ? 0.25 : 1;
      for (let col = 0; col < GRID_W; col++) {
        if (parent[row * ROW_BYTES + (col >> 3)] & (1 << (col & 7))) {
          ctx.fillRect(col, row, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, []);

  const redraw = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, GRID_W, HALF_ROWS);
    ctx.fillStyle = getComputedStyle(canvas).color;
    const bits = bitsRef.current;
    for (let row = 0; row < HALF_ROWS; row++) {
      for (let col = 0; col < GRID_W; col++) {
        if (bits[row * ROW_BYTES + (col >> 3)] & (1 << (col & 7))) {
          ctx.fillRect(col, row, 1, 1);
        }
      }
    }
  }, []);

  const emit = useCallback(() => {
    const bits = bitsRef.current;
    if (!hasAnyInk(bits)) {
      onChange(null);
      return;
    }
    const merged = new Uint8Array(FULL_BYTES);
    if (effectiveMode === "continue") {
      // User ink lands in rows 32–63 (bytes 512–1023).
      merged.set(bits, HALF_BYTES);
      // Parent's top half (bytes 0–511) is copied verbatim.
      const parent = parentBits.current;
      if (parent) {
        merged.set(parent.subarray(0, HALF_BYTES), 0);
      }
    } else {
      // Start mode: user rows are rows 0–31; bottom half stays blank.
      merged.set(bitsRef.current, 0);
    }
    onChange(encodeMask(merged));
  }, [effectiveMode, onChange]);

  const applyBrush = useCallback(
    (gx: number, gy: number, erase: boolean) => {
      const bits = bitsRef.current;
      const half = 1; // single brush size (diameter 3)
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || x >= GRID_W || y < 0 || y >= HALF_ROWS) continue;
          const byte = y * ROW_BYTES + (x >> 3);
          if (erase) bits[byte] &= ~(1 << (x & 7));
          else bits[byte] |= 1 << (x & 7);
        }
      }
    },
    [],
  );

  const cellFromEvent = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const x = Math.floor(((e.clientX - r.left) / r.width) * GRID_W);
      const y = Math.floor(((e.clientY - r.top) / r.height) * HALF_ROWS);
      if (x < 0 || x >= GRID_W || y < 0 || y >= HALF_ROWS) return null;
      return { x, y };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const cell = cellFromEvent(e);
      if (!cell) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastCellRef.current = cell;
      applyBrush(cell.x, cell.y, tool === "ERASER");
      redraw();
    },
    [applyBrush, cellFromEvent, redraw, tool],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const cell = cellFromEvent(e);
      if (!cell) return;
      const last = lastCellRef.current;
      if (last && last.x === cell.x && last.y === cell.y) return;
      if (last) {
        const steps = Math.max(Math.abs(cell.x - last.x), Math.abs(cell.y - last.y));
        for (let step = 1; step <= steps; step++) {
          const ix = Math.round(last.x + ((cell.x - last.x) * step) / steps);
          const iy = Math.round(last.y + ((cell.y - last.y) * step) / steps);
          applyBrush(ix, iy, tool === "ERASER");
        }
      } else {
        applyBrush(cell.x, cell.y, tool === "ERASER");
      }
      lastCellRef.current = cell;
      redraw();
    },
    [applyBrush, cellFromEvent, redraw, tool],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastCellRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      emit();
    },
    [emit],
  );

  const clearHalf = useCallback(() => {
    bitsRef.current.fill(0);
    redraw();
    onChange(null);
  }, [onChange, redraw]);

  // Paint the preview (parent top half + hint rows) and the empty grid once
  // on mount so the theme colors render correctly.
  useEffect(() => {
    redrawPreview();
    redraw();
  }, [redrawPreview, redraw]);

  const toolButton = (value: "DRAW" | "ERASER", label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setTool(value)}
      aria-pressed={tool === value}
      className={tool === value ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
    >
      {label}
    </button>
  );

  const drawHint =
    effectiveMode === "continue"
      ? "ارسم النص السفلي — خطوطك هتتلاقى مع خطوطه عند الفاصل."
      : "ارسم النص اللي فوق. اللي بعدك يكمّل اللي تحت — ولا يهمّك لو خطوطك مشظّرة.";

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--grid-line)", background: "var(--paper)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {toolButton("DRAW", "قلم")}
        {toolButton("ERASER", "امسح")}
        <button
          type="button"
          onClick={clearHalf}
          className="btn btn-sm btn-ghost ml-auto"
        >
          {effectiveMode === "continue" ? "امسح نصّي" : "امسح اللي فوق"}
        </button>
      </div>

      {effectiveMode === "continue" ? (
        <div className="mt-3">
          <p className="text-xs text-[color:var(--ink-muted)]">
            رسمة اللي قبلك (مقفولة)
          </p>
          <canvas
            ref={previewCanvasRef}
            width={GRID_W}
            height={HALF_ROWS}
            className="mx-auto mt-2 block w-full select-none rounded-sm"
            style={{
              maxWidth: 480,
              aspectRatio: "2 / 1",
              imageRendering: "pixelated",
              backgroundColor: "var(--paper)",
              border: "1px dashed var(--grid-line)",
            }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-[color:var(--ink-muted)]">
          نصّك في الكونفاس
        </p>
      )}

      <canvas
        ref={drawCanvasRef}
        width={GRID_W}
        height={HALF_ROWS}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="mx-auto mt-3 block w-full touch-none select-none rounded-sm"
        style={{
          maxWidth: 480,
          aspectRatio: "2 / 1",
          imageRendering: "pixelated",
          backgroundColor: "var(--paper)",
          border: "1px solid var(--grid-line)",
        }}
      />
      <p className="mt-2 text-xs text-[color:var(--ink-faint)]">{drawHint}</p>
    </div>
  );
}
