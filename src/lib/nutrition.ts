import type { Guaranteed } from './types';

/**
 * 保證分析值是「以上／以下」的區間值，不是實測值。
 * 所有推算出來的數字在 UI 上都要標明是估算，不要當精確值用。
 */

/** 灰分常常沒標；缺的時候用濕食典型值代入，並在 UI 標示。 */
const ASSUMED_ASH = 2.5;

export interface NutritionResult {
  /** 乾物比（%），需要水分才能算 */
  dm?: {
    protein?: number;
    fat?: number;
    fiber?: number;
    ash?: number;
    nfe?: number;
  };
  /** 濕基（原樣）碳水估算 % */
  nfeAsFed?: number;
  /** 估算熱量 kcal/100g（修正 Atwater） */
  kcalPer100g?: number;
  /** 整罐熱量，需要 weightG */
  kcalPerCan?: number;
  /** 磷 mg / 100 kcal（腎臟飲食常用指標） */
  phosphorusPer100kcal?: number;
  /** 無法計算的原因，逐條顯示給使用者 */
  warnings: string[];
  /** 碳水估算有沒有用到假設的灰分 */
  assumedAsh: boolean;
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function analyzeNutrition(g: Guaranteed, weightG?: number): NutritionResult {
  const warnings: string[] = [];
  const result: NutritionResult = { warnings, assumedAsh: false };

  const { protein, fat, fiber, moisture } = g;
  let ash = g.ash;

  if (ash === undefined) {
    ash = ASSUMED_ASH;
    result.assumedAsh = true;
  }

  /* ── 碳水（NFE）：100 減去其他成分 ── */
  if (protein !== undefined && fat !== undefined && moisture !== undefined) {
    const fib = fiber ?? 0;
    if (fiber === undefined) warnings.push('標籤沒有粗纖維，碳水估算以 0 代入');
    const nfe = 100 - protein - fat - fib - ash - moisture;
    if (nfe < 0) {
      result.nfeAsFed = 0;
      warnings.push('保證分析值加總超過 100%（因為都是「以上／以下」的區間值），碳水估算不可靠');
    } else {
      result.nfeAsFed = round(nfe);
    }
  } else {
    warnings.push('缺粗蛋白、粗脂肪或水分，無法估算碳水');
  }

  /* ── 乾物比 ── */
  if (moisture === undefined) {
    warnings.push('標籤沒有水分，無法換算乾物比');
  } else if (moisture >= 100) {
    warnings.push('水分標示異常（≥100%），無法換算乾物比');
  } else {
    const dryPart = 100 - moisture;
    const toDM = (v?: number) => (v === undefined ? undefined : round((v / dryPart) * 100));
    result.dm = {
      protein: toDM(protein),
      fat: toDM(fat),
      fiber: toDM(fiber),
      ash: toDM(g.ash),
      nfe: toDM(result.nfeAsFed),
    };
  }

  /* ── 熱量（修正 Atwater，濕食常用）── */
  if (protein !== undefined && fat !== undefined && result.nfeAsFed !== undefined) {
    const kcal = 3.5 * protein + 8.5 * fat + 3.5 * result.nfeAsFed;
    result.kcalPer100g = round(kcal, 0);
    if (weightG !== undefined && weightG > 0) {
      result.kcalPerCan = round((kcal * weightG) / 100, 0);
    }
  }

  /* ── 磷（腎臟參考）── */
  if (g.phosphorus !== undefined && result.kcalPer100g && result.kcalPer100g > 0) {
    const mgPer100g = g.phosphorus * 1000;
    result.phosphorusPer100kcal = round((mgPer100g / result.kcalPer100g) * 100, 0);
  }

  return result;
}

/** 給 UI 用的一句話評語：乾物碳水偏高與否。 */
export function carbComment(dmNfe?: number): { level: 'good' | 'ok' | 'high'; text: string } | null {
  if (dmNfe === undefined) return null;
  if (dmNfe <= 10) return { level: 'good', text: '乾物碳水低，接近貓的天然食性' };
  if (dmNfe <= 20) return { level: 'ok', text: '乾物碳水中等，日常吃可以接受' };
  return { level: 'high', text: '乾物碳水偏高，澱粉/膠質填充可能較多' };
}

/** 乾物蛋白的粗略分級（AAFCO 成貓最低 26% DM）。 */
export function proteinComment(
  dmProtein?: number,
): { level: 'good' | 'ok' | 'high'; text: string } | null {
  if (dmProtein === undefined) return null;
  if (dmProtein < 26) return { level: 'high', text: '乾物蛋白低於 AAFCO 成貓最低標準 26%' };
  if (dmProtein < 40) return { level: 'ok', text: '乾物蛋白達標，屬中等' };
  return { level: 'good', text: '乾物蛋白充足' };
}
