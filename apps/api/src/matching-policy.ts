import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const MATCH_LIMIT = 3;
export function matchingDay(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export const eligibleProfile = { matchingEnabled: true, headline: { not: '' }, introduction: { not: '' } } as const;
export function assertMatchingUser(user: { role: string; profile: { matchingEnabled: boolean; headline: string; introduction: string } | null } | null) {
  if (!user || !['STUDENT', 'TEACHER'].includes(user.role) || !user.profile?.matchingEnabled) throw new ForbiddenException('请先在设置中开启个人匹配');
  if (!user.profile.headline.trim() || !user.profile.introduction.trim()) throw new ForbiddenException('请先在“我的”完善个人说明');
}
export async function lockMatchingProfiles(tx: Prisma.TransactionClient, ids: string[]) {
  await tx.$queryRaw`SELECT user_id FROM profiles WHERE user_id IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY user_id FOR SHARE`;
  const users = await tx.user.findMany({ where: { id: { in: ids } }, include: { profile: true } });
  for (const id of ids) assertMatchingUser(users.find(user => user.id === id) ?? null);
}

function tokens(text: string) {
  const normalized = text.normalize('NFKC').toLowerCase();
  const result = new Set(normalized.match(/[a-z0-9+#.]+/g) ?? []);
  for (const segment of normalized.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (segment.length === 1) result.add(segment);
    for (let index = 0; index < segment.length - 1; index++) result.add(segment.slice(index, index + 2));
  }
  return result;
}
export function matchingScore(requirement: string, ownTags: string[], profile: { headline: string; introduction: string; tags: string[] }) {
  const wanted = tokens(requirement);
  const candidate = tokens([profile.headline, profile.introduction, ...profile.tags].join(' '));
  const shared = ownTags.filter(tag => profile.tags.some(other => other.normalize('NFKC').toLowerCase() === tag.normalize('NFKC').toLowerCase())).length;
  const tagScore = ownTags.length ? shared / ownTags.length : 0;
  const textScore = wanted.size ? [...wanted].filter(token => candidate.has(token)).length / wanted.size : 0;
  return Math.round(wanted.size ? textScore * 70 + tagScore * 30 : tagScore * 100);
}
