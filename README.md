# Cat Favor 🐈

[![CI](https://github.com/ssuyu0829/cat-favor/actions/workflows/ci.yml/badge.svg)](https://github.com/ssuyu0829/cat-favor/actions/workflows/ci.yml)

手機上用的貓罐頭紀錄網站：拍成分標籤 → AI 自動抓成分與保證分析值 → 分析營養 →
記錄焦焦、朝朝、暮暮、咬咬、曉曉五隻貓的喜好度。

純前端 PWA，沒有後端。資料存在手機瀏覽器的 IndexedDB，備份靠一鍵匯出 JSON 到 iCloud 雲碟。

---

## 開發

```bash
npm install
npm run dev        # http://localhost:5173（--host 已開，手機同網段也能連）
npm run build      # 型別檢查 + 打包到 dist/
npm run preview    # 預覽 build 結果
npm run typecheck  # 只跑型別檢查
```

## 部署

`npm run build` 之後把 `dist/` 整包丟到任何靜態託管即可（`base: './'` 已設好，子路徑也能跑）：

- **Cloudflare Pages**：新專案 → Direct Upload → 拖 `dist/`
- **GitHub Pages**：把 `dist/` 推到 `gh-pages` 分支
- **Netlify**：把 `dist/` 拖進 Netlify Drop

需要 HTTPS。原因有兩個：PWA 要 HTTPS 才能安裝，而且
**iOS Safari 會清掉「7 天沒開啟又沒加到主畫面」網站的本機資料**。
所以第一次在 iPhone 上打開後，一定要用分享鍵 →「加入主畫面」。

## Gemini API key

辨識用 Google Gemini 的免費額度，到 [Google AI Studio](https://aistudio.google.com/apikey)
免費申請一組 key（不用綁信用卡），貼進 App 的「設定」頁。key 只存在該裝置的 localStorage。

> Gemini Pro / Google AI Pro **訂閱不含 API 額度**，那是給 Gemini App 用的，還是要另外申請 key。

免費額度大約是 Flash 10 次/分、250 次/天；Flash-Lite 15 次/分、1000 次/天。
模型 ID 會改版，設定頁有「查可用模型」按鈕可以直接列出這把 key 能用的模型。

額度用完或沒網路時，改用「貼上文字」：在 iPhone 相簿長按照片上的文字 →「即時文字」→
複製 → 貼進 App，一樣會自動拆成分、抓保證分析值。

---

## 專案結構

```
src/
├── data/
│   ├── cats.ts              五隻貓的預設值
│   └── ingredientRules.ts   ★ 成分規則庫（想加規則改這裡）
├── lib/
│   ├── db.ts                IndexedDB CRUD
│   ├── types.ts             資料型別（同時是備份 JSON 的格式）
│   ├── nutrition.ts         乾物比 / 碳水估算 / 熱量 / 磷
│   ├── parseIngredients.ts  文字 → 成分陣列 + 保證分析值
│   ├── gemini.ts            拍照辨識
│   ├── backup.ts            匯出 / 匯入（v2 起含保健品）
│   ├── suppDates.ts         保健品的本地日期、連續天數
│   ├── image.ts             照片壓縮
│   ├── router.ts            hash router
│   └── store.ts             資料 hook（寫入後 bumpData() 觸發重讀）
├── components/              StarRating、CatAvatar、CanCard…
├── pages/                   CanList / CanForm / CanDetail / Supplements / CatList / CatDetail / Settings
└── styles/tokens.css        ★ 色票與造型（想換配色改這裡就好）
```

### 想加新的成分規則

編輯 `src/data/ingredientRules.ts`，加一筆：

```ts
{
  id: 'sorbate',
  label: '山梨酸鉀',
  category: '防腐劑',
  severity: 'caution',              // good / info / caution / warn
  patterns: ['山梨酸', 'sorbate'],   // 正規化後用 includes 比對
  exclude: [],                       // 避免包含關係誤判，例如 '米' 要排除 '玉米'
  note: '一句白話說明，會顯示在 chip 點開後。',
}
```

分析結果不存進資料庫，都是即時算的 —— 所以改完規則，舊資料會自動套用新規則。

---

## 免責

成分標記是自己整理的參考規則，不是獸醫建議。乾物比與熱量都是用保證分析值
（「以上／以下」的區間值）推算的估算值，有健康疑慮請諮詢獸醫。
