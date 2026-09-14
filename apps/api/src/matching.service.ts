import { BadRequestException, ConflictException, HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from './database/prisma.service';
import { publicUserSelect } from './auth/auth.service';
import { assertMatchingUser, eligibleProfile, lockMatchingProfiles, matchingDay, matchingScore, MATCH_LIMIT } from './matching-policy';

const cardSelect = { ...publicUserSelect, profile: { select: { headline: true, introduction: true, tags: true, availability: true } } } as const;

@Injectable()
export class MatchingService {
  constructor(private readonly db: PrismaService) {}

  private async roundView(tx: Prisma.TransactionClient, id: string, userId: string) {
    const round = await tx.matchRound.findFirst({ where: { id, userId } });
    if (!round) return null;
    const entries = await tx.matchCandidate.findMany({ where: { roundId: id, user: { role: { in: ['TEACHER', 'STUDENT'] }, profile: eligibleProfile } },
      include: { user: { select: cardSelect } }, orderBy: { rank: 'asc' } });
    return { id: round.id, requestId: round.requestId, requirement: round.requirement, algorithm: round.algorithm, people: entries.map(({ user, score }) => ({
      id: user.id, name: user.displayName, avatar: user.avatar || user.displayName.slice(0, 1), role: user.role === 'TEACHER' ? 'teacher' : 'student',
      roleLabel: user.roleLabel, college: user.college, focus: user.profile!.headline, introduction: user.profile!.introduction,
      tags: user.profile!.tags, availability: user.profile!.availability, score,
    })) };
  }

  async status(userId: string) {
    const day = matchingDay();
    const user = await this.db.user.findUnique({ where: { id: userId }, include: { profile: true } });
    const enabled = Boolean(user?.profile?.matchingEnabled && ['TEACHER', 'STUDENT'].includes(user.role));
    const rounds = await this.db.matchRound.findMany({ where: { userId, day }, orderBy: { ordinal: 'desc' } });
    return { day, enabled, used: rounds.length, remaining: MATCH_LIMIT - rounds.length,
      round: enabled && rounds[0] ? await this.roundView(this.db, rounds[0].id, userId) : null };
  }

  async create(userId: string, body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('匹配需求格式错误');
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(key => !['requirement', 'requestId'].includes(key)) ||
      typeof input.requirement !== 'string' || [...input.requirement].length > 20 ||
      typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(input.requestId)) throw new BadRequestException('匹配需求最多 20 字，请提供有效请求编号');
    const requirement = input.requirement.trim();
    const requestId = input.requestId;
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const day = matchingDay();
      await lockMatchingProfiles(tx, [userId]);
      const user = await tx.user.findUnique({ where: { id: userId }, include: { profile: true } });
      assertMatchingUser(user);
      const used = await tx.matchRound.count({ where: { userId, day } });
      const existing = await tx.matchRound.findUnique({ where: { userId_requestId: { userId, requestId } } });
      if (existing) {
        if (existing.requirement !== requirement || existing.day !== day) throw new ConflictException('请求编号已使用，请重新匹配');
        return { day, used, remaining: MATCH_LIMIT - used, round: await this.roundView(tx, existing.id, userId) };
      }
      if (used >= MATCH_LIMIT) throw new HttpException('今日匹配次数已用完，明天再来', 429);
      const requested = await tx.application.findMany({ where: { kind: 'MATCH', OR: [{ applicantId: userId }, { targetUserId: userId }] }, select: { applicantId: true, targetUserId: true } });
      const excluded = new Set([userId, ...requested.map(item => item.applicantId === userId ? item.targetUserId! : item.applicantId)]);
      const seen = await tx.matchCandidate.findMany({ where: { round: { userId, day } }, select: { userId: true } });
      const seenIds = new Set(seen.map(item => item.userId));
      const candidates = await tx.user.findMany({ where: { id: { notIn: [...excluded] }, role: { in: ['TEACHER', 'STUDENT'] }, profile: eligibleProfile }, select: cardSelect });
      const ranked = candidates.map(candidate => ({ ...candidate,
        score: matchingScore(requirement, user!.profile!.tags, candidate.profile!),
        tie: createHash('sha256').update(`${userId}:${day}:${used}:${candidate.id}`).digest('hex'),
      })).sort((a, b) => Number(seenIds.has(a.id)) - Number(seenIds.has(b.id)) || b.score - a.score || a.tie.localeCompare(b.tie));
      let selected = [...ranked.filter(item => item.role === 'TEACHER').slice(0, 2), ...ranked.filter(item => item.role === 'STUDENT').slice(0, 3)];
      if (selected.length) {
        await tx.$queryRaw`SELECT user_id FROM profiles WHERE user_id IN (${Prisma.join(selected.map(item => item.id).sort())}) ORDER BY user_id FOR SHARE`;
        const eligible = await tx.profile.findMany({ where: { userId: { in: selected.map(item => item.id) }, ...eligibleProfile }, select: { userId: true } });
        selected = selected.filter(item => eligible.some(profile => profile.userId === item.id));
      }
      if (!selected.length) return { day, used, remaining: MATCH_LIMIT - used, round: null, message: '暂时没有可匹配的师生，本次不扣次数' };
      const round = await tx.matchRound.create({ data: { userId, day, ordinal: used + 1, requestId, requirement,
        candidates: { create: selected.map((item, rank) => ({ userId: item.id, rank, score: item.score })) } } });
      return { day, used: used + 1, remaining: MATCH_LIMIT - used - 1, round: await this.roundView(tx, round.id, userId) };
    });
  }
}
