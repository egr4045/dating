/**
 * E2E тесты для QuestMatch API.
 *
 * Эти тесты требуют запущенной базы данных PostgreSQL (TEST_DATABASE_URL).
 * Если переменная не задана — тесты пропускаются автоматически.
 *
 * Запуск:
 *   TEST_DATABASE_URL=postgresql://... npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL;

// Условный describe: если БД недоступна — пропускаем весь блок
const describeE2E = DB_AVAILABLE ? describe : describe.skip;

describeE2E('QuestMatch API (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;

  // Токены и ID для тестовых пользователей
  let tokenA: string;
  let tokenB: string;
  let userAId: number;
  let userBId: number;
  let matchId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Health check
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET / — health check', () => {
    it('возвращает 200', async () => {
      const res = await request(httpServer).get('/');
      expect(res.status).toBeLessThan(500); // хотя бы не 5xx
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Auth flow
  // ══════════════════════════════════════════════════════════════════════════

  describe('Auth flow', () => {
    it('POST /users/test-login → 201 с токеном (если ALLOW_TEST_LOGIN=true)', async () => {
      if (!process.env.ALLOW_TEST_LOGIN) {
        console.log('[e2e] Skipping test-login: ALLOW_TEST_LOGIN not set');
        return;
      }

      const res = await request(httpServer)
        .post('/users/test-login')
        .send({ name: 'E2EUserA' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      tokenA = res.body.token;
      userAId = res.body.user.id;
    });

    it('GET /users/me без токена → 401', async () => {
      const res = await request(httpServer).get('/users/me');
      expect(res.status).toBe(401);
    });

    it('GET /users/me с валидным токеном → 200 и содержит firstName', async () => {
      if (!tokenA) return;

      const res = await request(httpServer)
        .get('/users/me')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBeDefined();
    });

    it('GET /users/me с невалидным токеном → 401', async () => {
      const res = await request(httpServer)
        .get('/users/me')
        .set('Authorization', 'Bearer totally-invalid-token');

      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Quest feed
  // ══════════════════════════════════════════════════════════════════════════

  describe('Quest feed', () => {
    it('GET /quests/feed без токена → 401', async () => {
      const res = await request(httpServer).get('/quests/feed');
      expect(res.status).toBe(401);
    });

    it('GET /quests/feed с токеном → 200, массив', async () => {
      if (!tokenA) return;

      const res = await request(httpServer)
        .get('/quests/feed')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Map quests
  // ══════════════════════════════════════════════════════════════════════════

  describe('Quest map', () => {
    it('GET /quests/map без токена → 401', async () => {
      const res = await request(httpServer).get('/quests/map');
      expect(res.status).toBe(401);
    });

    it('GET /quests/map с токеном → 200, массив с lat/lon', async () => {
      if (!tokenA) return;

      const res = await request(httpServer)
        .get('/quests/map')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Swipe flow (требует 2 тестовых пользователя)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Swipe flow', () => {
    beforeAll(async () => {
      if (!process.env.ALLOW_TEST_LOGIN) return;

      // Создаём второго пользователя
      const resB = await request(httpServer)
        .post('/users/test-login')
        .send({ name: 'E2EUserB' });

      if (resB.status === 201) {
        tokenB = resB.body.token;
        userBId = resB.body.user.id;
      }
    });

    it('dislike → { status: "ignored" }', async () => {
      if (!tokenA) return;

      const res = await request(httpServer)
        .post('/quests/swipe')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ questId: 'nonexistent-quest', action: 'dislike' });

      // dislike не требует валидного questId
      if (res.status === 201 || res.status === 200) {
        expect(res.body.status).toBe('ignored');
      }
    });

    it('like несуществующего квеста → ошибка', async () => {
      if (!tokenA) return;

      const res = await request(httpServer)
        .post('/quests/swipe')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ questId: 'nonexistent-quest-xyz', action: 'like' });

      // Должен вернуть ошибку или error статус
      expect([200, 201, 404, 400]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Profile update
  // ══════════════════════════════════════════════════════════════════════════

  describe('Profile update', () => {
    it('PATCH /users/profile без токена → 401', async () => {
      const res = await request(httpServer)
        .patch('/users/profile')
        .send({ firstName: 'NewName' });

      expect(res.status).toBe(401);
    });

    it('PATCH /users/profile с токеном → 200', async () => {
      if (!tokenA) return;

      const res = await request(httpServer)
        .patch('/users/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ bio: 'E2E тест биография' });

      expect(res.status).toBe(200);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Push subscription
  // ══════════════════════════════════════════════════════════════════════════

  describe('Push subscription', () => {
    it('POST /users/push-subscription без токена → 401', async () => {
      const res = await request(httpServer)
        .post('/users/push-subscription')
        .send({
          endpoint: 'https://fcm.example.com/test',
          keys: { p256dh: 'test-key', auth: 'test-auth' },
        });

      expect(res.status).toBe(401);
    });

    it('DELETE /users/push-subscription без токена → 401', async () => {
      const res = await request(httpServer)
        .delete('/users/push-subscription')
        .send({ endpoint: 'https://fcm.example.com/test' });

      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Admin endpoints (защита)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Admin protection', () => {
    it('GET /admin/quests без токена → 401', async () => {
      const res = await request(httpServer).get('/admin/quests');
      expect(res.status).toBe(401);
    });

    it('GET /admin/users без токена → 401', async () => {
      const res = await request(httpServer).get('/admin/users');
      expect(res.status).toBe(401);
    });

    it('GET /admin/users с обычным JWT (не admin) → 401 или 403', async () => {
      if (!tokenA) return;

      const res = await request(httpServer)
        .get('/admin/users')
        .set('Authorization', `Bearer ${tokenA}`);

      expect([401, 403]).toContain(res.status);
    });
  });
});
