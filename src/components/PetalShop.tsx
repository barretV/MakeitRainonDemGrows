import type { RainGame } from '../game/RainGame';
import type { PetalId } from '../game/petal';
import type { HudModel } from '../game/state';

export function PetalShop({ model, game }: { model: HudModel; game: RainGame }) {
  return (
    <div className="petal-shop">
      <p className="petal-shop__lead pixel">
        Spend blooms ({model.spendableBlooms} available) on flair. Power upgrades use dew.
      </p>
      <ul className="petal-shop__list">
        {model.petalTree.map((item) => (
          <li key={item.id} className={`petal-shop__row${item.owned ? ' petal-shop__row--owned' : ''}`}>
            <div>
              <div className="petal-shop__name pixel">{item.name}</div>
              <div className="petal-shop__desc">{item.desc}</div>
            </div>
            <button
              type="button"
              disabled={!item.afford || item.owned}
              className={`petal-shop__buy pixel${item.afford && !item.owned ? ' petal-shop__buy--go' : ''}`}
              onClick={() => game.buyPetal(item.id as PetalId)}
            >
              {item.owned ? 'Owned' : `${item.cost} blooms`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
