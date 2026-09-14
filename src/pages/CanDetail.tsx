import { useEffect, useMemo, useState } from 'react';
import CatAvatar from '../components/CatAvatar';
import IngredientChips from '../components/IngredientChips';
import NutritionBars from '../components/NutritionBars';
import StarRating from '../components/StarRating';
import { deleteCan, deleteRating, getCan, getRatingsForCan, newId, putRating } from '../lib/db';
import { analyzeNutrition } from '../lib/nutrition';
import { analyzeIngredients, mainProteinOf } from '../lib/parseIngredients';
import { navigate } from '../lib/router';
import { bumpData, useCats } from '../lib/store';
import type { Can, Rating } from '../lib/types';
import { useObjectUrl } from '../lib/useObjectUrl';

const FIRST_INGREDIENT_NOTE = {
  'named-meat': { level: 'good', text: '第一成分是明確的肉／魚來源' },
  vague: { level: 'warn', text: '第一成分寫得含糊（副產品或未指明肉類）' },
  'non-meat': { level: 'caution', text: '第一成分不是肉，肉含量可能偏低' },
  unknown: { level: 'caution', text: '沒有成分資料' },
} as const;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function CanDetail({ canId }: { canId: string }) {
  const { data: cats } = useCats();
  const [can, setCan] = useState<Can | null>(null);
  const [rows, setRows] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const photoUrl = useObjectUrl(can?.photo);

  async function reload() {
    const [c, r] = await Promise.all([getCan(canId), getRatingsForCan(canId)]);
    setCan(c ?? null);
    setRows(r);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canId]);

  const analysis = useMemo(() => analyzeIngredients(can?.ingredients ?? []), [can]);
  const nutrition = useMemo(
    () => (can ? analyzeNutrition(can.guaranteed, can.weightG) : null),
    [can],
  );
  const mainProtein = useMemo(() => (can ? mainProteinOf(can) : undefined), [can]);

  const latest = useMemo(() => {
    const map: Record<string, Rating> = {};
    for (const r of rows) if (!(r.catId in map)) map[r.catId] = r;
    return map;
  }, [rows]);

  if (loading || !cats) return <p className="loading">載入中…</p>;
  if (!can) {
    return (
      <div className="page">
        <p className="empty">找不到這罐，可能已經被刪掉了。</p>
        <button type="button" className="btn btn-soft" onClick={() => navigate('/')}>
          回罐頭庫
        </button>
      </div>
    );
  }

  async function rate(catId: string, stars: number) {
    if (stars <= 0) return;
    await putRating({ id: newId(), canId, catId, stars, ratedAt: Date.now() });
    bumpData();
    await reload();
  }

  async function removeRating(id: string) {
    await deleteRating(id);
    bumpData();
    await reload();
  }

  async function remove() {
    await deleteCan(canId);
    bumpData();
    navigate('/', { replace: true });
  }

  const firstNote = FIRST_INGREDIENT_NOTE[analysis.firstIngredientKind];

  return (
    <div className="page">
      <section className="card card-hero">
        {photoUrl && <img className="hero-photo" src={photoUrl} alt="標籤照片" />}
        <div className="hero-text">
          {can.brand && <p className="hero-brand">{can.brand}</p>}
          <h1 className="hero-name">{can.name || '未命名罐頭'}</h1>
          <div className="badge-row">
            {mainProtein && <span className="badge badge-meat">{mainProtein}</span>}
            {can.finished === true && <span className="badge badge-sage">吃完了</span>}
            {can.finished === false && <span className="badge badge-warn">沒吃完</span>}
            {can.foodType === 'staple' && <span className="badge badge-sage">主食罐</span>}
            {can.foodType === 'supplement' && <span className="badge badge-amber">副食罐</span>}
            {can.foodType === 'unknown' && <span className="badge">未判定</span>}
            {can.weightG && <span className="badge">{can.weightG}g</span>}
            {can.source === 'ai' && <span className="badge">AI 辨識</span>}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">誰賞臉？</h2>
        <div className="rating-list">
          {cats.map((cat) => (
            <div className="rating-row" key={cat.id}>
              <div className="rating-who">
                <CatAvatar cat={cat} size={34} />
                <span className="rating-name">{cat.name}</span>
              </div>
              <StarRating
                value={latest[cat.id]?.stars ?? 0}
                onChange={(v) => void rate(cat.id, v)}
                color={cat.color}
                label={cat.name}
              />
            </div>
          ))}
        </div>
        <p className="muted-note">在這裡改分數會直接記成新的一筆，之前的紀錄留在下方歷史。</p>
      </section>

      {nutrition && (
        <section className="card">
          <h2 className="card-title">營養分析</h2>
          <NutritionBars nutrition={nutrition} />
        </section>
      )}

      <section className="card">
        <h2 className="card-title">成分解析</h2>
        <ul className="verdicts">
          <li className={`verdict verdict-${firstNote.level}`}>{firstNote.text}</li>
          <li className={`verdict verdict-${analysis.hasTaurine ? 'good' : 'warn'}`}>
            {analysis.hasTaurine ? '有添加牛磺酸' : '成分裡沒看到牛磺酸'}
          </li>
          <li className={`verdict verdict-${analysis.hasVitamins ? 'good' : 'caution'}`}>
            {analysis.hasVitamins ? '有補充維生素／礦物質' : '沒看到維生素／礦物質補充'}
          </li>
        </ul>
        <IngredientChips rules={analysis.matched} />

        {analysis.items.length > 0 && (
          <ol className="ingredient-list">
            {analysis.items.map((item, i) => (
              <li key={`${item.text}-${i}`}>
                <span className="ing-index">{i + 1}</span>
                <span className="ing-text">{item.text}</span>
                {item.rules.map((r) => (
                  <span key={r.id} className={`tag tag-${r.severity}`}>
                    {r.label}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        )}
      </section>

      {can.notes && (
        <section className="card">
          <h2 className="card-title">備註</h2>
          <p className="notes-text">{can.notes}</p>
        </section>
      )}

      {rows.length > 0 && (
        <section className="card">
          <h2 className="card-title">評分歷史</h2>
          <ul className="history">
            {rows.map((r) => {
              const cat = cats.find((c) => c.id === r.catId);
              return (
                <li key={r.id}>
                  <span className="history-cat" style={{ color: cat?.color }}>
                    {cat?.name ?? r.catId}
                  </span>
                  <span className="history-stars">{r.stars} ★</span>
                  <span className="history-date">{formatDate(r.ratedAt)}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-tiny"
                    onClick={() => void removeRating(r.id)}
                  >
                    刪除
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 詳情頁的動作不急，不用黏在底部擋住內容 */}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => navigate(`/can/${canId}/edit`)}
        >
          編輯
        </button>
        {confirmDelete ? (
          <button type="button" className="btn btn-danger" onClick={() => void remove()}>
            確定刪除？
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
            刪除
          </button>
        )}
      </div>
    </div>
  );
}
