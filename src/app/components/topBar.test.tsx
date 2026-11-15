// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from './topBar';

describe('TopBar', () => {
  test('renders the title as a heading', () => {
    render(<TopBar title="Neotropolis Badge Desk" />);
    expect(screen.getByRole('heading', { name: 'Neotropolis Badge Desk' })).toBeTruthy();
  });
});
