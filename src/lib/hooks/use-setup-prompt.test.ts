import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readDismissedSetup,
  rememberDismissedSetup,
  SETUP_DISMISSED_KEY,
} from './use-setup-prompt';

/** A minimal in-memory stand-in for the browser's localStorage. */
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

const blockedStorage = {
  getItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('setup dismissal storage', () => {
  it('remembers only which problem was dismissed', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);

    expect(readDismissedSetup()).toBeNull();
    rememberDismissedSetup('no-token');

    expect(readDismissedSetup()).toBe('no-token');
    expect([...storage.items]).toEqual([[SETUP_DISMISSED_KEY, 'no-token']]);
  });

  it('treats blocked storage as never dismissed instead of throwing', () => {
    vi.stubGlobal('localStorage', blockedStorage);

    expect(() => rememberDismissedSetup('no-token')).not.toThrow();
    expect(readDismissedSetup()).toBeNull();
  });
});
