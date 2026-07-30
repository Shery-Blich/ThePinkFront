import Phaser from 'phaser';
import { addGlobalScore } from '../systems/score-manager.js';

/**
 * Mine — Represents a landmine dropped or thrown by the President.
 * Displays a floor warning reticle, arcing mine projectile, explosion shockwave,
 * collision check (with increased hitbox), and +3 points award on dodge.
 */
export class Mine {
  /**
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {number} sx - Source X (President X)
   * @param {number} sy - Source Y (President Y)
   * @param {number} tx - Target X (Target floor X)
   * @param {number} ty - Target Y (Target floor Y)
   * @param {number} scale - Scale factor
   * @param {Object} config - Callbacks & references
   * @param {Phaser.GameObjects.Sprite} config.player - Player sprite to check collision against
   * @param {Function} [config.onHit] - Callback when player is hit
   * @param {Function} [config.onDodge] - Callback when player dodges (+3 points)
   * @param {Function} [config.onComplete] - Callback when mine animation ends
   */
  constructor(scene, sx, sy, tx, ty, scale, config) {
    this.scene = scene;
    this.sx = sx;
    this.sy = sy;
    this.tx = tx;
    this.ty = ty;
    this.scale = scale;
    this.config = config;

    /** Warning reticle duration in ms (1.2 seconds) */
    this.warningDuration = 1200;

    /** Increased hitbox radius on floor */
    this.hitRadius = 24 * scale;

    /** @type {Phaser.GameObjects.Graphics | null} */
    this.indicator = null;

    /** @type {Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | null} */
    this.mineImage = null;

    this.launch();
  }

  launch() {
    this.createWarningIndicator();
    this.createMineProjectile();
  }

  /**
   * Creates expanding warning reticle on the floor.
   * @private
   */
  createWarningIndicator() {
    this.indicator = this.scene.add.graphics({ x: this.tx, y: this.ty });
    this.indicator.setDepth(this.ty - 1);

    this.scene.tweens.addCounter({
      from: 0,
      to: this.hitRadius,
      duration: this.warningDuration,
      onUpdate: (tween) => {
        if (!this.indicator || !this.indicator.active) return;
        const r = tween.getValue();
        this.indicator.clear();

        // Orange/red warning boundary circle on floor
        this.indicator.lineStyle(2.5 * this.scale, 0xf97316, 0.9);
        this.indicator.strokeCircle(0, 0, this.hitRadius);

        // Warning fill inside reticle
        this.indicator.fillStyle(0xef4444, 0.2 + (r / this.hitRadius) * 0.4);
        this.indicator.fillCircle(0, 0, r);

        // Crosshair hazard lines
        this.indicator.lineStyle(2 * this.scale, 0xf97316, 0.9);
        this.indicator.lineBetween(-7 * this.scale, 0, 7 * this.scale, 0);
        this.indicator.lineBetween(0, -7 * this.scale, 0, 7 * this.scale);
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
   * Creates mine sprite at President's position and drops it to floor target.
   * @private
   */
  createMineProjectile() {
    if (this.scene.textures.exists('mine')) {
      this.mineImage = this.scene.add.image(this.sx, this.sy - 12 * this.scale, 'mine');
    } else {
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0x374151, 1);
      gfx.fillCircle(0, 0, 8 * this.scale);
      this.mineImage = gfx;
      this.mineImage.x = this.sx;
      this.mineImage.y = this.sy - 12 * this.scale;
    }

    this.mineImage.setScale(this.scale * 1.3);
    this.mineImage.setDepth(3500);

    // Arcing tween to floor coordinates
    this.scene.tweens.add({
      targets: this.mineImage,
      x: this.tx,
      y: this.ty,
      duration: this.warningDuration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.mineImage) {
          this.mineImage.destroy();
          this.mineImage = null;
        }
        this.explode();
      }
    });

    // Slight rotation while arcing down
    this.scene.tweens.add({
      targets: this.mineImage,
      angle: 360,
      duration: this.warningDuration,
      ease: 'Linear'
    });
  }

  /**
   * Explode handler: shockwave animation, explosion sound, collision check.
   * @private
   */
  explode() {
    // Explosion sound
    try {
      if (this.scene.sound) {
        this.scene.sound.play('sfx-explosion', { volume: 0.4 });
      }
    } catch (e) {}

    // Explosion shockwave
    const blast = this.scene.add.graphics({ x: this.tx, y: this.ty });
    blast.lineStyle(3 * this.scale, 0xff3300, 1);
    blast.fillStyle(0xffaa00, 0.6);
    blast.strokeCircle(0, 0, this.hitRadius);
    blast.fillCircle(0, 0, this.hitRadius);
    blast.setDepth(this.ty + 10);
    blast.setScale(0.2);

    this.scene.tweens.add({
      targets: blast,
      scale: 1.25,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => blast.destroy()
    });

    // Camera shake
    this.scene.cameras.main.shake(120, 0.005);

    // Collision check
    const player = this.config.player;
    let wasHit = false;

    if (player && player.active) {
      const dist = Phaser.Math.Distance.Between(
        player.x,
        player.y - 6 * this.scale,
        this.tx,
        this.ty
      );

      if (dist < this.hitRadius) {
        wasHit = true;
      }
    }

    if (wasHit) {
      if (this.config.onHit) {
        this.config.onHit(this.tx, this.ty);
      }
    } else {
      // Player dodged! Award +3 points & floating popup text
      addGlobalScore(this.scene, 3, this.tx, this.ty);
      if (this.config.onDodge) {
        this.config.onDodge(this.tx, this.ty);
      }
    }

    if (this.config.onComplete) {
      this.config.onComplete(wasHit);
    }
  }

  /**
   * Cleanup method if scene shuts down early.
   */
  destroy() {
    if (this.indicator) {
      this.indicator.destroy();
      this.indicator = null;
    }
    if (this.mineImage) {
      this.mineImage.destroy();
      this.mineImage = null;
    }
  }
}
