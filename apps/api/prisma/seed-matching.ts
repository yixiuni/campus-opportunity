import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
try { loadEnvFile(resolve(__dirname, '../../../.env')); } catch { /* Use deployment environment. */ }

// Fill only missing local demo profiles; never replace a user's edited profile or preferences.
export async function seedMatchingProfiles(prisma: PrismaClient) {
  const profiles = [
    { userId: 'seed-user-zhang', headline: '计算机视觉与科研实践', introduction: '本地演示资料：交流 Python、论文复现和计算机视觉项目。', tags: ['Python', '计算机视觉', '科研'], availability: '每周交流 1 小时' },
    { userId: 'seed-user-zhou', headline: '校园项目与产品调研', introduction: '本地演示资料：希望与技术伙伴交流校园项目、用户调研和产品设计。', tags: ['用户调研', '校园项目', '产品设计'], availability: '每周投入 4 小时' },
  ];
  for (const profile of profiles) {
    if (await prisma.user.count({ where: { id: profile.userId } })) {
      await prisma.profile.upsert({ where: { userId: profile.userId }, update: {}, create: { ...profile, matchingEnabled: true } });
    }
  }
}
if (require.main === module) {
  const prisma = new PrismaClient();
  seedMatchingProfiles(prisma).finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
}
