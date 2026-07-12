import { useState } from 'react';
import App from './App';
import HandNumbers from './HandNumbers';

type Variant = 'pose' | 'numbers';

export default function Launcher() {
  const [variant, setVariant] = useState<Variant>('pose');

  return (
    <>
      <div className="variant-switch" role="navigation" aria-label="App-Variante wählen">
        <button className={variant === 'pose' ? 'active' : ''} onClick={() => setVariant('pose')}>
          Körperposen &amp; Labyrinth
        </button>
        <button className={variant === 'numbers' ? 'active' : ''} onClick={() => setVariant('numbers')}>
          Zahlen mit Händen
        </button>
      </div>
      {variant === 'pose' ? <App /> : <HandNumbers />}
    </>
  );
}
