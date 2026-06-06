export type GameState = 'MENU' | 'PLAYING' | 'UPGRADE' | 'GAMEOVER' | 'PAUSED' | 'ACHIEVEMENTS';

export type UpgradeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: 'weapon' | 'stat';
  rarity: UpgradeRarity;
  level: number;
  maxLevel: number;
  icon: string; // lucide icon identifier
}

export interface PlayerStats {
  level: number;
  xp: number;
  nextXp: number;
  score: number;
  kills: number;
  maxHp: number;
  hp: number;
  maxShield: number;
  shield: number;
  damageMultiplier: number;
  fireRateMultiplier: number; // multiplier where higher is faster (smaller cooldowns)
  speed: number;
  magnetRange: number;
  critChance: number; // 0 to 1
  regenRate: number; // shield recharge per second
}

export interface ActiveWeaponState {
  id: string; // 'laser' | 'plasma_orbit' | 'seeker_missile' | 'tesla_coil' | 'shield_dome' | 'drone'
  level: number;
  lastFired: number; // last firing timestamp or simple delta timer in ms
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  icon: string;
  targetCount: number;
  currentCount: number;
}

export interface LocalSave {
  highScore: number;
  totalKills: number;
  totalRuns: number;
  unlockedAchievements: string[];
}
