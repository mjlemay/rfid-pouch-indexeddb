// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormViewer from './formViewer';
import { formField } from '../../utils/types';

const fields: formField[] = [
  {
    name: 'THEME', inputType: 'select', fieldType: 'select',
    options: [
      { name: 'Light', value: 'light' },
      { name: 'Dark', value: 'dark' },
      { name: 'Gold', value: 'gold' },
    ],
  },
];

describe('FormViewer select field', () => {
  test('renders a native select with one option per entry', () => {
    render(<FormViewer fields={fields} formDoc={{ THEME: 'gold' } as never} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toEqual(['Light', 'Dark', 'Gold']);
  });

  test('shows the stored value as the selected option', () => {
    render(<FormViewer fields={fields} formDoc={{ THEME: 'gold' } as never} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('gold');
  });
});
