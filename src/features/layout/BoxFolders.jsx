import React, { useState, useEffect } from 'react';
import { listFolders } from '../../lib/api.js';
import { getCachedFolders, setCachedFolders } from '../../lib/mailCache.js';
import { decorateFolders, groupFolders } from '../inbox/folderMeta.js';
import FolderIcon from '../inbox/FolderIcon.jsx';

// Folder rail shown under an expanded account. Cache-first: shows the last-known
// folders instantly, then refreshes from IMAP in the background — so any folder
// added/removed on the server is reflected automatically on the next fetch.
// Custom folders are nested under a collapsible "Folders (N)" group; special
// mailboxes sit top-level. Unread counts come from the backend (?counts=1).
export default function BoxFolders({ accountId, activeFolder, isActiveBox, onSelectFolder }) {
  const [folders, setFolders] = useState(() => {
    const cached = getCachedFolders(accountId);
    return cached ? decorateFolders(cached) : null;
  });
  const [error, setError] = useState('');
  const [groupOpen, setGroupOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    const cached = getCachedFolders(accountId);
    setFolders(cached ? decorateFolders(cached) : null);
    setError('');
    listFolders(accountId)
      .then((raw) => {
        setCachedFolders(accountId, raw);               // always cache, even if the box was collapsed mid-fetch
        if (alive) setFolders(decorateFolders(raw));
      })
      .catch((e) => { if (alive && !cached) setError(e.message); }); // keep showing cache on error
    return () => { alive = false; };
  }, [accountId]);

  if (error) return <div className="fk-folder-note">Couldn't load folders</div>;
  if (!folders) return <div className="fk-folder-note">Loading folders…</div>;

  const { primary, custom, system } = groupFolders(folders);

  const row = (f) => {
    const active = isActiveBox && activeFolder === f.path;
    return (
      <button key={f.path} className={`fk-folder ${active ? 'active' : ''}`} onClick={() => onSelectFolder(f.path)}>
        <span className="fk-folder-ico"><FolderIcon name={f.icon} /></span>
        <span className="fk-folder-name">{f.label}</span>
        {f.unread > 0 && <span className="fk-folder-count">{f.unread}</span>}
      </button>
    );
  };

  return (
    <div className="fk-folders">
      {primary.map(row)}

      {custom.length > 0 && (
        <div className="fk-folder-group">
          <button className="fk-folder fk-folder-grouphead" onClick={() => setGroupOpen((o) => !o)}>
            <span className="fk-folder-ico"><FolderIcon name="folder" /></span>
            <span className="fk-folder-name">Folders</span>
            <span className="fk-folder-count">{custom.length}</span>
            <span className={`fk-folder-chev ${groupOpen ? 'open' : ''}`}>›</span>
          </button>
          {groupOpen && <div className="fk-folder-children">{custom.map(row)}</div>}
        </div>
      )}

      {system.map(row)}
    </div>
  );
}
