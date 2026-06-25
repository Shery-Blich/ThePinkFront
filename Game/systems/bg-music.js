/**
 * Start looping background music for a scene; auto-stops on scene shutdown.
 * Defensive: no-ops if the audio key isn't loaded so a missing file never crashes a scene.
 *
 * @param {Phaser.Scene} scene
 * @param {string} key - preloaded audio key
 * @param {{ volume?: number }} [opts]
 * @returns {Phaser.Sound.BaseSound|null}
 */
export function startSceneMusic(scene, key, { volume = 0.4 } = {}) {
  if (!scene.cache?.audio?.exists(key)) {
    return null;
  }
  const music = scene.sound.add(key, { loop: true, volume });
  music.play();
  scene.events.once('shutdown', () => music.stop());
  return music;
}
