import type { Cat } from '../lib/types';
import CatAvatar from './CatAvatar';
import StarRating from './StarRating';

interface Props {
  cats: Cat[];
  values: Record<string, number>;
  onChange: (catId: string, stars: number) => void;
}

/** 五隻貓一次打完的評分區塊。 */
export default function CatRatingRow({ cats, values, onChange }: Props) {
  return (
    <div className="rating-list">
      {cats.map((cat) => (
        <div className="rating-row" key={cat.id}>
          <div className="rating-who">
            <CatAvatar cat={cat} size={34} />
            <span className="rating-name">{cat.name}</span>
          </div>
          <StarRating
            value={values[cat.id] ?? 0}
            onChange={(v) => onChange(cat.id, v)}
            color={cat.color}
            label={cat.name}
          />
        </div>
      ))}
    </div>
  );
}
