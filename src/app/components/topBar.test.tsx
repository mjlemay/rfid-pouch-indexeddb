// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TopBar from './topBar';

describe('TopBar', () => {
  test('renders the title as a heading', () => {
    render(<TopBar title="Neotropolis Badge Desk" />);
    expect(screen.getByRole('heading', { name: 'Neotropolis Badge Desk' })).toBeTruthy();
  });

  test('clicking the title calls the handler so the page can show Recent Records', () => {
    const onTitleClick = vi.fn();
    render(<TopBar title="Neotropolis Badge Desk" onTitleClick={onTitleClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Neotropolis Badge Desk' }));
    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });
});
