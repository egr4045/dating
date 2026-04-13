export const BADGES: Record<string, { label: string; icon: string; desc: string }> = {
  FIRST_MATCH: { label: 'Первый лед тронулся', icon: '🥳', desc: 'За первую встречу' },
  FULL_PROFILE: { label: 'Анфас и профиль', icon: '✨', desc: 'За заполненную на 100% анкету' },
  PERFECT_RATING: { label: 'Эталон', icon: '🌟', desc: 'За идеальную репутацию 5.0' },
};

export function getBadge(badgeId: string) {
  return BADGES[badgeId] || { label: badgeId, icon: '🏆', desc: 'Секретное достижение' };
}
