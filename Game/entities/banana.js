import Phaser from 'phaser';
import { addGlobalScore } from '../systems/score-manager.js';

/**
 * Banana — Represents a banana peel mine dropped by the President.
 * Displays a yellow ground warning reticle, arcing banana projectile,
 * and rests on the floor.
 * - If player touches it: triggers uncontrollable cartoon slide (0 pts).
 * - If player avoids it: fades out and awards +3 points!
 */
export class Banana {
  /**
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {number} sx - Source X (President X)
   * @param {number} sy - Source Y (President Y)
   * @param {number} tx - Target X (Floor target X)
   * @param {number} ty - Target Y (Floor target Y)
   * @param {number} scale - Scale factor
   * @param {Object} config - Callbacks & references
   * @param {Phaser.GameObjects.Sprite} config.player - Player sprite
   * @param {Function} [config.onSlip] - Callback when player slips/touches banana
   * @param {Function} [config.onAvoid] - Callback when player avoids banana (+3 pts)
   */
  constructor(scene, sx, sy, tx, ty, scale, config) {
    this.scene = scene;
    this.sx = sx;
    this.sy = sy;
    this.tx = tx;
    this.ty = ty;
    this.scale = scale;
    this.config = config;

    /** Warning reticle duration in ms (original 1.0s throw speed) */
    this.warningDuration = 1000;

    /** Hitbox radius on floor (75% of original 24 * scale = 18 * scale) */
    this.hitRadius = 18 * scale;

    /** Floor life duration in ms before safely expiring and awarding +3 points */
    this.floorDuration = 3500;
    this.floorTimer = 0;

    /** Is banana resting on floor active */
    this.isLanded = false;
    this.isResolved = false;

    /** @type {Phaser.GameObjects.Graphics | null} */
    this.indicator = null;

    /** @type {Phaser.Tweens.Tween | null} */
    this.indicatorPulseTween = null;

    /** @type {Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | null} */
    this.bananaImage = null;

    this.launch();
  }

  launch() {
    this.createWarningIndicator();
    this.createBananaProjectile();
  }

  /**
   * Creates expanding yellow warning reticle on floor.
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

        // Yellow warning boundary circle on floor
        this.indicator.lineStyle(2.5 * this.scale, 0xffd700, 0.9);
        this.indicator.strokeCircle(0, 0, this.hitRadius);

        // Yellow fill inside reticle
        this.indicator.fillStyle(0xffff00, 0.2 + (r / this.hitRadius) * 0.4);
        this.indicator.fillCircle(0, 0, r);

        // Crosshair lines in yellow
        this.indicator.lineStyle(1.5 * this.scale, 0xffd700, 0.9);
        this.indicator.lineBetween(-6 * this.scale, 0, 6 * this.scale, 0);
        this.indicator.lineBetween(0, -6 * this.scale, 0, 6 * this.scale);
      },
      onComplete: () => {
        if (this.indicator && this.indicator.active) {
          this.drawLandedIndicator();
        }
      }
    });
  }

  /**
   * Draws and maintains landed banana mine hitbox circle on the floor until despawn.
   * @private
   */
  drawLandedIndicator() {
    if (!this.indicator || !this.indicator.active) return;
    this.indicator.clear();

    // Clear outer boundary circle indicating exact banana mine hitbox area
    this.indicator.lineStyle(2.5 * this.scale, 0xffd700, 0.85);
    this.indicator.strokeCircle(0, 0, this.hitRadius);

    // Hazard warning fill
    this.indicator.fillStyle(0xffff00, 0.25);
    this.indicator.fillCircle(0, 0, this.hitRadius);

    // Crosshair lines in yellow
    this.indicator.lineStyle(1.5 * this.scale, 0xffd700, 0.6);
    this.indicator.lineBetween(-4 * this.scale, 0, 4 * this.scale, 0);
    this.indicator.lineBetween(0, -4 * this.scale, 0, 4 * this.scale);

    // Subtle pulsing animation so the banana mine zone stays clearly visible
    if (!this.indicatorPulseTween && this.scene && this.scene.tweens) {
      this.indicatorPulseTween = this.scene.tweens.add({
        targets: this.indicator,
        alpha: { from: 1, to: 0.5 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  /**
   * Creates banana sprite at President's position and arcs it down to floor target.
   * @private
   */
  createBananaProjectile() {
    if (this.scene.textures.exists('banana')) {
      this.bananaImage = this.scene.add.image(this.sx, this.sy - 12 * this.scale, 'banana');
    } else {
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0xffe135, 1);
      gfx.fillCircle(0, 0, 8 * this.scale);
      this.bananaImage = gfx;
      this.bananaImage.x = this.sx;
      this.bananaImage.y = this.sy - 12 * this.scale;
    }

    this.bananaImage.setScale(this.scale * 1.4);
    this.bananaImage.setDepth(3500);

    // Arcing tween down to target coordinates
    this.scene.tweens.add({
      targets: this.bananaImage,
      x: this.tx,
      y: this.ty,
      duration: this.warningDuration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.onLand();
      }
    });

    // Spin rotation while arcing
    this.scene.tweens.add({
      targets: this.bananaImage,
      angle: 540,
      duration: this.warningDuration,
      ease: 'Linear'
    });
  }

  /**
   * Called when banana lands on the floor.
   * @private
   */
  onLand() {
    const player = this.config.player;
    let directHit = false;

    if (player && player.active) {
      const dist = Phaser.Math.Distance.Between(
        player.x,
        player.y - 6 * this.scale,
        this.tx,
        this.ty
      );
      if (dist < this.hitRadius) {
        directHit = true;
      }
    }

    if (directHit) {
      // Landed directly on player! Trigger slip immediately!
      this.triggerSlip();
    } else {
      // Resting on floor waiting for player or timer expiry
      this.isLanded = true;
      if (this.bananaImage && this.bananaImage.active) {
        this.bananaImage.setDepth(this.ty);
        this.bananaImage.setScale(this.scale * 1.3);
      }
      this.drawLandedIndicator();
    }
  }

  /**
   * Update method called each frame while landed on floor.
   * @param {number} delta - Frame delta time in ms
   */
  update(delta = 16) {
    if (!this.isLanded || this.isResolved) return;

    this.floorTimer += delta;

    const player = this.config.player;
    if (player && player.active) {
      const dist = Phaser.Math.Distance.Between(
        player.x,
        player.y - 6 * this.scale,
        this.tx,
        this.ty
      );

      if (dist < this.hitRadius) {
        // Player touched / stepped on banana peel! Trigger slide!
        this.triggerSlip();
        return;
      }
    }

    // If player avoided banana on floor for floorDuration (3.5s), expire safely and award +3 pts!
    if (this.floorTimer >= this.floorDuration) {
      this.triggerAvoid();
    }
  }

  /**
   * Triggers cartoon slide effect when touched.
   * @private
   */
  triggerSlip() {
    if (this.isResolved) return;
    this.isResolved = true;

    const player = this.config.player;
    if (player && typeof player.slide === 'function') {
      player.slide(300);
    }

    if (this.config.onSlip) {
      this.config.onSlip(this.tx, this.ty);
    }

    this.destroy();
  }

  /**
   * Triggers avoid (+3 points) when banana expires without player touching it.
   * @private
   */
  triggerAvoid() {
    if (this.isResolved) return;
    this.isResolved = true;

    // Player avoided banana! Award +3 points & floating popup text
    addGlobalScore(this.scene, 3, this.tx, this.ty);

    const fadeTargets = [];
    if (this.bananaImage && this.bananaImage.active) fadeTargets.push(this.bananaImage);
    if (this.indicator && this.indicator.active) fadeTargets.push(this.indicator);

    if (fadeTargets.length > 0) {
      this.scene.tweens.add({
        targets: fadeTargets,
        alpha: 0,
        scale: 0.2,
        duration: 300,
        onComplete: () => this.destroy()
      });
    } else {
      this.destroy();
    }

    if (this.config.onAvoid) {
      this.config.onAvoid(this.tx, this.ty);
    }
  }

  /**
   * Cleanup method.
   */
  destroy() {
    if (this.indicatorPulseTween) {
      this.indicatorPulseTween.stop();
      this.indicatorPulseTween = null;
    }
    if (this.indicator) {
      this.indicator.destroy();
      this.indicator = null;
    }
    if (this.bananaImage) {
      this.bananaImage.destroy();
      this.bananaImage = null;
    }
  }
}
