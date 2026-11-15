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
