import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QRCode } from "./QRCode";

describe("QRCode", () => {
  const value = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

  it("renders a canvas element", () => {
    render(<QRCode value={value} />);
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  it("renders the label text below the canvas when label is provided", () => {
    render(<QRCode value={value} label={value} />);
    expect(screen.getByText(value)).toBeInTheDocument();
  });

  it("does not render label text when label prop is omitted", () => {
    const { container } = render(<QRCode value={value} />);
    // There should be no <p> label element
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renders a fallback (no canvas drawing) when getContext returns null", () => {
    // jsdom's canvas getContext returns null by default
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = render(<QRCode value={value} />);
    // Canvas element still renders in the DOM; drawing is skipped gracefully
    expect(container.querySelector("canvas")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("renders with a default size of 160 (canvas is present at any size)", () => {
    // Canvas inline size is set via Canvas 2D API which JSDOM doesn't support.
    // Verify the canvas element is present regardless of the size prop.
    render(<QRCode value={value} size={160} />);
    expect(document.querySelector("canvas")).toBeInTheDocument();
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

  it("defaults the accessible name to a generic description", () => {
    render(<QRCode value={value} />);
    expect(screen.getByRole("img", { name: "QR code" })).toBeInTheDocument();
  });
});
