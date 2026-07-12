import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Launcher from './Launcher';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Launcher />
  </StrictMode>,
);
