import { ArrowUp } from 'lucide-react';

export type MoveCardProps = {
  san: string;
  variant: 'parent' | 'child';
  onClick: () => void;
  isEntering?: boolean;
  isFocusPulse?: boolean;
};

export function MoveCard({
  san,
  variant,
  onClick,
  isEntering = false,
  isFocusPulse = false,
}: MoveCardProps) {
  const base =
    'rounded-card px-3 py-2 cursor-pointer select-none font-mono text-left flex items-center gap-2 border-0';
  const variantClass =
    variant === 'parent'
      ? 'bg-surface text-text-muted text-sm'
      : 'bg-surface-elevated text-text text-base hover:brightness-110 transition';
  const enteringClass = isEntering ? 'animate-card-enter' : '';
  const pulseClass = isFocusPulse ? 'animate-focus-pulse' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${variantClass} ${enteringClass} ${pulseClass}`.trim()}
    >
      {variant === 'parent' && <ArrowUp size={14} aria-hidden="true" />}
      <span>{san}</span>
    </button>
  );
}
