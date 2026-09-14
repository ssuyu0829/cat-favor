import { useMemo, useState } from 'react';
import CanCard from '../components/CanCard';
import CatAvatar from '../components/CatAvatar';
import { analyzeIngredients } from '../lib/parseIngredients';
import { navigate } from '../lib/router';
import { averageStars, latestRatingMap, useCans, useCats, useRatings } from '../lib/store';

type Sort = 'recent' | 'stars';

export default function CanList() {
  const { data: cans, loading } = useCans();
  const { data: cats } = useCats();
  const { data: ratings } = useRatings();

  const [q, setQ] = useState('');
  const [stapleOnly, setStapleOnly] = useState(false);
  const [finishedOnly, setFinishedOnly] = useState(false);
  const [noCarrageenan, setNoCarrageenan] = useState(false);
  const [favCat, setFavCat] = useState<string>('');
  const [sort, setSort] = useState<Sort>('recent');

  const latest = useMemo(() => latestRatingMap(ratings ?? []), [ratings]);

  const filtered = useMemo(() => {
    if (!cans || !cats) return [];
    const needle = q.trim().toLowerCase();
    let rows = cans;

    if (needle) {
      rows = rows.filter((c) =>
        [c.brand, c.name, c.ingredientsRaw, c.notes ?? ''].join(' ').toLowerCase().includes(needle),
      );
    }
    if (stapleOnly) rows = rows.filter((c) => c.foodType === 'staple');
    if (finishedOnly) rows = rows.filter((c) => c.finished === true);
    if (noCarrageenan) {
      rows = rows.filter(
        (c) => !analyzeIngredients(c.ingredients).matched.some((r) => r.id === 'carrageenan'),
      );
    }
    if (favCat) {
      rows = rows.filter((c) => (latest.get(`${c.id}|${favCat}`)?.stars ?? 0) >= 4);
    }

    if (sort === 'stars') {
      rows = [...rows].sort(
        (a, b) =>
          (averageStars(b.id, latest, cats) ?? -1) - (averageStars(a.id, latest, cats) ?? -1),
      );
    }
    return rows;
  }, [cans, cats, q, stapleOnly, finishedOnly, noCarrageenan, favCat, sort, latest]);

  if (loading || !cats) return <p className="loading">載入中…</p>;

  return (
    <div className="page">
      <div className="search-bar">
        <input
          className="search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋品牌、品名、成分…"
          type="search"
        />
      </div>

      <div className="filter-row">
        <button
          type="button"
          className={`pill${stapleOnly ? ' pill-on' : ''}`}
          onClick={() => setStapleOnly((v) => !v)}
        >
          只看主食罐
        </button>
        <button
          type="button"
          className={`pill${finishedOnly ? ' pill-on' : ''}`}
          onClick={() => setFinishedOnly((v) => !v)}
        >
          只看吃完的
        </button>
        <button
          type="button"
          className={`pill${noCarrageenan ? ' pill-on' : ''}`}
          onClick={() => setNoCarrageenan((v) => !v)}
        >
          無卡拉膠
        </button>
        <button
          type="button"
          className={`pill${sort === 'stars' ? ' pill-on' : ''}`}
          onClick={() => setSort((s) => (s === 'stars' ? 'recent' : 'stars'))}
        >
          高分優先
        </button>
      </div>

      <div className="filter-row filter-cats">
        <span className="filter-label">誰愛吃</span>
        {cats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`cat-pill${favCat === cat.id ? ' cat-pill-on' : ''}`}
            style={{ '--cat-color': cat.color } as React.CSSProperties}
            onClick={() => setFavCat((v) => (v === cat.id ? '' : cat.id))}
            title={`只看 ${cat.name} 給 4 星以上的`}
          >
            <CatAvatar cat={cat} size={24} />
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p className="empty-emoji">🐈</p>
          {cans && cans.length === 0 ? (
            <>
              <p>還沒有任何罐頭紀錄。</p>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/scan')}>
                掃第一罐
              </button>
            </>
          ) : (
            <p>沒有符合條件的罐頭。</p>
          )}
        </div>
      ) : (
        <>
          <p className="list-count">{filtered.length} 罐</p>
          <div className="can-list">
            {filtered.map((can) => (
              <CanCard key={can.id} can={can} cats={cats} latest={latest} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
