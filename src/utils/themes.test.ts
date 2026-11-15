import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  appearanceFromSettings,
  DEFAULT_THEME,
  DEFAULT_TITLE,
  THEME_NAMES,
  THEME_TOKENS,
} from './themes';

const defaults = { title: DEFAULT_TITLE, theme: DEFAULT_THEME };

describe('THEME_NAMES', () => {
  test('lists the eleven agreed themes in display order', () => {
    expect([...THEME_NAMES]).toEqual([
      'light', 'dark', 'red', 'green', 'blue', 'yellow',
      'purple', 'rose', 'silver', 'gold', 'copper',
    ]);
  });

  test('dark is the default theme', () => {
    expect(DEFAULT_THEME).toBe('dark');
  });
});

describe('appearanceFromSettings', () => {
  test('reads the title and theme from the stored settings document', () => {
    const settings = { TITLE: 'Neotropolis Badge Desk', THEME: 'gold' };
    expect(appearanceFromSettings(settings, defaults)).toEqual({
      title: 'Neotropolis Badge Desk',
      theme: 'gold',
    });
  });

  test('falls back to the default title when the stored title is blank or missing', () => {
    expect(appearanceFromSettings({ TITLE: '   ' }, defaults).title).toBe(DEFAULT_TITLE);
    expect(appearanceFromSettings({}, defaults).title).toBe(DEFAULT_TITLE);
    expect(appearanceFromSettings(undefined, defaults).title).toBe(DEFAULT_TITLE);
  });

  test('falls back to the default theme when the stored theme is not a known theme', () => {
    expect(appearanceFromSettings({ THEME: 'neon' }, defaults).theme).toBe(DEFAULT_THEME);
    expect(appearanceFromSettings({ THEME: '' }, defaults).theme).toBe(DEFAULT_THEME);
    expect(appearanceFromSettings({}, defaults).theme).toBe(DEFAULT_THEME);
  });

  test('trims surrounding whitespace from the title', () => {
    expect(appearanceFromSettings({ TITLE: '  Front Desk  ' }, defaults).title).toBe('Front Desk');
  });
});

describe('globals.css', () => {
  const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');

  test.each([...THEME_NAMES])('defines every color token for the %s theme', (theme) => {
    const blockStart = css.indexOf(`[data-theme="${theme}"]`);
    expect(blockStart, `no [data-theme="${theme}"] block`).toBeGreaterThan(-1);
    const blockEnd = css.indexOf('}', blockStart);
    const block = css.slice(blockStart, blockEnd);
    for (const token of THEME_TOKENS) {
      expect(block, `${theme} is missing ${token}`).toContain(`${token}:`);
    }
  });
});

// WCAG relative luminance and contrast ratio, so palette changes cannot quietly
// drop below the minimums for text (4.5:1) and icons (3:1).
function luminance(hex: string): number {
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe('theme contrast', () => {
  const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');

  function tokens(theme: string): Record<string, string> {
    const blockStart = css.indexOf(`[data-theme="${theme}"]`);
    const block = css.slice(blockStart, css.indexOf('}', blockStart));
    return Object.fromEntries(
      Array.from(block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g), (match) => [match[1], match[2]]),
    );
  }

  test.each([...THEME_NAMES])('%s: Update button text reads at 4.5:1 or better on the control color', (theme) => {
    const palette = tokens(theme);
    expect(contrast(palette['control-text'], palette.control)).toBeGreaterThanOrEqual(4.5);
  });

  test.each([...THEME_NAMES])('%s: body text reads at 4.5:1 or better on inputs and the page', (theme) => {
    const palette = tokens(theme);
    expect(contrast(palette.text, palette.raised)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.text, palette.background)).toBeGreaterThanOrEqual(4.5);
  });
});
