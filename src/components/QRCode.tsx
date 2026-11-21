import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import QRCodeLib from "qrcode";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  /**
   * Longer accessible description announced in addition to the label, e.g.
   * "Scan this code to receive funds at your Stellar address." Rendered as
   * visually-hidden text linked to the canvas via `aria-describedby`.
   */
  description?: string;
  /** Canvas background colour. Defaults to `--color-qr-canvas-bg`. */
  canvasBackground?: string;
  /** Canvas foreground (cell) colour. Defaults to `--color-qr-canvas-fg`. */
  canvasForeground?: string;
  /** File name (without extension) used by the "Download QR" action. */
  downloadFileName?: string;
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
  ariaLabel,
  description,
  canvasBackground,
  canvasForeground,
  downloadFileName = "qr-code",
}: QRCodeProps) {
  if (size <= 0) {
    console.warn("QRCode size must be greater than 0, got", size);
  }

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [prevProps, setPrevProps] = useState({ value, size, canvasBackground, canvasForeground });
  const descriptionId = `qr-desc-${useId().replace(/:/g, "")}`;

  // A zero or negative size gives the canvas invalid dimensions and renders as
  // a broken box. Derived rather than stored so the spinner doesn't sit
  // running while waiting on a draw that will never be attempted.
  const hasInvalidSize = !size || size <= 0;

  if (
    prevProps.value !== value ||
    prevProps.size !== size ||
    prevProps.canvasBackground !== canvasBackground ||
    prevProps.canvasForeground !== canvasForeground
  ) {
    setPrevProps({ value, size, canvasBackground, canvasForeground });
    setRenderError(false);
    setIsLoading(true);
  }
  useEffect(() => {
    if (renderError || !value) return;

    if (hasInvalidSize) {
      console.warn("[QRCode] size must be > 0");
      return;
    }

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
      (error: Error | null | undefined) => {
        if (error && active) {
          console.error("Failed to render QR Code:", error);
          setRenderError(true);
        }
        if (active) setIsLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [value, size, canvasBackground, canvasForeground, renderError, hasInvalidSize]);

  // Re-encode the value as an SVG and hand it to the browser as a file. SVG
  // stays crisp at any size and is trivial to generate from the same library
  // that draws the canvas.
  const handleDownload = useCallback(async () => {
    if (!value || hasInvalidSize) return;
    setIsDownloading(true);
    try {
      const svg = await QRCodeLib.toString(value, {
        type: "svg",
        width: size,
        margin: 1,
        color: {
          dark: canvasForeground ?? readCssColor("--color-qr-canvas-fg", "#0d0d0d"),
          light: canvasBackground ?? readCssColor("--color-qr-canvas-bg", "#ffffff"),
        },
      });
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const canUseObjectUrl =
        typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
      const url = canUseObjectUrl
        ? URL.createObjectURL(blob)
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${downloadFileName}.svg`;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      if (canUseObjectUrl) URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download QR code:", error);
    } finally {
      setIsDownloading(false);
    }
  }, [
    value,
    size,
    canvasBackground,
    canvasForeground,
    hasInvalidSize,
    downloadFileName,
  ]);

  const accessibleDescription =
    description ??
    `QR code encoding ${label ?? value}. Scan to receive or share this value.`;

  return (
    <figure className={cn("flex flex-col items-center gap-3", className)}>
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
              Unable to generate QR code
            </span>
            <span className="text-[10px] text-ink-3 break-all font-mono select-all max-w-full">
              {value}
            </span>
          </div>
        ) : (
          <>
            {isLoading && !hasInvalidSize && (
              <div
                className="flex items-center justify-center"
                style={{ width: size, height: size }}
              >
                <span className="w-6 h-6 border-2 border-ink-3 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={ariaLabel ?? label ?? `QR code for address ${value}`}
              aria-describedby={descriptionId}
              style={{ display: isLoading ? "none" : "block", borderRadius: "4px" }}
            />
          </>
        )}
      </div>
      <p id={descriptionId} className="sr-only">
        {accessibleDescription}
      </p>
      {label && (
        <figcaption className="text-[11px] text-ink-3 text-center max-w-[200px] break-all font-mono">
          {label}
        </figcaption>
      )}
      {!renderError && !hasInvalidSize && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          aria-label={`Download QR code for ${label ?? value} as an SVG file`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 h-8 text-[12px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HugeiconsIcon
            icon={Download01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
          {isDownloading ? "Preparing…" : "Download QR"}
        </button>
      )}
    </figure>
  );
}
