import { TRIVIA_QUESTIONS } from './data/trivia-questions.js';

const SESSION_KEY = 'dykeathon_session_id';
const LOG_KEY = 'dykeathon_analytics_log';
const MAX_EVENTS = 100;
const API_BASE = import.meta.env?.VITE_API_URL ?? `${window.location.origin}/api`;

let _currentSessionId = sessionStorage.getItem(SESSION_KEY) || null;
let _mongoSessionId = null;
let _registeredSessionId = null;
let _registrationPromise = null;
let _questionIdsPromise = null;
let _endedSessionId = null;
const _questionIds = {}; // local index → MongoDB ObjectId

export function getSessionId() {
  if (!_currentSessionId) {
    _currentSessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, _currentSessionId);
  }
  return _currentSessionId;
}

export function trackEvent(eventName, properties = {}) {
  const event = {
    event_name: eventName,
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
    properties,
  };
  console.log(`[Analytics] ${eventName}`, properties);
  _buffer(event);
  _postToParent(event);
  return event;
}

export async function trackGameStarted() {
  _startNewRun();
  trackEvent('game_started');
  await _ensureSessionRegistered();
  await _ensureQuestionIdsLoaded();
}

export function trackSceneStarted(sceneId) {
  trackEvent('scene_started', { scene_id: sceneId });
}

export function trackSceneCompleted(sceneId, properties = {}) {
  trackEvent('scene_completed', { scene_id: sceneId, ...properties });
}

export function trackFirstMove(properties = {}) {
  trackEvent('first_move', properties);
}

export function trackQuestionShown(questionIndex, questionText) {
  trackEvent('question_shown', {
    question_index: questionIndex,
    question_preview: String(questionText).slice(0, 50),
  });
}

export async function trackQuestionAnswered(questionIndex, chosenIndex, isCorrect, timeMs) {
  const sessionId = getSessionId();
  trackEvent('question_answered', {
    question_index: questionIndex,
    selected_answer_index: chosenIndex,
    is_correct: isCorrect,
    time_to_answer_ms: timeMs,
  });

  const mongoSessionId = await _ensureSessionRegistered(sessionId);
  const mongoQuestionId = await _getQuestionId(questionIndex);
  if (sessionId !== getSessionId()) return;

  if (mongoSessionId && mongoQuestionId) {
    await _post(`/game/sessions/${mongoSessionId}/answer`, {
      questionId: mongoQuestionId,
      chosenAnswerIndex: chosenIndex,
      timeSpentMs: timeMs,
    });
  }
}

export function trackObstacleHit(obstacleType, sceneId, properties = {}) {
  trackEvent('obstacle_hit', { obstacle_type: obstacleType, scene_id: sceneId, ...properties });
}

export async function trackGameCompleted(properties = {}) {
  const sessionId = getSessionId();
  trackEvent('game_completed', properties);
  await _endSession(sessionId);
}

export async function trackGameFailed(properties = {}) {
  const sessionId = getSessionId();
  trackEvent('game_failed', properties);
  await _endSession(sessionId);
}

export function trackEndLinkClicked(linkType) {
  trackEvent('end_link_clicked', { link_type: linkType });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function _buffer(event) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    log.push(event);
    if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch (_) {}
}

function _startNewRun() {
  _currentSessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, _currentSessionId);
  _mongoSessionId = null;
  _registeredSessionId = null;
  _registrationPromise = null;
  _questionIdsPromise = null;
  _endedSessionId = null;
  Object.keys(_questionIds).forEach((key) => delete _questionIds[key]);
}

function _postToParent(event) {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'dykeathon_analytics_event', ...event }, '*');
    }
  } catch (_) {}
}

async function _post(path, body) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch (_) {
    return false;
  }
}

async function _ensureSessionRegistered(sessionId = getSessionId()) {
  if (_registeredSessionId === sessionId && _mongoSessionId) {
    return _mongoSessionId;
  }

  if (_registrationPromise && _registeredSessionId === sessionId) {
    return _registrationPromise;
  }

  _registeredSessionId = sessionId;
  _registrationPromise = _registerSession(sessionId);
  return _registrationPromise;
}

async function _registerSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/game/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
      if (res.status === 409 && sessionId === getSessionId()) {
        _startNewRun();
        return _ensureSessionRegistered();
      }
      if (sessionId === getSessionId()) {
        _registrationPromise = null;
      }
      return null;
    }

    const data = await res.json();
    if (sessionId === getSessionId()) {
      _mongoSessionId = data.id;
    }
    return data.id;
  } catch (_) {
    if (sessionId === getSessionId()) {
      _registrationPromise = null;
    }
    return null;
  }
}

async function _ensureQuestionIdsLoaded() {
  if (_questionIdsPromise) return _questionIdsPromise;

  _questionIdsPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/game/questions`);
      if (!res.ok) {
        _questionIdsPromise = null;
        return;
      }
      const backendQuestions = await res.json();

      TRIVIA_QUESTIONS.forEach((localQ, idx) => {
        const localText = localQ[0];
        const match = backendQuestions.find((bq) => bq.text === localText);
        if (match) _questionIds[idx] = match._id;
      });
    } catch (_) {
      _questionIdsPromise = null;
    }
  })();

  return _questionIdsPromise;
}

async function _getQuestionId(questionIndex) {
  await _ensureQuestionIdsLoaded();
  return _questionIds[questionIndex] ?? null;
}

async function _endSession(sessionId) {
  if (_endedSessionId === sessionId) return;

  const mongoSessionId = await _ensureSessionRegistered(sessionId);
  if (!mongoSessionId || sessionId !== getSessionId()) return;

  const ended = await _post(`/game/sessions/${mongoSessionId}/end`, {});
  if (ended) {
    _endedSessionId = sessionId;
  }
}
