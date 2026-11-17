// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { downloadText } from './download';

afterEach(() => { vi.restoreAllMocks(); });

test('downloadText clicks a temporary anchor pointing at a Blob of the text and revokes it', async () => {
  let blob: Blob | undefined;
  const createObjectURL = vi.fn((value: Blob) => { blob = value; return 'blob:records'; });
  const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  let clicked: { download: string; href: string; attached: boolean } | undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked = { download: this.download, href: this.href, attached: document.body.contains(this) };
  });

  downloadText('tags.csv', 'ID,Notes\r\n', 'text/csv');

  expect(clicked).toEqual({ download: 'tags.csv', href: 'blob:records', attached: true });
  expect(blob?.type).toBe('text/csv');
  expect(await blob?.text()).toBe('ID,Notes\r\n');
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:records');
  expect(document.querySelectorAll('a')).toHaveLength(0);
});
