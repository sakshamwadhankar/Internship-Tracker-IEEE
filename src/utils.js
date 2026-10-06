/**
 * Utility functions for calculations, date handling, and filtering.
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} [goalId]
 * @property {string} title
 * @property {boolean} completed
 * @property {string} [dueDate] - YYYY-MM-DD
 * @property {string} [priority] - 'low' | 'medium' | 'high'
 */

/**
 * @typedef {Object} Subtask
 * @property {string} id
 * @property {string} taskId
 * @property {string} title
 * @property {boolean} completed
 */

/**
 * Calculate progress percentage for a specific goal
 * @param {Task[]} tasks
 * @param {string} goalId
 * @returns {{ completedCount: number, totalCount: number, percent: number }}
 */
export function calculateGoalProgress(tasks, goalId) {
  const goalTasks = tasks.filter(t => t.goalId === goalId);
  const completedCount = goalTasks.filter(t => t.completed).length;
  const totalCount = goalTasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, percent };
}

/**
 * Calculate overall progress percentage across all tasks
 * @param {Task[]} tasks
 * @returns {{ completedCount: number, totalCount: number, percent: number }}
 */
export function calculateOverallProgress(tasks) {
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, percent };
}

/**
 * Calculate subtasks completion for a task
 * @param {Subtask[]} subtasks
 * @param {string} taskId
 * @returns {{ completedCount: number, totalCount: number, percent: number }}
 */
export function calculateSubtaskProgress(subtasks, taskId) {
  const taskSubtasks = subtasks.filter(s => s.taskId === taskId);
  const completedCount = taskSubtasks.filter(s => s.completed).length;
  const totalCount = taskSubtasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, percent };
}

/**
 * Get tasks due today
 * @param {Task[]} tasks
 * @param {string} todayStr - YYYY-MM-DD
 * @returns {Task[]}
 */
export function getTodayTasks(tasks, todayStr) {
  return tasks.filter(t => t.dueDate === todayStr);
}

/**
 * Get overdue tasks (not completed and dueDate < todayStr)
 * @param {Task[]} tasks
 * @param {string} todayStr - YYYY-MM-DD
 * @returns {Task[]}
 */
export function getOverdueTasks(tasks, todayStr) {
  return tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr);
}

/**
 * Format a Date object to YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format YYYY-MM-DD to localized display string, or 'All Dates' if empty/all
 * @param {string|null|undefined} [dateStr]
 * @returns {string}
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr || dateStr === 'all') {
    return 'All Dates';
  }
  try {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

/**
 * Filter tasks by specific date string (YYYY-MM-DD).
 * If dateStr is null, undefined, or 'all', returns all tasks irrespective of date.
 * @param {Task[]} tasks
 * @param {string|null|undefined} [dateStr]
 * @returns {Task[]}
 */
export function filterTasksByDate(tasks, dateStr) {
  if (!dateStr || dateStr === 'all') {
    return [...tasks];
  }
  return tasks.filter(t => t.dueDate === dateStr);
}

/**
 * Format a Date or date string into hero components (e.g. "06.04 Thursday")
 * @param {Date|string} inputDate
 * @returns {{ dayMonth: string, dayName: string, monthName: string, dayNum: string, full: string }}
 */
export function formatHeroDate(inputDate) {
  const date = typeof inputDate === 'string'
    ? (inputDate.includes('T') ? new Date(inputDate) : new Date(inputDate + 'T00:00:00'))
    : inputDate;

  if (!date || isNaN(date.getTime())) {
    return {
      dayMonth: '--.--',
      dayName: 'Today',
      monthName: '',
      dayNum: '--',
      full: 'Today'
    };
  }

  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dayMonth = `${d}.${m}`;
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });

  return {
    dayMonth,
    dayName,
    monthName,
    dayNum: d,
    full: `${dayMonth} ${dayName}`
  };
}

/**
 * Generate a date strip of sequential days around a base date
 * @param {Date} baseDate
 * @param {number} [daysBefore=0]
 * @param {number} [daysAfter=7]
 * @returns {Array<{ dateStr: string, dayNum: string, isToday: boolean, label: string }>}
 */
export function getDateStrip(baseDate, daysBefore = 0, daysAfter = 7) {
  const todayStr = toISODateString(new Date());
  /** @type {Array<{ dateStr: string, dayNum: string, isToday: boolean, label: string }>} */
  const list = [];
  const start = -daysBefore;

  for (let i = start; i <= daysAfter; i++) {
    const cur = new Date(baseDate);
    cur.setDate(baseDate.getDate() + i);
    const dateStr = toISODateString(cur);
    const dayNum = String(cur.getDate()).padStart(2, '0');
    const isToday = dateStr === todayStr;
    const label = isToday ? 'Today' : dayNum;

    list.push({
      dateStr,
      dayNum,
      isToday,
      label
    });
  }

  return list;
}

/**
 * @typedef {'mint' | 'cream' | 'orange' | 'slate'} CardTheme
 */

/**
 * Get alternating card color theme from index
 * @param {number} index
 * @returns {{ theme: CardTheme, bgClass: string }}
 */
export function getTaskColorTheme(index) {
  /** @type {Array<{ theme: CardTheme, bgClass: string }>} */
  const themes = [
    { theme: 'mint', bgClass: 'task-card-mint' },
    { theme: 'cream', bgClass: 'task-card-cream' },
    { theme: 'orange', bgClass: 'task-card-orange' },
    { theme: 'slate', bgClass: 'task-card-slate' },
  ];
  return themes[Math.abs(index) % themes.length];
}

/**
 * Compress an image File into a web-friendly DataURL
 * @param {File} file
 * @param {number} [maxWidth=1280]
 * @param {number} [quality=0.82]
 * @returns {Promise<string>}
 */
export function compressImageFile(file, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    if (typeof FileReader === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Image processing is only supported in browser environments'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(e.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate widget background alpha and backdrop blur from translucency percentage
 * @param {number|string|undefined|null} percent - Translucency percentage (0 to 100)
 * @returns {{ alpha: number, blurPx: number }}
 */
export function computeTranslucencyValues(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  // At 0% translucency: alpha = 1.0 (completely solid)
  // At 100% translucency: alpha = 0.0 (fully transparent glass)
  const alpha = Number((1 - (p / 100)).toFixed(2));
  const blurPx = Math.round(12 + (p / 100) * 12);
  return { alpha, blurPx };
}




