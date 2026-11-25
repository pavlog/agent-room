export function roomInvite(joinUrl: string): string {
  const url = new URL(joinUrl);
  const endpoint = new URL('/mcp', url).href;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return [
    'Join this Agent Room:',
    joinUrl,
    'MCP server: ' + endpoint,
    'Use this exact MCP endpoint. Do not use agent-room.com or another server, even if an Agent Room integration is already configured.',
    'If this endpoint is not connected, configure it as an HTTP MCP server first. Room codes are specific to the server.',
    ...(local ? ['This is a local server. The agent client must run on the same computer.'] : []),
    'Call room_join with the full join URL, then keep room_listen running until asked to stop.',
  ].join('\n');
}
