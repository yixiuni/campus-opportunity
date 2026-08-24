export type OpportunityCategory =
  | 'project'
  | 'competition'
  | 'research'
  | 'startup'
  | 'organization';

export interface OpportunitySummary {
  id: string;
  title: string;
  category: OpportunityCategory;
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

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

