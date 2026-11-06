// The starting point: load fonts and colors, apply the saved theme, start the router.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

// Fonts are bundled with the app, so they work without internet (F1 spec, rule 7).
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './theme.css';

import { routes } from './routes';
import { applyTheme, readTheme } from './theme';

// Before the first draw, so a dark-mode user never sees a light flash.
applyTheme(readTheme());

const router = createBrowserRouter(routes);

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing <div id="root">');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
