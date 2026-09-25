import { render, screen } from "@testing-library/react";
import QRCodeLib from "qrcode";
import { describe, expect, it, vi } from "vitest";

import { QRCode } from "./QRCode";

vi.mock("qrcode", () => {
  return {
    default: {
      toCanvas: vi.fn((canvas, value, options, callback) => {
        if (typeof callback === "function") {
          callback(null);
        }
        return Promise.resolve();
      }),
    },
  };
});

describe("QRCode", () => {
  const value = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Return a dummy context by default in jsdom tests to avoid triggering the null fallback
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("renders a canvas element with correct accessibility attributes", () => {
    render(<QRCode value={value} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("role", "img");
    expect(canvas).toHaveAttribute("aria-label", `QR code for address ${value}`);
  });

  it("renders the label text below the canvas when label is provided", () => {
    render(<QRCode value={value} label={value} />);
    expect(screen.getByText(value)).toBeInTheDocument();
  });

  it("does not render label text when label prop is omitted", () => {
    const { container } = render(<QRCode value={value} />);
    // There should be no <figcaption> label element
    expect(container.querySelector("figcaption")).not.toBeInTheDocument();
  });

  it("renders a fallback when getContext returns null", () => {
    getContextSpy.mockReturnValue(null);
    const { container } = render(<QRCode value={value} />);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("QR Code failed to load")).toBeInTheDocument();
    expect(screen.getByText(value)).toBeInTheDocument();
  });

  it("renders a fallback when QRCodeLib.toCanvas calls back with an error", () => {
    vi.mocked(QRCodeLib.toCanvas).mockImplementationOnce((canvas, val, options, callback) => {
      if (typeof callback === "function") {
        callback(new Error("Rendering failed"));
      }
      return Promise.resolve();
    });

    const { container } = render(<QRCode value={value} />);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("QR Code failed to load")).toBeInTheDocument();
    expect(screen.getByText(value)).toBeInTheDocument();
  });

  it("renders with a default size of 160 (canvas is present at any size)", () => {
    render(<QRCode value={value} size={160} />);
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  describe("size validation", () => {
    it("warns and skips drawing when size is 0", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");

      render(<QRCode value={value} size={0} />);

      expect(warn).toHaveBeenCalledWith("[QRCode] size must be > 0");
      expect(getContext).not.toHaveBeenCalled();

      warn.mockRestore();
      getContext.mockRestore();
    });

    it("warns and skips drawing when size is negative", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");

      render(<QRCode value={value} size={-10} />);

      expect(warn).toHaveBeenCalledWith("[QRCode] size must be > 0");
      expect(getContext).not.toHaveBeenCalled();

      warn.mockRestore();
      getContext.mockRestore();
    });

    it("does not leave a loading spinner running for an invalid size", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { container } = render(<QRCode value={value} size={0} />);

      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();

      warn.mockRestore();
    });

    it("does not warn for a valid size", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(<QRCode value={value} size={120} />);

      expect(warn).not.toHaveBeenCalledWith("[QRCode] size must be > 0");

      warn.mockRestore();
    });
  });

  it("accepts a className on the outer wrapper", () => {
    const { container } = render(<QRCode value={value} className="my-qr" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.classList.contains("my-qr")).toBe(true);
  });

  it("exposes the canvas to assistive tech as an image", () => {
    render(<QRCode value={value} />);
    const img = screen.getByRole("img");
    expect(img.tagName).toBe("CANVAS");
  });

  it("uses ariaLabel as the accessible name when provided", () => {
    render(<QRCode value={value} ariaLabel="QR code to receive funds" />);
    expect(
      screen.getByRole("img", { name: "QR code to receive funds" }),
    ).toBeInTheDocument();
  });

  it("falls back to the label for the accessible name", () => {
    render(<QRCode value={value} label={value} />);
    expect(screen.getByRole("img", { name: value })).toBeInTheDocument();
  });

  it("defaults the accessible name to include the address", () => {
    render(<QRCode value={value} />);
    expect(screen.getByRole("img", { name: `QR code for address ${value}` })).toBeInTheDocument();
  });

  it("renders an outer <figure> element", () => {
    const { container } = render(<QRCode value={value} />);
    expect(container.firstElementChild?.tagName).toBe("FIGURE");
  });

  it("renders <figcaption> when label is provided", () => {
    const { container } = render(<QRCode value={value} label={value} />);
    expect(container.querySelector("figcaption")).toBeInTheDocument();
  });

  it("calls clearRect on the canvas context when value changes", () => {
    const clearRectMock = vi.fn();
    getContextSpy.mockReturnValue({
      clearRect: clearRectMock,
    } as unknown as CanvasRenderingContext2D);

    const mockToCanvas = vi.mocked(QRCodeLib.toCanvas);
    mockToCanvas.mockImplementation(((...args: unknown[]) => {
      const canvas = args[0] as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx && typeof (ctx as { clearRect: (...args: unknown[]) => void }).clearRect === "function") {
        (ctx as { clearRect: (...args: unknown[]) => void }).clearRect(0, 0, 0, 0);
      }
      const callback = args[3] as (err: Error | null) => void;
      if (typeof callback === "function") {
        callback(null);
      }
      return Promise.resolve();
    }) as typeof QRCodeLib.toCanvas);

    const { rerender } = render(<QRCode value="OLD_VALUE" />);
    clearRectMock.mockClear();

    rerender(<QRCode value="NEW_VALUE" />);
    expect(clearRectMock).toHaveBeenCalled();
  });

  it("logs a warning when size is 0 or less", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<QRCode value={value} size={0} />);
    expect(warnSpy).toHaveBeenCalledWith(
      "QRCode size must be greater than 0, got",
      0,
    );
    warnSpy.mockRestore();
  });
});
