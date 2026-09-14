import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OpportunityCategory, OpportunityStatus, Prisma } from '@prisma/client';
import { PrismaService } from './database/prisma.service';
import { assertPublishable, validateOpportunity } from './opportunity-input';

export interface OpportunityRecord {
  id: string;
  title: string;
  category: 'project' | 'competition' | 'research' | 'startup' | 'study';
  publisher: string;
  college: string;
  description: string;
  tags: string[];
  commitment: string;
  location: string;
  applicants: number;
  deadline: string;
  publishedAt: string;
  featured?: boolean;
}

const categoryMap: Record<OpportunityCategory, OpportunityRecord['category']> = {
  PROJECT: 'project',
  COMPETITION: 'competition',
  RESEARCH: 'research',
  STARTUP: 'startup',
  STUDY: 'study',
};

const publicInclude = {
  publisher: true,
  _count: { select: { applications: { where: { status: { not: 'WITHDRAWN' as const } } } } },
} satisfies Prisma.OpportunityInclude;

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<OpportunityRecord[]> {
    const opportunities = await this.prisma.opportunity.findMany({
      where: { status: OpportunityStatus.OPEN, deadline: { gt: new Date() } },
      include: publicInclude,
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    });

    return opportunities.map((opportunity) => this.serialize(opportunity));
  }

  private serialize(opportunity: Prisma.OpportunityGetPayload<{ include: typeof publicInclude }>) {
    return {
      id: opportunity.id,
      title: opportunity.title,
      category: categoryMap[opportunity.category],
      publisher: `${opportunity.publisher.displayName} · ${opportunity.publisherLabel}`,
      college: opportunity.publisher.college,
      description: opportunity.description,
      tags: opportunity.tags,
      commitment: opportunity.commitment,
      location: opportunity.location,
      applicants: opportunity._count.applications,
      deadline: opportunity.deadline!.toISOString().slice(0, 10),
      publishedAt: opportunity.publishedAt.toISOString(),
      featured: opportunity.featured || undefined,
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.opportunity.findFirst({
      where: { id, status: 'OPEN', deadline: { gt: new Date() } }, include: publicInclude,
    });
    if (!item) throw new NotFoundException('机会已关闭、过期或不存在');
    return this.serialize(item);
  }

  async create(userId: string, body: unknown) {
    const { data, publish } = validateOpportunity(body, true);
    const content = { title: '', description: '', category: OpportunityCategory.PROJECT, commitment: '', location: '', tags: [] as string[], deadline: null as Date | null, ...data };
    if (publish) assertPublishable(content);
    return this.prisma.opportunity.create({ data: {
      ...content, publisherId: userId, publisherLabel: '发起人', status: publish ? 'OPEN' : 'DRAFT',
    } });
  }

  async update(userId: string, id: string, body: unknown) {
    const { data } = validateOpportunity(body);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.opportunity.findFirst({ where: { id, publisherId: userId } });
      if (!current) throw new NotFoundException('未找到你的发布');
      if (!['DRAFT', 'OPEN'].includes(current.status)) throw new ConflictException('当前状态不能编辑');
      if (current.status === 'OPEN') assertPublishable({ ...current, ...data });
      const result = await tx.opportunity.updateMany({
        where: { id, publisherId: userId, status: current.status, updatedAt: current.updatedAt }, data,
      });
      if (!result.count) throw new ConflictException('机会已被修改，请刷新后重试');
      return tx.opportunity.findUniqueOrThrow({ where: { id } });
    });
  }

  async transition(userId: string, id: string, action: 'publish' | 'close') {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.opportunity.findFirst({ where: { id, publisherId: userId } });
      if (!current) throw new NotFoundException('未找到你的发布');
      const expected = action === 'publish' ? 'DRAFT' : 'OPEN';
      if (current.status !== expected) throw new ConflictException('当前状态不允许此操作');
      if (action === 'publish') assertPublishable(current);
      const result = await tx.opportunity.updateMany({
        where: { id, publisherId: userId, status: expected, updatedAt: current.updatedAt },
        data: action === 'publish' ? { status: 'OPEN', publishedAt: new Date() } : { status: 'CLOSED' },
      });
      if (!result.count) throw new ConflictException('机会状态已变化，请刷新后重试');
      return tx.opportunity.findUniqueOrThrow({ where: { id } });
    });
  }
}
