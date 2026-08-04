import { loadTriviaQuestions, getTriviaQuestions } from '../data/trivia-questions.js';
import { getGlobalScore } from './score-manager.js';

const TRIVIA_SCENE_ORDER = [
  'Day1Scene',
  'Day2Scene',
  'Day3Scene',
  'Day4Scene',
  'Day5Scene',
  'KotelScene',
  'KalpiScene',
];

function getTriviaState() {
  if (!window.__levelTriviaState) {
    window.__levelTriviaState = {
      nextQuestionIndex: 0,
      score: 0,
      correctAnswers: 0,
      answeredQuestions: 0,
    };
  }

  return window.__levelTriviaState;
}

function getMaxScore() {
  return 100;
}

function getPointsPerCorrect() {
  const total = getTriviaQuestions().length;
  if (total === 0) return 0;
  return getMaxScore() / total;
}

function dispatchScoreUpdate() {
  const state = getTriviaState();

  window.dispatchEvent(new CustomEvent('trivia-score-updated', {
    detail: {
      score: getGlobalScore(),
      maxScore: getMaxScore(),
      correctAnswers: state.correctAnswers,
      answeredQuestions: state.answeredQuestions,
      totalQuestions: getTriviaQuestions().length,
      pointsPerCorrect: getPointsPerCorrect(),
    },
  }));
}

function getSceneQuestionCount(sceneKey) {
  const sceneIndex = TRIVIA_SCENE_ORDER.indexOf(sceneKey);
  if (sceneIndex === -1) {
    console.warn(`[Trivia Debug] Scene key "${sceneKey}" not found in TRIVIA_SCENE_ORDER`);
    return 0;
  }

  const state = getTriviaState();
  const questionsRemaining = getTriviaQuestions().length - state.nextQuestionIndex;
  const levelsRemaining = TRIVIA_SCENE_ORDER.length - sceneIndex;

  console.log(`[Trivia Debug] getSceneQuestionCount: sceneKey=${sceneKey}, nextQuestionIndex=${state.nextQuestionIndex}, questionsRemaining=${questionsRemaining}, levelsRemaining=${levelsRemaining}`);

  if (questionsRemaining <= 0) return 0;
  if (questionsRemaining > levelsRemaining) return 2;
  return 1;
}

function showTriviaQuestion(scene, questionIndex, totalQuestions) {
  return new Promise((resolve) => {
    const qData = getTriviaQuestions()[questionIndex];
    if (!qData) {
      resolve();
      return;
    }

    const onTriviaComplete = (event) => {
      if (event.detail.questionIndex !== questionIndex) return;
      window.removeEventListener('trivia-complete', onTriviaComplete);
      scene.events.off('shutdown', cleanupListener);
      resolve(event.detail);
    };

    const cleanupListener = () => {
      window.removeEventListener('trivia-complete', onTriviaComplete);
      resolve();
    };

    let portraitBase64 = null;
    try {
      portraitBase64 = scene.textures.getBase64('solberg_portrait');
    } catch (err) {
      console.warn('Could not extract solberg_portrait base64:', err);
    }

    const scoreSummary = getTriviaScoreSummary();

    window.addEventListener('trivia-complete', onTriviaComplete);
    scene.events.once('shutdown', cleanupListener);
    window.dispatchEvent(new CustomEvent('show-trivia', {
      detail: {
        questionIndex,
        questionId: qData.id,
        questionText: qData.text,
        options: qData.options,
        correctIndex: qData.correctIndex,
        portraitDataUrl: portraitBase64,
        totalQuestions,
        score: scoreSummary.score,
        maxScore: scoreSummary.maxScore,
        theme: 'stone',
      },
    }));
  });
}

export async function runLevelTrivia(scene, sceneKey) {
  try {
    await loadTriviaQuestions();

    const questions = getTriviaQuestions();
    const state = getTriviaState();

    if (!questions || questions.length === 0 || state.nextQuestionIndex >= questions.length) {
      console.log(`[Trivia Debug] No available trivia questions for "${sceneKey}". Proceeding directly.`);
      return;
    }

    const questionCount = getSceneQuestionCount(sceneKey);
    console.log(`[Trivia Debug] runLevelTrivia: starting trivia sequence for "${sceneKey}" with ${questionCount} questions`);
    if (questionCount === 0) return;

    const startIndex = state.nextQuestionIndex;

    for (let offset = 0; offset < questionCount; offset += 1) {
      const qIdx = startIndex + offset;
      if (!questions[qIdx]) {
        console.warn(`[Trivia Debug] Question at index ${qIdx} is missing for "${sceneKey}". Skipping to next scene.`);
        break;
      }

      const result = await showTriviaQuestion(scene, qIdx, questionCount);

      if (result?.questionIndex === undefined) continue;

      state.answeredQuestions += 1;
      if (result.isCorrect) {
        state.correctAnswers += 1;
      }
      dispatchScoreUpdate();
    }

    state.nextQuestionIndex += Math.min(questionCount, questions.length - startIndex);
  } catch (err) {
    console.warn(`[Trivia Warning] Error running level trivia for "${sceneKey}", continuing cleanly:`, err);
  }
}

export function resetLevelTrivia() {
  window.__levelTriviaState = {
    nextQuestionIndex: 0,
    score: 0,
    correctAnswers: 0,
    answeredQuestions: 0,
  };
  loadTriviaQuestions(); // kick off early so it's likely resolved by the first question
  dispatchScoreUpdate();
}

export function getTriviaScoreSummary() {
  const state = getTriviaState();
  const globalScore = window.__globalScoreState ? window.__globalScoreState.score : 0;
  return {
    score: globalScore,
    maxScore: getMaxScore(),
    correctAnswers: state.correctAnswers,
    answeredQuestions: state.answeredQuestions,
    totalQuestions: getTriviaQuestions().length,
    pointsPerCorrect: getPointsPerCorrect(),
  };
}

export function hasLevelTrivia(sceneKey) {
  const questions = getTriviaQuestions();
  const state = getTriviaState();
  if (!questions || questions.length === 0 || state.nextQuestionIndex >= questions.length) {
    return false;
  }
  return getSceneQuestionCount(sceneKey) > 0;
}
