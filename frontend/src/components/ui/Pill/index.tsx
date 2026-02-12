import type { ReactNode } from 'react';

export interface PillProps {
  variant?: 'default' | 'ok' | 'warn' | 'danger' | 'info';
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Pill({ variant = 'default', children, className = '' }: PillProps) {
  const variantClass = {
    default: 'pill',
    ok: 'pill pill--ok',
    warn: 'pill pill--warn',
    danger: 'pill pill--danger',
    info: 'pill pill--info',
  }[variant];

  return <span className={`${variantClass} ${className}`}>{children}</span>;
}
