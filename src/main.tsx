// Shared tokens and base styles first, so component stylesheets can override them.
import './ui/theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadFromStorage, migrateLegacyKeys } from './persistence/storage';
import { appStore } from './store/store';
import App from './ui/shell/App';
import { ErrorBoundary } from './ui/shell/ErrorBoundary';
import { applyTheme, followSystemTheme, readTheme } from './ui/shell/theme';
import { toast } from './ui/shell/toastStore';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// First, so the theme, prefs and automata saved under the old name are found below.
migrateLegacyKeys(browserStorage());

// Before the first render, so the page never flashes the other theme; then keep following
// the system while that is the choice.
applyTheme(readTheme());
followSystemTheme();

const loaded = loadFromStorage(browserStorage());
appStore.getState().replaceAll(loaded.automata);
if (loaded.warning) toast(loaded.warning, 'error');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
