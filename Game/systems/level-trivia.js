import { TRIVIA_QUESTIONS } from '../data/trivia-questions.js';

const TRIVIA_SCENE_ORDER = [
  'Day1Scene',
  'Day2Scene',
  'Day3Scene',
  'Day4Scene',
  'Day5Scene',
  'KotelScene',
];

function getTriviaState() {
  if (!window.__levelTriviaState) {
    window.__levelTriviaState = { nextQuestionIndex: 0 };
  }

  return window.__levelTriviaState;
}

function getSceneQuestionCount(sceneKey) {
  const sceneIndex = TRIVIA_SCENE_ORDER.indexOf(sceneKey);
  if (sceneIndex === -1) return 0;

  const state = getTriviaState();
  const questionsRemaining = TRIVIA_QUESTIONS.length - state.nextQuestionIndex;
  const levelsRemaining = TRIVIA_SCENE_ORDER.length - sceneIndex;

  if (questionsRemaining <= 0) return 0;
  if (questionsRemaining > levelsRemaining) return 2;
  return 1;
}

function showTriviaQuestion(scene, questionIndex, totalQuestions) {
  return new Promise((resolve) => {
    const qData = TRIVIA_QUESTIONS[questionIndex];
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

    window.addEventListener('trivia-complete', onTriviaComplete);
    scene.events.once('shutdown', cleanupListener);
    window.dispatchEvent(new CustomEvent('show-trivia', {
      detail: {
        questionIndex,
        questionText: qData[0],
        options: qData[1],
        correctIndex: qData[2],
        portraitDataUrl: portraitBase64,
        totalQuestions,
      },
    }));
  });
}

export async function runLevelTrivia(scene, sceneKey) {
  const questionCount = getSceneQuestionCount(sceneKey);
  if (questionCount === 0) return;

  const state = getTriviaState();
  const startIndex = state.nextQuestionIndex;

  for (let offset = 0; offset < questionCount; offset += 1) {
    await showTriviaQuestion(scene, startIndex + offset, questionCount);
  }

  state.nextQuestionIndex += questionCount;
}

export function resetLevelTrivia() {
  window.__levelTriviaState = { nextQuestionIndex: 0 };
}
