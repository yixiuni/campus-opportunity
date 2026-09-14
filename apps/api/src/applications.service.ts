import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './database/prisma.service';
import { publicUserSelect } from './auth/auth.service';

const include = {
  applicant: { select: publicUserSelect },
  opportunity: { select: { id: true, title: true, category: true, status: true, deadline: true, publisherId: true, publisher: { select: publicUserSelect } } },
} satisfies Prisma.ApplicationInclude;

function input(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('申请格式错误');
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => !['note', 'sendProfile'].includes(key)) || typeof value.note !== 'string' ||
    [...value.note.trim()].length > 180 || typeof value.sendProfile !== 'boolean') {
    throw new BadRequestException('申请说明最多 180 字，并选择是否发送个人说明');
  }
  return { note: value.note.trim(), sendProfile: value.sendProfile };
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly db: PrismaService) {}

  private async snapshot(tx: Prisma.TransactionClient, userId: string, send: boolean) {
    if (!send) return Prisma.DbNull;
    const profile = await tx.profile.findUnique({ where: { userId } });
    if (!profile || !profile.introduction.trim()) throw new BadRequestException('请先在“我的”完善个人说明，或关闭发送选项');
    return { headline: profile.headline, introduction: profile.introduction, tags: profile.tags, availability: profile.availability };
  }

  private async lockOpportunity(tx: Prisma.TransactionClient, id: string) {
    // Serialize applications with publishing/closing updates to prevent accepting stale recruitment state.
    await tx.$queryRaw`SELECT id FROM opportunities WHERE id = ${id} FOR UPDATE`;
    const item = await tx.opportunity.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('机会不存在');
    return item;
  }

  private assertOpen(item: { status: string; deadline: Date | null }) {
    if (item.status !== 'OPEN' || !item.deadline || item.deadline.getTime() <= Date.now()) throw new ConflictException('该机会已停止招募');
  }

  async create(userId: string, opportunityId: string, body: unknown) {
    const data = input(body);
    try {
      return await this.db.$transaction(async tx => {
        const opportunity = await this.lockOpportunity(tx, opportunityId);
        this.assertOpen(opportunity);
        if (opportunity.publisherId === userId) throw new BadRequestException('不能申请自己发布的机会');
        return tx.application.create({ data: { ...data, applicantId: userId, opportunityId,
          profileSnapshot: await this.snapshot(tx, userId, data.sendProfile) }, include });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('你已申请过该机会，请查看申请记录');
      throw error;
    }
  }

  list(userId: string, direction: string) {
    if (!['sent', 'received'].includes(direction)) throw new BadRequestException('请选择我发出的或我收到的');
    return this.db.application.findMany({ where: direction === 'sent' ? { applicantId: userId } : { opportunity: { publisherId: userId } }, include, orderBy: { createdAt: 'desc' } });
  }

  async detail(userId: string, id: string) {
    const item = await this.db.application.findFirst({ where: { id, OR: [{ applicantId: userId }, { opportunity: { publisherId: userId } }] }, include });
    if (!item) throw new NotFoundException('申请不存在');
    return item;
  }

  async edit(userId: string, id: string, body: unknown) {
    const data = input(body);
    const initial = await this.detail(userId, id);
    if (initial.applicantId !== userId) throw new NotFoundException('申请不存在');
    return this.db.$transaction(async tx => {
      this.assertOpen(await this.lockOpportunity(tx, initial.opportunityId));
      const result = await tx.application.updateMany({ where: { id, applicantId: userId, status: 'PENDING' },
        data: { ...data, profileSnapshot: await this.snapshot(tx, userId, data.sendProfile) } });
      if (!result.count) throw new ConflictException('申请已处理，请刷新后重试');
      return tx.application.findUniqueOrThrow({ where: { id }, include });
    });
  }

  async review(userId: string, id: string, body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !('decision' in body) || !['approve', 'reject'].includes(body.decision as string)) throw new BadRequestException('请选择通过或拒绝');
    const approved = body.decision === 'approve';
    const initial = await this.detail(userId, id);
    if (initial.opportunity.publisherId !== userId) throw new NotFoundException('申请不存在');
    return this.db.$transaction(async tx => {
      const opportunity = await this.lockOpportunity(tx, initial.opportunityId);
      if (approved) this.assertOpen(opportunity);
      const result = await tx.application.updateMany({ where: { id, status: 'PENDING' },
        data: { status: approved ? 'APPROVED' : 'REJECTED', reviewedAt: new Date() } });
      if (!result.count) throw new ConflictException('申请已处理，请刷新后重试');
      return tx.application.findUniqueOrThrow({ where: { id }, include });
    });
  }

  async withdraw(userId: string, id: string) {
    const item = await this.detail(userId, id);
    if (item.applicantId !== userId) throw new NotFoundException('申请不存在');
    const result = await this.db.application.updateMany({ where: { id, applicantId: userId, status: { in: ['PENDING', 'APPROVED'] } }, data: { status: 'WITHDRAWN' } });
    if (!result.count) throw new ConflictException('当前申请不能撤回');
    return this.detail(userId, id);
  }

  async contact(userId: string, id: string) {
    const item = await this.detail(userId, id);
    if (item.status !== 'APPROVED') throw new ForbiddenException('申请通过后才能查看联系方式');
    const otherId = item.applicantId === userId ? item.opportunity.publisherId : item.applicantId;
    const other = await this.db.user.findUniqueOrThrow({ where: { id: otherId }, select: { displayName: true, contact: true } });
    return { ...other, available: Boolean(other.contact), message: other.contact ? '请尊重对方的联系意愿' : '对方尚未填写联系方式，钉钉直连尚未接入' };
  }
}
