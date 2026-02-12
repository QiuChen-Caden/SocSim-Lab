import type { Step } from '../../../../types';

interface StepNavigationProps {
  current: Step;
  onChange: (step: Step) => void;
}

const steps: { key: Step; label: string; num: number }[] = [
  { key: 'design', label: 'Design 设计', num: 1 },
  { key: 'run', label: 'Run 运行', num: 2 },
  { key: 'intervene', label: 'Intervene 干预', num: 3 },
  { key: 'analyze', label: 'Analyze 分析', num: 4 },
];

export function StepNavigation({ current, onChange }: StepNavigationProps) {
  return (
    <div className="row">
      {steps.map((step) => (
        <button
          key={step.key}
          className={`btn ${current === step.key ? 'btn--primary' : ''}`}
          onClick={() => onChange(step.key)}
        >
          {step.num} {step.label}
        </button>
      ))}
    </div>
  );
}
