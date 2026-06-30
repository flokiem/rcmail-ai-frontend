import { useState, useCallback } from 'react';

// Workspace/brand settings, persisted to localStorage (no backend yet — syncs
// with the planned mobile app later). `floki.brandName` is reused from Phase 1.
const LS = {
  workspaceName: 'floki.brandName',
  agentName:     'floki.agentName',
  replyToDomain: 'floki.replyToDomain',
  signature:     'floki.signature',
};
const DEFAULTS = {
  workspaceName: 'Floki',
  agentName:     'Floki',
  replyToDomain: 'floki.mail',
  signature:     'Sent on my behalf by Floki',
};
const get = (k, fb) => { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } };

export function useBrand() {
  const [brand, setBrand] = useState(() => ({
    workspaceName: get(LS.workspaceName, DEFAULTS.workspaceName),
    agentName:     get(LS.agentName, DEFAULTS.agentName),
    replyToDomain: get(LS.replyToDomain, DEFAULTS.replyToDomain),
    signature:     get(LS.signature, DEFAULTS.signature),
  }));

  const setField = useCallback((key, value) => {
    setBrand((b) => ({ ...b, [key]: value }));
    try { localStorage.setItem(LS[key], value); } catch { /* ignore */ }
  }, []);

  return { brand, setField };
}
