export function getLevelInfo(xp: number = 0) {
  const level = Math.floor(Math.sqrt(xp) / 5) + 1;
  const currentLvlXp = Math.pow((level - 1) * 5, 2);
  const nextLvlXp = Math.pow(level * 5, 2);
  
  const xpInCurrentLvl = xp - currentLvlXp;
  const xpNeeded = nextLvlXp - currentLvlXp;
  const progressPercent = Math.min(100, Math.max(0, (xpInCurrentLvl / xpNeeded) * 100));

  return {
    level,
    xp,
    nextLvlXp,
    xpNeeded,
    xpToNext: nextLvlXp - xp,
    progressPercent
  };
}
