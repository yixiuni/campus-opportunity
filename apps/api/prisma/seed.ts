import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

try {
  loadEnvFile(resolve(__dirname, '../../../.env'));
} catch {
  // Deployment environments provide DATABASE_URL directly.
}

import {
  OpportunityCategory,
  OpportunityStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

const opportunities = [
  {
    id: 'ai-campus-agent',
    publisherId: 'seed-user-lin',
    publisherLabel: '项目发起人',
    title: '校园 AI Agent 项目招募前端成员',
    category: OpportunityCategory.PROJECT,
    description: '一起完成面向校内服务的 AI Agent 原型，已有后端和产品方案，寻找愿意持续共创的前端同学。',
    tags: ['Vue 3', 'TypeScript', 'AI 应用'],
    commitment: '每周 6–8 小时 · 8 周',
    location: '线上协作 + 图书馆讨论',
    applicants: 6,
    deadline: new Date('2026-09-10T23:59:59.999+08:00'),
    featured: true,
    publishedAt: new Date('2026-09-01T09:00:00+08:00'),
  },
  {
    id: 'challenge-cup-product',
    publisherId: 'seed-user-zhou',
    publisherLabel: '队长',
    title: '挑战杯团队寻找产品与调研成员',
    category: OpportunityCategory.COMPETITION,
    description: '项目聚焦校园低碳生活，需要完成用户访谈、商业计划书和路演材料，欢迎认真负责的同学加入。',
    tags: ['用户调研', '商业计划书', '路演'],
    commitment: '每周 4–6 小时 · 12 周',
    location: '主校区',
    applicants: 9,
    deadline: new Date('2026-09-05T23:59:59.999+08:00'),
    featured: false,
    publishedAt: new Date('2026-08-28T14:00:00+08:00'),
  },
  {
    id: 'cv-research-assistant',
    publisherId: 'seed-user-zhang',
    publisherLabel: '课题负责人',
    title: '计算机视觉课题招募本科生助研',
    category: OpportunityCategory.RESEARCH,
    description: '参与数据整理、论文复现和实验记录，适合希望了解科研流程并具备 Python 基础的同学。',
    tags: ['Python', 'PyTorch', '论文复现'],
    commitment: '每周 8 小时 · 一学期',
    location: '计算机学院实验室',
    applicants: 12,
    deadline: new Date('2026-09-15T23:59:59.999+08:00'),
    featured: false,
    publishedAt: new Date('2026-08-25T10:00:00+08:00'),
  },
];

async function main() {
  const users = [
    {
      id: 'seed-user-lin',
      displayName: '林同学',
      avatar: '林',
      role: UserRole.STUDENT,
      roleLabel: '2027 届本科生',
      college: '人工智能学院',
    },
    {
      id: 'seed-user-zhou',
      displayName: '周同学',
      avatar: '周',
      role: UserRole.STUDENT,
      roleLabel: '队长',
      college: '管理学院',
    },
    {
      id: 'seed-user-zhang',
      displayName: '张老师',
      avatar: '张',
      role: UserRole.TEACHER,
      roleLabel: '课题负责人',
      college: '计算机学院',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    });
  }

  await prisma.profile.upsert({
    where: { userId: 'seed-user-lin' },
    update: {
      headline: '校园 AI 产品与前端实践者',
      introduction: '关注校园场景中的 AI 产品，正在学习 Vue 3、TypeScript 与用户调研，希望认识愿意长期共创的老师和同学。',
      tags: ['Vue 3', 'TypeScript', 'AI 应用', '用户调研'],
      availability: '每周可投入 6–8 小时',
      matchingEnabled: true,
    },
    create: {
      userId: 'seed-user-lin',
      headline: '校园 AI 产品与前端实践者',
      introduction: '关注校园场景中的 AI 产品，正在学习 Vue 3、TypeScript 与用户调研，希望认识愿意长期共创的老师和同学。',
      tags: ['Vue 3', 'TypeScript', 'AI 应用', '用户调研'],
      availability: '每周可投入 6–8 小时',
      matchingEnabled: true,
    },
  });

  for (const opportunity of opportunities) {
    await prisma.opportunity.upsert({
      where: { id: opportunity.id },
      update: {
        ...opportunity,
        status: OpportunityStatus.OPEN,
      },
      create: {
        ...opportunity,
        status: OpportunityStatus.OPEN,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
