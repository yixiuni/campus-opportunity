import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { AuthService } from './auth/auth.service';

describe('Opportunity lifecycle and ownership', () => {
  let app: INestApplication;
  let db: PrismaService;
  const owner = `op-test-${randomUUID()}`;
  const other = `op-test-${randomUUID()}`;
  const token = randomBytes(32).toString('hex');
  const otherToken = randomBytes(32).toString('hex');
  const content = { title: '测试机会', description: '数据库持久化测试', category: 'study', commitment: '每周 2 小时 · 8 周', location: '图书馆', tags: ['调研'], deadline: '2099-12-31' };
  let draftId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    db = app.get(PrismaService);
    const auth = app.get(AuthService);
    for (const [id, credential] of [[owner, token], [other, otherToken]]) {
      await db.user.create({ data: { id, displayName: '发布测试用户', role: 'STUDENT', roleLabel: '学生', college: '测试学院',
        sessions: { create: { tokenHash: auth.hash(credential), expiresAt: new Date(Date.now() + 120_000) } },
      } });
    }
  });
  afterAll(async () => {
    if (db) {
      await db.opportunity.deleteMany({ where: { publisherId: { in: [owner, other] } } });
      await db.user.deleteMany({ where: { id: { in: [owner, other] } } });
    }
    await app?.close();
  });

  it('requires login for creation, editing and lifecycle actions', async () => {
    await request(app.getHttpServer()).post('/api/opportunities').send({ intent: 'draft' }).expect(401);
    await request(app.getHttpServer()).patch('/api/opportunities/any').send(content).expect(401);
    await request(app.getHttpServer()).post('/api/opportunities/any/close').expect(401);
  });

  it('saves an incomplete private draft with no fabricated date', async () => {
    const result = await request(app.getHttpServer()).post('/api/opportunities').auth(token, { type: 'bearer' }).send({ intent: 'draft' }).expect(201);
    draftId = result.body.id;
    expect(result.body).toMatchObject({ status: 'DRAFT', deadline: null, publisherId: owner, applicants: 0 });
    await request(app.getHttpServer()).get(`/api/opportunities/${draftId}`).expect(404);
    await request(app.getHttpServer()).get(`/api/me/opportunities/${draftId}`).auth(token, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).post(`/api/opportunities/${draftId}/publish`).auth(token, { type: 'bearer' }).expect(400);
  });

  it('rejects foreign ownership and privileged field injection', async () => {
    for (const action of ['publish', 'close']) {
      await request(app.getHttpServer()).post(`/api/opportunities/${draftId}/${action}`).auth(otherToken, { type: 'bearer' }).expect(404);
    }
    await request(app.getHttpServer()).patch(`/api/opportunities/${draftId}`).auth(otherToken, { type: 'bearer' }).send(content).expect(404);
    for (const body of [{ publisherId: other }, { applicants: 100 }, { featured: true }, { status: 'OPEN' }]) {
      await request(app.getHttpServer()).patch(`/api/opportunities/${draftId}`).auth(token, { type: 'bearer' }).send(body).expect(400);
      await request(app.getHttpServer()).post('/api/opportunities').auth(token, { type: 'bearer' }).send({ ...content, intent: 'publish', ...body }).expect(400);
    }
  });

  it('validates categories, sizes and real calendar dates server-side', async () => {
    for (const invalid of [{ category: 'invalid' }, { category: 'constructor' }, { title: 'a'.repeat(61) },
      { description: 'a'.repeat(501) }, { tags: Array(9).fill('tag') }, { deadline: '2027-02-29' }, { deadline: '2000-01-01' }, { deadline: null }]) {
      await request(app.getHttpServer()).post('/api/opportunities').auth(token, { type: 'bearer' }).send({ ...content, intent: 'publish', ...invalid }).expect(400);
    }
  });

  it('publishes a completed draft exactly once under concurrent requests', async () => {
    await request(app.getHttpServer()).patch(`/api/opportunities/${draftId}`).auth(token, { type: 'bearer' }).send(content).expect(200);
    const results = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post(`/api/opportunities/${draftId}/publish`).auth(token, { type: 'bearer' })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const detail = await request(app.getHttpServer()).get(`/api/opportunities/${draftId}`).expect(200);
    expect(detail.body).toMatchObject({ title: content.title, category: 'study', applicants: 0, deadline: '2099-12-31' });
    const list = await request(app.getHttpServer()).get('/api/opportunities').expect(200);
    expect(list.body.some((item: { id: string }) => item.id === draftId)).toBe(true);
  });

  it('propagates edits to public details and prevents invalid open content', async () => {
    await request(app.getHttpServer()).patch(`/api/opportunities/${draftId}`).auth(token, { type: 'bearer' }).send({ title: '修改后的机会', category: 'research', tags: ['Python'] }).expect(200);
    const detail = await request(app.getHttpServer()).get(`/api/opportunities/${draftId}`).expect(200);
    expect(detail.body).toMatchObject({ title: '修改后的机会', category: 'research', tags: ['Python'] });
    await request(app.getHttpServer()).patch(`/api/opportunities/${draftId}`).auth(token, { type: 'bearer' }).send({ title: '' }).expect(400);
  });

  it('closes recruitment without deleting history and disallows reopening', async () => {
    await request(app.getHttpServer()).post(`/api/opportunities/${draftId}/close`).auth(token, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get(`/api/opportunities/${draftId}`).expect(404);
    expect((await db.opportunity.findUniqueOrThrow({ where: { id: draftId } })).status).toBe('CLOSED');
    await request(app.getHttpServer()).post(`/api/opportunities/${draftId}/publish`).auth(token, { type: 'bearer' }).expect(409);
    await request(app.getHttpServer()).patch(`/api/opportunities/${draftId}`).auth(token, { type: 'bearer' }).send({ title: '不能修改' }).expect(409);
  });

  it('creates directly published opportunities and filters expired records', async () => {
    const result = await request(app.getHttpServer()).post('/api/opportunities').auth(token, { type: 'bearer' }).send({ ...content, intent: 'publish' }).expect(201);
    expect(result.body.status).toBe('OPEN');
    await db.opportunity.update({ where: { id: result.body.id }, data: { deadline: new Date('2000-01-01') } });
    await request(app.getHttpServer()).get(`/api/opportunities/${result.body.id}`).expect(404);
    const list = await request(app.getHttpServer()).get('/api/opportunities').expect(200);
    expect(list.body.some((item: { id: string }) => item.id === result.body.id)).toBe(false);
    await request(app.getHttpServer()).get(`/api/me/opportunities/${result.body.id}`).auth(token, { type: 'bearer' }).expect(200);
  });
});
