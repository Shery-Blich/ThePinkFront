import { Character } from '../entities/character.js';

/**
 * TriviaOverlay — A modular multiple-choice trivia dialogue system in Phaser.js.
 *
 * Implements the layout from the design mockup:
 * - Solberg portrait & dialogue card in the top-right.
 * - Question card and 4 answer choices arranged in a 2x2 grid at the bottom-right.
 * - Interactive pointer hover/click selection & 2D keyboard navigation.
 * - Red select arrow indicator showing current active answer.
 * - Native-like Hebrew RTL text layout.
 *
 * @example
 *   const trivia = new TriviaOverlay(this, {
 *     dialogueText: "יוסף סולברג: ברוך הבא לקרית שמונה! לפני שתצביע, ענה נכונה:",
 *     questionText: "מהי חובתו של כל אזרח מעל גיל 18 ביום הבחירות?",
 *     options: [
 *       "להישאר בבית",
 *       "להצביע בקלפי",
 *       "לטייל בגליל",
 *       "לעבוד בחיפה"
 *     ],
 *     correctIndex: 1
 *   }, (isCorrect) => {
 *     console.log("Player answered correctly?", isCorrect);
 *   });
 *   trivia.start();
 */
export class TriviaOverlay extends Phaser.Events.EventEmitter {
  /**
   * @param {Phaser.Scene} scene — The Phaser scene to add overlay UI to
   * @param {Object} data — The configuration database for trivia
   * @param {string} data.dialogueText — The speaker statement/dialogue prompt
   * @param {string} data.questionText — The question text
   * @param {string[]} data.options — The 4 answer options (Hebrew/RTL supported)
   * @param {number} data.correctIndex — Index of the correct answer (0-3)
   * @param {Function} [onComplete] — Callback triggered when the question is solved (correct: boolean)
   */
  constructor(scene, data, onComplete = null) {
    super();

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Object} */
    this.data = data;

    /** @type {Function | null} */
    this.onComplete = onComplete;

    /** @type {number} Current active answer index selected */
    this.selectedIndex = 0;

    /** @type {boolean} State tracker for typewriter typing */
    this.isTyping = false;

    /** @type {Phaser.Time.TimerEvent | null} */
    this.typingTimer = null;

    // --- UI Elements ---
    /** @type {Phaser.GameObjects.Container | null} Main container overlay */
    this.container = null;
    /** @type {Phaser.GameObjects.Graphics[]} Option background boxes */
    this.optionBoxes = [];
    /** @type {Phaser.GameObjects.Text | null} Select indicator arrow */
    this.arrowIndicator = null;
    /** @type {Phaser.GameObjects.Text[]} Option text components */
    this.optionTexts = [];

    // --- Key listeners ---
    /** @type {Object.<string, Phaser.Input.Keyboard.Key> | null} */
    this.keys = null;

    // --- Bound listeners for clean shutdown ---
    this._onShutdown = this.destroy.bind(this);
    this.scene.events.once('shutdown', this._onShutdown);
    this.scene.events.once('destroy', this._onShutdown);
  }

  /**
   * Starts the trivia dialogue overlay, renders UI, and enables controls.
   */
  start() {
    // Disable game character movement if movement exists
    if (this.scene.movement) {
      this.scene.movement.disable();
    }

    this.createUI();
    this.setupControls();
  }

  /**
   * Builds the overlay containers and layout components dynamically.
   * @private
   */
  createUI() {
    const { width, height } = this.scene.scale;
    const scale = this.scene.s || Character.computeScale(height);

    // Create the master UI container (scrolled relative to camera display)
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(9500); // Renders above standard game overlays

    // Dark screen dimmer block (adds depth contrast to gameplay background)
    const dimmer = this.scene.add.graphics();
    dimmer.fillStyle(0x000000, 0.4);
    dimmer.fillRect(0, 0, width, height);
    this.container.add(dimmer);

    // Layout configuration constants (compact to fit screen height)
    const margin = 12 * scale;
    const spacing = 6 * scale;
    const portraitSize = 44 * scale;
    
    // Panel width takes 48% of screen width, aligned to the right
    const panelWidth = Math.round(width * 0.48);
    const rightAlignX = width - margin - panelWidth;

    // -------------------------------------------------------------------------
    // 1. SOLBERG DIALOGUE CARD & PORTRAIT (Top Right)
    // -------------------------------------------------------------------------
    const solbergY = margin;

    // Solberg Portrait box
    const portraitX = width - margin - portraitSize;
    const portraitBg = this.scene.add.graphics();
    portraitBg.fillStyle(0x334155, 1); // Slate background
    portraitBg.lineStyle(1.5 * scale, 0xffffff, 1);
    portraitBg.fillRect(portraitX, solbergY, portraitSize, portraitSize);
    portraitBg.strokeRect(portraitX, solbergY, portraitSize, portraitSize);
    this.container.add(portraitBg);

    // Portrait image texture
    const portraitImg = this.scene.add.image(portraitX + portraitSize / 2, solbergY + portraitSize / 2, 'solberg_portrait');
    portraitImg.setDisplaySize(portraitSize - 4 * scale, portraitSize - 4 * scale);
    this.container.add(portraitImg);

    // Solberg Dialogue box (left of portrait)
    const dialogBoxX = rightAlignX;
    const dialogBoxWidth = panelWidth - portraitSize - spacing;
    const dialogBoxHeight = portraitSize;

    const dialogBg = this.scene.add.graphics();
    dialogBg.fillStyle(0x0a0f1d, 0.95); // Deep navy
    dialogBg.lineStyle(1.2 * scale, 0x94a3b8, 1); // Light grey border
    dialogBg.fillRoundedRect(dialogBoxX, solbergY, dialogBoxWidth, dialogBoxHeight, 3 * scale);
    dialogBg.strokeRoundedRect(dialogBoxX, solbergY, dialogBoxWidth, dialogBoxHeight, 3 * scale);
    this.container.add(dialogBg);

    // Dialogue text (Hebrew aligned right, compact font size)
    const fontSize = Math.max(9, Math.round(height * 0.025));
    const labelText = this.scene.add.text(
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
    labelText.setOrigin(1, 0); // Origin top-right for RTL alignment
    this.container.add(labelText);

    // Animate speech prompt using typewriter effect
    this.typewriterText(labelText, this.data.dialogueText);

    // -------------------------------------------------------------------------
    // 2. TRIVIA QUESTION CARD (Middle Right)
    // -------------------------------------------------------------------------
    const questionY = solbergY + portraitSize + spacing;
    const questionHeight = 36 * scale; // Compact height

    // Question Box
    const questionBg = this.scene.add.graphics();
    questionBg.fillStyle(0x0a0f1d, 0.95);
    questionBg.lineStyle(1.2 * scale, 0x94a3b8, 1);
    questionBg.fillRoundedRect(rightAlignX, questionY, panelWidth, questionHeight, 3 * scale);
    questionBg.strokeRoundedRect(rightAlignX, questionY, panelWidth, questionHeight, 3 * scale);
    this.container.add(questionBg);

    // Question Text
    const questionTextObj = this.scene.add.text(
      rightAlignX + panelWidth - 8 * scale,
      questionY + 6 * scale,
      this.data.questionText,
      {
        fontFamily: 'monospace',
        fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        color: '#ffffff',
        align: 'right',
        rtl: true,
        wordWrap: { width: panelWidth - 16 * scale }
      }
    );
    questionTextObj.setOrigin(1, 0);
    this.container.add(questionTextObj);

    // -------------------------------------------------------------------------
    // 3. MULTIPLE CHOICE OPTION GRID (Bottom Right - 2 rows x 2 columns)
    // -------------------------------------------------------------------------
    const optionLabels = ['A', 'B', 'C', 'D'];
    const optionStartY = questionY + questionHeight + spacing;
    
    // Sized to fit 2 rows comfortably
    const optionHeight = 18 * scale;
    const colWidth = (panelWidth - spacing) / 2;

    for (let i = 0; i < 4; i++) {
      // Row is 0 for A/B, 1 for C/D
      const row = Math.floor(i / 2);
      // In Hebrew RTL: Option A & C on the right (col = 1), Option B & D on the left (col = 0)
      const col = (i % 2 === 0) ? 1 : 0;

      const optionX = rightAlignX + col * (colWidth + spacing);
      const optionY = optionStartY + row * (optionHeight + 4 * scale);

      // Background Box
      const optBg = this.scene.add.graphics();
      this.drawOptionBox(optBg, optionX, optionY, colWidth, optionHeight, scale, false);
      this.container.add(optBg);
      this.optionBoxes.push(optBg);

      // Option text (e.g. "A: להישאר בבית")
      const rawText = this.data.options[i] || '';
      const optionString = `${optionLabels[i]}: ${rawText}`;

      const optText = this.scene.add.text(
        optionX + colWidth - 10 * scale,
        optionY + optionHeight / 2,
        optionString,
        {
          fontFamily: 'monospace',
          fontSize: `${fontSize - 1}px`, // Slightly smaller option font to ensure single-line fit
          color: '#ffffff',
          align: 'right',
          rtl: true
        }
      );
      optText.setOrigin(1, 0.5); // Right-aligned, centered vertically
      this.container.add(optText);
      this.optionTexts.push(optText);

      // Make option region interactive
      const zone = this.scene.add.zone(
        optionX + colWidth / 2,
        optionY + optionHeight / 2,
        colWidth,
        optionHeight
      );
      zone.setInteractive({ useHandCursor: true });
      
      zone.on('pointerover', () => {
        this.selectOption(i);
      });
      
      zone.on('pointerdown', () => {
        this.confirmAnswer(i);
      });

      this.container.add(zone);
    }

    // -------------------------------------------------------------------------
    // 4. SELECTION INDICATOR ARROW
    // -------------------------------------------------------------------------
    // Red indicator arrow pointing to active option, placed inside the option box
    this.arrowIndicator = this.scene.add.text(
      0,
      0,
      '▶',
      {
        fontFamily: 'monospace',
        fontSize: `${fontSize - 1}px`,
        color: '#ff2a5f',
      }
    );
    this.arrowIndicator.setOrigin(0, 0.5);
    this.container.add(this.arrowIndicator);

    // Update position and redraw borders for starting selection
    this.updateSelectionVisuals();
  }

  /**
   * Draw option box graphics.
   * @param {Phaser.GameObjects.Graphics} gfx 
   * @param {number} x 
   * @param {number} y 
   * @param {number} w 
   * @param {number} h 
   * @param {number} scale 
   * @param {boolean} active 
   * @private
   */
  drawOptionBox(gfx, x, y, w, h, scale, active) {
    gfx.clear();
    gfx.fillStyle(0x0a0f1d, 0.95);
    // Active box gets bright pink border, inactive gets grey border
    const color = active ? 0xff2a5f : 0x475569;
    const thickness = active ? 1.5 * scale : 1 * scale;
    gfx.lineStyle(thickness, color, 1);
    gfx.fillRoundedRect(x, y, w, h, 2 * scale);
    gfx.strokeRoundedRect(x, y, w, h, 2 * scale);
  }

  /**
   * Setup Keyboard inputs for selection navigation.
   * @private
   */
  setupControls() {
    if (!this.scene.input.keyboard) return;

    this.keys = this.scene.input.keyboard.addKeys({
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

    // Listeners
    this.scene.input.keyboard.on('keydown', this.handleKeyDown, this);
  }

  /**
   * Handle keyboard inputs for accessibility and navigation.
   * @param {KeyboardEvent} event 
   * @private
   */
  handleKeyDown(event) {
    if (!this.keys) return;

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

  /**
   * Shifts selection index vertically (row selection).
   * @param {number} dir - Direction steps (-1 or 1)
   * @private
   */
  navigateVertical(dir) {
    let row = Math.floor(this.selectedIndex / 2);
    const col = this.selectedIndex % 2;
    row = (row + dir + 2) % 2; // Wrap rows
    this.selectOption(row * 2 + col);
  }

  /**
   * Shifts selection index horizontally (column selection).
   * @param {number} dir - Direction steps (-1 or 1)
   * @private
   */
  navigateHorizontal(dir) {
    const row = Math.floor(this.selectedIndex / 2);
    let col = this.selectedIndex % 2;
    col = (col + dir + 2) % 2; // Wrap columns
    this.selectOption(row * 2 + col);
  }

  /**
   * Moves selection focus and highlights selected index.
   * @param {number} index 
   * @private
   */
  selectOption(index) {
    if (this.selectedIndex === index) return;
    this.selectedIndex = index;
    this.updateSelectionVisuals();
  }

  /**
   * Refreshes option border graphics and indicator arrow positioning.
   * @private
   */
  updateSelectionVisuals() {
    const scale = this.scene.s || Character.computeScale(this.scene.scale.height);
    const { width, height } = this.scene.scale;
    
    const margin = 12 * scale;
    const spacing = 6 * scale;
    const portraitSize = 44 * scale;
    const questionHeight = 36 * scale;
    
    const panelWidth = Math.round(width * 0.48);
    const rightAlignX = width - margin - panelWidth;

    const optionStartY = margin + portraitSize + spacing + questionHeight + spacing;
    const optionHeight = 18 * scale;
    const colWidth = (panelWidth - spacing) / 2;

    // Redraw options
    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = (i % 2 === 0) ? 1 : 0;

      const optionX = rightAlignX + col * (colWidth + spacing);
      const optionY = optionStartY + row * (optionHeight + 4 * scale);

      const optBg = this.optionBoxes[i];
      const optText = this.optionTexts[i];
      const isActive = i === this.selectedIndex;

      if (optBg) {
        this.drawOptionBox(optBg, optionX, optionY, colWidth, optionHeight, scale, isActive);
      }
      
      if (optText) {
        optText.setColor(isActive ? '#ff2a5f' : '#ffffff');
      }
    }

    // Move red arrow indicator inside the active option box
    if (this.arrowIndicator) {
      const row = Math.floor(this.selectedIndex / 2);
      const col = (this.selectedIndex % 2 === 0) ? 1 : 0;

      const activeOptionX = rightAlignX + col * (colWidth + spacing);
      const activeOptionY = optionStartY + row * (optionHeight + 4 * scale);
      
      this.arrowIndicator.setX(activeOptionX + 5 * scale);
      this.arrowIndicator.setY(activeOptionY + optionHeight / 2);
    }
  }

  /**
   * Finalizes selection and evaluates correctness.
   * @param {number} index 
   * @private
   */
  confirmAnswer(index) {
    const isCorrect = index === this.data.correctIndex;
    
    this.emit('answer-selected', {
      index,
      isCorrect,
      correctIndex: this.data.correctIndex
    });

    this.destroy();

    if (this.onComplete) {
      this.onComplete(isCorrect);
    }
  }

  /**
   * Performs typewriter dialogue text animation.
   * @param {Phaser.GameObjects.Text} textObj 
   * @param {string} fullText 
   * @private
   */
  typewriterText(textObj, fullText) {
    if (this.typingTimer) this.typingTimer.remove();
    this.isTyping = true;
    
    let charIndex = 0;
    textObj.setText('');

    this.typingTimer = this.scene.time.addEvent({
      delay: 30, // 30ms character typing rate
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

  /**
   * De-allocates event listeners and destroys all UI gameobjects.
   */
  destroy() {
    this.scene.events.off('shutdown', this._onShutdown);
    this.scene.events.off('destroy', this._onShutdown);

    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown', this.handleKeyDown, this);
    }

    if (this.typingTimer) {
      this.typingTimer.remove();
      this.typingTimer = null;
    }

    if (this.container) {
      this.container.destroy();
      this.container = null;
    }

    this.optionBoxes = [];
    this.optionTexts = [];
    this.arrowIndicator = null;

    // Enable character movement back on scene exit
    if (this.scene.movement) {
      this.scene.movement.enable();
      this.scene._updateHUD('Tap to move →');
    }
  }
}
