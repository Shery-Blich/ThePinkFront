import { Character } from '../entities/character.js';

/**
 * DialogSystem — Typewriter dialogue boxes for cutscenes.
 * 
 * Features:
 * - Positioned relative to screen size.
 * - Clean UI with a styled border matching the game's palette.
 * - Typewriter text effect.
 * - Advance on screen clicks or spacebar/taps.
 * - Auto-destructs and triggers a completion callback.
 */
export class DialogSystem {
  /**
   * @param {Phaser.Scene} scene — The scene to add the dialog to
   * @param {Array<{speaker: string, text: string}>} lines — The list of dialogue lines
   * @param {Function} [onComplete] — Callback invoked when the dialogue ends
   */
  constructor(scene, lines, onComplete = null) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Array<{speaker: string, text: string}>} */
    this.lines = lines;

    /** @type {Function | null} */
    this.onComplete = onComplete;

    /** @type {number} */
    this.currentIndex = 0;

    /** @type {boolean} */
    this.isTyping = false;

    /** @type {string} */
    this.typedText = '';

    /** @type {Phaser.Time.TimerEvent | null} */
    this.typingEvent = null;

    // --- UI references ---
    /** @type {Phaser.GameObjects.Container | null} */
    this.container = null;
    /** @type {Phaser.GameObjects.Graphics | null} */
    this.bg = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.nameText = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.bodyText = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.arrow = null;

    // --- Bound listeners ---
    this._onPointerDown = this.advance.bind(this);
  }

  /**
   * Start the dialog sequence.
   */
  start() {
    this.createUI();
    this.showLine();

    // Listen for taps to advance
    this.scene.input.on('pointerdown', this._onPointerDown);
  }

  /**
   * Initialize dialogue elements.
   * @private
   */
  createUI() {
    const { width, height } = this.scene.scale;
    const scale = this.scene.s || Character.computeScale(height);

    const boxW = width * 0.9;
    const boxH = Math.min(height * 0.28, 110 * scale);
    const boxX = (width - boxW) / 2;
    const boxY = height - boxH - 12 * scale;

    // Create container rendering on camera space (scrollFactor = 0)
    this.container = this.scene.add.container(boxX, boxY);
    this.container.setScrollFactor(0);
    this.container.setDepth(9000); // Overlay level

    // Background: Dark navy block with pink border matching 'The Pink Front' theme
    this.bg = this.scene.add.graphics();
    this.bg.fillStyle(0x0f0c1b, 0.95);
    this.bg.lineStyle(2.5 * scale, 0xff2a5f, 1);
    this.bg.fillRoundedRect(0, 0, boxW, boxH, 6 * scale);
    this.bg.strokeRoundedRect(0, 0, boxW, boxH, 6 * scale);
    this.container.add(this.bg);

    // Speaker Name (Vibrant neon pink, monospace bold)
    const nameFontSize = Math.max(12, Math.round(height * 0.032));
    this.nameText = this.scene.add.text(16 * scale, 12 * scale, '', {
      fontFamily: 'monospace',
      fontSize: `${nameFontSize}px`,
      fontWeight: 'bold',
      color: '#ff2a5f',
    });
    this.container.add(this.nameText);

    // Dialogue Body (Crisp white monospace text, auto-wrapping)
    const bodyFontSize = Math.max(10, Math.round(height * 0.026));
    this.bodyText = this.scene.add.text(16 * scale, 40 * scale, '', {
      fontFamily: 'monospace',
      fontSize: `${bodyFontSize}px`,
      color: '#ffffff',
      wordWrap: { width: boxW - 32 * scale },
      lineSpacing: 4,
    });
    this.container.add(this.bodyText);

    // Next Line Indicator
    this.arrow = this.scene.add.text(boxW - 20 * scale, boxH - 20 * scale, '▼', {
      fontFamily: 'monospace',
      fontSize: `${bodyFontSize}px`,
      color: '#ff2a5f',
    });
    this.arrow.setOrigin(0.5);
    this.container.add(this.arrow);

    // Pulsing micro-animation for arrow
    this.scene.tweens.add({
      targets: this.arrow,
      y: boxH - 16 * scale,
      duration: 500,
      yoyo: true,
      loop: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Display the current dialogue line, animate text.
   * @private
   */
  showLine() {
    if (this.currentIndex >= this.lines.length) {
      this.destroy();
      if (this.onComplete) this.onComplete();
      return;
    }

    const line = this.lines[this.currentIndex];
    this.nameText.setText(line.speaker.toUpperCase());

    // Reset typewriter
    if (this.typingEvent) this.typingEvent.remove();
    this.isTyping = true;
    this.typedText = '';
    this.bodyText.setText('');
    this.arrow.setVisible(false);

    let charIndex = 0;
    const fullText = line.text;

    this.typingEvent = this.scene.time.addEvent({
      delay: 35, // 35ms per character
      callback: () => {
        if (!this.bodyText) return;
        this.typedText += fullText[charIndex];
        this.bodyText.setText(this.typedText);
        charIndex++;
        if (charIndex >= fullText.length) {
          this.typingEvent.remove();
          this.isTyping = false;
          this.arrow.setVisible(true);
        }
      },
      callbackScope: this,
      repeat: fullText.length - 1,
    });
  }

  /**
   * Advance dialogue or auto-complete current line.
   */
  advance() {
    if (this.isTyping) {
      // Auto-complete line typing
      if (this.typingEvent) this.typingEvent.remove();
      const line = this.lines[this.currentIndex];
      this.bodyText.setText(line.text);
      this.isTyping = false;
      this.arrow.setVisible(true);
    } else {
      // Advance to next line
      this.currentIndex++;
      this.showLine();
    }
  }

  /**
   * Cleanup and destroy elements.
   */
  destroy() {
    this.scene.input.off('pointerdown', this._onPointerDown);
    if (this.typingEvent) this.typingEvent.remove();
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}
