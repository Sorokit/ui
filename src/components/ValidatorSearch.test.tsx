import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultFilter } from "@/lib/staking";

import { ValidatorSearch } from "./ValidatorSearch";

function renderSearch(
  overrides: Partial<Parameters<typeof ValidatorSearch>[0]> = {},
) {
  const onChange = vi.fn();
  const filter = createDefaultFilter();
  const result = render(
    <ValidatorSearch
      filter={filter}
      onChange={onChange}
      totalCount={6}
      filteredCount={6}
      {...overrides}
    />,
  );
  return { ...result, onChange, filter };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("ValidatorSearch — rendering", () => {
  it("renders the search input", () => {
    renderSearch();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders the status filter select", () => {
    renderSearch();
    expect(
      screen.getByRole("combobox", { name: /filter by status/i }),
    ).toBeInTheDocument();
  });

  it("renders the sort field select", () => {
    renderSearch();
    expect(
      screen.getByRole("combobox", { name: /sort validators by/i }),
    ).toBeInTheDocument();
  });

  it("renders the direction toggle button", () => {
    renderSearch();
    expect(
      screen.getByRole("button", { name: /sort ascending|sort descending/i }),
    ).toBeInTheDocument();
  });

  it("shows total count when no filter applied", () => {
    renderSearch({ totalCount: 6, filteredCount: 6 });
    expect(screen.getByText("6 validators")).toBeInTheDocument();
  });

  it("shows filtered count vs total when filter is applied", () => {
    renderSearch({ totalCount: 6, filteredCount: 3 });
    expect(screen.getByText("3 of 6 validators")).toBeInTheDocument();
  });

  it("has min APY input", () => {
    renderSearch();
    expect(
      screen.getByRole("spinbutton", { name: /minimum apy/i }),
    ).toBeInTheDocument();
  });

  it("has max commission input", () => {
    renderSearch();
    expect(
      screen.getByRole("spinbutton", { name: /maximum commission/i }),
    ).toBeInTheDocument();
  });
});

// ─── Interactions ─────────────────────────────────────────────────────────────

describe("ValidatorSearch — interactions", () => {
  it("calls onChange with updated query when user types", () => {
    const { onChange, filter } = renderSearch();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "alpha" },
    });
    expect(onChange).toHaveBeenCalledWith({ ...filter, query: "alpha" });
  });

  it("calls onChange with updated status when status select changes", () => {
    const { onChange, filter } = renderSearch();
    fireEvent.change(
      screen.getByRole("combobox", { name: /filter by status/i }),
      { target: { value: "active" } },
    );
    expect(onChange).toHaveBeenCalledWith({ ...filter, status: "active" });
  });

  it("calls onChange with updated sortField", () => {
    const { onChange, filter } = renderSearch();
    fireEvent.change(
      screen.getByRole("combobox", { name: /sort validators by/i }),
      { target: { value: "commission" } },
    );
    expect(onChange).toHaveBeenCalledWith({
      ...filter,
      sortField: "commission",
    });
  });

  it("calls onChange toggling sort direction", () => {
    const { onChange, filter } = renderSearch();
    fireEvent.click(
      screen.getByRole("button", { name: /sort ascending|sort descending/i }),
    );
    // Default is desc, so after toggle it should be asc
    expect(onChange).toHaveBeenCalledWith({
      ...filter,
      sortDirection: "asc",
    });
  });

  it("calls onChange with minApy", () => {
    const { onChange, filter } = renderSearch();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /minimum apy/i }),
      { target: { value: "7.5" } },
    );
    expect(onChange).toHaveBeenCalledWith({ ...filter, minApy: 7.5 });
  });

  it("calls onChange with undefined minApy when input is cleared", () => {
    const filter = { ...createDefaultFilter(), minApy: 5 };
    const { onChange } = renderSearch({ filter });
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /minimum apy/i }),
      { target: { value: "" } },
    );
    expect(onChange).toHaveBeenCalledWith({ ...filter, minApy: undefined });
  });

  it("calls onChange with maxCommission", () => {
    const { onChange, filter } = renderSearch();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /maximum commission/i }),
      { target: { value: "10" } },
    );
    expect(onChange).toHaveBeenCalledWith({ ...filter, maxCommission: 10 });
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe("ValidatorSearch — accessibility", () => {
  it("count label has aria-live=polite", () => {
    renderSearch({ totalCount: 4, filteredCount: 2 });
    const liveRegion = screen.getByText("2 of 4 validators");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });
});
