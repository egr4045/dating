import { describe, it, expect } from 'vitest';
import { BADGES, getBadge } from './badges';

describe('BADGES константа', () => {
  it('содержит ключ FIRST_MATCH', () => {
    expect(BADGES).toHaveProperty('FIRST_MATCH');
  });

  it('содержит ключ FULL_PROFILE', () => {
    expect(BADGES).toHaveProperty('FULL_PROFILE');
  });

  it('содержит ключ PERFECT_RATING', () => {
    expect(BADGES).toHaveProperty('PERFECT_RATING');
  });

  it('каждый бейдж имеет поля label, icon, desc', () => {
    for (const [, badge] of Object.entries(BADGES)) {
      expect(badge).toHaveProperty('label');
      expect(badge).toHaveProperty('icon');
      expect(badge).toHaveProperty('desc');
      expect(typeof badge.label).toBe('string');
      expect(typeof badge.icon).toBe('string');
      expect(typeof badge.desc).toBe('string');
    }
  });

  it('поля не пустые строки', () => {
    for (const [, badge] of Object.entries(BADGES)) {
      expect(badge.label.length).toBeGreaterThan(0);
      expect(badge.icon.length).toBeGreaterThan(0);
      expect(badge.desc.length).toBeGreaterThan(0);
    }
  });
});

describe('getBadge', () => {
  it('FIRST_MATCH → возвращает корректный объект', () => {
    const b = getBadge('FIRST_MATCH');
    expect(b.label).toBe('Первый лед тронулся');
    expect(b.icon).toBe('🥳');
    expect(b.desc).toBe('За первую встречу');
  });

  it('FULL_PROFILE → возвращает корректный объект', () => {
    const b = getBadge('FULL_PROFILE');
    expect(b.label).toBe('Анфас и профиль');
    expect(b.icon).toBe('✨');
  });

  it('PERFECT_RATING → возвращает корректный объект', () => {
    const b = getBadge('PERFECT_RATING');
    expect(b.label).toBe('Эталон');
    expect(b.icon).toBe('🌟');
  });

  it('неизвестный ключ → возвращает fallback объект (не выбрасывает)', () => {
    expect(() => getBadge('UNKNOWN_XYZ')).not.toThrow();
    const b = getBadge('UNKNOWN_XYZ');
    expect(b).toBeTruthy();
    expect(b).toHaveProperty('label');
    expect(b).toHaveProperty('icon');
    expect(b).toHaveProperty('desc');
  });

  it('fallback для неизвестного ключа содержит "Секретное достижение" в desc', () => {
    const b = getBadge('SOME_UNKNOWN_BADGE');
    expect(b.desc).toBe('Секретное достижение');
  });

  it('fallback использует иконку 🏆', () => {
    expect(getBadge('NOT_REAL').icon).toBe('🏆');
  });

  it('пустая строка → fallback', () => {
    const b = getBadge('');
    expect(b.desc).toBe('Секретное достижение');
  });
});
