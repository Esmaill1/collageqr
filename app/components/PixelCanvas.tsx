"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const GRID_W = 128;
const GRID_H = 64;
const ROW_BYTES = GRID_W / 8; // 16 bytes per row
const TOTAL_BYTES = ROW_BYTES * GRID_H; // 1024 raw bytes -> base64 <= 1368 chars

type Tool = "S" | "M" | "ERASER";

export interface PixelCanvasProps {
  onChange: (doodleData: string | null) => void;
}

/**
 * 128x64 1-bit pixel drawing pad (PictoChat style, PRD §3.3 P0).
 * Emits a raw row-major bitmask as base64 (< 2KB) on every finished stroke.
 * Decoding (x,y -> bit): byte = data[row*16 + (col >> 3)], bit = col & 7.
 */
export default function PixelCanvas({ onChange }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bitsRef = useRef<Uint8Array>(new Uint8Array(TOTAL_BYTES));
  const drawingRef = useRef(false);
  const lastCellRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<Tool>("M");

  const applyBrush = useCallback(
    (gx: number, gy: number, erase: boolean, diameter: number) => {
      const bits = bitsRef.current;
      const half = diameter >> 1;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) continue;
          const byte = y * ROW_BYTES + (x >> 3);
          if (erase) bits[byte] &= ~(1 << (x & 7));
          else bits[byte] |= 1 << (x & 7);
        }
      }
    },
    [],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, GRID_W, GRID_H);
    const ink = getComputedStyle(canvas).color;
    ctx.fillStyle = ink;
    const bits = bitsRef.current;
    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        if (bits[row * ROW_BYTES + (col >> 3)] & (1 << (col & 7))) {
          ctx.fillRect(col, row, 1, 1);
        }
      }
    }
  }, []);

  const encode = useCallback(() => {
    const bits = bitsRef.current;
    let hasInk = false;
    for (let i = 0; i < TOTAL_BYTES; i++) {
      if (bits[i] !== 0) {
        hasInk = true;
        break;
      }
    }
    if (!hasInk) return null;

    let binary = "";
    const CHUNK = 1024;
    for (let i = 0; i < TOTAL_BYTES; i += CHUNK) {
      binary += String.fromCharCode(...Array.from(bits.subarray(i, i + CHUNK)));
    }
    return btoa(binary);
  }, []);

  const clearGrid = useCallback(() => {
    bitsRef.current.fill(0);
    redraw();
    onChange(null);
  }, [onChange, redraw]);

  const cellFromEvent = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const x = Math.floor(((e.clientX - r.left) / r.width) * GRID_W);
      const y = Math.floor(((e.clientY - r.top) / r.height) * GRID_H);
      if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return null;
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
      applyBrush(cell.x, cell.y, tool === "ERASER", tool === "S" ? 1 : 3);
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
      // Interpolate between cells so fast strokes stay continuous.
      if (last) {
        const steps = Math.max(Math.abs(cell.x - last.x), Math.abs(cell.y - last.y));
        const diameter = tool === "S" ? 1 : 3;
        for (let step = 1; step <= steps; step++) {
          const ix = Math.round(last.x + ((cell.x - last.x) * step) / steps);
          const iy = Math.round(last.y + ((cell.y - last.y) * step) / steps);
          applyBrush(ix, iy, tool === "ERASER", diameter);
        }
      } else {
        applyBrush(cell.x, cell.y, tool === "ERASER", tool === "S" ? 1 : 3);
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
      onChange(encode());
    },
    [encode, onChange],
  );

  // Redraw on mount so the initial canvas state (and theme color) is painted.
  useEffect(() => {
    redraw();
  }, [redraw]);

  const toolButton = (value: Tool, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setTool(value)}
      className={
        tool === value
          ? "border border-accent px-2 py-1 text-xs font-bold text-accent"
          : "border border-ink px-2 py-1 text-xs opacity-70 text-ink"
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink opacity-70">قلم</span>
        {toolButton("S", "S")}
        {toolButton("M", "M")}
        {toolButton("ERASER", "امسح")}
        <button
          type="button"
          onClick={clearGrid}
          className="ml-auto border border-ink px-2 py-1 text-xs opacity-70 text-ink"
        >
          امسح كله
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={GRID_W}
        height={GRID_H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="mt-2 block w-full touch-none select-none border border-ink bg-bg"
        style={{ aspectRatio: "2 / 1", imageRendering: "pixelated" }}
      />
      <p className="mt-1 text-[10px] text-ink opacity-60">
        كونفاس 128×64 أبيض وأسود — ارسم حاجة صغيرة للي بعدك.
      </p>
    </div>
  );
}
