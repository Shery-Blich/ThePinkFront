// Fallback trivia, used only when the backend is unreachable. Generated from Mongo
// before each build by scripts/sync-questions.mjs; edit questions in the admin panel.
import fallbackQuestions from './fallback-questions.json';

// Normalized shape used by the rest of the game, regardless of source:
// { id: mongoId|null, text, options: string[], correctIndex: number|null }
// correctIndex is only known client-side for local-fallback questions —
// for API-sourced ones it stays null until the backend verifies an answer.
function normalizeLocal() {
  return fallbackQuestions.questions.map((q) => ({
    id: null,
    text: q.text,
    options: q.answers,
    correctIndex: q.correctAnswerIndex,
  }));
}

function normalizeApi(apiQuestions) {
  return apiQuestions.map((q) => ({
    id: q._id,
    text: q.text,
    options: q.answers.map((a) => a.text),
    correctIndex: null,
  }));
}

const API_BASE = import.meta.env?.VITE_API_URL ?? `${window.location.origin}/api`;

let _questions = normalizeLocal();
let _source = 'local';
let _loadPromise = null;

// Fetches questions from Mongo; falls back to the local set on any failure
// or empty response. Cached — safe to call repeatedly, only fetches once.
export function loadTriviaQuestions() {
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${API_BASE}/game/questions`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty response');
      _questions = normalizeApi(data);
      _source = 'api';
    } catch (err) {
      console.warn('[Trivia] Backend unavailable, using local fallback questions:', err.message);
      _questions = normalizeLocal();
      _source = 'local';
    }
  })();

  return _loadPromise;
}

// Pre-trigger early load when module is imported
loadTriviaQuestions();

export function getTriviaQuestions() {
  return _questions;
}

export function getTriviaSource() {
  return _source;
}
