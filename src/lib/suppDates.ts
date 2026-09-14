/**
 * 保健品用的日期工具。純函式、不碰 DOM，方便單獨測。
 * 日期一律是「本地時區」的 YYYY-MM-DD —— 不要用 toISOString()，台灣會差 8 小時，
 * 早上 8 點前打的勾會算到前一天。
 */

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** YYYY-MM-DD 往前／往後推 n 天（用本地正午，避開夏令時間邊界）。 */
export function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dateKey(new Date(y, m - 1, d + days, 12));
}

/** 最近 n 天（含 end），由舊到新。 */
export function lastNDays(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDate(end, i - (n - 1)));
}

/**
 * 連續天數：從 today 往回數。今天還沒勾不算斷——從昨天開始數，
 * 否則每天早上一打開都會看到「連續 0 天」。
 */
export function streak(dates: Set<string>, today: string): number {
  let cursor = dates.has(today) ? today : shiftDate(today, -1);
  let n = 0;
  while (dates.has(cursor)) {
    n += 1;
    cursor = shiftDate(cursor, -1);
  }
  return n;
}

/** '2026-09-14' → '9/14' */
export function shortLabel(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${m}/${d}`;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function weekdayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]!;
}
