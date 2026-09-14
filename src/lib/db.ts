import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Can, Cat, Rating, Supplement, SuppLog } from './types';
import { DEFAULT_CATS } from '../data/cats';

const DB_NAME = 'cat-favor';
const DB_VERSION = 2;

interface CatFavorDB extends DBSchema {
  cans: {
    key: string;
    value: Can;
    indexes: { 'by-updated': number };
  };
  ratings: {
    key: string;
    value: Rating;
    indexes: { 'by-can': string; 'by-cat': string };
  };
  cats: {
    key: string;
    value: Cat;
  };
  meta: {
    key: string;
    value: unknown;
  };
  supplements: {
    key: string;
    value: Supplement;
  };
  suppLogs: {
    key: string;
    value: SuppLog;
    indexes: { 'by-date': string };
  };
}

let dbPromise: Promise<IDBPDatabase<CatFavorDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CatFavorDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const cans = db.createObjectStore('cans', { keyPath: 'id' });
          cans.createIndex('by-updated', 'updatedAt');

          const ratings = db.createObjectStore('ratings', { keyPath: 'id' });
          ratings.createIndex('by-can', 'canId');
          ratings.createIndex('by-cat', 'catId');

          db.createObjectStore('cats', { keyPath: 'id' });
          db.createObjectStore('meta');
        }
        // v2：保健品。只新增 store，上面 v1 那段不要動（手機上有真實資料）
        if (oldVersion < 2) {
          db.createObjectStore('supplements', { keyPath: 'id' });
          const logs = db.createObjectStore('suppLogs', { keyPath: 'id' });
          logs.createIndex('by-date', 'date');
        }
      },
    });
  }
  return dbPromise;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── 貓咪 ─────────────────────────────────────────────── */

/** 第一次開啟時把五隻貓寫進去；已存在就不動（使用者可能改過名字/顏色）。 */
export async function ensureSeeded(): Promise<void> {
  const db = await getDB();
  const count = await db.count('cats');
  if (count > 0) return;
  const tx = db.transaction('cats', 'readwrite');
  await Promise.all([...DEFAULT_CATS.map((c) => tx.store.put(c)), tx.done]);
}

export async function getCats(): Promise<Cat[]> {
  const db = await getDB();
  const cats = await db.getAll('cats');
  return cats.sort((a, b) => a.order - b.order);
}

export async function putCat(cat: Cat): Promise<void> {
  const db = await getDB();
  await db.put('cats', cat);
}

/* ── 罐頭 ─────────────────────────────────────────────── */

export async function getCans(): Promise<Can[]> {
  const db = await getDB();
  const cans = await db.getAll('cans');
  return cans.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCan(id: string): Promise<Can | undefined> {
  const db = await getDB();
  return db.get('cans', id);
}

export async function putCan(can: Can): Promise<void> {
  const db = await getDB();
  await db.put('cans', can);
}

/**
 * 只改完食狀態，其餘欄位原樣保留（傳 undefined 代表把紀錄清掉）。
 * 列表上點一下就寫入，不用把整個 Can 搬到元件裡再存回來。
 */
export async function setCanFinished(id: string, finished?: boolean): Promise<void> {
  const db = await getDB();
  const can = await db.get('cans', id);
  if (!can) return;
  const next: Can = { ...can, updatedAt: Date.now() };
  if (finished === undefined) delete next.finished;
  else next.finished = finished;
  await db.put('cans', next);
}

/** 刪罐頭時連同它的評分一起刪，避免留下孤兒資料。 */
export async function deleteCan(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['cans', 'ratings'], 'readwrite');
  const ratingIds = await tx.objectStore('ratings').index('by-can').getAllKeys(id);
  await Promise.all([
    tx.objectStore('cans').delete(id),
    ...ratingIds.map((rid) => tx.objectStore('ratings').delete(rid)),
    tx.done,
  ]);
}

/* ── 評分 ─────────────────────────────────────────────── */

export async function getRatings(): Promise<Rating[]> {
  const db = await getDB();
  return db.getAll('ratings');
}

export async function getRatingsForCan(canId: string): Promise<Rating[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('ratings', 'by-can', canId);
  return rows.sort((a, b) => b.ratedAt - a.ratedAt);
}

export async function putRating(rating: Rating): Promise<void> {
  const db = await getDB();
  await db.put('ratings', rating);
}

export async function deleteRating(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('ratings', id);
}

/* ── 保健品 ───────────────────────────────────────────── */

export async function getSupplements(): Promise<Supplement[]> {
  const db = await getDB();
  const rows = await db.getAll('supplements');
  return rows.sort((a, b) => a.order - b.order);
}

export async function putSupplement(supp: Supplement): Promise<void> {
  const db = await getDB();
  await db.put('supplements', supp);
}

export async function getSuppLogs(): Promise<SuppLog[]> {
  const db = await getDB();
  return db.getAll('suppLogs');
}

/** 打勾＝寫一筆、取消＝刪掉那筆。 */
export async function setSuppTaken(date: string, suppId: string, taken: boolean): Promise<void> {
  const db = await getDB();
  const id = `${date}|${suppId}`;
  if (taken) await db.put('suppLogs', { id, date, suppId, at: Date.now() });
  else await db.delete('suppLogs', id);
}

/* ── meta（備份時間等雜項）─────────────────────────────── */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}

/* ── 備份還原用的整批操作 ──────────────────────────────── */

export interface BulkData {
  cats: Cat[];
  cans: Can[];
  ratings: Rating[];
  /** 舊備份沒有這兩欄：undefined 時不動現有的保健品資料 */
  supplements?: Supplement[];
  suppLogs?: SuppLog[];
}

export async function replaceAll(data: BulkData): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['cats', 'cans', 'ratings', 'supplements', 'suppLogs'], 'readwrite');
  await Promise.all([
    tx.objectStore('cats').clear(),
    tx.objectStore('cans').clear(),
    tx.objectStore('ratings').clear(),
    ...(data.supplements ? [tx.objectStore('supplements').clear()] : []),
    ...(data.suppLogs ? [tx.objectStore('suppLogs').clear()] : []),
  ]);
  await Promise.all([
    ...data.cats.map((c) => tx.objectStore('cats').put(c)),
    ...data.cans.map((c) => tx.objectStore('cans').put(c)),
    ...data.ratings.map((r) => tx.objectStore('ratings').put(r)),
    ...(data.supplements ?? []).map((s) => tx.objectStore('supplements').put(s)),
    ...(data.suppLogs ?? []).map((l) => tx.objectStore('suppLogs').put(l)),
    tx.done,
  ]);
}

/** 合併匯入：同 id 覆蓋，其餘保留。 */
export async function mergeAll(data: BulkData): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['cats', 'cans', 'ratings', 'supplements', 'suppLogs'], 'readwrite');
  await Promise.all([
    ...data.cats.map((c) => tx.objectStore('cats').put(c)),
    ...data.cans.map((c) => tx.objectStore('cans').put(c)),
    ...data.ratings.map((r) => tx.objectStore('ratings').put(r)),
    ...(data.supplements ?? []).map((s) => tx.objectStore('supplements').put(s)),
    ...(data.suppLogs ?? []).map((l) => tx.objectStore('suppLogs').put(l)),
    tx.done,
  ]);
}
