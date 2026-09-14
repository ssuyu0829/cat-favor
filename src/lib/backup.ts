import { getCans, getCats, getRatings, getSuppLogs, getSupplements, mergeAll, replaceAll, setMeta } from './db';
import { blobToDataUrl, dataUrlToBlob } from './image';
import type { BackupFile, Can, Cat, Rating } from './types';

/** v2：多了 supplements / suppLogs（v1 備份照樣能匯入） */
export const BACKUP_VERSION = 2;

function fileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `cat-favor-備份-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

export async function buildBackup(): Promise<BackupFile> {
  const [cats, cans, ratings, supplements, suppLogs] = await Promise.all([
    getCats(),
    getCans(),
    getRatings(),
    getSupplements(),
    getSuppLogs(),
  ]);
  const canRows = await Promise.all(
    cans.map(async ({ photo, ...rest }) => ({
      ...rest,
      ...(photo ? { photoDataUrl: await blobToDataUrl(photo) } : {}),
    })),
  );
  return {
    app: 'cat-favor',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    cats,
    cans: canRows,
    ratings,
    supplements,
    suppLogs,
  };
}

/**
 * 匯出備份。
 * iPhone 上會跳出系統儲存面板 → 選「儲存到檔案」→ iCloud 雲碟，這樣資料就在雲端了。
 * 不支援分享 API 的瀏覽器（例如桌機 Chrome）就直接下載。
 */
export async function exportBackup(): Promise<'shared' | 'downloaded'> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const name = fileName();
  const file = new File([json], name, { type: 'application/json' });

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  if (canShare) {
    try {
      await navigator.share({ files: [file], title: 'Cat Favor 備份' });
      await setMeta('lastBackupAt', Date.now());
      return 'shared';
    } catch (err) {
      // 使用者按取消不算錯誤，就不要再 fallback 下載一次
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  await setMeta('lastBackupAt', Date.now());
  return 'downloaded';
}

export class BackupError extends Error {}

function assertShape(data: unknown): asserts data is BackupFile {
  if (typeof data !== 'object' || data === null) throw new BackupError('這不是有效的備份檔');
  const d = data as Partial<BackupFile>;
  if (d.app !== 'cat-favor') throw new BackupError('這個檔案不是 Cat Favor 的備份');
  if (!Array.isArray(d.cans) || !Array.isArray(d.ratings) || !Array.isArray(d.cats)) {
    throw new BackupError('備份檔內容不完整');
  }
  if (typeof d.version === 'number' && d.version > BACKUP_VERSION) {
    throw new BackupError('這個備份來自更新版的 App，請先更新再匯入');
  }
}

export interface ImportResult {
  cats: number;
  cans: number;
  ratings: number;
  /** 舊備份沒有保健品 → undefined */
  suppLogs?: number;
}

/** mode='replace' 會清掉現有資料；'merge' 只覆蓋同 id 的項目。 */
export async function importBackup(
  file: File,
  mode: 'replace' | 'merge',
): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new BackupError('檔案不是 JSON，可能選錯檔了');
  }
  assertShape(data);

  const cans: Can[] = await Promise.all(
    data.cans.map(async ({ photoDataUrl, ...rest }) => ({
      ...rest,
      ...(photoDataUrl ? { photo: await dataUrlToBlob(photoDataUrl) } : {}),
    })),
  );
  const cats: Cat[] = data.cats;
  const ratings: Rating[] = data.ratings;
  const supplements = Array.isArray(data.supplements) ? data.supplements : undefined;
  const suppLogs = Array.isArray(data.suppLogs) ? data.suppLogs : undefined;

  const bulk = { cats, cans, ratings, supplements, suppLogs };
  if (mode === 'replace') await replaceAll(bulk);
  else await mergeAll(bulk);

  return { cats: cats.length, cans: cans.length, ratings: ratings.length, suppLogs: suppLogs?.length };
}
