import Phaser from 'phaser';
import { getTriviaScoreSummary } from './level-trivia.js';

function getScoreState() {
  if (!window.__globalScoreState) {
    window.__globalScoreState = {
      score: 0,
      maxScore: 100,
      stageStartScore: 0,
    };
  }
  return window.__globalScoreState;
}

/**
 * Returns current global score.
 * @returns {number}
 */
export function getGlobalScore() {
  return getScoreState().score;
}

/**
 * Resets global score to 0 and dispatches score update event.
 */
export function resetGlobalScore() {
  const state = getScoreState();
  state.score = 0;
  state.stageStartScore = 0;
  dispatchGlobalScoreUpdate();
}

/**
 * Records current global score at the start of a stage.
 */
export function recordStageStartScore() {
  const state = getScoreState();
  state.stageStartScore = state.score;
}

/**
 * Restores global score to what it was at the start of the current stage on Game Over retry.
 */
export function restoreStageStartScore() {
  const state = getScoreState();
  state.score = state.stageStartScore;
  dispatchGlobalScoreUpdate();
}

/**
 * Adds points to global score (capped at maxScore = 100) and displays a floating point gain popup in scene.
 * 
 * @param {Phaser.Scene} [scene] - The active Phaser scene to display popup in
 * @param {number} points - Number of points to add
 * @param {number} [x] - World X coordinate for popup
 * @param {number} [y] - World Y coordinate for popup
 */
export function addGlobalScore(scene, points, x, y) {
  if (!points || points <= 0) return;
  const state = getScoreState();
  state.score = Math.min(state.maxScore, state.score + points);
  dispatchGlobalScoreUpdate();

  if (scene && typeof x === 'number' && typeof y === 'number') {
    showPointPopup(scene, points, x, y);
  }
}

/**
 * Creates a floating popup text near the given coordinates (e.g. +2, +1, +3, +5).
 * 
 * @param {Phaser.Scene} scene 
 * @param {number} points 
 * @param {number} x 
 * @param {number} y 
 */
export function showPointPopup(scene, points, x, y) {
  if (!scene || !scene.add) return;

  const s = scene.s || 1;
  const popupX = x;
  const popupY = y - 30 * s;

  const textObj = scene.add.text(popupX, popupY, `+${points}`, {
    fontFamily: 'Outfit, Arial, sans-serif',
    fontSize: `${Math.round(18 * Math.max(1, s * 0.8))}px`,
    fontWeight: '900',
    fill: '#facc15',
    stroke: '#000000',
    strokeThickness: 4,
    shadow: { offsetX: 2, offsetY: 2, color: 'rgba(0,0,0,0.5)', blur: 2, fill: true }
  });
  textObj.setOrigin(0.5, 0.5);
  textObj.setDepth(9999);

  scene.tweens.add({
    targets: textObj,
    y: popupY - 40 * s,
    scaleX: { from: 0.6, to: 1.2 },
    scaleY: { from: 0.6, to: 1.2 },
    alpha: { from: 1, to: 0 },
    duration: 1000,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      textObj.destroy();
    }
  });
}

/**
 * Dispatches global score update event for UI overlays.
 */
export function dispatchGlobalScoreUpdate() {
  const summary = getGlobalScoreSummary();

  window.__globalScoreSummary = summary;

  window.dispatchEvent(new CustomEvent('global-score-updated', {
    detail: summary,
  }));

  window.dispatchEvent(new CustomEvent('trivia-score-updated', {
    detail: summary,
  }));
}

/**
 * Aggregates global score with trivia statistics for end screen and sharing.
 * @returns {Object}
 */
export function getGlobalScoreSummary() {
  const state = getScoreState();
  const triviaSummary = getTriviaScoreSummary();

  return {
    score: state.score,
    maxScore: state.maxScore,
    correctAnswers: triviaSummary.correctAnswers,
    answeredQuestions: triviaSummary.answeredQuestions,
    totalQuestions: triviaSummary.totalQuestions,
  };
}
