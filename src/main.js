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

// ─── Runtime state ───────────────────────────────────────────────────────────

/** Tracks which slots currently have their dropdown open */
const openDropdowns = new Set()

/** Cache of slot metadata so model handlers can re-render without re-parsing */
const slotMeta = new Map() // slot → { blockUuid, status, completedDate }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusStyle(label) {
  return STATUSES.find(s => s.label === label) || STATUSES[0]
}

function today() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
}

// ─── Template builder ─────────────────────────────────────────────────────────

function buildTemplate(slot, blockUuid, statusLabel, completedDate, isOpen) {
  const { color, bg } = getStatusStyle(statusLabel)
  const dateStr = completedDate ? ` · ${completedDate}` : ''

  const dropdownItems = STATUSES.map(s => `
    <div
      data-on-click="handleSelectStatus"
      data-slot-id="${slot}"
      data-block-uuid="${blockUuid}"
      data-status="${s.label}"
      style="
        display:flex;align-items:center;gap:8px;
        padding:7px 12px;cursor:pointer;
        font-size:12px;color:#111827;
        background:${statusLabel === s.label ? '#f9fafb' : 'transparent'};
      "
    >
      <span style="
        width:8px;height:8px;border-radius:50%;
        background:${s.color};display:inline-block;flex-shrink:0;
      "></span>
      <span>${s.label}</span>
      ${statusLabel === s.label
        ? '<span style="margin-left:auto;color:#9ca3af;font-size:10px;">✓</span>'
        : ''}
    </div>
  `).join('')

  const dropdownHTML = isOpen ? `
    <div style="
      position:absolute;top:calc(100% + 3px);left:0;
      background:#fff;border:1px solid #e5e7eb;
      border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.12);
      min-width:160px;overflow:hidden;z-index:100;
    ">
      ${dropdownItems}
    </div>
  ` : ''

  return `
    <div style="
      position:relative;display:inline-block;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <span
        data-on-click="handleToggleDropdown"
        data-slot-id="${slot}"
        data-block-uuid="${blockUuid}"
        style="
          display:inline-flex;align-items:center;gap:4px;
          padding:2px 8px;border-radius:4px;
          font-size:12px;font-weight:600;
          color:${color};background:${bg};
          cursor:pointer;user-select:none;
          border:1px solid ${color}33;
          white-space:nowrap;
        "
      >
        ${statusLabel}${dateStr}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="margin-left:2px;flex-shrink:0;">
          <path d="M1 1L5 5L9 1" stroke="${color}" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      ${dropdownHTML}
    </div>
  `
}

// ─── Render helper ────────────────────────────────────────────────────────────

function renderUI(slot, blockUuid, statusLabel, completedDate, isOpen) {
  // Make the iframe tall enough to contain the open dropdown
  const dropdownHeight = STATUSES.length * 34 + 8
  const height = isOpen ? 28 + dropdownHeight : 28

  slotMeta.set(slot, { blockUuid, status: statusLabel, completedDate })

  logseq.provideUI({
    key: `task-status-${slot}`,
    slot,
    reset: true,
    style: { height: `${height}px` },
    template: buildTemplate(slot, blockUuid, statusLabel, completedDate, isOpen),
  })
}

// ─── Block content updater ────────────────────────────────────────────────────

async function updateBlockStatus(blockUuid, newStatus) {
  const block = await logseq.Editor.getBlock(blockUuid)
  if (!block) return

  const completedDate = newStatus === 'Completed' ? today() : null

  // Replace the renderer macro in place, preserving the rest of the block
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

  // Slash command: type /Task Status in any block to insert the badge
  logseq.Editor.registerSlashCommand('Task Status', async () => {
    await logseq.Editor.insertAtEditingCursor(
      '{{renderer :task-status, Not Started}}'
    )
  })

  // Model: functions callable from provideUI templates via data-on-click
  logseq.provideModel({
    handleToggleDropdown(e) {
      const { slotId, blockUuid } = e.dataset
      const meta = slotMeta.get(slotId)
      if (!meta) return

      const isNowOpen = !openDropdowns.has(slotId)
      isNowOpen ? openDropdowns.add(slotId) : openDropdowns.delete(slotId)

      renderUI(slotId, blockUuid, meta.status, meta.completedDate, isNowOpen)
    },

    async handleSelectStatus(e) {
      const { slotId, blockUuid, status } = e.dataset
      const meta = slotMeta.get(slotId)
      if (!meta) return

      openDropdowns.delete(slotId)

      // Optimistically update local cache so the re-render after updateBlock
      // doesn't briefly flash the old status
      const completedDate = status === 'Completed' ? today() : null
      slotMeta.set(slotId, { blockUuid, status, completedDate })

      await updateBlockStatus(blockUuid, status)
      // onMacroRendererSlotted fires automatically after the block update
    },
  })

  // Macro renderer: runs whenever a {{renderer :task-status, ...}} block is drawn
  logseq.App.onMacroRendererSlotted(({ slot, payload }) => {
    const [type, statusArg, dateArg] = payload.arguments.map(a => a?.trim())

    if (type !== MACRO_KEY) return

    const statusLabel  = statusArg || 'Not Started'
    const completedDate = dateArg   || null
    const blockUuid    = payload.uuid
    const isOpen       = openDropdowns.has(slot)

    renderUI(slot, blockUuid, statusLabel, completedDate, isOpen)
  })
}

logseq.ready(main).catch(console.error)
