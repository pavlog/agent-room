import { describe, expect, it } from 'vitest';
import { taskInboxFor } from './taskInbox.js';
import type { TaskBoard } from './types.js';

describe('fork task inbox state boundaries', () => {
  it('does not order execution of blocked or terminal work', () => {
    const board = { tasks: ['blocked', 'rejected', 'cancelled', 'done'].map((state, i) => ({
      id: `T-${i}`, state, owner: 'Agent',
    })) } as TaskBoard;
    expect(taskInboxFor(board, 'Agent')).toMatchObject({ current: [], queued: [], toVerify: [], hint: '' });
  });
});
