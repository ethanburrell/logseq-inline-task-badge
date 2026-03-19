import '@logseq/libs'

// ─── Status definitions ──────────────────────────────────────────────────────

const STATUSES = [
  { label: 'Not Started', color: '#374151', bg: '#f3f4f6' },
  { label: 'In Progress', color: '#1d4ed8', bg: '#dbeafe' },
  { label: 'In Review',   color: '#b45309', bg: '#fef3c7' },
  { label: 'Merged',      color: '#6d28d9', bg: '#ede9fe' },
  { label: 'Deployed',    color: '#047857', bg: '#d1fae5' },
  { label: 'Comms Sent',  color: '#0369a1', bg: '#e0f2fe' },
  { label: 'Completed',   color: '#065f46', bg: '#a7f3d0' },
]

const MACRO_KEY = ':task-status'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusStyle(label) {
  return STATUSES.find(s => s.label === label) || STATUSES[0]
}

function today() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
}

// ─── Template ─────────────────────────────────────────────────────────────────
// The template is injected directly into the Logseq page DOM (not an iframe),
// so CSS classes from provideStyle are available here.

function buildTemplate(slot, blockUuid, statusLabel, completedDate) {
  const { color, bg } = getStatusStyle(statusLabel)
  const dateStr = completedDate ? ` · ${completedDate}` : ''

  const items = STATUSES.map(s =>
    `<button class="ts-item" data-on-click="handleSelectStatus" data-slot-id="${slot}" data-block-uuid="${blockUuid}" data-status="${s.label}"><span class="ts-dot" style="background:${s.color}"></span>${s.label}${statusLabel === s.label ? '<span class="ts-check">✓</span>' : ''}</button>`
  ).join('')

  return `
    <div class="ts-wrapper">
      <button class="ts-badge" style="color:${color};background:${bg};border-color:${color}33;"
      >${statusLabel}${dateStr} ▾</button>
      <div class="ts-dropdown">${items}</div>
    </div>
  `
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderUI(slot, blockUuid, statusLabel, completedDate) {
  logseq.provideUI({
    key: `task-status-${slot}`,
    slot,
    reset: true,
    // overflow:visible lets the dropdown escape the slot container's bounds.
    // verticalAlign:middle aligns the slot inline with surrounding text.
    style: { overflow: 'visible', verticalAlign: 'middle' },
    template: buildTemplate(slot, blockUuid, statusLabel, completedDate),
  })
}

// ─── Block updater ────────────────────────────────────────────────────────────

async function updateBlockStatus(blockUuid, newStatus) {
  const block = await logseq.Editor.getBlock(blockUuid)
  if (!block) return

  const completedDate = newStatus === 'Completed' ? today() : null
  const newMacro = completedDate
    ? `{{renderer :task-status, ${newStatus}, ${completedDate}}}`
    : `{{renderer :task-status, ${newStatus}}}`

  const updated = block.content.replace(
    /\{\{renderer\s+:task-status(?:,[^}]*)?\}\}/,
    newMacro
  )
  await logseq.Editor.updateBlock(blockUuid, updated)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[Task Tracker] Plugin loaded')

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

  logseq.Editor.registerSlashCommand('Task Status', [
    ['editor/input', '{{renderer :task-status, Not Started}}'],
  ])

  logseq.provideModel({
    async handleSelectStatus(e) {
      const { blockUuid, status } = e.dataset
      await updateBlockStatus(blockUuid, status)
    },
  })

  logseq.App.onMacroRendererSlotted(({ slot, payload }) => {
    const [type, statusArg, dateArg] = payload.arguments.map(a => a?.trim())
    if (type !== MACRO_KEY) return

    renderUI(slot, payload.uuid, statusArg || 'Not Started', dateArg || null)
  })
}

logseq.ready(main).catch(console.error)
