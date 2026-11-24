import { describe, expect, it, beforeEach, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Tooltip from "@radix-ui/react-tooltip";

describe("Radix UI component integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DropdownMenu inside Dialog", () => {
    it("renders DropdownMenu and Dialog together without crashing on initial render", () => {
      const { unmount } = render(
        <Dialog.Dialog>
          <Dialog.Trigger>Open Dialog</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Test Dialog</Dialog.Title>
            </Dialog.Header>
            <Dialog.Description>This dialog contains a dropdown</Dialog.Description>

            <DropdownMenu.Dropdown>
              <DropdownMenu.Trigger>Open Menu</DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item>Action 1</DropdownMenu.Item>
                <DropdownMenu.Item>Action 2</DropdownMenu.Item>
                <DropdownMenu.Item>Action 3</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Dropdown>
          </Dialog.Content>
        </Dialog.Dialog>,
      );

      // Verify components rendered without throwing during initial render
      expect(() => screen.getByRole("button", { name: "Open Dialog" })).not.toThrow();

      // Unmount
      unmount();
    });
  });

  describe("Select inside Dialog", () => {
    it("renders Select and Dialog together without crashing on initial render", () => {
      render(
        <Dialog.Dialog>
          <Dialog.Trigger>Open Dialog</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Test Dialog</Dialog.Title>
            </Dialog.Header>
            <Dialog.Description>This dialog contains a select</Dialog.Description>

            <Select.Select>
              <Select.Trigger>Select an option</Select.Trigger>
              <Select.Content>
                <Select.Item value="option1">Option 1</Select.Item>
                <Select.Item value="option2">Option 2</Select.Item>
                <Select.Item value="option3">Option 3</Select.Item>
              </Select.Content>
            </Select.Select>
          </Dialog.Content>
        </Dialog.Dialog>,
      );

      // Verify components rendered without throwing
      expect(() => screen.getByRole("button", { name: "Open Dialog" })).not.toThrow();
    });
  });

  describe("Tooltip inside Dialog", () => {
    it("renders Tooltip and Dialog together without crashing on initial render", () => {
      render(
        <Dialog.Dialog>
          <Dialog.Trigger>Open Dialog</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Test Dialog</Dialog.Title>
            </Dialog.Header>

            <Tooltip.Tooltip>
              <Tooltip.Trigger asChild>
                <span />
              </Tooltip.Trigger>
              <Tooltip.Content>
                <Tooltip.ContentWrapper>
                  This is a tooltip
                </Tooltip.ContentWrapper>
              </Tooltip.Content>
            </Tooltip.Tooltip>
          </Dialog.Content>
        </Dialog.Dialog>,
      );

      // Verify components rendered without throwing
      expect(() => screen.getByRole("button", { name: "Open Dialog" })).not.toThrow();
    });
  });
});