import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without Vitest's globals, Testing Library cannot register its own
// automatic cleanup; do it explicitly so each test starts from an
// empty document.
afterEach(() => {
  cleanup();
});
