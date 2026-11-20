import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Offline support + installability. Skipped in `vite dev` so HMR never serves stale cached files.
if ('serviceWorker' in navigator && !import.meta.env?.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env?.BASE_URL ?? '/'}sw.js`)
      .catch((err) => console.warn('Service worker registration failed', err));
  });
}
