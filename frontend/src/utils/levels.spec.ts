import { describe, it, expect } from 'vitest';
import { getLevelInfo } from './levels';

describe('getLevelInfo', () => {
  // ── Уровни ──────────────────────────────────────────────────────────────────

  it('XP=0 → level 1', () => {
    const r = getLevelInfo(0);
    expect(r.level).toBe(1);
  });

  it('XP=24 → level 1 (не дотянул до 2)', () => {
    // level = floor(sqrt(24)/5)+1 = floor(0.98)+1 = 1
    expect(getLevelInfo(24).level).toBe(1);
  });

  it('XP=25 → level 2', () => {
    // level = floor(sqrt(25)/5)+1 = floor(1)+1 = 2
    expect(getLevelInfo(25).level).toBe(2);
  });

  it('XP=99 → level 2', () => {
    // floor(sqrt(99)/5)+1 = floor(1.99)+1 = 2
    expect(getLevelInfo(99).level).toBe(2);
  });

  it('XP=100 → level 3', () => {
    // floor(sqrt(100)/5)+1 = floor(2)+1 = 3
    expect(getLevelInfo(100).level).toBe(3);
  });

  it('XP=225 → level 4', () => {
    // floor(sqrt(225)/5)+1 = floor(3)+1 = 4
    expect(getLevelInfo(225).level).toBe(4);
  });

  it('XP=400 → level 5', () => {
    // floor(sqrt(400)/5)+1 = floor(4)+1 = 5
    expect(getLevelInfo(400).level).toBe(5);
  });

  // ── Поля структуры ───────────────────────────────────────────────────────────

  it('возвращает все ожидаемые поля', () => {
    const r = getLevelInfo(50);
    expect(r).toHaveProperty('level');
    expect(r).toHaveProperty('xp');
    expect(r).toHaveProperty('nextLvlXp');
    expect(r).toHaveProperty('xpNeeded');
    expect(r).toHaveProperty('xpToNext');
    expect(r).toHaveProperty('progressPercent');
  });

  it('xp в результате совпадает с переданным', () => {
    expect(getLevelInfo(77).xp).toBe(77);
  });

  it('xpToNext > 0', () => {
    // Всегда есть куда расти
    expect(getLevelInfo(0).xpToNext).toBeGreaterThan(0);
    expect(getLevelInfo(100).xpToNext).toBeGreaterThan(0);
  });

  it('xpToNext = nextLvlXp - xp', () => {
    const r = getLevelInfo(60);
    expect(r.xpToNext).toBe(r.nextLvlXp - 60);
  });

  // ── progressPercent ──────────────────────────────────────────────────────────

  it('XP=0 → progressPercent=0', () => {
    expect(getLevelInfo(0).progressPercent).toBe(0);
  });

  it('XP на старте уровня → progressPercent=0', () => {
    // Ровно на начале уровня 2 = XP 25
    expect(getLevelInfo(25).progressPercent).toBe(0);
  });

  it('XP на ровно следующего уровня → progressPercent=100', () => {
    // Ровно на начале уровня 3 = XP 100
    expect(getLevelInfo(100).progressPercent).toBe(0);
  });

  it('progressPercent находится в диапазоне [0, 100]', () => {
    for (const xp of [0, 1, 25, 50, 100, 500, 10000]) {
      const { progressPercent } = getLevelInfo(xp);
      expect(progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressPercent).toBeLessThanOrEqual(100);
    }
  });

  it('очень большое XP → progressPercent не превышает 100', () => {
    expect(getLevelInfo(999999).progressPercent).toBeLessThanOrEqual(100);
  });

  it('progressPercent растёт с ростом XP внутри уровня', () => {
    // XP 25–99 = уровень 2, прогресс должен расти
    const p1 = getLevelInfo(30).progressPercent;
    const p2 = getLevelInfo(60).progressPercent;
    const p3 = getLevelInfo(90).progressPercent;
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
  });

  // ── Без аргумента ────────────────────────────────────────────────────────────

  it('без аргумента (default 0) → level 1', () => {
    expect(getLevelInfo().level).toBe(1);
  });
});
