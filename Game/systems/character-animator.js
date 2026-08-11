/**
 * character-animator — Lightweight tween-based "fake" animation for single-image
 * characters (no spritesheet frames available). Purely visual: scale/angle only,
 * never touches position, so it's safe to run alongside Arcade Physics.
 *
 * Two states:
 *  - 'running': bouncy squash-and-stretch cycle
 *  - 'idle': style-dependent — 'scared' (look around) or 'crying' (hunch + shake)
 */

const RUN_BOUNCE_MS = 140;
const RUN_WOBBLE_MS = 220;
const IDLE_SCARED_LOOK_MS = 900;
const IDLE_CRYING_HUNCH_MS = 250;
const IDLE_CRYING_SHAKE_MS = 100;
const JUMP_STRETCH_MS = 110;
const JUMP_LAND_SQUASH_MS = 90;
const JUMP_LAND_RECOVER_MS = 160;
const MOVE_THRESHOLD = 5;

function stopAnimTweens(sprite) {
  if (sprite._animTweens) {
    sprite._animTweens.forEach((t) => t && t.stop && t.stop());
  }
  sprite._animTweens = null;
}

function setAnimationState(sprite, state, style = 'default') {
  if (!sprite || !sprite.scene) return;

  const key = `${state}:${style}`;
  if (sprite._animState === key) return;
  sprite._animState = key;

  stopAnimTweens(sprite);

  const scene = sprite.scene;

  if (sprite._baseScaleX === undefined || sprite._baseScaleY === undefined) {
    if (!sprite._animState) {
      sprite._baseScaleX = sprite.scaleX;
      sprite._baseScaleY = sprite.scaleY;
    }
  }
  const bx = sprite._baseScaleX ?? sprite.scaleX;
  const by = sprite._baseScaleY ?? sprite.scaleY;

  sprite.setAngle(0);
  sprite.setScale(bx, by);

  if (state === 'running') {
    sprite._animTweens = [
      scene.tweens.add({
        targets: sprite,
        scaleX: bx * 0.92,
        scaleY: by * 1.08,
        duration: RUN_BOUNCE_MS,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
      scene.tweens.add({
        targets: sprite,
        angle: { from: -4, to: 4 },
        duration: RUN_WOBBLE_MS,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    ];
    return;
  }

  // state === 'idle'
  if (style === 'scared') {
    sprite._animTweens = [
      scene.tweens.add({
        targets: sprite,
        angle: { from: -10, to: 10 },
        duration: IDLE_SCARED_LOOK_MS,
        yoyo: true,
        repeat: -1,
        hold: 250,
        ease: 'Sine.easeInOut',
      }),
      scene.tweens.add({
        targets: sprite,
        scaleY: by * 1.015,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    ];
  } else if (style === 'crying') {
    sprite._animTweens = [
      scene.tweens.add({
        targets: sprite,
        scaleY: by * 0.85,
        scaleX: bx * 1.06,
        duration: IDLE_CRYING_HUNCH_MS,
        ease: 'Sine.easeOut',
      }),
      scene.tweens.add({
        targets: sprite,
        angle: { from: -3, to: 3 },
        duration: IDLE_CRYING_SHAKE_MS,
        yoyo: true,
        repeat: -1,
        delay: IDLE_CRYING_HUNCH_MS,
        ease: 'Sine.easeInOut',
      }),
    ];
  } else {
    // 'breathe' (and default fallback): pure squash-and-stretch, no sway
    sprite._animTweens = [
      scene.tweens.add({
        targets: sprite,
        scaleX: bx * 0.985,
        scaleY: by * 1.02,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    ];
  }
}

/**
 * Call every frame with the character's current speed to drive run/idle state.
 *
 * @param {Phaser.GameObjects.Sprite} sprite
 * @param {number} speed — current velocity magnitude (px/s)
 * @param {'scared'|'crying'|'default'} [idleStyle='default']
 */
export function updateCharacterAnimation(sprite, speed, idleStyle = 'default') {
  if (!sprite || !sprite.active) return;
  const state = speed > MOVE_THRESHOLD ? 'running' : 'idle';
  setAnimationState(sprite, state, state === 'idle' ? idleStyle : 'default');
}

/**
 * Trigger the jump launch pose: a stretched "punch upward" pose held until
 * playJumpLandAnimation() is called. The physics velocity impulse has
 * already happened by the time this is called (there's no window to show a
 * pre-liftoff crouch without visually squatting while already airborne), so
 * this snaps cleanly to base scale/angle first, then stretches — no
 * anticipation crouch. Overrides whatever run/idle animation was playing —
 * the caller is responsible for not calling updateCharacterAnimation()
 * again until after the jump resolves.
 *
 * @param {Phaser.GameObjects.Sprite} sprite
 */
export function playJumpAnimation(sprite) {
  if (!sprite || !sprite.scene) return;

  stopAnimTweens(sprite);
  sprite._animState = 'jump';

  const scene = sprite.scene;
  if (sprite._baseScaleX === undefined || sprite._baseScaleY === undefined) {
    if (!sprite._animState) {
      sprite._baseScaleX = sprite.scaleX;
      sprite._baseScaleY = sprite.scaleY;
    }
  }
  const bx = sprite._baseScaleX ?? sprite.scaleX;
  const by = sprite._baseScaleY ?? sprite.scaleY;
  sprite.setAngle(0);
  sprite.setScale(bx, by);

  sprite._animTweens = [
    scene.tweens.add({
      targets: sprite,
      scaleX: bx * 0.85,
      scaleY: by * 1.2,
      duration: JUMP_STRETCH_MS,
      ease: 'Quad.easeOut',
    }),
  ];
}

/**
 * Trigger the jump landing pose: a quick impact squash that springs back to
 * base scale. Clears the animator state on completion so the next
 * updateCharacterAnimation() call picks idle/running fresh.
 *
 * @param {Phaser.GameObjects.Sprite} sprite
 * @param {() => void} [onComplete] — called once the landing pose fully settles
 */
export function playJumpLandAnimation(sprite, onComplete) {
  if (!sprite || !sprite.scene) {
    if (onComplete) onComplete();
    return;
  }

  stopAnimTweens(sprite);
  sprite._animState = 'jump-land';

  const scene = sprite.scene;
  const bx = sprite._baseScaleX ?? sprite.scaleX;
  const by = sprite._baseScaleY ?? sprite.scaleY;
  sprite.setAngle(0);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (sprite.active) {
      sprite.setScale(bx, by);
      sprite._animState = null;
    }
    if (onComplete) onComplete();
  };

  const recoverTween = scene.tweens.add({
    targets: sprite,
    scaleX: bx,
    scaleY: by,
    duration: JUMP_LAND_RECOVER_MS,
    ease: 'Back.easeOut',
    paused: true,
    onComplete: finish,
  });

  const squashTween = scene.tweens.add({
    targets: sprite,
    scaleX: bx * 1.2,
    scaleY: by * 0.75,
    duration: JUMP_LAND_SQUASH_MS,
    ease: 'Quad.easeOut',
    onComplete: () => {
      if (sprite.active && recoverTween && recoverTween.play) {
        recoverTween.play();
      } else {
        finish();
      }
    },
  });

  sprite._animTweens = [squashTween, recoverTween];
}

/**
 * Stop and clean up any animator tweens on this sprite (call on destroy).
 * @param {Phaser.GameObjects.Sprite} sprite
 */
export function stopCharacterAnimation(sprite) {
  stopAnimTweens(sprite);
  if (sprite) {
    sprite._animState = null;
    if (typeof sprite._resetJumpFlags === 'function') {
      sprite._resetJumpFlags();
    }
  }
}

/**
 * Stop animator tweens AND snap angle/scale back to their pre-animation base.
 * Call this before any hand-authored cutscene tween takes over the same
 * sprite's angle/scale (game-over falls, shrink-into-doorway fades, etc.) —
 * otherwise the looping animator tween keeps fighting it for those properties.
 *
 * @param {Phaser.GameObjects.Sprite} sprite
 */
export function resetCharacterVisual(sprite) {
  stopCharacterAnimation(sprite);
  if (!sprite) return;
  sprite.setAngle(0);
  if (sprite._baseScaleX !== undefined && sprite._baseScaleY !== undefined) {
    sprite.setScale(sprite._baseScaleX, sprite._baseScaleY);
  }
}
