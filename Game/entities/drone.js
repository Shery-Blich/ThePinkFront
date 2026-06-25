import Phaser from 'phaser';

/**
 * Drone — Represents a single targeting quadcopter entity.
 * Handles warning indicators, diving animation, explosion shockwaves,
 * particle effects, and player collision checking.
 */
export class Drone {
  /**
   * @param {Phaser.Scene} scene — The Phaser scene
   * @param {number} tx — World X coordinate of target
   * @param {number} ty — World Y coordinate of target
   * @param {number} scale — Pixel art scale factor
   * @param {Object} config — Configuration options
   * @param {Phaser.GameObjects.Particles.ParticleEmitter} config.particles — Emitter for explosions
   * @param {Phaser.GameObjects.Sprite} config.player — The player to check collision against
   * @param {Function} config.onExplode — Callback when the drone hits the target
   * @param {Function} config.onPlayerHit — Callback when player is caught in the blast
   */
  constructor(scene, tx, ty, scale, config) {
    /** @type {Phaser.Scene} */
    this.scene = scene;
    /** @type {number} */
    this.tx = tx;
    /** @type {number} */
    this.ty = ty;
    /** @type {number} */
    this.scale = scale;
    /** @type {Object} */
    this.config = config;

    /** @type {number} Warning countdown in ms */
    this.warningDuration = 2000;

    /** @type {number} Damage splash radius */
    this.explosionRadius = 32 * scale;

    // Active visual components
    /** @type {Phaser.GameObjects.Graphics | null} */
    this.indicator = null;
    /** @type {Phaser.GameObjects.Image | null} */
    this.droneImage = null;

    this.launch();
  }

  /**
   * Start warning reticle and drone dive-bomb.
   */
  launch() {
    this.createWarningIndicator();
    this.createDroneSprite();
  }

  /**
   * Creates the expanding warning circle reticle.
   * @private
   */
  createWarningIndicator() {
    this.indicator = this.scene.add.graphics({ x: this.tx, y: this.ty });
    this.indicator.setDepth(this.ty - 1);

    this.scene.tweens.addCounter({
      from: 0,
      to: this.explosionRadius,
      duration: this.warningDuration,
      onUpdate: (tween) => {
        if (!this.indicator || !this.indicator.active) return;
        const r = tween.getValue();
        this.indicator.clear();

        // Outer red boundary circle
        this.indicator.lineStyle(1 * this.scale, 0xff0000, 0.4);
        this.indicator.strokeCircle(0, 0, this.explosionRadius);

        // Inner solid circle warning fill
        this.indicator.fillStyle(0xff0000, 0.2 + (r / this.explosionRadius) * 0.35);
        this.indicator.fillCircle(0, 0, r);

        // Laser/scope crosshair lines
        this.indicator.lineStyle(1.5 * this.scale, 0xff0000, 0.7);
        this.indicator.lineBetween(-6 * this.scale, 0, 6 * this.scale, 0);
        this.indicator.lineBetween(0, -6 * this.scale, 0, 6 * this.scale);
      },
      onComplete: () => {
        if (this.indicator) {
          this.indicator.destroy();
          this.indicator = null;
        }
      }
    });
  }

  /**
   * Spawns drone sprite at high altitude and tweens it down.
   * @private
   */
  createDroneSprite() {
    const startX = this.tx - 100 * this.scale;
    const startY = this.ty - 220 * this.scale;

    this.droneImage = this.scene.add.image(startX, startY, 'drone');
    this.droneImage.setScale(this.scale * 1.5);
    this.droneImage.setDepth(3000);

    // Rotate to face the target coordinates
    const angle = Phaser.Math.Angle.Between(startX, startY, this.tx, this.ty);
    this.droneImage.setRotation(angle + Math.PI / 2);

    // Dive-bomb tween
    this.scene.tweens.add({
      targets: this.droneImage,
      x: this.tx,
      y: this.ty,
      scale: this.scale,
      duration: this.warningDuration,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        if (this.droneImage) {
          this.droneImage.destroy();
          this.droneImage = null;
        }
        this.explode();
      }
    });
  }

  /**
   * Triggers visual explosion, camera rumble, particle burst,
   * checks for player damage, and runs completion callback.
   * @private
   */
  explode() {
    // 1. Shockwave graphics
    const blast = this.scene.add.graphics({ x: this.tx, y: this.ty });
    blast.lineStyle(2 * this.scale, 0xff3300, 1);
    blast.fillStyle(0xffaa00, 0.5);
    blast.strokeCircle(0, 0, this.explosionRadius);
    blast.fillCircle(0, 0, this.explosionRadius);
    blast.setDepth(this.ty + 10);
    blast.setScale(0.1);

    this.scene.tweens.add({
      targets: blast,
      scale: 1,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => blast.destroy()
    });

    // 2. Particle burst
    if (this.config.particles) {
      this.config.particles.explode(25, this.tx, this.ty);
    }

    // 3. Camera rumble
    this.scene.cameras.main.shake(150, 0.006);

    // 4. Invoke general callback
    if (this.config.onExplode) {
      this.config.onExplode(this.tx, this.ty);
    }

    // 5. Collision check (distance to center-body)
    const player = this.config.player;
    if (player) {
      const distance = Phaser.Math.Distance.Between(
        player.x,
        player.y - 6 * this.scale,
        this.tx,
        this.ty
      );
      if (distance < this.explosionRadius) {
        if (this.config.onPlayerHit) {
          this.config.onPlayerHit();
        }
      }
    }
  }

  /**
   * Force clean up references and graphics if aborted.
   */
  destroy() {
    if (this.indicator) {
      this.indicator.destroy();
      this.indicator = null;
    }
    if (this.droneImage) {
      this.droneImage.destroy();
      this.droneImage = null;
    }
  }
}
