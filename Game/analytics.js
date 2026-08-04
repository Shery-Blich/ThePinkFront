const SESSION_KEY = 'dykeathon_session_id';
const LOG_KEY = 'dykeathon_analytics_log';
const MAX_EVENTS = 100;
const API_BASE = import.meta.env?.VITE_API_URL ?? `${window.location.origin}/api`;

let _currentSessionId = sessionStorage.getItem(SESSION_KEY) || null;
let _mongoSessionId = null;
let _registeredSessionId = null;
let _registrationPromise = null;
let _endedSessionId = null;

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

export function trackGameStarted() {
  _startNewRun();
  trackEvent('game_started');
  _ensureSessionRegistered().catch(() => {});
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

// questionId is the Mongo _id for API-sourced questions, or null for local
// fallback ones. When null, knownIsCorrect (already computed client-side)
// is used as-is and no server verification call is made.
export async function trackQuestionAnswered(questionIndex, questionId, chosenIndex, timeMs, knownIsCorrect = null) {
  const sessionId = getSessionId();
  let isCorrect = knownIsCorrect;
  let correctAnswerIndex;

  if (questionId) {
    _ensureSessionRegistered(sessionId).then(async (mongoSessionId) => {
      if (sessionId === getSessionId() && mongoSessionId) {
        const result = await _postJson(`/game/sessions/${mongoSessionId}/answer`, {
          questionId,
          chosenAnswerIndex: chosenIndex,
          timeSpentMs: timeMs,
        });
        if (result) {
          isCorrect = result.isCorrect;
          correctAnswerIndex = result.correctAnswerIndex;
        }
      }
    }).catch(() => {});
  }

  trackEvent('question_answered', {
    question_index: questionIndex,
    selected_answer_index: chosenIndex,
    is_correct: isCorrect,
    time_to_answer_ms: timeMs,
  });

  return { isCorrect, correctAnswerIndex };
}

export function trackObstacleHit(obstacleType, sceneId, properties = {}) {
  trackEvent('obstacle_hit', { obstacle_type: obstacleType, scene_id: sceneId, ...properties });
}

export function trackGameCompleted(properties = {}) {
  const sessionId = getSessionId();
  trackEvent('game_completed', properties);
  _endSession(sessionId).catch(() => {});
}

export function trackGameFailed(properties = {}) {
  const sessionId = getSessionId();
  trackEvent('game_failed', properties);
  _endSession(sessionId).catch(() => {});
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
  _endedSessionId = null;
}

function _postToParent(event) {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'dykeathon_analytics_event', ...event }, '*');
    }
  } catch (_) {}
}

async function _fetchWithTimeout(url, options = {}, timeoutMs = 800) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (_) {
    clearTimeout(id);
    return null;
  }
}

async function _post(path, body) {
  try {
    const response = await _fetchWithTimeout(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response ? response.ok : false;
  } catch (_) {
    return false;
  }
}

async function _postJson(path, body) {
  try {
    const response = await _fetchWithTimeout(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response || !response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
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
    const res = await _fetchWithTimeout(`${API_BASE}/game/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!res || !res.ok) {
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

async function _endSession(sessionId) {
  if (_endedSessionId === sessionId) return;

  const mongoSessionId = await _ensureSessionRegistered(sessionId);
  if (!mongoSessionId || sessionId !== getSessionId()) return;

  const ended = await _post(`/game/sessions/${mongoSessionId}/end`, {});
  if (ended) {
    _endedSessionId = sessionId;
  }
}
