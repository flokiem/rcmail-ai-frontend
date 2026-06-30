import React, { useState, useEffect } from 'react';
import { listFolders } from '../../lib/api.js';
import { getCachedFolders, setCachedFolders } from '../../lib/mailCache.js';
import { decorateFolders } from '../inbox/folderMeta.js';

// Folder rail shown under an expanded account. Cache-first: shows the last-known
// folders instantly, then refreshes from IMAP in the background — so any folder
// added/removed on the server is reflected automatically on the next fetch.
export default function BoxFolders({ accountId, activeFolder, isActiveBox, onSelectFolder }) {
  const [folders, setFolders] = useState(() => {
    const cached = getCachedFolders(accountId);
    return cached ? decorateFolders(cached) : null;
  });
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const cached = getCachedFolders(accountId);
    setFolders(cached ? decorateFolders(cached) : null);
    setError('');
    listFolders(accountId)
      .then((raw) => { if (alive) { setFolders(decorateFolders(raw)); setCachedFolders(accountId, raw); } })
      .catch((e) => { if (alive && !cached) setError(e.message); }) // keep showing cache on error
      .finally(() => {});
    return () => { alive = false; };
  }, [accountId]);

  if (error) return <div className="fk-folder-note">Couldn't load folders</div>;
  if (!folders) return <div className="fk-folder-note">Loading folders…</div>;

  return (
    <div className="fk-folders">
      {folders.map((f) => {
        const active = isActiveBox && activeFolder === f.path;
        return (
          <button
            key={f.path}
            className={`fk-folder ${active ? 'active' : ''}`}
            onClick={() => onSelectFolder(f.path)}
          >
            <span className="fk-folder-ico">{f.icon}</span>
            <span className="fk-folder-name">{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
