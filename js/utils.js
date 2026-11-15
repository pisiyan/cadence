/**
 * Cadence — Constants, Date & Formatting Utilities
 * Persists all state in localStorage under 'cadence_planner_state_v5'
 */

const STORAGE_KEY = 'cadence_planner_state_v5';
const SECTIONS_BACKUP_KEY = 'cadence_user_sections_backup';
const LEGACY_STORAGE_KEYS = [
  'cadence_planner_state_v5',
  'cadence_planner_state_v4',
  'cadence_planner_state_v3',
  'cadence_planner_state_v2',
  'cadence_planner_state_v1',
];

const PRIORITY_RANK = { P1: 1, P2: 2, P3: 3, P4: 4 };

// ==================== DATE & FORMATTING UTILITIES ====================

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const dt = parseDateLocal(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatDateYMD(dt);
}

function diffDays(startStr, endStr) {
  const a = parseDateLocal(startStr);
  const b = parseDateLocal(endStr);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function getMondayOfWeek(dateStr) {
  const dt = parseDateLocal(dateStr);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(dt.getFullYear(), dt.getMonth(), diff);
  return formatDateYMD(monday);
}

function formatHumanDate(dateStr, includeYear = false) {
  const dt = parseDateLocal(dateStr);
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (includeYear) opts.year = 'numeric';
  return dt.toLocaleDateString('en-US', opts);
}

function formatShortDayLabel(dateStr) {
  const dt = parseDateLocal(dateStr);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function formatFullDateHeading(dateStr) {
  const dt = parseDateLocal(dateStr);
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function roundQuarter(val) {
  return Math.round(val * 4) / 4;
}

function roundTwo(val) {
  return Math.round(val * 100) / 100;
}

function formatHours(h) {
  const num = Number(h) || 0;
  if (Number.isInteger(num)) return `${num.toFixed(1)}h`;
  return `${roundTwo(num)}h`;
}

function formatMinutesOrHours(h) {
  const mins = Math.round(h * 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

function getTargetCompletionDate(task) {
  const bufDays = Math.max(0, Number(task.bufferDays) || 0);
  return addDays(task.deadline, -bufDays);
}

function isDateInFocusPeriod(dateStr) {
  const fp = state.focusPeriod;
  if (!fp || !fp.startDate || !fp.endDate) return false;
  return dateStr >= fp.startDate && dateStr <= fp.endDate;
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

// ==================== TOAST HELPER & HTML ESCAPE ====================

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3400);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
