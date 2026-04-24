import { PalmTree } from './icons/PalmTree';
import { Rose } from './icons/Rose';

export type UserId = 'max' | 'karo';

export const USERS: Record<UserId, { name: string; tone: 'forest' | 'rose' }> = {
  max: { name: 'Max', tone: 'forest' },
  karo: { name: 'Karo', tone: 'rose' },
};

export function Avatar({
  user,
  size = 32,
  title,
}: {
  user: UserId;
  size?: number;
  title?: string;
}) {
  const { name, tone } = USERS[user];
  return (
    <span
      className={`avatar ${tone}`}
      style={{ width: size, height: size }}
      title={title ?? name}
      aria-label={name}
    >
      {user === 'max' ? (
        <PalmTree size={Math.round(size * 0.5)} />
      ) : (
        <Rose size={Math.round(size * 0.5)} />
      )}
    </span>
  );
}
