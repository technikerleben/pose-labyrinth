import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Launcher from './Launcher';
import './styles.css';
import './hand-numbers.css';
import './dance-game.css';
import './cad-gesture.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Launcher />
  </StrictMode>,
);
