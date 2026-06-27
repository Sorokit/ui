import { render, screen } from "@testing-library/react";
import { describe, expect,it } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("renders the input element", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("renders a label and associates it with the input using htmlFor and id", () => {
    render(<Input label="Username" />);
    const label = screen.getByText("Username");
    const input = screen.getByRole("textbox");
    
    expect(label).toBeInTheDocument();
    expect(label.tagName).toBe("LABEL");
    expect(input).toBeInTheDocument();
    
    const id = input.getAttribute("id");
    expect(id).toBe("username");
    expect(label.getAttribute("for")).toBe("username");
  });

  it("uses an auto-generated id if label is present but id is not specified", () => {
    // If we have a label with spaces, it formats it
    render(<Input label="My Custom Field" />);
    const label = screen.getByText("My Custom Field");
    const input = screen.getByRole("textbox");
    
    expect(input.getAttribute("id")).toBe("my-custom-field");
    expect(label.getAttribute("for")).toBe("my-custom-field");
  });

  it("uses the provided id if id prop is supplied", () => {
    render(<Input label="Email Address" id="custom-email-id" />);
    const label = screen.getByText("Email Address");
    const input = screen.getByRole("textbox");
    
    expect(input.getAttribute("id")).toBe("custom-email-id");
    expect(label.getAttribute("for")).toBe("custom-email-id");
  });

  it("renders error message and applies opacity-100 to the error block", () => {
    render(<Input placeholder="Test Input" error="This field is required" />);
    const errorText = screen.getByText("This field is required");
    
    expect(errorText).toBeInTheDocument();
    expect(errorText.className).toContain("text-red");
    expect(errorText.className).toContain("opacity-100");
  });

  it("renders hint message when error is not present", () => {
    render(<Input placeholder="Test Input" hint="Must be 8 characters long" />);
    const hintText = screen.getByText("Must be 8 characters long");
    
    expect(hintText).toBeInTheDocument();
    expect(hintText.className).toContain("text-ink-3");
    expect(hintText.className).toContain("opacity-100");
  });

  it("hides the hint message and shows the error message when error is present", () => {
    render(<Input placeholder="Test Input" hint="Must be 8 characters long" error="Invalid format" />);
    const errorText = screen.getByText("Invalid format");
    const hintText = screen.getByText("Must be 8 characters long");
    
    expect(errorText).toBeInTheDocument();
    expect(errorText.className).toContain("opacity-100");
    expect(hintText.className).toContain("opacity-0");
  });

  it("applies disabled attributes and classes when disabled is true", () => {
    render(<Input placeholder="Test Input" disabled />);
    const input = screen.getByPlaceholderText("Test Input");
    
    expect(input).toBeDisabled();
    expect(input.className).toContain("disabled:opacity-40");
    expect(input.className).toContain("disabled:cursor-not-allowed");
  });
});
