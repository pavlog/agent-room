import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { touchPresence, setListenUntil } from '../api/_mcpRoomClient.js';
const suite = process.env.AGENT_ROOM_TEST_REDIS_URL ? describe : describe.skip;
suite('MCP activity presence', () => {
  const redis=createClient({url:process.env.AGENT_ROOM_TEST_REDIS_URL});
  const code='ABC-DEF-GHJ', key=`room:${code}`;
  const client={store:{command:(cmd:unknown[])=>redis.sendCommand(cmd.map(String))}} as never;
  const lease=Date.now()+60000;
  beforeAll(async()=>{await redis.connect();await redis.set(key,JSON.stringify({version:1,status:'active',topic:'Test',customEmptyList:[],participants:[
    {name:'Agent',client:'cc',lastSeenAt:1,listenUntil:lease},
    {name:'Agent',client:'web',lastSeenAt:2},
    {name:'Other',client:'cc',lastSeenAt:3},
  ]}),{EX:600});});
  afterAll(async()=>{await redis.del(key);await redis.quit();});
  it('refreshes the agent without clearing its lease, changing other seats or extending TTL',async()=>{
    await Promise.all([touchPresence(client,code,'Agent'),touchPresence(client,code,'Other')]);
    const room=JSON.parse((await redis.get(key))!);
    expect(room.participants[0].lastSeenAt).toBeGreaterThan(3);
    expect(room.participants[0].listenUntil).toBe(lease);
    expect(room.participants[1].lastSeenAt).toBe(2);
    expect(room.participants[2].lastSeenAt).toBeGreaterThan(3);
    expect(room.topic).toBe('Test');
    expect(room.customEmptyList).toEqual([]);
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    expect(await redis.ttl(key)).toBeLessThanOrEqual(600);
  });
  it('does not create a missing participant',async()=>{
    const before=await redis.get(key);await touchPresence(client,code,'Removed');
    expect(await redis.get(key)).toBe(before);
  });
  it('releases a listen lease while keeping recent activity',async()=>{
    await setListenUntil(client,code,'Agent',1);
    const room=JSON.parse((await redis.get(key))!);
    expect(room.participants[0].listenUntil).toBe(1);
    expect(room.participants[0].lastSeenAt).toBeGreaterThan(3);
  });
  it('does not fail a successful request if presence storage fails',async()=>{
    const broken={store:{command:async()=>{throw Error('Offline')}}} as never;
    await expect(touchPresence(broken,code,'Agent')).resolves.toBeUndefined();
  });
});
