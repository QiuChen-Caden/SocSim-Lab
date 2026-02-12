import {
  agentsApi,
  feedApi,
  simulationApi,
  stateApi,
  eventsApi,
  logsApi,
  systemLogsApi,
  snapshotsApi,
  interventionsApi,
  visualizationApi,
} from './endpoints';

export { ApiError, request } from './client';
export { wsClient, WebSocketClient } from './websocket';

export const api = {
  agents: agentsApi,
  feed: feedApi,
  simulation: simulationApi,
  state: stateApi,
  events: eventsApi,
  logs: logsApi,
  systemLogs: systemLogsApi,
  snapshots: snapshotsApi,
  interventions: interventionsApi,
  visualization: visualizationApi,
};

export default api;
