/** Discrete growth bands for restoration juice (0 = dead … 5 = fully grown). */
export function growthStage(progress: number, hp: number): number {
  if (hp <= 0) return 0;
  if (progress >= hp) return 5;
  const wet = progress / hp;
  return Math.min(4, Math.floor(wet * 5));
}

export function stagePopStrength(pulse: number): number {
  return Math.min(1, pulse / 255);
}

export interface GrowthPulseEvent {
  x: number;
  z: number;
  stage: number;
}

export interface RestorationWave {
  c: number;
  r: number;
  radius: number;
  maxRadius: number;
  speed: number;
}

export const WAVE_SPEED = 10.5;
export const WAVE_THICK = 1.35;
