import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect,it } from "vitest";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./Card";

describe("Card", () => {
  it("forwards a ref to the underlying element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>content</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveTextContent("content");
  });

  it("renders its children", () => {
    render(
      <Card>
        <CardTitle>Title</CardTitle>
        <CardContent>Body</CardContent>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});

describe("CardHeader", () => {
  it("uses standardised py-4 vertical padding", () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container.firstElementChild).toHaveClass("py-4");
  });

  it("forwards a ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardHeader ref={ref}>Header</CardHeader>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("CardFooter", () => {
  it("does not vertically center its content", () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstElementChild).not.toHaveClass("items-center");
  });

  it("remains a flex row", () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstElementChild).toHaveClass("flex");
  });
});
