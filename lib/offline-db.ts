import { OfflineRecord, Assessment } from './types';

const DB_NAME = 'nototrack-offline';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('assessments')) {
        db.createObjectStore('assessments', { keyPath: 'offline_id' });
      }

      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };
  });
}

export async function saveAssessment(
  assessment: Assessment
): Promise<Assessment> {
  const db = await openDB();
  const tx = db.transaction(['assessments'], 'readwrite');
  const store = tx.objectStore('assessments');

  if (!assessment.offline_id) {
    assessment.offline_id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  return new Promise((resolve, reject) => {
    const request = store.put(assessment);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(assessment);
  });
}

export async function getAssessments(): Promise<Assessment[]> {
  const db = await openDB();
  const tx = db.transaction(['assessments'], 'readonly');
  const store = tx.objectStore('assessments');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve((request.result as Assessment[]) || []);
    };
  });
}

export async function deleteAssessment(offlineId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['assessments'], 'readwrite');
  const store = tx.objectStore('assessments');

  return new Promise((resolve, reject) => {
    const request = store.delete(offlineId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function saveToQueue(record: OfflineRecord): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['queue'], 'readwrite');
  const store = tx.objectStore('queue');

  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getQueue(): Promise<OfflineRecord[]> {
  const db = await openDB();
  const tx = db.transaction(['queue'], 'readonly');
  const store = tx.objectStore('queue');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve((request.result as OfflineRecord[]) || []);
    };
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['queue'], 'readwrite');
  const store = tx.objectStore('queue');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.filter((item) => item.status === 'pending').length;
}

export async function clearSynced(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['queue'], 'readwrite');
  const store = tx.objectStore('queue');

  const queue = await getQueue();
  const syncedIds = queue
    .filter((item) => item.status === 'synced')
    .map((item) => item.id);

  return new Promise((resolve, reject) => {
    let count = 0;
    syncedIds.forEach((id) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        count++;
        if (count === syncedIds.length) {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    if (syncedIds.length === 0) {
      resolve();
    }
  });
}
