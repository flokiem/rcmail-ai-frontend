// Persistent localStorage caches so the inbox list + opened emails render
// instantly across reloads. Keyed by account + folder (and uid for a read).
// Salvaged from the previous InboxPanel and made folder-aware.
const LS_LIST    = 'inbox.list.';    // + `${accountId}:${folder}`        -> messages[]
const LS_MAIL    = 'inbox.mail.';    // + `${accountId}:${folder}:${uid}` -> detail
const LS_FOLDERS = 'inbox.folders.'; // + `${accountId}`                  -> raw folders[]

const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / private mode */ } };

export const getCachedList = (id, folder)        => lsGet(`${LS_LIST}${id}:${folder}`);
export const setCachedList = (id, folder, msgs)  => lsSet(`${LS_LIST}${id}:${folder}`, msgs);
export const getCachedMail = (id, folder, uid)   => lsGet(`${LS_MAIL}${id}:${folder}:${uid}`);
export const setCachedMail = (id, folder, uid, d) => lsSet(`${LS_MAIL}${id}:${folder}:${uid}`, d);
export const getCachedFolders = (id)          => lsGet(`${LS_FOLDERS}${id}`);
export const setCachedFolders = (id, folders) => lsSet(`${LS_FOLDERS}${id}`, folders);
