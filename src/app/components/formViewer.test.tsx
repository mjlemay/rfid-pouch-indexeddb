// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

const formDoc = { THEME: 'gold' } as never;

describe('FormViewer select field', () => {
  test('renders a native select with one option per entry', () => {
    render(<FormViewer fields={fields} formDoc={formDoc} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toEqual(['Light', 'Dark', 'Gold']);
  });

  test('shows the stored value as the selected option', () => {
    render(<FormViewer fields={fields} formDoc={formDoc} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('gold');
  });

  // On macOS the native select popup is a separate window. Opening it blurs the
  // select, and if the page re-renders at that moment React rewrites the option
  // state under the open popup and Chrome discards or misreports the pick.
  test('does not report focus changes, so the page does not re-render while the dropdown is open', () => {
    const inputFocusHandler = vi.fn();
    render(<FormViewer fields={fields} formDoc={formDoc} inputFocusHandler={inputFocusHandler} />);
    const select = screen.getByRole('combobox');
    fireEvent.focus(select);
    fireEvent.blur(select);
    expect(inputFocusHandler).not.toHaveBeenCalled();
  });

  test('re-rendering the form does not rewrite the select options', () => {
    const { rerender } = render(<FormViewer fields={fields} formDoc={formDoc} />);
    const selectedSetter = vi.spyOn(HTMLOptionElement.prototype, 'selected', 'set');
    rerender(<FormViewer fields={fields} formDoc={formDoc} inputFocusHandler={() => {}} />);
    expect(selectedSetter).not.toHaveBeenCalled();
    selectedSetter.mockRestore();
  });

  test('a picked option is kept and reported to the form', () => {
    render(<FormViewer fields={fields} formDoc={formDoc} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'light' } });
    expect(select.value).toBe('light');
  });
});
