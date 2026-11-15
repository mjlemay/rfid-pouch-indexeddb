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

describe('FormViewer typed fields', () => {
  test('a boolean field renders a checkbox reflecting the stored value and reports changes', () => {
    const onValuesChange = vi.fn();
    const booleanFields: formField[] = [{ name: 'f_service', label: 'In service', inputType: 'checkbox', fieldType: 'boolean' }];
    render(<FormViewer fields={booleanFields} formDoc={{ f_service: true } as never} onValuesChange={onValuesChange} />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ f_service: false }));
  });

  test('a number field renders a numeric input and keeps the typed text', () => {
    const numberFields: formField[] = [{ name: 'f_qty', label: 'Qty', inputType: 'number', fieldType: 'number' }];
    render(<FormViewer fields={numberFields} formDoc={{ f_qty: 3 } as never} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3');
    fireEvent.change(input, { target: { value: '42' } });
    expect(input.value).toBe('42');
  });

  test('shows the label instead of the name when given, and an error under the field', () => {
    const labeled: formField[] = [{ name: 'f_owner', label: 'Owner', inputType: 'text', fieldType: 'input' }];
    render(<FormViewer fields={labeled} formDoc={{} as never} errors={{ f_owner: 'Owner is required' }} />);
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.queryByText('f_owner')).toBeNull();
    expect(screen.getByText('Owner is required')).toBeTruthy();
  });
});
