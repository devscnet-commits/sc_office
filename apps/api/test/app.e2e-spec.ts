import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

describe('SC Office E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');

    prisma = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================
  // AUTH
  // ============================================================
  describe('POST /api/v1/auth/login', () => {
    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'notexist@test.com', password: 'wrong' });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'invalid-email', password: '123456' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health');
      expect(response.status).toBe(200);
    });
  });

  describe('Protected routes', () => {
    it('should return 401 for unauthenticated requests to /employees', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/employees');
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated requests to /templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/templates');
      expect(response.status).toBe(401);
    });
  });
});
