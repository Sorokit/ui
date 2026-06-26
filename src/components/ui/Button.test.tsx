import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders a loading spinner when loading is true", () => {
    const { container } = render(<Button loading>Submit</Button>);
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    // The spinner is a span with animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-40");
  });

  it("is disabled when loading is true", () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toBeDisabled();
  });

  it("applies primary variant by default", () => {
    render(<Button>Button</Button>);
    const button = screen.getByRole("button", { name: "Button" });
    expect(button.className).toContain("bg-brand");
    expect(button.className).toContain("text-white");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Button</Button>);
    const button = screen.getByRole("button", { name: "Button" });
    expect(button.className).toContain("border");
    expect(button.className).toContain("border-line-2");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Button</Button>);
    const button = screen.getByRole("button", { name: "Button" });
    expect(button.className).toContain("text-ink-2");
  });

  it("applies destructive variant classes", () => {
    render(<Button variant="destructive">Button</Button>);
    const button = screen.getByRole("button", { name: "Button" });
    expect(button.className).toContain("bg-error-dim");
    expect(button.className).toContain("text-red");
  });

  it("applies sm size classes", () => {
    render(<Button size="sm">Button</Button>);
    const button = screen.getByRole("button", { name: "Button" });
    expect(button.className).toContain("h-8");
  });

  it("applies md size classes by default", () => {
    render(<Button>Button</Button>);
    const button = screen.getByRole("button", { name: "Button" });
    expect(button.className).toContain("h-9");
  });

  it("applies lg size classes", () => {
    render(<Button size="lg">Button</Button>);
    const button = screen.getByRole("button", { name: "Button" });
    expect(button.className).toContain("h-10");
  });

  it("supports rendering as a child (asChild prop)", () => {
    const { container } = render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = container.querySelector("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
    expect(link?.className).toContain("bg-brand"); // variant styles are transferred
  });
});
