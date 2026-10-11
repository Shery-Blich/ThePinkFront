import Phaser from 'phaser';
import { isDesktopDevice } from './joystick-move.js';

/**
 * MovementTutorial — Interactive tutorial overlay for teaching movement/jumping.
 */
export class MovementTutorial {
  /**
   * Create a Joystick Movement Tutorial in Scene 1.
   * Points to the joystick and shows a floating card.
   * 
   * @param {Phaser.Scene} scene 
   * @param {Player} player 
   */
  static showJoystickTutorial(scene, player) {
    // Desktop players use keyboard controls by default; the joystick graphic
    // itself is hidden there too (see JoystickMove), so this tutorial doesn't apply.
    if (isDesktopDevice(scene)) return;

    // 1. Create the HTML Card overlay
    const card = document.createElement('div');
    card.className = 'tutorial-card';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, 20px)'; // Center horizontally
    card.style.bottom = '120px';
    card.innerHTML = `
      <div class="highlight-text">גררו את הג'ויסטיק כדי לזוז!</div>
      <div class="sub-text">גררו לכל כיוון כדי להתחמק מהרחפנים</div>
    `;
    document.body.appendChild(card);
    
    // Trigger transition (preserving centering)
    requestAnimationFrame(() => {
      card.style.transform = 'translate(-50%, 0)';
      card.classList.add('show');
    });

    // 2. Create the Phaser Arrow Pointer
    const joystick = player.movement;
    const arrow = scene.add.graphics();
    arrow.setScrollFactor(0);
    arrow.setDepth(10000); // Above gameplay elements

    const drawArrow = (size = 18) => {
      arrow.clear();
      // Glowing neon pink line & fill
      arrow.lineStyle(4, 0xff007f, 1);
      arrow.fillStyle(0xff007f, 0.9);

      // Line tail pointing to head (0,0)
      arrow.beginPath();
      arrow.moveTo(size * 1.8, -size * 1.8);
      arrow.lineTo(size * 0.6, -size * 0.6);
      arrow.strokePath();

      // Triangle head at (0,0) pointing down-left
      arrow.beginPath();
      arrow.moveTo(0, 0);
      arrow.lineTo(size * 0.9, 0);
      arrow.lineTo(0, -size * 0.9);
      arrow.closePath();
      arrow.fillPath();
    };
    drawArrow();

    // Position arrow pointing to the top-right edge of the joystick
    const updatePosition = () => {
      const baseX = joystick.baseX || 60;
      const baseY = joystick.baseY || (scene.scale.height - 60);
      const radius = joystick.config.maxRadius || 45;
      
      // Place the tip outside the joystick border (baseX + radius, baseY - radius)
      // and point down-left towards it
      const targetX = baseX + radius * 1.1;
      const targetY = baseY - radius * 1.1;
      
      arrow.setPosition(targetX, targetY);
    };
    updatePosition();

    // Animate the arrow bouncing diagonally
    const bounceTween = scene.tweens.add({
      targets: arrow,
      x: '+=12',
      y: '-=12',
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Handle screen resize
    const onResize = () => {
      updatePosition();
    };
    scene.scale.on('resize', onResize);

    // Clean up
    const dismiss = () => {
      scene.scale.off('resize', onResize);
      if (bounceTween) bounceTween.destroy();
      
      // Fade out arrow in Phaser
      scene.tweens.add({
        targets: arrow,
        alpha: 0,
        scale: 0.5,
        duration: 400,
        onComplete: () => {
          arrow.destroy();
        }
      });

      // Fade out HTML card
      card.style.transform = 'translate(-50%, 20px)';
      card.classList.remove('show');
      setTimeout(() => {
        card.remove();
      }, 500);
    };

    // Automatically dismiss once player starts moving
    player.once('move-start', dismiss);

    // Safety fallback: if scene shuts down before move, clean up
    scene.events.once('shutdown', () => {
      scene.scale.off('resize', onResize);
      card.remove();
    });
  }

  /**
   * Create a Jump Tutorial in Scene 2.
   * Shows a floating card centered at the bottom.
   * 
   * @param {Phaser.Scene} scene 
   */
  static showJumpTutorial(scene) {
    const isDesktop = isDesktopDevice(scene);

    // 1. Create the HTML Card overlay
    const card = document.createElement('div');
    card.className = 'tutorial-card';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, 20px)'; // Center horizontally
    card.style.bottom = '120px';
    if (isDesktop) {
      card.innerHTML = `
        <div class="highlight-text">לחצו על מקש רווח או חץ למעלה כדי לקפוץ!</div>
        <div class="sub-text">אספו מצרכים והתקדמו בסופרמרקט</div>
      `;
    } else {
      card.innerHTML = `
        <div class="highlight-text">לחצו על כפתור הקפיצה כדי לקפוץ!</div>
        <div class="sub-text">אספו מצרכים והתקדמו בסופרמרקט</div>
      `;
    }
    document.body.appendChild(card);
    
    // Trigger transition (preserving centering)
    requestAnimationFrame(() => {
      card.style.transform = 'translate(-50%, 0)';
      card.classList.add('show');
    });

    // 2. Highlight jump button on mobile
    const jumpBtn = document.getElementById('html-jump-btn');
    if (!isDesktop && jumpBtn) {
      jumpBtn.classList.add('tutorial-highlight');
    }

    // Clean up
    const dismiss = () => {
      if (jumpBtn) {
        jumpBtn.classList.remove('tutorial-highlight');
      }
      // Fade out HTML card
      card.style.transform = 'translate(-50%, 20px)';
      card.classList.remove('show');
      setTimeout(() => {
        card.remove();
      }, 500);
    };

    // Dismiss when player jumps
    scene.events.once('player-jump', dismiss);

    // Safety fallback: if scene shuts down before jump, clean up
    scene.events.once('shutdown', () => {
      scene.events.off('player-jump', dismiss);
      if (jumpBtn) jumpBtn.classList.remove('tutorial-highlight');
      card.remove();
    });
  }

  /**
   * Show a glowing arrow pointing right with a label above it, fixed to the
   * screen behind the gameplay (in front of the background only). Fades out once
   * the player has moved right for about a second.
   *
   * @param {Phaser.Scene} scene
   * @param {object} options
   * @param {string} options.label - Text shown above the arrow.
   * @param {Phaser.GameObjects.Sprite} options.player - Player whose rightward movement dismisses the arrow.
   * @param {number} [options.depth=-1] - Render depth; must sit between the background and the platforms.
   * @returns {Phaser.GameObjects.Container}
   */
  static showDirectionArrow(scene, { label, player, depth = -1 }) {
    const container = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth).setAlpha(0);
    const glow = scene.add.graphics();
    const arrow = scene.add.graphics();
    const text = scene.add.text(0, 0, label, {
      fontFamily: 'Rubik, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5, 1);
    container.add([glow, arrow, text]);

    // Right-pointing arrow polygon, centred on (0,0), sized by its total length
    const arrowPoints = (len) => {
      const shaftH = len * 0.22;
      const headH = len * 0.55;
      const headStart = len * 0.1;
      return [
        { x: -len / 2, y: -shaftH / 2 },
        { x: headStart, y: -shaftH / 2 },
        { x: headStart, y: -headH / 2 },
        { x: len / 2, y: 0 },
        { x: headStart, y: headH / 2 },
        { x: headStart, y: shaftH / 2 },
        { x: -len / 2, y: shaftH / 2 },
      ];
    };

    let nudgeDistance = 0;
    const layout = () => {
      const { width, height } = scene.scale;
      // Scale off the smaller screen dimension so it fits portrait and landscape alike
      const len = Math.min(width * 0.2, height * 0.3);

      glow.clear();
      // Soft halo: stacked strokes that widen and fade outward
      for (let i = 4; i >= 1; i -= 1) {
        glow.lineStyle(i * len * 0.025, 0xffd1ea, 0.12);
        glow.strokePoints(arrowPoints(len), true, true);
      }

      arrow.clear();
      arrow.fillStyle(0xff007f, 0.95);
      arrow.fillPoints(arrowPoints(len), true, true);
      arrow.lineStyle(len * 0.015, 0xffffff, 0.9);
      arrow.strokePoints(arrowPoints(len), true, true);

      text.setFontSize(Math.round(len * 0.22));
      text.setStroke('#ff007f', len * 0.025);
      text.setShadow(0, 0, '#ff7fbf', len * 0.08, true, true);
      text.setPosition(0, -len * 0.32);

      container.setPosition(width / 2, height * 0.38);
      nudgeDistance = len * 0.06;
    };
    layout();
    scene.scale.on('resize', layout);

    const tweens = [
      // Shine: halo breathes in and out
      scene.tweens.add({ targets: glow, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      // Light flicker on the arrow body
      scene.tweens.add({ targets: arrow, alpha: 0.7, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      // Nudge towards the destination
      scene.tweens.add({ targets: [glow, arrow], x: { getEnd: () => nudgeDistance }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
    ];
    scene.tweens.add({ targets: container, alpha: 1, duration: 500 });

    const DISMISS_AFTER_MS = 1000;
    let movingRightMs = 0;
    let dismissed = false;
    const cleanup = () => {
      scene.events.off('update', onUpdate);
      scene.scale.off('resize', layout);
      tweens.forEach((t) => t.destroy());
    };
    const onUpdate = (time, delta) => {
      if (dismissed) return;
      if (player && player.body && player.body.velocity.x > 0) {
        movingRightMs += delta;
      }
      if (movingRightMs < DISMISS_AFTER_MS) return;
      dismissed = true;
      cleanup();
      scene.tweens.add({
        targets: container,
        alpha: 0,
        duration: 500,
        onComplete: () => container.destroy(),
      });
    };
    scene.events.on('update', onUpdate);
    scene.events.once('shutdown', cleanup);

    return container;
  }
}
