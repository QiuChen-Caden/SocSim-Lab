import type { StepTabKey } from '../../../../types';

interface SubTabsProps {
  tabs: { key: StepTabKey; label: string }[];
  active: StepTabKey;
  onChange: (key: StepTabKey) => void;
}

export function SubTabs({ tabs, active, onChange }: SubTabsProps) {
  return (
    <div className="subtabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`subtab ${active === tab.key ? 'subtab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
