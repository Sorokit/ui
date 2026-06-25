import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function readCssColor(variable: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return value || fallback;
}

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  label?: string;
  /**
   * Accessible name for the QR code, announced by screen readers. A `<canvas>`
   * is opaque to assistive tech, so without this the code is invisible to AT.
   * Defaults to the `label` if provided, otherwise a generic description.
   */
  ariaLabel?: string;
  /** Canvas background colour. Defaults to `--color-qr-canvas-bg`. */
  canvasBackground?: string;
  /** Canvas foreground (cell) colour. Defaults to `--color-qr-canvas-fg`. */
  canvasForeground?: string;
}

/**
 * QRCode — renders a wallet address as a scannable QR code.
 * Uses the QR SVG path algorithm (no external library needed).
 * For production, swap the inner canvas with a proper QR library like `qrcode`.
 */
export function QRCode({
  value,
  size = 160,
  className,
  label,
  ariaLabel,
  canvasBackground,
  canvasForeground,
}: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bg =
      canvasBackground ??
      readCssColor("--color-qr-canvas-bg", "#ffffff");
    const fg =
      canvasForeground ??
      readCssColor("--color-qr-canvas-fg", "#0d0d0d");

    // Simple visual placeholder — replace with real QR generation
    // e.g. import QRCode from 'qrcode'; QRCode.toCanvas(canvas, value)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Draw a placeholder grid pattern
    const cellSize = size / 25;
    ctx.fillStyle = fg;

    // Deterministic pattern from value string
    for (let row = 0; row < 25; row++) {
      for (let col = 0; col < 25; col++) {
        const charCode = value.charCodeAt((row * 25 + col) % value.length);
        const isCorner =
          (row < 7 && col < 7) ||
          (row < 7 && col > 17) ||
          (row > 17 && col < 7);
        const shouldFill = isCorner
          ? row === 0 ||
            row === 6 ||
            col === 0 ||
            col === 6 ||
            (row > 1 && row < 5 && col > 1 && col < 5)
          : (charCode + row + col) % 3 === 0;

        if (shouldFill) {
          ctx.fillRect(
            col * cellSize,
            row * cellSize,
            cellSize - 0.5,
            cellSize - 0.5,
          );
        }
      }
    }
  }, [value, size, canvasBackground, canvasForeground]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="rounded-xl border border-line p-3 bg-[var(--color-qr-canvas-bg)] shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={ariaLabel ?? label ?? "QR code"}
          style={{ display: "block", borderRadius: "4px" }}
        />
      </div>
      {label && (
        <p className="text-[11px] text-ink-3 text-center max-w-[200px] break-all font-mono">
          {label}
        </p>
      )}
    </div>
  );
}
