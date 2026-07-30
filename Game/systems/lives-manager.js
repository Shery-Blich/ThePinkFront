/**
 * LivesManager — Central state management for player lives.
 *
 * Lives persist across scene transitions and only reset when starting a new game
 * or retrying a scene after a Game Over.
 */
export class LivesManager {
  static maxLives = 5;
  static currentLives = 5;

  /**
   * Get the current remaining lives count.
   * @returns {number}
   */
  static getLives() {
    return this.currentLives;
  }

  /**
   * Set current lives directly and update HUD.
   * @param {number} count
   */
  static setLives(count) {
    this.currentLives = Math.max(0, Math.min(this.maxLives, count));
    this.updateHUD();
  }

  /**
   * Reset lives to maximum (3) and update HUD.
   */
  static resetLives() {
    this.currentLives = this.maxLives;
    this.updateHUD();
  }

  /**
   * Deduct 1 life.
   * @returns {number} Remaining lives count after deduction.
   */
  static deductLife() {
    this.currentLives = Math.max(0, this.currentLives - 1);
    this.updateHUD();
    return this.currentLives;
  }

  /**
   * Update the HTML lives HUD display with hearts.
   */
  static updateHUD() {
    const full = "♥ ".repeat(this.currentLives).trimEnd();
    const empty = "♡ ".repeat(this.maxLives - this.currentLives).trimEnd();
    const text = [full, empty].filter(Boolean).join(" ");

    if (typeof window.updateHUDText === 'function') {
      window.updateHUDText('html-lives-hud', text);
    }
  }

  /**
   * Show the HTML lives HUD.
   */
  static showHUD() {
    this.updateHUD();
    if (typeof window.showHUD === 'function') {
      const full = "♥ ".repeat(this.currentLives).trimEnd();
      const empty = "♡ ".repeat(this.maxLives - this.currentLives).trimEnd();
      const text = [full, empty].filter(Boolean).join(" ");
      window.showHUD('html-lives-hud', text);
    }
  }

  /**
   * Hide the HTML lives HUD.
   */
  static hideHUD() {
    if (typeof window.hideHUD === 'function') {
      window.hideHUD('html-lives-hud');
    }
  }
}
