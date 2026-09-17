import { RATING_LABEL, type Rating } from '../db/types';

interface Props {
  onRate: (r: Rating) => void;
  disabled?: boolean;
  /** 各评分对应的下次间隔（天），用于按钮下方提示 */
  previews?: Record<Rating, number>;
}

const HINT: Record<Rating, string> = { 0: '重来', 1: '再看', 2: '进阶', 3: '跳档' };

export function RatingBar({ onRate, disabled, previews }: Props) {
  const ratings: Rating[] = [0, 1, 2, 3];
  return (
    <div className="rating-bar">
      {ratings.map((r) => (
        <button key={r} type="button" className={`rating-btn rating-${r}`} disabled={disabled} onClick={() => onRate(r)}>
          {RATING_LABEL[r]}
          <small>{previews ? `${previews[r]} 天后` : HINT[r]}</small>
        </button>
      ))}
    </div>
  );
}
