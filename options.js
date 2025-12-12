import { getDomains, saveDomains, STORAGE_KEY } from './scripts/storage.js';

const form = document.getElementById('domain-form');
const input = document.getElementById('domain-input');
const listEl = document.getElementById('domain-list');
const feedbackEl = document.getElementById('feedback');

let domains = [];

function setFeedback(message, type = '') {
  feedbackEl.textContent = message;
  feedbackEl.className = `feedback ${type}`.trim();
}

function normalizeDomain(value) {
  if (typeof value !== 'string') {
    return '';
  }
  let text = value.trim().toLowerCase();
  if (!text) {
    return '';
  }
  text = text.replace(/^https?:\/\//, '');
  text = text.replace(/^www\./, '');
  text = text.replace(/^\*\./, '');
  text = text.split(/[/?#]/)[0];
  text = text.replace(/[^a-z0-9.-]/g, '');
  text = text.replace(/\.\.+/g, '.');
  text = text.replace(/^[-.]+|[-.]+$/g, '');
  return text;
}

function isValidDomain(value) {
  if (!value) {
    return false;
  }
  if (!value.includes('.')) {
    return false;
  }
  if (/\.\./.test(value)) {
    return false;
  }
  return true;
}

function renderList() {
  if (!domains.length) {
    listEl.innerHTML = '<li class="empty">ドメインが登録されていません。</li>';
    return;
  }
  listEl.innerHTML = '';
  domains.forEach((domain, index) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = domain;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '削除';
    button.addEventListener('click', () => removeDomain(index));
    item.appendChild(label);
    item.appendChild(button);
    listEl.appendChild(item);
  });
}

async function persistDomains() {
  try {
    await saveDomains(domains);
    setFeedback('保存しました', 'success');
  } catch (error) {
    setFeedback(`保存に失敗しました: ${error.message}`, 'error');
  }
}

async function addDomain(value) {
  const normalized = normalizeDomain(value);
  if (!isValidDomain(normalized)) {
    setFeedback('有効なドメインを入力してください', 'error');
    return;
  }
  if (domains.includes(normalized)) {
    setFeedback('このドメインは既に登録されています', 'error');
    return;
  }
  domains = [...domains, normalized];
  renderList();
  await persistDomains();
  input.value = '';
}

async function removeDomain(index) {
  domains = domains.filter((_, idx) => idx !== index);
  renderList();
  await persistDomains();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  setFeedback('');
  addDomain(input.value);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY]) {
    const newValue = changes[STORAGE_KEY].newValue;
    domains = Array.isArray(newValue) ? newValue.filter((item) => typeof item === 'string') : [];
    renderList();
  }
});

(async function init() {
  domains = await getDomains();
  renderList();
})();
