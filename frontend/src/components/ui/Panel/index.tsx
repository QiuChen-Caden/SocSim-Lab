import type { ReactNode } from 'react';

export interface PanelProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'nested';
  className?: string;
  style?: React.CSSProperties;
}

export function Panel({ title, actions, children, variant = 'default', className = '' }: PanelProps) {
  const variantClass = variant === 'nested' ? 'panel panel--nested' : 'panel';

  return (
    <div className={`${variantClass} ${className}`}>
      <div className="panel__hd">
        <div className="panel__title">{title}</div>
        {actions && <div className="row">{actions}</div>}
      </div>
      <div className="panel__bd">{children}</div>
    </div>
  );
}
