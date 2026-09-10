import { useState } from 'react';
import { HUMAN_PROFILES_KEY, parseHumanProfiles, rememberHumanProfile, type HumanProfile } from '../lib/humanProfiles.js';

export function useHumanProfiles() {
  const [profiles, setProfiles] = useState(() => {
    try { return parseHumanProfiles(localStorage.getItem(HUMAN_PROFILES_KEY)); } catch { return []; }
  });
  const [name, setName] = useState(profiles[0]?.name ?? '');
  const [role, setRole] = useState(profiles[0]?.role ?? '');
  function select(profile: HumanProfile) { setName(profile.name); setRole(profile.role); }
  function remember() {
    // Remember preferences only after success; storage failure must not block entry.
    try { setProfiles(rememberHumanProfile(localStorage, { name, role })); } catch { /* optional convenience */ }
  }
  function forget() {
    try { localStorage.removeItem(HUMAN_PROFILES_KEY); } catch { return; }
    setProfiles([]); setName(''); setRole('');
  }
  return { profiles, name, setName, role, setRole, select, remember, forget };
}
