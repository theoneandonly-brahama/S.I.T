import { describe, it, expect } from 'vitest';
import { __PACKAGE } from './index.js';

describe('@sit/config', () => {
  it('exposes the package name', () => {
    expect(__PACKAGE).toBe('@sit/config');
  });
});
