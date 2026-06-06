import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Shield, Heart, Trophy, Sparkles, Play, Volume2, VolumeX, 
  Pause, RotateCcw, Gamepad2, Crosshair, Award, Clock, Skull, 
  ChevronRight, Activity, Cpu, Eye, Info
} from 'lucide-react';
import { GameState, PlayerStats, ActiveWeaponState, Upgrade, Achievement } from '../types';

interface GameUIProps {
  gameState: GameState;
  playerStats: PlayerStats;
  activeWeapons: ActiveWeaponState[];
  timeElapsed: number;
  highScore: number;
  totalRuns: number;
  achievements: Achievement[];
  draftSelection: Upgrade[];
  volume: number;
  controlType: 'hybrid' | 'mouse-follow';
  onStartGame: () => void;
  onPauseToggle: () => void;
  onSelectUpgrade: (upgrade: Upgrade) => void;
  onRestart: () => void;
  onChangeVolume: (vol: number) => void;
  onChangeControlType: (type: 'hybrid' | 'mouse-follow') => void;
  onShowAchievements: () => void;
  onHideAchievements: () => void;
}

export default function GameUI({
  gameState,
  playerStats,
  activeWeapons,
  timeElapsed,
  highScore,
  totalRuns,
  achievements,
  draftSelection,
  volume,
  controlType,
  onStartGame,
  onPauseToggle,
  onSelectUpgrade,
  onRestart,
  onChangeVolume,
  onChangeControlType,
  onShowAchievements,
  onHideAchievements,
}: GameUIProps) {

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
  };

  /**
   * Helper to retrieve matching icon for a given upgrade reference
   */
  const getUpgradeIcon = (iconName: string, size = 20) => {
    switch (iconName) {
      case 'zap': return <Zap size={size} className="text-cyan-400" />;
      case 'shield': return <Shield size={size} className="text-blue-400" />;
      case 'heart': return <Heart size={size} className="text-emerald-400" />;
      case 'sparkles': return <Sparkles size={size} className="text-amber-400" />;
      case 'activity': return <Activity size={size} className="text-rose-400" />;
      case 'cpu': return <Cpu size={size} className="text-purple-400" />;
      case 'crosshair': return <Crosshair size={size} className="text-pink-400" />;
      default: return <Sparkles size={size} className="text-cyan-400" />;
    }
  };

  /**
   * Maps rarity levels to glowing style highlights
   */
  const getRarityStyles = (rarity: 'common' | 'rare' | 'epic' | 'legendary') => {
    switch (rarity) {
      case 'legendary':
        return {
          border: 'border-amber-500/50 shadow-amber-500/10',
          text: 'text-amber-400',
          badge: 'bg-amber-950 text-amber-300 border-amber-500/30',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
        };
      case 'epic':
        return {
          border: 'border-fuchsia-500/50 shadow-fuchsia-500/10',
          text: 'text-fuchsia-400',
          badge: 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-500/30',
          glow: 'shadow-[0_0_20px_rgba(217,70,239,0.20)]',
        };
      case 'rare':
        return {
          border: 'border-cyan-500/50 shadow-cyan-500/10',
          text: 'text-cyan-400',
          badge: 'bg-cyan-950 text-cyan-300 border-cyan-500/30',
          glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
        };
      default:
        return {
          border: 'border-slate-800 shadow-slate-900/10',
          text: 'text-slate-200',
          badge: 'bg-slate-900 text-slate-400 border-slate-800',
          glow: '',
        };
    }
  };

  return (
    <div id="game-ui-overlay-container" className="absolute inset-0 pointer-events-none z-10 font-sans flex flex-col justify-between">
      
      {/* 1. RUNNING IN-GAME TOP BAR HUD */}
      {gameState === 'PLAYING' && (
        <div id="in-game-top-hud" className="w-full p-4 bg-black/80 border-b border-white/10 pointer-events-auto flex flex-col gap-3">
          
          {/* Level Tracker & XP Progress Gauge bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="px-4 py-1 bg-[#ff007a] text-black text-xs font-black italic tracking-widest uppercase">
                LEVEL {playerStats.level}
              </div>
            </div>
            
            <div className="flex-1 max-w-xl h-3.5 bg-[#0a0a0c] border border-white/10 p-[2px] rounded-none overflow-hidden">
              <div 
                id="xp-progress-indicator"
                className="h-full bg-[#00f3ff] transition-all duration-300 shadow-[0_0_8px_#00f3ff]"
                style={{ width: `${Math.min(100, (playerStats.xp / playerStats.nextXp) * 100)}%` }}
              />
            </div>

            <div className="text-[10px] font-mono tracking-widest text-[#00f3ff] font-black uppercase">
              {playerStats.xp} / {playerStats.nextXp} XP
            </div>
          </div>

          {/* Health Gauge, Shield, Score metrics and Controls row */}
          <div className="flex items-center justify-between flex-wrap gap-4 mt-1 pt-2 border-t border-white/5">
            {/* Health & Shield Bar container */}
            <div className="flex items-center gap-5 flex-1 min-w-[220px]">
              {/* HP Bar */}
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex justify-between items-center text-[10px] font-mono tracking-wider font-black text-white/50">
                  <span className="flex items-center gap-1 text-[#ff007a] font-bold"><Heart size={10} className="fill-current" /> HULL INTEGRITY</span>
                  <span className={playerStats.hp < playerStats.maxHp * 0.35 ? 'text-[#ff007a] font-black animate-pulse' : 'text-white'}>
                    {Math.max(0, playerStats.hp)} / {playerStats.maxHp}
                  </span>
                </div>
                <div className="h-3 bg-[#0a0a0c] border border-white/10 p-[2px] rounded-none">
                  <div 
                    className="h-full bg-[#ff007a] transition-all duration-150 shadow-[0_0_8px_#ff007a]"
                    style={{ width: `${Math.max(0, (playerStats.hp / playerStats.maxHp) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Shield Bar */}
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex justify-between items-center text-[10px] font-mono tracking-wider font-black text-white/50">
                  <span className="flex items-center gap-1 text-[#00f3ff] font-bold"><Shield size={10} /> PASSIVE SHIELD</span>
                  <span className="text-white">{playerStats.shield} / {playerStats.maxShield}</span>
                </div>
                <div className="h-3 bg-[#0a0a0c] border border-white/10 p-[2px] rounded-none">
                  <div 
                    className="h-full bg-[#00f3ff] transition-all duration-150 shadow-[0_0_8px_#00f3ff]"
                    style={{ width: `${(playerStats.shield / playerStats.maxShield) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Run state telemetry (Time, Kills, Score) */}
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 text-white font-black tracking-widest">
                <Clock size={12} className="text-[#00f3ff]" />
                <span>{formatTime(timeElapsed)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 text-white font-black tracking-widest">
                <Skull size={12} className="text-[#ff007a]" />
                <span>{playerStats.kills} KILLS</span>
              </div>
              <div className="px-4 py-1 bg-[#00f3ff] text-black font-black italic tracking-widest uppercase">
                {playerStats.score.toLocaleString()} PTS
              </div>

              {/* Pause Toggle button */}
              <button
                id="btn-trigger-pause"
                onClick={onPauseToggle}
                className="px-3.5 py-1.5 bg-white text-black hover:bg-[#ff007a] hover:text-white transition-all text-[11px] font-sans font-black tracking-widest uppercase cursor-pointer"
              >
                PAUSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN STATIC SCREENS (MENU, GAMEOVER, PAUSED, UPGRADES, ACHIEVEMENTS) */}
      <AnimatePresence mode="wait">
        
        {/* --- SCREEN A: MAIN START MENU --- */}
        {gameState === 'MENU' && (
          <motion.div
            key="screen-main-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="main-menu-overlay"
            className="absolute inset-0 bg-black/90 pointer-events-auto flex flex-col items-center justify-center p-6 text-center z-20 select-none overflow-y-auto"
          >
            {/* Decorative background grid and blurs */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            <div className="absolute top-[10%] -left-[10%] w-[400px] h-[400px] bg-[#ff007a] rounded-full blur-[120px] opacity-10 pointer-events-none" />
            <div className="absolute bottom-[10%] -right-[10%] w-[400px] h-[400px] bg-[#00f3ff] rounded-full blur-[120px] opacity-10 pointer-events-none" />

            <div className="max-w-xl w-full flex flex-col items-center gap-5 my-auto py-6 z-10 font-sans">
              
              {/* High Tech Header Graphic with rotated Neon Box styling */}
              <div className="flex gap-4 justify-center items-center mb-1">
                <div className="px-3 py-2 border-2 border-[#00f3ff] text-[#00f3ff] text-[10px] font-black tracking-[0.3em] uppercase rotate-[-3deg] shadow-[3px_3px_0px_#00f3ff]">
                  SYSTEM ACTIVE
                </div>
                <div className="px-3 py-2 border-2 border-[#ff007a] text-[#ff007a] text-[10px] font-black tracking-[0.3em] uppercase rotate-[3deg] shadow-[3px_3px_0px_#ff007a]">
                  POLARITY CORES
                </div>
              </div>

              <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-none italic uppercase">
                <span className="text-transparent" style={{ WebkitTextStroke: '2px #fff' }}>SPACE</span>
                <br />
                <span className="text-white">SHIFT</span>
              </h1>
              
              <p className="text-xs font-mono tracking-[0.25em] text-[#00f3ff] font-extrabold uppercase mb-2">
                ROGUE-LITE POLARITY CONTROL MATRIX
              </p>

              {/* Play Button - Stark High-Contrast Big Block! */}
              <motion.button
                whileHover={{ scale: 1.03, rotate: 1 }}
                whileTap={{ scale: 0.98 }}
                id="btn-play-now"
                onClick={onStartGame}
                className="w-full max-w-sm py-4 bg-white text-black font-black text-sm tracking-[0.2em] uppercase hover:bg-[#00f3ff] hover:text-black transition-all flex items-center justify-center gap-3 cursor-pointer shadow-[8px_8px_0px_#ff007a] border-2 border-black"
              >
                <Play size={18} className="fill-current" />
                ENGAGE COMBAT REACTOR
              </motion.button>

              {/* Volume & Controller settings controls panel */}
              <div className="w-full max-w-md p-5 bg-black/60 border-2 border-white/10 flex flex-col gap-5 text-left mt-3">
                <span className="text-[10px] font-mono text-[#00f3ff] font-black tracking-[0.25em] uppercase flex items-center gap-1.5 pb-2 border-b border-white/5">
                  <Gamepad2 size={11} /> PRECONFIGURATION ARCS
                </span>

                {/* Left/Right Control Mode selectors */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono font-black text-white/50 tracking-widest uppercase flex items-center justify-between">
                    <span>STEERING ALIGNMENT:</span>
                    <span className="text-[#00f3ff]">{controlType === 'hybrid' ? 'WASD + AIM' : 'MOUSE FOLLOW DIRECT'}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onChangeControlType('hybrid')}
                      className={`py-2 px-3 text-xs font-mono font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        controlType === 'hybrid' 
                          ? 'bg-[#00f3ff] text-black border-2 border-[#00f3ff]' 
                          : 'bg-[#0a0a0c] border border-white/20 text-white/60 hover:text-white hover:border-white/40'
                      }`}
                    >
                      <Crosshair size={12} />
                      HYBRID WASD
                    </button>
                    <button
                      onClick={() => onChangeControlType('mouse-follow')}
                      className={`py-2 px-3 text-xs font-mono font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        controlType === 'mouse-follow' 
                          ? 'bg-[#00f3ff] text-black border-2 border-[#00f3ff]' 
                          : 'bg-[#0a0a0c] border border-white/20 text-white/60 hover:text-white hover:border-white/40'
                      }`}
                    >
                      <Gamepad2 size={12} />
                      MOUSE DRAG
                    </button>
                  </div>
                </div>

                {/* Sub Volume control slider */}
                <div className="flex-1">
                  <label className="text-[10px] font-mono font-black text-white/50 tracking-widest uppercase flex items-center justify-between mb-1.5">
                    <span>AUDIO SYNTH FREQUENCIES:</span>
                    <span className="text-[#ff007a]">{Math.round(volume * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onChangeVolume(volume === 0 ? 0.4 : 0)} 
                      className="text-white/60 hover:text-white cursor-pointer"
                    >
                      {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      value={volume}
                      onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                      className="flex-1 accent-[#ff007a] bg-[#0a0a0c] border border-white/10 h-2 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Achievements Trigger & Records Row */}
              <div className="flex items-center justify-between gap-4 w-full max-w-md pt-2 font-sans">
                <div className="text-[10px] font-serif italic text-white/40 text-left">
                  🚀 Total runs initiated: <span className="text-white font-bold">{totalRuns} attempts</span>
                </div>
                <button
                  id="btn-show-achievements"
                  onClick={onShowAchievements}
                  className="px-4 py-2 bg-black border-2 border-white/20 text-white hover:border-[#00f3ff] hover:text-[#00f3ff] text-xs font-black tracking-widest transition-all cursor-pointer"
                >
                  BADGE STACKS
                </button>
              </div>

              <div className="bg-white text-black p-4 w-full max-w-md transform -rotate-1 text-left shadow-[5px_5px_0px_#ff007a] border-2 border-black">
                <p className="text-[9px] tracking-[0.15em] uppercase font-black text-black/40 mb-1">PRO-TIP SCHEMATIC</p>
                <p className="text-xs font-bold font-serif italic leading-relaxed">
                  Fast yellow Scouts drop teal energy gems. Leveling triggers automated firing weapons to defend coordinates!
                </p>
              </div>

            </div>
          </motion.div>
        )}

        {/* --- SCREEN B: UPGRADE CARDS DRAFT SELECTION (LEVEL UP) --- */}
        {gameState === 'UPGRADE' && (
          <motion.div
            key="screen-upgrade-draft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="draft-upgrade-overlay"
            className="absolute inset-0 bg-black/95 pointer-events-auto flex flex-col items-center justify-center p-6 z-20 text-center select-none"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-4xl w-full flex flex-col gap-6"
            >
              <div>
                <span className="px-4 py-1.5 bg-[#00f3ff] text-black text-[10px] font-mono font-black tracking-[0.25em] uppercase inline-block shadow-[2px_2px_0px_#ff007a]">
                  ⚡ INCOMING SYSTEM UPGRADE ⚡
                </span>
                <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter text-white uppercase mt-2">
                  EVOLVE SHIP CAPACITANCE
                </h2>
                <p className="text-xs font-mono text-[#ff007a] tracking-widest font-black uppercase mt-1">
                  Choose one module to engage automatic firing loops
                </p>
              </div>

              {/* 3 Split draft cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto w-full">
                {draftSelection.map((refUpgrade, index) => {
                  const sColors = getRarityStyles(refUpgrade.rarity);
                  return (
                    <motion.div
                      key={`upgrade-card-${refUpgrade.id}-${index}`}
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                      whileHover={{ scale: 1.04, y: -4 }}
                      onClick={() => onSelectUpgrade(refUpgrade)}
                      className={`p-5 rounded-none border-2 bg-black text-left cursor-pointer flex flex-col justify-between min-h-[190px] relative transition-all group shadow-[4px_4px_0px_rgba(255,255,255,0.1)] hover:shadow-[6px_6px_0px_#00f3ff] ${sColors.border} ${sColors.glow}`}
                    >
                      {/* Top section */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="p-2 rounded-none bg-white/5 border border-white/10 text-white">
                            {getUpgradeIcon(refUpgrade.icon, 20)}
                          </div>
                          <span className={`text-[8px] font-mono tracking-widest font-black uppercase border-2 px-2 py-0.5 rounded-none ${sColors.badge}`}>
                            {refUpgrade.rarity}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-black text-white text-base tracking-tight capitalize group-hover:text-[#00f3ff] transition-colors">
                            {refUpgrade.name}
                          </h3>
                          <p className="text-xs text-white/60 font-medium leading-relaxed mt-1.5 font-serif italic">
                            {refUpgrade.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom section Level indicator */}
                      <div className="pt-3 border-t border-white/5 mt-4 flex items-center justify-between text-[10px] font-mono text-white/40">
                        <span className="font-black tracking-widest">EVOLUTION PATH</span>
                        <span className="text-[#00f3ff] font-black">
                          LVL {refUpgrade.level} / {refUpgrade.maxLevel}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* --- SCREEN C: RUN GAMEOVER DISPLAY SCREEN --- */}
        {gameState === 'GAMEOVER' && (
          <motion.div
            key="screen-game-over"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="gameover-overlay"
            className="absolute inset-0 bg-black/95 pointer-events-auto flex flex-col items-center justify-center p-6 text-center z-20 select-none overflow-y-auto"
          >
            <div className="max-w-md w-full flex flex-col gap-6 my-auto py-6">
              
              <div className="w-14 h-14 bg-[#ff007a] text-black border-2 border-black flex items-center justify-center mx-auto mb-1 rotate-3 shadow-[4px_4px_0px_white]">
                <Skull size={24} />
              </div>

              <div>
                <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">
                  REACTOR<br />DISINTEGRATED
                </h1>
                <p className="text-xs font-mono font-black tracking-[0.25em] text-[#ff007a] mt-2 uppercase">
                  SHIP CORES COLD • SECTOR LOSS TERMINATED
                </p>
              </div>

              {/* Tally Metrics Box layout */}
              <div className="grid grid-cols-2 gap-3 bg-black border-2 border-white/10 p-5 text-left font-mono">
                <div className="flex flex-col gap-1 border-r border-white/10 pr-2">
                  <span className="text-[9px] text-white/40 font-bold tracking-wider uppercase">FINAL RATING:</span>
                  <span className="text-xl font-black text-white">{playerStats.score.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1 pl-2">
                  <span className="text-[9px] text-white/40 font-bold tracking-wider uppercase">SECTOR REACH:</span>
                  <span className="text-xl font-black text-[#00f3ff]">LVL {playerStats.level}</span>
                </div>
                <div className="flex flex-col gap-1 border-t border-white/10 pr-2 pt-3 mt-1">
                  <span className="text-[9px] text-white/40 font-bold tracking-wider uppercase">ROUGES PURGED:</span>
                  <span className="text-xs font-black text-[#ff007a]">{playerStats.kills} PURGES</span>
                </div>
                <div className="flex flex-col gap-1 pl-2 border-t border-white/10 pt-3 mt-1">
                  <span className="text-[9px] text-white/40 font-bold tracking-wider uppercase">MATRIX APEX:</span>
                  <span className="text-xs font-black text-white">{Math.max(highScore, playerStats.score).toLocaleString()} PTS</span>
                </div>
              </div>

              {/* Trigger Replay */}
              <button
                id="btn-restart-game"
                onClick={onRestart}
                className="w-full py-4 bg-white text-black font-black text-sm tracking-[0.2em] uppercase hover:bg-[#00f3ff] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[6px_6px_0px_#ff007a] border-2 border-black"
              >
                <RotateCcw size={15} />
                ENGAGE NEW CORE REACT
              </button>

              {/* Achievements alerts list */}
              <button
                onClick={onShowAchievements}
                className="py-2 px-4 bg-black border border-white/20 hover:border-white text-white/60 hover:text-white text-xs font-mono flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                CHECK POLARITY BADGES
              </button>

            </div>
          </motion.div>
        )}

        {/* --- SCREEN D: INSTANT PAUSE CARD --- */}
        {gameState === 'PAUSED' && (
          <motion.div
            key="screen-paused"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="paused-overlay animate-fade"
            className="absolute inset-0 bg-black/95 pointer-events-auto flex flex-col items-center justify-center p-6 z-20 select-none text-center"
          >
            <div className="max-w-sm w-full bg-black border-2 border-white/10 p-6 flex flex-col gap-5">
              
              <div>
                <span className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2 text-[#00f3ff]">
                  <Pause size={18} />
                </span>
                <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
                  REACTOR STANDBY
                </h2>
                <p className="text-[10px] font-mono tracking-widest text-[#ff007a] uppercase mt-1">
                  Simulation temporarily paused.
                </p>
              </div>

              {/* Pause telemetry stat list */}
              <div className="bg-black border border-white/5 p-3 text-left font-mono text-xs flex flex-col gap-2">
                <div className="flex justify-between items-center text-white/50">
                  <span className="font-bold tracking-widest">DAMAGE MODIFIER:</span>
                  <span className="text-white font-black">x{(playerStats.damageMultiplier).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-white/50">
                  <span className="font-bold tracking-widest">MAGNET TRACTION:</span>
                  <span className="text-white font-black">{playerStats.magnetRange}px</span>
                </div>
                <div className="flex justify-between items-center text-white/50">
                  <span className="font-bold tracking-widest">DEFENSE CRIT CHANCE:</span>
                  <span className="text-white font-black">{Math.round(playerStats.critChance * 100)}%</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  id="btn-resume-game"
                  onClick={onPauseToggle}
                  className="w-full py-3 bg-white text-black font-black text-xs tracking-widest uppercase hover:bg-[#00f3ff] transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-black shadow-[4px_4px_0px_#ff007a]"
                >
                  <Play size={12} className="fill-current" />
                  RESUME ENGINE
                </button>
                <button
                  onClick={onRestart}
                  className="w-full py-2 bg-black border border-white/20 text-white/60 hover:text-white text-xs font-mono font-black tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <RotateCcw size={12} />
                  QUIT & RESTART
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- SCREEN E: PERSISTENT ACHIEVEMENTS ARCHIVE OVERLAY --- */}
        {gameState === 'ACHIEVEMENTS' && (
          <motion.div
            key="screen-achievements"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="achievements-archive-overlay"
            className="absolute inset-0 bg-black/95 pointer-events-auto flex flex-col items-center justify-center p-4 md:p-6 z-30 select-none overflow-y-auto"
          >
            <div className="max-w-xl w-full bg-black border-2 border-white/10 p-5 md:p-6 flex flex-col gap-4 shadow-2xl max-h-[92%] overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 border border-white/10 text-[#00f3ff]">
                    <Award size={18} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-black italic tracking-tighter text-white uppercase leading-none">
                      PILOT BADGE ARCHIVES
                    </h2>
                    <p className="text-[10px] font-mono text-white/40 tracking-wider uppercase mt-1">
                      Persistent rewards unlocked through simulation runs.
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={onHideAchievements}
                  className="px-3.5 py-1.5 text-xs font-sans font-black text-black bg-white hover:bg-[#ff007a] hover:text-white cursor-pointer transition-all uppercase tracking-widest"
                >
                  CLOSE
                </button>
              </div>

              {/* Scrollable grid list */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {achievements.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-3 border flex items-center justify-between gap-4 transition-all ${
                      badge.unlocked 
                        ? 'bg-[#0a0a0c] border-[#ff007a]/40 shadow-[2px_2px_0px_#ff007a]' 
                        : 'bg-black/40 border-white/5 text-white/40 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 border text-sm flex items-center justify-center shrink-0 ${
                        badge.unlocked 
                          ? 'bg-black border-[#ff007a] text-[#ff007a]' 
                          : 'bg-black border-white/5 text-white/20'
                      }`}>
                        <Trophy size={16} />
                      </div>
                      
                      <div className="text-left">
                        <h4 className={`text-xs font-black tracking-wide uppercase ${badge.unlocked ? 'text-white' : 'text-white/40'}`}>
                          {badge.title}
                        </h4>
                        <p className="text-[10px] text-white/50 mt-0.5 leading-snug font-serif italic">
                          {badge.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {badge.unlocked ? (
                        <span className="text-[8px] font-mono font-black text-[#00f3ff] bg-[#00f3ff]/10 border border-[#00f3ff]/20 px-2 py-0.5 uppercase tracking-wider">
                          UNLOCKED
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1 items-end min-w-[70px]">
                          <span className="text-[8px] font-mono text-white/40 font-black tracking-widest uppercase">PROGRESS</span>
                          <div className="w-16 h-1 w-full bg-white/5 border border-white/10 overflow-hidden">
                            <div 
                              className="h-full bg-white/40"
                              style={{ width: `${(badge.currentCount / badge.targetCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="text-[10px] text-center font-mono font-black text-white/40 tracking-widest uppercase pt-2 border-t border-white/10">
                ⭐ {achievements.filter(b => b.unlocked).length} / {achievements.length} OVERALL RECORDS ACHIEVED
              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* 3. RUNNING HUD FOOTER BAR (ACTIVE EQUIPPED WEAPONS LIST) */}
      {gameState === 'PLAYING' && (
        <div id="in-game-bottom-hud" className="w-full p-4 bg-black/80 border-t border-white/10 pointer-events-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pr-2 scrollbar-none max-w-full">
            <span className="text-[9px] font-mono font-black tracking-widest text-[#ff007a] uppercase flex items-center gap-1 shrink-0 bg-white/5 border border-white/5 px-2.5 py-1">
              <Cpu size={10} /> ACTIVE LOADOUT MODULES:
            </span>
            {activeWeapons.map((weapon) => {
              // Retrieve matching details
              const config = [
                { id: 'laser', name: 'Pulse Laser', icon: 'zap' },
                { id: 'plasma_orbit', name: 'Plasma Orbit', icon: 'cpu' },
                { id: 'seeker_missile', name: 'Seeker Rocket', icon: 'crosshair' },
                { id: 'tesla_coil', name: 'Tesla Coil', icon: 'zap' },
                { id: 'shield_dome', name: 'Slow Shield', icon: 'shield' },
                { id: 'drone', name: 'Suport Drone', icon: 'sparkles' },
              ].find(w => w.id === weapon.id);

              return (
                <div 
                  key={`hud-equipped-${weapon.id}`}
                  className="px-2.5 py-1 bg-black border border-white/10 flex items-center gap-1.5 text-[10px] font-mono text-white/80 shrink-0 select-none"
                >
                  {getUpgradeIcon(config?.icon || 'sparkles', 12)}
                  <span className="font-bold text-white uppercase tracking-wider text-[9px]">{config?.name}</span>
                  <span className="bg-[#00f3ff] text-black px-1.5 py-0.5 text-[8px] font-black italic">LV {weapon.level}</span>
                </div>
              );
            })}
          </div>

          <div className="text-[9px] font-mono text-white/40 tracking-wider font-extrabold uppercase shrink-0 hidden md:block">
            🎮 MODE: <span className="text-[#00f3ff] uppercase">{controlType}</span>
          </div>
        </div>
      )}

    </div>
  );
}
