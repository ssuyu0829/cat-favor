import { carbComment, proteinComment, type NutritionResult } from '../lib/nutrition';

const SEGMENTS = [
  { key: 'protein', label: '蛋白質', color: 'var(--sage)' },
  { key: 'fat', label: '脂肪', color: 'var(--amber)' },
  { key: 'nfe', label: '碳水', color: 'var(--accent)' },
  { key: 'fiber', label: '纖維', color: 'var(--muted)' },
  { key: 'ash', label: '灰分', color: 'var(--taupe)' },
] as const;

interface Props {
  nutrition: NutritionResult;
}

/** 乾物比組成長條 + 熱量等衍生數字。所有數字都是估算，UI 上要講清楚。 */
export default function NutritionBars({ nutrition }: Props) {
  const dm = nutrition.dm;
  const parts = SEGMENTS.map((s) => ({ ...s, value: dm?.[s.key] ?? 0 })).filter(
    (s) => s.value > 0,
  );
  const total = parts.reduce((sum, p) => sum + p.value, 0);

  const carb = carbComment(dm?.nfe);
  const protein = proteinComment(dm?.protein);

  return (
    <div className="nutrition">
      {total > 0 ? (
        <>
          <div className="bar-track" role="img" aria-label="乾物比組成">
            {parts.map((p) => (
              <span
                key={p.key}
                className="bar-seg"
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
                title={`${p.label} ${p.value}%`}
              />
            ))}
          </div>
          <ul className="legend">
            {parts.map((p) => (
              <li key={p.key}>
                <span className="legend-dot" style={{ background: p.color }} />
                <span className="legend-label">{p.label}</span>
                <span className="legend-value">{p.value}%</span>
              </li>
            ))}
          </ul>
          <p className="muted-note">以上為乾物比（扣掉水分後的比例），方便跨罐比較。</p>
        </>
      ) : (
        <p className="muted-note">資料不足，無法畫出乾物比。</p>
      )}

      <div className="stat-row">
        {nutrition.kcalPer100g !== undefined && (
          <div className="stat">
            <span className="stat-value">{nutrition.kcalPer100g}</span>
            <span className="stat-label">kcal / 100g</span>
          </div>
        )}
        {nutrition.kcalPerCan !== undefined && (
          <div className="stat">
            <span className="stat-value">{nutrition.kcalPerCan}</span>
            <span className="stat-label">整罐 kcal</span>
          </div>
        )}
        {nutrition.phosphorusPer100kcal !== undefined && (
          <div className="stat">
            <span className="stat-value">{nutrition.phosphorusPer100kcal}</span>
            <span className="stat-label">磷 mg/100kcal</span>
          </div>
        )}
      </div>

      {(protein || carb) && (
        <ul className="verdicts">
          {protein && <li className={`verdict verdict-${protein.level}`}>{protein.text}</li>}
          {carb && <li className={`verdict verdict-${carb.level}`}>{carb.text}</li>}
        </ul>
      )}

      {nutrition.assumedAsh && (
        <p className="muted-note">※ 標籤沒有灰分，碳水以典型濕食灰分 2.5% 代入估算。</p>
      )}
      {nutrition.warnings.length > 0 && (
        <ul className="warn-list">
          {nutrition.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
