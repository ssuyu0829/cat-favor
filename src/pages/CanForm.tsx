import { useEffect, useMemo, useRef, useState } from 'react';
import CatRatingRow from '../components/CatRatingRow';
import IngredientChips from '../components/IngredientChips';
import { GeminiError, getApiKey, recognizeLabel } from '../lib/gemini';
import { compressImage } from '../lib/image';
import { getCan, getRatingsForCan, newId, putCan, putRating } from '../lib/db';
import {
  analyzeIngredients,
  mainProteinOf,
  parsePastedLabel,
  splitIngredients,
} from '../lib/parseIngredients';
import { back, navigate } from '../lib/router';
import { bumpData, useCats } from '../lib/store';
import type { Can, FoodType, Guaranteed } from '../lib/types';
import { useObjectUrl } from '../lib/useObjectUrl';

type GKey = keyof Guaranteed;

const GUARANTEED_FIELDS: Array<{ key: GKey; label: string; primary: boolean }> = [
  { key: 'protein', label: '粗蛋白', primary: true },
  { key: 'fat', label: '粗脂肪', primary: true },
  { key: 'moisture', label: '水分', primary: true },
  { key: 'ash', label: '粗灰分', primary: true },
  { key: 'fiber', label: '粗纖維', primary: true },
  { key: 'taurine', label: '牛磺酸', primary: false },
  { key: 'phosphorus', label: '磷', primary: false },
  { key: 'calcium', label: '鈣', primary: false },
  { key: 'sodium', label: '鈉', primary: false },
];

const FOOD_TYPE_LABEL: Record<FoodType, string> = {
  staple: '主食罐',
  supplement: '副食罐',
  unknown: '未判定',
};

function guaranteedToText(g: Guaranteed): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key } of GUARANTEED_FIELDS) {
    const v = g[key];
    out[key] = v === undefined ? '' : String(v);
  }
  return out;
}

function textToGuaranteed(text: Record<string, string>): Guaranteed {
  const out: Guaranteed = {};
  for (const { key } of GUARANTEED_FIELDS) {
    const raw = (text[key] ?? '').trim();
    if (raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) out[key] = n;
  }
  return out;
}

interface Props {
  canId?: string;
}

export default function CanForm({ canId }: Props) {
  const isEdit = Boolean(canId);
  const { data: cats } = useCats();

  const [loaded, setLoaded] = useState(!isEdit);
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [ingredientsRaw, setIngredientsRaw] = useState('');
  const [gText, setGText] = useState<Record<string, string>>(() => guaranteedToText({}));
  const [notes, setNotes] = useState('');
  const [mainProtein, setMainProtein] = useState('');
  const [foodTypeOverride, setFoodTypeOverride] = useState<FoodType | null>(null);
  /** 完食狀態不在這張表單上編輯（在罐頭庫列表按），但存檔時要原樣帶回去，否則會被抹掉 */
  const [finished, setFinished] = useState<boolean | undefined>(undefined);
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [source, setSource] = useState<Can['source']>('manual');
  const [createdAt, setCreatedAt] = useState<number>(() => Date.now());

  const [showMore, setShowMore] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string; hint?: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const firstPhotoUrl = useObjectUrl(photos[0]);
  const secondPhotoUrl = useObjectUrl(photos[1]);

  /* 編輯模式：載入既有資料 */
  useEffect(() => {
    if (!canId) return;
    let alive = true;
    void (async () => {
      const [can, rows] = await Promise.all([getCan(canId), getRatingsForCan(canId)]);
      if (!alive || !can) return;
      setBrand(can.brand);
      setName(can.name);
      setWeight(can.weightG === undefined ? '' : String(can.weightG));
      setIngredientsRaw(can.ingredientsRaw || can.ingredients.join('、'));
      setGText(guaranteedToText(can.guaranteed));
      setNotes(can.notes ?? '');
      setMainProtein(can.mainProtein ?? '');
      setFinished(can.finished);
      setFoodTypeOverride(can.foodType);
      setSource(can.source);
      setCreatedAt(can.createdAt);
      if (can.photo) setPhotos([can.photo]);

      const latest: Record<string, number> = {};
      for (const r of rows) if (!(r.catId in latest)) latest[r.catId] = r.stars;
      setRatings(latest);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [canId]);

  const items = useMemo(() => splitIngredients(ingredientsRaw), [ingredientsRaw]);
  const analysis = useMemo(() => analyzeIngredients(items), [items]);
  const effectiveFoodType = foodTypeOverride ?? analysis.suggestedFoodType;
  const autoMeat = useMemo(() => mainProteinOf({ ingredients: items }), [items]);

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhotos((prev) => [...prev, compressed].slice(0, 2));
    } catch {
      setMessage({ kind: 'err', text: '這張照片讀不進來，換一張試試' });
    }
  }

  async function runScan() {
    if (photos.length === 0) {
      setMessage({ kind: 'err', text: '先拍一張成分標籤的照片' });
      return;
    }
    setScanning(true);
    setMessage(null);
    try {
      const result = await recognizeLabel(photos);
      if (result.brand) setBrand(result.brand);
      if (result.name) setName(result.name);
      if (result.ingredients.length > 0) setIngredientsRaw(result.ingredients.join('、'));
      setGText((prev) => ({ ...prev, ...guaranteedToText(result.guaranteed) }));
      if (result.weightG !== undefined) setWeight(String(result.weightG));
      setSource('ai');
      setMessage({
        kind: 'ok',
        text: '辨識完成，請對照罐頭再檢查一次',
        ...(result.unreadable.length > 0
          ? { hint: `看不清楚的地方：${result.unreadable.join('、')}` }
          : {}),
      });
    } catch (err) {
      if (err instanceof GeminiError) {
        setMessage({ kind: 'err', text: err.message, ...(err.hint ? { hint: err.hint } : {}) });
      } else {
        setMessage({ kind: 'err', text: '辨識失敗', hint: String(err) });
      }
    } finally {
      setScanning(false);
    }
  }

  function applyPaste() {
    const parsed = parsePastedLabel(pasteText);
    if (parsed.ingredients.length > 0) setIngredientsRaw(parsed.ingredients.join('、'));
    setGText((prev) => ({ ...prev, ...guaranteedToText(parsed.guaranteed) }));
    setSource((s) => (s === 'ai' ? s : 'paste'));
    setPasteOpen(false);
    setPasteText('');
    setMessage({
      kind: 'ok',
      text: `拆出 ${parsed.ingredients.length} 項成分`,
      hint: '保證分析值有抓到的會自動填入，其餘請手動補。',
    });
  }

  async function save() {
    if (!cats) return;
    if (!name.trim() && !brand.trim()) {
      setMessage({ kind: 'err', text: '至少填品牌或品名，之後才找得到' });
      return;
    }
    setSaving(true);
    try {
      const id = canId ?? newId();
      const now = Date.now();
      const weightNum = Number(weight.trim());
      const can: Can = {
        id,
        brand: brand.trim(),
        name: name.trim(),
        ...(photos[0] ? { photo: photos[0] } : {}),
        ingredientsRaw: ingredientsRaw.trim(),
        ingredients: items,
        guaranteed: textToGuaranteed(gText),
        foodType: effectiveFoodType,
        ...(weight.trim() !== '' && Number.isFinite(weightNum) && weightNum > 0
          ? { weightG: weightNum }
          : {}),
        source,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(mainProtein.trim() ? { mainProtein: mainProtein.trim() } : {}),
        ...(finished === undefined ? {} : { finished }),
        createdAt,
        updatedAt: now,
      };
      await putCan(can);

      // 只有真的改過的評分才寫入，這樣歷史紀錄才有意義
      const existing = canId ? await getRatingsForCan(canId) : [];
      const latest: Record<string, number> = {};
      for (const r of existing) if (!(r.catId in latest)) latest[r.catId] = r.stars;

      for (const cat of cats) {
        const value = ratings[cat.id] ?? 0;
        if (value <= 0) continue;
        if (latest[cat.id] === value) continue;
        await putRating({
          id: newId(),
          canId: id,
          catId: cat.id,
          stars: value,
          ratedAt: now,
        });
      }

      bumpData();
      navigate(`/can/${id}`, { replace: true });
    } catch (err) {
      setMessage({ kind: 'err', text: '存檔失敗', hint: String(err) });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded || !cats) return <p className="loading">載入中…</p>;

  const hasKey = getApiKey() !== '';

  return (
    <div className="page">
      {/* ── 照片與辨識 ── */}
      <section className="card">
        <h2 className="card-title">標籤照片</h2>
        <div className="photo-row">
          {firstPhotoUrl && <img className="photo-thumb" src={firstPhotoUrl} alt="標籤照片 1" />}
          {secondPhotoUrl && <img className="photo-thumb" src={secondPhotoUrl} alt="標籤照片 2" />}
          {photos.length < 2 && (
            <div className="photo-actions">
              <button type="button" className="btn btn-soft" onClick={() => cameraRef.current?.click()}>
                📷 拍照
              </button>
              <button type="button" className="btn btn-soft" onClick={() => albumRef.current?.click()}>
                🖼 相簿
              </button>
            </div>
          )}
          {photos.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setPhotos([])}>
              清除照片
            </button>
          )}
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void addPhoto(e.target.files?.[0])}
        />
        <input
          ref={albumRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void addPhoto(e.target.files?.[0])}
        />
        <p className="muted-note">建議拍兩張：一張成分表、一張正面品名。</p>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={scanning || photos.length === 0}
            onClick={() => void runScan()}
          >
            {scanning ? '辨識中…' : '✨ AI 辨識標籤'}
          </button>
          <button type="button" className="btn btn-soft" onClick={() => setPasteOpen(true)}>
            📋 貼上文字
          </button>
        </div>
        {!hasKey && (
          <p className="muted-note">
            還沒設定 Gemini API key，AI 辨識會失敗。可以先用「貼上文字」，或到
            <a href="#/settings"> 設定 </a>
            填 key。
          </p>
        )}
        {message && (
          <div className={`inline-msg inline-${message.kind}`}>
            <strong>{message.text}</strong>
            {message.hint && <span>{message.hint}</span>}
          </div>
        )}
      </section>

      {/* ── 基本資料 ── */}
      <section className="card">
        <h2 className="card-title">基本資料</h2>
        <label className="field">
          <span>品牌</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="例：汪喵星球" />
        </label>
        <label className="field">
          <span>品名／口味</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：鮮雞肉主食罐" />
        </label>
        <label className="field">
          <span>淨重（g）</span>
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
            placeholder="例：165"
          />
        </label>
        <label className="field">
          <span>主要肉類</span>
          <input
            value={mainProtein}
            onChange={(e) => setMainProtein(e.target.value)}
            placeholder={autoMeat ? `自動判定：${autoMeat}` : '成分裡找不到，可以自己填'}
          />
          <p className="muted-note">
            {mainProtein.trim()
              ? '這是手動指定的，清空就會改回依成分自動判定。'
              : '留空＝依成分自動判定，之後補了新的肉類別名也會自動跟著更新。'}
          </p>
        </label>
        <div className="field">
          <span>類型</span>
          <div className="seg">
            {(['staple', 'supplement', 'unknown'] as FoodType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`seg-btn${effectiveFoodType === t ? ' seg-on' : ''}`}
                onClick={() => setFoodTypeOverride(t)}
              >
                {FOOD_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {foodTypeOverride === null && (
            <p className="muted-note">
              依成分自動判定為「{FOOD_TYPE_LABEL[analysis.suggestedFoodType]}」，可以手動改。
            </p>
          )}
        </div>
      </section>

      {/* ── 成分 ── */}
      <section className="card">
        <h2 className="card-title">成分</h2>
        <textarea
          className="textarea"
          rows={5}
          value={ingredientsRaw}
          onChange={(e) => setIngredientsRaw(e.target.value)}
          placeholder="用「、」或逗號分隔，例：雞肉、雞肝、鮪魚、牛磺酸、維生素E"
        />
        <p className="muted-note">拆出 {items.length} 項</p>
        <IngredientChips rules={analysis.matched} />
      </section>

      {/* ── 保證分析值 ── */}
      <section className="card">
        <h2 className="card-title">保證分析值（%）</h2>
        <div className="grid-2">
          {GUARANTEED_FIELDS.filter((f) => f.primary || showMore).map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <input
                value={gText[f.key] ?? ''}
                onChange={(e) => setGText((prev) => ({ ...prev, [f.key]: e.target.value }))}
                inputMode="decimal"
                placeholder="—"
              />
            </label>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setShowMore((v) => !v)}>
          {showMore ? '收起其他欄位' : '＋ 牛磺酸、磷、鈣、鈉'}
        </button>
      </section>

      {/* ── 評分 ── */}
      <section className="card">
        <h2 className="card-title">誰賞臉？</h2>
        <CatRatingRow
          cats={cats}
          values={ratings}
          onChange={(catId, stars) => setRatings((prev) => ({ ...prev, [catId]: stars }))}
        />
        <p className="muted-note">點星星左半是半顆；再點一次同樣的分數會取消。</p>
      </section>

      {/* ── 備註 ── */}
      <section className="card">
        <h2 className="card-title">備註</h2>
        <textarea
          className="textarea"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例：質地偏硬、加水後暮暮才肯吃"
        />
      </section>

      <div className="btn-row btn-row-sticky">
        <button type="button" className="btn btn-ghost" onClick={() => back()}>
          取消
        </button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? '儲存中…' : isEdit ? '儲存修改' : '存進罐頭庫'}
        </button>
      </div>

      {pasteOpen && (
        <div className="sheet-backdrop" onClick={() => setPasteOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">貼上標籤文字</h2>
            <p className="muted-note">
              iPhone 用法：在相簿長按照片上的文字 →「即時文字」→ 全選複製，回來貼在這裡。
            </p>
            <textarea
              className="textarea"
              rows={8}
              autoFocus
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="成分：雞肉、雞肝… 粗蛋白 10% 以上 水分 82% 以下"
            />
            <div className="btn-row">
              <button type="button" className="btn btn-ghost" onClick={() => setPasteOpen(false)}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={applyPaste}>
                解析並填入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
