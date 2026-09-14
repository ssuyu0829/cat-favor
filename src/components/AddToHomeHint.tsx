import { useState } from 'react';

const DISMISS_KEY = 'cat-favor.a2hs-dismissed';

function isStandalone(): boolean {
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * iOS Safari 會清掉「7 天沒開啟」網站的 IndexedDB，
 * 但加到主畫面之後就不會 —— 所以第一次開一定要提醒。
 */
export default function AddToHomeHint() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1',
  );

  if (dismissed || isStandalone() || !isIOS()) return null;

  return (
    <div className="a2hs">
      <p>
        <strong>先加到主畫面</strong>
        ：點下方的分享鍵 <span aria-hidden="true">􀈂</span> →「加入主畫面」。
        這樣資料才不會被 iOS 在 7 天後清掉。
      </p>
      <button
        type="button"
        className="btn btn-ghost btn-tiny"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
      >
        知道了
      </button>
    </div>
  );
}
