import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { describe, expect,it } from "vitest";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not set live-region attributes by default", () => {
    render(<Badge>Static</Badge>);
    const badge = screen.getByText("Static");
    expect(badge).not.toHaveAttribute("role", "status");
    expect(badge).not.toHaveAttribute("aria-live");
  });

  it("exposes a polite live region when live is set", () => {
    render(<Badge live>Updating</Badge>);
    const badge = screen.getByText("Updating");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAttribute("aria-live", "polite");
  });

  it("hides the status dot from assistive tech", () => {
    const { container } = render(
      <Badge dot live>
        Live
      </Badge>,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it("applies smaller font and padding for size sm", () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-[10px]");
    expect(badge.className).toContain("px-1.5");
    expect(badge.className).toContain("py-0.5");
  });

  it("applies default font and padding for size md", () => {
    const { container } = render(<Badge size="md">Medium</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-[11px]");
    expect(badge.className).toContain("px-2");
    expect(badge.className).toContain("py-1");
  });

  it("defaults to md size when size is not specified", () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-[11px]");
    expect(badge.className).toContain("px-2");
  });

  it("applies purple styling for primary variant", () => {
    const { container } = render(<Badge variant="primary">Primary</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-brand-dim");
    expect(badge.className).toContain("text-brand");
    expect(badge.className).not.toContain("teal");
  });

  it("renders a standalone indicator dot when no children provided", () => {
    const { container } = render(<Badge dot />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
    expect(dot?.className).toContain("w-1");
    expect(dot?.className).toContain("h-1");
    expect(dot?.className).toContain("rounded-full");
    expect(container.firstChild?.textContent).toBe("");
  });

  describe("dot without children", () => {
    it("drops the pill chrome so the dot does not sit in a collapsed pill", () => {
      const { container } = render(<Badge dot />);
      const badge = container.firstChild as HTMLElement;

      expect(badge.className).not.toContain("px-2");
      expect(badge.className).not.toContain("py-1");
      expect(badge.className).not.toContain("rounded-full px-");
      expect(badge.className).not.toContain("border");
      expect(badge.className).not.toContain("bg-surface-2");
    });

    it("keeps the pill chrome when children are present", () => {
      const { container } = render(<Badge dot>Live</Badge>);
      const badge = container.firstChild as HTMLElement;

      expect(badge.className).toContain("px-2");
      expect(badge.className).toContain("py-1");
      expect(badge.className).toContain("border");
    });

    it("treats an empty string child as no children", () => {
      const { container } = render(<Badge dot>{""}</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).not.toContain("px-2");
    });

    it("uses the variant's dot colour when standalone", () => {
      const { container } = render(<Badge dot variant="success" />);
      const dot = container.querySelector('[aria-hidden="true"]');
      expect(dot?.className).toContain("bg-green");
    });

    it("still exposes a live region when live is set", () => {
      const { container } = render(<Badge dot live />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute("role", "status");
      expect(badge).toHaveAttribute("aria-live", "polite");
    });

    it("forwards className and other props when standalone", () => {
      const { container } = render(
        <Badge dot className="my-dot" data-testid="standalone" />,
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("my-dot");
      expect(badge).toHaveAttribute("data-testid", "standalone");
    });
  });

  describe("warning contrast (#694)", () => {
    // WCAG 2.x relative luminance / contrast ratio.
    type RGB = [number, number, number];

    function parseColor(value: string): { rgb: RGB; alpha: number } {
      const hex = value.match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        const n = parseInt(hex[1], 16);
        return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
      }
      const rgba = value.match(/^rgba?\(([^)]+)\)$/);
      if (!rgba) throw new Error(`Unsupported colour: ${value}`);
      const [r, g, b, a = "1"] = rgba[1].split(",").map((p) => p.trim());
      return { rgb: [+r, +g, +b], alpha: +a };
    }

    function over(fg: string, bg: RGB): RGB {
      const { rgb, alpha } = parseColor(fg);
      return rgb.map((c, i) => alpha * c + (1 - alpha) * bg[i]) as RGB;
    }

    function luminance([r, g, b]: RGB): number {
      const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    function contrast(a: RGB, b: RGB): number {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    const css = fs.readFileSync(
      path.resolve(__dirname, "../../styles.css"),
      "utf8",
    );

    function tokens(selector: string): Record<string, string> {
      const start = css.indexOf(`${selector} {`);
      const block = css.slice(start, css.indexOf("}", start));
      return Object.fromEntries(
        [...block.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map((m) => [
          m[1],
          m[2].trim(),
        ]),
      );
    }

    const dark = tokens(":root");
    const light = { ...dark, ...tokens('html[data-theme="light"]') };

    it("uses the theme-aware warning tokens rather than raw orange", () => {
      render(<Badge variant="warning">Pending</Badge>);
      const badge = screen.getByText("Pending");
      expect(badge).toHaveClass(
        "text-warning",
        "bg-warning-dim",
        "border-warning-dim",
      );
      expect(badge).not.toHaveClass("text-orange");
    });

    it("keeps the warning dot on the orange accent", () => {
      const { container } = render(
        <Badge variant="warning" dot>
          Pending
        </Badge>,
      );
      expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
        "bg-orange",
      );
    });

    it.each([
      ["dark", dark],
      ["light", light],
    ])(
      "warning text meets WCAG AA (4.5:1) on every %s surface",
      (_theme, t) => {
        for (const surface of [
          "--color-base",
          "--color-surface",
          "--color-surface-2",
        ]) {
          const page = parseColor(t[surface]).rgb;
          const pill = over(t["--color-warning-bg"], page);
          const text = over(t["--color-warning-fg"], pill);
          expect(contrast(text, pill)).toBeGreaterThanOrEqual(4.5);
        }
      },
    );

    it("differs per theme so the light theme does not reuse the dark foreground", () => {
      expect(light["--color-warning-fg"]).not.toBe(dark["--color-warning-fg"]);
    });

    it("keeps the dev stylesheet (index.css) in sync with styles.css", () => {
      const indexCss = fs.readFileSync(
        path.resolve(__dirname, "../../index.css"),
        "utf8",
      );
      for (const value of [dark["--color-warning-fg"], light["--color-warning-fg"]]) {
        expect(indexCss).toContain(`--color-warning-fg: ${value};`);
      }
    });
  });
});
