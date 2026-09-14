import { useMemo } from 'react';
import CatAvatar from '../components/CatAvatar';
import { navigate } from '../lib/router';
import { latestRatingMap, useCats, useRatings } from '../lib/store';

export default function CatList() {
  const { data: cats } = useCats();
  const { data: ratings } = useRatings();
  const latest = useMemo(() => latestRatingMap(ratings ?? []), [ratings]);

  if (!cats) return <p className="loading">載入中…</p>;

  const stats = cats.map((cat) => {
    const values = [...latest.entries()]
      .filter(([key]) => key.endsWith(`|${cat.id}`))
      .map(([, r]) => r.stars);
    const avg =
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { cat, count: values.length, avg };
  });

  return (
    <div className="page">
      <div className="cat-grid">
        {stats.map(({ cat, count, avg }) => (
          <button
            key={cat.id}
            type="button"
            className="cat-card"
            style={{ '--cat-color': cat.color } as React.CSSProperties}
            onClick={() => navigate(`/cat/${cat.id}`)}
          >
            <CatAvatar cat={cat} size={54} />
            <span className="cat-card-name">{cat.name}</span>
            <span className="cat-card-stat">
              {count === 0 ? '還沒評分' : `${count} 罐 · 平均 ${avg?.toFixed(1)}★`}
            </span>
          </button>
        ))}
      </div>
      <p className="muted-note">點進去看每隻貓愛吃什麼、討厭什麼。</p>
    </div>
  );
}
