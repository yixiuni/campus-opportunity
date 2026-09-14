import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { Roles } from './roles.guard';

@Controller('test-only')
class RoleProbe {
  @Roles('TEACHER')
  @Get('teacher')
  teacherOnly() { return { ok: true }; }
}

describe('Account and permission boundaries (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const id = `auth-test-${randomUUID()}`;
  const token = randomBytes(32).toString('hex');
  const expiredToken = randomBytes(32).toString('hex');
  const oldNodeEnv = process.env.NODE_ENV;
  const oldDevAuth = process.env.DEV_AUTH_ENABLED;
  const issuedHashes: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_ENABLED = 'true';
    const module = await Test.createTestingModule({ imports: [AppModule], controllers: [RoleProbe] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    await prisma.user.create({ data: { id, displayName: '权限测试用户', role: 'STUDENT', roleLabel: '测试', college: '测试学院' } });
    await prisma.session.createMany({ data: [
      { userId: id, tokenHash: auth.hash(token), expiresAt: new Date(Date.now() + 60_000) },
      { userId: id, tokenHash: auth.hash(expiredToken), expiresAt: new Date(Date.now() - 1000) },
    ] });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.session.deleteMany({ where: { tokenHash: { in: issuedHashes } } });
      await prisma.user.deleteMany({ where: { id } });
    }
    await app?.close();
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldDevAuth === undefined) delete process.env.DEV_AUTH_ENABLED; else process.env.DEV_AUTH_ENABLED = oldDevAuth;
  });

  it('rejects missing, malformed, unknown and expired credentials', async () => {
    for (const header of ['', 'Bearer invalid', `Bearer ${'0'.repeat(64)}`, `Bearer ${expiredToken}`]) {
      await request(app.getHttpServer()).get('/api/me').set('Authorization', header).expect(401);
    }
  });

  it('allows public opportunities while protecting personal routes', async () => {
    await request(app.getHttpServer()).get('/api/opportunities').expect(200);
    await request(app.getHttpServer()).get('/api/me/opportunities').expect(401);
    await request(app.getHttpServer()).patch('/api/me/profile').send({ headline: '修改' }).expect(401);
  });

  it('persists the current user profile without exposing session hashes', async () => {
    const profile = { headline: '科研合作', introduction: '寻找计算机视觉合作伙伴', tags: ['Python'], availability: '每周四小时', matchingEnabled: false };
    await request(app.getHttpServer()).patch('/api/me/profile').auth(token, { type: 'bearer' }).send(profile).expect(200);
    const result = await request(app.getHttpServer()).get('/api/me').auth(token, { type: 'bearer' }).expect(200);
    expect(result.body.id).toBe(id);
    expect(result.body.profile).toMatchObject(profile);
    expect(result.body.sessions).toBeUndefined();
    expect(await prisma.profile.findUnique({ where: { userId: id } })).toMatchObject(profile);
  });

  it('rejects role escalation, changing another user, and invalid profile values', async () => {
    for (const body of [{ role: 'ADMIN' }, { userId: 'seed-user-lin' }, { matchingEnabled: 'false' },
      { headline: 'x'.repeat(33) }, { tags: Array(9).fill('tag') }, { introduction: '' }, []]) {
      await request(app.getHttpServer()).patch('/api/me/profile').auth(token, { type: 'bearer' }).send(body).expect(400);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).role).toBe('STUDENT');
  });

  it('enforces ownership on management reads', async () => {
    const result = await request(app.getHttpServer()).get('/api/me/opportunities').auth(token, { type: 'bearer' }).expect(200);
    expect(result.body).toEqual([]);
    await request(app.getHttpServer()).get('/api/me/opportunities/ai-campus-agent').auth(token, { type: 'bearer' }).expect(404);
  });

  it('uses the current database role instead of trusting client claims', async () => {
    await request(app.getHttpServer()).get('/api/test-only/teacher').auth(token, { type: 'bearer' }).expect(403);
    await prisma.user.update({ where: { id }, data: { role: 'TEACHER' } });
    await request(app.getHttpServer()).get('/api/test-only/teacher').auth(token, { type: 'bearer' }).expect(200);
  });

  it('issues random expiring credentials and permits immediate logout', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/dev/login').send({ userId: 'seed-user-lin' }).expect(200);
    const issued = response.body.accessToken;
    issuedHashes.push(auth.hash(issued));
    const stored = await prisma.session.findUniqueOrThrow({ where: { tokenHash: auth.hash(issued) } });
    expect(stored.tokenHash).not.toBe(issued);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    await request(app.getHttpServer()).get('/api/me/opportunities/ai-campus-agent').auth(issued, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/logout').auth(issued, { type: 'bearer' }).expect(204);
    await request(app.getHttpServer()).get('/api/me').auth(issued, { type: 'bearer' }).expect(401);
  });

  it('limits development login to seeded students and teachers', async () => {
    await request(app.getHttpServer()).post('/api/auth/dev/login').send({ userId: id }).expect(400);
    await request(app.getHttpServer()).post('/api/auth/dev/login').send({ userId: 'seed-user-lin', role: 'ADMIN' }).expect(400);
    const result = await request(app.getHttpServer()).get('/api/auth/dev/accounts').expect(200);
    expect(result.body.every((user: { role: string }) => ['STUDENT', 'TEACHER'].includes(user.role))).toBe(true);
  });

  it('hides development login in production even when the flag is true', async () => {
    const session = await request(app.getHttpServer()).post('/api/auth/dev/login').send({ userId: 'seed-user-lin' }).expect(200);
    issuedHashes.push(auth.hash(session.body.accessToken));
    process.env.NODE_ENV = 'production';
    try {
      await request(app.getHttpServer()).post('/api/auth/dev/login').send({ userId: 'seed-user-lin' }).expect(404);
      await request(app.getHttpServer()).get('/api/auth/dev/accounts').expect(404);
      await request(app.getHttpServer()).get('/api/me').auth(session.body.accessToken, { type: 'bearer' }).expect(401);
    } finally { process.env.NODE_ENV = 'development'; }
    process.env.DEV_AUTH_ENABLED = 'false';
    try {
      await request(app.getHttpServer()).get('/api/auth/dev/accounts').expect(404);
      await request(app.getHttpServer()).get('/api/me').auth(session.body.accessToken, { type: 'bearer' }).expect(401);
    }
    finally { process.env.DEV_AUTH_ENABLED = 'true'; }
  });
});
