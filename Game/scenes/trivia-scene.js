import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { TRIVIA_QUESTIONS } from '../data/trivia-questions.js';

/**
 * TriviaScene — A reusable multiple-choice trivia dialogue scene in Phaser.js.
 *
 * Can be run in two modes:
 * 1. Overlay Mode (scene.launch): runs in parallel on top of a running gameplay scene.
 * 2. Transition Mode (scene.start): runs sequentially between gameplay scenes.
 */
export class TriviaScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TriviaScene' });
  }

  /**
   * Initialize scene parameters and fallback configurations.
   * @param {Object} [data] — Scene initialization data config
   * @param {string} [data.dialogueText] — Solberg prompt
   * @param {string} [data.questionText] — Question text
   * @param {string[]} [data.options] — Four multiple choice options
   * @param {number} [data.correctIndex] — Correct option index (0-3)
   * @param {Function} [data.onComplete] — Callback triggered when finished
   * @param {string} [data.nextSceneKey] — Next scene key to load sequentially
   * @param {Phaser.Scene} [data.parentScene] — Reference to parent scene (if launched as overlay)
   */
  init(data) {
    const config = data || {};
    const questionIndex = config.questionIndex !== undefined ? config.questionIndex : 0;
    
    // Look up question by index in database
    const qData = TRIVIA_QUESTIONS && TRIVIA_QUESTIONS[questionIndex] ? TRIVIA_QUESTIONS[questionIndex] : null;

    this.dialogueText = config.dialogueText || (qData ? `שאלה ${questionIndex + 1} מתוך ${TRIVIA_QUESTIONS.length}. ענה נכונה כדי להמשיך:` : 'שאלת טריוויה:');
    this.questionText = config.questionText || (qData ? qData[0] : 'שאלת ברירת מחדל?');
    this.options = config.options || (qData ? qData[1] : ['א', 'ב', 'ג', 'ד']);
    this.correctIndex = config.correctIndex !== undefined ? config.correctIndex : (qData ? qData[2] : 0);
    
    this.questionIndex = questionIndex;
    this.onComplete = config.onComplete || null;
    this.nextSceneKey = config.nextSceneKey || null;
    this.parentScene = config.parentScene || null;

    // Reset state trackers
    this.selectedIndex = 0;
    this.isAnswered = false;
    this.isTyping = false;
    this.typingTimer = null;

    // Layout configuration coordinates
    this.panelWidth = 0;
    this.leftX = 0;
    this.questionHeight = 0;
    this.optionHeight = 0;
    this.optionStartY = 0;
    this.colWidth = 0;
    this.s = 1;

    // UI elements lists
    this.optionBoxes = [];
    this.optionTexts = [];
    this.container = null;
    this.keys = null;
  }

  create() {
    const { width, height } = this.scale;
    this.s = Character.computeScale(height);
    const scale = this.s;

    // Disable player movement on the parent scene if running as overlay
    if (this.parentScene && this.parentScene.player) {
      this.parentScene.player.disable();
    }

    // Create the master UI container
    this.container = this.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(9500);

    // Dark screen dimmer block
    const dimmer = this.add.graphics();
    dimmer.fillStyle(0x000000, 0.4);
    dimmer.fillRect(0, 0, width, height);
    this.container.add(dimmer);

    // Layout configuration constants
    const margin = 12 * scale;
    const spacing = 6 * scale;
    const portraitSize = 44 * scale;
    
    this.panelWidth = Math.round(width * 0.76);
    this.leftX = Math.round((width - this.panelWidth) / 2);
    this.optionHeight = 24 * scale;
    this.colWidth = (this.panelWidth - spacing) / 2;

    // -------------------------------------------------------------------------
    // 1. SOLBERG DIALOGUE CARD & PORTRAIT (Centered Top)
    // -------------------------------------------------------------------------
    const solbergY = margin;

    // Solberg Portrait box
    const portraitX = this.leftX + this.panelWidth - portraitSize;
    const portraitBg = this.add.graphics();
    portraitBg.fillStyle(0x334155, 1);
    portraitBg.lineStyle(1.5 * scale, 0xffffff, 1);
    portraitBg.fillRect(portraitX, solbergY, portraitSize, portraitSize);
    portraitBg.strokeRect(portraitX, solbergY, portraitSize, portraitSize);
    this.container.add(portraitBg);

    // Portrait image texture
    const portraitImg = this.add.image(portraitX + portraitSize / 2, solbergY + portraitSize / 2, 'solberg_portrait');
    portraitImg.setDisplaySize(portraitSize - 4 * scale, portraitSize - 4 * scale);
    this.container.add(portraitImg);

    // Solberg Dialogue box
    const dialogBoxX = this.leftX;
    const dialogBoxWidth = this.panelWidth - portraitSize - spacing;
    const dialogBoxHeight = portraitSize;

    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0x0a0f1d, 0.95);
    dialogBg.lineStyle(1.2 * scale, 0x94a3b8, 1);
    dialogBg.fillRoundedRect(dialogBoxX, solbergY, dialogBoxWidth, dialogBoxHeight, 3 * scale);
    dialogBg.strokeRoundedRect(dialogBoxX, solbergY, dialogBoxWidth, dialogBoxHeight, 3 * scale);
    this.container.add(dialogBg);

    // Dialogue text
    const fontSize = Math.max(9, Math.round(height * 0.025));
    const labelText = this.add.text(
      dialogBoxX + dialogBoxWidth - 6 * scale,
      solbergY + 6 * scale,
      '',
      {
        fontFamily: 'monospace',
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        align: 'right',
        rtl: true,
        wordWrap: { width: dialogBoxWidth - 12 * scale }
      }
    );
    labelText.setOrigin(1, 0);
    this.container.add(labelText);

    // Animate speech prompt using typewriter effect
    this.typewriterText(labelText, this.dialogueText);

    // -------------------------------------------------------------------------
    // 2. TRIVIA QUESTION CARD (Centered Middle)
    // -------------------------------------------------------------------------
    const questionY = solbergY + portraitSize + spacing;

    // Create Question Text first to measure height dynamically
    const questionTextObj = this.add.text(
      this.leftX + this.panelWidth - 8 * scale,
      questionY + 6 * scale,
      this.questionText,
      {
        fontFamily: 'monospace',
        fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        color: '#ffffff',
        align: 'right',
        rtl: true,
        wordWrap: { width: this.panelWidth - 16 * scale }
      }
    );
    questionTextObj.setOrigin(1, 0);

    this.questionHeight = questionTextObj.height + 12 * scale;
    this.optionStartY = questionY + this.questionHeight + spacing;

    // Question Box
    const questionBg = this.add.graphics();
    questionBg.fillStyle(0x0a0f1d, 0.95);
    questionBg.lineStyle(1.2 * scale, 0x94a3b8, 1);
    questionBg.fillRoundedRect(this.leftX, questionY, this.panelWidth, this.questionHeight, 3 * scale);
    questionBg.strokeRoundedRect(this.leftX, questionY, this.panelWidth, this.questionHeight, 3 * scale);
    this.container.add(questionBg);
    this.container.add(questionTextObj);

    // -------------------------------------------------------------------------
    // 3. MULTIPLE CHOICE OPTION GRID (Centered Bottom - 2 rows x 2 columns)
    // -------------------------------------------------------------------------
    const optionLabels = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = (i % 2 === 0) ? 1 : 0;

      const optionX = this.leftX + col * (this.colWidth + spacing);
      const optionY = this.optionStartY + row * (this.optionHeight + 4 * scale);

      // Background Box
      const optBg = this.add.graphics();
      this.drawOptionBox(optBg, optionX, optionY, this.colWidth, this.optionHeight, scale, 'inactive');
      this.container.add(optBg);
      this.optionBoxes.push(optBg);

      // Option text
      const rawText = this.options[i] || '';
      const optionString = `${optionLabels[i]}: ${rawText}`;

      const optText = this.add.text(
        optionX + this.colWidth - 10 * scale,
        optionY + this.optionHeight / 2,
        optionString,
        {
          fontFamily: 'monospace',
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          align: 'right',
          rtl: true,
          wordWrap: { width: this.colWidth - 24 * scale }
        }
      );
      optText.setOrigin(1, 0.5);
      this.container.add(optText);
      this.optionTexts.push(optText);

      // Make option region interactive
      const zone = this.add.zone(
        optionX + this.colWidth / 2,
        optionY + this.optionHeight / 2,
        this.colWidth,
        this.optionHeight
      );
      zone.setInteractive({ useHandCursor: true });
      
      zone.on('pointerover', () => {
        if (this.isAnswered) return;
        this.selectOption(i);
      });
      
      zone.on('pointerdown', () => {
        if (this.isAnswered) return;
        this.confirmAnswer(i);
      });

      this.container.add(zone);
    }

    // Update position and redraw borders for starting selection
    this.updateSelectionVisuals();
    this.setupControls();
  }

  /**
   * Draw option box graphics.
   */
  drawOptionBox(gfx, x, y, w, h, scale, state = 'inactive') {
    gfx.clear();
    
    let bgColor = 0x0a0f1d;
    let borderColor = 0x475569;
    let thickness = 1 * scale;

    if (state === 'correct') {
      borderColor = 0x10b981;
      thickness = 1.8 * scale;
    } else if (state === 'incorrect') {
      borderColor = 0xef4444;
      thickness = 1.8 * scale;
    } else if (state === 'active') {
      bgColor = 0x1e293b;
    }

    gfx.fillStyle(bgColor, 0.95);
    gfx.lineStyle(thickness, borderColor, 1);
    gfx.fillRoundedRect(x, y, w, h, 2 * scale);
    gfx.strokeRoundedRect(x, y, w, h, 2 * scale);
  }

  /**
   * Setup Keyboard inputs for selection navigation.
   */
  setupControls() {
    if (!this.input.keyboard) return;

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    this.input.keyboard.on('keydown', this.handleKeyDown, this);
  }

  /**
   * Handle keyboard inputs for navigation.
   */
  handleKeyDown(event) {
    if (!this.keys || this.isAnswered) return;

    switch (event.keyCode) {
      case Phaser.Input.Keyboard.KeyCodes.UP:
      case Phaser.Input.Keyboard.KeyCodes.W:
        this.navigateVertical(-1);
        break;

      case Phaser.Input.Keyboard.KeyCodes.DOWN:
      case Phaser.Input.Keyboard.KeyCodes.S:
        this.navigateVertical(1);
        break;

      case Phaser.Input.Keyboard.KeyCodes.LEFT:
      case Phaser.Input.Keyboard.KeyCodes.A:
        this.navigateHorizontal(-1);
        break;

      case Phaser.Input.Keyboard.KeyCodes.RIGHT:
      case Phaser.Input.Keyboard.KeyCodes.D:
        this.navigateHorizontal(1);
        break;

      case Phaser.Input.Keyboard.KeyCodes.ENTER:
      case Phaser.Input.Keyboard.KeyCodes.SPACE:
        this.confirmAnswer(this.selectedIndex);
        break;
    }
  }

  navigateVertical(dir) {
    let row = Math.floor(this.selectedIndex / 2);
    const col = this.selectedIndex % 2;
    row = (row + dir + 2) % 2;
    this.selectOption(row * 2 + col);
  }

  navigateHorizontal(dir) {
    const row = Math.floor(this.selectedIndex / 2);
    let col = this.selectedIndex % 2;
    col = (col + dir + 2) % 2;
    this.selectOption(row * 2 + col);
  }

  selectOption(index) {
    if (this.isAnswered) return;
    if (this.selectedIndex === index) return;
    this.selectedIndex = index;
    this.updateSelectionVisuals();
  }

  updateSelectionVisuals() {
    if (this.isAnswered) return;

    const scale = this.s;
    const spacing = 6 * scale;

    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = (i % 2 === 0) ? 1 : 0;

      const optionX = this.leftX + col * (this.colWidth + spacing);
      const optionY = this.optionStartY + row * (this.optionHeight + 4 * scale);

      const optBg = this.optionBoxes[i];
      const optText = this.optionTexts[i];
      const isActive = i === this.selectedIndex;

      if (optBg) {
        this.drawOptionBox(optBg, optionX, optionY, this.colWidth, this.optionHeight, scale, isActive ? 'active' : 'inactive');
      }
      
      if (optText) {
        optText.setColor('#ffffff');
      }
    }
  }

  confirmAnswer(index) {
    if (this.isAnswered) return;
    this.isAnswered = true;

    if (this.input.keyboard) {
      this.input.keyboard.off('keydown', this.handleKeyDown, this);
    }
    if (this.typingTimer) {
      this.typingTimer.remove();
      this.typingTimer = null;
    }

    const isCorrect = index === this.correctIndex;
    this.events.emit('answer-selected', { index, isCorrect, correctIndex: this.correctIndex });

    const scale = this.s;
    const spacing = 6 * scale;

    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = (i % 2 === 0) ? 1 : 0;
      const optionX = this.leftX + col * (this.colWidth + spacing);
      const optionY = this.optionStartY + row * (this.optionHeight + 4 * scale);

      const optBg = this.optionBoxes[i];
      const optText = this.optionTexts[i];

      if (i === index) {
        const state = isCorrect ? 'correct' : 'incorrect';
        this.drawOptionBox(optBg, optionX, optionY, this.colWidth, this.optionHeight, scale, state);
        if (optText) optText.setColor('#ffffff');
      } else if (i === this.correctIndex) {
        this.drawOptionBox(optBg, optionX, optionY, this.colWidth, this.optionHeight, scale, 'correct');
        if (optText) optText.setColor('#ffffff');
      } else {
        this.drawOptionBox(optBg, optionX, optionY, this.colWidth, this.optionHeight, scale, 'inactive');
        if (optText) optText.setColor('#ffffff');
      }
    }

    // Wait exactly 1 second before exit
    this.time.delayedCall(1000, () => {
      // Re-enable parent scene player if running as overlay
      if (this.parentScene && this.parentScene.player) {
        this.parentScene.player.enable();
        this.parentScene._updateHUD('Drag joystick to move →');
      }

      if (this.onComplete) {
        this.onComplete(isCorrect);
      }

      if (this.nextSceneKey) {
        this.scene.start(this.nextSceneKey);
      } else if (!this.onComplete) {
        // Standalone testing mode: run sequential queue then start Day1Scene
        if (this.questionIndex + 1 < TRIVIA_QUESTIONS.length) {
          this.scene.start('TriviaScene', { questionIndex: this.questionIndex + 1 });
        } else {
          this.scene.start('Day1Scene');
        }
      } else {
        this.scene.stop('TriviaScene');
      }
    });
  }

  typewriterText(textObj, fullText) {
    if (this.typingTimer) this.typingTimer.remove();
    this.isTyping = true;
    
    let charIndex = 0;
    textObj.setText('');

    this.typingTimer = this.time.addEvent({
      delay: 30,
      callback: () => {
        if (!textObj || !textObj.active) return;
        textObj.setText(fullText.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex >= fullText.length) {
          this.typingTimer.remove();
          this.isTyping = false;
        }
      },
      callbackScope: this,
      repeat: fullText.length - 1
    });
  }
}
