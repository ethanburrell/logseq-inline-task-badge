# logseq-inline-task-badge

## What it does

A Logseq plugin that adds a custom inline task status badge to any block. The badge is a clickable dropdown with 7 workflow stages. When **Completed** is selected, today's date is automatically recorded.

## Statuses

| Label | Color |
|---|---|
| Not Started | Gray |
| In Progress | Blue |
| In Review | Amber |
| Merged | Purple |
| Deployed | Green |
| Comms Sent | Cyan |
| Completed | Dark green |

## How to use

Type `/TASK` in any Logseq block. It inserts a macro which renders as an inline colored badge:

```
{{renderer :task-status, In Progress}}           → blue badge
{{renderer :task-status, Completed, 2026-03-18}} → dark green badge with date
```

Clicking the badge opens a dropdown to change the status. Selecting **Completed** appends today's date as a third argument automatically.

## Project structure

```
logseq-badges/
├── package.json        # Plugin manifest (logseq.id, logseq.main, etc.)
├── index.html          # Entry point Logseq loads
├── vite.config.js      # base: './' is critical for file:// URL loading
├── tsconfig.json       # TypeScript configuration
├── icon.svg
└── src/
    └── main.ts         # All plugin logic
```

Build: `yarn build` → output in `dist/`. Load the **root folder** (not `dist/`) in Logseq.

## Key technical decisions & gotchas

### Plugin loading

- `vite.config.js` must have `base: './'` — without it, asset paths are absolute (`/assets/...`) which breaks under `file://` protocol
- `package.json` must have `"main"` inside the `"logseq"` object, not at the top level
- `import '@logseq/libs'` must be present — it sets up the `logseq` global in the plugin iframe

### Rendering

- Uses `logseq.App.onMacroRendererSlotted` to intercept `{{renderer :task-status, ...}}` macros
- `logseq.provideUI` injects the template directly into the Logseq page DOM (not an iframe) — CSS injected via `logseq.provideStyle` is available to the template
- `data-on-click` attribute wires HTML elements to `logseq.provideModel` functions — must be on `<button>` elements (not `<span>`), and the target element must have no child elements that could intercept the click event

### Dropdown

- Uses CSS `:focus-within` on `.ts-wrapper` to show/hide the dropdown — no JavaScript toggle state needed
- Clicking the badge focuses it → dropdown appears; clicking outside → focus lost → dropdown hides

### Vertical centering (the hard part)

- Logseq's `lsplugin.core.js` actively resets `display: flex` and `height: ~97px` on the `[data-injected-ui]` container via MutationObserver — this **cannot** be overridden by CSS `!important` or JavaScript `setProperty`
- **Solution:** accept the 97px container. Make `.ts-wrapper` a flex container with `align-items: center` so the badge is centered within the 97px. Combined with `vertical-align: middle !important` on `.lsp-hook-ui-slot`, the badge visually aligns with surrounding text.
- Nearly all `.ts-item` and `.ts-badge` CSS properties need `!important` to override Logseq's aggressive global button styles

## References

- https://docs.logseq.com/#/page/Plugins%2001
- https://github.com/logseq/logseq-plugin-samples/tree/master/logseq-pomodoro-timer
