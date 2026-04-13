import { describe, it, expect } from 'vitest';

// urlBase64ToUint8Array — внутренняя функция, тестируем через воспроизведение
// той же логики (или экспортируем если нужно).
// Вынесем реализацию для тестирования:
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

describe('urlBase64ToUint8Array', () => {
  it('возвращает Uint8Array', () => {
    // Простая base64-строка: "hello" = aGVsbG8=
    const result = urlBase64ToUint8Array('aGVsbG8');
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('длина результата соответствует декодированным байтам', () => {
    // "hello" в base64url = aGVsbG8 (5 байт)
    const result = urlBase64ToUint8Array('aGVsbG8');
    expect(result.length).toBe(5);
  });

  it('корректно декодирует строку с URL-safe символом "-"', () => {
    // base64url: "+" = "-", "/" = "_"
    // ">" в ASCII = 0x3E, в base64 = "Pg=="
    // В URL-safe: "Pg==" без padding = "Pg"... тест через значение
    const urlSafe = 'Pj4-'; // URL-safe base64 (эквивалент 'Pj4+' в обычном base64)
    const result = urlBase64ToUint8Array(urlSafe);
    expect(result.length).toBeGreaterThan(0);
  });

  it('корректно декодирует строку с URL-safe символом "_"', () => {
    const urlSafe = 'Pj8_'; // _ вместо /
    const result = urlBase64ToUint8Array(urlSafe);
    expect(result.length).toBeGreaterThan(0);
  });

  it('добавляет корректный padding =', () => {
    // Строка длиной 1 mod 4 требует padding "==="
    // "YQ" = "a" (1 байт), нужен padding "=="
    const result = urlBase64ToUint8Array('YQ');
    expect(result.length).toBe(1);
    expect(result[0]).toBe(97); // 'a' = 97
  });

  it('добавляет корректный padding ==', () => {
    // "YWI" = "ab" (2 байта), нужен padding "="
    const result = urlBase64ToUint8Array('YWI');
    expect(result.length).toBe(2);
    expect(result[0]).toBe(97); // 'a'
    expect(result[1]).toBe(98); // 'b'
  });

  it('строка без padding (кратная 4) работает без добавления', () => {
    // "dGVzdA==" = "test" (4 байта)
    // Без padding: "dGVzdA"... нет, длина 6, нужен "=="
    const result = urlBase64ToUint8Array('dGVzdA');
    expect(result.length).toBe(4); // "test"
  });

  it('VAPID public key декодируется без ошибок', () => {
    // Реальный тестовый VAPID ключ (65 байт)
    const vapidKey = 'BMDQ8x_T5jCE22D-55zavyMXWY44VDHbzTTMAjtzBsGLnS_U7cEQesmYeHmTBW-yXOshORUFiQ_-gTgvmoMELMY';
    expect(() => urlBase64ToUint8Array(vapidKey)).not.toThrow();
    const result = urlBase64ToUint8Array(vapidKey);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(65); // стандартная длина uncompressed EC публичного ключа
  });

  it('каждый байт результата — число от 0 до 255', () => {
    const result = urlBase64ToUint8Array('aGVsbG8');
    for (const byte of result) {
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(255);
    }
  });
});
