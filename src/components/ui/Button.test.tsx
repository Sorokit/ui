import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button, ButtonGroup } from "./Button";

describe("Button component", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  describe("variants", () => {
    it("renders primary variant with expected classes", () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole("button", { name: /primary/i });
      expect(button).toHaveClass("bg-brand", "text-white");
    });

    it("renders secondary variant with expected classes", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button", { name: /secondary/i });
      expect(button).toHaveClass("bg-transparent", "text-ink", "border");
    });

    it("renders ghost variant with expected classes", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole("button", { name: /ghost/i });
      expect(button).toHaveClass("bg-transparent", "text-ink-2");
    });

    it("renders destructive variant with expected classes", () => {
      render(<Button variant="destructive">Destructive</Button>);
      const button = screen.getByRole("button", { name: /destructive/i });
      expect(button).toHaveClass("bg-error-dim", "text-red");
    });
  });

  describe("sizes", () => {
    it("applies small size classes", () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole("button", { name: /small/i });
      expect(button).toHaveClass("h-8", "px-3.5", "text-[12px]");
    });

    it("applies medium size classes by default", () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole("button", { name: /medium/i });
      expect(button).toHaveClass("h-9", "px-4", "text-[13px]");
    });

    it("applies large size classes", () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole("button", { name: /large/i });
      expect(button).toHaveClass("h-10", "px-5", "text-[14px]");
    });
  });

  describe("loading state", () => {
    it("shows a spinner element and aria-busy when loading={true}", () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
      expect(screen.getByText("Loading")).toBeInTheDocument();
      // Spinner span has animate-spin class
      const spinner = button.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("keeps button label rendered while loading", () => {
      render(<Button loading>Processing Transaction</Button>);
      expect(screen.getByText("Processing Transaction")).toBeInTheDocument();
      expect(screen.getByText("Loading")).toBeInTheDocument();
    });

    it("prevents onClick firing when loading={true}", async () => {
      const handleClick = vi.fn();
      render(
        <Button loading onClick={handleClick}>
          Loading Button
        </Button>,
      );
      const button = screen.getByRole("button");
      await userEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("disabled state", () => {
    it("is not clickable and prevents onClick when disabled={true}", async () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled Button
        </Button>,
      );
      const button = screen.getByRole("button", { name: /disabled button/i });
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref correctly to the underlying button element", () => {
      const ref = createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Ref Button</Button>);
      expect(ref.current).not.toBeNull();
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.textContent).toContain("Ref Button");
    });
  });

  describe("asChild prop", () => {
    it("renders as an anchor tag when asChild is used with an anchor child", () => {
      render(
        <Button asChild>
          <a href="https://stellar.org">Stellar Link</a>
        </Button>,
      );
      const link = screen.getByRole("link", { name: /stellar link/i });
      expect(link).toBeInTheDocument();
      expect(link.tagName.toLowerCase()).toBe("a");
      expect(link).toHaveAttribute("href", "https://stellar.org");
      expect(link).not.toHaveAttribute("type");
    });
  });

  describe("href prop", () => {
    it("renders an anchor element opening in a new tab when href is provided", () => {
      render(<Button href="https://soroban.stellar.org">Docs</Button>);
      const link = screen.getByRole("link", { name: /docs/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("requireConfirm behavior", () => {
    it("arms on first click and calls onClick on second click", async () => {
      const handleClick = vi.fn();
      render(
        <Button requireConfirm confirmLabel="Really Delete?" onClick={handleClick}>
          Delete Account
        </Button>,
      );

      const button = screen.getByRole("button", { name: /delete account/i });
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
      expect(screen.getByText("Really Delete?")).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("ButtonGroup component", () => {
    it("renders children in a flex group", () => {
      render(
        <ButtonGroup>
          <Button>Cancel</Button>
          <Button>Save</Button>
        </ButtonGroup>,
      );
      const group = screen.getByRole("group");
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute("data-orientation", "horizontal");
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });
  });
});
