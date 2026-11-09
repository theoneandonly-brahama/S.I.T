import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.tsx';
import { applyTheme, readTheme } from './theme.ts';

// Apply the stored/OS theme before React renders to avoid a flash of
// the wrong colour scheme.
applyTheme(readTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
