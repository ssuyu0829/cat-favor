import type { Cat } from '../lib/types';

interface Props {
  cat: Cat;
  size?: number;
  /** 顯示名字（小圖示時通常不用） */
  showName?: boolean;
}

/** 圓臉 + 三角耳的小貓頭像，顏色來自每隻貓自己的代表色。 */
export default function CatAvatar({ cat, size = 36, showName = false }: Props) {
  const style = {
    '--cat-color': cat.color,
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
  } as React.CSSProperties;

  return (
    <span className="cat-avatar-wrap">
      <span className="cat-avatar" style={style} aria-hidden="true">
        {cat.name.slice(0, 1)}
      </span>
      {showName && <span className="cat-avatar-name">{cat.name}</span>}
    </span>
  );
}
