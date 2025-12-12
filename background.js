import { getDomains, STORAGE_KEY } from './scripts/storage.js';

const REDIRECT_URL = 'https://www.google.com/';
let cachedDomains = [];

function normalizeForFilter(input) {
  if (typeof input !== 'string') {
    return null;
  }
  let value = input.trim().toLowerCase();
  if (!value) {
    return null;
  }
  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/^www\./, '');
  value = value.replace(/^\*\./, '');
  value = value.split(/[/?#]/)[0];
  value = value.replace(/\*/g, '');
  if (!value) {
    return null;
  }
  return value;
}

function buildRules(domains) {
  const seen = new Set();
  let nextId = 1;
  const rules = [];
  domains.forEach((domain) => {
    const cleaned = normalizeForFilter(domain);
    if (!cleaned || seen.has(cleaned)) {
      return;
    }
    seen.add(cleaned);
    rules.push({
      id: nextId,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: REDIRECT_URL }
      },
      condition: {
        urlFilter: `||${cleaned}^`,
        resourceTypes: ['main_frame']
      }
    });
    nextId += 1;
  });
  return rules;
}

async function rebuildRules() {
  const rules = buildRules(cachedDomains);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: rules
  });
}

async function loadAndApplyRules() {
  cachedDomains = await getDomains();
  await rebuildRules();
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY]) {
    const newValue = changes[STORAGE_KEY].newValue;
    cachedDomains = Array.isArray(newValue) ? newValue : [];
    await rebuildRules();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  loadAndApplyRules().catch((error) => {
    console.error('Failed to initialize redirect rules on install', error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  loadAndApplyRules().catch((error) => {
    console.error('Failed to initialize redirect rules on startup', error);
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage().catch((error) => {
    console.error('Failed to open options page', error);
  });
});

loadAndApplyRules().catch((error) => {
  console.error('Failed to initialize redirect rules', error);
});
