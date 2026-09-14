import {
  INGREDIENT_RULES,
  MEAT_GROUPS,
  SEVERITY_ORDER,
  type IngredientRule,
  type MeatGroup,
} from '../data/ingredientRules';
import type { Can, FoodType, Guaranteed } from './types';

/** 全形轉半形 + 小寫 + 去空白，讓關鍵字比對不受排版影響。 */
export function normalize(s: string): string {
  return s
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[　]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}

const SPLIT_RE = /[、,;；/／·・|｜\n\r]+/;

/**
 * 標籤上成分表後面通常接著保證分析值、淨重、保存期限這些段落。
 * 不先切掉的話，「粗蛋白 10.5% 以上…」會被當成一項成分。
 */
const STOP_MARKERS = [
  '保證分析',
  '保証分析',
  '營養分析',
  '營養標示',
  '成分分析',
  '粗蛋白',
  '粗脂肪',
  'guaranteed analysis',
  'guaranteedanalysis',
  '淨重',
  '内容量',
  '內容量',
  '保存期限',
  '有效期限',
  '原產地',
  '製造商',
  '餵食建議',
  '建議餵食',
];

function cutBeforeAnalysis(raw: string): string {
  const lower = raw.toLowerCase();
  let cut = raw.length;
  for (const marker of STOP_MARKERS) {
    const i = lower.indexOf(marker.toLowerCase());
    if (i !== -1 && i < cut) cut = i;
  }
  // 標記出現在最前面代表這段根本不是成分表，就別切了
  return cut < 4 ? raw : raw.slice(0, cut);
}

/** 看起來像數值標示而不是成分的項目（例如「磷 0.18%」「1500mg」）。 */
function looksLikeMeasurement(s: string): boolean {
  return /\d\s*(%|％|mg|kg|g\b|ppm)/i.test(s) || /^\d/.test(s);
}

/** 把一整段成分文字拆成單項。 */
export function splitIngredients(raw: string): string[] {
  return cutBeforeAnalysis(raw)
    .replace(/^[\s\S]{0,20}?(成分|原料|材料|ingredients?)\s*[:：]/i, '')
    .split(SPLIT_RE)
    .map((s) => s.trim().replace(/^[.。·　]+|[.。]+$/g, ''))
    .filter((s) => s.length > 0 && s.length <= 40 && !looksLikeMeasurement(s));
}

function matchRules(item: string): IngredientRule[] {
  const n = normalize(item);
  const hits: IngredientRule[] = [];
  for (const rule of INGREDIENT_RULES) {
    if (rule.exclude?.some((ex) => n.includes(normalize(ex)))) continue;
    if (rule.patterns.some((p) => n.includes(normalize(p)))) hits.push(rule);
  }
  return hits;
}

/**
 * 這一項成分屬於哪一群肉；不是肉就回 undefined。
 * 判斷「第一成分好不好」跟「這罐主要是什麼肉」共用這一個，兩邊才不會各說各話。
 */
export function matchMeatGroup(item: string): MeatGroup | undefined {
  const n = normalize(item);
  return MEAT_GROUPS.find(
    (g) =>
      !g.exclude?.some((ex) => n.includes(normalize(ex))) &&
      g.patterns.some((p) => n.includes(normalize(p))),
  );
}

export type FirstIngredientKind = 'named-meat' | 'vague' | 'non-meat' | 'unknown';

export interface TaggedItem {
  text: string;
  rules: IngredientRule[];
}

export interface IngredientAnalysis {
  items: TaggedItem[];
  /** 去重後、依嚴重度排序的規則命中 */
  matched: IngredientRule[];
  hasTaurine: boolean;
  hasVitamins: boolean;
  firstIngredient?: string;
  firstIngredientKind: FirstIngredientKind;
  suggestedFoodType: FoodType;
}

export function analyzeIngredients(items: string[]): IngredientAnalysis {
  const tagged: TaggedItem[] = items.map((text) => ({ text, rules: matchRules(text) }));

  const seen = new Map<string, IngredientRule>();
  for (const t of tagged) for (const r of t.rules) seen.set(r.id, r);
  const matched = [...seen.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const hasTaurine = seen.has('taurine');
  const hasVitamins = seen.has('vitamins');

  const first = tagged[0];
  let firstIngredientKind: FirstIngredientKind = 'unknown';
  if (first) {
    const vague = first.rules.some(
      (r) => r.id === 'vague-meat' || r.id === 'by-product' || r.id === 'meat-meal',
    );
    if (vague) firstIngredientKind = 'vague';
    else if (matchMeatGroup(first.text)) firstIngredientKind = 'named-meat';
    else firstIngredientKind = 'non-meat';
  }

  // 有牛磺酸又有維礦，才敢算主食罐；否則當副食罐（不能長期單餵）。
  let suggestedFoodType: FoodType = 'unknown';
  if (tagged.length > 0) suggestedFoodType = hasTaurine && hasVitamins ? 'staple' : 'supplement';

  return {
    items: tagged,
    matched,
    hasTaurine,
    hasVitamins,
    ...(first ? { firstIngredient: first.text } : {}),
    firstIngredientKind,
    suggestedFoodType,
  };
}

/* ── 主要肉類 ─────────────────────────────────────────── */

/**
 * 這罐主要是什麼肉。
 *
 * 跟成分分析同一個原則：**即時算、不入庫**，這樣補了新的肉類別名之後，
 * 舊罐頭不用重新編輯就會自動套用。人工覆寫（`mainProtein`）永遠優先，
 * 給推導不出來或推錯的罐頭用。
 *
 * 判斷方式是「成分表由前往後，第一個命中肉群的就是主要肉類」——
 * 成分表本來就依含量排序，排最前面的肉自然是主角。
 */
export function mainProteinOf(can: Pick<Can, 'ingredients' | 'mainProtein'>): string | undefined {
  const override = can.mainProtein?.trim();
  if (override) return override;

  for (const item of can.ingredients) {
    const group = matchMeatGroup(item);
    if (group) return group.label;
  }
  return undefined;
}

/* ── 保證分析值解析 ───────────────────────────────────── */

const NUTRIENT_ALIASES: Array<{ key: keyof Guaranteed; aliases: string[] }> = [
  { key: 'protein', aliases: ['粗蛋白質', '粗蛋白', '蛋白質', 'crudeprotein', 'protein'] },
  { key: 'fat', aliases: ['粗脂肪', '脂肪', '脂質', 'crudefat', 'fat'] },
  {
    key: 'fiber',
    aliases: ['粗纖維', '粗繊維', '纖維', 'crudefiber', 'crudefibre', 'fiber', 'fibre'],
  },
  { key: 'ash', aliases: ['粗灰分', '灰分', 'crudeash', 'ash'] },
  { key: 'moisture', aliases: ['水分', '水份', 'moisture'] },
  { key: 'taurine', aliases: ['牛磺酸', 'taurine'] },
  { key: 'phosphorus', aliases: ['磷含量', '磷', 'phosphorus'] },
  { key: 'calcium', aliases: ['鈣含量', '鈣', 'calcium'] },
  { key: 'sodium', aliases: ['鈉含量', '鈉', 'sodium'] },
];

/** 抓數字 + 單位；mg/kg、ppm 會換算成 %。 */
function readNumberAfter(text: string, at: number): number | undefined {
  const window = text.slice(at, at + 26);
  const m = window.match(/^[^0-9]{0,12}(\d+(?:\.\d+)?)(%|mg\/kg|mg\/100g|ppm|g\/kg)?/);
  if (!m || m[1] === undefined) return undefined;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return undefined;
  switch (m[2]) {
    case 'mg/kg':
    case 'ppm':
      return value / 10000;
    case 'g/kg':
      return value / 10;
    case 'mg/100g':
      return value / 1000;
    default:
      return value;
  }
}

/**
 * 從一段文字（OCR 或手貼）抓出保證分析值。
 * 抓不到就不填，寧可讓使用者手動補，也不要猜。
 */
export function parseGuaranteed(raw: string): Guaranteed {
  const text = normalize(raw);
  const out: Guaranteed = {};
  for (const { key, aliases } of NUTRIENT_ALIASES) {
    for (const alias of aliases) {
      if (out[key] !== undefined) break;
      const a = normalize(alias);
      // 同一個詞可能出現在成分表也出現在保證分析（例如「牛磺酸」），
      // 所以每個位置都試，取第一個後面真的接得到數字的。
      for (let idx = text.indexOf(a); idx !== -1; idx = text.indexOf(a, idx + 1)) {
        const value = readNumberAfter(text, idx + a.length);
        // 百分比欄位超過 100 幾乎都是誤抓（例如抓到條碼或重量）
        if (value !== undefined && value >= 0 && value <= 100) {
          out[key] = value;
          break;
        }
      }
    }
  }
  return out;
}

/** 貼上文字時一次做完：拆成分 + 抓保證值。 */
export function parsePastedLabel(raw: string): {
  ingredients: string[];
  guaranteed: Guaranteed;
} {
  return { ingredients: splitIngredients(raw), guaranteed: parseGuaranteed(raw) };
}
