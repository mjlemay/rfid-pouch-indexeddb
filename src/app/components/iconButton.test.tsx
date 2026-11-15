// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import IconButton from './iconButton';

describe('IconButton', () => {
  // The selected background is the strong control color, which is light in
  // some themes, so the icon must switch to the control foreground to stay visible.
  test('a selected button uses the control foreground for its icon', () => {
    render(<IconButton selected><span>icon</span></IconButton>);
    const button = screen.getByText('icon').parentElement!;
    expect(button.className).toContain('bg-control');
    expect(button.className).toContain('text-control-text');
  });

  test('an unselected button keeps the inherited text color', () => {
    render(<IconButton><span>icon</span></IconButton>);
    const button = screen.getByText('icon').parentElement!;
    expect(button.className).not.toContain('text-control-text');
  });
});
