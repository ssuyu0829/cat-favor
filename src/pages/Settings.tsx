import { useEffect, useRef, useState } from 'react';
import CatAvatar from '../components/CatAvatar';
import { BackupError, exportBackup, importBackup } from '../lib/backup';
import { getMeta, putCat } from '../lib/db';
import {
  DEFAULT_MODEL,
  GeminiError,
  getApiKey,
  getModel,
  listModels,
  setApiKey,
  setModel,
} from '../lib/gemini';
import { bumpData, useCans, useCats, useRatings } from '../lib/store';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Settings() {
  const { data: cats } = useCats();
  const { data: cans } = useCans();
  const { data: ratings } = useRatings();

  const [key, setKey] = useState(getApiKey());
  const [showKey, setShowKey] = useState(false);
  const [model, setModelState] = useState(getModel());
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getMeta<number>('lastBackupAt').then((v) => setLastBackup(v ?? null));
  }, [cans, ratings]);

  function saveKey(value: string) {
    setKey(value);
    setApiKey(value.trim());
  }

  async function loadModels() {
    setBusy('models');
    setMsg(null);
    try {
      const list = await listModels();
      setModels(list);
      setMsg({ kind: 'ok', text: `找到 ${list.length} 個可用模型` });
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof GeminiError ? `${err.message}${err.hint ? `：${err.hint}` : ''}` : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  async function doExport() {
    setBusy('export');
    setMsg(null);
    try {
      const how = await exportBackup();
      setMsg({
        kind: 'ok',
        text: how === 'shared' ? '已送到儲存面板，選「儲存到檔案」→ iCloud 雲碟' : '備份檔已下載',
      });
      setLastBackup(Date.now());
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMsg({ kind: 'err', text: '已取消匯出' });
      } else {
        setMsg({ kind: 'err', text: `匯出失敗：${String(err)}` });
      }
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File | undefined) {
    if (!file) return;
    if (importMode === 'replace' && !window.confirm('覆蓋匯入會清掉目前所有資料，確定嗎？')) return;
    setBusy('import');
    setMsg(null);
    try {
      const result = await importBackup(file, importMode);
      bumpData();
      setMsg({
        kind: 'ok',
        text: `匯入完成：${result.cans} 罐、${result.ratings} 筆評分${result.suppLogs === undefined ? '' : `、${result.suppLogs} 筆保健品紀錄`}`,
      });
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof BackupError ? err.message : `匯入失敗：${String(err)}`,
      });
    } finally {
      setBusy(null);
      if (importRef.current) importRef.current.value = '';
    }
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">資料備份</h2>
        <p className="muted-note">
          資料存在這台手機的瀏覽器裡。<strong>請把這個網站加到主畫面</strong>
          ，否則 iOS 可能在 7 天沒開啟後清掉資料。定期匯出一份到 iCloud 雲碟最保險。
        </p>
        <p className="muted-note">
          目前有 {cans?.length ?? 0} 罐、{ratings?.length ?? 0} 筆評分。
          {lastBackup ? `上次備份：${formatTime(lastBackup)}` : '還沒備份過。'}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy === 'export'}
            onClick={() => void doExport()}
          >
            {busy === 'export' ? '匯出中…' : '⬆️ 匯出備份'}
          </button>
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy === 'import'}
            onClick={() => importRef.current?.click()}
          >
            ⬇️ 匯入備份
          </button>
        </div>
        <div className="seg">
          {(['merge', 'replace'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`seg-btn${importMode === m ? ' seg-on' : ''}`}
              onClick={() => setImportMode(m)}
            >
              {m === 'merge' ? '合併匯入' : '覆蓋匯入'}
            </button>
          ))}
        </div>
        <p className="muted-note">
          合併：同一罐以備份檔為準，其餘保留。覆蓋：清空後完全還原成備份檔的樣子。
        </p>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void doImport(e.target.files?.[0])}
        />
      </section>

      <section className="card">
        <h2 className="card-title">AI 辨識設定</h2>
        <p className="muted-note">
          到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>{' '}
          免費申請一組 key（不用綁信用卡），貼在下面。key 只存在這台裝置。
          <br />
          註：Gemini Pro 訂閱是給 Gemini App 用的，不含 API 額度，還是要另外申請 key。
        </p>
        <label className="field">
          <span>API key</span>
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => saveKey(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
          />
        </label>
        <button type="button" className="btn btn-ghost btn-tiny" onClick={() => setShowKey((v) => !v)}>
          {showKey ? '隱藏' : '顯示'} key
        </button>

        <label className="field">
          <span>模型</span>
          <input
            value={model}
            onChange={(e) => {
              setModelState(e.target.value);
              setModel(e.target.value.trim());
            }}
            placeholder={DEFAULT_MODEL}
            autoComplete="off"
          />
        </label>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy === 'models'}
            onClick={() => void loadModels()}
          >
            {busy === 'models' ? '查詢中…' : '查可用模型'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setModelState(DEFAULT_MODEL);
              setModel(DEFAULT_MODEL);
            }}
          >
            回預設
          </button>
        </div>
        {models.length > 0 && (
          <div className="model-list">
            {models
              .filter((m) => m.includes('flash') || m.includes('lite'))
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`pill${m === model ? ' pill-on' : ''}`}
                  onClick={() => {
                    setModelState(m);
                    setModel(m);
                  }}
                >
                  {m}
                </button>
              ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">貓咪</h2>
        {cats?.map((cat) => (
          <div className="cat-edit" key={cat.id}>
            <CatAvatar cat={cat} size={34} />
            <input
              className="cat-edit-name"
              value={cat.name}
              onChange={(e) => {
                void putCat({ ...cat, name: e.target.value }).then(bumpData);
              }}
            />
            <input
              className="cat-edit-color"
              type="color"
              value={cat.color}
              onChange={(e) => {
                void putCat({ ...cat, color: e.target.value }).then(bumpData);
              }}
            />
          </div>
        ))}
      </section>

      {msg && (
        <div className={`inline-msg inline-${msg.kind}`}>
          <strong>{msg.text}</strong>
        </div>
      )}

      <section className="card">
        <h2 className="card-title">關於</h2>
        <p className="muted-note">
          Cat Favor 的成分標記是自己整理的參考規則，不是獸醫建議。
          乾物比與熱量都是用保證分析值（「以上／以下」的區間值）推算的估算值，
          真的有健康疑慮還是要問醫生。
        </p>
      </section>
    </div>
  );
}
