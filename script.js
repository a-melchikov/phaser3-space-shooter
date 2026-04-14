const CONFIG = {
  width: 960,
  height: 540,
  storageKey: "spaceShooterHighscoresV1",
  bossEvery: 5,
  waveTransitionDuration: 1.5
};

const GameState = Object.freeze({
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  WAVE_TRANSITION: "wave_transition",
  GAME_OVER: "game_over"
});

const POWER_UP_META = {
  heal: { label: "Ремонт", color: "#79f7c1" },
  doubleShot: { label: "Двойной выстрел", color: "#7db0ff" },
  shield: { label: "Щит", color: "#ffd56b" }
};

const SCORE_VALUES = {
  basic: 100,
  fast: 150,
  heavy: 300,
  bossHit: 5,
  bossKill: 2000,
  powerUp: 50
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function chance(value) {
  return Math.random() < value;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  unlock() {
    const AudioContextRef = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextRef) {
      return;
    }

    if (!this.ctx) {
      this.ctx = new AudioContextRef();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.08;
      this.master.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  playTone(type, frequencyA, frequencyB, duration, volume) {
    if (!this.ctx || !this.master) {
      return;
    }

    const now = this.ctx.currentTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequencyA), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, frequencyB), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  shoot() {
    this.playTone("square", 640, 430, 0.06, 0.035);
  }

  hit() {
    this.playTone("triangle", 200, 120, 0.08, 0.03);
  }

  explode(strong = false) {
    this.playTone("sawtooth", strong ? 180 : 240, 35, strong ? 0.22 : 0.14, strong ? 0.065 : 0.045);
  }

  powerup() {
    this.playTone("triangle", 340, 720, 0.16, 0.045);
  }

  boss() {
    this.playTone("sawtooth", 150, 90, 0.12, 0.05);
  }
}

class Star {
  constructor(width, height, layer) {
    this.width = width;
    this.height = height;
    this.layer = layer;
    this.reset(Math.random() * height);
  }

  reset(y = -8) {
    this.x = Math.random() * this.width;
    this.y = y;
    this.size = this.layer === 1 ? rand(1, 2.1) : rand(1.8, 3.4);
    this.speed = this.layer === 1 ? rand(24, 58) : rand(70, 120);
    this.alpha = this.layer === 1 ? rand(0.15, 0.4) : rand(0.35, 0.85);
    this.twinkle = rand(0, Math.PI * 2);
  }

  update(dt) {
    this.twinkle += dt * (this.layer === 1 ? 1.2 : 2.4);
    this.y += this.speed * dt;
    if (this.y > this.height + 8) {
      this.reset(-8);
    }
  }

  draw(ctx) {
    const glow = 0.25 + Math.sin(this.twinkle) * 0.15;
    ctx.fillStyle = `rgba(214, 243, 255, ${this.alpha + glow})`;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

class Particle {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = options.vx ?? rand(-140, 140);
    this.vy = options.vy ?? rand(-140, 140);
    this.life = options.life ?? 0.5;
    this.maxLife = this.life;
    this.size = options.size ?? rand(2, 4);
    this.color = options.color ?? "#ffffff";
    this.fade = options.fade ?? true;
    this.growth = options.growth ?? 0;
    this.drag = options.drag ?? 0.92;
    this.type = options.type ?? "spark";
    this.alive = true;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.size += this.growth * dt;
  }

  draw(ctx) {
    const alpha = this.fade ? this.life / this.maxLife : 1;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);

    if (this.type === "ring") {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

class Bullet {
  constructor({ x, y, vx, vy, radius, from, damage, color }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.from = from;
    this.damage = damage;
    this.color = color;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (
      this.y < -30 ||
      this.y > CONFIG.height + 30 ||
      this.x < -30 ||
      this.x > CONFIG.width + 30
    ) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  getCircle() {
    return { x: this.x, y: this.y, r: this.radius };
  }
}

class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.size = 18;
    this.speed = 82;
    this.life = 8;
    this.maxLife = 8;
    this.pulse = rand(0, Math.PI * 2);
    this.alive = true;
  }

  update(dt) {
    this.life -= dt;
    this.pulse += dt * 5;
    this.y += this.speed * dt;

    if (this.life <= 0 || this.y > CONFIG.height + 30) {
      this.alive = false;
    }
  }

  draw(ctx) {
    if (this.life < 2 && Math.floor(this.life * 10) % 2 === 0) {
      return;
    }

    const meta = POWER_UP_META[this.type];
    const pulseScale = 1 + Math.sin(this.pulse) * 0.08;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulseScale, pulseScale);

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();

    if (this.type === "heal") {
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
    } else if (this.type === "doubleShot") {
      ctx.moveTo(-7, -5);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-7, 5);
      ctx.moveTo(7, -5);
      ctx.lineTo(1, 0);
      ctx.lineTo(7, 5);
    } else {
      ctx.arc(0, 0, 7, Math.PI * 0.12, Math.PI * 0.88);
      ctx.moveTo(-7, 1);
      ctx.lineTo(0, 7);
      ctx.lineTo(7, 1);
    }

    ctx.stroke();
    ctx.restore();
  }

  getBounds() {
    return {
      x: this.x - this.size,
      y: this.y - this.size,
      w: this.size * 2,
      h: this.size * 2
    };
  }
}

class Player {
  constructor(game) {
    this.game = game;
    this.width = 44;
    this.height = 48;
    this.maxHealth = 100;
    this.speed = 320;
    this.fireCooldown = 0.18;
    this.resetForNewRun();
  }

  resetForNewRun() {
    this.lives = 3;
    this.health = this.maxHealth;
    this.fireTimer = 0;
    this.invulnerableTimer = 0;
    this.shieldTimer = 0;
    this.doubleShotTimer = 0;
    this.respawnTimer = 0;
    this.placeAtStart();
  }

  placeAtStart() {
    this.x = CONFIG.width / 2;
    this.y = CONFIG.height * 0.85;
  }

  update(dt) {
    this.fireTimer -= dt;
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.doubleShotTimer = Math.max(0, this.doubleShotTimer - dt);
    this.respawnTimer = Math.max(0, this.respawnTimer - dt);

    const left = this.game.keys.ArrowLeft || this.game.keys.KeyA;
    const right = this.game.keys.ArrowRight || this.game.keys.KeyD;
    const up = this.game.keys.ArrowUp || this.game.keys.KeyW;
    const down = this.game.keys.ArrowDown || this.game.keys.KeyS;

    let dx = 0;
    let dy = 0;

    if (left) dx -= 1;
    if (right) dx += 1;
    if (up) dy -= 1;
    if (down) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy) || 1;
      this.x += (dx / length) * this.speed * dt;
      this.y += (dy / length) * this.speed * dt;
    }

    this.x = clamp(this.x, this.width * 0.5 + 10, CONFIG.width - this.width * 0.5 - 10);
    this.y = clamp(this.y, this.height * 0.5 + 10, CONFIG.height - this.height * 0.5 - 10);

    if (this.game.keys.Space && this.fireTimer <= 0 && this.respawnTimer <= 0) {
      this.fire();
    }
  }

  fire() {
    this.fireTimer = this.fireCooldown;
    const offsets = this.doubleShotTimer > 0 ? [-11, 11] : [0];

    for (const offset of offsets) {
      this.game.playerBullets.push(
        new Bullet({
          x: this.x + offset,
          y: this.y - this.height * 0.44,
          vx: 0,
          vy: -520,
          radius: 4.5,
          from: "player",
          damage: 1,
          color: "#6ef2ff"
        })
      );
    }

    this.game.audio.shoot();
  }

  takeDamage(amount) {
    if (this.respawnTimer > 0 || this.invulnerableTimer > 0) {
      return false;
    }

    if (this.shieldTimer > 0) {
      this.game.audio.hit();
      this.game.createRingEffect(this.x, this.y, "#ffd76c", 22);
      return false;
    }

    this.health -= amount;
    this.invulnerableTimer = 1;
    this.game.addShake(6, 0.12);
    this.game.audio.hit();
    this.game.createImpact(this.x, this.y, "#ff7c69", 7);

    if (this.health <= 0) {
      this.lives -= 1;
      this.game.createExplosion(this.x, this.y, "#6ef2ff", 16, true);
      this.game.addShake(12, 0.25);
      this.game.audio.explode(true);

      if (this.lives <= 0) {
        this.health = 0;
        this.game.handleGameOver();
        return true;
      }

      this.health = this.maxHealth;
      this.placeAtStart();
      this.respawnTimer = 1;
      this.invulnerableTimer = 1.5;
    }

    return true;
  }

  applyPowerUp(type) {
    if (type === "heal") {
      this.health = Math.min(this.maxHealth, this.health + 30);
    } else if (type === "doubleShot") {
      this.doubleShotTimer = Math.max(this.doubleShotTimer, 8);
    } else if (type === "shield") {
      this.shieldTimer = Math.max(this.shieldTimer, 6);
    }
  }

  getActiveBonuses() {
    const bonuses = [];
    if (this.shieldTimer > 0) bonuses.push({ type: "shield", time: this.shieldTimer });
    if (this.doubleShotTimer > 0) bonuses.push({ type: "doubleShot", time: this.doubleShotTimer });
    return bonuses;
  }

  getBounds() {
    return {
      x: this.x - this.width * 0.5,
      y: this.y - this.height * 0.5,
      w: this.width,
      h: this.height
    };
  }

  draw(ctx) {
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 14) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.game.state === GameState.PLAYING || this.game.state === GameState.WAVE_TRANSITION) {
      ctx.fillStyle = "rgba(110, 242, 255, 0.28)";
      ctx.beginPath();
      ctx.moveTo(-7, this.height * 0.32);
      ctx.lineTo(0, this.height * 0.55 + rand(-1, 1));
      ctx.lineTo(7, this.height * 0.32);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#77a8ff";
    ctx.beginPath();
    ctx.moveTo(0, -this.height * 0.58);
    ctx.lineTo(this.width * 0.5, this.height * 0.4);
    ctx.lineTo(0, this.height * 0.16);
    ctx.lineTo(-this.width * 0.5, this.height * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#d6f8ff";
    ctx.beginPath();
    ctx.moveTo(0, -this.height * 0.48);
    ctx.lineTo(this.width * 0.18, -4);
    ctx.lineTo(0, 6);
    ctx.lineTo(-this.width * 0.18, -4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#17386d";
    ctx.fillRect(-6, -4, 12, 18);
    ctx.fillStyle = "#6ef2ff";
    ctx.fillRect(-this.width * 0.35, this.height * 0.25, 8, 6);
    ctx.fillRect(this.width * 0.35 - 8, this.height * 0.25, 8, 6);

    if (this.shieldTimer > 0) {
      ctx.strokeStyle = "rgba(255, 215, 108, 0.95)";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#ffd76c";
      ctx.beginPath();
      ctx.arc(0, 0, 32 + Math.sin(performance.now() * 0.01) * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Enemy {
  constructor(type, x, y, wave) {
    const config = Enemy.getConfig(type, wave);
    this.type = type;
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.width = config.width;
    this.height = config.height;
    this.maxHealth = config.health;
    this.health = config.health;
    this.speed = config.speed;
    this.score = config.score;
    this.damage = config.damage;
    this.pattern = config.pattern;
    this.canShoot = config.canShoot;
    this.shotSpeed = config.shotSpeed;
    this.shotDamage = config.shotDamage;
    this.shootTimer = rand(config.fireIntervalMin, config.fireIntervalMax);
    this.oscillation = rand(0, Math.PI * 2);
    this.amplitude = config.amplitude;
    this.alive = true;
    this.age = 0;
  }

  static getConfig(type, wave) {
    const speedBoost = wave * 6;

    if (type === "fast") {
      return {
        width: 20,
        height: 24,
        health: 1,
        speed: 170 + speedBoost,
        score: SCORE_VALUES.fast,
        damage: 14,
        pattern: "zigzag",
        canShoot: false,
        shotSpeed: 0,
        shotDamage: 0,
        fireIntervalMin: 99,
        fireIntervalMax: 99,
        amplitude: 32
      };
    }

    if (type === "heavy") {
      return {
        width: 36,
        height: 42,
        health: 4,
        speed: 82 + wave * 4,
        score: SCORE_VALUES.heavy,
        damage: 28,
        pattern: "down",
        canShoot: true,
        shotSpeed: 250 + wave * 3,
        shotDamage: 14,
        fireIntervalMin: 1.8,
        fireIntervalMax: 3.3,
        amplitude: 0
      };
    }

    return {
      width: 24,
      height: 28,
      health: 1,
      speed: 104 + speedBoost,
      score: SCORE_VALUES.basic,
      damage: 18,
      pattern: "down",
      canShoot: wave >= 7 && chance(0.12 + Math.min(0.18, wave * 0.01)),
      shotSpeed: 230 + wave * 3,
      shotDamage: 9,
      fireIntervalMin: 2.4,
      fireIntervalMax: 4.2,
      amplitude: 0
    };
  }

  update(dt, game) {
    this.age += dt;
    this.y += this.speed * dt;

    if (this.pattern === "zigzag") {
      this.x = this.baseX + Math.sin(this.age * 5 + this.oscillation) * this.amplitude;
    }

    if (this.canShoot && this.y > 18 && this.y < CONFIG.height * 0.72) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.type === "heavy" ? rand(1.7, 2.8) : rand(2.5, 4.6);
        this.shoot(game);
      }
    }

    if (this.y > CONFIG.height + this.height + 20) {
      this.alive = false;
    }
  }

  shoot(game) {
    game.enemyBullets.push(
      new Bullet({
        x: this.x,
        y: this.y + this.height * 0.48,
        vx: 0,
        vy: this.shotSpeed,
        radius: this.type === "heavy" ? 5 : 4,
        from: "enemy",
        damage: this.shotDamage,
        color: this.type === "heavy" ? "#ffb36a" : "#ff7c69"
      })
    );
    game.audio.boss();
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  getBounds() {
    return {
      x: this.x - this.width * 0.5,
      y: this.y - this.height * 0.5,
      w: this.width,
      h: this.height
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === "fast") {
      ctx.fillStyle = "#ff9070";
      ctx.beginPath();
      ctx.moveTo(0, -this.height * 0.5);
      ctx.lineTo(this.width * 0.45, 0);
      ctx.lineTo(0, this.height * 0.5);
      ctx.lineTo(-this.width * 0.45, 0);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === "heavy") {
      ctx.fillStyle = "#c86a54";
      ctx.fillRect(-this.width * 0.5, -this.height * 0.5, this.width, this.height);
      ctx.fillStyle = "#ffd690";
      ctx.fillRect(-6, -this.height * 0.12, 12, 18);
      ctx.fillStyle = "#6b1f18";
      ctx.fillRect(-this.width * 0.3, this.height * 0.18, this.width * 0.6, 7);
    } else {
      ctx.fillStyle = "#ff6b7a";
      ctx.beginPath();
      ctx.moveTo(0, -this.height * 0.5);
      ctx.lineTo(this.width * 0.5, this.height * 0.2);
      ctx.lineTo(0, this.height * 0.5);
      ctx.lineTo(-this.width * 0.5, this.height * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    if (this.maxHealth > 1) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(-this.width * 0.5, -this.height * 0.75, this.width, 4);
      ctx.fillStyle = "#ffcc7a";
      ctx.fillRect(
        -this.width * 0.5,
        -this.height * 0.75,
        this.width * (this.health / this.maxHealth),
        4
      );
    }

    ctx.restore();
  }
}

class Boss {
  constructor(wave) {
    this.wave = wave;
    this.width = 164;
    this.height = 84;
    this.x = CONFIG.width / 2;
    this.y = -90;
    this.targetY = 88;
    this.speedX = 140;
    this.entering = true;
    this.maxHealth = 120 + Math.max(0, Math.floor(wave / CONFIG.bossEvery) - 1) * 25;
    this.health = this.maxHealth;
    this.fireTimer = 1.2;
    this.alive = true;
  }

  update(dt, game) {
    if (this.entering) {
      this.y += 84 * dt;
      if (this.y >= this.targetY) {
        this.y = this.targetY;
        this.entering = false;
      }
      return;
    }

    this.x += this.speedX * dt;
    if (this.x < this.width * 0.5 + 28 || this.x > CONFIG.width - this.width * 0.5 - 28) {
      this.speedX *= -1;
      this.x = clamp(this.x, this.width * 0.5 + 28, CONFIG.width - this.width * 0.5 - 28);
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 1.2;
      this.fire(game);
    }
  }

  fire(game) {
    const ports = [-48, 0, 48];
    const spread = [-0.32, -0.16, 0, 0.16, 0.32];
    const portMap = [0, 1, 1, 1, 2];
    const speed = 300 + this.wave * 2;

    spread.forEach((angle, index) => {
      const vx = Math.sin(angle) * speed;
      const vy = Math.cos(angle) * speed;
      const portX = ports[portMap[index]];

      game.enemyBullets.push(
        new Bullet({
          x: this.x + portX,
          y: this.y + this.height * 0.42,
          vx,
          vy,
          radius: 5,
          from: "enemy",
          damage: 12,
          color: "#ff9878"
        })
      );
    });

    game.audio.boss();
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  getBounds() {
    return {
      x: this.x - this.width * 0.5,
      y: this.y - this.height * 0.5,
      w: this.width,
      h: this.height
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.fillStyle = "#7a2030";
    ctx.beginPath();
    ctx.moveTo(-this.width * 0.5, -12);
    ctx.lineTo(-this.width * 0.22, -this.height * 0.5);
    ctx.lineTo(this.width * 0.22, -this.height * 0.5);
    ctx.lineTo(this.width * 0.5, -12);
    ctx.lineTo(this.width * 0.42, this.height * 0.42);
    ctx.lineTo(-this.width * 0.42, this.height * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ca6874";
    ctx.fillRect(-this.width * 0.34, -14, this.width * 0.68, 30);
    ctx.fillStyle = "#ffe0ad";
    ctx.fillRect(-12, -10, 24, 20);

    [-48, 0, 48].forEach((offset) => {
      ctx.fillStyle = "#ff9c7a";
      ctx.beginPath();
      ctx.arc(offset, this.height * 0.3, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.healthFill = document.getElementById("healthFill");
    this.healthText = document.getElementById("healthText");
    this.livesValue = document.getElementById("livesValue");
    this.scoreValue = document.getElementById("scoreValue");
    this.waveValue = document.getElementById("waveValue");
    this.bonusList = document.getElementById("bonusList");
    this.highscoreList = document.getElementById("highscoreList");

    this.audio = new AudioManager();
    this.keys = {};
    this.stars = [];
    this.player = new Player(this);
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerUps = [];
    this.particles = [];
    this.boss = null;
    this.highscores = this.loadHighScores();
    this.state = GameState.START;
    this.wave = 1;
    this.score = 0;
    this.overlayText = "";
    this.transitionTimer = 0;
    this.waveMode = "normal";
    this.enemyQuota = 0;
    this.enemySpawned = 0;
    this.enemySpawnTimer = 0;
    this.baseSpawnInterval = 0.9;
    this.shakeAmount = 0;
    this.shakeTimer = 0;
    this.lastTime = 0;
    this.scoreSaved = false;

    this.buildStars();
    this.bindEvents();
    this.renderHighScores();
    this.updateHud();
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  buildStars() {
    for (let index = 0; index < 75; index += 1) {
      this.stars.push(new Star(CONFIG.width, CONFIG.height, 1));
    }
    for (let index = 0; index < 35; index += 1) {
      this.stars.push(new Star(CONFIG.width, CONFIG.height, 2));
    }
  }

  bindEvents() {
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }

      this.audio.unlock();
      this.keys[event.code] = true;

      if (event.code === "KeyP" && !event.repeat) {
        this.togglePause();
        return;
      }

      if (event.code === "KeyR" && !event.repeat && this.state === GameState.GAME_OVER) {
        this.startRun();
        return;
      }

      if (
        this.state === GameState.START &&
        !event.repeat &&
        (event.code === "Enter" || event.code === "Space")
      ) {
        this.startRun();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys[event.code] = false;
    });

    window.addEventListener("blur", () => {
      if (this.state === GameState.PLAYING) {
        this.state = GameState.PAUSED;
      }
    });

    this.canvas.addEventListener("mousedown", () => {
      this.audio.unlock();
      if (this.state === GameState.START) {
        this.startRun();
      }
    });
  }

  startRun() {
    this.wave = 1;
    this.score = 0;
    this.scoreSaved = false;
    this.state = GameState.WAVE_TRANSITION;
    this.transitionTimer = 1.2;
    this.overlayText = "Волна 1";
    this.shakeAmount = 0;
    this.shakeTimer = 0;
    this.player.resetForNewRun();
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerUps = [];
    this.particles = [];
    this.boss = null;
    this.updateHud();
  }

  togglePause() {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
    }
  }

  loop(timestamp) {
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.033) : 0;
    this.lastTime = timestamp;
    this.update(dt);
    this.render();
    requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
  }

  update(dt) {
    this.stars.forEach((star) => star.update(dt));
    this.particles.forEach((particle) => particle.update(dt));
    this.particles = this.particles.filter((particle) => particle.alive);

    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.shakeTimer <= 0) {
      this.shakeAmount = 0;
    }

    if (this.state === GameState.START || this.state === GameState.GAME_OVER || this.state === GameState.PAUSED) {
      this.updateHud();
      return;
    }

    if (this.state === GameState.WAVE_TRANSITION) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.beginWave();
        this.state = GameState.PLAYING;
      }
      this.updateHud();
      return;
    }

    this.player.update(dt);

    // Основной игровой апдейт: спавн, движение сущностей, коллизии и переходы между волнами.
    if (this.waveMode === "normal") {
      this.updateEnemySpawns(dt);
    } else if (this.boss) {
      this.boss.update(dt, this);
    }

    this.enemies.forEach((enemy) => enemy.update(dt, this));
    this.playerBullets.forEach((bullet) => bullet.update(dt));
    this.enemyBullets.forEach((bullet) => bullet.update(dt));
    this.powerUps.forEach((powerUp) => powerUp.update(dt));

    this.handleCollisions();
    this.cleanupEntities();
    this.checkWaveProgress();
    this.updateHud();
  }

  beginWave() {
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;

    if (this.wave % CONFIG.bossEvery === 0) {
      this.waveMode = "boss";
      this.boss = new Boss(this.wave);
      this.overlayText = `Босс ${this.wave / CONFIG.bossEvery}`;
    } else {
      this.waveMode = "normal";
      this.enemyQuota = 8 + this.wave * 2;
      this.enemySpawned = 0;
      this.baseSpawnInterval = Math.max(0.38, 1.05 - this.wave * 0.045);
      this.enemySpawnTimer = 0.25;
      this.overlayText = `Волна ${this.wave}`;
    }
  }

  updateEnemySpawns(dt) {
    if (this.enemySpawned >= this.enemyQuota) {
      return;
    }

    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer > 0) {
      return;
    }

    const burstCount = Math.min(
      this.enemyQuota - this.enemySpawned,
      chance(Math.min(0.55, 0.2 + this.wave * 0.03)) ? 2 : 1
    );

    for (let index = 0; index < burstCount; index += 1) {
      this.spawnEnemy();
    }

    this.enemySpawnTimer = this.baseSpawnInterval * rand(0.75, 1.15);
  }

  spawnEnemy() {
    const type = this.chooseEnemyType();
    const margin = type === "heavy" ? 40 : 24;
    const x = rand(margin, CONFIG.width - margin);
    const y = rand(-90, -32);

    this.enemies.push(new Enemy(type, x, y, this.wave));
    this.enemySpawned += 1;
  }

  chooseEnemyType() {
    const roll = Math.random();

    if (this.wave < 2) {
      return "basic";
    }

    if (this.wave < 3) {
      return roll < 0.72 ? "basic" : "fast";
    }

    if (this.wave < 5) {
      if (roll < 0.45) return "basic";
      if (roll < 0.78) return "fast";
      return "heavy";
    }

    if (roll < 0.28) return "basic";
    if (roll < 0.7) return "fast";
    return "heavy";
  }

  handleCollisions() {
    const playerBounds = this.player.getBounds();

    for (const bullet of this.playerBullets) {
      if (!bullet.alive) {
        continue;
      }

      for (const enemy of this.enemies) {
        if (!enemy.alive) {
          continue;
        }

        if (circleRectCollision(bullet.getCircle(), enemy.getBounds())) {
          bullet.alive = false;
          this.createImpact(bullet.x, bullet.y, "#ffbf8f", enemy.type === "heavy" ? 8 : 5);

          if (enemy.takeDamage(bullet.damage)) {
            this.destroyEnemy(enemy, true);
          }
          break;
        }
      }

      if (bullet.alive && this.boss && circleRectCollision(bullet.getCircle(), this.boss.getBounds())) {
        bullet.alive = false;
        this.score += SCORE_VALUES.bossHit;
        this.createImpact(bullet.x, bullet.y, "#ffd6a2", 7);
        this.addShake(4, 0.1);

        if (this.boss.takeDamage(bullet.damage)) {
          this.destroyBoss();
        }
      }
    }

    for (const bullet of this.enemyBullets) {
      if (!bullet.alive) {
        continue;
      }

      if (circleRectCollision(bullet.getCircle(), playerBounds)) {
        bullet.alive = false;
        this.player.takeDamage(bullet.damage);
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (rectsOverlap(enemy.getBounds(), playerBounds)) {
        enemy.alive = false;
        this.createExplosion(enemy.x, enemy.y, "#ff9b77", enemy.type === "heavy" ? 14 : 8, enemy.type === "heavy");
        this.player.takeDamage(enemy.damage);
      }
    }

    for (const powerUp of this.powerUps) {
      if (!powerUp.alive) {
        continue;
      }

      if (rectsOverlap(powerUp.getBounds(), playerBounds)) {
        powerUp.alive = false;
        this.score += SCORE_VALUES.powerUp;
        this.player.applyPowerUp(powerUp.type);
        this.audio.powerup();
        this.createRingEffect(powerUp.x, powerUp.y, POWER_UP_META[powerUp.type].color, 16);
      }
    }
  }

  destroyEnemy(enemy, byPlayer) {
    enemy.alive = false;

    if (byPlayer) {
      this.score += enemy.score;
      this.maybeDropPowerUp(enemy.type, enemy.x, enemy.y);
    }

    this.createExplosion(
      enemy.x,
      enemy.y,
      enemy.type === "heavy" ? "#ffbb80" : "#ff7c69",
      enemy.type === "heavy" ? 14 : 8,
      enemy.type === "heavy"
    );

    if (enemy.type === "heavy") {
      this.addShake(10, 0.18);
    }

    this.audio.explode(enemy.type === "heavy");
  }

  destroyBoss() {
    if (!this.boss) {
      return;
    }

    this.score += SCORE_VALUES.bossKill;
    this.createExplosion(this.boss.x, this.boss.y, "#ffd89a", 28, true);
    this.addShake(14, 0.32);
    this.audio.explode(true);
    this.dropGuaranteedPowerUp(this.boss.x, this.boss.y);
    this.boss = null;
    this.enemyBullets = [];
  }

  maybeDropPowerUp(type, x, y) {
    const dropRate = type === "heavy" ? 0.25 : 0.12;
    if (!chance(dropRate)) {
      return;
    }

    const types = ["heal", "doubleShot", "shield"];
    const selected = types[Math.floor(Math.random() * types.length)];
    this.powerUps.push(new PowerUp(selected, x, y));
  }

  dropGuaranteedPowerUp(x, y) {
    const types = ["heal", "doubleShot", "shield"];
    const selected = types[Math.floor(Math.random() * types.length)];
    this.powerUps.push(new PowerUp(selected, x, y));
  }

  cleanupEntities() {
    this.enemies = this.enemies.filter((enemy) => enemy.alive);
    this.playerBullets = this.playerBullets.filter((bullet) => bullet.alive);
    this.enemyBullets = this.enemyBullets.filter((bullet) => bullet.alive);
    this.powerUps = this.powerUps.filter((powerUp) => powerUp.alive);
  }

  checkWaveProgress() {
    if (this.waveMode === "boss") {
      if (!this.boss && this.enemyBullets.length === 0) {
        this.wave += 1;
        this.state = GameState.WAVE_TRANSITION;
        this.transitionTimer = CONFIG.waveTransitionDuration;
        this.overlayText = `Босс повержен. Волна ${this.wave}`;
      }
      return;
    }

    if (this.enemySpawned >= this.enemyQuota && this.enemies.length === 0 && this.enemyBullets.length === 0) {
      this.wave += 1;
      this.state = GameState.WAVE_TRANSITION;
      this.transitionTimer = CONFIG.waveTransitionDuration;
      this.overlayText = this.wave % CONFIG.bossEvery === 0 ? `Боссовая волна ${this.wave}` : `Волна ${this.wave}`;
    }
  }

  handleGameOver() {
    this.state = GameState.GAME_OVER;

    if (!this.scoreSaved) {
      this.saveHighScore({
        score: this.score,
        wave: this.wave,
        date: new Date().toISOString()
      });
      this.scoreSaved = true;
    }
  }

  addShake(amount, duration) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  createImpact(x, y, color, count = 6) {
    for (let index = 0; index < count; index += 1) {
      this.particles.push(
        new Particle(x, y, {
          vx: rand(-180, 180),
          vy: rand(-180, 180),
          life: rand(0.18, 0.34),
          size: rand(1.5, 3.6),
          color
        })
      );
    }

    this.particles.push(
      new Particle(x, y, {
        life: 0.16,
        size: 8,
        growth: 110,
        color,
        type: "ring"
      })
    );
  }

  createExplosion(x, y, color, count = 12, strong = false) {
    for (let index = 0; index < count; index += 1) {
      this.particles.push(
        new Particle(x, y, {
          vx: rand(-220, 220),
          vy: rand(-220, 220),
          life: rand(0.3, 0.65),
          size: rand(2, strong ? 5.5 : 4),
          color
        })
      );
    }

    this.particles.push(
      new Particle(x, y, {
        life: strong ? 0.28 : 0.18,
        size: strong ? 18 : 12,
        growth: strong ? 160 : 120,
        color,
        type: "ring"
      })
    );
  }

  createRingEffect(x, y, color, size) {
    this.particles.push(
      new Particle(x, y, {
        life: 0.24,
        size,
        growth: 110,
        color,
        type: "ring"
      })
    );
  }

  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = "#040814";
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
    gradient.addColorStop(0, "rgba(16, 28, 64, 0.85)");
    gradient.addColorStop(0.55, "rgba(5, 9, 24, 0.9)");
    gradient.addColorStop(1, "rgba(3, 5, 13, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    this.stars.forEach((star) => star.draw(ctx));

    ctx.fillStyle = "rgba(110, 242, 255, 0.06)";
    for (let index = 0; index < 5; index += 1) {
      const y = (performance.now() * 0.02 + index * 140) % (CONFIG.height + 160) - 80;
      ctx.fillRect(0, y, CONFIG.width, 1);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

    ctx.save();
    if (this.shakeTimer > 0 && this.shakeAmount > 0) {
      ctx.translate(rand(-this.shakeAmount, this.shakeAmount), rand(-this.shakeAmount, this.shakeAmount));
    }

    this.drawBackground();
    this.powerUps.forEach((powerUp) => powerUp.draw(ctx));
    this.playerBullets.forEach((bullet) => bullet.draw(ctx));
    this.enemyBullets.forEach((bullet) => bullet.draw(ctx));
    this.enemies.forEach((enemy) => enemy.draw(ctx));

    if (this.boss) {
      this.boss.draw(ctx);
      this.drawBossBar();
    }

    this.player.draw(ctx);
    this.particles.forEach((particle) => particle.draw(ctx));
    ctx.restore();

    this.drawOverlay();
  }

  drawBossBar() {
    if (!this.boss) {
      return;
    }

    const ctx = this.ctx;
    const width = 340;
    const x = (CONFIG.width - width) / 2;
    const y = 18;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(x, y, width, 14);
    ctx.fillStyle = "#ff8a75";
    ctx.fillRect(x, y, width * (this.boss.health / this.boss.maxHealth), 14);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.strokeRect(x, y, width, 14);
    ctx.fillStyle = "#ffd5c7";
    ctx.font = "12px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(`Босс: ${this.boss.health} / ${this.boss.maxHealth}`, CONFIG.width / 2, y - 4);
    ctx.restore();
  }

  drawOverlay() {
    if (this.state === GameState.START) {
      this.drawCenteredPanel(
        "STARFALL AEGIS",
        [
          "Отбивайтесь от волн врагов, переживайте боссов и собирайте усиления.",
          "Enter / Space / клик мышью — старт",
          "P — пауза, R — рестарт после поражения"
        ],
        "rgba(3, 10, 28, 0.78)"
      );
      return;
    }

    if (this.state === GameState.PAUSED) {
      this.drawCenteredPanel("Пауза", ["Нажмите P, чтобы продолжить."], "rgba(4, 9, 22, 0.64)");
      return;
    }

    if (this.state === GameState.GAME_OVER) {
      this.drawCenteredPanel(
        "GAME OVER",
        [
          `Итоговый счёт: ${this.score}`,
          `Достигнутая волна: ${this.wave}`,
          "Нажмите R, чтобы начать заново"
        ],
        "rgba(20, 5, 12, 0.72)"
      );
      return;
    }

    if (this.state === GameState.WAVE_TRANSITION) {
      this.drawCenteredPanel(this.overlayText, ["Приготовьтесь к следующему бою"], "rgba(4, 10, 24, 0.45)", true);
    }
  }

  drawCenteredPanel(title, lines, backdrop, compact = false) {
    const ctx = this.ctx;
    const panelWidth = compact ? 420 : 560;
    const panelHeight = compact ? 126 : 210;
    const x = (CONFIG.width - panelWidth) / 2;
    const y = (CONFIG.height - panelHeight) / 2;

    ctx.save();
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = "rgba(7, 16, 38, 0.9)";
    ctx.strokeStyle = "rgba(110, 242, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, panelWidth, panelHeight);
    ctx.strokeRect(x, y, panelWidth, panelHeight);

    ctx.textAlign = "center";
    ctx.fillStyle = "#eaf7ff";
    ctx.font = compact ? "700 30px Segoe UI" : "700 38px Segoe UI";
    ctx.fillText(title, CONFIG.width / 2, y + 54);

    ctx.font = "18px Segoe UI";
    ctx.fillStyle = "#9ec3df";
    lines.forEach((line, index) => {
      ctx.fillText(line, CONFIG.width / 2, y + 96 + index * 30);
    });
    ctx.restore();
  }

  updateHud() {
    const healthRatio = this.player.health / this.player.maxHealth;
    this.healthFill.style.width = `${clamp(healthRatio * 100, 0, 100)}%`;
    this.healthFill.style.background =
      healthRatio > 0.55
        ? "linear-gradient(90deg, #38dfa6, #7cf9e5 65%, #d0fff8)"
        : healthRatio > 0.25
          ? "linear-gradient(90deg, #f0c55b, #ffd76c)"
          : "linear-gradient(90deg, #ff6b7a, #ff9b88)";

    this.healthText.textContent = `${Math.ceil(this.player.health)} / ${this.player.maxHealth}`;
    this.livesValue.textContent = `${this.player.lives}`;
    this.scoreValue.textContent = `${this.score}`;
    this.waveValue.textContent = `${this.wave}`;

    const bonuses = this.player.getActiveBonuses();
    if (bonuses.length === 0) {
      this.bonusList.textContent = "Нет активных бонусов";
      return;
    }

    this.bonusList.innerHTML = bonuses
      .map((bonus) => {
        const meta = POWER_UP_META[bonus.type];
        return `<span class="bonus-pill" style="border-color:${meta.color}55;color:${meta.color}">${meta.label} ${bonus.time.toFixed(1)}с</span>`;
      })
      .join("");
  }

  loadHighScores() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  saveHighScore(entry) {
    const next = [...this.highscores, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    this.highscores = next;

    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(next));
    } catch (error) {
      // LocalStorage не обязателен для работы игры, поэтому молча продолжаем.
    }

    this.renderHighScores();
  }

  renderHighScores() {
    this.highscoreList.innerHTML = "";

    if (this.highscores.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Пока нет сохранённых результатов.";
      this.highscoreList.appendChild(item);
      return;
    }

    this.highscores.forEach((entry, index) => {
      const item = document.createElement("li");
      const formattedDate = new Date(entry.date).toLocaleDateString("ru-RU");
      item.innerHTML = `<strong>#${index + 1} — ${entry.score}</strong><br>Волна ${entry.wave} • ${formattedDate}`;
      this.highscoreList.appendChild(item);
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new Game();
});
