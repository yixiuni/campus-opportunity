import type { Account, PersonalProfile } from './auth';

export interface ApplicationRecord {
  id: string;
  opportunityId: string;
  applicantId: string;
  note: string;
  sendProfile: boolean;
  profileSnapshot: Omit<PersonalProfile, 'matchingEnabled'> | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
  applicant: Account;
  opportunity: {
    id: string; title: string; category: string; publisherId: string;
    status: string; deadline: string | null; publisher: Account;
  };
}

const labels = { PENDING: '待处理', APPROVED: '已通过', REJECTED: '未通过', WITHDRAWN: '已撤回' };
export function applicationCard(item: ApplicationRecord, received = false) {
  const person = received ? item.applicant : item.opportunity.publisher;
  return {
    id: item.id, raw: item, kind: 'opportunity' as 'opportunity' | 'match',
    title: item.opportunity.title, opportunity: item.opportunity.title,
    college: person.college, applicant: person.displayName, avatar: person.displayName.slice(0, 1),
    submittedAt: new Date(item.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    status: (item.status === 'PENDING' ? 'pending' : item.status === 'APPROVED' ? 'approved' : 'closed') as 'pending' | 'approved' | 'closed',
    statusText: labels[item.status], note: item.note, update: item.note,
    tags: item.profileSnapshot?.tags ?? [], hasProfile: Boolean(item.profileSnapshot),
  };
}
