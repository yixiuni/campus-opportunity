import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { readEnvironment } from '../database/load-environment';

export const devAccounts = ['seed-user-lin', 'seed-user-zhou', 'seed-user-zhang'];
export const publicUserSelect = {
  id: true, displayName: true, avatar: true, role: true, roleLabel: true, college: true,
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  assertDevelopmentLogin() {
    if (readEnvironment('NODE_ENV') !== 'development' || readEnvironment('DEV_AUTH_ENABLED') !== 'true') {
      throw new NotFoundException();
    }
  }

  async accounts() {
    this.assertDevelopmentLogin();
    return this.prisma.user.findMany({
      where: { id: { in: devAccounts }, role: { in: ['STUDENT', 'TEACHER'] } },
      select: publicUserSelect, orderBy: { id: 'asc' },
    });
  }

  async login(body: unknown) {
    this.assertDevelopmentLogin();
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== 'userId') ||
      !('userId' in body) || typeof body.userId !== 'string' || !devAccounts.includes(body.userId)) {
      throw new BadRequestException('请选择有效的开发账号');
    }
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user || !['STUDENT', 'TEACHER'].includes(user.role)) throw new UnauthorizedException();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.prisma.session.create({ data: {
      tokenHash: this.hash(token), userId: user.id, expiresAt, developmentOnly: true,
    } });
    return { accessToken: token, expiresAt: expiresAt.toISOString() };
  }

  hash(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async authenticate(authorization?: string) {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? '');
    if (!match) throw new UnauthorizedException('请先登录');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(match[1]) }, include: { user: { select: publicUserSelect } },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('登录已失效');
    if (session.developmentOnly && (readEnvironment('NODE_ENV') !== 'development' || readEnvironment('DEV_AUTH_ENABLED') !== 'true')) {
      throw new UnauthorizedException('开发会话已停用');
    }
    return { user: session.user, sessionId: session.id };
  }

  async logout(sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }
}
