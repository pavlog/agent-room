import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { archiveMessageCommand, roomLogSnapshot, streamRoomLog, restoreRoomLogPrefix } from './room-log.mjs';
import { appendMessage } from '../packages/upstash-client/src/messages.js';
import { deleteLocalRoom } from './delete-local-room.mjs';
import { Writable } from 'node:stream';
const suite = process.env.AGENT_ROOM_TEST_REDIS_URL ? describe : describe.skip;
suite('full local archive', () => {
  const redis = createClient({url:process.env.AGENT_ROOM_TEST_REDIS_URL});
  const code='ABC-DEF-GHJ';
  const keys=['room:','room-msgs:','room-msg-count:','room-log:','room-log-start:'].map(p=>p+code);
  const cmd = (c: any[]) => redis.sendCommand(archiveMessageCommand(c).map(String));
  const message = (id:number) => ({id,name:'Tester',client:'web',text:`message ${id}`,time:id,type:'msg',role:'',color:'#000',initials:'TE'});
  beforeAll(async()=>{await redis.connect(); await redis.del(keys); await redis.set(keys[0],JSON.stringify({code,topic:'Test',createdBy:'Tester',createdAt:Date.now(),status:'active',participants:[{name:'Tester',client:'web',canSpeak:true}]}),{EX:3600});});
  afterAll(async()=>{await redis.del(keys);await redis.quit();});
  it('archives legacy and atomic writes beyond the recent history cap',async()=>{
    for(let i=0;i<1050;i++) {
      await cmd(['RPUSH',keys[1],JSON.stringify(message(i))]);
      await cmd(['INCR',keys[2]]);
      await cmd(['LTRIM',keys[1],-1000,-1]);
    }
    const store={command:cmd,pipeline:(cs:any[])=>Promise.all(cs.map(cmd))};
    await appendMessage(store as never,code,message(1050) as never);
    const snapshot=await roomLogSnapshot(redis,code);
    expect(snapshot.missing).toBe(0);expect(snapshot.length).toBe(1051);
    expect(await redis.lLen(keys[1])).toBe(1000);
    expect(await redis.ttl(keys[3])).toBeGreaterThan(0);
    let text=''; const response=new Writable({write(chunk,_,done){text+=chunk.toString();done();}});
    await streamRoomLog(redis,code,snapshot,response);
    expect(text).toContain('message 0');expect(text).toContain('message 1050');
    expect((text.match(/^## /gm)||[]).length).toBe(1051);
    expect(JSON.parse((await redis.get(keys[0]))!).status).toBe('active');
  });
  it('seeds a pre-existing trimmed room once and reports its gap',async()=>{
    await redis.del([keys[3],keys[4]]);
    const first=await roomLogSnapshot(redis,code);
    expect(first.missing).toBe(51);expect(first.length).toBe(1000);
    expect(await roomLogSnapshot(redis,code)).toEqual(first);
  });
  it('restores only matching prefixes and refuses inconsistent backups', async () => {
    const recovered = {missing:0,rows:Array.from({length:52},(_,i)=>JSON.stringify(message(i)))};
    const bad = {...recovered, rows:[...recovered.rows]};bad.rows[51]='mismatch';
    await expect(restoreRoomLogPrefix(redis,code,bad)).rejects.toThrow('does not match');
    expect(await restoreRoomLogPrefix(redis,code,recovered)).toBe(51);
    expect((await roomLogSnapshot(redis,code)).length).toBe(1051);
    expect(await restoreRoomLogPrefix(redis,code,recovered)).toBe(0);
  });
  it('only removes the archive when an ended room is deleted', async () => {
    expect(await deleteLocalRoom(redis, code)).toBe('active');
    expect(await redis.exists(keys[3])).toBe(1);
    const room = JSON.parse((await redis.get(keys[0]))!);room.status='ended';
    await redis.set(keys[0], JSON.stringify(room));
    expect(await deleteLocalRoom(redis, code)).toBe('deleted');
    expect(await redis.exists(keys[3])).toBe(0);expect(await redis.exists(keys[4])).toBe(0);
  });
});
