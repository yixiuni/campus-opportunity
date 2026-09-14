import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { AuthService } from './auth/auth.service';

describe('Applications, snapshots and contact consent', () => {
  let app: INestApplication;
  let db: PrismaService;
  const users = ['owner', 'applicant', 'stranger'].map(role => ({ id: `application-test-${role}-${randomUUID()}`, token: randomBytes(32).toString('hex') }));
  const [owner, applicant, stranger] = users;
  let opportunityId: string;
  let applicationId: string;
  const content = { note: '希望参与项目，负责前端实现。', sendProfile: true };
  const req = () => request(app.getHttpServer());
  const auth = (query: request.Test, user = applicant) => query.auth(user.token, { type: 'bearer' });
  const createOpportunity = async () => db.opportunity.create({ data: { publisherId: owner.id, publisherLabel: '测试发起人', title: '申请测试机会', category: 'PROJECT', description: '临时测试', commitment: '', location: '', deadline: new Date('2099-12-31T15:59:59.999Z') } });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    db = app.get(PrismaService);
    const service = app.get(AuthService);
    for (const user of users) await db.user.create({ data: {
      id: user.id, displayName: '申请测试账号', college: '测试学院', roleLabel: '学生', contact: `private-${user.id}`,
      profile: { create: { headline: '原始标题', introduction: '原始个人说明', availability: '周末', tags: ['Vue'] } },
      sessions: { create: { tokenHash: service.hash(user.token), expiresAt: new Date(Date.now() + 300_000) } },
    } });
    opportunityId = (await createOpportunity()).id;
  });

  afterAll(async () => {
    if (db) {
      await db.application.deleteMany({ where: { applicantId: { in: users.map(user => user.id) } } });
      await db.opportunity.deleteMany({ where: { publisherId: owner.id } });
      await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    }
    await app?.close();
  });

  it('requires authentication and rejects invalid payloads and self applications', async () => {
    await req().post(`/api/opportunities/${opportunityId}/applications`).send(content).expect(401);
    await req().get('/api/me/applications').expect(401);
    await auth(req().post(`/api/opportunities/${opportunityId}/applications`), owner).send(content).expect(400);
    for (const invalid of [{ note: 123 }, { note: '字'.repeat(181) }, { sendProfile: 'true' }, { status: 'APPROVED' }, { applicantId: owner.id }, { profileSnapshot: {} }]) {
      await auth(req().post(`/api/opportunities/${opportunityId}/applications`)).send({ ...content, ...invalid }).expect(400);
    }
    await auth(req().get('/api/me/applications?direction=bad')).expect(400);
  });

  it('accepts only one concurrent application and counts real applications', async () => {
    const results = await Promise.all([1, 2].map(() => auth(req().post(`/api/opportunities/${opportunityId}/applications`)).send(content)));
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    applicationId = results.find(result => result.status === 201)!.body.id;
    const detail = await req().get(`/api/opportunities/${opportunityId}`).expect(200);
    expect(detail.body.applicants).toBe(1);
  });

  it('isolates sent/received records, hides contacts, and freezes profile snapshots', async () => {
    await db.profile.update({ where: { userId: applicant.id }, data: { introduction: '后续更新，不应影响旧快照' } });
    const sent = await auth(req().get('/api/me/applications?direction=sent')).expect(200);
    const received = await auth(req().get('/api/me/applications?direction=received'), owner).expect(200);
    expect(sent.body).toHaveLength(1);
    expect(received.body[0].profileSnapshot.introduction).toBe('原始个人说明');
    expect(JSON.stringify(received.body)).not.toContain('private-');
    expect(JSON.stringify(sent.body)).not.toContain('private-');
    const unrelated = await auth(req().get('/api/me/applications?direction=received'), stranger).expect(200);
    expect(unrelated.body).toHaveLength(0);
    await auth(req().get(`/api/applications/${applicationId}`), stranger).expect(404);
    await auth(req().get(`/api/applications/${applicationId}/contact`), stranger).expect(404);
    await auth(req().get(`/api/applications/${applicationId}/contact`)).expect(403);
    await auth(req().get(`/api/applications/${applicationId}/contact`), owner).expect(403);
  });

  it('edits only own pending applications and lets users remove the attached snapshot', async () => {
    await auth(req().patch(`/api/applications/${applicationId}`), owner).send(content).expect(404);
    await auth(req().patch(`/api/applications/${applicationId}`)).send({ note: '只发送申请说明', sendProfile: false }).expect(200);
    const without = await auth(req().get(`/api/applications/${applicationId}`), owner).expect(200);
    expect(without.body.profileSnapshot).toBeNull();
    expect(without.body.note).toBe('只发送申请说明');
    const restored = await auth(req().patch(`/api/applications/${applicationId}`)).send(content).expect(200);
    expect(restored.body.profileSnapshot.introduction).toBe('后续更新，不应影响旧快照');
  });

  it('only permits the publisher to decide, and permits just one concurrent decision', async () => {
    await auth(req().post(`/api/applications/${applicationId}/review`)).send({ decision: 'approve' }).expect(404);
    await auth(req().post(`/api/applications/${applicationId}/review`), stranger).send({ decision: 'approve' }).expect(404);
    await auth(req().post(`/api/applications/${applicationId}/review`), owner).send({ decision: 'approve', status: 'APPROVED' }).expect(400);
    const results = await Promise.all([1, 2].map(() => auth(req().post(`/api/applications/${applicationId}/review`), owner).send({ decision: 'approve' })));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    await auth(req().patch(`/api/applications/${applicationId}`)).send(content).expect(409);
    const detail = await auth(req().get(`/api/applications/${applicationId}`)).expect(200);
    expect(detail.body.reviewedAt).toBeTruthy();
  });

  it('opens contact access only to the two approved participants and supports clearing contact', async () => {
    const toOwner = await auth(req().get(`/api/applications/${applicationId}/contact`)).expect(200);
    expect(toOwner.body.contact).toBe(`private-${owner.id}`);
    const toApplicant = await auth(req().get(`/api/applications/${applicationId}/contact`), owner).expect(200);
    expect(toApplicant.body.contact).toBe(`private-${applicant.id}`);
    await auth(req().get(`/api/applications/${applicationId}/contact`), stranger).expect(404);
    await auth(req().patch('/api/me/contact'), owner).send({ contact: '', userId: applicant.id }).expect(400);
    await auth(req().patch('/api/me/contact'), owner).send({ contact: 'a'.repeat(121) }).expect(400);
    await auth(req().patch('/api/me/contact'), owner).send({ contact: '' }).expect(200);
    const unavailable = await auth(req().get(`/api/applications/${applicationId}/contact`)).expect(200);
    expect(unavailable.body).toMatchObject({ contact: '', available: false });
  });

  it('withdraws an approved application, revokes contact access and preserves its history', async () => {
    await auth(req().post(`/api/applications/${applicationId}/withdraw`), owner).expect(404);
    await auth(req().post(`/api/applications/${applicationId}/withdraw`)).expect(200);
    await auth(req().get(`/api/applications/${applicationId}/contact`)).expect(403);
    await auth(req().get(`/api/applications/${applicationId}/contact`), owner).expect(403);
    await auth(req().post(`/api/applications/${applicationId}/withdraw`)).expect(409);
    await auth(req().post(`/api/opportunities/${opportunityId}/applications`)).send(content).expect(409);
    const detail = await req().get(`/api/opportunities/${opportunityId}`).expect(200);
    expect(detail.body.applicants).toBe(0);
    expect(await db.application.count({ where: { id: applicationId } })).toBe(1);
  });

  it('rejects closed, draft and expired opportunities and stops late approvals', async () => {
    const opportunity = await createOpportunity();
    for (const status of ['DRAFT', 'CLOSED'] as const) {
      await db.opportunity.update({ where: { id: opportunity.id }, data: { status } });
      await auth(req().post(`/api/opportunities/${opportunity.id}/applications`)).send(content).expect(409);
    }
    await db.opportunity.update({ where: { id: opportunity.id }, data: { status: 'OPEN', deadline: new Date(0) } });
    await auth(req().post(`/api/opportunities/${opportunity.id}/applications`)).send(content).expect(409);
    await db.opportunity.update({ where: { id: opportunity.id }, data: { deadline: new Date('2099-12-31') } });
    const applied = await auth(req().post(`/api/opportunities/${opportunity.id}/applications`)).send(content).expect(201);
    await auth(req().post(`/api/opportunities/${opportunity.id}/close`), owner).expect(200);
    await auth(req().post(`/api/applications/${applied.body.id}/review`), owner).send({ decision: 'approve' }).expect(409);
    await auth(req().patch(`/api/applications/${applied.body.id}`)).send(content).expect(409);
    await auth(req().post(`/api/applications/${applied.body.id}/review`), owner).send({ decision: 'reject' }).expect(200);
    await auth(req().get(`/api/applications/${applied.body.id}/contact`)).expect(403);
  });

  it('does not retain approval after a concurrent withdrawal', async () => {
    const opportunity = await createOpportunity();
    const applied = await auth(req().post(`/api/opportunities/${opportunity.id}/applications`)).send({ ...content, sendProfile: false }).expect(201);
    const results = await Promise.all([
      auth(req().post(`/api/applications/${applied.body.id}/withdraw`)),
      auth(req().post(`/api/applications/${applied.body.id}/review`), owner).send({ decision: 'approve' }),
    ]);
    expect(results[0].status).toBe(200);
    expect([200, 409]).toContain(results[1].status);
    const final = await auth(req().get(`/api/applications/${applied.body.id}`)).expect(200);
    expect(final.body.status).toBe('WITHDRAWN');
    await auth(req().get(`/api/applications/${applied.body.id}/contact`), owner).expect(403);
  });

  it('keeps optional notes independent from profile sharing and validates missing profiles', async () => {
    const opportunity = await createOpportunity();
    await db.profile.delete({ where: { userId: stranger.id } });
    await auth(req().post(`/api/opportunities/${opportunity.id}/applications`), stranger).send({ note: '', sendProfile: true }).expect(400);
    const empty = await auth(req().post(`/api/opportunities/${opportunity.id}/applications`), stranger).send({ note: '', sendProfile: false }).expect(201);
    expect(empty.body).toMatchObject({ note: '', sendProfile: false, profileSnapshot: null });
    const publicList = await req().get('/api/opportunities').expect(200);
    expect(JSON.stringify(publicList.body)).not.toContain('private-');
    const own = await auth(req().get('/api/me'), stranger).expect(200);
    expect(own.body.contact).toBe(`private-${stranger.id}`);
  });
});
