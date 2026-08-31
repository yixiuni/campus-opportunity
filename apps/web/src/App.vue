<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

type Category = 'all' | 'project' | 'competition' | 'research' | 'startup' | 'study';
type MobileSection = 'opportunities' | 'matching' | 'publish' | 'applications' | 'profile';
type ApplicationStatus = 'all' | 'pending' | 'approved' | 'closed';
type ApplicationViewRole = 'applicant' | 'publisher';
type MatchRole = 'teacher' | 'student';
type MatchStage = 'idle' | 'matching' | 'results';
type ProfilePanel = 'overview' | 'published' | 'applications' | 'settings';

const MATCH_DAILY_LIMIT = 3;

function getLocalDayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function loadDailyMatchCount() {
  try {
    const stored = JSON.parse(localStorage.getItem('campus-match-daily-usage-v3') || '{}') as {
      date?: string;
      count?: number;
    };
    return stored.date === getLocalDayKey() ? Math.min(stored.count || 0, MATCH_DAILY_LIMIT) : 0;
  } catch {
    return 0;
  }
}

function loadMatchingEnabled() {
  try {
    return localStorage.getItem('campus-matching-enabled-v1') !== 'false';
  } catch {
    return true;
  }
}

interface Opportunity {
  id: string;
  title: string;
  category: Exclude<Category, 'all'>;
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

interface MatchPerson {
  id: string;
  name: string;
  avatar: string;
  role: MatchRole;
  roleLabel: string;
  college: string;
  focus: string;
  introduction: string;
  tags: string[];
  availability: string;
  score: number;
}

const categoryLabels: Record<Category, string> = {
  all: '全部',
  project: '项目',
  competition: '竞赛',
  research: '科研',
  startup: '创业',
  study: '学业',
};

const applicationStatusLabels: Record<ApplicationStatus, string> = {
  all: '全部',
  pending: '待处理',
  approved: '已通过',
  closed: '已结束',
};

const applicationRecords = ref([
  {
    id: 'application-ai-agent',
    kind: 'opportunity' as const,
    title: '校园 AI Agent 项目招募前端成员',
    college: '人工智能学院',
    category: '项目',
    submittedAt: '今天 14:20',
    status: 'pending' as Exclude<ApplicationStatus, 'all'>,
    statusText: '待处理',
    update: '申请已送达，等待发起人查看',
  },
  {
    id: 'application-challenge-cup',
    kind: 'opportunity' as const,
    title: '挑战杯团队寻找产品与调研成员',
    college: '管理学院',
    category: '竞赛',
    submittedAt: '8 月 22 日',
    status: 'approved' as Exclude<ApplicationStatus, 'all'>,
    statusText: '已通过',
    update: '发起人已通过你的申请，可以开始联系',
  },
  {
    id: 'application-research',
    kind: 'opportunity' as const,
    title: '计算机视觉课题招募本科生助研',
    college: '计算机学院',
    category: '科研',
    submittedAt: '8 月 18 日',
    status: 'closed' as Exclude<ApplicationStatus, 'all'>,
    statusText: '已结束',
    update: '该机会的本轮招募已结束',
  },
  {
    id: 'match-wu-teacher',
    kind: 'match' as const,
    title: '希望与吴老师建立联系',
    college: '计算机学院 · 教师',
    category: '个人匹配',
    submittedAt: '8 月 24 日',
    status: 'approved' as Exclude<ApplicationStatus, 'all'>,
    statusText: '已同意',
    update: '吴老师已同意你的匹配请求，可以开始联系',
  },
]);

const initialPublisherApplicationRecords = [
  {
    id: 'received-wang',
    kind: 'opportunity' as const,
    applicant: '王同学',
    college: '计算机学院',
    avatar: '王',
    opportunity: '校园 AI Agent 项目招募前端成员',
    submittedAt: '今天 15:10',
    status: 'pending' as Exclude<ApplicationStatus, 'all'>,
    statusText: '待处理',
    note: '有两个 Vue 3 项目经验，熟悉 TypeScript，希望参与校园产品共创。',
    tags: ['Vue 3', 'TypeScript', '每周 8 小时'],
    hasProfile: true,
  },
  {
    id: 'received-liu',
    kind: 'opportunity' as const,
    applicant: '刘同学',
    college: '设计学院',
    avatar: '刘',
    opportunity: '校园 AI Agent 项目招募前端成员',
    submittedAt: '8 月 24 日',
    status: 'approved' as Exclude<ApplicationStatus, 'all'>,
    statusText: '已通过',
    note: '擅长移动端界面与交互设计，可以负责原型和用户测试。',
    tags: ['产品设计', 'Figma', '用户调研'],
    hasProfile: true,
  },
  {
    id: 'received-zhou',
    kind: 'opportunity' as const,
    applicant: '周同学',
    college: '软件学院',
    avatar: '周',
    opportunity: '校园 AI Agent 项目招募前端成员',
    submittedAt: '8 月 21 日',
    status: 'closed' as Exclude<ApplicationStatus, 'all'>,
    statusText: '未通过',
    note: '希望了解项目并参与部分前端开发工作。',
    tags: ['JavaScript', '小程序'],
    hasProfile: false,
  },
  {
    id: 'received-match-zhao',
    kind: 'match' as const,
    applicant: '赵同学',
    college: '软件学院 · 2027 届',
    avatar: '赵',
    opportunity: '希望交流校园 AI 产品与前端实践',
    submittedAt: '今天 16:05',
    status: 'pending' as Exclude<ApplicationStatus, 'all'>,
    statusText: '待处理',
    note: '老师您好，我正在做一款校园 AI 产品，希望向您请教模型应用和项目落地方面的问题。',
    tags: ['Vue 3', 'AI 应用', '校园产品'],
    hasProfile: true,
  },
];

const matchPeople: MatchPerson[] = [
  {
    id: 'teacher-zhang',
    name: '张老师',
    avatar: '张',
    role: 'teacher',
    roleLabel: '副教授',
    college: '人工智能学院',
    focus: '大模型应用与人机协作',
    introduction: '关注大模型在教育与校园服务中的落地，指导过多项学生创新项目。',
    tags: ['大模型应用', '科研入门', '项目指导'],
    availability: '每周可交流 2 小时',
    score: 92,
  },
  {
    id: 'teacher-wu',
    name: '吴老师',
    avatar: '吴',
    role: 'teacher',
    roleLabel: '讲师',
    college: '计算机学院',
    focus: '前端工程与智能交互',
    introduction: '研究智能交互与软件工程，愿意为校内技术实践提供方法建议。',
    tags: ['智能交互', '软件工程', '技术实践'],
    availability: '每周可交流 1–2 小时',
    score: 87,
  },
  {
    id: 'teacher-li',
    name: '李老师',
    avatar: '李',
    role: 'teacher',
    roleLabel: '副教授',
    college: '创新创业学院',
    focus: '创新项目孵化与成果转化',
    introduction: '长期指导学生创新创业项目，关注真实需求验证与跨学院团队协作。',
    tags: ['项目孵化', '需求验证', '团队指导'],
    availability: '每两周可交流 1 次',
    score: 85,
  },
  {
    id: 'student-lin',
    name: '林同学',
    avatar: '林',
    role: 'student',
    roleLabel: '2027 届本科生',
    college: '设计学院',
    focus: '产品设计与用户研究',
    introduction: '正在寻找校园产品共创伙伴，擅长原型设计、访谈和移动端体验。',
    tags: ['产品设计', 'Figma', '用户调研'],
    availability: '每周可投入 6–8 小时',
    score: 90,
  },
  {
    id: 'student-chen',
    name: '陈同学',
    avatar: '陈',
    role: 'student',
    roleLabel: '2026 届研究生',
    college: '管理学院',
    focus: '创新创业与商业分析',
    introduction: '有挑战杯和创业项目经验，希望认识技术伙伴共同验证校园需求。',
    tags: ['商业分析', '挑战杯', '创业实践'],
    availability: '每周可投入 4–6 小时',
    score: 84,
  },
  {
    id: 'student-sun',
    name: '孙同学',
    avatar: '孙',
    role: 'student',
    roleLabel: '2027 届本科生',
    college: '软件学院',
    focus: 'Vue 3 与小程序开发',
    introduction: '参与过两个校内服务小程序，希望寻找重视用户体验的长期项目。',
    tags: ['Vue 3', '小程序', 'TypeScript'],
    availability: '每周可投入 8 小时',
    score: 88,
  },
  {
    id: 'student-huang',
    name: '黄同学',
    avatar: '黄',
    role: 'student',
    roleLabel: '2026 届研究生',
    college: '人工智能学院',
    focus: '智能体应用与模型评测',
    introduction: '正在研究校园场景中的智能体应用，希望认识产品和前端方向的合作伙伴。',
    tags: ['AI Agent', '模型评测', 'Python'],
    availability: '每周可投入 5–7 小时',
    score: 86,
  },
];

const fallback: Opportunity[] = [
  {
    id: 'fallback',
    title: '校园 AI Agent 项目招募前端成员',
    category: 'project',
    publisher: '林同学 · 项目发起人',
    college: '人工智能学院',
    description: '一起完成面向校内服务的 AI Agent 原型，寻找愿意持续共创的前端同学。',
    tags: ['Vue 3', 'TypeScript', 'AI 应用'],
    commitment: '每周 6–8 小时 · 8 周',
    location: '线上协作 + 图书馆讨论',
    applicants: 6,
    deadline: '2026-09-10',
    featured: true,
  },
];

const opportunities = ref<Opportunity[]>([]);
const selectedCategory = ref<Category>('all');
const searchQuery = ref('');
const loading = ref(true);
const apiOnline = ref(false);
const selectedOpportunity = ref<Opportunity | null>(null);
const savedOpportunityIds = ref<Set<string>>(new Set());
const appliedOpportunityIds = ref<Set<string>>(new Set());
const isApplicationSheetOpen = ref(false);
const applicationSubmitted = ref(false);
const shouldSendPersonalProfile = ref(true);
const applicationNote = ref('');
const initialMobileSection: MobileSection = window.location.hash === '#publish'
  ? 'publish'
  : window.location.hash === '#matching'
    ? 'matching'
  : window.location.hash === '#applications'
    ? 'applications'
  : window.location.hash === '#profile'
    ? 'profile'
    : 'opportunities';
const activeMobileSection = ref<MobileSection>(initialMobileSection);
const isMatchingEnabled = ref(loadMatchingEnabled());
const matchStage = ref<MatchStage>('idle');
const matchDailyCount = ref(loadDailyMatchCount());
const matchAnimationMessage = ref('正在读取你的方向与个人说明');
const roundMatchPeople = ref<MatchPerson[]>([]);
const activeMatchCardIndex = ref(0);
const matchingPersonList = ref<HTMLElement | null>(null);
const selectedMatchPerson = ref<MatchPerson | null>(null);
const requestedMatchIds = ref<Set<string>>(new Set(['teacher-wu']));
const isMatchSheetOpen = ref(false);
const matchRequestSubmitted = ref(false);
const matchIntent = ref('');
const shouldSendMatchProfile = ref(true);
const applicationViewRole = ref<ApplicationViewRole>('applicant');
const selectedApplicationStatus = ref<ApplicationStatus>('all');
const publisherApplicationRecords = ref(initialPublisherApplicationRecords);
const publishForm = ref({
  category: 'project' as Exclude<Category, 'all'>,
  title: '',
  description: '',
  weeklyTime: '',
  duration: '',
  location: '',
  deadline: '',
  tags: '',
});
const publishFormMessage = ref('');
const currentUserIdentity = {
  name: '林同学',
  avatar: '林',
  role: 'student' as MatchRole,
  roleLabel: '2027 届本科生',
  college: '人工智能学院',
};
const personalProfile = ref({
  headline: '校园 AI 产品与前端实践者',
  introduction: '关注校园场景中的 AI 产品，正在学习 Vue 3、TypeScript 与用户调研，希望认识愿意长期共创的老师和同学。',
  tags: ['Vue 3', 'TypeScript', 'AI 应用', '用户调研'],
  availability: '每周可投入 6–8 小时',
});
const profileDraft = ref({
  headline: '',
  introduction: '',
  tags: '',
  availability: '',
});
const profileDraftTags = computed(() => splitProfileTags(profileDraft.value.tags));
const isProfileEditorOpen = ref(false);
const profileSaveMessage = ref('');
const profilePanel = ref<ProfilePanel>('overview');
const profilePublications = ref([
  {
    id: 'profile-published-ai-agent',
    title: '校园 AI Agent 项目招募前端成员',
    category: '项目',
    summary: '一起完成面向校内服务的 AI Agent 原型，寻找愿意持续共创的前端同学。',
    applicants: 6,
    deadline: '2026-09-10',
    status: '招募中',
  },
  {
    id: 'profile-draft-research',
    title: '校园智能体用户调研伙伴',
    category: '项目',
    summary: '面向校内师生开展需求访谈与产品验证。',
    applicants: 0,
    deadline: '2026-09-20',
    status: '草稿',
  },
]);
const selectedProfilePublicationId = ref<string | null>(null);
const profilePublicationDraft = ref({ title: '', summary: '', deadline: '' });
const isProfilePublicationEditorOpen = ref(false);
const selectedProfileApplicationId = ref<string | null>(null);
const profileApplicationNotes = ref<Record<string, string>>({
  'application-ai-agent': '希望参与前端开发与交互设计，也愿意配合早期用户调研。',
  'application-challenge-cup': '有校园产品策划经历，希望负责调研和方案整理。',
  'application-research': '正在学习 Python 与计算机视觉，希望参与论文复现。',
  'match-wu-teacher': '希望请教智能交互方向的科研入门与项目实践。',
});
const profileApplicationDraft = ref('');
const isProfileApplicationEditorOpen = ref(false);
let listScrollPosition = 0;
let matchAnimationTimers: ReturnType<typeof setTimeout>[] = [];

const filteredApplicationRecords = computed(() => {
  if (selectedApplicationStatus.value === 'all') return applicationRecords.value;
  return applicationRecords.value.filter((item) => item.status === selectedApplicationStatus.value);
});

const filteredMatchPeople = computed(() => roundMatchPeople.value);

const matchRemainingCount = computed(() =>
  Math.max(0, MATCH_DAILY_LIMIT - matchDailyCount.value),
);

const filteredPublisherApplicationRecords = computed(() => {
  if (selectedApplicationStatus.value === 'all') return publisherApplicationRecords.value;
  return publisherApplicationRecords.value.filter((item) => item.status === selectedApplicationStatus.value);
});

const currentApplicationStatusLabels = computed(() => ({
  ...applicationStatusLabels,
  closed: applicationViewRole.value === 'publisher' ? '未通过' : '已结束',
}));

function selectApplicationViewRole(role: ApplicationViewRole) {
  applicationViewRole.value = role;
  selectedApplicationStatus.value = 'all';
}

function updatePublisherApplicationStatus(id: string, status: 'approved' | 'closed') {
  publisherApplicationRecords.value = publisherApplicationRecords.value.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          statusText: status === 'approved'
            ? item.kind === 'match' ? '已同意' : '已通过'
            : item.kind === 'match' ? '已婉拒' : '未通过',
        }
      : item,
  );
}

function takeRoundMatches(role: MatchRole, count: number, round: number) {
  const candidates = matchPeople.filter((person) => person.role === role);
  const resultCount = Math.min(count, candidates.length);
  const startIndex = (round - 1) % candidates.length;

  return Array.from(
    { length: resultCount },
    (_, index) => candidates[(startIndex + index) % candidates.length]!,
  );
}

function clearMatchAnimationTimers() {
  matchAnimationTimers.forEach((timer) => clearTimeout(timer));
  matchAnimationTimers = [];
}

function updateActiveMatchCard() {
  const list = matchingPersonList.value;
  if (!list) return;

  const cards = Array.from(list.querySelectorAll<HTMLElement>('.matching-person-card'));
  if (cards.length === 0) return;

  activeMatchCardIndex.value = cards.reduce((closestIndex, card, index) => {
    const currentDistance = Math.abs(cards[closestIndex]!.offsetLeft - list.scrollLeft);
    const nextDistance = Math.abs(card.offsetLeft - list.scrollLeft);
    return nextDistance < currentDistance ? index : closestIndex;
  }, 0);
}

function goToMatchCard(index: number) {
  const list = matchingPersonList.value;
  const card = list?.querySelectorAll<HTMLElement>('.matching-person-card')[index];
  if (!list || !card) return;

  activeMatchCardIndex.value = index;
  list.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
}

function startMatchRound() {
  if (!isMatchingEnabled.value || matchRemainingCount.value === 0) return;

  clearMatchAnimationTimers();
  const nextRound = matchDailyCount.value + 1;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepDuration = reduceMotion ? 40 : 430;

  matchStage.value = 'matching';
  matchAnimationMessage.value = '正在读取你的方向与个人说明';
  activeMatchCardIndex.value = 0;
  window.scrollTo(0, 0);

  matchAnimationTimers.push(
    setTimeout(() => {
      matchAnimationMessage.value = '正在寻找方向相近的老师和同学';
    }, stepDuration),
    setTimeout(() => {
      matchAnimationMessage.value = '正在检查双方的联系意愿';
    }, stepDuration * 2),
    setTimeout(() => {
      roundMatchPeople.value = [
        ...takeRoundMatches('teacher', 2, nextRound),
        ...takeRoundMatches('student', 3, nextRound),
      ];
      matchDailyCount.value = nextRound;
      localStorage.setItem('campus-match-daily-usage-v3', JSON.stringify({
        date: getLocalDayKey(),
        count: matchDailyCount.value,
      }));
      matchStage.value = 'results';
      matchAnimationTimers = [];
    }, stepDuration * 3),
  );
}

function openMatchRequest(person: MatchPerson) {
  if (requestedMatchIds.value.has(person.id)) return;
  selectedMatchPerson.value = person;
  matchIntent.value = '';
  shouldSendMatchProfile.value = true;
  matchRequestSubmitted.value = false;
  isMatchSheetOpen.value = true;
}

function closeMatchRequest() {
  isMatchSheetOpen.value = false;
}

function submitMatchRequest() {
  const person = selectedMatchPerson.value;
  if (!person || !matchIntent.value.trim()) return;

  const nextRequestedIds = new Set(requestedMatchIds.value);
  nextRequestedIds.add(person.id);
  requestedMatchIds.value = nextRequestedIds;

  if (!applicationRecords.value.some((item) => item.id === `match-${person.id}`)) {
    applicationRecords.value.unshift({
      id: `match-${person.id}`,
      kind: 'match',
      title: `希望与${person.name}建立联系`,
      college: `${person.college} · ${person.roleLabel}`,
      category: '个人匹配',
      submittedAt: '刚刚',
      status: 'pending',
      statusText: '待处理',
      update: `匹配请求已送达，等待${person.name}确认`,
    });
  }

  matchRequestSubmitted.value = true;
}

function selectMobileSection(section: MobileSection) {
  activeMobileSection.value = section;
  if (section === 'profile') profilePanel.value = 'overview';
  window.history.replaceState(null, '', `#${section}`);
  window.scrollTo(0, 0);
}

function selectProfilePanel(panel: ProfilePanel) {
  profilePanel.value = panel;
  window.scrollTo(0, 0);
}

function openMatchingSettings() {
  selectMobileSection('profile');
  profilePanel.value = 'settings';
}

function toggleMatchingEnabled() {
  isMatchingEnabled.value = !isMatchingEnabled.value;
  localStorage.setItem('campus-matching-enabled-v1', String(isMatchingEnabled.value));

  if (!isMatchingEnabled.value) {
    clearMatchAnimationTimers();
    matchStage.value = 'idle';
    roundMatchPeople.value = [];
    activeMatchCardIndex.value = 0;
    selectedMatchPerson.value = null;
    isMatchSheetOpen.value = false;
  }
}

function openProfileEditor() {
  profileDraft.value = {
    headline: personalProfile.value.headline,
    introduction: personalProfile.value.introduction,
    tags: personalProfile.value.tags.join('、'),
    availability: personalProfile.value.availability,
  };
  profileSaveMessage.value = '';
  isProfileEditorOpen.value = true;
}

function splitProfileTags(value: string) {
  return value
    .split(/[、,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function closeProfileEditor() {
  isProfileEditorOpen.value = false;
}

function savePersonalProfile() {
  const draft = profileDraft.value;
  if (!draft.headline.trim() || !draft.introduction.trim()) {
    profileSaveMessage.value = '请先填写个人方向和个人介绍';
    return;
  }

  personalProfile.value = {
    headline: draft.headline.trim(),
    introduction: draft.introduction.trim(),
    tags: splitProfileTags(draft.tags),
    availability: draft.availability.trim() || '投入时间待补充',
  };
  profileSaveMessage.value = '个人说明已更新';
  window.setTimeout(() => {
    isProfileEditorOpen.value = false;
    profileSaveMessage.value = '';
  }, 420);
}

function openProfilePublicationEditor(id: string) {
  const item = profilePublications.value.find((publication) => publication.id === id);
  if (!item) return;
  selectedProfilePublicationId.value = id;
  profilePublicationDraft.value = {
    title: item.title,
    summary: item.summary,
    deadline: item.deadline,
  };
  isProfilePublicationEditorOpen.value = true;
}

function closeProfilePublicationEditor() {
  isProfilePublicationEditorOpen.value = false;
  selectedProfilePublicationId.value = null;
}

function saveProfilePublication() {
  const id = selectedProfilePublicationId.value;
  const draft = profilePublicationDraft.value;
  if (!id || !draft.title.trim() || !draft.summary.trim() || !draft.deadline) return;
  profilePublications.value = profilePublications.value.map((item) =>
    item.id === id
      ? { ...item, title: draft.title.trim(), summary: draft.summary.trim(), deadline: draft.deadline }
      : item,
  );
  closeProfilePublicationEditor();
}

function openProfileApplicationEditor(id: string) {
  const item = applicationRecords.value.find((application) => application.id === id);
  if (!item || item.status !== 'pending') return;
  selectedProfileApplicationId.value = id;
  profileApplicationDraft.value = profileApplicationNotes.value[id] || '';
  isProfileApplicationEditorOpen.value = true;
}

function closeProfileApplicationEditor() {
  isProfileApplicationEditorOpen.value = false;
  selectedProfileApplicationId.value = null;
}

function saveProfileApplication() {
  const id = selectedProfileApplicationId.value;
  if (!id || !profileApplicationDraft.value.trim()) return;
  profileApplicationNotes.value = {
    ...profileApplicationNotes.value,
    [id]: profileApplicationDraft.value.trim(),
  };
  closeProfileApplicationEditor();
}

function savePublishDraft() {
  publishFormMessage.value = '草稿已保存到本机';
}

function submitPublishForm() {
  const form = publishForm.value;
  if (!form.title.trim() || !form.description.trim() || !form.deadline) {
    publishFormMessage.value = '请先填写标题、机会介绍和截止日期';
    return;
  }

  publishFormMessage.value = '发布信息已填写完成，后续接入审核流程';
}

const isSelectedOpportunitySaved = computed(() => {
  const id = selectedOpportunity.value?.id;
  return id ? savedOpportunityIds.value.has(id) : false;
});

function toggleSelectedOpportunitySaved() {
  const id = selectedOpportunity.value?.id;
  if (!id) return;

  const nextSavedIds = new Set(savedOpportunityIds.value);
  if (nextSavedIds.has(id)) nextSavedIds.delete(id);
  else nextSavedIds.add(id);
  savedOpportunityIds.value = nextSavedIds;
}

const isSelectedOpportunityApplied = computed(() => {
  const id = selectedOpportunity.value?.id;
  return id ? appliedOpportunityIds.value.has(id) : false;
});

function openApplicationSheet() {
  if (isSelectedOpportunityApplied.value) return;
  applicationNote.value = '';
  shouldSendPersonalProfile.value = true;
  applicationSubmitted.value = false;
  isApplicationSheetOpen.value = true;
}

function closeApplicationSheet() {
  isApplicationSheetOpen.value = false;
}

function submitApplication() {
  const id = selectedOpportunity.value?.id;
  if (!id) return;

  const nextAppliedIds = new Set(appliedOpportunityIds.value);
  nextAppliedIds.add(id);
  appliedOpportunityIds.value = nextAppliedIds;
  applicationSubmitted.value = true;
}

const detailResponsibilities = computed(() => {
  const item = selectedOpportunity.value;
  if (!item) return [];

  return [
    item.description,
    `与团队共同拆解目标，按计划完成${categoryLabels[item.category]}相关任务。`,
    '参与阶段复盘并沉淀过程材料，让这段校园经历可以被真实记录。',
  ];
});

const detailRequirements = computed(() => {
  const item = selectedOpportunity.value;
  if (!item) return [];

  return [
    `对${item.tags.join('、')}方向有兴趣，具备其中至少一项基础。`,
    `能够保证${item.commitment.replace('·', '，持续')}的稳定投入。`,
    '愿意主动沟通、按时反馈，并对共同目标保持责任感。',
  ];
});

async function openOpportunity(item: Opportunity) {
  listScrollPosition = window.scrollY;
  selectedOpportunity.value = item;
  await nextTick();
  window.scrollTo(0, 0);
}

async function closeOpportunity() {
  selectedOpportunity.value = null;
  await nextTick();
  window.scrollTo(0, listScrollPosition);
}

const filteredOpportunities = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return opportunities.value.filter((item) => {
    const categoryMatches =
      selectedCategory.value === 'all' || item.category === selectedCategory.value;
    const searchableText = [
      item.title,
      item.publisher,
      item.college,
      item.description,
      ...item.tags,
    ]
      .join(' ')
      .toLowerCase();

    return categoryMatches && (!query || searchableText.includes(query));
  });
});

async function loadOpportunities() {
  try {
    const [healthResponse, opportunitiesResponse] = await Promise.all([
      fetch('/api/health'),
      fetch('/api/opportunities'),
    ]);

    if (!healthResponse.ok || !opportunitiesResponse.ok) throw new Error('API unavailable');
    opportunities.value = (await opportunitiesResponse.json()) as Opportunity[];
    apiOnline.value = true;
  } catch {
    opportunities.value = fallback;
    apiOnline.value = false;
  } finally {
    loading.value = false;
  }
}

onMounted(loadOpportunities);
onBeforeUnmount(clearMatchAnimationTimers);
</script>

<template>
  <div v-if="selectedOpportunity" class="opportunity-detail-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回机会列表" @click="closeOpportunity">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"></path></svg>
      </button>
      <strong>机会详情</strong>
      <button type="button" aria-label="更多操作">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
          <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
        </svg>
      </button>
    </header>

    <main class="detail-content">
      <section class="detail-overview">
        <h1>{{ selectedOpportunity.title }}</h1>

        <div class="detail-meta">
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
            {{ selectedOpportunity.location }}
          </span>
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
            {{ selectedOpportunity.commitment }}
          </span>
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14"></path></svg>
            {{ selectedOpportunity.deadline }} 截止
          </span>
        </div>

        <div class="detail-kicker-row">
          <span>{{ categoryLabels[selectedOpportunity.category] }}</span>
          <strong>{{ selectedOpportunity.applicants }} 人已申请</strong>
        </div>
      </section>

      <section class="detail-publisher">
        <span class="detail-publisher-avatar" aria-hidden="true">{{ selectedOpportunity.publisher.slice(0, 1) }}</span>
        <span class="detail-publisher-copy">
          <strong>{{ selectedOpportunity.publisher }}</strong>
          <small>{{ selectedOpportunity.college }} · 校内身份已认证</small>
        </span>
        <span class="detail-chevron" aria-hidden="true">›</span>
      </section>

      <section class="detail-body">
        <h2>机会详情</h2>
        <div class="detail-tags" aria-label="机会标签">
          <span>{{ categoryLabels[selectedOpportunity.category] }}</span>
          <span v-for="part in selectedOpportunity.commitment.split('·')" :key="part">{{ part.trim() }}</span>
          <span v-for="tag in selectedOpportunity.tags" :key="tag">{{ tag }}</span>
        </div>

        <div class="detail-copy-section">
          <h3>机会介绍</h3>
          <p>{{ selectedOpportunity.description }}</p>
        </div>

        <div class="detail-copy-section">
          <h3>你将参与</h3>
          <ol>
            <li v-for="item in detailResponsibilities" :key="item">{{ item }}</li>
          </ol>
        </div>

        <div class="detail-copy-section">
          <h3>期待你具备</h3>
          <ol>
            <li v-for="item in detailRequirements" :key="item">{{ item }}</li>
          </ol>
        </div>
      </section>
    </main>

    <footer class="detail-apply-bar">
      <button
        class="detail-save-button"
        :class="{ 'is-saved': isSelectedOpportunitySaved }"
        type="button"
        :aria-label="isSelectedOpportunitySaved ? '取消收藏机会' : '收藏机会'"
        :aria-pressed="isSelectedOpportunitySaved"
        @click="toggleSelectedOpportunitySaved"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"></path></svg>
        <span>{{ isSelectedOpportunitySaved ? '已收藏' : '收藏' }}</span>
      </button>
      <button
        class="detail-apply-button"
        type="button"
        :disabled="isSelectedOpportunityApplied"
        @click="openApplicationSheet"
      >
        {{ isSelectedOpportunityApplied ? '已申请' : '申请加入' }}
      </button>
    </footer>

    <div
      v-if="isApplicationSheetOpen"
      class="application-sheet-backdrop"
      @click.self="closeApplicationSheet"
    >
      <section
        class="application-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-sheet-title"
      >
        <div class="application-sheet-handle" aria-hidden="true"></div>

        <template v-if="!applicationSubmitted">
          <header class="application-sheet-header">
            <div>
              <h2 id="application-sheet-title">申请加入</h2>
              <p>向发起人简单介绍一下自己</p>
            </div>
            <button type="button" aria-label="关闭申请窗口" @click="closeApplicationSheet">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>
            </button>
          </header>

          <div class="application-opportunity-summary">
            <span>{{ categoryLabels[selectedOpportunity.category] }}</span>
            <strong>{{ selectedOpportunity.title }}</strong>
          </div>

          <form class="application-form" @submit.prevent="submitApplication">
            <label class="application-note-field">
              <span>申请说明 <small>选填</small></span>
              <textarea
                v-model="applicationNote"
                maxlength="180"
                placeholder="介绍你为什么想参与，以及与这个机会相关的经历"
              ></textarea>
              <small>{{ applicationNote.length }}/180</small>
            </label>

            <label class="application-profile-toggle">
              <span>
                <strong>附带个人说明</strong>
                <small>类似个人简历，可在“我的”中编辑</small>
              </span>
              <input v-model="shouldSendPersonalProfile" type="checkbox" />
              <i aria-hidden="true"></i>
            </label>

            <div class="application-dingtalk-note">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6z"></path><path d="m9 12 2 2 4-5"></path></svg>
              <span>申请通过后发起人可与你联系</span>
            </div>

            <button class="application-submit-button" type="submit">
              确认申请
            </button>
          </form>
        </template>

        <div v-else class="application-success" role="status">
          <div class="application-success-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"></path></svg>
          </div>
          <h2 id="application-sheet-title">申请已提交</h2>
          <p>申请通过后发起人可与你联系</p>
          <button type="button" @click="closeApplicationSheet">完成</button>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="校园机会首页">
        <span class="brand-mark">校</span>
        <span>
          <strong>校园机会</strong>
          <small>在校园，找到一起做事的人</small>
        </span>
      </a>

      <nav class="desktop-nav" aria-label="主导航">
        <a class="active" href="#opportunities">找机会</a>
        <a href="#publish">发机会</a>
        <a href="#applications">我的申请</a>
      </nav>

      <button class="profile-button" type="button" @click="selectMobileSection('profile')">
        <span class="avatar">陈</span>
        <span>我的档案</span>
      </button>
    </header>

    <main v-if="activeMobileSection === 'opportunities'">
      <section class="mobile-home" aria-label="手机端机会首页">
        <form class="mobile-search" role="search" @submit.prevent>
          <span class="mobile-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="11" cy="11" r="6.5"></circle>
              <path d="m16 16 4 4"></path>
            </svg>
          </span>
          <span class="mobile-search-field">
            <input
              v-model="searchQuery"
              type="search"
              aria-label="搜索校园机会"
              placeholder="搜索机会"
              autocomplete="off"
            />
            <button
              v-if="searchQuery"
              class="mobile-search-clear"
              type="button"
              aria-label="清除搜索"
              @click="searchQuery = ''"
            >×</button>
          </span>
          <span class="mobile-search-divider" aria-hidden="true"></span>
          <button class="mobile-search-submit" type="submit">搜索</button>
        </form>

        <div class="mobile-highlight" aria-label="本周新增 18 个校园机会">
          <div class="mobile-highlight-header">
            <span class="mobile-highlight-label">
              <strong>本周机会速览</strong>
              <small>近 7 日</small>
            </span>
          </div>
          <p class="mobile-highlight-main">
            <strong>18</strong>
            <span>个校园机会正在招募</span>
          </p>
          <div class="mobile-highlight-coverage" aria-label="覆盖项目、竞赛、科研、创业和学业机会">
            <span>项目 · 竞赛 · 科研 · 创业 · 学业</span>
            <small><i aria-hidden="true"></i>持续更新</small>
          </div>
        </div>
      </section>

      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">CAMPUS OPPORTUNITY</p>
          <h1>不只找岗位，<br /><em>找到真正想一起做事的人。</em></h1>
          <p class="hero-description">
            项目、竞赛、科研、创业与校园组织，都可以在这里发布机会、发现伙伴并开始合作。
          </p>
          <div class="hero-actions">
            <button class="primary-button" type="button">浏览校园机会</button>
            <button class="secondary-button" type="button">发布一个机会</button>
          </div>
          <div class="trust-row">
            <span>✓ 校园组织身份</span>
            <span>✓ 双向选择</span>
            <span>✓ 合作经历沉淀</span>
          </div>
        </div>

        <aside class="hero-card" aria-label="精选机会">
          <div class="hero-card-top">
            <span class="live-dot"></span>
            <span>本周精选机会</span>
            <small>18 个新机会</small>
          </div>
          <article>
            <span class="category-badge">项目</span>
            <h2>校园 AI Agent 项目</h2>
            <p>招募前端与产品成员，一起完成可落地的校内服务原型。</p>
            <div class="mini-people">
              <span>林</span><span>周</span><span>王</span>
              <small>已有 3 位成员</small>
            </div>
          </article>
          <div class="hero-card-footer">
            <span>匹配你的技能</span>
            <strong>Vue 3 · TypeScript</strong>
          </div>
        </aside>
      </section>

      <section id="opportunities" class="opportunity-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow desktop-only">EXPLORE</p>
            <h2><span class="desktop-only">正在招募的校园机会</span><span class="mobile-only">推荐给你</span></h2>
            <p class="mobile-section-note">根据你的技能与偏好推荐</p>
          </div>
          <div class="api-status" :class="{ offline: !apiOnline }">
            <span></span>{{ apiOnline ? '后端服务已连接' : '正在展示本地预览数据' }}
          </div>
        </div>

        <div class="category-filter" role="tablist" aria-label="机会分类">
          <button
            v-for="(label, category) in categoryLabels"
            :key="category"
            type="button"
            :class="{ active: selectedCategory === category }"
            @click="selectedCategory = category"
          >
            {{ label }}
          </button>
        </div>

        <div v-if="loading" class="loading-state">正在连接校园机会服务…</div>

        <div v-else class="opportunity-grid">
          <article
            v-for="item in filteredOpportunities"
            :key="item.id"
            class="opportunity-card"
            role="button"
            tabindex="0"
            :aria-label="`查看${item.title}详情`"
            @click="openOpportunity(item)"
            @keydown.enter="openOpportunity(item)"
          >
            <div class="opportunity-card-top">
              <h3>{{ item.title }}</h3>
              <strong class="card-applicants">{{ item.applicants }}人申请</strong>
            </div>

            <p class="card-summary">
              {{ item.college }} · {{ categoryLabels[item.category] }} · {{ item.deadline }} 截止
            </p>

            <div class="tags">
              <span>{{ categoryLabels[item.category] }}</span>
              <span v-for="part in item.commitment.split('·')" :key="part">{{ part.trim() }}</span>
              <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
            </div>

            <footer>
              <div class="publisher-profile">
                <span class="publisher-avatar" aria-hidden="true">{{ item.publisher.slice(0, 1) }}</span>
                <span class="publisher-details">
                  <strong>{{ item.publisher }}</strong>
                </span>
              </div>
              <span class="card-location">{{ item.location }}</span>
            </footer>
          </article>
        </div>

        <div v-if="!loading && filteredOpportunities.length === 0" class="empty-state">
          <strong>没有找到相关机会</strong>
          <span>换一个关键词或分类试试。</span>
        </div>
      </section>
    </main>

    <main v-else-if="activeMobileSection === 'matching'" class="matching-page" aria-label="AI 个人匹配">
      <section v-if="!isMatchingEnabled" class="matching-state-page matching-start-card matching-disabled-card">
        <div class="matching-disabled-visual" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M8 11V8a4 4 0 0 1 7.5-2M7 11h10a2 2 0 0 1 2 2v6H5v-6a2 2 0 0 1 2-2Z"></path><path d="m4 4 16 16"></path></svg>
        </div>
        <small>MATCHING PAUSED</small>
        <h1>匹配功能已关闭</h1>
        <p>你的个人卡片不会出现在其他人的匹配结果中，当前也无法开始新的匹配。</p>
        <button type="button" @click="openMatchingSettings">前往设置</button>
      </section>

      <section v-else-if="matchStage === 'idle'" class="matching-state-page matching-start-card">
        <div class="matching-start-visual" aria-hidden="true">
          <span class="matching-start-orbit orbit-one"></span>
          <span class="matching-start-orbit orbit-two"></span>
          <span class="matching-start-core">
            <svg viewBox="0 0 24 24"><path d="m12 3 1.5 4.1L18 9l-4.5 1.9L12 15l-1.5-4.1L6 9l4.5-1.9z"></path><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"></path></svg>
          </span>
          <i class="matching-start-person person-one">师</i>
          <i class="matching-start-person person-two">生</i>
          <i class="matching-start-person person-three">生</i>
        </div>
        <small>AI PERSON MATCHING</small>
        <h1>开始一轮个人匹配</h1>
        <p>根据你的个人说明、能力方向和联系意愿，寻找值得请教或适合一起做事的人。</p>
        <div class="matching-basis" aria-label="匹配依据">
          <span><i aria-hidden="true"></i>个人说明</span>
          <span><i aria-hidden="true"></i>能力方向</span>
          <span><i aria-hidden="true"></i>联系意愿</span>
        </div>
        <button type="button" :disabled="matchRemainingCount === 0" @click="startMatchRound">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.5 4.1L18 9l-4.5 1.9L12 15l-1.5-4.1L6 9l4.5-1.9z"></path></svg>
          {{ matchRemainingCount === 0 ? '今日次数已用完' : '开始匹配' }}
        </button>
        <small class="matching-start-note">
          每天最多匹配 3 次 <i aria-hidden="true"></i> 今日还可匹配 <strong>{{ matchRemainingCount }}</strong> 次
        </small>
      </section>

      <section v-else-if="matchStage === 'matching'" class="matching-state-page matching-animation-card" aria-live="polite" aria-busy="true">
        <div class="matching-radar" aria-hidden="true">
          <span class="matching-radar-ring ring-one"></span>
          <span class="matching-radar-ring ring-two"></span>
          <span class="matching-radar-ring ring-three"></span>
          <span class="matching-radar-sweep"></span>
          <span class="matching-radar-core">
            <svg viewBox="0 0 24 24"><path d="m12 3 1.5 4.1L18 9l-4.5 1.9L12 15l-1.5-4.1L6 9l4.5-1.9z"></path></svg>
          </span>
          <i class="matching-radar-dot dot-one"></i>
          <i class="matching-radar-dot dot-two"></i>
          <i class="matching-radar-dot dot-three"></i>
        </div>
        <h1>正在为你匹配</h1>
        <p>{{ matchAnimationMessage }}</p>
        <span class="matching-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      </section>

      <section v-else class="matching-state-page matching-results-stage matching-results-enter">
        <section
          ref="matchingPersonList"
          class="matching-person-list"
          aria-live="polite"
          @scroll.passive="updateActiveMatchCard"
        >
          <article v-for="person in filteredMatchPeople" :key="person.id" class="matching-person-card">
            <header>
              <span class="matching-person-avatar" aria-hidden="true">{{ person.avatar }}</span>
              <span class="matching-person-identity">
                <span class="matching-person-name-row">
                  <strong>{{ person.name }}</strong>
                  <em :class="person.role">{{ person.role === 'teacher' ? '老师' : '学生' }}</em>
                </span>
                <small>{{ person.college }} · {{ person.roleLabel }}</small>
              </span>
              <span class="matching-score"><strong>{{ person.score }}%</strong><small>匹配度</small></span>
            </header>

            <div class="matching-person-body">
              <div class="matching-person-focus">
                <small>方向</small>
                <strong>{{ person.focus }}</strong>
              </div>
              <p>{{ person.introduction }}</p>

              <div class="matching-person-tags" aria-label="个人标签">
                <span v-for="tag in person.tags" :key="tag">{{ tag }}</span>
              </div>

              <div class="matching-person-availability">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
                <span>{{ person.availability }}</span>
              </div>
            </div>

            <footer>
              <small>{{ requestedMatchIds.has(person.id) ? '等待对方回应' : '同意后即可联系' }}</small>
              <button
                type="button"
                :disabled="requestedMatchIds.has(person.id)"
                @click="openMatchRequest(person)"
              >{{ requestedMatchIds.has(person.id) ? '已发出' : '表明来意' }}</button>
            </footer>
          </article>
        </section>

        <nav class="matching-carousel-pagination matching-results-enter" aria-label="匹配结果页码">
          <span>
            <button
              v-for="(_, index) in filteredMatchPeople"
              :key="index"
              type="button"
              :class="{ active: activeMatchCardIndex === index }"
              :aria-label="`查看第 ${index + 1} 位匹配对象`"
              @click="goToMatchCard(index)"
            ></button>
          </span>
          <small>左右滑动查看 {{ activeMatchCardIndex + 1 }}/{{ filteredMatchPeople.length }}</small>
        </nav>

        <button
          class="matching-rematch-button"
          type="button"
          :disabled="matchRemainingCount === 0"
          @click="startMatchRound"
        >{{ matchRemainingCount === 0 ? '今日次数已用完' : '再来一轮' }}</button>
      </section>

      <div
        v-if="isMatchSheetOpen && selectedMatchPerson"
        class="application-sheet-backdrop"
        @click.self="closeMatchRequest"
      >
        <section class="application-sheet" role="dialog" aria-modal="true" aria-labelledby="match-sheet-title">
          <div class="application-sheet-handle" aria-hidden="true"></div>

          <template v-if="!matchRequestSubmitted">
            <header class="application-sheet-header">
              <div>
                <h2 id="match-sheet-title">发起个人匹配</h2>
                <p>先表明来意，对方同意后才能联系</p>
              </div>
              <button type="button" aria-label="关闭匹配窗口" @click="closeMatchRequest">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>
              </button>
            </header>

            <div class="match-request-person">
              <span class="matching-person-avatar" aria-hidden="true">{{ selectedMatchPerson.avatar }}</span>
              <span>
                <strong>{{ selectedMatchPerson.name }}</strong>
                <small>{{ selectedMatchPerson.college }} · {{ selectedMatchPerson.roleLabel }}</small>
              </span>
              <em>{{ selectedMatchPerson.score }}% 匹配</em>
            </div>

            <form class="application-form" @submit.prevent="submitMatchRequest">
              <label class="application-note-field">
                <span>你的来意 <small>必填</small></span>
                <textarea
                  v-model="matchIntent"
                  maxlength="180"
                  placeholder="例如：想请教科研方向、交流项目经验，或邀请对方一起共创"
                ></textarea>
                <small>{{ matchIntent.length }}/180</small>
              </label>

              <label class="application-profile-toggle">
                <span>
                  <strong>发送个人说明</strong>
                  <small>帮助对方了解你的经历，可在“我的”中编辑</small>
                </span>
                <input v-model="shouldSendMatchProfile" type="checkbox" />
                <i aria-hidden="true"></i>
              </label>

              <div class="application-dingtalk-note">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6z"></path><path d="m9 12 2 2 4-5"></path></svg>
                <span>对方同意后，你们才可以通过钉钉联系</span>
              </div>

              <button class="application-submit-button" type="submit" :disabled="!matchIntent.trim()">
                发送匹配请求
              </button>
            </form>
          </template>

          <div v-else class="application-success" role="status">
            <div class="application-success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"></path></svg>
            </div>
            <h2 id="match-sheet-title">匹配请求已发送</h2>
            <p>可在“申请－我发出的”中查看进度，对方同意后即可联系。</p>
            <button type="button" @click="closeMatchRequest">完成</button>
          </div>
        </section>
      </div>
    </main>

    <main v-else-if="activeMobileSection === 'publish'" class="publish-page" aria-label="发布校园机会">
      <header class="publish-page-header">
        <div>
          <small>CREATE OPPORTUNITY</small>
          <h1>发布校园机会</h1>
          <p>把需要的人、要做的事和投入要求说清楚。</p>
        </div>
        <button type="button" aria-label="更多发布设置">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="19" cy="12" r="1.4"></circle></svg>
        </button>
      </header>

      <form class="publish-form" @submit.prevent="submitPublishForm">
        <section class="publish-form-card">
          <div class="publish-field-heading">
            <strong>机会类型</strong>
            <small>选择最符合的一个分类</small>
          </div>
          <div class="publish-category-options" role="radiogroup" aria-label="机会类型">
            <label v-for="category in (['project', 'competition', 'research', 'startup', 'study'] as const)" :key="category">
              <input v-model="publishForm.category" type="radio" name="publish-category" :value="category" />
              <span>{{ categoryLabels[category] }}</span>
            </label>
          </div>
        </section>

        <section class="publish-form-card publish-main-fields">
          <label class="publish-field">
            <span>机会标题 <small>必填</small></span>
            <input v-model="publishForm.title" maxlength="60" placeholder="例如：校园 AI 项目招募前端成员" />
            <i>{{ publishForm.title.length }}/60</i>
          </label>

          <label class="publish-field">
            <span>机会介绍 <small>必填</small></span>
            <textarea v-model="publishForm.description" maxlength="500" placeholder="说明要做什么、希望找到怎样的伙伴，以及参与者能获得什么"></textarea>
            <i>{{ publishForm.description.length }}/500</i>
          </label>
        </section>

        <section class="publish-form-card">
          <div class="publish-field-heading">
            <strong>投入与时间</strong>
            <small>帮助同学判断是否适合参与</small>
          </div>
          <div class="publish-two-column">
            <label class="publish-field">
              <span>每周投入</span>
              <input v-model="publishForm.weeklyTime" placeholder="如 6–8 小时" />
            </label>
            <label class="publish-field">
              <span>预计周期</span>
              <input v-model="publishForm.duration" placeholder="如 8 周" />
            </label>
          </div>
          <label class="publish-field">
            <span>地点或协作方式</span>
            <input v-model="publishForm.location" placeholder="如线上协作 + 图书馆讨论" />
          </label>
          <label class="publish-field">
            <span>申请截止日期 <small>必填</small></span>
            <input v-model="publishForm.deadline" type="date" />
          </label>
        </section>

        <section class="publish-form-card">
          <label class="publish-field">
            <span>能力标签</span>
            <input v-model="publishForm.tags" placeholder="用逗号分隔，如 Vue 3、调研、路演" />
          </label>
          <div class="publish-identity-note">
            <span class="publish-avatar" aria-hidden="true">林</span>
            <span>
              <strong>林同学 · 人工智能学院</strong>
              <small>将使用校内钉钉认证身份发布</small>
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 2 2 4-5"></path><circle cx="12" cy="12" r="9"></circle></svg>
          </div>
        </section>

        <p v-if="publishFormMessage" class="publish-form-message" role="status">{{ publishFormMessage }}</p>

        <div class="publish-form-actions">
          <button type="button" @click="savePublishDraft">保存草稿</button>
          <button type="submit">确认发布</button>
        </div>
      </form>
    </main>

    <main v-else-if="activeMobileSection === 'profile'" class="profile-page" aria-label="我的">
      <template v-if="profilePanel === 'overview'">
        <section class="profile-identity-card">
          <span class="profile-large-avatar" aria-hidden="true">{{ currentUserIdentity.avatar }}</span>
          <div class="profile-identity-copy">
            <h2>{{ currentUserIdentity.name }}</h2>
            <p>{{ currentUserIdentity.college }} · {{ currentUserIdentity.roleLabel }}</p>
          </div>
          <button type="button" aria-label="编辑基本资料">›</button>
          <div class="profile-level-bar" aria-label="校园成长等级">
            <span><small>校园成长等级</small><strong>Lv.3 共创者</strong></span>
            <div><i><b></b></i><small>68%</small></div>
          </div>
        </section>

        <section class="profile-data-strip" aria-label="我的校园数据">
          <button type="button" @click="selectProfilePanel('published')"><strong>{{ profilePublications.length }}</strong><span>我的发布</span></button>
          <i aria-hidden="true"></i>
          <button type="button" @click="selectProfilePanel('applications')"><strong>{{ applicationRecords.length }}</strong><span>我的申请</span></button>
          <i aria-hidden="true"></i>
          <button type="button"><strong>{{ savedOpportunityIds.size }}</strong><span>我的收藏</span></button>
        </section>

        <section class="profile-resume-card">
          <header>
            <span>
              <small>以下内容会直接展示在匹配卡片中</small>
              <h2>个人说明</h2>
            </span>
            <button type="button" @click="openProfileEditor">编辑卡片</button>
          </header>
          <div class="profile-completion">
            <span><strong>资料完善度</strong><small>82%</small></span>
            <i><b></b></i>
          </div>
          <div class="profile-resume-body">
            <strong>{{ personalProfile.headline }}</strong>
            <p>{{ personalProfile.introduction }}</p>
            <div class="profile-skill-tags" aria-label="个人能力标签">
              <span v-for="tag in personalProfile.tags" :key="tag">{{ tag }}</span>
            </div>
            <div class="profile-availability">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
              <span>{{ personalProfile.availability }}</span>
            </div>
          </div>
        </section>

        <section class="profile-menu-card profile-settings-card" aria-label="账户与服务">
          <button type="button" @click="selectProfilePanel('settings')">
            <span class="profile-menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg></span>
            <span><strong>设置</strong></span>
            <b>›</b>
          </button>
          <button type="button">
            <span class="profile-menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.1.9-1.1 1.8M12 17h.01"></path></svg></span>
            <span><strong>帮助与反馈</strong></span>
            <b>›</b>
          </button>
        </section>
      </template>

      <template v-else-if="profilePanel === 'published'">
        <header class="profile-subpage-header">
          <button type="button" aria-label="返回我的" @click="selectProfilePanel('overview')">‹</button>
          <span><h1>我的发布</h1></span>
        </header>
        <section class="profile-manage-list">
          <article v-for="item in profilePublications" :key="item.id" class="profile-manage-card">
            <header><span>{{ item.category }}</span><em :class="{ draft: item.status === '草稿' }">{{ item.status }}</em></header>
            <h2>{{ item.title }}</h2>
            <p>{{ item.summary }}</p>
            <div><span>{{ item.deadline }} 截止</span><span>{{ item.applicants }} 人申请</span></div>
            <footer>
              <small>{{ item.status === '草稿' ? '完善后即可发布' : '修改后会更新展示内容' }}</small>
              <button type="button" @click="openProfilePublicationEditor(item.id)">编辑发布</button>
            </footer>
          </article>
        </section>
      </template>

      <template v-else-if="profilePanel === 'applications'">
        <header class="profile-subpage-header">
          <button type="button" aria-label="返回我的" @click="selectProfilePanel('overview')">‹</button>
          <span><h1>我的申请</h1></span>
        </header>
        <section class="profile-manage-list">
          <article v-for="item in applicationRecords" :key="item.id" class="profile-manage-card profile-application-manage-card">
            <header>
              <span :class="{ match: item.kind === 'match' }">{{ item.kind === 'match' ? '个人匹配' : '机会申请' }}</span>
              <em :class="`status-${item.status}`">{{ item.statusText }}</em>
            </header>
            <h2>{{ item.title }}</h2>
            <p>{{ profileApplicationNotes[item.id] || item.update }}</p>
            <div><span>{{ item.college }}</span><span>{{ item.submittedAt }}</span></div>
            <footer>
              <small>{{ item.status === 'pending' ? '对方处理前可修改申请说明' : '该申请已被处理，不能再修改' }}</small>
              <button v-if="item.status === 'pending'" type="button" @click="openProfileApplicationEditor(item.id)">修改申请</button>
              <span v-else>仅查看</span>
            </footer>
          </article>
        </section>
      </template>

      <template v-else>
        <header class="profile-subpage-header">
          <button type="button" aria-label="返回我的" @click="selectProfilePanel('overview')">‹</button>
          <span><h1>设置</h1></span>
        </header>
        <section class="profile-preference-card" aria-label="匹配设置">
          <div class="profile-preference-copy">
            <strong>开启个人匹配</strong>
            <small>{{ isMatchingEnabled ? '其他师生可以在匹配中找到你' : '你的卡片已停止参与匹配' }}</small>
          </div>
          <button
            class="profile-switch"
            type="button"
            role="switch"
            :aria-checked="isMatchingEnabled"
            :aria-label="isMatchingEnabled ? '关闭个人匹配' : '开启个人匹配'"
            :class="{ active: isMatchingEnabled }"
            @click="toggleMatchingEnabled"
          ><i aria-hidden="true"></i></button>
        </section>
        <p class="profile-preference-note">关闭后，你不会被其他人匹配到，同时匹配页面也将暂停使用。</p>
      </template>

      <div v-if="isProfileEditorOpen" class="application-sheet-backdrop" @click.self="closeProfileEditor">
        <section class="application-sheet profile-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
          <div class="application-sheet-handle" aria-hidden="true"></div>
          <header class="application-sheet-header">
            <div>
              <h2 id="profile-editor-title">编辑个人说明</h2>
              <p>你填写的内容会同步成为匹配页展示卡片</p>
            </div>
            <button type="button" aria-label="关闭个人说明编辑" @click="closeProfileEditor">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>
            </button>
          </header>
          <section class="profile-match-card-preview" aria-label="匹配卡片实时预览">
            <header>
              <span class="matching-person-avatar" aria-hidden="true">{{ currentUserIdentity.avatar }}</span>
              <span class="matching-person-identity">
                <span class="matching-person-name-row">
                  <strong>{{ currentUserIdentity.name }}</strong>
                  <em :class="currentUserIdentity.role">{{ currentUserIdentity.role === 'teacher' ? '老师' : '学生' }}</em>
                </span>
                <small>{{ currentUserIdentity.college }} · {{ currentUserIdentity.roleLabel }}</small>
              </span>
              <small>实时预览</small>
            </header>
            <div class="profile-match-preview-body">
              <div class="matching-person-focus">
                <small>方向</small>
                <strong>{{ profileDraft.headline.trim() || '填写你的个人方向' }}</strong>
              </div>
              <p>{{ profileDraft.introduction.trim() || '填写个人介绍后，将在这里展示你的经历、能力和希望认识的人。' }}</p>
              <div v-if="profileDraftTags.length" class="matching-person-tags" aria-label="预览能力标签">
                <span v-for="tag in profileDraftTags" :key="tag">{{ tag }}</span>
              </div>
              <div class="matching-person-availability">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
                <span>{{ profileDraft.availability.trim() || '可投入时间待补充' }}</span>
              </div>
            </div>
            <footer>匹配度由系统根据双方资料生成</footer>
          </section>
          <form class="profile-editor-form" @submit.prevent="savePersonalProfile">
            <label class="publish-field">
              <span>个人方向 <small>必填</small></span>
              <input v-model="profileDraft.headline" maxlength="32" placeholder="一句话说明你的方向" />
            </label>
            <label class="publish-field">
              <span>个人介绍 <small>必填</small></span>
              <textarea v-model="profileDraft.introduction" maxlength="240" placeholder="介绍你的经历、能力和想认识的人"></textarea>
              <i>{{ profileDraft.introduction.length }}/240</i>
            </label>
            <label class="publish-field">
              <span>能力标签</span>
              <input v-model="profileDraft.tags" placeholder="用逗号或顿号分隔，最多 8 个" />
            </label>
            <label class="publish-field">
              <span>可投入时间</span>
              <input v-model="profileDraft.availability" placeholder="例如：每周可投入 6–8 小时" />
            </label>
            <p v-if="profileSaveMessage" class="profile-save-message" role="status">{{ profileSaveMessage }}</p>
            <button class="application-submit-button" type="submit">保存个人说明</button>
          </form>
        </section>
      </div>

      <div v-if="isProfilePublicationEditorOpen" class="application-sheet-backdrop" @click.self="closeProfilePublicationEditor">
        <section class="application-sheet profile-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="publication-editor-title">
          <div class="application-sheet-handle" aria-hidden="true"></div>
          <header class="application-sheet-header">
            <div><h2 id="publication-editor-title">编辑发布</h2><p>修改后会同步更新这条校园机会</p></div>
            <button type="button" aria-label="关闭发布编辑" @click="closeProfilePublicationEditor"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>
          </header>
          <form class="profile-editor-form" @submit.prevent="saveProfilePublication">
            <label class="publish-field"><span>机会标题 <small>必填</small></span><input v-model="profilePublicationDraft.title" maxlength="60" /></label>
            <label class="publish-field"><span>机会介绍 <small>必填</small></span><textarea v-model="profilePublicationDraft.summary" maxlength="300"></textarea><i>{{ profilePublicationDraft.summary.length }}/300</i></label>
            <label class="publish-field"><span>申请截止日期 <small>必填</small></span><input v-model="profilePublicationDraft.deadline" type="date" /></label>
            <button class="application-submit-button" type="submit" :disabled="!profilePublicationDraft.title.trim() || !profilePublicationDraft.summary.trim() || !profilePublicationDraft.deadline">保存修改</button>
          </form>
        </section>
      </div>

      <div v-if="isProfileApplicationEditorOpen" class="application-sheet-backdrop" @click.self="closeProfileApplicationEditor">
        <section class="application-sheet profile-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-application-editor-title">
          <div class="application-sheet-handle" aria-hidden="true"></div>
          <header class="application-sheet-header">
            <div><h2 id="profile-application-editor-title">修改申请</h2><p>对方处理前可以更新申请说明</p></div>
            <button type="button" aria-label="关闭申请编辑" @click="closeProfileApplicationEditor"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>
          </header>
          <form class="profile-editor-form" @submit.prevent="saveProfileApplication">
            <label class="publish-field"><span>申请说明 <small>必填</small></span><textarea v-model="profileApplicationDraft" maxlength="240" placeholder="补充你希望参与的原因和相关经历"></textarea><i>{{ profileApplicationDraft.length }}/240</i></label>
            <button class="application-submit-button" type="submit" :disabled="!profileApplicationDraft.trim()">保存修改</button>
          </form>
        </section>
      </div>
    </main>

    <main v-else class="applications-page" aria-label="申请与匹配">
      <section class="application-role-switch" aria-label="申请身份切换">
        <button
          type="button"
          :class="{ active: applicationViewRole === 'applicant' }"
          :aria-pressed="applicationViewRole === 'applicant'"
          @click="selectApplicationViewRole('applicant')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"></path><path d="M14 3v4h4M9 13l2 2 4-5"></path></svg>
          <span><strong>我发出的</strong><small>申请与匹配请求</small></span>
        </button>
        <button
          type="button"
          :class="{ active: applicationViewRole === 'publisher' }"
          :aria-pressed="applicationViewRole === 'publisher'"
          @click="selectApplicationViewRole('publisher')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19v-2.2c0-2 1.7-3.8 4-3.8h2M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM14 6h6M17 3v6M14 14h6M14 18h6"></path></svg>
          <span><strong>我收到的</strong><small>等待我处理的请求</small></span>
        </button>
      </section>

      <section class="application-status-tabs" role="tablist" aria-label="申请状态筛选">
        <button
          v-for="(label, status) in currentApplicationStatusLabels"
          :key="status"
          type="button"
          role="tab"
          :aria-selected="selectedApplicationStatus === status"
          :class="{ active: selectedApplicationStatus === status }"
          @click="selectedApplicationStatus = status"
        >
          {{ label }}
        </button>
      </section>

      <section v-if="applicationViewRole === 'applicant'" class="application-record-list" aria-live="polite">
        <article v-for="item in filteredApplicationRecords" :key="item.id" class="application-record-card">
          <div class="application-record-top">
            <span class="application-record-category" :class="{ 'source-match': item.kind === 'match' }">
              {{ item.kind === 'match' ? '个人匹配' : '机会申请' }}
            </span>
            <span class="application-record-time">发出于 {{ item.submittedAt }}</span>
            <strong :class="`status-${item.status}`">{{ item.statusText }}</strong>
          </div>

          <h2>{{ item.title }}</h2>
          <p class="application-record-college">{{ item.college }}</p>

          <div class="application-record-update" :class="`status-${item.status}`">
            <i aria-hidden="true"></i>
            <span>{{ item.update }}</span>
          </div>

          <footer>
            <button type="button">{{ item.kind === 'match' ? '查看来意' : '查看申请' }}</button>
            <button v-if="item.status === 'approved'" class="application-contact-button" type="button">
              {{ item.kind === 'match' ? '联系对方' : '联系发起人' }}
            </button>
            <span v-else-if="item.status === 'pending'">对方处理后会通知你</span>
            <span v-else>请求记录已归档</span>
          </footer>
        </article>

        <div v-if="filteredApplicationRecords.length === 0" class="application-record-empty">
          <strong>暂无相关申请</strong>
          <span>该状态下还没有申请记录。</span>
        </div>
      </section>

      <section v-else class="application-record-list publisher-application-list" aria-live="polite">
        <article v-for="item in filteredPublisherApplicationRecords" :key="item.id" class="application-record-card publisher-application-card">
          <div class="application-record-top">
            <span class="application-record-category" :class="{ 'source-match': item.kind === 'match' }">
              {{ item.kind === 'match' ? '个人匹配' : '机会申请' }}
            </span>
            <span class="application-record-time">收到于 {{ item.submittedAt }}</span>
            <strong :class="`status-${item.status}`">{{ item.statusText }}</strong>
          </div>

          <div class="publisher-applicant-profile">
            <span class="publisher-applicant-avatar" aria-hidden="true">{{ item.avatar }}</span>
            <span>
              <strong>{{ item.applicant }}</strong>
              <small>{{ item.college }}</small>
            </span>
            <em v-if="item.hasProfile">附个人说明</em>
          </div>

          <p class="publisher-application-target">{{ item.kind === 'match' ? '来意' : '申请' }}：{{ item.opportunity }}</p>

          <div class="publisher-application-tags">
            <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
          </div>

          <blockquote>{{ item.note }}</blockquote>

          <footer>
            <button type="button">{{ item.hasProfile ? '查看个人说明' : '查看详情' }}</button>
            <span v-if="item.status === 'pending'" class="publisher-pending-actions">
              <button type="button" @click="updatePublisherApplicationStatus(item.id, 'closed')">{{ item.kind === 'match' ? '婉拒' : '暂不合适' }}</button>
              <button type="button" @click="updatePublisherApplicationStatus(item.id, 'approved')">{{ item.kind === 'match' ? '同意匹配' : '通过申请' }}</button>
            </span>
            <button v-else-if="item.status === 'approved'" class="application-contact-button" type="button">{{ item.kind === 'match' ? '联系对方' : '联系申请者' }}</button>
            <span v-else>请求已归档</span>
          </footer>
        </article>

        <div v-if="filteredPublisherApplicationRecords.length === 0" class="application-record-empty">
          <strong>暂无相关申请</strong>
          <span>该状态下还没有收到申请。</span>
        </div>
      </section>
    </main>

    <nav class="mobile-nav" aria-label="移动端导航">
      <a :class="{ active: activeMobileSection === 'opportunities' }" href="#opportunities" @click.prevent="selectMobileSection('opportunities')">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="3"></rect><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2"></path></svg>
        </span>
        <span class="nav-label">机会</span>
      </a>
      <a :class="{ active: activeMobileSection === 'matching' }" href="#matching" @click.prevent="selectMobileSection('matching')">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"></circle><circle cx="16" cy="8" r="3"></circle><path d="M3 19c.5-3 2.2-5 5-5 1.8 0 3.1.8 4 2M12 16c.9-1.2 2.2-2 4-2 2.8 0 4.5 2 5 5"></path></svg>
        </span>
        <span class="nav-label">匹配</span>
      </a>
      <a class="publish-nav" :class="{ active: activeMobileSection === 'publish' }" href="#publish" @click.prevent="selectMobileSection('publish')">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
        </span>
        <span class="nav-label">发布</span>
      </a>
      <a :class="{ active: activeMobileSection === 'applications' }" href="#applications" @click.prevent="selectMobileSection('applications')">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"></path><path d="M14 3v4h4M9 13l2 2 4-5"></path></svg>
        </span>
        <span class="nav-label">申请</span>
      </a>
      <a :class="{ active: activeMobileSection === 'profile' }" href="#profile" @click.prevent="selectMobileSection('profile')">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6"></path></svg>
        </span>
        <span class="nav-label">我的</span>
      </a>
    </nav>
  </div>
</template>
