import '@logseq/libs'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatusDefinition {
  label: string
  color: string
  bg: string
}

interface SelectStatusEvent {
  dataset: {
    blockUuid: string
    status: string
    slotId: string
  }
}

// Represents the parsed state stored in the macro arguments.
//
// Macro format (all trailing empty args are omitted):
//   {{renderer :task-status, STATUS, COMPLETED_DATE, IN_PROGRESS_START_MS, ACCUMULATED_MS}}
//
// '_' is used as a positional placeholder instead of empty string — Logseq does not
// handle consecutive commas (e.g. ", ,") and fails to trigger the renderer if present.
//
// - completedDate:    set when status → Completed
// - inProgressStart:  unix ms when the current "In Progress" period started
// - accumulatedMs:    total ms from all previous completed "In Progress" periods
interface MacroArgs {
  status: string
  completedDate: string | null
  inProgressStart: number | null
  accumulatedMs: number
}

// ─── Default status definitions ───────────────────────────────────────────────

const DEFAULT_STATUSES: StatusDefinition[] = [
  { label: 'Not Started', color: '#374151', bg: '#f3f4f6' },
  { label: 'In Progress', color: '#1d4ed8', bg: '#dbeafe' },
  { label: 'In Review',   color: '#b45309', bg: '#fef3c7' },
  { label: 'Merged',      color: '#6d28d9', bg: '#ede9fe' },
  { label: 'Deployed',    color: '#047857', bg: '#d1fae5' },
  { label: 'Comms Sent',  color: '#0369a1', bg: '#e0f2fe' },
  { label: 'Completed',   color: '#065f46', bg: '#a7f3d0' },
]

// The "In Progress" label is special: it triggers time tracking.
// This constant must match the label used in DEFAULT_STATUSES and any user config.
const IN_PROGRESS_LABEL = 'In Progress'

const MACRO_KEY = ':task-status'

// ─── Settings ────────────────────────────────────────────────────────────────

// Returns the active status list — from plugin settings if valid, else defaults.
function getStatuses(): StatusDefinition[] {
  try {
    const raw = logseq.settings?.statuses as string | undefined
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (s): s is StatusDefinition =>
            typeof s === 'object' && s !== null &&
            typeof (s as StatusDefinition).label === 'string' &&
            typeof (s as StatusDefinition).color === 'string' &&
            typeof (s as StatusDefinition).bg    === 'string'
        )
      ) {
        return parsed
      }
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_STATUSES
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusStyle(label: string): StatusDefinition {
  return getStatuses().find(s => s.label === label) ?? getStatuses()[0]
}

function today(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return '<1m'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

// Total ms spent in "In Progress", including the current open session if active.
function totalElapsedMs(args: MacroArgs): number {
  let total = args.accumulatedMs
  if (args.inProgressStart !== null) {
    total += Date.now() - args.inProgressStart
  }
  return total
}

// ─── Macro serialization ─────────────────────────────────────────────────────

// args[0] must be ':task-status' (as returned by payload.arguments or block parse).
function parseMacroArgs(rawArgs: string[]): MacroArgs {
  const [, status = '', dateStr = '', startStr = '', accStr = ''] =
    rawArgs.map(a => a?.trim() ?? '')
  const defined = (v: string) => v !== '' && v !== '_'
  return {
    status:           status || 'Not Started',
    completedDate:    defined(dateStr)  ? dateStr                : null,
    inProgressStart:  defined(startStr) ? parseInt(startStr, 10) : null,
    accumulatedMs:    defined(accStr)   ? parseInt(accStr,   10) : 0,
  }
}

function buildMacro(args: MacroArgs): string {
  const hasStart = args.inProgressStart != null
  const hasAcc   = args.accumulatedMs > 0

  const parts = [MACRO_KEY, args.status]

  // Only add trailing slots when needed; use '_' to fill gaps instead of leaving
  // empty slots that produce ",,", which breaks Logseq's macro renderer.
  if (args.completedDate || hasStart || hasAcc) {
    parts.push(args.completedDate ?? '_')
  }
  if (hasStart || hasAcc) {
    parts.push(hasStart ? String(args.inProgressStart) : '_')
  }
  if (hasAcc) {
    parts.push(String(args.accumulatedMs))
  }

  return `{{renderer ${parts.join(', ')}}}`
}

// ─── Template ────────────────────────────────────────────────────────────────
// The template is injected directly into the Logseq page DOM (not an iframe),
// so CSS classes from provideStyle are available here.

function buildTemplate(slot: string, blockUuid: string, args: MacroArgs): string {
  const { color, bg } = getStatusStyle(args.status)

  const elapsedMs = totalElapsedMs(args)
  const timeStr = elapsedMs >= 60_000 ? ` · ${formatDuration(elapsedMs)}` : ''
  const dateStr = args.completedDate ? ` · ${args.completedDate}` : ''

  const items = getStatuses().map(s =>
    `<button class="ts-item" data-on-click="handleSelectStatus" data-slot-id="${slot}" data-block-uuid="${blockUuid}" data-status="${s.label}">` +
    `<span class="ts-dot" style="background:${s.color}"></span>` +
    `${s.label}` +
    `${args.status === s.label ? '<span class="ts-check">✓</span>' : ''}` +
    `</button>`
  ).join('')

  return `
    <div class="ts-wrapper">
      <button class="ts-badge" style="color:${color};background:${bg};border-color:${color}33;"
      >${args.status}${timeStr}${dateStr} ▾</button>
      <div class="ts-dropdown">${items}</div>
    </div>
  `
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderUI(slot: string, blockUuid: string, args: MacroArgs): void {
  logseq.provideUI({
    key: `task-status-${slot}`,
    slot,
    reset: true,
    // overflow:visible lets the dropdown escape the slot container's bounds.
    // verticalAlign:middle aligns the slot inline with surrounding text.
    style: { overflow: 'visible', verticalAlign: 'middle' },
    template: buildTemplate(slot, blockUuid, args),
  })
}

// ─── Block updater ────────────────────────────────────────────────────────────

async function updateBlockStatus(blockUuid: string, newStatus: string): Promise<void> {
  const block = await logseq.Editor.getBlock(blockUuid)
  if (!block) return

  // Re-parse current macro state from block content so we have accurate timing data.
  const macroMatch = block.content.match(/\{\{renderer\s+(.*?)\}\}/)
  const rawArgs = macroMatch
    ? macroMatch[1].split(',').map(a => a.trim())
    : [MACRO_KEY, 'Not Started']
  const current = parseMacroArgs(rawArgs)

  const now = Date.now()
  const updated: MacroArgs = { ...current, status: newStatus }

  // Leaving "In Progress" → close the open session and accumulate.
  if (current.status === IN_PROGRESS_LABEL && newStatus !== IN_PROGRESS_LABEL) {
    if (current.inProgressStart !== null) {
      updated.accumulatedMs = current.accumulatedMs + (now - current.inProgressStart)
    }
    updated.inProgressStart = null
  }

  // Entering "In Progress" → open a new session.
  if (newStatus === IN_PROGRESS_LABEL && current.status !== IN_PROGRESS_LABEL) {
    updated.inProgressStart = now
  }

  updated.completedDate = newStatus === 'Completed' ? today() : null

  const newMacro = buildMacro(updated)
  const newContent = block.content.replace(
    /\{\{renderer\s+:task-status(?:,[^}]*)?\}\}/,
    newMacro
  )
  await logseq.Editor.updateBlock(blockUuid, newContent)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[Task Tracker] Plugin loaded')

  logseq.useSettingsSchema([
    {
      key: 'statuses',
      type: 'string',
      default: JSON.stringify(DEFAULT_STATUSES),
      title: 'Task Statuses (JSON)',
      description:
        'JSON array of status definitions. Each entry requires: label (string), color (hex text color), bg (hex background color). ' +
        'The label "In Progress" has special behavior: it starts a timer that tracks how long the task has been in that state. ' +
        'Example entry: {"label":"Blocked","color":"#991b1b","bg":"#fee2e2"}',
    },
  ])

  // Inject structural CSS into the Logseq page.
  // Dynamic colors are handled via inline styles in the template.
  logseq.provideStyle(`
    /* The slot must be inline-flex (not block flex) so its height = badge height.
       Without this the injected div computes as display:flex (block), stretching
       to the full block height (~97px) and throwing off vertical alignment. */
    .block-content .lsp-hook-ui-slot {
      vertical-align: middle !important;
      align-items: center !important;
    }
    .block-content .lsp-hook-ui-slot [data-injected-ui] {
      display: inline-flex !important;
      align-items: center !important;
    }

    .ts-wrapper {
      position: relative;
      /* Logseq's JS forces the parent injected div to display:flex and ~97px tall.
         We accept this and center the badge within it instead of fighting the height. */
      display: flex !important;
      align-items: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .ts-badge {
      padding: 2px 8px !important;
      border-radius: 4px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      line-height: 1.4 !important;
      cursor: pointer !important;
      border: 1px solid !important;
      white-space: nowrap !important;
      margin: 0 !important;
    }
    .ts-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 3px);
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      min-width: 160px;
      z-index: 9999;
      white-space: normal;
    }
    .ts-wrapper:focus-within .ts-dropdown {
      display: flex;
      flex-direction: column;
    }
    /* Use !important to override Logseq's global button styles */
    .ts-item {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      width: 100% !important;
      padding: 6px 12px !important;
      margin: 0 !important;
      cursor: pointer !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      line-height: 1.4 !important;
      color: #111827 !important;
      text-align: left !important;
      background: transparent !important;
      box-shadow: none !important;
      min-height: 0 !important;
      height: auto !important;
      box-sizing: border-box !important;
    }
    .ts-item:hover { background: #f9fafb !important; }
    .ts-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .ts-check {
      margin-left: auto;
      color: #9ca3af;
      font-size: 10px;
    }
  `)

  logseq.Editor.registerSlashCommand('TASK', [
    ['editor/input', '{{renderer :task-status, Not Started}}'],
  ])

  logseq.provideModel({
    async handleSelectStatus(e: SelectStatusEvent) {
      const { blockUuid, status } = e.dataset
      await updateBlockStatus(blockUuid, status)
    },
  })

  logseq.App.onMacroRendererSlotted(({ slot, payload }) => {
    const rawArgs: string[] = payload.arguments.map((a: string) => a?.trim())
    if (rawArgs[0] !== MACRO_KEY) return

    renderUI(slot, payload.uuid, parseMacroArgs(rawArgs))
  })
}

logseq.ready(main).catch(console.error)
