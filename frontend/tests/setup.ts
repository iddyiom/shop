// Runs before every test file (vite.config.ts → test.setupFiles).
import { configure } from '@testing-library/react';

// findBy… and waitFor give up after 1 second by default. On a busy laptop a page can need
// longer (log-in check, then data), and a test would fail even though the app works.
// 5 seconds keeps tests honest (a real hang still fails) without random timeouts.
configure({ asyncUtilTimeout: 5000 });
