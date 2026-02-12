import { useState } from 'react';
import type { StepTabKey } from '../../../../types';
import { SubTabs } from '../SubTabs';
import { ScenarioPanel } from './ScenarioPanel';
import { PipelinePanel } from './PipelinePanel';
import { ConfigPanel } from './ConfigPanel';
import { GroupsPanel } from './GroupsPanel';

const tabs: { key: StepTabKey; label: string }[] = [
  { key: 'scenario', label: 'Scenario 场景' },
  { key: 'pipeline', label: 'Pipeline 流程' },
  { key: 'groups', label: 'Groups 群体画像' },
  { key: 'config', label: 'Config 配置' },
];

export function DesignTab() {
  const [activeTab, setActiveTab] = useState<StepTabKey>('scenario');

  return (
    <div className="panel panel--nested">
      <div className="panel__hd">
        <div className="panel__title">Design Flow 设计流程</div>
        <SubTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>
      <div className="panel__bd">
        {activeTab === 'scenario' && <ScenarioPanel />}
        {activeTab === 'pipeline' && <PipelinePanel />}
        {activeTab === 'groups' && <GroupsPanel onBack={() => setActiveTab('pipeline')} />}
        {activeTab === 'config' && <ConfigPanel />}
      </div>
    </div>
  );
}
