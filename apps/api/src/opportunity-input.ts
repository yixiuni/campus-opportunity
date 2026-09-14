import { BadRequestException } from '@nestjs/common';
import { OpportunityCategory } from '@prisma/client';

export const categories: Record<string, OpportunityCategory> = {
  project: 'PROJECT', competition: 'COMPETITION', research: 'RESEARCH', startup: 'STARTUP', study: 'STUDY',
};
export interface OpportunityInput {
  title?: string; description?: string; category?: OpportunityCategory; commitment?: string;
  location?: string; tags?: string[]; deadline?: Date | null;
}

export function validateOpportunity(body: unknown, create = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('机会格式错误');
  const input = body as Record<string, unknown>;
  const limits = { title: 60, description: 500, commitment: 120, location: 100 };
  const allowed = [...Object.keys(limits), 'category', 'tags', 'deadline', ...(create ? ['intent'] : [])];
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key))) throw new BadRequestException('包含不允许修改的字段');
  if (create && !['draft', 'publish'].includes(input.intent as string)) throw new BadRequestException('请选择保存草稿或发布');
  const data: OpportunityInput = {};
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    if (!(key in input)) continue;
    const value = input[key];
    if (typeof value !== 'string' || [...value.trim()].length > limits[key]) throw new BadRequestException(`${key} 最多 ${limits[key]} 字`);
    data[key] = value.trim();
  }
  if ('category' in input) {
    if (typeof input.category !== 'string' || !Object.hasOwn(categories, input.category)) throw new BadRequestException('机会分类无效');
    data.category = categories[input.category];
  }
  if ('tags' in input) {
    if (!Array.isArray(input.tags) || input.tags.length > 8 || input.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || [...tag.trim()].length > 20)) {
      throw new BadRequestException('最多 8 个标签，每个 1–20 字');
    }
    data.tags = [...new Set((input.tags as string[]).map((tag) => tag.trim()))];
  }
  if ('deadline' in input) {
    if (input.deadline === null || input.deadline === '') data.deadline = null;
    else {
      if (typeof input.deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) throw new BadRequestException('日期格式必须为 YYYY-MM-DD');
      const day = new Date(`${input.deadline}T00:00:00.000Z`);
      if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== input.deadline) throw new BadRequestException('日期不存在');
      data.deadline = new Date(`${input.deadline}T23:59:59.999+08:00`);
    }
  }
  return { data, publish: input.intent === 'publish' };
}

export function assertPublishable(data: { title: string; description: string; deadline: Date | null }) {
  if (!data.title || !data.description || !data.deadline) throw new BadRequestException('请填写标题、机会介绍和截止日期');
  if (data.deadline.getTime() <= Date.now()) throw new BadRequestException('截止日期不能早于今天');
}
