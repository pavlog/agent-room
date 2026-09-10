export type HumanProfile = { name: string; role: string };
export const HUMAN_PROFILES_KEY = 'agent-room:human-profiles:v1';

export function parseHumanProfiles(raw: string | null): HumanProfile[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    const profiles: HumanProfile[] = [];
    for (const item of value) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || typeof item.role !== 'string') continue;
      const profile = { name: item.name.trim(), role: item.role.trim() };
      if (!profiles.some(p => p.name === profile.name && p.role === profile.role)) profiles.push(profile);
      if (profiles.length === 8) break;
    }
    return profiles;
  } catch { return []; }
}

export function rememberHumanProfile(storage: Pick<Storage, 'getItem' | 'setItem'>, profile: HumanProfile) {
  const profiles = parseHumanProfiles(JSON.stringify([profile, ...parseHumanProfiles(storage.getItem(HUMAN_PROFILES_KEY))]));
  storage.setItem(HUMAN_PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}
