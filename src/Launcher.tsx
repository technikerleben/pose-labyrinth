import App from './App';
import FaceExpressions from './FaceExpressions';
import HandNumbers from './HandNumbers';

type Variant = 'pose' | 'numbers' | 'face';

function currentVariant(): Variant {
  if (window.location.hash === '#numbers') return 'numbers';
  if (window.location.hash === '#face') return 'face';
  return 'pose';
}

export default function Launcher() {
  const variant = currentVariant();

  function switchVariant(next: Variant) {
    if (next === variant) return;
    window.location.hash = next === 'pose' ? '' : next;
    window.location.reload();
  }

  return (
    <>
      <div className="variant-switch three" role="navigation" aria-label="App-Variante wählen">
        <button className={variant === 'pose' ? 'active' : ''} onClick={() => switchVariant('pose')}>Körperposen &amp; Labyrinth</button>
        <button className={variant === 'numbers' ? 'active' : ''} onClick={() => switchVariant('numbers')}>Zahlen mit Händen</button>
        <button className={variant === 'face' ? 'active' : ''} onClick={() => switchVariant('face')}>Gesichtsausdrücke</button>
      </div>
      {variant === 'pose' ? <App /> : variant === 'numbers' ? <HandNumbers /> : <FaceExpressions />}
    </>
  );
}
