import { useEffect, useRef, useState } from "react";
import QRCodeLib from "qrcode";
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
  /** Canvas background colour. Defaults to `--color-qr-canvas-bg`. */
  canvasBackground?: string;
  /** Canvas foreground (cell) colour. Defaults to `--color-qr-canvas-fg`. */
  canvasForeground?: string;
}

/**
 * QRCode — renders a wallet address as a scannable QR code.
 * Uses the qrcode library to render a valid QR code on the canvas.
 */
export function QRCode({
  value,
  size = 160,
  className,
  label,
  canvasBackground,
  canvasForeground,
}: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState(false);
  const lastPropsRef = useRef({ value, size, canvasBackground, canvasForeground });

  if (
    lastPropsRef.current.value !== value ||
    lastPropsRef.current.size !== size ||
    lastPropsRef.current.canvasBackground !== canvasBackground ||
    lastPropsRef.current.canvasForeground !== canvasForeground
  ) {
    lastPropsRef.current = { value, size, canvasBackground, canvasForeground };
    setRenderError(false);
  }

  useEffect(() => {
    if (renderError || !value) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setRenderError(true);
      return;
    }

    const bg =
      canvasBackground ??
      readCssColor("--color-qr-canvas-bg", "#ffffff");
    const fg =
      canvasForeground ??
      readCssColor("--color-qr-canvas-fg", "#0d0d0d");

    let active = true;

    QRCodeLib.toCanvas(
      canvas,
      value,
      {
        width: size,
        margin: 1,
        color: {
          dark: fg,
          light: bg,
        },
      },
      (error) => {
        if (error && active) {
          console.error("Failed to render QR Code:", error);
          setRenderError(true);
        }
      }
    );

    return () => {
      active = false;
    };
  }, [value, size, canvasBackground, canvasForeground, renderError]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className="rounded-xl border border-line p-3 bg-[var(--color-qr-canvas-bg)] shadow-[0_4px_16px_rgba(0,0,0,0.3)] flex items-center justify-center"
        style={{ width: size + 24, height: size + 24 }}
      >
        {renderError ? (
          <div
            className="flex flex-col items-center justify-center text-center p-2"
            style={{ width: size, height: size }}
          >
            <span className="text-[11px] text-ink-3 font-semibold mb-2">
              QR Code failed to load
            </span>
            <span className="text-[10px] text-ink-3 break-all font-mono select-all max-w-full">
              {value}
            </span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`QR code for address ${value}`}
            style={{ display: "block", borderRadius: "4px" }}
          />
        )}
      </div>
      {label && (
        <p className="text-[11px] text-ink-3 text-center max-w-[200px] break-all font-mono">
          {label}
        </p>
      )}
    </div>
  );
}
