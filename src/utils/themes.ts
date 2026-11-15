// The eleven themes, in the order they appear in the Settings dropdown.
export const THEME_NAMES = [
  'light', 'dark', 'red', 'green', 'blue', 'yellow',
  'purple', 'rose', 'silver', 'gold', 'copper',
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

// Every theme block in globals.css must define each of these custom properties.
export const THEME_TOKENS = [
  '--color-background',
  '--color-sidebar',
  '--color-surface',
  '--color-raised',
  '--color-line',
  '--color-text',
  '--color-heading',
  '--color-accent',
  '--color-muted',
  '--color-control',
  '--color-control-text',
] as const;

export const DEFAULT_THEME: ThemeName = 'dark';
export const DEFAULT_TITLE = 'RFID Scans';

export type Appearance = {
  title: string;
  theme: ThemeName;
};

export const DEFAULT_APPEARANCE: Appearance = {
  title: DEFAULT_TITLE,
  theme: DEFAULT_THEME,
};

// Options for the THEME select in Settings, with capitalized labels.
export const THEME_OPTIONS = THEME_NAMES.map((name) => ({
  name: name.charAt(0).toUpperCase() + name.slice(1),
  value: name,
}));

function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);
}

// Reads TITLE and THEME from the app_settings document. A blank or missing
// title and an unknown theme both fall back to the defaults.
export function appearanceFromSettings(
  settings: Record<string, unknown> | null | undefined,
  defaults: Appearance,
): Appearance {
  const storedTitle = settings?.TITLE;
  const title = typeof storedTitle === 'string' && storedTitle.trim() !== ''
    ? storedTitle.trim()
    : defaults.title;

  const storedTheme = settings?.THEME;
  const theme = isThemeName(storedTheme) ? storedTheme : defaults.theme;

  return { title, theme };
}
