import { useMemo } from 'react';
import CatAvatar from '../components/CatAvatar';
import StarRating from '../components/StarRating';
import { mainProteinOf } from '../lib/parseIngredients';
import { navigate } from '../lib/router';
import { latestRatingMap, useCans, useCats, useRatings } from '../lib/store';
import type { Can } from '../lib/types';

interface Scored {
  can: Can;
  stars: number;
}

interface MeatStat {
  label: string;
  avg: number;
  count: number;
  /** 這種肉裡「有記到吃完」的罐數；完食不分貓，所以是全體數字 */
  finishedCount: number;
  /** 有記過完食（吃完或沒吃完）的罐數，當作完食率的分母 */
  recordedCount: number;
}

/**
 * 把這隻貓評過的罐頭按主要肉類分群，算各群的平均星等。
 * 「這隻貓對鮪魚的評價比雞肉高嗎」就是看這張表。
 */
function byMeat(scored: Scored[]): MeatStat[] {
  const groups = new Map<string, Scored[]>();
  for (const row of scored) {
    const label = mainProteinOf(row.can) ?? '其他';
    const list = groups.get(label);
    if (list) list.push(row);
    else groups.set(label, [row]);
  }

  return [...groups.entries()]
    .map(([label, rows]) => ({
      label,
      avg: rows.reduce((sum, r) => sum + r.stars, 0) / rows.length,
      count: rows.length,
      finishedCount: rows.filter((r) => r.can.finished === true).length,
      recordedCount: rows.filter((r) => r.can.finished !== undefined).length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

/** 把成分做次數統計，找出這隻貓愛吃的罐頭裡最常出現的東西。 */
function countIngredients(cans: Can[]): Array<{ text: string; count: number }> {
  const map = new Map<string, number>();
  for (const can of cans) {
    // 同一罐裡重複的成分只算一次
    for (const item of new Set(can.ingredients.map((s) => s.trim()))) {
      if (!item) continue;
      map.set(item, (map.get(item) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
}

export default function CatDetail({ catId }: { catId: string }) {
  const { data: cats } = useCats();
  const { data: cans } = useCans();
  const { data: ratings } = useRatings();
  const latest = useMemo(() => latestRatingMap(ratings ?? []), [ratings]);

  const cat = cats?.find((c) => c.id === catId);

  const scored = useMemo(() => {
    if (!cans) return [];
    return cans
      .map((can) => ({ can, stars: latest.get(`${can.id}|${catId}`)?.stars }))
      .filter((row): row is Scored => typeof row.stars === 'number')
      .sort((a, b) => b.stars - a.stars);
  }, [cans, latest, catId]);

  const meats = useMemo(() => byMeat(scored), [scored]);

  const loved = scored.filter((r) => r.stars >= 4).map((r) => r.can);
  const hated = scored.filter((r) => r.stars <= 2).map((r) => r.can);

  const lovedIngredients = useMemo(() => countIngredients(loved).slice(0, 10), [loved]);
  const hatedIngredients = useMemo(() => countIngredients(hated).slice(0, 6), [hated]);

  if (!cats || !cans) return <p className="loading">載入中…</p>;
  if (!cat) {
    return (
      <div className="page">
        <p className="empty">找不到這隻貓。</p>
      </div>
    );
  }

  const avg =
    scored.length > 0 ? scored.reduce((sum, r) => sum + r.stars, 0) / scored.length : null;
  const stapleCount = loved.filter((c) => c.foodType === 'staple').length;

  return (
    <div className="page" style={{ '--cat-color': cat.color } as React.CSSProperties}>
      <section className="card card-hero cat-hero">
        <CatAvatar cat={cat} size={64} />
        <div className="hero-text">
          <h1 className="hero-name">{cat.name}</h1>
          <p className="hero-brand">
            {scored.length === 0
              ? '還沒有評分紀錄'
              : `評過 ${scored.length} 罐 · 平均 ${avg?.toFixed(1)}★`}
          </p>
        </div>
      </section>

      {scored.length === 0 ? (
        <div className="empty">
          <p className="empty-emoji">🍽</p>
          <p>幫 {cat.name} 評幾罐之後，這裡就會出現口味分析。</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/scan')}>
            去新增罐頭
          </button>
        </div>
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">最愛（4★ 以上）</h2>
            {loved.length === 0 ? (
              <p className="muted-note">目前沒有 4 星以上的罐頭。</p>
            ) : (
              <ul className="rank-list">
                {scored
                  .filter((r) => r.stars >= 4)
                  .slice(0, 5)
                  .map(({ can, stars }) => (
                    <li key={can.id}>
                      <button type="button" onClick={() => navigate(`/can/${can.id}`)}>
                        <span className="rank-name">
                          {can.brand && <em>{can.brand}</em>}
                          {can.name || '未命名罐頭'}
                        </span>
                        <StarRating value={stars} size={14} color={cat.color} />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {meats.length > 0 && (
            <section className="card">
              <h2 className="card-title">肉類偏好</h2>
              <p className="muted-note">
                {cat.name}評過的罐頭按主要肉類分群，平均星數高的排前面。
              </p>
              <ul className="freq-list">
                {meats.map(({ label, avg, count }) => (
                  <li key={label}>
                    <span className="freq-label">{label}</span>
                    <span className="freq-bar">
                      <span
                        className="freq-fill"
                        style={{ width: `${(avg / 5) * 100}%`, background: cat.color }}
                      />
                    </span>
                    <span className="freq-count">
                      {avg.toFixed(1)}★ · {count} 罐
                    </span>
                  </li>
                ))}
              </ul>
              {meats.some((m) => m.recordedCount > 0) && (
                <p className="muted-note">
                  吃完的比例（不分貓、全家一起算）：
                  {meats
                    .filter((m) => m.recordedCount > 0)
                    .map((m) => `${m.label} ${m.finishedCount}/${m.recordedCount}`)
                    .join('、')}
                </p>
              )}
            </section>
          )}

          {lovedIngredients.length > 0 && (
            <section className="card">
              <h2 className="card-title">口味偏好</h2>
              <p className="muted-note">
                {cat.name}給 4 星以上的 {loved.length} 罐裡，最常出現的成分：
              </p>
              <ul className="freq-list">
                {lovedIngredients.map(({ text, count }) => (
                  <li key={text}>
                    <span className="freq-label">{text}</span>
                    <span className="freq-bar">
                      <span
                        className="freq-fill"
                        style={{
                          width: `${(count / loved.length) * 100}%`,
                          background: cat.color,
                        }}
                      />
                    </span>
                    <span className="freq-count">
                      {count}/{loved.length}
                    </span>
                  </li>
                ))}
              </ul>
              {loved.length > 0 && (
                <p className="muted-note">
                  其中 {stapleCount} 罐是主食罐（{Math.round((stapleCount / loved.length) * 100)}
                  %）。
                </p>
              )}
            </section>
          )}

          {hated.length > 0 && (
            <section className="card">
              <h2 className="card-title">踩雷（2★ 以下）</h2>
              <ul className="rank-list">
                {scored
                  .filter((r) => r.stars <= 2)
                  .slice(0, 5)
                  .map(({ can, stars }) => (
                    <li key={can.id}>
                      <button type="button" onClick={() => navigate(`/can/${can.id}`)}>
                        <span className="rank-name">
                          {can.brand && <em>{can.brand}</em>}
                          {can.name || '未命名罐頭'}
                        </span>
                        <StarRating value={stars} size={14} color={cat.color} />
                      </button>
                    </li>
                  ))}
              </ul>
              {hatedIngredients.length > 0 && (
                <p className="muted-note">
                  常見成分：{hatedIngredients.map((i) => i.text).join('、')}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
