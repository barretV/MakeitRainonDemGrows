import { useCallback, useRef, useState } from 'react';
import { Hud } from './components/Hud';
import { RainGame } from './game/RainGame';
import type { HudModel } from './game/state';
import { syncGameFrame } from './useGameFrame';
import './style.css';

function App() {
  const gameRef = useRef<RainGame | null>(null);
  const frameObserverRef = useRef<ResizeObserver | null>(null);
  const [model, setModel] = useState<HudModel | null>(null);

  const frameSyncRef = useRef<(() => void) | null>(null);

  const bindFrame = useCallback((node: HTMLDivElement | null) => {
    frameObserverRef.current?.disconnect();
    frameObserverRef.current = null;
    if (frameSyncRef.current) {
      window.removeEventListener('resize', frameSyncRef.current);
      window.removeEventListener('orientationchange', frameSyncRef.current);
      frameSyncRef.current = null;
    }
    if (!node) return;

    const onSync = () => syncGameFrame();
    frameSyncRef.current = onSync;
    onSync();
    const ro = new ResizeObserver(onSync);
    ro.observe(node);
    frameObserverRef.current = ro;
    window.addEventListener('resize', onSync);
    window.addEventListener('orientationchange', onSync);
    requestAnimationFrame(onSync);
  }, []);

  const mount = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      gameRef.current?.dispose();
      gameRef.current = null;
      return;
    }
    if (gameRef.current) return;
    gameRef.current = new RainGame(node, setModel);
  }, []);

  return (
    <>
      <div className="rotate-hint" aria-live="polite">
        <div className="rotate-hint__card">
          <div className="rotate-hint__icon" aria-hidden="true" />
          <p className="rotate-hint__title pixel">Rotate your phone</p>
          <p className="rotate-hint__sub">This game plays in landscape — turn sideways for the full view.</p>
        </div>
      </div>
      <div id="app-frame" ref={bindFrame}>
        <div id="app-frame-inner">
          <div ref={mount} className="absolute inset-0 z-0" />
          {model?.ready && gameRef.current && <Hud model={model} game={gameRef.current} />}
        </div>
      </div>
    </>
  );
}

export default App;
