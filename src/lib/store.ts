import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getCans, getCats, getRatings, getSuppLogs, getSupplements } from './db';
import type { Can, Cat, Rating, Supplement, SuppLog } from './types';

/**
 * 資料量很小（幾百筆罐頭），不需要 react-query 之類的東西。
 * 寫入後呼叫 bumpData()，所有掛著的 hook 就會重新讀 IndexedDB。
 */

let revision = 0;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function bumpData(): void {
  revision += 1;
  for (const cb of listeners) cb();
}

function useRevision(): number {
  return useSyncExternalStore(
    subscribe,
    () => revision,
    () => revision,
  );
}

export interface AsyncValue<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncValue<T> {
  const [state, setState] = useState<AsyncValue<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // eslint 會抱怨 deps 是動態的，但這裡刻意讓呼叫端決定
  const run = useCallback(load, deps);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    run()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (alive)
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
      });
    return () => {
      alive = false;
    };
  }, [run]);

  return state;
}

export function useCats(): AsyncValue<Cat[]> {
  const rev = useRevision();
  return useAsync(() => getCats(), [rev]);
}

export function useCans(): AsyncValue<Can[]> {
  const rev = useRevision();
  return useAsync(() => getCans(), [rev]);
}

export function useRatings(): AsyncValue<Rating[]> {
  const rev = useRevision();
  return useAsync(() => getRatings(), [rev]);
}

export function useSupplements(): AsyncValue<Supplement[]> {
  const rev = useRevision();
  return useAsync(() => getSupplements(), [rev]);
}

export function useSuppLogs(): AsyncValue<SuppLog[]> {
  const rev = useRevision();
  return useAsync(() => getSuppLogs(), [rev]);
}

/** 每罐 × 每貓 的最新一筆評分，key 是 `${canId}|${catId}`。 */
export function latestRatingMap(ratings: Rating[]): Map<string, Rating> {
  const map = new Map<string, Rating>();
  for (const r of ratings) {
    const key = `${r.canId}|${r.catId}`;
    const prev = map.get(key);
    if (!prev || r.ratedAt > prev.ratedAt) map.set(key, r);
  }
  return map;
}

/** 一罐的平均星數（只算有評過的貓）。 */
export function averageStars(canId: string, latest: Map<string, Rating>, cats: Cat[]): number | null {
  const values = cats
    .map((c) => latest.get(`${canId}|${c.id}`)?.stars)
    .filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
