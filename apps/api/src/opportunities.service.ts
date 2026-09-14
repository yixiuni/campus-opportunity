import { Injectable } from '@nestjs/common';

export interface OpportunityRecord {
  id: string;
  title: string;
  category: 'project' | 'competition' | 'research' | 'startup' | 'organization';
  publisher: string;
  college: string;
  description: string;
  tags: string[];
  commitment: string;
  location: string;
  applicants: number;
  deadline: string;
  featured?: boolean;
}

const opportunities: OpportunityRecord[] = [
  {
    id: 'ai-campus-agent',
    title: '校园 AI Agent 项目招募前端成员',
    category: 'project',
    publisher: '林同学 · 项目发起人',
    college: '人工智能学院',
    description: '一起完成面向校内服务的 AI Agent 原型，已有后端和产品方案，寻找愿意持续共创的前端同学。',
    tags: ['Vue 3', 'TypeScript', 'AI 应用'],
    commitment: '每周 6–8 小时 · 8 周',
    location: '线上协作 + 图书馆讨论',
    applicants: 6,
    deadline: '2026-09-10',
    featured: true,
  },
  {
    id: 'challenge-cup-product',
    title: '挑战杯团队寻找产品与调研成员',
    category: 'competition',
    publisher: '周同学 · 队长',
    college: '管理学院',
    description: '项目聚焦校园低碳生活，需要完成用户访谈、商业计划书和路演材料，欢迎认真负责的同学加入。',
    tags: ['用户调研', '商业计划书', '路演'],
    commitment: '每周 4–6 小时 · 12 周',
    location: '主校区',
    applicants: 9,
    deadline: '2026-09-05',
  },
  {
    id: 'cv-research-assistant',
    title: '计算机视觉课题招募本科生助研',
    category: 'research',
    publisher: '张老师 · 课题负责人',
    college: '计算机学院',
    description: '参与数据整理、论文复现和实验记录，适合希望了解科研流程并具备 Python 基础的同学。',
    tags: ['Python', 'PyTorch', '论文复现'],
    commitment: '每周 8 小时 · 一学期',
    location: '计算机学院实验室',
    applicants: 12,
    deadline: '2026-09-15',
  },
];

@Injectable()
export class OpportunitiesService {
  findAll(): OpportunityRecord[] {
    return opportunities;
  }
}

