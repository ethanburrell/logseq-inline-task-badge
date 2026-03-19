# Logseq Task Tracker

A Logseq plugin that adds inline, clickable status badges to any block. Track tasks through a 7-stage workflow without leaving your notes.

![Badge example](docs/badge-example.png)

## Features

- Inline colored badge that renders inside block content
- Click to open a dropdown and change status
- Auto-records completion date when set to **Completed**
- Works with any block — just type a slash command

## Statuses

| Status | Color |
|---|---|
| Not Started | Gray |
| In Progress | Blue |
| In Review | Amber |
| Merged | Purple |
| Deployed | Green |
| Comms Sent | Cyan |
| Completed | Dark green |

## Installation

1. Clone or download this repo
2. Run `npm install && npm run build`
3. In Logseq, go to **Settings → Plugins → Load unpacked plugin**
4. Select the **root folder** of this repo (not the `dist/` folder)

## Usage

In any block, type `/TASK`. This inserts:

```
{{renderer :task-status, Not Started}}
```

The macro renders as a colored badge. Click it to open the status dropdown. When you select **Completed**, the date is appended automatically:

```
{{renderer :task-status, Completed, 2026-03-18}}
```

## Development

```bash
npm install       # install dependencies
npm run dev       # start Vite dev server
npm run build     # type-check + build to dist/
npm run type-check  # TypeScript check only
```

The plugin is written in TypeScript and bundled with Vite. The entry point is `src/main.ts`.

## How it works

The plugin registers a macro renderer for `:task-status`. When Logseq encounters `{{renderer :task-status, ...}}` in a block, it calls `provideUI` to inject the badge HTML directly into the page DOM. The dropdown is pure CSS using `:focus-within` — no JS state needed.

See [PLAN.md](PLAN.md) for a detailed breakdown of technical decisions and Logseq-specific gotchas.
