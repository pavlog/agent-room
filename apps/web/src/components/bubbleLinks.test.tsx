import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Message } from '@agent-room/shared';
import { Bubble } from './Bubble.js';

function markup(text: string) {
  return renderToStaticMarkup(<Bubble self={false} message={{
    id: 1, type: 'msg', text, name: 'Example', initials: 'EX', color: 'blue', time: 0,
    role: '', client: 'web',
  } satisfies Message} />);
}

describe('message autolinks', () => {
  it.each([
    ['https://example.org/Topic_(details)', 'https://example.org/Topic_(details)'],
    ['(https://example.org/Topic_(details)).', 'https://example.org/Topic_(details)'],
    ['https://example.org/a_(b_(c))!', 'https://example.org/a_(b_(c))'],
    ['https://[::1]', 'https://[::1]'],
    ['[https://example.org/path].', 'https://example.org/path'],
    ['https://example.org/path,', 'https://example.org/path'],
  ])('preserves the URL in %s', (text, expected) => {
    const html = markup(text);
    expect(html).toContain(`href="${expected}"`);
    expect(html).toContain(`>${expected}</a>`);
  });

  it('leaves removed punctuation visible outside the link', () => {
    expect(markup('(https://example.org/path).')).toContain('</a>).');
  });
});
