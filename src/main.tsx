import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// === PWA: registrar service worker apenas em produção e fora de iframes/preview ===
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com') ||
  window.location.hostname.includes('lovable.app') === false &&
    window.location.hostname.includes('lovable');

if (isInIframe || isPreviewHost) {
  // Em preview/iframe: garante que nenhum SW antigo fique registrado interferindo
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
} else if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Registro real do SW gerado pelo vite-plugin-pwa
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      /* SW indisponível neste ambiente */
    });
}

createRoot(document.getElementById('root')!).render(<App />);
