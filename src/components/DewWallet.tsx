import { formatDew } from '../game/state';

export function DewWallet({ amount }: { amount: number }) {
  return (
    <div className="workshop-wallet pixel" aria-label={`${formatDew(amount)} dew`}>
      <DewDropIcon />
      <div className="workshop-wallet__text">
        <span className="workshop-wallet__label">Dew</span>
        <span className="workshop-wallet__amount">{formatDew(amount)}</span>
      </div>
    </div>
  );
}

function DewDropIcon() {
  return (
    <svg className="workshop-wallet__icon" viewBox="0 0 32 40" aria-hidden>
      <path
        d="M16 2c-7 0-10 8-10 16 0 10 10 20 10 20s10-10 10-20C26 10 23 2 16 2z"
        fill="#5ec8ff"
        stroke="#1e3a5f"
        strokeWidth="2"
      />
      <ellipse cx="12" cy="14" rx="4" ry="3" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}
