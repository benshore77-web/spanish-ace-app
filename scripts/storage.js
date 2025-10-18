const STORAGE_KEY = "spanish-ace-progress-v1";

const defaultState = {
  words: {},
  history: []
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(defaultState));
}

export function loadProgress() {
  if (typeof localStorage === "undefined") {
    return cloneDefault();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefault();
    }
    const parsed = JSON.parse(raw);
    return {
      words: parsed.words || {},
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (error) {
    console.warn("Failed to load stored progress", error);
    return cloneDefault();
  }
}

export function saveProgress(state) {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getWordId(topicId, english) {
  return `${topicId}__${english.toLowerCase()}`;
}

export function ensureWord(state, topicId, word) {
  const id = getWordId(topicId, word.english);
  if (!state.words[id]) {
    state.words[id] = {
      id,
      topicId,
      english: word.english,
      spanish: word.spanish,
      repetitions: 0,
      interval: 0,
      efactor: 2.5,
      due: Date.now(),
      lastReviewed: null,
      correct: 0,
      incorrect: 0,
      streak: 0
    };
  }
  return state.words[id];
}

export function updateWord(state, id, updater) {
  const existing = state.words[id];
  if (!existing) return;
  const updated = { ...existing, ...updater(existing) };
  state.words[id] = updated;
  return updated;
}

export function recordHistory(state, entry) {
  const stamped = { ...entry, timestamp: Date.now() };
  state.history.unshift(stamped);
  if (state.history.length > 250) {
    state.history.length = 250;
  }
}

export function getRecentHistory(state, limit = 12) {
  return state.history.slice(0, limit);
}
