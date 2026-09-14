import { Injectable } from '@nestjs/common';
import { OpportunityCategory, OpportunityStatus } from '@prisma/client';
import { PrismaService } from './database/prisma.service';

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
  featured?: boolean;
}

const categoryMap: Record<OpportunityCategory, OpportunityRecord['category']> = {
  PROJECT: 'project',
  COMPETITION: 'competition',
  RESEARCH: 'research',
  STARTUP: 'startup',
  STUDY: 'study',
};

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<OpportunityRecord[]> {
    const opportunities = await this.prisma.opportunity.findMany({
      where: { status: OpportunityStatus.OPEN },
      include: { publisher: true },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    });

    return opportunities.map((opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      category: categoryMap[opportunity.category],
      publisher: `${opportunity.publisher.displayName} · ${opportunity.publisherLabel}`,
      college: opportunity.publisher.college,
      description: opportunity.description,
      tags: opportunity.tags,
      commitment: opportunity.commitment,
      location: opportunity.location,
      applicants: opportunity.applicants,
      deadline: opportunity.deadline.toISOString().slice(0, 10),
      featured: opportunity.featured || undefined,
    }));
  }
}
