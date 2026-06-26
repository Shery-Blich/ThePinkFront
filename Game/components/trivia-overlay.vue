<template>
  <div v-if="isActive" class="trivia-overlay-container">
    <!-- Dark screen dimmer block -->
    <div class="trivia-dimmer"></div>

    <!-- Master UI Panel -->
    <div class="trivia-panel" :class="'theme-' + theme">
      <div class="score-chip">
        ניקוד: {{ score }} / {{ maxScore }}
      </div>

      <!-- 1. SOLBERG DIALOGUE CARD & PORTRAIT (Centered Top) -->
      <div class="solberg-card-row">
        <!-- Dialogue box with dynamic height -->
        <div class="solberg-dialogue-box">
          <div class="dialogue-text">
            {{ questionText }}
          </div>
        </div>

        <!-- Solberg Portrait box -->
        <div class="solberg-portrait-box">
          <img 
            v-if="portraitDataUrl" 
            :src="portraitDataUrl" 
            alt="Solberg Portrait" 
            class="solberg-portrait" 
          />
          <div v-else class="solberg-portrait-fallback"></div>
        </div>
      </div>

      <!-- 2. MULTIPLE CHOICE OPTION GRID (2 rows x 2 columns) -->
      <div class="options-grid">
        <div 
          v-for="(option, index) in options" 
          :key="index"
          class="option-box"
          :class="getOptionClass(index)"
          @mouseover="selectOption(index)"
          @click="confirmAnswer(index)"
        >
          <div class="option-text">
            {{ getOptionLabel(index) }}: {{ option }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { trackQuestionShown, trackQuestionAnswered } from '../analytics.js';
export default {
  name: 'TriviaOverlay',
  data() {
    return {
      isActive: false,
      questionIndex: 0,
      questionText: '',
      options: [],
      correctIndex: 0,
      portraitDataUrl: null,
      totalQuestions: 4,
      score: 0,
      maxScore: 0,
      theme: 'stone',

      // State trackers
      selectedIndex: 0,
      isAnswered: false,
      feedbackActive: false,
      questionStartTime: 0
    };
  },
  mounted() {
    console.log('[Trivia Overlay Vue] Mounted and listening to show-trivia');
    window.addEventListener('show-trivia', this.handleShowTrivia);
    window.addEventListener('keydown', this.handleKeyDown);
  },
  unmounted() {
    window.removeEventListener('show-trivia', this.handleShowTrivia);
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  methods: {
    handleShowTrivia(event) {
      console.log('[Trivia Overlay Vue] handleShowTrivia received event details:', event.detail);
      const data = event.detail || {};
      
      this.questionIndex = data.questionIndex !== undefined ? data.questionIndex : 0;
      this.questionText = data.questionText || '';
      this.options = data.options || [];
      this.correctIndex = data.correctIndex !== undefined ? data.correctIndex : 0;
      this.portraitDataUrl = data.portraitDataUrl || null;
      this.totalQuestions = data.totalQuestions || 4;
      this.score = data.score || 0;
      this.maxScore = data.maxScore || 0;
      this.theme = data.theme || 'stone';

      // Reset states
      this.selectedIndex = 0;
      this.isAnswered = false;
      this.feedbackActive = false;
      this.questionStartTime = Date.now();
      this.isActive = true;
      trackQuestionShown(this.questionIndex, this.questionText);
    },



    getOptionLabel(index) {
      return ['A', 'B', 'C', 'D'][index];
    },

    getOptionClass(index) {
      if (this.feedbackActive) {
        if (index === this.selectedIndex) {
          return this.selectedIndex === this.correctIndex ? 'correct' : 'incorrect';
        }
        if (index === this.correctIndex) {
          return 'correct';
        }
        return 'inactive-dimmed';
      }
      return index === this.selectedIndex ? 'active' : 'inactive';
    },

    selectOption(index) {
      if (this.isAnswered) return;
      this.selectedIndex = index;
    },

    confirmAnswer(index) {
      if (this.isAnswered) return;
      this.isAnswered = true;
      this.feedbackActive = true;

      const isCorrect = index === this.correctIndex;
      trackQuestionAnswered(this.questionIndex, index, isCorrect, Date.now() - this.questionStartTime);

      // Wait exactly 1 second before firing the event and hiding the overlay
      setTimeout(() => {
        this.isActive = false;
        window.dispatchEvent(new CustomEvent('trivia-complete', {
          detail: {
            isCorrect,
            questionIndex: this.questionIndex
          }
        }));
      }, 1000);
    },

    handleKeyDown(event) {
      if (!this.isActive || this.isAnswered) return;

      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.navigateVertical(-1);
          event.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.navigateVertical(1);
          event.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.navigateHorizontal(-1);
          event.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.navigateHorizontal(1);
          event.preventDefault();
          break;
        case 'Enter':
        case ' ':
          this.confirmAnswer(this.selectedIndex);
          event.preventDefault();
          break;
      }
    },

    navigateVertical(dir) {
      let row = Math.floor(this.selectedIndex / 2);
      const col = this.selectedIndex % 2;
      row = (row + dir + 2) % 2; // Wrap rows
      this.selectedIndex = row * 2 + col;
    },

    navigateHorizontal(dir) {
      const row = Math.floor(this.selectedIndex / 2);
      let col = this.selectedIndex % 2;
      col = (col + dir + 2) % 2; // Wrap columns
      this.selectedIndex = row * 2 + col;
    }
  }
};
</script>

<style scoped>
.trivia-overlay-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9500;
  user-select: none;
}

.trivia-dimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
}

.trivia-panel {
  position: relative;
  width: 76%;
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;
}

.score-chip {
  align-self: flex-start;
  padding: 8px 14px;
  border: 3px solid #ffffff;
  background: #111827;
  color: #f8fafc;
  font-size: clamp(14px, 2vw, 20px);
  font-weight: 800;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.24);
}

.solberg-card-row {
  display: flex;
  flex-direction: row-reverse;
  gap: 6px;
  align-items: stretch;
  width: 100%;
}

.solberg-portrait-box {
  width: 88px;
  height: 88px;
  background: #334155;
  border: 3px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.2);
}

.solberg-portrait {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  object-fit: cover;
  padding: 4px;
}

.solberg-portrait-fallback {
  width: 100%;
  height: 100%;
  background: #475569;
}

.solberg-dialogue-box {
  flex-grow: 1;
  background: rgba(10, 15, 29, 0.95);
  border: 2.4px solid #94a3b8;
  border-radius: 6px;
  padding: 12px;
  text-align: right;
  direction: rtl;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.2);
}

.dialogue-text {
  font-family: 'Rubik', 'Outfit', sans-serif;
  font-size: clamp(14px, 2.8vh, 22px);
  font-weight: bold;
  color: #ffffff;
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
  width: 100%;
}

.typewriter-cursor {
  font-weight: bold;
  color: #ffffff;
  margin-left: 2px;
  animation: blink 0.7s infinite;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  width: 100%;
  margin-top: 6px;
}

.option-box {
  background: rgba(10, 15, 29, 0.95);
  border: 2px solid #475569;
  border-radius: 4px;
  padding: 10px 16px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: right;
  direction: rtl;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, opacity 0.2s;
  box-shadow: 0px 3px 5px rgba(0, 0, 0, 0.15);
}

.option-text {
  font-family: 'Rubik', 'Outfit', sans-serif;
  font-size: clamp(13px, 2.5vh, 18px);
  color: #ffffff;
  line-height: 1.3;
  width: 100%;
}

/* Option box styling states */
.option-box.inactive:hover {
  background: #1e293b; /* Slate fill to show highlight (no border outline change) */
}

.option-box.active {
  background: #1e293b; /* Keyboard-selected focus also gets slate fill */
}

.option-box.correct {
  border-color: #10b981; /* Green outline */
  border-width: 3.6px;
}

.option-box.incorrect {
  border-color: #ef4444; /* Red outline */
  border-width: 3.6px;
}

.option-box.inactive-dimmed {
  opacity: 0.6;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@media (max-width: 600px) {
  .solberg-portrait-box {
    width: 64px;
    height: 64px;
  }
}

/* --- STONE THEME --- */
.trivia-panel.theme-stone .solberg-dialogue-box {
  background: rgba(242, 230, 207, 0.98);
  border: 2.5px solid #6b5a43;
  box-shadow: 4px 4px 0px #000000;
}
.trivia-panel.theme-stone .dialogue-text {
  color: #201c18;
}
.trivia-panel.theme-stone .option-box {
  background: rgba(242, 230, 207, 0.98);
  border: 2px solid #8c7355;
  box-shadow: 3px 3px 0px #000000;
}
.trivia-panel.theme-stone .option-box.inactive:hover,
.trivia-panel.theme-stone .option-box.active {
  background: #e2d2b5;
}
.trivia-panel.theme-stone .option-text {
  color: #201c18;
}
.trivia-panel.theme-stone .score-chip {
  background: #f2e6cf;
  border: 3px solid #6b5a43;
  color: #3d3025;
  box-shadow: 3px 3px 0px #000000;
}
.trivia-panel.theme-stone .solberg-portrait-box {
  border: 3px solid #6b5a43;
  box-shadow: 3px 3px 0px #000000;
}

/* Correct answer state: soft green background, green border, dark green text */
.trivia-panel.theme-stone .option-box.correct {
  background: rgba(209, 250, 229, 0.98) !important;
  border-color: #10b981 !important;
  border-width: 3.6px !important;
}
.trivia-panel.theme-stone .option-box.correct .option-text {
  color: #065f46 !important;
}

/* Incorrect selected answer state: soft red background, red border, dark red text */
.trivia-panel.theme-stone .option-box.incorrect {
  background: rgba(254, 226, 226, 0.98) !important;
  border-color: #ef4444 !important;
  border-width: 3.6px !important;
}
.trivia-panel.theme-stone .option-box.incorrect .option-text {
  color: #991b1b !important;
}

/* Keep other non-selected options fully visible with no dimming */
.trivia-panel.theme-stone .option-box.inactive-dimmed {
  opacity: 1.0 !important;
}

/* --- STATE THEME --- */
.trivia-panel.theme-state .solberg-dialogue-box {
  background: rgba(250, 250, 249, 0.98);
  border: 2.5px solid #1e3a8a;
}
.trivia-panel.theme-state .dialogue-text {
  color: #111827;
}
.trivia-panel.theme-state .option-box {
  background: rgba(250, 250, 249, 0.98);
  border: 2px solid #94a3b8;
}
.trivia-panel.theme-state .option-box.inactive:hover,
.trivia-panel.theme-state .option-box.active {
  background: #e2e8f0;
}
.trivia-panel.theme-state .option-text {
  color: #111827;
}
.trivia-panel.theme-state .score-chip {
  background: #fafaf9;
  border: 3px solid #1e3a8a;
  color: #111827;
}
.trivia-panel.theme-state .solberg-portrait-box {
  border: 3px solid #1e3a8a;
}
</style>
