import { useState } from 'react';
import { Panel } from '../../components/ui';
import type { Step } from '../../types';
import { StepNavigation } from './components/StepNavigation';
import { DesignTab } from './components/DesignTab';
import { RunTab } from './components/RunTab';
import { InterveneTab } from './components/InterveneTab';
import { AnalyzeTab } from './components/AnalyzeTab';

const stepTitles: Record<Step, string> = {
  design: 'Design 设计',
  run: 'Run 运行',
  intervene: 'Intervene 干预',
  analyze: 'Analyze 分析',
};

export function WorkbenchView() {
  const [step, setStep] = useState<Step>('design');

  const stepTitle = stepTitles[step];

  return (
    <div className="workbench-single">
      <Panel
        title={`Workbench 工作台 · ${stepTitle}`}
        actions={<StepNavigation current={step} onChange={setStep} />}
      >
        {step === 'design' && <DesignTab />}
        {step === 'run' && <RunTab />}
        {step === 'intervene' && <InterveneTab />}
        {step === 'analyze' && <AnalyzeTab />}
      </Panel>
    </div>
  );
}
