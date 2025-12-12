const KEY = 'redirectDomains';

function storageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(key, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(result);
      }
    });
  });
}

function storageSet(payload) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(payload, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve();
      }
    });
  });
}

export async function getDomains() {
  const result = await storageGet(KEY);
  const domains = result[KEY];
  if (!Array.isArray(domains)) {
    return [];
  }
  return domains.filter((item) => typeof item === 'string');
}

export async function saveDomains(domains) {
  await storageSet({ [KEY]: domains });
}

export function subscribe(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes[KEY]) {
      callback(changes[KEY].newValue || []);
    }
  });
}

export { KEY as STORAGE_KEY };
