import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadFromStorage } from './persistence/storage';
import { appStore } from './store/store';
import App from './ui/shell/App';
import { toast } from './ui/shell/toastStore';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const loaded = loadFromStorage(browserStorage());
appStore.getState().replaceAll(loaded.automata);
if (loaded.warning) toast(loaded.warning, 'error');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
