import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Каждый тест работает со свежим модулем — важно для сброса nextId и toasts
async function freshUseToast() {
  vi.resetModules();
  const mod = await import('./useToast');
  return mod.useToast();
}

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  // ── Создание тостов ─────────────────────────────────────────────────────────

  it('showToast добавляет тост в массив', async () => {
    const { toasts, showToast } = await freshUseToast();
    showToast('Привет', 'success');
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].message).toBe('Привет');
    expect(toasts.value[0].type).toBe('success');
  });

  it('тост получает числовой id', async () => {
    const { toasts, showToast } = await freshUseToast();
    showToast('Тест', 'info');
    expect(typeof toasts.value[0].id).toBe('number');
  });

  it('два тоста получают разные id', async () => {
    const { toasts, showToast } = await freshUseToast();
    showToast('Первый', 'info');
    showToast('Второй', 'info');
    const ids = toasts.value.map(t => t.id);
    expect(new Set(ids).size).toBe(2); // уникальные
  });

  it('несколько тостов одновременно — все в массиве', async () => {
    const { toasts, showToast } = await freshUseToast();
    showToast('A', 'success');
    showToast('B', 'error');
    showToast('C', 'warning');
    expect(toasts.value).toHaveLength(3);
  });

  // ── Тип по умолчанию ─────────────────────────────────────────────────────────

  it('без типа → type="info" по умолчанию', async () => {
    const { toasts, showToast } = await freshUseToast();
    showToast('Тест');
    expect(toasts.value[0].type).toBe('info');
  });

  // ── Обёртки ──────────────────────────────────────────────────────────────────

  it('success() создаёт тост type="success"', async () => {
    const { toasts, success } = await freshUseToast();
    success('Успех!');
    expect(toasts.value[0].type).toBe('success');
    expect(toasts.value[0].message).toBe('Успех!');
  });

  it('error() создаёт тост type="error"', async () => {
    const { toasts, error } = await freshUseToast();
    error('Ошибка!');
    expect(toasts.value[0].type).toBe('error');
  });

  it('info() создаёт тост type="info"', async () => {
    const { toasts, info } = await freshUseToast();
    info('Инфо');
    expect(toasts.value[0].type).toBe('info');
  });

  it('warning() создаёт тост type="warning"', async () => {
    const { toasts, warning } = await freshUseToast();
    warning('Внимание');
    expect(toasts.value[0].type).toBe('warning');
  });

  // ── Авто-удаление ────────────────────────────────────────────────────────────

  it('success тост исчезает через 3500мс (дефолтная длительность)', async () => {
    const { toasts, success } = await freshUseToast();
    success('Привет');
    expect(toasts.value).toHaveLength(1);

    vi.advanceTimersByTime(3499);
    expect(toasts.value).toHaveLength(1); // ещё жив

    vi.advanceTimersByTime(2);            // 3501мс итого
    expect(toasts.value).toHaveLength(0);
  });

  it('error тост исчезает через 4500мс (увеличенная длительность)', async () => {
    const { toasts, error } = await freshUseToast();
    error('Что-то сломалось');
    expect(toasts.value).toHaveLength(1);

    vi.advanceTimersByTime(4499);
    expect(toasts.value).toHaveLength(1);

    vi.advanceTimersByTime(2);
    expect(toasts.value).toHaveLength(0);
  });

  it('кастомная длительность через showToast', async () => {
    const { toasts, showToast } = await freshUseToast();
    showToast('Быстрый', 'info', 1000);

    vi.advanceTimersByTime(999);
    expect(toasts.value).toHaveLength(1);

    vi.advanceTimersByTime(2);
    expect(toasts.value).toHaveLength(0);
  });

  it('при нескольких тостах каждый удаляется по своему таймеру', async () => {
    const { toasts, showToast } = await freshUseToast();
    showToast('Быстрый', 'info', 1000);
    showToast('Медленный', 'info', 5000);

    vi.advanceTimersByTime(1001);
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].message).toBe('Медленный');

    vi.advanceTimersByTime(4001);
    expect(toasts.value).toHaveLength(0);
  });

  // ── dismiss ──────────────────────────────────────────────────────────────────

  it('dismiss(id) удаляет тост по id', async () => {
    const { toasts, showToast, dismiss } = await freshUseToast();
    showToast('Первый', 'info');
    showToast('Второй', 'info');
    const idToRemove = toasts.value[0].id;

    dismiss(idToRemove);

    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].message).toBe('Второй');
  });

  it('dismiss с несуществующим id не ломает массив', async () => {
    const { toasts, showToast, dismiss } = await freshUseToast();
    showToast('Тест', 'success');
    dismiss(9999);
    expect(toasts.value).toHaveLength(1);
  });

  it('dismiss удаляет только нужный тост, остальные остаются', async () => {
    const { toasts, showToast, dismiss } = await freshUseToast();
    showToast('A', 'success');
    showToast('B', 'error');
    showToast('C', 'info');

    const idB = toasts.value[1].id;
    dismiss(idB);

    expect(toasts.value).toHaveLength(2);
    expect(toasts.value.map(t => t.message)).toEqual(['A', 'C']);
  });
});
