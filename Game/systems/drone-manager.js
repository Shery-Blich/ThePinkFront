import Phaser from 'phaser';
import { Drone } from '../entities/drone.js';

/**
 * DroneManager — Coordinates drone spawning, targeting, and lifecycle events.
 * 
 * Acting as the Controller/Model:
 * - Schedules spawning at regular intervals.
 * - Computes trajectory predictions and boundary clamping.
 * - Spawns individual Drone instances.
 * - Emits event-driven notifications for state updates (e.g. hits, counts, victory).
 */
export class DroneManager extends Phaser.Events.EventEmitter {
  /**
   * @param {Phaser.Scene} scene — The Phaser scene
   * @param {Phaser.Physics.Arcade.Sprite} player — The player sprite
   * @param {Object} config — Configuration options
   * @param {Phaser.GameObjects.Particles.ParticleEmitter} config.particles — Explosion particles
   * @param {number} config.roadTop — Top boundary of road
   * @param {number} config.roadBottom — Bottom boundary of road
   * @param {number} config.worldWidth — Width of the world
   * @param {number} config.scale — Pixel art scale factor
   */
  constructor(scene, player, config) {
    super();

    /** @type {Phaser.Scene} */
    this.scene = scene;
    /** @type {Phaser.Physics.Arcade.Sprite} */
    this.player = player;
    /** @type {Object} */
    this.config = config;

    /** @type {number} */
    this.dronesSpawned = 0;
    /** @type {number} */
    this.dronesExploded = 0;
    /** @type {number} Total drones to dodge */
    this.maxDrones = 10;
    /** @type {Drone[]} List of active drone instances */
    this.activeDrones = [];
    /** @type {Phaser.Time.TimerEvent | null} Spawning timer */
    this.timer = null;
    /** @type {boolean} Stopped state */
    this.isStopped = false;

    // Hook cleanup
    this._onShutdown = this.destroy.bind(this);
    this.scene.events.once('shutdown', this._onShutdown);
  }

  /**
   * Starts the periodic drone spawning cycle.
   */
  start() {
    if (this.isStopped) return;

    this.dronesSpawned = 0;
    this.dronesExploded = 0;

    // Spawn a drone every 3.5 seconds, starting 1 second in (startAt = 2.5s)
    this.timer = this.scene.time.addEvent({
      delay: 3500,
      callback: this.spawnDrone,
      callbackScope: this,
      loop: true,
      startAt: 2500
    });
  }

  /**
   * Spawns a single drone targeting the player's predicted path.
   */
  spawnDrone() {
    if (this.isStopped) return;
    if (this.dronesSpawned >= this.maxDrones) {
      if (this.timer) this.timer.remove();
      return;
    }

    this.dronesSpawned++;
    this.emit('drone-spawned', this.dronesSpawned);

    // Predict player path (lead by 1.3 seconds)
    const body = this.player.body;
    let tx = this.player.x;
    let ty = this.player.y - 6 * this.config.scale;

    if (body && (Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1)) {
      const leadTime = 1.3;
      tx += body.velocity.x * leadTime;
      ty += body.velocity.y * leadTime;
    }

    // Clamp coordinates within world/road bounds
    const padding = 24 * this.config.scale;
    tx = Phaser.Math.Clamp(tx, padding, this.config.worldWidth - padding);
    ty = Phaser.Math.Clamp(ty, this.config.roadTop + 8 * this.config.scale, this.config.roadBottom - 8 * this.config.scale);

    // Instantiate a new Drone entity
    const drone = new Drone(this.scene, tx, ty, this.config.scale, {
      particles: this.config.particles,
      player: this.player,
      onExplode: () => {
        this.handleDroneExplode(drone);
      },
      onPlayerHit: () => {
        this.emit('player-hit');
      }
    });

    this.activeDrones.push(drone);
  }

  /**
   * Internal handler when a drone finishes explosion.
   * @param {Drone} drone 
   * @private
   */
  handleDroneExplode(drone) {
    // Remove from active list
    const index = this.activeDrones.indexOf(drone);
    if (index !== -1) {
      this.activeDrones.splice(index, 1);
    }

    this.dronesExploded++;
    this.emit('drone-exploded', this.dronesExploded);

    if (this.dronesExploded === this.maxDrones) {
      this.stop();
      this.emit('all-drones-dodged');
    }
  }

  /**
   * Stop spawning and halt active drones.
   */
  stop() {
    this.isStopped = true;
    if (this.timer) {
      this.timer.remove();
      this.timer = null;
    }
  }

  /**
   * Full cleanup of listeners and active drones.
   */
  destroy() {
    this.stop();
    this.scene.events.off('shutdown', this._onShutdown);

    // Clean up active drones
    for (const drone of this.activeDrones) {
      drone.destroy();
    }
    this.activeDrones = [];

    this.removeAllListeners();
  }
}
