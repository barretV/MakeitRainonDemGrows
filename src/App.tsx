import { useCallback, useRef, useState } from 'react';
import { Hud } from './components/Hud';
import { RainGame } from './game/RainGame';
import type { HudModel } from './game/state';
import './style.css';

function App() {
  const gameRef = useRef<RainGame | null>(null);
  const [model, setModel] = useState<HudModel | null>(null);

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
    <div className="flex h-full w-full items-center justify-center bg-[#241528]">
      <div className="relative aspect-video w-[min(100vw,calc(100vh*16/9))] overflow-hidden bg-[#f3d5e4] shadow-[0_0_0_8px_#1a1020]">
        <div ref={mount} className="absolute inset-0" />
        {model?.ready && gameRef.current && <Hud model={model} game={gameRef.current} />}
      </div>
    </div>
  );
}

export default App;
