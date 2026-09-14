import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';

describe('Campus Opportunity API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a healthy status', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns seeded campus opportunities', async () => {
    const response = await request(app.getHttpServer()).get('/api/opportunities').expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.every((item: { deadline: string }) =>
      new Date(`${item.deadline}T23:59:59.999+08:00`).getTime() > Date.now())).toBe(true);
  });
});
