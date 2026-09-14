import { setCanFinished } from '../lib/db';
import { analyzeIngredients, mainProteinOf } from '../lib/parseIngredients';
import { navigate } from '../lib/router';
import { bumpData } from '../lib/store';
import type { Can, Cat, Rating } from '../lib/types';
import { useObjectUrl } from '../lib/useObjectUrl';
import CatAvatar from './CatAvatar';

interface Props {
  can: Can;
  cats: Cat[];
  latest: Map<string, Rating>;
}

/** 完食的兩顆按鈕：兩顆都沒亮＝還沒記錄。 */
const FINISH_BUTTONS = [
  { value: true, cls: 'finish-yes', mark: '✓', text: '吃完', aria: '吃完了' },
  { value: false, cls: 'finish-no', mark: '✕', text: '沒吃完', aria: '沒吃完' },
] as const;

export default function CanCard({ can, cats, latest }: Props) {
  const photoUrl = useObjectUrl(can.photo);
  const analysis = analyzeIngredients(can.ingredients);
  const warnCount = analysis.matched.filter((r) => r.severity === 'warn').length;
  const meat = mainProteinOf(can);

  /** 點亮的那顆再點一次＝取消，回到未記錄。 */
  async function pickFinished(value: boolean) {
    await setCanFinished(can.id, can.finished === value ? undefined : value);
    bumpData();
  }

  return (
    // 卡片本體是按鈕（點了進詳情），完食勾是它的兄弟節點——
    // button 裡不能再放 button，所以外層必須是 div。
    <div className="can-card">
      <button type="button" className="can-card-open" onClick={() => navigate(`/can/${can.id}`)}>
        <div className="can-thumb">
          {photoUrl ? (
            <img src={photoUrl} alt="" loading="lazy" />
          ) : (
            <span className="can-thumb-empty" aria-hidden="true">
              🥫
            </span>
          )}
        </div>

        <div className="can-main">
          <div className="can-title">
            {can.brand && <span className="can-brand">{can.brand}</span>}
            <span className="can-name">{can.name || '未命名罐頭'}</span>
          </div>

          <div className="badge-row">
            {meat && <span className="badge badge-meat">{meat}</span>}
            {can.foodType === 'staple' && <span className="badge badge-sage">主食罐</span>}
            {can.foodType === 'supplement' && <span className="badge badge-amber">副食罐</span>}
            {can.foodType === 'unknown' && <span className="badge">未判定</span>}
            {warnCount > 0 && <span className="badge badge-warn">{warnCount} 項留意</span>}
          </div>

          <div className="mini-ratings">
            {cats.map((cat) => {
              const stars = latest.get(`${can.id}|${cat.id}`)?.stars;
              return (
                <span className="mini-rating" key={cat.id}>
                  <CatAvatar cat={cat} size={22} />
                  <span className={stars === undefined ? 'mini-none' : 'mini-value'}>
                    {stars === undefined ? '—' : stars}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </button>

      <div className="finish-group" role="group" aria-label={`${can.name || '這罐'}有沒有吃完`}>
        {FINISH_BUTTONS.map((b) => {
          const on = can.finished === b.value;
          return (
            <button
              key={b.cls}
              type="button"
              className={`finish-toggle ${b.cls}${on ? ' is-on' : ''}`}
              onClick={() => void pickFinished(b.value)}
              aria-pressed={on}
              aria-label={b.aria}
            >
              <span className="finish-mark" aria-hidden="true">
                {b.mark}
              </span>
              <span className="finish-text">{b.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
