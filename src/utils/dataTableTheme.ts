import { createTheme } from 'react-data-table-component';

// One table theme for the whole app. The values are CSS variables, so the
// tables follow whichever theme is active without re-registering.
export const DATA_TABLE_THEME = 'app';

// Shared sizing for every table: a step up from the library's 13px rows.
export const DATA_TABLE_STYLES = {
  headCells: { style: { fontSize: '15px', fontWeight: 700 } },
  rows: { style: { fontSize: '16px', minHeight: '52px' } },
  cells: { style: { fontSize: '16px' } },
  pagination: { style: { fontSize: '14px' } },
};

createTheme(DATA_TABLE_THEME, {
  text: {
    primary: 'var(--color-text)',
    secondary: 'var(--color-text)',
    disabled: 'var(--color-muted)',
  },
  background: {
    default: 'transparent',
  },
  context: {
    background: 'var(--color-raised)',
    text: 'var(--color-text)',
  },
  divider: {
    default: 'var(--color-line)',
  },
  button: {
    default: 'var(--color-text)',
    hover: 'var(--color-raised)',
    focus: 'var(--color-raised)',
    disabled: 'var(--color-muted)',
  },
  highlightOnHover: {
    default: 'var(--color-raised)',
    text: 'var(--color-text)',
  },
  action: {
    button: 'var(--color-text)',
    hover: 'var(--color-raised)',
    disabled: 'var(--color-muted)',
  },
}, 'dark');
