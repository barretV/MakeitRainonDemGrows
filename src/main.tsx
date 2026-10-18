import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { theme, applyTheme } from './theme';
import { bridge } from './game/bridge';

const quiet = {};
RundotGameAPI.analytics.recordCustomEvent('game_loaded', quiet);

RundotGameAPI.lifecycles.onPause(() => {
  bridge.onPause();
  RundotGameAPI.analytics.recordCustomEvent('game_paused', quiet);
});
RundotGameAPI.lifecycles.onResume(() => {
  bridge.onResume();
  RundotGameAPI.analytics.recordCustomEvent('game_resumed', quiet);
});
RundotGameAPI.lifecycles.onSleep(() => {
  bridge.onPause();
  RundotGameAPI.analytics.recordCustomEvent('game_sleep', quiet);
});
RundotGameAPI.lifecycles.onQuit(() => {
  bridge.onQuit();
  RundotGameAPI.analytics.recordCustomEvent('game_quit', quiet);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[Template React Simple] Root element not found');
}

const root = createRoot(rootElement);

const render = (node: ReactNode) => {
  root.render(<StrictMode>{node}</StrictMode>);
};

applyTheme(theme);

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
