import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { AuthService } from './auth/auth.service';
import { matchingDay, matchingScore } from './matching-policy';
import { MatchingService } from './matching.service';

describe('Personal matching quota and requests', () => {
  let app: INestApplication;
  let db: PrismaService;
  const ids: string[] = [];
  let caller: { id: string; token: string };
  let other: { id: string; token: string };
  let roundId: string;
  let targetId: string;
  let requestId: string;
  let disabledId: string;
  const tokenById = new Map<string, string>();
  const api = () => request(app.getHttpServer());
  const auth = (query: request.Test, id = caller.id) => query.auth(tokenById.get(id)!, { type: 'bearer' });
  async function user(role: 'TEACHER' | 'STUDENT' | 'ADMIN' = 'STUDENT', enabled = true) {
    const id = `matching-test-${randomUUID()}`;
    ids.push(id);
    const token = randomBytes(32).toString('hex');
    tokenById.set(id, token);
    await db.user.create({ data: { id, role, displayName: '匹配测试账号', roleLabel: role, college: '测试学院', contact: `secret-${id}`,
      profile: { create: { headline: 'quasar 项目', introduction: 'quasar Python 前端技术交流', tags: ['quasar', 'Python'], availability: '周末', matchingEnabled: enabled } },
      sessions: { create: { tokenHash: app.get(AuthService).hash(token), expiresAt: new Date(Date.now() + 600_000) } },
    } });
    return { id, token };
  }
  const round = (id = caller.id, key = randomUUID(), requirement = 'quasar') => auth(api().post('/api/matching/rounds'), id).send({ requirement, requestId: key });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    db = app.get(PrismaService);
    caller = await user();
    other = await user();
    for (let index = 0; index < 3; index++) await user('TEACHER');
    for (let index = 0; index < 3; index++) await user();
    disabledId = (await user('TEACHER', false)).id;
  });
  afterAll(async () => {
    if (db) {
      await db.application.deleteMany({ where: { OR: [{ applicantId: { in: ids } }, { targetUserId: { in: ids } }] } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('uses China calendar days and explainable deterministic relevance scores', () => {
    expect(matchingDay(new Date('2026-09-14T15:59:59Z'))).toBe('2026-09-14');
    expect(matchingDay(new Date('2026-09-14T16:00:00Z'))).toBe('2026-09-15');
    expect(matchingScore('前端Python', ['Python'], { headline: '前端', introduction: 'Python', tags: ['Python'] })).toBe(100);
    expect(matchingScore('科研', [], { headline: '设计', introduction: '', tags: [] })).toBe(0);
  });

  it('requires login, rejects more than 20 code points and disallows disabled users', async () => {
    await api().get('/api/matching/status').expect(401);
    await api().post('/api/matching/rounds').send({ requirement: '', requestId: randomUUID() }).expect(401);
    await round(caller.id, randomUUID(), '字'.repeat(21)).expect(400);
    await round(caller.id, randomUUID(), '😀'.repeat(21)).expect(400);
    await auth(api().post('/api/matching/rounds')).send({ requirement: '', requestId: randomUUID(), used: 0 }).expect(400);
    await round(disabledId).expect(403);
    const admin = await user('ADMIN');
    await round(admin.id).expect(403);
  });

  it('creates max 2 teachers and 3 students, no self/disabled identities or contacts', async () => {
    const key = randomUUID();
    const result = await round(caller.id, key).expect(201);
    roundId = result.body.round.id;
    targetId = result.body.round.people.find((person: { id: string }) => tokenById.has(person.id)).id;
    expect(result.body).toMatchObject({ used: 1, remaining: 2 });
    expect(result.body.round.people.filter((person: { role: string }) => person.role === 'teacher')).toHaveLength(2);
    expect(result.body.round.people.filter((person: { role: string }) => person.role === 'student')).toHaveLength(3);
    expect(result.body.round.people.some((person: { id: string }) => [caller.id, disabledId].includes(person.id))).toBe(false);
    expect(JSON.stringify(result.body)).not.toContain('secret-');
    const retry = await round(caller.id, key).expect(201);
    expect(retry.body.round.id).toBe(roundId);
    expect(retry.body.used).toBe(1);
    await round(caller.id, key, 'changed').expect(409);
  });

  it('enforces exactly 3 rounds across concurrent distinct requests and repeated reads', async () => {
    const responses = await Promise.all([1, 2, 3, 4].map(() => round()));
    expect(responses.map(result => result.status).sort()).toEqual([201, 201, 429, 429]);
    const status = await auth(api().get('/api/matching/status')).expect(200);
    expect(status.body).toMatchObject({ used: 3, remaining: 0 });
    await round().expect(429);
    expect(await db.matchRound.count({ where: { userId: caller.id } })).toBe(3);
  });

  it('reflects current profile edits and immediately filters opted-out cards on reads', async () => {
    await db.profile.update({ where: { userId: targetId }, data: { headline: '更新后的真实卡片' } });
    const service = app.get(MatchingService);
    const stored = await db.matchRound.findUniqueOrThrow({ where: { id: roundId } });
    const updated = await service.create(caller.id, { requirement: stored.requirement, requestId: stored.requestId });
    expect(updated.round!.people.find(person => person.id === targetId)?.focus).toBe('更新后的真实卡片');
    await db.profile.update({ where: { userId: targetId }, data: { matchingEnabled: false } });
    const hidden = await service.create(caller.id, { requirement: stored.requirement, requestId: stored.requestId });
    expect(hidden.round!.people.some(person => person.id === targetId)).toBe(false);
    await auth(api().post('/api/matching/requests')).send({ targetUserId: targetId, roundId, note: '交流', sendProfile: true }).expect(403);
    await db.profile.update({ where: { userId: targetId }, data: { matchingEnabled: true } });
  });

  it('requires own current-day candidate membership and a nonempty intent', async () => {
    const body = { targetUserId: targetId, roundId, note: '希望交流 quasar', sendProfile: true };
    await auth(api().post('/api/matching/requests'), other.id).send(body).expect(404);
    await auth(api().post('/api/matching/requests')).send({ ...body, note: '' }).expect(400);
    await auth(api().post('/api/matching/requests')).send({ ...body, targetUserId: caller.id }).expect(400);
    await auth(api().post('/api/matching/requests')).send({ ...body, applicantId: targetId }).expect(400);
    const results = await Promise.all([1, 2].map(() => auth(api().post('/api/matching/requests')).send(body)));
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    requestId = results.find(result => result.status === 201)!.body.id;
  });

  it('routes matching requests to the same received list and protects profile snapshots', async () => {
    const received = await auth(api().get('/api/me/applications?direction=received'), targetId).expect(200);
    const item = received.body.find((record: { id: string }) => record.id === requestId);
    expect(item).toMatchObject({ kind: 'MATCH', targetUserId: targetId, opportunity: null });
    expect(item.profileSnapshot.introduction).toBe('quasar Python 前端技术交流');
    expect(JSON.stringify(item)).not.toContain('secret-');
    await auth(api().get(`/api/applications/${requestId}`), other.id).expect(404);
    await auth(api().get(`/api/applications/${requestId}/contact`)).expect(403);
    await auth(api().patch(`/api/applications/${requestId}`)).send({ note: '更新来意', sendProfile: false }).expect(200);
    const detail = await auth(api().get(`/api/applications/${requestId}`), targetId).expect(200);
    expect(detail.body.profileSnapshot).toBeNull();
  });

  it('permits only the recipient to approve and suspends matching contacts when opted out', async () => {
    await auth(api().post(`/api/applications/${requestId}/review`)).send({ decision: 'approve' }).expect(404);
    await auth(api().post(`/api/applications/${requestId}/review`), targetId).send({ decision: 'approve' }).expect(200);
    const contact = await auth(api().get(`/api/applications/${requestId}/contact`)).expect(200);
    expect(contact.body.contact).toBe(`secret-${targetId}`);
    await db.profile.update({ where: { userId: targetId }, data: { matchingEnabled: false } });
    await auth(api().get(`/api/applications/${requestId}/contact`)).expect(403);
    await db.profile.update({ where: { userId: targetId }, data: { matchingEnabled: true } });
    await auth(api().post(`/api/applications/${requestId}/withdraw`)).expect(200);
    await auth(api().get(`/api/applications/${requestId}/contact`), targetId).expect(403);
  });

  it('does not count old-day rounds toward the new day', async () => {
    const person = await user();
    for (let ordinal = 1; ordinal <= 3; ordinal++) await db.matchRound.create({ data: { userId: person.id, day: '2000-01-01', ordinal, requestId: randomUUID(), requirement: '' } });
    const status = await auth(api().get('/api/matching/status'), person.id).expect(200);
    expect(status.body).toMatchObject({ used: 0, remaining: 3 });
    await round(person.id).expect(201);
  });

  it('counts simultaneous retries with the same key only once', async () => {
    const person = await user();
    const key = randomUUID();
    const responses = await Promise.all([1, 2, 3].map(() => round(person.id, key)));
    expect(responses.map(result => result.status)).toEqual([201, 201, 201]);
    expect(new Set(responses.map(result => result.body.round.id)).size).toBe(1);
    expect(await db.matchRound.count({ where: { userId: person.id } })).toBe(1);
  });

  it('deduplicates reciprocal requests and blocks approval after either user opts out', async () => {
    const first = await user();
    const second = await user();
    const makeRound = (from: string, to: string) => db.matchRound.create({ data: { userId: from, day: matchingDay(), ordinal: 1, requestId: randomUUID(), requirement: '', candidates: { create: { userId: to, rank: 0, score: 0 } } } });
    const [a, b] = await Promise.all([makeRound(first.id, second.id), makeRound(second.id, first.id)]);
    const results = await Promise.all([
      auth(api().post('/api/matching/requests'), first.id).send({ roundId: a.id, targetUserId: second.id, note: '一起交流', sendProfile: false }),
      auth(api().post('/api/matching/requests'), second.id).send({ roundId: b.id, targetUserId: first.id, note: '一起交流', sendProfile: false }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    const created = results.find(result => result.status === 201)!.body;
    await db.profile.update({ where: { userId: created.applicantId }, data: { matchingEnabled: false } });
    await auth(api().post(`/api/applications/${created.id}/review`), created.targetUserId).send({ decision: 'approve' }).expect(403);
    await auth(api().post(`/api/applications/${created.id}/review`), created.targetUserId).send({ decision: 'reject' }).expect(200);
    await auth(api().get(`/api/applications/${created.id}/contact`), created.targetUserId).expect(403);
  });

  it('does not consume quota with no available peers and blocks old-round requests', async () => {
    const person = await user();
    const candidates = await db.user.findMany({ where: { id: { not: person.id }, role: { in: ['TEACHER', 'STUDENT'] }, profile: { matchingEnabled: true, headline: { not: '' }, introduction: { not: '' } } }, select: { id: true } });
    for (const candidate of candidates) await db.application.create({ data: { kind: 'MATCH', applicantId: person.id, targetUserId: candidate.id, note: '测试排除历史请求', status: 'WITHDRAWN' } });
    const result = await round(person.id).expect(201);
    expect(result.body).toMatchObject({ used: 0, remaining: 3, round: null });
    expect(await db.matchRound.count({ where: { userId: person.id } })).toBe(0);
    const old = await db.matchRound.create({ data: { userId: person.id, day: '2000-01-01', ordinal: 1, requestId: randomUUID(), requirement: '', candidates: { create: { userId: other.id, score: 0, rank: 0 } } } });
    await auth(api().post('/api/matching/requests'), person.id).send({ roundId: old.id, targetUserId: other.id, note: '旧结果', sendProfile: false }).expect(404);
  });
});
