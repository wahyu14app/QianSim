export const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QianWorkspaceDB', 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as any).result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    request.onsuccess = (e) => resolve((e.target as any).result);
    request.onerror = (e) => reject((e.target as any).error);
  });
};

export const saveWorkspaceHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    const req = store.put(handle, 'workspace');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getWorkspaceHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const store = tx.objectStore('handles');
    const req = store.get('workspace');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
};

export const clearWorkspaceHandle = async (): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    const req = store.delete('workspace');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const verifyWorkspacePermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
  const opts = { mode: 'readwrite' as const };
  const h = handle as any;
  if ((await h.queryPermission(opts)) === 'granted') {
    return true;
  }
  if ((await h.requestPermission(opts)) === 'granted') {
    return true;
  }
  return false;
};
