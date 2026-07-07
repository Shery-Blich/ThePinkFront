import Phaser from 'phaser';

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
    // 1. Create the HTML Card overlay
    const card = document.createElement('div');
    card.className = 'tutorial-card';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, 20px)'; // Center horizontally
    card.style.bottom = '120px';
    card.innerHTML = `
      <div class="highlight-text">לחצו על המסך כדי לקפוץ!</div>
      <div class="sub-text">לחצו בכל מקום מחוץ לג'ויסטיק כדי לאסוף מצרכים</div>
    `;
    document.body.appendChild(card);
    
    // Trigger transition (preserving centering)
    requestAnimationFrame(() => {
      card.style.transform = 'translate(-50%, 0)';
      card.classList.add('show');
    });

    // Clean up
    const dismiss = () => {
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
      card.remove();
    });
  }
}
