import React, { useEffect, useRef, useState } from 'react';
import { PlayerStats, ActiveWeaponState, Upgrade } from '../types';
import { playSound } from '../audio';

interface GameCanvasProps {
  playerStats: PlayerStats;
  activeWeapons: ActiveWeaponState[];
  isPaused: boolean;
  onUpdateStats: (update: Partial<PlayerStats>) => void;
  onEnemyKilled: (scoreAdd: number) => void;
  onLevelUp: () => void;
  onGameOver: (finalScore: number, finalKills: number, finalLevel: number) => void;
  controlType: 'hybrid' | 'mouse-follow';
}

export default function GameCanvas({
  playerStats,
  activeWeapons,
  isPaused,
  onUpdateStats,
  onEnemyKilled,
  onLevelUp,
  onGameOver,
  controlType,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Core physics references to run the loop independently from React rendering overhead
  const stateRef = useRef({
    // Game dimension size constraints
    arenaSize: 2000,
    width: 800,
    height: 600,
    
    // Camera translations
    camX: 0,
    camY: 0,

    // Player position, velocity and orientation
    px: 1000,
    py: 1000,
    pSpeed: 230,
    pAngle: 0,
    invulnTime: 0,

    // Input States
    keys: {} as Record<string, boolean>,
    pointerX: 1000, // global world space target
    pointerY: 1000,
    pointerScreenX: 0, // screen space target
    pointerScreenY: 0,
    isPointerDown: false,
    usingKeyboard: false,

    // Timing
    lastFrameTime: 0,
    gameTime: 0, // total run duration in seconds
    lastEnemySpawn: 0,
    lastRegenTick: 0,

    // Active weapon firing timers
    laserTimer: 0,
    rocketTimer: 0,
    teslaTimer: 0,
    droneTimer: 0,
    pulseTimer: 0,

    // Screen feedbacks
    screenshake: 0,
    damageFlash: 0,

    // Dynamic Lists
    enemies: [] as Array<{
      id: string;
      x: number;
      y: number;
      hp: number;
      maxHp: number;
      type: 'scout' | 'stalker' | 'asteroid' | 'heavy' | 'boss';
      speed: number;
      radius: number;
      color: string;
      scoreValue: number;
      damage: number;
      shootCooldown?: number;
      shield?: number;
    }>,

    bullets: [] as Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      damage: number;
      isCrit: boolean;
      radius: number;
      color: string;
      owner: 'player' | 'enemy' | 'drone';
      life: number; // seconds
    }>,

    rockets: [] as Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      angle: number;
      speed: number;
      damage: number;
      radius: number;
      fuel: number; // life in seconds
    }>,

    gems: [] as Array<{
      x: number;
      y: number;
      xp: number;
      color: string;
      size: number;
      magnetized: boolean;
    }>,

    particles: [] as Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      radius: number;
      alpha: number;
      life: number;
    }>,

    floatingTexts: [] as Array<{
      x: number;
      y: number;
      text: string;
      color: string;
      size: number;
      vx: number;
      vy: number;
      life: number;
    }>,

    orbitalAngle: 0, // angular progression for orbital plasmas
    droneAngle: 0,

    activeBossId: null as string | null,
  });

  // Track latest reactive states securely without binding them directly as React triggers
  const statsTrackerRef = useRef(playerStats);
  const weaponsTrackerRef = useRef(activeWeapons);
  const pausedTrackerRef = useRef(isPaused);

  useEffect(() => {
    statsTrackerRef.current = playerStats;
  }, [playerStats]);

  useEffect(() => {
    weaponsTrackerRef.current = activeWeapons;
  }, [activeWeapons]);

  useEffect(() => {
    pausedTrackerRef.current = isPaused;
  }, [isPaused]);

  // Handle Resize of the Canvas Wrap
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          stateRef.current.width = width;
          stateRef.current.height = height;
        }
      }
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Set up Keyboard listeners and pointer trackers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      stateRef.current.usingKeyboard = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      stateRef.current.pointerScreenX = e.clientX - rect.left;
      stateRef.current.pointerScreenY = e.clientY - rect.top;
    };

    const handlePointerDown = (e: PointerEvent) => {
      stateRef.current.isPointerDown = true;
    };

    const handlePointerUp = () => {
      stateRef.current.isPointerDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Game Engine main run loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isTerminated = false;

    // Reset initial positions upon starting playing
    const s = stateRef.current;
    s.px = s.arenaSize / 2;
    s.py = s.arenaSize / 2;
    s.enemies = [];
    s.bullets = [];
    s.rockets = [];
    s.gems = [];
    s.particles = [];
    s.floatingTexts = [];
    s.lastFrameTime = performance.now();
    s.gameTime = 0;
    s.lastEnemySpawn = 0;
    s.lastRegenTick = 0;

    // Pre-populate some background decoration asteroids in space
    for (let i = 0; i < 15; i++) {
      s.enemies.push({
        id: `start-asteroid-${i}`,
        x: Math.random() * s.arenaSize,
        y: Math.random() * s.arenaSize,
        hp: 30,
        maxHp: 30,
        type: 'asteroid',
        speed: 15 + Math.random() * 30,
        radius: 20 + Math.random() * 15,
        color: '#64748b',
        scoreValue: 15,
        damage: 15,
      });
    }

    const spawnEnemy = (type: 'scout' | 'stalker' | 'asteroid' | 'heavy' | 'boss') => {
      // Spawn at a random angle outside viewer viewport
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.max(s.width, s.height) / 2 + 100;
      const x = Math.max(20, Math.min(s.arenaSize - 20, s.px + Math.cos(angle) * spawnRadius));
      const y = Math.max(20, Math.min(s.arenaSize - 20, s.py + Math.sin(angle) * spawnRadius));

      const timeScaler = 1 + s.gameTime / 180; // scale difficulty over time (every 3 minutes doubles stats)

      switch (type) {
        case 'scout':
          s.enemies.push({
            id: `scout-${performance.now()}-${Math.random()}`,
            x,
            y,
            hp: Math.ceil(15 * timeScaler),
            maxHp: Math.ceil(15 * timeScaler),
            type: 'scout',
            speed: 150,
            radius: 12,
            color: '#fbbf24', // bright amber
            scoreValue: 10,
            damage: 8,
          });
          break;
        case 'stalker':
          s.enemies.push({
            id: `stalker-${performance.now()}-${Math.random()}`,
            x,
            y,
            hp: Math.ceil(30 * timeScaler),
            maxHp: Math.ceil(30 * timeScaler),
            type: 'stalker',
            speed: 100,
            radius: 16,
            color: '#f97316', // neon orange
            scoreValue: 20,
            damage: 14,
          });
          break;
        case 'asteroid':
          s.enemies.push({
            id: `asteroid-${performance.now()}-${Math.random()}`,
            x,
            y,
            hp: Math.ceil(40 * timeScaler),
            maxHp: Math.ceil(40 * timeScaler),
            type: 'asteroid',
            speed: 40 + Math.random() * 30,
            radius: 25,
            color: '#94a3b8', // metallic slate
            scoreValue: 15,
            damage: 18,
          });
          break;
        case 'heavy':
          s.enemies.push({
            id: `heavy-${performance.now()}-${Math.random()}`,
            x,
            y,
            hp: Math.ceil(120 * timeScaler),
            maxHp: Math.ceil(120 * timeScaler),
            type: 'heavy',
            speed: 60,
            radius: 24,
            color: '#ec4899', // bright pink
            scoreValue: 50,
            damage: 25,
            shootCooldown: 2,
          });
          break;
        case 'boss':
          s.enemies.push({
            id: `boss-${performance.now()}-${Math.random()}`,
            x,
            y,
            hp: Math.ceil(500 * timeScaler),
            maxHp: Math.ceil(500 * timeScaler),
            type: 'boss',
            speed: 70,
            radius: 40,
            color: '#a855f7', // cosmic purple glow
            scoreValue: 500,
            damage: 40,
            shootCooldown: 1.5,
          });
          s.activeBossId = s.enemies[s.enemies.length - 1].id;
          playSound('levelup'); // alert boss arrival
          break;
      }
    };

    const addExplosionParticles = (x: number, y: number, color: string, count = 12) => {
      for (let i = 0; i < count; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = 30 + Math.random() * 120;
        s.particles.push({
          x,
          y,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          color,
          radius: 1.5 + Math.random() * 3,
          alpha: 1.0,
          life: 0.3 + Math.random() * 0.4,
        });
      }
    };

    const showFloatingText = (x: number, y: number, text: string, color = '#ffffff', size = 18) => {
      s.floatingTexts.push({
        x,
        y,
        text,
        color,
        size,
        vx: (Math.random() - 0.5) * 40,
        vy: -50 - Math.random() * 30,
        life: 0.8,
      });
    };

    // Main running physics frame
    const loop = (timestamp: number) => {
      if (isTerminated) return;
      animId = requestAnimationFrame(loop);

      const dt = Math.min(0.05, (timestamp - s.lastFrameTime) / 1000); // capped at ~20FPS min reference to avoid giant teleports
      s.lastFrameTime = timestamp;

      const stats = statsTrackerRef.current;
      const weapons = weaponsTrackerRef.current;
      const isPausedState = pausedTrackerRef.current;

      if (isPausedState) {
        // Just render paused message screen, still updating timestamps nicely
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fillRect(0, 0, s.width, s.height);
        return;
      }

      s.gameTime += dt;
      s.orbitalAngle += 2.2 * dt;
      s.droneAngle += 1.8 * dt;

      // --- 1. HANDLE PLAYER INPUT & LOCOMOTION ---
      let moveDirX = 0;
      let moveDirY = 0;

      if (controlType === 'mouse-follow' || (!s.usingKeyboard && s.isPointerDown)) {
        // Smooth guidance towards pointer coordinate
        const targetWorldX = s.pointerScreenX + s.camX;
        const targetWorldY = s.pointerScreenY + s.camY;
        const distToTarget = Math.hypot(targetWorldX - s.px, targetWorldY - s.py);
        if (distToTarget > 10) {
          moveDirX = (targetWorldX - s.px) / distToTarget;
          moveDirY = (targetWorldY - s.py) / distToTarget;
          // Slowly face direction of movement
          s.pAngle = Math.atan2(moveDirY, moveDirX);
        }
      } else {
        // Standard WASD steering
        if (s.keys['w'] || s.keys['arrowup']) moveDirY -= 1;
        if (s.keys['s'] || s.keys['arrowdown']) moveDirY += 1;
        if (s.keys['a'] || s.keys['arrowleft']) moveDirX -= 1;
        if (s.keys['d'] || s.keys['arrowright']) moveDirX += 1;

        if (moveDirX !== 0 || moveDirY !== 0) {
          // Normalize vector
          const len = Math.hypot(moveDirX, moveDirY);
          moveDirX /= len;
          moveDirY /= len;
          s.pAngle = Math.atan2(moveDirY, moveDirX);
        }
      }

      // Constrain player position to arena limits
      const effectiveSpeed = stats.speed;
      s.px = Math.max(30, Math.min(s.arenaSize - 30, s.px + moveDirX * effectiveSpeed * dt));
      s.py = Math.max(30, Math.min(s.arenaSize - 30, s.py + moveDirY * effectiveSpeed * dt));

      if (s.invulnTime > 0) {
        s.invulnTime -= dt;
      }

      // Shield active regen ticker (every second replenishes by stats.regenRate)
      if (s.gameTime - s.lastRegenTick >= 1.0) {
        s.lastRegenTick = s.gameTime;
        if (stats.shield < stats.maxShield) {
          const added = Math.min(stats.regenRate, stats.maxShield - stats.shield);
          if (added > 0) {
            onUpdateStats({ shield: Math.min(stats.maxShield, stats.shield + added) });
          }
        }
      }

      // Set world-coordinate target of screen cursor dynamically
      s.pointerX = s.pointerScreenX + s.camX;
      s.pointerY = s.pointerScreenY + s.camY;

      // In hybrid mode, rotate ship to aim at mouse cursor instead of movement direction
      if (controlType === 'hybrid') {
        s.pAngle = Math.atan2(s.pointerY - s.py, s.pointerX - s.px);
      }

      // --- 2. AUTOMATED WEAPON FIRING SYSTEM ---
      // We process active weapons and fire automatically when ready
      weapons.forEach((weapon) => {
        switch (weapon.id) {
          case 'laser': {
            // Main frontal laser system
            const cooldown = 0.5 / stats.fireRateMultiplier; // baseline 0.5s trigger
            s.laserTimer += dt;
            if (s.laserTimer >= cooldown) {
              s.laserTimer = 0;
              // Determine direction based on weapon level
              const numProjectiles = Math.min(6, weapon.level); // Level 1 (1 bullet), Level 2 (2 bullets), etc.
              const sprayAngle = (numProjectiles - 1) * 0.08; // spacing radians

              for (let i = 0; i < numProjectiles; i++) {
                const angleOffset = numProjectiles > 1 ? -sprayAngle / 2 + (i * (sprayAngle / (numProjectiles - 1))) : 0;
                const finalProjAngle = s.pAngle + angleOffset;
                s.bullets.push({
                  x: s.px + Math.cos(s.pAngle) * 20,
                  y: s.py + Math.sin(s.pAngle) * 20,
                  vx: Math.cos(finalProjAngle) * 450,
                  vy: Math.sin(finalProjAngle) * 450,
                  damage: 10 * stats.damageMultiplier,
                  isCrit: Math.random() < stats.critChance,
                  radius: 4,
                  color: '#22d3ee', // high glow neon cyan
                  owner: 'player',
                  life: 2.2,
                });
              }
              playSound('laser');
            }
            break;
          }

          case 'plasma_orbit': {
            // Level controls count and scale damage
            // Plasmatic sphere updates handled directly below during rendering
            break;
          }

          case 'seeker_missile': {
            // Fires lockon rocket homing nearest foe
            const cooldown = Math.max(0.4, (2.6 - weapon.level * 0.3)) / stats.fireRateMultiplier;
            s.rocketTimer += dt;
            if (s.rocketTimer >= cooldown && s.enemies.length > 0) {
              s.rocketTimer = 0;
              // Launch rocket upwards/backwards and let it steer homing
              const spawnAngle = s.pAngle + Math.PI + (Math.random() - 0.5) * 1.5;
              s.rockets.push({
                x: s.px,
                y: s.py,
                vx: Math.cos(spawnAngle) * 180,
                vy: Math.sin(spawnAngle) * 180,
                angle: spawnAngle,
                speed: 280 + weapon.level * 20,
                damage: (28 + weapon.level * 6) * stats.damageMultiplier,
                radius: 7,
                fuel: 4.5,
              });
              playSound('missile');
            }
            break;
          }

          case 'tesla_coil': {
            // Chain lightning discharges directly to the closest foe
            const cooldown = Math.max(0.6, (2.5 - weapon.level * 0.3)) / stats.fireRateMultiplier;
            s.teslaTimer += dt;
            if (s.teslaTimer >= cooldown && s.enemies.length > 0) {
              s.teslaTimer = 0;

              // Find closest enemy
              let closest: any = null;
              let minDist = 400; // max lightning radius
              s.enemies.forEach((e) => {
                const dist = Math.hypot(e.x - s.px, e.y - s.py);
                if (dist < minDist) {
                  minDist = dist;
                  closest = e;
                }
              });

              if (closest) {
                // Zap enemy
                playSound('tesla');
                const lightningDamage = (22 * weapon.level) * stats.damageMultiplier;
                const isCrit = Math.random() < stats.critChance;
                const resolvedDmg = isCrit ? lightningDamage * 2 : lightningDamage;
                
                closest.hp -= resolvedDmg;
                // Draw lightning discharge lines (we push floating visual line segments)
                s.floatingTexts.push({
                  x: (s.px + closest.x) / 2,
                  y: (s.py + closest.y) / 2 - 20,
                  text: `⚡`,
                  color: '#22d3ee',
                  size: 24,
                  vx: 0,
                  vy: -40,
                  life: 0.3,
                });
                showFloatingText(closest.x, closest.y - 12, `${Math.ceil(resolvedDmg)}`, isCrit ? '#f43f5e' : '#22d3ee', isCrit ? 22 : 16);

                // Sparks particle effects at enemy hub
                addExplosionParticles(closest.x, closest.y, '#22d3ee', 6);

                // Jump lightning chain up to N times where N is weapon level
                let currentHost = closest;
                const activeTargets = new Set<string>([closest.id]);
                const maxJumps = Math.min(5, weapon.level);

                for (let j = 0; j < maxJumps; j++) {
                  let nextTarget: any = null;
                  let nextBestDist = 200; // bounce range
                  s.enemies.forEach((otherE) => {
                    if (activeTargets.has(otherE.id)) return;
                    const bDist = Math.hypot(otherE.x - currentHost.x, otherE.y - currentHost.y);
                    if (bDist < nextBestDist) {
                      nextBestDist = bDist;
                      nextTarget = otherE;
                    }
                  });

                  if (nextTarget) {
                    activeTargets.add(nextTarget.id);
                    const bounceDamage = lightningDamage * 0.8;
                    const bounceCrit = Math.random() < stats.critChance;
                    const finalBounceDmg = bounceCrit ? bounceDamage * 2 : bounceDamage;

                    nextTarget.hp -= finalBounceDmg;
                    
                    // Create floating zap connectors visually on canvas context
                    addExplosionParticles(nextTarget.x, nextTarget.y, '#67e8f9', 4);
                    showFloatingText(nextTarget.x, nextTarget.y - 10, `${Math.ceil(finalBounceDmg)}`, '#67e8f9', bounceCrit ? 18 : 13);
                    currentHost = nextTarget;
                  } else {
                    break;
                  }
                }
              }
            }
            break;
          }

          case 'drone': {
            // Automatic support flying drone Companion tracking closest enemy in view
            const cooldown = Math.max(0.25, (0.75 - weapon.level * 0.1)) / stats.fireRateMultiplier;
            s.droneTimer += dt;
            if (s.droneTimer >= cooldown && s.enemies.length > 0) {
              s.droneTimer = 0;

              // Find closest target
              let closest: any = null;
              let minDist = 500;
              s.enemies.forEach((e) => {
                const dist = Math.hypot(e.x - s.px, e.y - s.py);
                if (dist < minDist) {
                  minDist = dist;
                  closest = e;
                }
              });

              if (closest) {
                // Spawn laser from hover drone position
                const dRad = 50;
                const dx = s.px + Math.cos(s.droneAngle) * dRad;
                const dy = s.py + Math.sin(s.droneAngle) * dRad;
                
                const droneTargetAngle = Math.atan2(closest.y - dy, closest.x - dx);
                s.bullets.push({
                  x: dx,
                  y: dy,
                  vx: Math.cos(droneTargetAngle) * 400,
                  vy: Math.sin(droneTargetAngle) * 400,
                  damage: (5 + weapon.level * 2) * stats.damageMultiplier,
                  isCrit: Math.random() < stats.critChance,
                  radius: 3.2,
                  color: '#a855f7', // purple drone blast
                  owner: 'drone',
                  life: 1.8,
                });
                playSound('plasma');
              }
            }
            break;
          }
        }
      });

      // --- 3. DYNAMIC ENEMY SPAWN CONTROLLER ---
      // Spawn scouts, stalkers, asteroids and heavy cruisers on a sliding window
      const spawnInterval = Math.max(0.5, 3.5 - Math.min(2.5, s.gameTime / 60)); // spawn progressively faster
      if (timestamp - s.lastEnemySpawn >= spawnInterval * 1000) {
        s.lastEnemySpawn = timestamp;

        // Determine what types spawn
        const rand = Math.random();
        if (s.gameTime > 180 && rand < 0.12) {
          spawnEnemy('heavy');
        } else if (s.gameTime > 60 && rand < 0.28) {
          spawnEnemy('stalker');
        } else if (rand < 0.55) {
          spawnEnemy('scout');
        } else {
          spawnEnemy('asteroid');
        }

        // Spawn Boss overlord at exact 2 minutes, 4 minutes, etc. checkpoints if none is active
        const totalMinutes = Math.floor(s.gameTime / 120);
        if (totalMinutes > 0 && !s.activeBossId && s.enemies.filter(e => e.type === 'boss').length === 0) {
          spawnEnemy('boss');
        }
      }

      // --- 4. ENGINE ENTITY PHYSICS UPDATES ---

      // Move Bullets
      s.bullets.forEach((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
      });
      s.bullets = s.bullets.filter((b) => b.life > 0);

      // Move & Guide Rockets (homing steering)
      s.rockets.forEach((r) => {
        r.fuel -= dt;
        // Search closest enemy
        let closest: any = null;
        let minDist = 600;
        s.enemies.forEach((e) => {
          const d = Math.hypot(e.x - r.x, e.y - r.y);
          if (d < minDist) {
            minDist = d;
            closest = e;
          }
        });

        if (closest) {
          // Guide tracking angle smoothly towards target
          const dx = closest.x - r.x;
          const dy = closest.y - r.y;
          const targetAngle = Math.atan2(dy, dx);
          
          const angleDiff = Math.atan2(Math.sin(targetAngle - r.angle), Math.cos(targetAngle - r.angle));
          r.angle += angleDiff * 6.5 * dt; // Steers actively
        }

        r.vx = Math.cos(r.angle) * r.speed;
        r.vy = Math.sin(r.angle) * r.speed;

        r.x += r.vx * dt;
        r.y += r.vy * dt;

        // Emit slight trail sparkles
        if (Math.random() < 0.3) {
          s.particles.push({
            x: r.x,
            y: r.y,
            vx: -r.vx * 0.3 + (Math.random() - 0.5) * 20,
            vy: -r.vy * 0.3 + (Math.random() - 0.5) * 20,
            color: '#f97316',
            radius: 1.5,
            alpha: 0.8,
            life: 0.25,
          });
        }
      });
      s.rockets = s.rockets.filter((r) => r.fuel > 0);

      // Move Enemies
      s.enemies.forEach((e) => {
        if (e.type === 'asteroid') {
          // Slide in a straight direction across arena boundaries
          e.x += e.speed * Math.cos(0.4) * dt;
          e.y += e.speed * Math.sin(0.4) * dt;

          // Wrap around playfield boundary
          if (e.x < -10) e.x = s.arenaSize + 10;
          if (e.x > s.arenaSize + 10) e.x = -10;
          if (e.y < -10) e.y = s.arenaSize + 10;
          if (e.y > s.arenaSize + 10) e.y = -10;
        } else {
          // Guide with aggressive chasing tracking toward Player
          const dx = s.px - e.x;
          const dy = s.py - e.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 5) {
            e.x += (dx / dist) * e.speed * dt;
            e.y += (dy / dist) * e.speed * dt;
          }

          // Heavy units or bosses fire bullet bursts
          if (e.shootCooldown !== undefined) {
            e.shootCooldown -= dt;
            if (e.shootCooldown <= 0) {
              const maxCool = e.type === 'boss' ? 1.5 : 2.0;
              e.shootCooldown = maxCool + Math.random() * 0.8;
              // Spawn red neon bullet heading player
              const pRad = Math.atan2(s.py - e.y, s.px - e.x);
              
              if (e.type === 'boss') {
                // Spray circle of 5 bullets
                for (let k = -2; k <= 2; k++) {
                  const bAngle = pRad + k * 0.25;
                  s.bullets.push({
                    x: e.x + Math.cos(bAngle) * e.radius,
                    y: e.y + Math.sin(bAngle) * e.radius,
                    vx: Math.cos(bAngle) * 190,
                    vy: Math.sin(bAngle) * 190,
                    damage: 18,
                    isCrit: false,
                    radius: 5.5,
                    color: '#ef4444', // heavy crimson warning bullet
                    owner: 'enemy',
                    life: 4.5,
                  });
                }
              } else {
                s.bullets.push({
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(pRad) * 200,
                  vy: Math.sin(pRad) * 200,
                  damage: 12,
                  isCrit: false,
                  radius: 4.5,
                  color: '#f43f5e',
                  owner: 'enemy',
                  life: 4.0,
                });
              }
            }
          }
        }
      });

      // Update Gems physics (magnetized suction)
      s.gems.forEach((g) => {
        const dx = s.px - g.x;
        const dy = s.py - g.y;
        const dist = Math.hypot(dx, dy);

        if (g.magnetized || dist < stats.magnetRange) {
          g.magnetized = true;
          // Magnet suction logic increases velocity as target gets nearer
          const pullVelocity = 350 + (stats.magnetRange / Math.max(1, dist)) * 50;
          g.x += (dx / dist) * pullVelocity * dt;
          g.y += (dy / dist) * pullVelocity * dt;
        }
      });

      // Update Particles
      s.particles.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.alpha = Math.max(0, p.life * 2);
      });
      s.particles = s.particles.filter((p) => p.life > 0);

      // Update Floating texts
      s.floatingTexts.forEach((ft) => {
        ft.x += ft.vx * dt;
        ft.y += ft.vy * dt;
        ft.life -= dt;
      });
      s.floatingTexts = s.floatingTexts.filter((ft) => ft.life > 0);

      // --- 5. RESOLVE COMBAT COLLISIONS & DESTRUCTION ---

      // Active Orbital Spheres checks against nearby targets dynamically
      const orbitWeapon = weapons.find(w => w.id === 'plasma_orbit');
      if (orbitWeapon) {
        const sphereCount = Math.min(6, 1 + orbitWeapon.level);
        const radiusDist = 100 + orbitWeapon.level * 10;
        const sphereDmg = (12 + orbitWeapon.level * 4) * stats.damageMultiplier * dt; // ticking continuous damage

        for (let i = 0; i < sphereCount; i++) {
          const sphereOffset = (i * Math.PI * 2) / sphereCount;
          const sx = s.px + Math.cos(s.orbitalAngle + sphereOffset) * radiusDist;
          const sy = s.py + Math.sin(s.orbitalAngle + sphereOffset) * radiusDist;

          // Check hit enemies
          s.enemies.forEach((e) => {
            const hitDist = Math.hypot(e.x - sx, e.y - sy);
            if (hitDist < e.radius + 12) {
              e.hp -= sphereDmg;
              if (Math.random() < 0.1) {
                // Light spark impact particles
                addExplosionParticles(sx, sy, '#a855f7', 2);
                showFloatingText(e.x + (Math.random() - 0.5) * 10, e.y - e.radius - 5, `${Math.ceil(sphereDmg * 15)}`, '#c084fc', 12);
              }
            }
          });
        }
      }

      // Bullets (Player & Drones) vs Enemies
      s.bullets.forEach((b) => {
        if (b.owner === 'player' || b.owner === 'drone') {
          s.enemies.forEach((e) => {
            if (b.life > 0) {
              const hitDist = Math.hypot(e.x - b.x, e.y - b.y);
              if (hitDist < e.radius + b.radius) {
                const finalDmg = b.isCrit ? b.damage * 2 : b.damage;
                e.hp -= finalDmg;
                b.life = 0; // kill bullet

                // Create nice floating crit feedback or small bounce sparks
                showFloatingText(e.x, e.y - e.radius - 4, `${Math.ceil(finalDmg)}`, b.isCrit ? '#f43f5e' : '#e2e8f0', b.isCrit ? 22 : 15);
                addExplosionParticles(b.x, b.y, b.color, b.isCrit ? 7 : 3);
              }
            }
          });
        } else if (b.owner === 'enemy') {
          // Enemy ammo hit Player check
          const hitDist = Math.hypot(s.px - b.x, s.py - b.y);
          if (hitDist < b.radius + 15) {
            b.life = 0;
            // Shield takes hit first
            if (s.invulnTime <= 0) {
              s.screenshake = 8;
              s.damageFlash = 0.35;
              s.invulnTime = 0.45; // brief flash safety immunity

              if (stats.shield > 0) {
                playSound('shield');
                const remShield = Math.max(0, stats.shield - b.damage);
                const penetratDmg = b.damage > stats.shield ? b.damage - stats.shield : 0;
                onUpdateStats({ 
                  shield: remShield, 
                  hp: Math.max(0, stats.hp - penetratDmg) 
                });
                showFloatingText(s.px, s.py - 24, `Shield -${Math.ceil(b.damage)}`, '#38bdf8', 15);
              } else {
                playSound('damage');
                onUpdateStats({ hp: Math.max(0, stats.hp - b.damage) });
                showFloatingText(s.px, s.py - 24, `HP -${Math.ceil(b.damage)}`, '#ef4444', 16);
              }
            }
          }
        }
      });

      // Seeker Rockets vs Enemies (Splash Explosion)
      s.rockets.forEach((r) => {
        s.enemies.forEach((e) => {
          if (r.fuel > 0) {
            const hitDist = Math.hypot(e.x - r.x, e.y - r.y);
            if (hitDist < e.radius + r.radius) {
              r.fuel = 0; // trigger detonation
              playSound('explosion');
              s.screenshake = 10;

              // Radius blast deals devastation splash to all in range
              const splashRadius = 110;
              s.enemies.forEach((splashE) => {
                const splashDist = Math.hypot(splashE.x - r.x, splashE.y - r.y);
                if (splashDist < splashRadius) {
                  // damage falls off slightly with distance
                  const falloff = 1 - (splashDist / splashRadius) * 0.45;
                  const isCrit = Math.random() < stats.critChance;
                  const splashDmg = r.damage * falloff * (isCrit ? 2.0 : 1.0);
                  
                  splashE.hp -= splashDmg;
                  showFloatingText(splashE.x, splashE.y - splashE.radius, `${Math.ceil(splashDmg)}`, isCrit ? '#f43f5e' : '#f97316', isCrit ? 24 : 18);
                  addExplosionParticles(splashE.x, splashE.y, '#f97316', 4);
                }
              });

              // Large ring flash particle effect
              for (let k = 0; k < 20; k++) {
                const pa = Math.random() * Math.PI * 2;
                const sp = 50 + Math.random() * 150;
                s.particles.push({
                  x: r.x,
                  y: r.y,
                  vx: Math.cos(pa) * sp,
                  vy: Math.sin(pa) * sp,
                  color: '#fa5816',
                  radius: 2 + Math.random() * 4,
                  alpha: 1.0,
                  life: 0.4 + Math.random() * 0.3,
                });
              }
            }
          }
        });
      });

      // Enemy direct touch/collide with player
      s.enemies.forEach((e) => {
        const contactDist = Math.hypot(s.px - e.x, s.py - e.y);
        if (contactDist < e.radius + 15 && s.invulnTime <= 0) {
          s.screenshake = 12;
          s.damageFlash = 0.4;
          s.invulnTime = 0.7; // immunity frame

          if (stats.shield > 0) {
            playSound('shield');
            const newShield = Math.max(0, stats.shield - e.damage);
            const bleed = e.damage > stats.shield ? e.damage - stats.shield : 0;
            onUpdateStats({
              shield: newShield,
              hp: Math.max(0, stats.hp - bleed)
            });
            showFloatingText(s.px, s.py - 25, `Shield -${Math.ceil(e.damage)}`, '#38bdf8', 16);
          } else {
            playSound('damage');
            onUpdateStats({ hp: Math.max(0, stats.hp - e.damage) });
            showFloatingText(s.px, s.py - 25, `HP -${Math.ceil(e.damage)}`, '#f43f5e', 18);
          }
        }
      });

      // Handle Enemy Death & Core Drops
      const remainingEnemies: typeof s.enemies = [];
      s.enemies.forEach((e) => {
        if (e.hp <= 0) {
          // Enemy destroyed! Trigger score and drop gem
          playSound('explosion');
          onEnemyKilled(e.scoreValue);
          addExplosionParticles(e.x, e.y, e.color, e.type === 'boss' ? 40 : 12);

          if (e.id === s.activeBossId) {
            s.activeBossId = null;
          }

          // Small splitter asteroid logic: creates 2 smaller scouts
          if (e.type === 'asteroid' && e.radius > 16) {
            for (let m = 0; m < 2; m++) {
              s.enemies.push({
                id: `asteroid-shard-${performance.now()}-${Math.random()}`,
                x: e.x + (Math.random() - 0.5) * 15,
                y: e.y + (Math.random() - 0.5) * 15,
                hp: Math.ceil(e.maxHp * 0.4),
                maxHp: Math.ceil(e.maxHp * 0.4),
                type: 'scout',
                speed: e.speed * 1.5,
                radius: e.radius * 0.55,
                color: '#64748b',
                scoreValue: Math.ceil(e.scoreValue * 0.5),
                damage: Math.ceil(e.damage * 0.5),
              });
            }
          }

          // Drops dynamic Core energy gems based on type
          const gemCount = e.type === 'boss' ? 20 : (e.type === 'heavy' ? 5 : 1);
          for (let g = 0; g < gemCount; g++) {
            s.gems.push({
              x: e.x + (Math.random() - 0.5) * e.radius * 0.6,
              y: e.y + (Math.random() - 0.5) * e.radius * 0.6,
              xp: e.type === 'boss' ? 25 : (e.type === 'heavy' ? 15 : 6),
              color: e.type === 'boss' ? '#fbbf24' : (e.type === 'heavy' ? '#ec4899' : '#22d3ee'),
              size: e.type === 'boss' ? 12 : (e.type === 'heavy' ? 8 : 4.5),
              magnetized: false,
            });
          }

          // Random Nanobots Heal pick drop (2% chance) or EMP pick (1% chance)
          const dropRoll = Math.random();
          if (dropRoll < 0.035) {
            s.gems.push({
              x: e.x,
              y: e.y,
              xp: -100, // special trigger: represents health drop pickup
              color: '#22c55e', // glowing emerald nanobots
              size: 10,
              magnetized: false,
            });
          }
        } else {
          remainingEnemies.push(e);
        }
      });
      s.enemies = remainingEnemies;

      // Handle Gem Collision & absorption with Player
      const activeGems: typeof s.gems = [];
      s.gems.forEach((g) => {
        const d = Math.hypot(s.px - g.x, s.py - g.y);
        if (d < 22) {
          // XP Gem collected!
          if (g.xp === -100) {
            // Nano-Heal pickup!
            playSound('heal');
            const healAmnt = Math.ceil(stats.maxHp * 0.35);
            onUpdateStats({ hp: Math.min(stats.maxHp, stats.hp + healAmnt) });
            showFloatingText(s.px, s.py - 40, `HEALED +${healAmnt}`, '#10b981', 18);
            addExplosionParticles(s.px, s.py, '#10b981', 12);
          } else {
            playSound('click');
            const newXp = stats.xp + g.xp;
            showFloatingText(s.px + (Math.random() - 0.5) * 20, s.py - 30, `+${g.xp} XP`, '#a5f3fc', 14);

            if (newXp >= stats.nextXp) {
              // Level up detected! Put into stat queue and immediately trigger draft
              const carryOver = newXp - stats.nextXp;
              const nextScale = Math.ceil(stats.nextXp * 1.35);
              onUpdateStats({
                level: stats.level + 1,
                xp: carryOver,
                nextXp: nextScale,
              });
              playSound('levelup');
              onLevelUp(); // Pauses loops and reveals cards
            } else {
              onUpdateStats({ xp: newXp });
            }
          }
        } else {
          activeGems.push(g);
        }
      });
      s.gems = activeGems;

      // Check Player HP Game Over Condition
      if (stats.hp <= 0) {
        isTerminated = true;
        cancelAnimationFrame(animId);
        onGameOver(stats.score, stats.kills, stats.level);
        return;
      }

      // --- 6. SCI-FI RENDER LAYER (SHADING & GLOW) ---

      // Dynamic cinematic screenshake translation
      ctx.save();
      if (s.screenshake > 0.1) {
        const shakeX = (Math.random() - 0.5) * s.screenshake;
        const shakeY = (Math.random() - 0.5) * s.screenshake;
        ctx.translate(shakeX, shakeY);
        s.screenshake *= 0.92; // smooth decay
      }

      // Clear dark blue space container background
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, s.width, s.height);

      // Camera coordinates center ship on screen
      s.camX = s.px - s.width / 2;
      s.camY = s.py - s.height / 2;

      // Constrain camera view to arena edges slightly
      s.camX = Math.max(0, Math.min(s.arenaSize - s.width, s.camX));
      s.camY = Math.max(0, Math.min(s.arenaSize - s.height, s.camY));

      // Draw high-contrast cosmic grids
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSize = 100;
      const startGridX = Math.floor(s.camX / gridSize) * gridSize;
      const startGridY = Math.floor(s.camY / gridSize) * gridSize;

      for (let gx = startGridX; gx < startGridX + s.width + gridSize; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx - s.camX, 0);
        ctx.lineTo(gx - s.camX, s.height);
        ctx.stroke();
      }
      for (let gy = startGridY; gy < startGridY + s.height + gridSize; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy - s.camY);
        ctx.lineTo(s.width, gy - s.camY);
        ctx.stroke();
      }

      // Draw red hazard limits warning boundaries
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(-s.camX, -s.camY, s.arenaSize, s.arenaSize);

      // Draw space background stars/dust (random constant fields)
      ctx.fillStyle = '#475569';
      for (let star = 0; star < 40; star++) {
        // pseudo-procedurial stars
        const sx = ((star * 1337) % s.arenaSize) - s.camX;
        const sy = ((star * 7331) % s.arenaSize) - s.camY;
        if (sx > 0 && sx < s.width && sy > 0 && sy < s.height) {
          ctx.beginPath();
          ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Energy Core gems drops
      s.gems.forEach((g) => {
        const scrX = g.x - s.camX;
        const scrY = g.y - s.camY;
        if (scrX > -20 && scrX < s.width + 20 && scrY > -20 && scrY < s.height + 20) {
          ctx.beginPath();
          ctx.arc(scrX, scrY, g.size, 0, Math.PI * 2);
          ctx.fillStyle = g.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = g.color;
          ctx.fill();
          ctx.shadowBlur = 0; // reset glow
        }
      });

      // Draw Enemies
      s.enemies.forEach((e) => {
        const scrX = e.x - s.camX;
        const scrY = e.y - s.camY;
        if (scrX > -40 && scrX < s.width + 40 && scrY > -40 && scrY < s.height + 40) {
          ctx.save();
          ctx.translate(scrX, scrY);

          // Draw neon shadows
          ctx.shadowBlur = 12;
          ctx.shadowColor = e.color;

          // Draw custom geometric shape fitting space ship designs
          ctx.fillStyle = e.color;
          ctx.beginPath();
          if (e.type === 'scout') {
            // Fast Arrow shape
            ctx.moveTo(0, -e.radius);
            ctx.lineTo(e.radius * 0.8, e.radius);
            ctx.lineTo(0, e.radius * 0.5);
            ctx.lineTo(-e.radius * 0.8, e.radius);
          } else if (e.type === 'stalker') {
            // Razor Star
            ctx.moveTo(0, -e.radius);
            ctx.lineTo(e.radius * 0.5, -e.radius * 0.3);
            ctx.lineTo(e.radius, 0);
            ctx.lineTo(e.radius * 0.5, e.radius * 0.3);
            ctx.lineTo(0, e.radius);
            ctx.lineTo(-e.radius * 0.5, e.radius * 0.3);
            ctx.lineTo(-e.radius, 0);
            ctx.lineTo(-e.radius * 0.5, -e.radius * 0.3);
          } else if (e.type === 'asteroid') {
            // Irregular rock hexagon
            for (let side = 0; side < 7; side++) {
              const a = (side * Math.PI * 2) / 7;
              const r = e.radius * (0.85 + Math.sin(side * 1.5) * 0.15);
              const px = Math.cos(a) * r;
              const py = Math.sin(a) * r;
              if (side === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
          } else if (e.type === 'heavy') {
            // Big aggressive cruiser hexagon with core
            ctx.moveTo(0, -e.radius * 1.2);
            ctx.lineTo(e.radius, -e.radius * 0.4);
            ctx.lineTo(e.radius * 0.7, e.radius);
            ctx.lineTo(-e.radius * 0.7, e.radius);
            ctx.lineTo(-e.radius, -e.radius * 0.4);
          } else {
            // BOSS Overlord: massive armored neon hexagon mothership
            ctx.moveTo(0, -e.radius * 1.3);
            ctx.lineTo(e.radius, -e.radius * 0.6);
            ctx.lineTo(e.radius * 1.1, e.radius * 0.5);
            ctx.lineTo(0, e.radius * 1.2);
            ctx.lineTo(-e.radius * 1.1, e.radius * 0.5);
            ctx.lineTo(-e.radius, -e.radius * 0.6);
          }
          ctx.closePath();
          ctx.fill();

          // Core visual inside ship
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();

          // HP indicators above heavy/boss enemies
          if (e.type === 'heavy' || e.type === 'boss' || e.hp < e.maxHp) {
            const barW = e.radius * 1.5;
            const barH = 4;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
            ctx.fillRect(-barW / 2, -e.radius - 12, barW, barH);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(-barW / 2, -e.radius - 12, barW * (e.hp / e.maxHp), barH);
          }

          ctx.restore();
        }
      });

      // Draw Bullets & Rockets
      s.bullets.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x - s.camX, b.y - s.camY, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      s.rockets.forEach((r) => {
        ctx.save();
        ctx.translate(r.x - s.camX, r.y - s.camY);
        ctx.rotate(r.angle);
        
        // Rocket missile body
        ctx.fillStyle = '#f97316';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f97316';
        ctx.fillRect(-8, -3, 14, 6);
        
        ctx.fillStyle = '#ef4444'; // tip red
        ctx.beginPath();
        ctx.moveTo(6, -3);
        ctx.lineTo(12, 0);
        ctx.lineTo(6, 3);
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
      });

      // Draw Supporting Drone Companion
      const activeDrone = weapons.find(w => w.id === 'drone');
      if (activeDrone) {
        const dRadius = 50;
        const dx = s.px + Math.cos(s.droneAngle) * dRadius - s.camX;
        const dy = s.py + Math.sin(s.droneAngle) * dRadius - s.camY;

        ctx.save();
        ctx.translate(dx, dy);

        // Hover glowing circle
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Cute drone body
        ctx.fillStyle = '#c084fc';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#c084fc';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(6, 2);
        ctx.lineTo(-6, 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
      }

      // Draw Plasma Orbiter shields circles
      if (orbitWeapon) {
        const sphereCount = Math.min(6, 1 + orbitWeapon.level);
        const radiusDist = 100 + orbitWeapon.level * 10;

        for (let i = 0; i < sphereCount; i++) {
          const sphereOffset = (i * Math.PI * 2) / sphereCount;
          const sx = s.px + Math.cos(s.orbitalAngle + sphereOffset) * radiusDist - s.camX;
          const sy = s.py + Math.sin(s.orbitalAngle + sphereOffset) * radiusDist - s.camY;

          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#a855f7';
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#a855f7';
          ctx.fill();
          ctx.shadowBlur = 0;

          // faint energy link rope
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(s.px - s.camX, s.py - s.camY);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      }

      // Draw Temporal Shield Slow Area
      const slowShield = weapons.find(w => w.id === 'shield_dome');
      if (slowShield) {
        const bubbleRad = 150 + slowShield.level * 20;
        const screenPx = s.px - s.camX;
        const screenPy = s.py - s.camY;

        // Draw soft pulse circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(screenPx, screenPy, bubbleRad, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
        ctx.fill();

        // Detect and slow enemies inside slow bubble field
        s.enemies.forEach((e) => {
          const eDist = Math.hypot(e.x - s.px, e.y - s.py);
          if (eDist < bubbleRad) {
            // Apply severe slow to enemies
            const normalSpeed = e.type === 'scout' ? 150 : (e.type === 'stalker' ? 100 : (e.type === 'heavy' ? 60 : 70));
            e.speed = normalSpeed * 0.4; // 60% slow down!
            
            // Deal slight continuous ticks
            e.hp -= (0.4 * slowShield.level) * stats.damageMultiplier * dt;
            if (Math.random() < 0.1) {
              addExplosionParticles(e.x, e.y, '#10b981', 1);
            }
          } else {
            // Restore regular speed
            const normalSpeed = e.type === 'scout' ? 150 : (e.type === 'stalker' ? 100 : (e.type === 'heavy' ? 60 : 70));
            if (e.type !== 'asteroid') {
              e.speed = normalSpeed;
            }
          }
        });

        ctx.restore();
      }

      // Draw Particles
      s.particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x - s.camX, p.y - s.camY, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Draw Spaceship Player
      const scrPx = s.px - s.camX;
      const scrPy = s.py - s.camY;
      ctx.save();
      ctx.translate(scrPx, scrPy);
      ctx.rotate(s.pAngle);

      // Render hazard blinking damage immunity flash
      if (s.invulnTime > 0 && Math.floor(s.gameTime * 15) % 2 === 0) {
        ctx.globalAlpha = 0.3; // transparent blinking
      }

      // Dual side engines thruster fire
      if (moveDirX !== 0 || moveDirY !== 0) {
        const fireRand = 6 + Math.random() * 12;
        ctx.fillStyle = '#f97316';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-16, -6);
        ctx.lineTo(-16 - fireRand, 0);
        ctx.lineTo(-16, 6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // High contrast metallic player capsule
      ctx.fillStyle = '#38bdf8'; // sky blue glowing wingtips
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#06b6d4';
      ctx.beginPath();
      // Main nose assembly forward pointy
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -14);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Dark fuselage windshield glass inset
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(3, 0, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing accents thrusters ports
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-15, -6, 4, 12);

      // Draw defensive force bubble ring shield if stats.shield > 0
      if (stats.shield > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        // pulse opacity
        const shieldOpacity = 0.3 + Math.sin(s.gameTime * 6) * 0.15;
        ctx.fillStyle = `rgba(56, 189, 248, ${shieldOpacity})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      ctx.globalAlpha = 1.0; // restore state

      // Draw Floating Feedback Damage/XP Texts
      s.floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${ft.size}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        // fade logic
        ctx.globalAlpha = Math.max(0, ft.life * 1.5);
        ctx.fillText(ft.text, ft.x - s.camX, ft.y - s.camY);
        ctx.restore();
      });

      // Overlay damage screen-flash border
      if (s.damageFlash > 0.01) {
        ctx.fillStyle = `rgba(239, 68, 68, ${s.damageFlash * 0.4})`;
        ctx.fillRect(0, 0, s.width, s.height);
        s.damageFlash -= dt * 1.5;
      }

      ctx.restore(); // reset screen translate mapping
    };

    animId = requestAnimationFrame(loop);
    return () => {
      isTerminated = true;
      cancelAnimationFrame(animId);
    };
  }, [activeWeapons, controlType, onEnemyKilled, onGameOver, onLevelUp, onUpdateStats]);

  return (
    <div
      ref={containerRef}
      id="game-canvas-housing"
      className="relative w-full h-[360px] md:h-[500px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden cursor-crosshair select-none touch-none shadow-2xl shadow-indigo-950/20"
      onPointerMove={(e) => {
        // mouse coordinates
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        stateRef.current.pointerScreenX = e.clientX - rect.left;
        stateRef.current.pointerScreenY = e.clientY - rect.top;
      }}
    >
      <canvas
        ref={canvasRef}
        id="core-game-screen"
        className="block w-full h-full"
      />

      {/* Floating Canvas Quick Controls indicators overlay */}
      <div 
        id="canvas-quick-alert" 
        className="absolute bottom-4 left-4 p-2 bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-800 pointer-events-none text-[10px] font-mono text-slate-400 flex flex-col gap-1 select-none"
      >
        <span className="flex items-center gap-1.5 font-medium text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          PLAYFIELD ACTIVE
        </span>
        <span>🎹 WASD / Arrows to Move</span>
        <span>🖱️ Cursor Aims Autofire</span>
        <span>🎮 Swipe/Drag on screen to fly directly</span>
      </div>

      {stateRef.current.activeBossId && (
        <div id="boss-alarm-banner" className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-red-950/90 border border-red-500 rounded-full text-xs font-mono font-bold tracking-widest text-red-400 animate-pulse shadow-lg flex items-center gap-2">
          ⚡ NEBULAR OVERLORD ARRIVED ⚡
        </div>
      )}
    </div>
  );
}
