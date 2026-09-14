import { useMemo, useState } from 'react';
import { newId, putSupplement, setSuppTaken } from '../lib/db';
import { bumpData, useSupplements, useSuppLogs } from '../lib/store';
import { lastNDays, shiftDate, shortLabel, streak, todayKey, weekdayLabel } from '../lib/suppDates';
import type { Supplement } from '../lib/types';

const HISTORY_DAYS = 14;

export default function Supplements() {
  const { data: supps } = useSupplements();
  const { data: logs } = useSuppLogs();
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [manageOpen, setManageOpen] = useState(false);

  /** suppId → 有勾的日期集合 */
  const takenBySupp = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of logs ?? []) {
      let set = map.get(l.suppId);
      if (!set) map.set(l.suppId, (set = new Set()));
      set.add(l.date);
    }
    return map;
  }, [logs]);

  if (!supps || !logs) return <p className="loading">載入中…</p>;

  const active = supps.filter((s) => !s.archived);
  const days = lastNDays(today, HISTORY_DAYS);
  const doneCount = active.filter((s) => takenBySupp.get(s.id)?.has(date)).length;
  // 還沒有任何品項時直接展開，不用先找按鈕
  const showManage = manageOpen || active.length === 0;

  async function toggle(suppId: string, taken: boolean) {
    await setSuppTaken(date, suppId, taken);
    bumpData();
  }

  return (
    <div className="page">
      <div className="supp-datebar">
        <button type="button" className="btn btn-soft supp-date-nav" onClick={() => setDate(shiftDate(date, -1))} aria-label="前一天">
          ‹
        </button>
        <div className="supp-date">
          <span className="supp-date-main">
            {shortLabel(date)}（{date === today ? '今天' : weekdayLabel(date)}）
          </span>
          {active.length > 0 && (
            <span className="supp-date-sub">
              {doneCount}/{active.length} 餵過了
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-soft supp-date-nav"
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={date >= today}
          aria-label="後一天"
        >
          ›
        </button>
      </div>
      {date !== today && (
        <button type="button" className="btn btn-ghost btn-tiny supp-back-today" onClick={() => setDate(today)}>
          回到今天
        </button>
      )}

      {active.length === 0 ? (
        <div className="empty">
          <p className="empty-emoji">💊</p>
          <p>還沒有保健品，先在下面新增。</p>
        </div>
      ) : (
        <div className="supp-list">
          {active.map((s) => {
            const taken = takenBySupp.get(s.id) ?? new Set<string>();
            const on = taken.has(date);
            const n = streak(taken, today);
            return (
              <div className={`card supp-row${on ? ' is-on' : ''}`} key={s.id}>
                <button
                  type="button"
                  className="supp-check"
                  onClick={() => void toggle(s.id, !on)}
                  aria-pressed={on}
                  aria-label={`${s.name}：${on ? '餵過了，點一下取消' : '還沒記，點一下打勾'}`}
                >
                  <span className="supp-mark" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <span className="supp-name">{s.name}</span>
                  <span className="supp-streak">{n > 0 ? `連續 ${n} 天` : ''}</span>
                </button>
                <div className="supp-dots" aria-label={`近 ${HISTORY_DAYS} 天`}>
                  {days.map((d) => (
                    <span
                      key={d}
                      className={`supp-dot${taken.has(d) ? ' is-on' : ''}${d === date ? ' is-cur' : ''}`}
                      title={shortLabel(d)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <p className="muted-note">小圓點是近 {HISTORY_DAYS} 天，最右邊是今天。沒點亮＝那天沒記。</p>
        </div>
      )}

      <section className="card">
        <button type="button" className="supp-manage-toggle" onClick={() => setManageOpen(!showManage)} aria-expanded={showManage}>
          <span className="card-title">管理品項</span>
          <span aria-hidden="true">{showManage ? '▴' : '▾'}</span>
        </button>
        {showManage && <ManageSupplements supps={supps} onAdded={() => setManageOpen(true)} />}
      </section>
    </div>
  );
}

/** onAdded：新增第一種時管理區是「自動展開」的，要釘住，否則清單一不空就收起來 */
function ManageSupplements({ supps, onAdded }: { supps: Supplement[]; onAdded: () => void }) {
  const [name, setName] = useState('');
  const active = supps.filter((s) => !s.archived);
  const archived = supps.filter((s) => s.archived);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const maxOrder = supps.reduce((m, s) => Math.max(m, s.order), -1);
    await putSupplement({ id: newId(), name: trimmed, order: maxOrder + 1, createdAt: Date.now() });
    setName('');
    onAdded();
    bumpData();
  }

  async function save(s: Supplement, patch: Partial<Supplement>) {
    await putSupplement({ ...s, ...patch });
    bumpData();
  }

  /** 跟相鄰那一個交換 order */
  async function move(index: number, dir: -1 | 1) {
    const a = active[index];
    const b = active[index + dir];
    if (!a || !b) return;
    await putSupplement({ ...a, order: b.order });
    await putSupplement({ ...b, order: a.order });
    bumpData();
  }

  return (
    <div className="supp-manage">
      <div className="supp-add">
        <input
          className="search-input"
          value={name}
          placeholder="例如：魚油、離胺酸"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
        <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={!name.trim()}>
          新增
        </button>
      </div>

      {active.map((s, i) => (
        <div className="supp-edit" key={s.id}>
          <input
            className="search-input"
            defaultValue={s.name}
            aria-label="保健品名稱"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== s.name) void save(s, { name: v });
              else e.target.value = s.name;
            }}
          />
          <button type="button" className="btn btn-ghost btn-tiny" onClick={() => void move(i, -1)} disabled={i === 0} aria-label="往上移">
            ↑
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-tiny"
            onClick={() => void move(i, 1)}
            disabled={i === active.length - 1}
            aria-label="往下移"
          >
            ↓
          </button>
          <button type="button" className="btn btn-soft btn-tiny" onClick={() => void save(s, { archived: true })}>
            停用
          </button>
        </div>
      ))}

      {archived.length > 0 && (
        <>
          <p className="muted-note">已停用（紀錄還在，恢復後會接回去）</p>
          {archived.map((s) => (
            <div className="supp-edit supp-edit-archived" key={s.id}>
              <span className="supp-archived-name">{s.name}</span>
              <button type="button" className="btn btn-soft btn-tiny" onClick={() => void save(s, { archived: false })}>
                恢復
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
