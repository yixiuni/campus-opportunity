import type { Account, PersonalProfile } from './auth';

export interface ApplicationRecord {
  id: string;
  kind: 'OPPORTUNITY' | 'MATCH';
  opportunityId: string | null;
  targetUserId: string | null;
  targetUser: Account | null;
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
  } | null;
}

const labels = { PENDING: '待处理', APPROVED: '已通过', REJECTED: '未通过', WITHDRAWN: '已撤回' };
export function applicationCard(item: ApplicationRecord, received = false) {
  const person = received ? item.applicant : (item.targetUser ?? item.opportunity!.publisher);
  const isMatch = item.kind === 'MATCH';
  const title = isMatch ? `希望与${person.displayName}建立联系` : item.opportunity!.title;
  // The card's progress row describes state, not the applicant's potentially long note.
  const progress = {
    PENDING: isMatch ? '匹配请求已送达，等待对方回应' : '申请已送达，等待发起人查看',
    APPROVED: isMatch ? `${person.displayName}已同意你的匹配请求，可以开始联系` : '发起人已通过你的申请，可以开始联系',
    REJECTED: isMatch ? '对方暂未同意本次匹配请求' : '本次申请未通过',
    WITHDRAWN: isMatch ? '匹配请求已撤回' : '申请已撤回',
  };
  return {
    id: item.id, raw: item, kind: (item.kind === 'MATCH' ? 'match' : 'opportunity') as 'opportunity' | 'match',
    title, opportunity: isMatch ? '希望与你建立联系' : title,
    college: isMatch ? [person.college, person.roleLabel].filter(Boolean).join(' · ') : person.college,
    applicant: person.displayName, avatar: person.displayName.slice(0, 1),
    submittedAt: new Date(item.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    status: (item.status === 'PENDING' ? 'pending' : item.status === 'APPROVED' ? 'approved' : 'closed') as 'pending' | 'approved' | 'closed',
    statusText: isMatch && item.status === 'APPROVED' ? '已同意' : labels[item.status], note: item.note, update: progress[item.status],
    tags: item.profileSnapshot?.tags ?? [], hasProfile: Boolean(item.profileSnapshot),
  };
}
