export type PersonTone = 'me' | 'partner';

const TONE_CLASSES: Record<PersonTone, string> = {
  me: 'bg-me-soft text-me',
  partner: 'bg-partner-soft text-partner',
};

const SIZE_CLASSES = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
} as const;

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

interface AvatarProps {
  name: string;
  tone: PersonTone;
  size?: keyof typeof SIZE_CLASSES;
  /** Decorative avatars next to a visible name should not repeat it to screen readers. */
  decorative?: boolean;
}

export function Avatar({ name, tone, size = 'md', decorative = false }: AvatarProps) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]}`}
    >
      {initialsOf(name)}
    </span>
  );
}
