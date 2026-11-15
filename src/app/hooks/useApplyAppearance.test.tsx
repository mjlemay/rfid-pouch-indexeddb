// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApplyAppearance } from './useApplyAppearance';
import { Appearance } from '../../utils/themes';

describe('useApplyAppearance', () => {
  test('sets the document title and the html data-theme attribute', () => {
    renderHook(() => useApplyAppearance({ title: 'Badge Desk', theme: 'copper' }));
    expect(document.title).toBe('Badge Desk');
    expect(document.documentElement.getAttribute('data-theme')).toBe('copper');
  });

  test('updates both when the appearance changes', () => {
    const { rerender } = renderHook(
      (appearance: Appearance) => useApplyAppearance(appearance),
      { initialProps: { title: 'Badge Desk', theme: 'copper' } as Appearance },
    );
    rerender({ title: 'Front Gate', theme: 'blue' });
    expect(document.title).toBe('Front Gate');
    expect(document.documentElement.getAttribute('data-theme')).toBe('blue');
  });
});
