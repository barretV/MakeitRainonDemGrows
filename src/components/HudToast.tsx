import { useEffect, useRef, useState } from 'react';

interface Toast {
  seq: number;
  text: string;
}

/**
 * The message strip. The game writes every reward, warning and nudge here;
 * this shows them one at a time so a burst of good news is never swallowed by
 * the next line.
 */
export function HudToast({ toasts }: { toasts: Toast[] }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const [shown, setShown] = useState<Toast | null>(null);
  const lastSeq = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let newest = lastSeq.current;
    const fresh: Toast[] = [];
    for (const toast of toasts) {
      if (toast.seq <= lastSeq.current) continue;
      fresh.push(toast);
      if (toast.seq > newest) newest = toast.seq;
    }
    if (fresh.length === 0) return;
    lastSeq.current = newest;
    setQueue((prev) => [...prev, ...fresh].slice(-8));
  }, [toasts]);

  useEffect(() => {
    if (shown || queue.length === 0) return;
    const next = queue[0];
    if (!next) return;
    setShown(next);
    setQueue(queue.slice(1));
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setShown(null);
    }, 2800);
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [queue, shown]);

  if (!shown) return null;
  const achievement = shown.text.startsWith('Achievement');
  const bloom = shown.text.includes('bloom');
  return (
    <div
      className={`hud-toast pixel${achievement ? ' hud-toast--gold' : ''}${bloom ? ' hud-toast--bloom' : ''}`}
      role="status"
    >
      {shown.text}
    </div>
  );
}
