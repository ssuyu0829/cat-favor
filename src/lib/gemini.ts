import { blobToBase64 } from './image';
import type { Guaranteed } from './types';

/**
 * Gemini 辨識罐頭標籤。
 *
 * 這是純前端 App，沒有後端可以藏 key，所以 key 存在使用者自己的瀏覽器裡，
 * 由瀏覽器直接呼叫 Google。個人自用沒問題，但不要把這個網站分享給不認識的人共用同一把 key。
 *
 * 免費 key 申請：https://aistudio.google.com/apikey
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const KEY_STORAGE = 'cat-favor.gemini-key';
const MODEL_STORAGE = 'cat-favor.gemini-model';

/** 用 -latest 別名，Google 換版號時不用改程式。設定頁可以覆蓋。 */
export const DEFAULT_MODEL = 'gemini-flash-lite-latest';

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? '';
}
export function setApiKey(key: string): void {
  if (key) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
}
export function getModel(): string {
  return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
}
export function setModel(model: string): void {
  if (model) localStorage.setItem(MODEL_STORAGE, model);
  else localStorage.removeItem(MODEL_STORAGE);
}

export interface RecognizedCan {
  brand: string;
  name: string;
  ingredients: string[];
  guaranteed: Guaranteed;
  weightG?: number;
  /** 模型讀不清楚的地方，原樣顯示給使用者確認 */
  unreadable: string[];
}

const PROMPT = `你是貓罐頭標籤的抄寫員。請把圖片上「印出來的字」原樣抄下來，轉成 JSON。

規則（很重要）：
1. 只抄標籤上真的看得到的文字。看不清楚、被反光或被手指擋住就不要寫。
2. 絕對不要根據品牌常識推測、補齊或翻譯成分。沒印出來的成分就是沒有。
3. ingredients 依照標籤上的先後順序，一項一個字串，不要合併也不要重新排序。
4. 括號內的補充（例如「雞肉(含皮)」）保留在同一項裡。
5. guaranteed 各欄位一律換算成「百分比的數字」：
   - 「粗蛋白 10% 以上」→ 10
   - 「牛磺酸 500mg/kg」→ 0.05
   - 標籤沒有的欄位就填 null，不要填 0。
6. weightG 是這罐的淨重（公克）。只寫 ml 的話一樣填數字。沒有就 null。
7. 有任何欄位是因為看不清楚才放棄的，把它記在 unreadable 陣列（用中文簡述，例如「成分表右下角反光」）。
8. brand 是品牌，name 是這一款的口味或品名。抓不到就填空字串。`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    brand: { type: 'STRING' },
    name: { type: 'STRING' },
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    guaranteed: {
      type: 'OBJECT',
      properties: {
        protein: { type: 'NUMBER', nullable: true },
        fat: { type: 'NUMBER', nullable: true },
        fiber: { type: 'NUMBER', nullable: true },
        ash: { type: 'NUMBER', nullable: true },
        moisture: { type: 'NUMBER', nullable: true },
        taurine: { type: 'NUMBER', nullable: true },
        phosphorus: { type: 'NUMBER', nullable: true },
        calcium: { type: 'NUMBER', nullable: true },
        sodium: { type: 'NUMBER', nullable: true },
      },
    },
    weightG: { type: 'NUMBER', nullable: true },
    unreadable: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['brand', 'name', 'ingredients', 'guaranteed', 'unreadable'],
} as const;

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

async function readError(res: Response): Promise<never> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? '';
  } catch {
    /* 回傳不是 JSON 就算了 */
  }
  if (res.status === 400 && /api key/i.test(detail)) {
    throw new GeminiError('API key 無效', '請到設定頁重新貼一次 key，注意頭尾不要有空白。');
  }
  if (res.status === 403) {
    throw new GeminiError(
      'API key 沒有權限',
      '可能是這把 key 限制了來源網域，或專案沒開啟 Generative Language API。',
    );
  }
  if (res.status === 429) {
    throw new GeminiError(
      '今天的免費額度用完了',
      '等一下再試，或改用「貼上文字」：用 iPhone 長按照片的即時文字複製成分再貼進來。',
    );
  }
  if (res.status === 404) {
    throw new GeminiError(
      `找不到模型「${getModel()}」`,
      '到設定頁按「查可用模型」挑一個。',
    );
  }
  throw new GeminiError(`辨識失敗（HTTP ${res.status}）`, detail || undefined);
}

function cleanNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** 把圖片送去辨識。images 可以放 1–2 張（成分面 + 正面品名）。 */
export async function recognizeLabel(images: Blob[]): Promise<RecognizedCan> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new GeminiError('還沒設定 Gemini API key', '到「設定」頁貼上免費申請的 key 就能用了。');
  }
  if (images.length === 0) throw new GeminiError('沒有選到照片');

  const parts: Array<Record<string, unknown>> = [{ text: PROMPT }];
  for (const img of images) {
    parts.push({
      inline_data: { mime_type: img.type || 'image/jpeg', data: await blobToBase64(img) },
    });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/models/${getModel()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      }),
    });
  } catch {
    throw new GeminiError('連不上 Gemini', '檢查一下網路，或改用「貼上文字」。');
  }

  if (!res.ok) await readError(res);

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError('模型沒有回傳內容', '換個角度、光線亮一點再拍一次試試。');

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new GeminiError('模型回傳的格式看不懂', '再試一次，或改用「貼上文字」。');
  }

  const g = (raw.guaranteed ?? {}) as Record<string, unknown>;
  const guaranteed: Guaranteed = {};
  for (const key of [
    'protein',
    'fat',
    'fiber',
    'ash',
    'moisture',
    'taurine',
    'phosphorus',
    'calcium',
    'sodium',
  ] as const) {
    const v = cleanNumber(g[key]);
    if (v !== undefined && v <= 100) guaranteed[key] = v;
  }

  const weightG = cleanNumber(raw.weightG);

  return {
    brand: typeof raw.brand === 'string' ? raw.brand.trim() : '',
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    ingredients: Array.isArray(raw.ingredients)
      ? raw.ingredients.filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      : [],
    guaranteed,
    ...(weightG !== undefined ? { weightG } : {}),
    unreadable: Array.isArray(raw.unreadable)
      ? raw.unreadable.filter((s): s is string => typeof s === 'string')
      : [],
  };
}

/** 設定頁用：列出這把 key 能用、又支援 generateContent 的模型。 */
export async function listModels(): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new GeminiError('還沒設定 API key');
  const res = await fetch(`${API_BASE}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) await readError(res);
  const body = (await res.json()) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean)
    .sort();
}
