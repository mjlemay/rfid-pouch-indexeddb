# Themes and page title

Date: 2026-11-15

## Goal

Let the person running the app name the page and pick its colors from Settings. The title shows in the browser tab and in a top bar across the content area. The theme is one of eleven full palettes.

## Decisions made during brainstorming

- Colored themes tint the whole interface, not just accents.
- The title appears in the browser tab and in a slim top bar above every view.
- Theme names, in display order: Light, Dark, Red, Green, Blue, Yellow, Purple, Rose, Silver, Gold, Copper. Dark is the default and matches the app's current look.
- Yellow is amber on warm brown. Gold is built from the CSS named colors gold, goldenrod and cornsilk on a near-black base. Rose is a rose gold palette. Copper is burnt orange and brown.
- The theme is chosen from a dropdown in Settings, in a new Appearance section at the top of the form, next to a text input for the title.
- Appearance changes apply when Update is pressed, like every other setting.
- The default title is "RFID Scans".

## Design

### Color tokens

Every theme defines the same eleven CSS custom properties. They live in `src/app/globals.css`, one block per theme keyed by a `data-theme` attribute on the `html` element.

| Token | Used for |
| --- | --- |
| `--color-background` | page background |
| `--color-sidebar` | sidebar background, ready light ring |
| `--color-surface` | panels, top bar |
| `--color-raised` | inputs, selects, hover states, selected nav icon background |
| `--color-line` | borders and table dividers |
| `--color-text` | body text |
| `--color-heading` | headings and the top bar title |
| `--color-accent` | ready light when scanning is enabled, focus rings |
| `--color-muted` | ready light when scanning is disabled, disabled controls |
| `--color-control` | the Update button background |
| `--color-control-text` | the Update button text |

`tailwind.config.ts` maps semantic color names onto these variables: `background`, `sidebar`, `surface`, `raised`, `line`, `text`, `heading`, `accent`, `muted`, `control`, `control-text`. Components use these names in place of the hardcoded `neutral`, `black`, `white`, `green`, `red` and `blue` classes they carry today. Each component is touched once and then works for every theme.

The two data tables currently each register an identical `createTheme('dark', ...)`. That moves to one module, `src/utils/dataTableTheme.ts`, which registers a single theme named `app` whose values are `var(--color-...)` strings, so the tables follow the active theme.

### Theme registry

`src/utils/themes.ts` exports:

- `THEME_NAMES`, the ordered list of the eleven theme ids (lowercase).
- `DEFAULT_THEME`, which is `dark`.
- `DEFAULT_TITLE`, which is `RFID Scans`.
- `appearanceFromSettings(settings, defaults)`, which reads `TITLE` and `THEME` from the stored settings document. A missing or blank title falls back to the default. A theme that is not in `THEME_NAMES` falls back to the default.

### Applying the appearance

A hook, `useApplyAppearance({ title, theme })` in `src/app/hooks/useApplyAppearance.tsx`, sets `document.title` and the `data-theme` attribute on `document.documentElement` whenever either value changes. The page calls it with the result of `appearanceFromSettings`.

The hardcoded `data-theme="darkTheme"` attribute on the page's root `div` is removed, since the attribute now lives on `html` where it also themes `body`.

The static `metadata.title` in `layout.tsx` becomes `RFID Scans` so the tab reads sensibly before the settings document loads.

### Top bar

`src/app/components/topBar.tsx` renders the title in a slim bar: `bg-surface`, bottom border `border-line`, text `text-heading`. The page's content column becomes `TopBar` above the existing view container.

### Settings

`settingsFields` in `settingsView.tsx` gains three entries at the top:

1. Header `APPEARANCE` with the caption "Name this page and choose its colors."
2. `TITLE`, a text input.
3. `THEME`, a select whose options are the eleven themes with capitalized labels.

`FormViewer` gets a `select` field type again, this time a native `<select>` styled like the inputs, with `onFocus` and `onBlur` wired to `inputFocusHandler` so the scanner listener pauses while it has focus. The `formField` type regains `options?: { name: string; value: string }[]`.

Settings documents saved before this change have no `TITLE` or `THEME`. `SettingsView` merges the defaults under the stored document before handing it to the form, so the select shows Dark rather than an empty value for those installs. The page's `defaultSettings` for a fresh install includes `TITLE` and `THEME`.

### Not in scope

- Live preview before pressing Update.
- Per-view or per-user themes. The theme is per browser, like every other setting.
- Custom colors beyond the eleven palettes.

## Testing

- `themes.test.ts`: `appearanceFromSettings` reads values, falls back on blank or unknown input; `THEME_NAMES` is the agreed list; `globals.css` defines a `[data-theme="..."]` block for every theme name with every token.
- `useApplyAppearance.test.tsx` (jsdom): sets the document title and the `data-theme` attribute, and updates both on change.
- `topBar.test.tsx` (jsdom): renders the title text.
- `formViewer.test.tsx` (jsdom): a `select` field renders its options and shows the stored value as selected.
- Build: `npm run build` produces the static export. A headless Chrome screenshot of `out/index.html` confirms the default theme renders.
