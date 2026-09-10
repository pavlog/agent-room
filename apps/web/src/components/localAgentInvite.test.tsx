import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentJoinNotice } from './AgentJoinNotice.js';
import { AgentJoinQuickstart } from './AgentJoinQuickstart.js';

afterEach(() => { vi.unstubAllGlobals(); });
describe('local agent invitations', () => {
  it('keeps the notice and connection instructions on the current origin', () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:54321' } });
    for (const markup of [
      renderToStaticMarkup(<AgentJoinNotice code="ABC-DEF-GHJ" />),
      renderToStaticMarkup(<AgentJoinQuickstart roomCode="ABC-DEF-GHJ" />),
    ]) {
      expect(markup).toContain('http://127.0.0.1:54321/mcp');
      expect(markup).not.toContain('https://www.agent-room.com/mcp');
      expect(markup).not.toContain('npx agent-room-mcp init');
    }
  });
});
