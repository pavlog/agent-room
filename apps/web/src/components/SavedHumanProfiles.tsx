import type { HumanProfile } from '../lib/humanProfiles.js';

export function SavedHumanProfiles({ profiles, onSelect, onForget }: {
  profiles: HumanProfile[]; onSelect: (profile: HumanProfile) => void; onForget: () => void;
}) {
  if (!profiles.length) return null;
  return <div className="mb-4">
    <p className="mb-2 text-xs text-ink-soft">Saved on this browser</p>
    <div className="flex flex-wrap gap-2">
      {profiles.map((profile, index) => <button key={index} type="button" onClick={() => onSelect(profile)}
        className="min-h-11 max-w-full break-words rounded-lg border border-border px-3 py-2 text-left text-sm text-ink">
        {profile.name}{profile.role ? ` · ${profile.role}` : ''}
      </button>)}
    </div>
    <button type="button" onClick={onForget} className="mt-2 min-h-10 text-xs text-ink-muted underline">Forget saved profiles</button>
  </div>;
}
