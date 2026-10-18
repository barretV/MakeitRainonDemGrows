export const theme = {
  background: '#241528',
  surface: '#17233f',
  primary: '#ff8fb8',
  secondary: '#7ec8f0',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.75)',
};

export type Theme = typeof theme;

export function applyTheme(t: Theme): void {
  const s = document.documentElement.style;
  s.setProperty('--color-background', t.background);
  s.setProperty('--color-surface', t.surface);
  s.setProperty('--color-primary', t.primary);
  s.setProperty('--color-secondary', t.secondary);
  s.setProperty('--color-text', t.text);
  s.setProperty('--color-text-muted', t.textMuted);
}
