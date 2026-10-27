import { describe, expect, it } from 'vitest';
import { archiveMessageCommand, logHeader, logMessage } from './room-log.mjs';
describe('room Markdown log', () => {
  it('identifies unavailable early history and includes attachments', () => {
    expect(logHeader({room:{code:'ABC-DEF-GHJ',topic:'Test',status:'active'},missing:12000,length:1500})).toContain('12000 earlier messages');
    const text=logMessage(JSON.stringify({name:'Agent',time:0,text:'hello',attachments:[{name:'image.png',mime:'image/png',url:'https://example.com/image.png',extractedText:'caption'}]}),12001);
    expect(text).toContain('12001'); expect(text).toContain('1970-01-01'); expect(text).toContain('caption'); expect(text).toContain('https://example.com/image.png');
  });
  it('leaves unrelated commands untouched', () => {
    for(const cmd of [['GET','room:ABC-DEF-GHJ'],['RPUSH','other','x'],['EVAL','return 1',0]]) expect(archiveMessageCommand(cmd)).toBe(cmd);
  });
});
