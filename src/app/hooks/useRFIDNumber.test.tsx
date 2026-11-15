// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRFIDNumber } from './useRFIDNumber';

const config = { wait: 300, cpsMin: 0, cpsMax: 30, idLength: 8 };

// jsdom stamps events with Date.now(), so advancing the fake clock controls event.timeStamp.
function pressKeys(keys: string[], startAt: number, gapMs = 10) {
  keys.forEach((key, index) => {
    vi.setSystemTime(startAt + index * gapMs);
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

describe('useRFIDNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('returns the scanned code after a reader burst', () => {
    const { result } = renderHook(() => useRFIDNumber(true, config));
    act(() => pressKeys([...'0a1b2c3d', 'Enter'], 1000));
    expect(result.current).toBe('0a1b2c3d');
  });

  test('clears the code when the next scan starts so a repeat of the same tag is seen again', () => {
    const { result } = renderHook(() => useRFIDNumber(true, config));
    act(() => pressKeys([...'0a1b2c3d', 'Enter'], 1000));
    act(() => pressKeys(['0'], 5000));
    expect(result.current).toBe('');
    act(() => pressKeys([...'a1b2c3d', 'Enter'], 5010));
    expect(result.current).toBe('0a1b2c3d');
  });

  test('ignores keystrokes while disabled', () => {
    const { result } = renderHook(() => useRFIDNumber(false, config));
    act(() => pressKeys([...'0a1b2c3d', 'Enter'], 1000));
    expect(result.current).toBe('');
  });

  test('does not re-render on every keystroke', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useRFIDNumber(true, config);
    });
    const rendersBeforeScan = renders;
    act(() => pressKeys([...'0a1b2c3d', 'Enter'], 1000));
    // One render for the scan start (code cleared) and one for the emitted code at most.
    expect(renders - rendersBeforeScan).toBeLessThanOrEqual(2);
  });
});
