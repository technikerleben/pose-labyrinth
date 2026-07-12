import App from './App';
import HandNumbers from './HandNumbers';

type Variant = 'pose' | 'numbers';

function currentVariant(): Variant {
  return window.location.hash === '#numbers' ? 'numbers' : 'pose';
}

export default function Launcher() {
  const variant = currentVariant();

  function switchVariant(next: Variant) {
    if (next === variant) return;
    window.location.hash = next === 'numbers' ? 'numbers' : '';
    window.location.reload();
  }

  return (
    <>
      <div className="variant-switch" role="navigation" aria-label="App-Variante wählen">
        <button className={variant === 'pose' ? 'active' : ''} onClick={() => switchVariant('pose')}>
          Körperposen &amp; Labyrinth
        </button>
        <button className={variant === 'numbers' ? 'active' : ''} onClick={() => switchVariant('numbers')}>
          Zahlen mit Händen
        </button>
      </div>
      {variant === 'pose' ? <App /> : <HandNumbers />}
    </>
  );
}
