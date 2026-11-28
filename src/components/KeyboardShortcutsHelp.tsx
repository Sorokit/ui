import * as Dialog from "@radix-ui/react-dialog";
import { CircleHelp, X } from "lucide-react";
import { useEffect, useState } from "react";

import { NETWORK_SWITCHER_SHORTCUT } from "@/components/NetworkSwitcher";

const SHORTCUTS = [
  { keys: "?", action: "Open this keyboard shortcuts guide" },
  { keys: NETWORK_SWITCHER_SHORTCUT, action: "Open the network selector" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches("input, textarea, select, [role='textbox']"))
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      setOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label="Keyboard shortcuts"
            aria-keyshortcuts="?"
            title="Keyboard shortcuts (?)"
            className="fixed bottom-5 right-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-lg transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <CircleHelp size={18} aria-hidden="true" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold">
                  Keyboard shortcuts
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-ink-3">
                  Use these shortcuts to navigate the app more quickly.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close keyboard shortcuts"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            <dl className="mt-5 divide-y divide-line">
              {SHORTCUTS.map(({ keys, action }) => (
                <div
                  key={keys}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <dt className="text-sm text-ink-2">{action}</dt>
                  <dd>
                    <kbd className="rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-ink">
                      {keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
