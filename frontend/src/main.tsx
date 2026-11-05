// The starting point: load fonts and colors, then draw <App /> into <div id="root">.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fonts are bundled with the app, so they work without internet (F1 spec, rule 7).
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './theme.css';

import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing <div id="root">');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
