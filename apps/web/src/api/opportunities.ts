export type PublicationStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'PENDING_REVIEW' | 'REJECTED';
export interface Publication {
  id: string; title: string; description: string;
  category: 'PROJECT' | 'COMPETITION' | 'RESEARCH' | 'STARTUP' | 'STUDY';
  status: PublicationStatus; deadline: string | null; commitment: string; location: string;
  tags: string[]; applicants: number;
}
export const publicationStatusLabels: Record<PublicationStatus, string> = {
  DRAFT: '草稿', OPEN: '招募中', CLOSED: '已关闭', PENDING_REVIEW: '待审核', REJECTED: '未通过',
};
