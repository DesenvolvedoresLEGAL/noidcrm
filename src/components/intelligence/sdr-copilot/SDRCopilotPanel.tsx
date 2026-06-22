import { SDRCopilotKpiBar } from './SDRCopilotKpiBar';
import { SDRCopilotTaskList } from './SDRCopilotTaskList';

export function SDRCopilotPanel() {
  return (
    <div className="space-y-4">
      <SDRCopilotKpiBar />
      <SDRCopilotTaskList />
    </div>
  );
}
