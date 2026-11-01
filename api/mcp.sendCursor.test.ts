import { beforeEach, describe, expect, it, vi } from 'vitest';
const { append, batch } = vi.hoisted(() => ({ append: vi.fn(), batch: vi.fn() }));
vi.mock('./_mcpRoomClient.js', async original => ({
  ...await original<typeof import('./_mcpRoomClient.js')>(),
  getRoom: async () => ({ code:'ABC-DEF-GHJ',createdBy:'Host',status:'active',participants:[
    {name:'Agent',client:'cc',role:'Reviewer',canSpeak:true,color:'#000',initials:'AG'},
  ] }),
  appendMessage: append,
  readMessageBatch: batch,
}));
import { callTool } from './_mcpTools.js';
const send = async (extra: Record<string, unknown> = {}) => {
  const result = await callTool({} as never,'full','room_send',{
    code:'ABC-DEF-GHJ',name:'Agent',text:'Update',...extra,
  });
  return JSON.parse((result.content[0] as {text:string}).text);
};
beforeEach(() => { append.mockReset(); batch.mockReset(); });
describe('send never advances read progress', () => {
  it.each([
    {appended:true},
    {appended:false,reason:'no_addition'},
    {appended:true,metadata:{roleAtSend:'status',extendsTurn:true}},
  ])('preserves the supplied read cursor for %j', async outcome => {
    append.mockResolvedValue(outcome);
    const result = await send({since:42});
    expect(result.cursor).toBe(42);
    expect(result.nextAction.arguments).toEqual({code:'ABC-DEF-GHJ',since:42,name:'Agent'});
    expect(batch).not.toHaveBeenCalled();
  });
  it.each([undefined, 0])('does not invent a cursor when since is %s', async since => {
    append.mockResolvedValue({appended:false,reason:'no_addition'});
    const result = await send({since});
    if (since === undefined) {
      expect(result).not.toHaveProperty('cursor');expect(result).not.toHaveProperty('nextAction');
      expect(result.hint).toContain('last processed read cursor');
    } else expect(result.cursor).toBe(0);
  });
  it.each([-1,1.5,'42',null,Number.MAX_SAFE_INTEGER+1])('rejects invalid since %s before sending', async since => {
    expect((await send({since})).sent).toBe(false);
    expect(append).not.toHaveBeenCalled();
  });
});
