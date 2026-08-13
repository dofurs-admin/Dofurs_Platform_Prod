import { describe, expect, it, vi } from 'vitest';
import { refreshSessionOnAppActive } from './app-state-refresh';

describe('refreshSessionOnAppActive', () => {
  it('refreshes when app transitions from background to active', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);

    await refreshSessionOnAppActive('background', 'active', { refreshSession });

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('refreshes when app transitions from inactive to active', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);

    await refreshSessionOnAppActive('inactive', 'active', { refreshSession });

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when app remains active', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);

    await refreshSessionOnAppActive('active', 'active', { refreshSession });

    expect(refreshSession).not.toHaveBeenCalled();
  });
});