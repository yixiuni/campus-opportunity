import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'vue/compiler-sfc';
import { applicationCard } from '../src/api/applications.ts';

const source = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const ast = parse(source).descriptor.template.ast;
const hash = value => createHash('sha256').update(value).digest('hex');
function find(node, name) {
  if (node.type === 1 && node.props.some(p => p.name === 'class' && p.value?.content.split(' ').includes(name))) return node;
  return (node.children ?? []).map(child => find(child, name)).find(Boolean);
}
function shape(node) {
  return [node.tag, node.props?.find(p => p.name === 'class')?.value?.content ?? '',
    ...(node.children ?? []).filter(child => child.type === 1).map(shape)];
}

// Tag hierarchy + static CSS classes captured from the user-approved blue UI at a4f36da.
// Bindings/events/text are deliberately excluded: live backend data is not demo content.
const baseline = {
  'detail-content': '1541614e9d60ab73917947d6c5d770a60df37d7bbc3f5495320c531adc4d3501',
  'detail-nav': 'ba9a62fc6ad4fd24af48c39a1439a48f6feb4037d95e08c359546f653131226d',
  'matching-start-visual': '311c9f9cbcdc77d6621e28f104ee6168d6543b1787fee714f6c2c216df08cf08',
  'publish-form': '850b54bbeae55108b431b48146bcd488e4739aaa0b8f909fe71cfae3d1140cd9',
  'mobile-nav': '762d888a160fa0eea6d4bcc6167a797f89cae144006d1f6b6df36d36ed231f36',
  'mobile-home': 'b7dd5c210e92ff43a6bb9064b5538b33eb231362be45bad72b8e5975f14d9e46',
  'opportunity-card': 'fe7b418d80899441227061c1968488608381849d676b43a34d6169edb9a9e1f5',
  'matching-start-card': '2673e45ad5f58e906f840717b4334831c315fd013a30dd669648077ca47818c5',
  'matching-person-card': '6cb5f23014873daf2d6e65cfe0363c196a0e193360a49fa2f739a73b74bb2460',
  'profile-identity-card': 'b5204f6c3215e99df138609e1951464ae17b5350ea7d07c69a2e0bc9175bda58',
  'profile-data-strip': '4629b59a57cc846bac399826399698b3a3aa47f7cbc9d4d90cb6dde87460df06',
  'profile-resume-card': 'b47f900cd18a2b5f6ab00190bb5d68ac49a655cefaa51cb237def1963b1f1ad9',
  'profile-menu-card': 'ff303836e9fbfe826f44d83a84cc6418dcc844374e85375cd306c628b4cbec0b',
  'application-role-switch': '046111c4987bb06682137f3215403dcd37d2b212b350f7737bf9052c55b97056',
  'application-record-card': 'a79e3b08f32626399c94d324292e8c199774b8e9101b26d1913abca7c69ef919',
  'publisher-application-card': 'b957556e37307394c32bc8c80d43906c6ae09b7c3f583eb44a2e91a90a5e519d',
};
for (const [name, expected] of Object.entries(baseline)) {
  test(`preserve approved ${name} structure`, () => {
    const node = find(ast, name);
    assert.ok(node, `Missing ${name}`);
    assert.equal(hash(JSON.stringify(shape(node))), expected);
  });
}
test('preserve the approved stylesheet and remove the later card footer override', () => {
  assert.equal(hash(readFileSync(new URL('../src/style.css', import.meta.url))), '142ec9c1cc43295c3a9bc51a32e41bdf0db45e72f7d5796e2b86362996f84806');
  const extra = readFileSync(new URL('../src/applications.css', import.meta.url), 'utf8');
  assert.doesNotMatch(extra, /\.application-record-card\s+footer/);
});

const applicant = { id: 'student', displayName: '林同学', college: '人工智能学院', role: 'STUDENT', roleLabel: '本科生', avatar: null };
const teacher = { ...applicant, id: 'teacher', displayName: '张老师', role: 'TEACHER', roleLabel: '副教授' };
const record = {
  id: 'application', kind: 'OPPORTUNITY', applicantId: applicant.id, applicant,
  targetUserId: null, targetUser: null, opportunityId: 'opportunity',
  opportunity: { id: 'opportunity', title: '校园项目', category: 'PROJECT', publisherId: teacher.id, publisher: teacher, status: 'OPEN', deadline: null },
  status: 'PENDING', note: '申请说明'.repeat(40), sendProfile: false, profileSnapshot: null, createdAt: '2026-09-14T00:00:00Z',
};
for (const kind of ['OPPORTUNITY', 'MATCH']) {
  for (const status of ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN']) {
    test(`${kind} ${status}: progress stays separate from long application notes`, () => {
      const item = { ...record, kind, status, ...(kind === 'MATCH' ? { opportunity: null, opportunityId: null, targetUserId: teacher.id, targetUser: teacher } : {}) };
      const card = applicationCard(item);
      assert.equal(card.note, record.note);
      assert.notEqual(card.update, card.note);
      assert.ok(card.update.length < 40);
      assert.equal(card.status, status === 'PENDING' ? 'pending' : status === 'APPROVED' ? 'approved' : 'closed');
      if (kind === 'MATCH') assert.equal(card.title, '希望与张老师建立联系');
      const received = applicationCard(item, true);
      assert.equal(received.applicant, '林同学');
      assert.deepEqual(received.tags, []);
      assert.equal(received.hasProfile, false);
    });
  }
}
test('only attached snapshots supply tags; empty notes still have status text', () => {
  const card = applicationCard({ ...record, note: '', sendProfile: true, profileSnapshot: { headline: '前端', introduction: '介绍', tags: ['Vue'], availability: '周末' } }, true);
  assert.deepEqual(card.tags, ['Vue']);
  assert.equal(card.hasProfile, true);
  assert.ok(card.update);
});
