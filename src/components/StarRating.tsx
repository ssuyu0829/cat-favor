import { useId } from 'react';

const STAR_PATH =
  'M12 2.6c.6 0 1.15.35 1.42.9l2.15 4.36 4.81.7c.6.09 1.1.51 1.29 1.09.19.58.03 1.21-.4 1.63l-3.48 3.39.82 4.79c.1.6-.14 1.21-.64 1.57-.5.36-1.15.4-1.69.12L12 18.88l-4.3 2.26c-.54.28-1.19.24-1.69-.12-.5-.36-.74-.97-.64-1.57l.82-4.79-3.48-3.39c-.43-.42-.59-1.05-.4-1.63.19-.58.69-1 1.29-1.09l4.81-.7 2.15-4.36c.27-.55.82-.9 1.42-.9z';

function Star({ fill, color, size }: { fill: number; color: string; size: number }) {
  const id = useId().replace(/:/g, '');
  const pct = `${Math.round(fill * 100)}%`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="star-svg">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset={pct} stopColor={color} />
          <stop offset={pct} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d={STAR_PATH}
        fill={`url(#${id})`}
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity={fill === 0 ? 0.35 : 1}
      />
    </svg>
  );
}

interface Props {
  value: number;
  onChange?: (value: number) => void;
  /** 星星大小（px），互動用的預設 34，唯讀縮圖用 14 */
  size?: number;
  color?: string;
  label?: string;
}

/**
 * 0–5 顆星，可半顆。
 * 點星星左半 = .5，右半 = 整顆；點到已經是的分數會歸零（想取消評分時很好用）。
 */
export default function StarRating({
  value,
  onChange,
  size = 34,
  color = 'var(--amber)',
  label,
}: Props) {
  const readOnly = !onChange;

  function pick(e: React.MouseEvent<HTMLButtonElement>, index: number) {
    if (!onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const next = index + (ratio <= 0.5 ? 0.5 : 1);
    onChange(Math.abs(next - value) < 0.01 ? 0 : next);
  }

  return (
    <div
      className={`stars${readOnly ? ' stars-readonly' : ''}`}
      role={readOnly ? 'img' : 'group'}
      aria-label={label ? `${label} ${value} 顆星` : `${value} 顆星`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, value - i));
        return readOnly ? (
          <Star key={i} fill={fill} color={color} size={size} />
        ) : (
          <button
            key={i}
            type="button"
            className="star-btn"
            style={{ width: size + 6, height: size + 6 }}
            onClick={(e) => pick(e, i)}
            aria-label={`給 ${i + 1} 顆星`}
          >
            <Star fill={fill} color={color} size={size} />
          </button>
        );
      })}
    </div>
  );
}
