import { BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Patch, Req } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedRequest } from '../auth/auth.guard';
import { publicUserSelect } from '../auth/auth.service';

function validateProfile(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('个人说明格式错误');
  const input = body as Record<string, unknown>;
  const limits = { headline: 32, introduction: 240, availability: 80 };
  const allowed = [...Object.keys(limits), 'tags', 'matchingEnabled'];
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new BadRequestException('只允许修改个人说明和匹配开关');
  }
  const data: { headline?: string; introduction?: string; availability?: string; tags?: string[]; matchingEnabled?: boolean } = {};
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    if (!(key in input)) continue;
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > limits[key]) {
      throw new BadRequestException(`${key} 必须为 1–${limits[key]} 字`);
    }
    data[key] = value.trim();
  }
  if ('tags' in input) {
    if (!Array.isArray(input.tags) || input.tags.length > 8 || input.tags.some((tag) =>
      typeof tag !== 'string' || !tag.trim() || [...tag.trim()].length > 20)) {
      throw new BadRequestException('最多 8 个标签，每个标签 1–20 字');
    }
    data.tags = [...new Set((input.tags as string[]).map((tag) => tag.trim()))];
  }
  if ('matchingEnabled' in input) {
    if (typeof input.matchingEnabled !== 'boolean') throw new BadRequestException('匹配开关必须为布尔值');
    data.matchingEnabled = input.matchingEnabled;
  }
  return data;
}

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  current(@Req() request: AuthenticatedRequest) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: request.user.id }, select: { ...publicUserSelect, profile: true, contact: true },
    });
  }

  @Patch('profile')
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const data = validateProfile(body);
    return this.prisma.profile.upsert({
      where: { userId: request.user.id }, update: data,
      create: { userId: request.user.id, headline: '', introduction: '', availability: '', ...data },
    });
  }

  @Patch('contact')
  updateContact(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !('contact' in body) || typeof body.contact !== 'string' || [...body.contact.trim()].length > 120) {
      throw new BadRequestException('联系方式最多 120 字');
    }
    return this.prisma.user.update({ where: { id: request.user.id }, data: { contact: body.contact.trim() }, select: { contact: true } });
  }

  @Get('opportunities')
  async publications(@Req() request: AuthenticatedRequest) {
    const records = await this.prisma.opportunity.findMany({ where: { publisherId: request.user.id }, orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: { where: { status: { not: 'WITHDRAWN' } } } } } } });
    return records.map(({ _count, ...item }) => ({ ...item, applicants: _count.applications }));
  }

  @Get('opportunities/:id')
  async publication(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const opportunity = await this.prisma.opportunity.findFirst({ where: { id, publisherId: request.user.id },
      include: { _count: { select: { applications: { where: { status: { not: 'WITHDRAWN' } } } } } } });
    if (!opportunity) throw new NotFoundException('未找到你的发布');
    const { _count, ...item } = opportunity;
    return { ...item, applicants: _count.applications };
  }
}
