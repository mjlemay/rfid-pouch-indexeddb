// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { rawFormatFromHash, useRawFormat } from './useRawFormat';

afterEach(() => { window.history.replaceState(null, '', window.location.pathname); });

describe('rawFormatFromHash', () => {
  test('maps #json and #csv to formats ignoring case', () => {
    expect(rawFormatFromHash('#json')).toBe('json');
    expect(rawFormatFromHash('#CSV')).toBe('csv');
  });

  test('returns null for other hashes and no hash', () => {
    expect(rawFormatFromHash('#other')).toBeNull();
    expect(rawFormatFromHash('')).toBeNull();
  });
});

describe('useRawFormat', () => {
  test('reads the current hash', () => {
    window.location.hash = '#csv';
    const { result } = renderHook(() => useRawFormat());
    expect(result.current).toBe('csv');
  });

  test('updates when the hash changes', () => {
    const { result } = renderHook(() => useRawFormat());
    expect(result.current).toBeNull();
    act(() => {
      window.location.hash = '#json';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toBe('json');
  });
});
