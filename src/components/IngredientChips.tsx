import { useState } from 'react';
import type { IngredientRule } from '../data/ingredientRules';
import { SEVERITY_LABEL } from '../data/ingredientRules';

interface Props {
  rules: IngredientRule[];
}

/** 命中的成分規則做成 chip，點一下展開白話說明。 */
export default function IngredientChips({ rules }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rules.length === 0) {
    return <p className="muted-note">沒有比對到規則庫裡的成分。</p>;
  }

  return (
    <div className="chip-area">
      <div className="chip-row">
        {rules.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`chip chip-${r.severity}${openId === r.id ? ' chip-open' : ''}`}
            onClick={() => setOpenId(openId === r.id ? null : r.id)}
          >
            {r.label}
            <span className="chip-sev">{SEVERITY_LABEL[r.severity]}</span>
          </button>
        ))}
      </div>
      {openId && (
        <p className="chip-note">{rules.find((r) => r.id === openId)?.note}</p>
      )}
    </div>
  );
}
