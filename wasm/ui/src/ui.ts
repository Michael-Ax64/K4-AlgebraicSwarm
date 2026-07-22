// src/ui.ts
import { createEffect } from './reactive';
import {
  uiState, chatLog,
  engineHeader, workingSurface, braidHistory, activeThreadId,
  currentRole, currentMode,
  UIState, CurrentRole,
} from './state';
import { processInput } from './bridge';
import { clearVfs } from './persistence';

// ─── DOM references ──────────────────────────────────────────

const chatContainer = requireEl('chat-log');
const inputForm = requireEl<HTMLFormElement>('input-form');
const inputField = requireEl<HTMLTextAreaElement>('user-input');
const submitBtn = requireEl<HTMLButtonElement>('submit-btn');
const resetBtn = requireEl<HTMLButtonElement>('reset-btn');
const statusStrip = requireEl('status-strip');
const roleBadge = requireEl('role-badge');
const surfacePanel = requireEl('working-surface');
const braidPanel = requireEl('braid-history');
const threadIndicator = requireEl('thread-indicator');

function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in DOM`);
  return el as T;
}

// ─── 1. Chat log ─────────────────────────────────────────────

createEffect(() => {
  const messages = chatLog.value;
  chatContainer.replaceChildren(...messages.map(msg => {
    const div = document.createElement('div');
    div.className = `msg msg-${msg.role}`;
    div.textContent = msg.text;
    return div;
  }));
  chatContainer.scrollTop = chatContainer.scrollHeight;
});

// ─── 2. Input controls ───────────────────────────────────────

const awaitPlaceholders: Record<CurrentRole, string> = {
  Validator:  "Reply to the Validator…",
  Bridge:     "Reply to the Bridge's articulation…",
  Controller: "Reply to the Controller…",
  Paradox:    "Which of these is bearing weight?",
};

const placeholders = (role: CurrentRole): Record<UIState, string> => ({
  idle:          'Enter your intent or document…',
  processing:    'Computing topology…',
  awaiting_user: awaitPlaceholders[role],
  halted:        'Run halted. Reset to continue.',
});

createEffect(() => {
  const state = uiState.value;
  const role = currentRole.value;
  inputField.disabled = state === 'processing';
  submitBtn.disabled = state === 'processing' || state === 'halted';
  inputField.placeholder = placeholders(role)[state];
  if (state === 'awaiting_user') inputField.focus();
});

// ─── 2b. Role badge — which of the four instruments is in the loop ─

createEffect(() => {
  const role = currentRole.value;
  const mode = currentMode.value;
  roleBadge.dataset.role = role.toLowerCase();
  roleBadge.dataset.mode = mode;
  roleBadge.textContent = mode === 'cold'
    ? 'cold'
    : `${role.toLowerCase()} · ${mode === 'expect_llm' ? 'thinking' : 'awaiting reply'}`;
});

// ─── 3. Status strip (the [STATE] header, live) ──────────────

createEffect(() => {
  const h = engineHeader.value;
  const tid = activeThreadId.value;
  threadIndicator.textContent = tid ?? 'no active thread';

  if (!h) {
    statusStrip.textContent = 'cold · no PTR committed yet';
    statusStrip.dataset.health = 'cold';
    return;
  }

  const healthKind = h.health.startsWith('HALTED') ? 'halted'
                   : h.health.startsWith('raises') ? 'raises'
                   : 'clear';
  statusStrip.dataset.health = healthKind;

  statusStrip.replaceChildren(
    field('cycle', `#${h.cycle}·${h.seq}`),
    field('stance', h.stance),
    field('plane', `${h.plane}-face`),
    field('path', h.path.join('→')),
    field('held', `${h.heldPole}=${h.heldRole}`),
    field('health', h.health),
  );
});

function field(label: string, value: string): HTMLElement {
  const span = document.createElement('span');
  span.className = `field field-${label}`;
  span.innerHTML = `<em>${label}</em> ${escapeHtml(value)}`;
  return span;
}

// ─── 4. Working surface panel (P/U/I/R with slot states) ─────

createEffect(() => {
  const slots = workingSurface.value;
  surfacePanel.replaceChildren(...slots.map(slot => {
    const cell = document.createElement('div');
    cell.className = `slot slot-${slot.pole} state-${slot.state}`;
    const label = document.createElement('div');
    label.className = 'slot-label';
    label.textContent = `${slot.pole} · ${slot.state}`;
    const body = document.createElement('div');
    body.className = 'slot-body';
    body.textContent = slot.content ?? '(unwritten)';
    cell.appendChild(label);
    cell.appendChild(body);
    return cell;
  }));
});

// ─── 5. Braid history (all committed PTRs, oldest → newest) ──

createEffect(() => {
  const ptrs = braidHistory.value;
  if (ptrs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'braid-empty';
    empty.textContent = 'No committed PTRs yet.';
    braidPanel.replaceChildren(empty);
    return;
  }

  braidPanel.replaceChildren(...ptrs.map(ptr => {
    const row = document.createElement('div');
    const healthKind = ptr.health.startsWith('HALTED') ? 'halted'
                     : ptr.health.startsWith('raises') ? 'raises'
                     : 'clear';
    row.className = `ptr action-${ptr.action.toLowerCase()} health-${healthKind}`;
    row.title = `${ptr.threadId} · ${ptr.stance} · ${ptr.health}`;

    const cyc = document.createElement('span');
    cyc.className = 'ptr-cycle';
    cyc.textContent = `#${ptr.cycle}`;

    const stance = document.createElement('span');
    stance.className = 'ptr-stance';
    stance.textContent = shortenStance(ptr.stance);

    const geom = document.createElement('span');
    geom.className = 'ptr-geom';
    geom.textContent = `${ptr.plane}·${ptr.path.join('')}`;

    const health = document.createElement('span');
    health.className = 'ptr-health';
    health.textContent = ptr.health;

    row.append(cyc, stance, geom, health);
    return row;
  }));
});

function shortenStance(stance: string): string {
  // "Synthesis (P = U × I)" → "Synthesis"
  const paren = stance.indexOf(' (');
  return paren === -1 ? stance : stance.slice(0, paren);
}

// ─── 6. Submission ───────────────────────────────────────────

inputForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputField.value.trim();
  if (!text) return;
  inputField.value = '';
  void processInput(text);
});

// ─── 7. Reset (clears persisted VFS; requires a page reload to rebind engine) ─

resetBtn.addEventListener('click', () => {
  if (!confirm('Clear all persisted state and reload?')) return;
  clearVfs();
  location.reload();
});

// ─── util ────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}
