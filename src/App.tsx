import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Sparkles, Volume2, Gamepad2, Play, Info, Pause } from 'lucide-react';
import { GameState, PlayerStats, ActiveWeaponState, Upgrade, Achievement, LocalSave } from './types';
import GameCanvas from './components/GameCanvas';
import GameUI from './components/GameUI';
import { resumeAudio, playSound, setVolume, getVolume } from './audio';

const initialPlayerStats: PlayerStats = {
  level: 1,
  xp: 0,
  nextXp: 100,
  score: 0,
  kills: 0,
  maxHp: 100,
  hp: 100,
  maxShield: 40,
  shield: 40,
  damageMultiplier: 1.0,
  fireRateMultiplier: 1.0,
  speed: 230,
  magnetRange: 130,
  critChance: 0.05,
  regenRate: 4,
};

const upgradeTemplates = [
  { id: 'laser', name: 'Pulse Laser', description: 'Spawns multiple lasers with varying angles for heavy frontal spread.', category: 'weapon' as const, icon: 'zap', maxLevel: 5 },
  { id: 'plasma_orbit', name: 'Plasma Orbit', description: 'Glowy energy orbs spinning around you, dealing constant continuous damage to nearby enemies.', category: 'weapon' as const, icon: 'cpu', maxLevel: 5 },
  { id: 'seeker_missile', name: 'Seeker Rocket', description: 'Fires auto-homing explosive missiles that scan closest targets and trigger splash damage.', category: 'weapon' as const, icon: 'crosshair', maxLevel: 5 },
  { id: 'tesla_coil', name: 'Tesla Coil', description: 'Discharges electric branching chain arcs leaping across multiple adjacent targets.', category: 'weapon' as const, icon: 'zap', maxLevel: 5 },
  { id: 'shield_dome', name: 'Temporal Field', description: 'Projects a slow-down defensive energy bubble around you, draining health of trapped intruders.', category: 'weapon' as const, icon: 'shield', maxLevel: 4 },
  { id: 'drone', name: 'Support Drone', description: 'Deploys a cute autonomous companion drone that follows you and shoots rapid plasma bursts.', category: 'weapon' as const, icon: 'sparkles', maxLevel: 5 },
  { id: 'hull', name: 'Reinforced Hull', description: 'Increases Maximum HP Capacity and instantly repairs damaged subsystems.', category: 'stat' as const, icon: 'heart', maxLevel: 5 },
  { id: 'regen', name: 'Rechargeable Shields', description: 'Increases Maximum Shields Capacity and enhances passive shield recharge rate.', category: 'stat' as const, icon: 'shield', maxLevel: 5 },
  { id: 'overclock', name: 'Quantum Overclock', description: 'Overcharges nuclear engines to boost weapon firing rate multiplier.', category: 'stat' as const, icon: 'activity', maxLevel: 5 },
  { id: 'radiant', name: 'Tritium Generators', description: 'Maximizes energy reactors to permanently boost all weaponry direct base damage.', category: 'stat' as const, icon: 'cpu', maxLevel: 5 },
  { id: 'grav', name: 'Gravity Magnet', description: 'Widens gravity grid traction to pull items and energy gems from further away.', category: 'stat' as const, icon: 'sparkles', maxLevel: 5 },
  { id: 'propulsion', name: 'Hyper Propulsion', description: 'Upgrades spacecraft thruster velocity for faster maneuvering in combat.', category: 'stat' as const, icon: 'activity', maxLevel: 5 },
  { id: 'crit', name: 'Precision Targeter', description: 'Improves primary tactical computers for higher Critical Strike Chance.', category: 'stat' as const, icon: 'crosshair', maxLevel: 5 }
];

const initialAchievements: Achievement[] = [
  { id: 'survive_2m', title: 'Cosmic Voyager', description: 'Survive for at least 2 minutes (120s) in a single run.', unlocked: false, icon: 'Clock', targetCount: 120, currentCount: 0 },
  { id: 'survive_5m', title: 'Sector Pioneer', description: 'Survive for at least 5 minutes (300s) in a single run.', unlocked: false, icon: 'Clock', targetCount: 300, currentCount: 0 },
  { id: 'kills_50', title: 'Debris Maker', description: 'Defeat 50 incoming enemy vessels.', unlocked: false, icon: 'Skull', targetCount: 50, currentCount: 0 },
  { id: 'kills_200', title: 'Stellar Guardian', description: 'Defeat 200 incoming enemy vessels.', unlocked: false, icon: 'Skull', targetCount: 200, currentCount: 0 },
  { id: 'level_5', title: 'Evolution Scout', description: 'Increase space vessel stats to Level 5.', unlocked: false, icon: 'Award', targetCount: 5, currentCount: 1 },
  { id: 'level_12', title: 'Hyper-Class Dreadnought', description: 'Increase space vessel stats to Level 12.', unlocked: false, icon: 'Award', targetCount: 12, currentCount: 1 },
  { id: 'epic_pull', title: 'Sub-space Gambler', description: 'Draft an Epic or Legendary rarity upgrade.', unlocked: false, icon: 'Sparkles', targetCount: 1, currentCount: 0 },
  { id: 'points_10k', title: 'Elite Pilot', description: 'Acquire over 10,000 points in a single session.', unlocked: false, icon: 'Trophy', targetCount: 10000, currentCount: 0 }
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [playerStats, setPlayerStats] = useState<PlayerStats>(initialPlayerStats);
  const [activeWeapons, setActiveWeapons] = useState<ActiveWeaponState[]>([
    { id: 'laser', level: 1, lastFired: 0 },
  ]);

  const [timeElapsed, setTimeElapsed] = useState(0);
  const [controlType, setControlType] = useState<'hybrid' | 'mouse-follow'>('mouse-follow');
  const [volume, setVolumeState] = useState(0.4);

  // High Scores & Achievements persistent records state
  const [highScore, setHighScore] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements);

  // Achievement unlock floating flags
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  // Active upgrades selection card list
  const [draftChoices, setDraftChoices] = useState<Upgrade[]>([]);

  // Sound multi control references
  useEffect(() => {
    setVolume(volume);
  }, [volume]);

  // Load from LocalStorage securely
  useEffect(() => {
    try {
      const stored = localStorage.getItem('space_survivor_save');
      if (stored) {
        const data: LocalSave = JSON.parse(stored);
        setHighScore(data.highScore || 0);
        setTotalRuns(data.totalRuns || 0);
        
        // Update pre-set achievement unlocks list
        if (data.unlockedAchievements) {
          const loadedAchievements = initialAchievements.map(item => ({
            ...item,
            unlocked: data.unlockedAchievements.includes(item.id),
          }));
          setAchievements(loadedAchievements);
        }
      }
    } catch (e) {
      console.warn('LocalStorage save failed to read or corrupted:', e);
    }
  }, []);

  // Persistent highscore and runs save helper
  const saveUserData = (newHighScore: number, addedRunCount = 0, unlockedIds: string[]) => {
    try {
      const updatedRuns = totalRuns + addedRunCount;
      setHighScore(newHighScore);
      setTotalRuns(updatedRuns);

      const data: LocalSave = {
        highScore: newHighScore,
        totalKills: 0, // transient tracker
        totalRuns: updatedRuns,
        unlockedAchievements: unlockedIds,
      };
      localStorage.setItem('space_survivor_save', JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  };

  // 1-second interval timer when game is playing and active
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const timer = setInterval(() => {
      setTimeElapsed(prev => {
        const nextTime = prev + 1;
        checkTimeAchievements(nextTime);
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // Watchers to trigger alert unlock banners
  const triggerUnlockBanner = (title: string) => {
    setAlertBanner(title);
    playSound('levelup');
    setTimeout(() => {
      setAlertBanner(null);
    }, 4500);
  };

  // Validate Survival Timestamps criteria
  const checkTimeAchievements = (secs: number) => {
    let changed = false;
    const nextBadges = achievements.map(badge => {
      if (badge.unlocked) return badge;
      
      let nextCount = badge.currentCount;
      if (badge.id === 'survive_2m' || badge.id === 'survive_5m') {
        nextCount = secs;
      }

      const meetsGoal = nextCount >= badge.targetCount;
      if (meetsGoal) {
        changed = true;
        triggerUnlockBanner(badge.title);
        return { ...badge, currentCount: nextCount, unlocked: true };
      }

      return { ...badge, currentCount: nextCount };
    });

    if (changed) {
      setAchievements(nextBadges);
      const unlockedSet = nextBadges.filter(b => b.unlocked).map(b => b.id);
      saveUserData(highScore, 0, unlockedSet);
    }
  };

  // Validate Kills and Scores checkpoints
  const checkGameplayAchievements = (currentKills: number, currentPoints: number, currentLevel: number) => {
    let changed = false;
    const nextBadges = achievements.map(badge => {
      if (badge.unlocked) return badge;

      let nextCount = badge.currentCount;
      if (badge.id === 'kills_50' || badge.id === 'kills_200') nextCount = currentKills;
      if (badge.id === 'points_10k') nextCount = currentPoints;
      if (badge.id === 'level_5' || badge.id === 'level_12') nextCount = currentLevel;

      const meetsGoal = nextCount >= badge.targetCount;
      if (meetsGoal) {
        changed = true;
        triggerUnlockBanner(badge.title);
        return { ...badge, currentCount: nextCount, unlocked: true };
      }

      return { ...badge, currentCount: nextCount };
    });

    if (changed) {
      setAchievements(nextBadges);
      const unlockedSet = nextBadges.filter(b => b.unlocked).map(b => b.id);
      saveUserData(highScore, 0, unlockedSet);
    }
  };

  // Starting gameplay triggers
  const handleStartGame = async () => {
    await resumeAudio();
    playSound('levelup');

    setPlayerStats({
      ...initialPlayerStats,
      hp: initialPlayerStats.maxHp,
      shield: initialPlayerStats.maxShield,
    });
    setActiveWeapons([
      { id: 'laser', level: 1, lastFired: 0 }
    ]);
    setTimeElapsed(0);
    setGameState('PLAYING');

    // Reset counts for active achievements run
    const resettedBadges = achievements.map(b => {
      if (b.unlocked) return b;
      return { ...b, currentCount: b.id.includes('level') ? 1 : 0 };
    });
    setAchievements(resettedBadges);
  };

  const handlePauseToggle = () => {
    if (gameState === 'PLAYING') {
      playSound('click');
      setGameState('PAUSED');
    } else if (gameState === 'PAUSED') {
      playSound('click');
      setGameState('PLAYING');
    }
  };

  // Level Up triggers Card Draft Screen
  const handleLevelUpTrigger = () => {
    setGameState('UPGRADE');
    playSound('levelup');

    // Build the 3 unique card choices pool
    const selectedChoices: Upgrade[] = [];
    const randomizedPool = [...upgradeTemplates].sort(() => Math.random() - 0.5);

    for (const t of randomizedPool) {
      if (selectedChoices.length >= 3) break;

      // Find current level if any exists in weapons or stats
      const activeW = activeWeapons.find(w => w.id === t.id);
      
      // If weapon exists of max level, skip drafting its card again
      if (activeW && activeW.level >= t.maxLevel) continue;

      let nextLevel = 1;
      if (t.category === 'weapon') {
        nextLevel = activeW ? activeW.level + 1 : 1;
      } else {
        // Stats levels can be arbitrary
        nextLevel = 1; 
      }

      // Rarity distribution: Legendary: 3%, Epic: 12%, Rare: 25%, Common: 60%
      const roll = Math.random();
      let rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';
      let specMultiplier = 1.0;

      if (roll < 0.03) {
        rarity = 'legendary';
        specMultiplier = 2.4;
      } else if (roll < 0.15) {
        rarity = 'epic';
        specMultiplier = 1.7;
      } else if (roll < 0.40) {
        rarity = 'rare';
        specMultiplier = 1.35;
      }

      // Format custom detailed description
      let desc = t.description;
      if (t.id === 'laser') {
        desc = `Fires ${Math.min(6, nextLevel)} frontal pulse lasers simultaneously with wide angular spread (+${Math.round(15 * specMultiplier)}% speed).`;
      } else if (t.id === 'plasma_orbit') {
        desc = `Spawns ${Math.min(6, 1 + nextLevel)} violet plasma stars spinning in orbit around you (Deals ${Math.round(12 * specMultiplier)} ticks).`;
      } else if (t.id === 'seeker_missile') {
        desc = `Fires automatic homing missile searching closest targets (Detonates ${Math.round(28 * specMultiplier)} blast splash).`;
      } else if (t.id === 'tesla_coil') {
        desc = `Discharges electricity lightning bolt jumps up to ${Math.min(5, nextLevel)} nearby opponents.`;
      } else if (t.id === 'shield_dome') {
        desc = `Projects static emerald sub-space zone. Slows captives down by 60% and deals ${Math.round(4 * specMultiplier)} continuous DPS.`;
      } else if (t.id === 'drone') {
        desc = `Releases companion drone following you and firing secondary lasers (${Math.round(6 * specMultiplier)} damage).`;
      } else if (t.id === 'hull') {
        desc = `Increases Hull HP Capacity by +${Math.round(25 * specMultiplier)} and instantly self-repairs system HP.`;
      } else if (t.id === 'regen') {
        desc = `Reinforces maximum Shield Capacity by +${Math.round(15 * specMultiplier)} and adds +${Math.round(1.5 * specMultiplier)} regen/s.`;
      } else if (t.id === 'overclock') {
        desc = `Amplifies reactor speed multiplier to speed weapon fire intervals rate +${Math.round(15 * specMultiplier)}%.`;
      } else if (t.id === 'radiant') {
        desc = `Multiplies tritium fuel nodes. Direct base firearms damage value multiplier +${Math.round(20 * specMultiplier)}%.`;
      } else if (t.id === 'grav') {
        desc = `Amplifies suction field magnets to draw energy gems from +${Math.round(35 * specMultiplier)}% further away.`;
      } else if (t.id === 'propulsion') {
        desc = `Reconfigures booster rockets. Spaceship maneuvering translation kinetic speed +${Math.round(12 * specMultiplier)}%.`;
      } else if (t.id === 'crit') {
        desc = `Overclocks digital sights tracking vulnerable hull seams (+${Math.round(8 * specMultiplier)}% Critical strike risk).`;
      }

      selectedChoices.push({
        id: t.id,
        name: t.name,
        description: desc,
        category: t.category,
        rarity,
        level: nextLevel,
        maxLevel: t.maxLevel,
        icon: t.icon,
      });
    }

    setDraftChoices(selectedChoices);
  };

  // Apply drafted upgrade package
  const handleSelectUpgrade = (upgrade: Upgrade) => {
    playSound('heal');

    const sMultiplier = 
      upgrade.rarity === 'legendary' ? 2.4 : 
      upgrade.rarity === 'epic' ? 1.7 : 
      upgrade.rarity === 'rare' ? 1.35 : 1.0;

    // Check if pull is rare or above to trigger sub-space gambler badge
    if (upgrade.rarity === 'epic' || upgrade.rarity === 'legendary') {
      const nextBadges = achievements.map(badge => {
        if (badge.id === 'epic_pull' && !badge.unlocked) {
          triggerUnlockBanner(badge.title);
          return { ...badge, unlocked: true, currentCount: 1 };
        }
        return badge;
      });
      setAchievements(nextBadges);
    }

    // 1. If it represents an active auto-weapon
    if (upgrade.category === 'weapon') {
      const existing = activeWeapons.find(w => w.id === upgrade.id);
      if (existing) {
        setActiveWeapons(activeWeapons.map(w => w.id === upgrade.id ? { ...w, level: upgrade.level } : w));
      } else {
        setActiveWeapons([...activeWeapons, { id: upgrade.id, level: 1, lastFired: 0 }]);
      }
    } else {
      // 2. If it represents a spacecraft statistic modification
      setPlayerStats(prev => {
        const nextStats = { ...prev };
        switch (upgrade.id) {
          case 'hull':
            const hpBuff = Math.round(25 * sMultiplier);
            nextStats.maxHp += hpBuff;
            nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + Math.round(nextStats.maxHp * 0.45)); // Repairs HP
            break;
          case 'regen':
            const shieldBuff = Math.round(15 * sMultiplier);
            nextStats.maxShield += shieldBuff;
            nextStats.shield = Math.min(nextStats.maxShield, nextStats.shield + shieldBuff);
            nextStats.regenRate += 1.5 * sMultiplier;
            break;
          case 'overclock':
            nextStats.fireRateMultiplier += 0.15 * sMultiplier;
            break;
          case 'radiant':
            nextStats.damageMultiplier += 0.20 * sMultiplier;
            break;
          case 'grav':
            nextStats.magnetRange += Math.round(45 * sMultiplier);
            break;
          case 'propulsion':
            nextStats.speed += Math.round(25 * sMultiplier);
            break;
          case 'crit':
            nextStats.critChance += 0.08 * sMultiplier;
            break;
        }
        return nextStats;
      });
    }

    // Direct check level achievements
    checkGameplayAchievements(playerStats.kills, playerStats.score, playerStats.level);

    // Resume playing simulation
    setGameState('PLAYING');
  };

  // Enemy killed tracker updates scores
  const handleEnemyKilled = (scoreAdd: number) => {
    setPlayerStats(prev => {
      const nextKills = prev.kills + 1;
      const nextPoint = prev.score + scoreAdd;
      checkGameplayAchievements(nextKills, nextPoint, prev.level);
      return {
        ...prev,
        kills: nextKills,
        score: nextPoint,
      };
    });
  };

  // Direct statistics modifiers from engine
  const handleUpdateStats = (update: Partial<PlayerStats>) => {
    setPlayerStats(prev => ({
      ...prev,
      ...update,
    }));
  };

  // Reactor destroyed triggers
  const handleGameOver = (finalScore: number, finalKills: number, finalLevel: number) => {
    playSound('damage');
    setGameState('GAMEOVER');

    // Handle highscore calculations and saving
    const finalHScore = Math.max(highScore, finalScore);
    const unlockedList = achievements.filter(b => b.unlocked).map(b => b.id);
    saveUserData(finalHScore, 1, unlockedList);
  };

  return (
    <div 
      id="main-applet-housing" 
      className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-3 sm:p-6 select-none font-sans antialiased relative overflow-hidden"
    >
      {/* Radial grid dot background overlay */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />

      {/* Cyberpunk ambient backing blur glow lights */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#00f3ff] rounded-full blur-[150px] opacity-[0.08] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#ff007a] rounded-full blur-[150px] opacity-[0.08] pointer-events-none" />

      {/* Play area container wrapper */}
      <div className="w-full max-w-4xl flex flex-col gap-5 relative z-10">
        
        {/* Dynamic Unlocked Achievement Alert Banner with sharp bold design */}
        <AnimatePresence>
          {alertBanner && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.98 }}
              id="achievement-popup-alert"
              className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-4 bg-white text-black border-2 border-black flex items-center gap-4 shadow-[5px_5px_0px_#ff007a] pointer-events-auto z-45 max-w-xs sm:max-w-md w-full font-sans"
            >
              <div className="p-2 bg-black text-[#ff007a] border border-black">
                <Award size={22} className="animate-bounce" />
              </div>
              <div className="text-left flex-1">
                <span className="text-[10px] tracking-[0.2em] font-black text-black/50 uppercase leading-none block">
                  ACHIEVEMENT UNLOCKED
                </span>
                <span className="text-base font-black italic tracking-tight uppercase mt-1 block">
                  {alertBanner}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Space header metadata dashboard */}
        <header className="flex justify-between items-end px-1.5 pb-2 border-b border-white/10 z-10">
          <div className="flex flex-col text-left">
            <span className="text-[9px] tracking-[0.3em] text-[#00f3ff] font-extrabold uppercase leading-none">
              SYSTEM STATUS: OPERATIONAL
            </span>
            <h1 className="text-3xl font-black tracking-tighter leading-none italic mt-1.5 uppercase">
              <span className="text-transparent" style={{ WebkitTextStroke: '1px #fff' }}>SPACE</span> SHIFT
            </h1>
          </div>

          <div className="flex items-end gap-3 font-mono">
            {highScore > 0 && (
              <div className="text-[10px] text-right font-mono text-white/40 hidden sm:block leading-none">
                <p className="uppercase tracking-[0.15em] font-bold mb-1">HIGH RECORD</p>
                <p className="text-lg font-black tracking-tighter text-[#00f3ff] italic leading-none">
                  {highScore.toLocaleString()} PTS
                </p>
              </div>
            )}
            
            {gameState === 'PLAYING' && (
              <button
                onClick={handlePauseToggle}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 text-[10px] font-black tracking-widest uppercase text-white hover:text-[#00f3ff] transition-all cursor-pointer font-sans"
              >
                STANDBY : ESC
              </button>
            )}
          </div>
        </header>

        {/* Game playfield visual element */}
        <div id="core-interactive-panel" className="relative w-full rounded-none bg-black/40 border-2 border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          
          <GameCanvas
            playerStats={playerStats}
            activeWeapons={activeWeapons}
            isPaused={gameState !== 'PLAYING'}
            onUpdateStats={handleUpdateStats}
            onEnemyKilled={handleEnemyKilled}
            onLevelUp={handleLevelUpTrigger}
            onGameOver={handleGameOver}
            controlType={controlType}
          />

          <GameUI
            gameState={gameState}
            playerStats={playerStats}
            activeWeapons={activeWeapons}
            timeElapsed={timeElapsed}
            highScore={highScore}
            totalRuns={totalRuns}
            achievements={achievements}
            draftSelection={draftChoices}
            volume={volume}
            controlType={controlType}
            onStartGame={handleStartGame}
            onPauseToggle={handlePauseToggle}
            onSelectUpgrade={handleSelectUpgrade}
            onRestart={handleStartGame}
            onChangeVolume={(v) => {
              setVolumeState(v);
              setVolume(v);
            }}
            onChangeControlType={(t) => setControlType(t)}
            onShowAchievements={() => setGameState('ACHIEVEMENTS')}
            onHideAchievements={() => setGameState(gameState === 'ACHIEVEMENTS' && playerStats.hp > 0 ? 'PLAYING' : 'MENU')}
          />

        </div>

        {/* Footer info panels */}
        <footer className="px-1 py-1 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] tracking-[0.1em] text-white/30 uppercase font-mono font-bold">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#00f3ff] shadow-[0_0_8px_#00f3ff] animate-pulse" />
            <span>PROJECT SHIFT MATRIX MATRIX_CORE_ACTIVE</span>
          </div>
          <div className="text-right flex items-center gap-4">
            <span>DRAG / MOUSE : STEER PATH</span>
            <span className="text-white/10">|</span>
            <span>AI STUDIO ENG &copy; 2026</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
