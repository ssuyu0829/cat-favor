/** 資料型別 —— 這些形狀同時是 IndexedDB 與備份 JSON 的格式，改動要記得升 DB_VERSION。 */

/** 保證分析值，單位一律「%」。標籤上沒寫的欄位就 undefined，不要填 0。 */
export interface Guaranteed {
  protein?: number; // 粗蛋白
  fat?: number; // 粗脂肪
  fiber?: number; // 粗纖維
  ash?: number; // 粗灰分
  moisture?: number; // 水分
  taurine?: number; // 牛磺酸（有些標 mg/kg，parse 時換算成 %）
  phosphorus?: number; // 磷
  calcium?: number; // 鈣
  sodium?: number; // 鈉
}

export type FoodType = 'staple' | 'supplement' | 'unknown';
export type CanSource = 'ai' | 'paste' | 'manual';

export interface Can {
  id: string;
  brand: string;
  name: string;
  /** 壓縮後的縮圖（長邊 ≤1280），存 Blob 直接進 IndexedDB */
  photo?: Blob;
  /** 原始成分文字，永遠保留：規則庫更新後可以重新解析 */
  ingredientsRaw: string;
  /** 拆解後的成分陣列，順序即標籤上的順序 */
  ingredients: string[];
  guaranteed: Guaranteed;
  /** 主食罐 / 副食罐；unknown 表示資訊不足以判斷 */
  foodType: FoodType;
  /** 每罐重量（g），用來估算單罐熱量，可留空 */
  weightG?: number;
  source: CanSource;
  notes?: string;
  /** 貓有沒有把這罐吃完（不分貓，整罐一個狀態）；undefined = 還沒記 */
  finished?: boolean;
  /** 主要肉類的人工覆寫；留空就從成分即時推導 */
  mainProtein?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Rating {
  id: string;
  canId: string;
  catId: string;
  /** 0–5，step 0.5 */
  stars: number;
  ratedAt: number;
  note?: string;
}

export interface Cat {
  id: string;
  name: string;
  /** hex 色碼，用於頭像與圖表 */
  color: string;
  order: number;
}

/** 每天吃的保健品（五隻貓吃一樣的，不分貓）。 */
export interface Supplement {
  id: string;
  name: string;
  order: number;
  /** 停用：從打勾清單藏起來，但不刪，歷史紀錄才不會變孤兒 */
  archived?: boolean;
  createdAt: number;
}

/** 某天某種保健品餵過了。沒有這筆＝那天沒記。 */
export interface SuppLog {
  /** `${date}|${suppId}`：同一天同一種天生只有一筆 */
  id: string;
  /** 本地日期 YYYY-MM-DD */
  date: string;
  suppId: string;
  at: number;
}

/** 匯出備份的檔案格式 */
export interface BackupFile {
  app: 'cat-favor';
  version: number;
  exportedAt: number;
  cats: Cat[];
  cans: Array<Omit<Can, 'photo'> & { photoDataUrl?: string }>;
  ratings: Rating[];
  /** v2 起才有；舊備份沒有這兩欄 */
  supplements?: Supplement[];
  suppLogs?: SuppLog[];
}
