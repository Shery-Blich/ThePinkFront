/**
 * DialogSystem — HTML-based dialogue boxes for cutscenes.
 * 
 * Features:
 * - Rendered in HTML/DOM for maximum crispness, responsive sizing, and perfect RTL alignment.
 * - Styled consistently with the sandstone HUD elements.
 * - Typewriter text effect.
 * - Advance on screen clicks, spacebar/taps, or clicking the dialogue box itself.
 */
export class DialogSystem {
  /**
   * @param {Phaser.Scene} scene — The scene to add the dialog to
   * @param {Array<{speaker: string, text: string}>} lines — The list of dialogue lines
   * @param {Function} [onComplete] — Callback invoked when the dialogue ends
   * @param {string} [theme] — Deprecated theme key (now unified to DOM sandstone layout)
   */
  constructor(scene, lines, onComplete = null, theme = 'stone') {
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

    // --- HTML UI references ---
    this.containerEl = document.getElementById('html-dialog-container');
    this.nameEl = document.getElementById('html-dialog-name');
    this.bodyEl = document.getElementById('html-dialog-body');
    this.arrowEl = document.getElementById('html-dialog-arrow');
    this.boxEl = document.getElementById('html-dialog-box');

    // --- Bound listeners ---
    this._onPointerDown = this.advance.bind(this);
    this._onHTMLClick = this.advance.bind(this);
  }

  /**
   * Start the dialog sequence.
   */
  start() {
    this.createUI();
    this.showLine();

    // Listen for taps anywhere in the Phaser canvas to advance
    this.scene.input.on('pointerdown', this._onPointerDown);
    
    // Also listen to clicks directly on the HTML box overlay
    if (this.boxEl) {
      this.boxEl.addEventListener('click', this._onHTMLClick);
    }
  }

  /**
   * Initialize dialogue elements.
   * @private
   */
  createUI() {
    if (this.containerEl) {
      this.containerEl.style.display = 'block';
    }
    if (this.arrowEl) {
      this.arrowEl.style.display = 'none';
    }
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
    if (this.nameEl) {
      this.nameEl.textContent = line.speaker.toUpperCase();
    }

    // Reset typewriter
    if (this.typingEvent) this.typingEvent.remove();
    this.isTyping = true;
    this.typedText = '';
    if (this.bodyEl) {
      this.bodyEl.textContent = '';
    }
    if (this.arrowEl) {
      this.arrowEl.style.display = 'none';
    }

    let charIndex = 0;
    const fullText = line.text;

    this.typingEvent = this.scene.time.addEvent({
      delay: 35, // 35ms per character
      callback: () => {
        if (!this.bodyEl) return;
        this.typedText += fullText[charIndex];
        this.bodyEl.textContent = this.typedText;
        charIndex++;
        if (charIndex >= fullText.length) {
          this.typingEvent.remove();
          this.isTyping = false;
          if (this.arrowEl) {
            this.arrowEl.style.display = 'block';
          }
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
      if (this.bodyEl) {
        this.bodyEl.textContent = line.text;
      }
      this.isTyping = false;
      if (this.arrowEl) {
        this.arrowEl.style.display = 'block';
      }
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
    if (this.boxEl) {
      this.boxEl.removeEventListener('click', this._onHTMLClick);
    }
    if (this.typingEvent) this.typingEvent.remove();
    if (this.containerEl) {
      this.containerEl.style.display = 'none';
    }
  }
}
