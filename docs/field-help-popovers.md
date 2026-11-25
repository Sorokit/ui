# Field help popovers

Use `FieldHelpPopover` next to a form label when a control needs a brief explanation and a practical example. The trigger is a keyboard- and touch-accessible `?` button; the popover closes on Escape, a second trigger click, or an outside click.

```tsx
import { FieldHelpPopover } from "@/components/ui/FieldHelpPopover";

<div className="flex items-center gap-1.5">
  <label htmlFor="slippage">Slippage tolerance (%)</label>
  <FieldHelpPopover label="Slippage tolerance">
    This is the largest drop from the quoted output you will accept before the swap fails.
    Example: 0.5% is a relatively tight tolerance; increase it only if you accept more price movement.
  </FieldHelpPopover>
</div>
<input id="slippage" />
```

Keep the text concise, explain what changing the setting does, and provide an example consistent with the component's validation and defaults. Avoid presenting a sample as a guarantee or investment recommendation.
