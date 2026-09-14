<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { apiRequest, hasSession, login, logout, type Account, type CurrentUser, type PersonalProfile } from './api/auth';
import './auth.css';
import { type Publication, publicationStatusLabels } from './api/opportunities';
import { type ApplicationRecord, applicationCard } from './api/applications';
import './applications.css';
const isDevelopment = import.meta.env.DEV;

type Category = 'all' | 'project' | 'competition' | 'research' | 'startup' | 'study';
type MobileSection = 'opportunities' | 'matching' | 'publish' | 'applications' | 'profile';
type ApplicationStatus = 'all' | 'pending' | 'approved' | 'closed';
type ApplicationViewRole = 'applicant' | 'publisher';
type MatchRole = 'teacher' | 'student';
type MatchStage = 'idle' | 'matching' | 'results';
type ProfilePanel = 'overview' | 'published' | 'applications' | 'settings';



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
  publishedAt?: string;
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

const sentApplications = ref<ApplicationRecord[]>([]);
const receivedApplications = ref<ApplicationRecord[]>([]);
const applicationRecords = computed(() => sentApplications.value.map(item => applicationCard(item)));
const publisherApplicationRecords = computed(() => receivedApplications.value.map(item => applicationCard(item, true)));
const applicationBusy = ref(false);
const applicationMessage = ref('');
const applicationDetail = ref<ApplicationRecord | null>(null);
const contactResult = ref<{ displayName: string; contact: string; message: string } | null>(null);
const applicationAction = ref<{ id: string; action: 'approve' | 'reject' | 'withdraw' } | null>(null);
const editSendProfile = ref(false);
const contactDraft = ref('');
const matchRequestMessage = ref('');



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
const appliedOpportunityIds = computed(() => new Set(sentApplications.value.map(item => item.opportunityId)));
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
const isMatchingEnabled = ref(false);
const matchStage = ref<MatchStage>('idle');
const matchRemainingCount = ref(3);
const matchDay = ref('');
const matchingBusy = ref(false);
const matchingMessage = ref('');
const matchRoundId = ref('');
let matchingGeneration = 0;
let matchingClock: ReturnType<typeof setInterval> | undefined;
interface MatchResponse { day: string; enabled?: boolean; used: number; remaining: number; message?: string; round: { id: string; requestId: string; requirement: string; people: MatchPerson[]; algorithm: string } | null; }
const matchRequirement = ref('');
const matchAnimationMessage = ref('正在分析你的匹配需求');
const roundMatchPeople = ref<MatchPerson[]>([]);
const activeMatchCardIndex = ref(0);
const matchingPersonList = ref<HTMLElement | null>(null);
const selectedMatchPerson = ref<MatchPerson | null>(null);
const requestedMatchIds = computed(() => new Set([...sentApplications.value, ...receivedApplications.value]
  .filter(item => item.kind === 'MATCH')
  .map(item => item.applicantId === signedInUser.value?.id ? item.targetUserId! : item.applicantId)));
const isMatchSheetOpen = ref(false);
const matchRequestSubmitted = ref(false);
const matchIntent = ref('');
const shouldSendMatchProfile = ref(true);
const applicationViewRole = ref<ApplicationViewRole>('applicant');
const selectedApplicationStatus = ref<ApplicationStatus>('all');
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
const currentUserIdentity = reactive({
  name: '林同学',
  avatar: '林',
  role: 'student' as MatchRole,
  roleLabel: '2027 届本科生',
  college: '人工智能学院',
});
const developmentAccounts = ref<Account[]>([]);
const signedInUser = ref<CurrentUser | null>(null);
const accountBusy = ref(false);
const accountMessage = ref('');
const profileSaving = ref(false);

function resetMatchingResults() {
  matchingGeneration++;
  matchRoundId.value = '';
  matchingMessage.value = '';
  clearMatchAnimationTimers();
  matchStage.value = 'idle';
  roundMatchPeople.value = [];
  activeMatchCardIndex.value = 0;
  selectedMatchPerson.value = null;
  isMatchSheetOpen.value = false;
}

async function refreshCurrentUser() {
  const user = await apiRequest<CurrentUser>('/me');
  signedInUser.value = user;
  Object.assign(currentUserIdentity, {
    name: user.displayName, avatar: user.avatar || user.displayName.slice(0, 1),
    role: user.role === 'TEACHER' ? 'teacher' : 'student', roleLabel: user.roleLabel, college: user.college,
  });
  personalProfile.value = user.profile ? {
    headline: user.profile.headline, introduction: user.profile.introduction,
    tags: user.profile.tags, availability: user.profile.availability,
  } : { headline: '', introduction: '', tags: [], availability: '' };
  isMatchingEnabled.value = user.profile?.matchingEnabled ?? true;
  resetMatchingResults();
  contactDraft.value = user.contact;
  await Promise.all([loadMyPublications(), loadApplications(), loadMatchingStatus()]);
}

async function initializeAccount() {
  if (import.meta.env.DEV) {
    developmentAccounts.value = await apiRequest<Account[]>('/auth/dev/accounts').catch(() => []);
  }
  if (hasSession()) {
    try { await refreshCurrentUser(); }
    catch (error) { clearAccountView(); accountMessage.value = (error as Error).message; }
  } else if (developmentAccounts.value.length) {
    clearAccountView();
  }
}

function clearAccountView() {
  signedInUser.value = null;
  Object.assign(currentUserIdentity, { name: '未登录', avatar: '我', college: '校园机会', roleLabel: '请先登录' });
  personalProfile.value = { headline: '', introduction: '', tags: [], availability: '' };
  isMatchingEnabled.value = false;
  resetMatchingResults();
  isProfileEditorOpen.value = false;
  profilePublications.value = [];
  resetPublishForm();
  sentApplications.value = [];
  receivedApplications.value = [];
  applicationDetail.value = null;
  contactResult.value = null;
  applicationAction.value = null;
  applicationMessage.value = '';
  applicationViewRole.value = 'applicant';
  selectedApplicationStatus.value = 'all';
  contactDraft.value = '';
  matchRequirement.value = '';
  matchRemainingCount.value = 3;
  matchDay.value = '';
  isApplicationSheetOpen.value = false;
  isProfileApplicationEditorOpen.value = false;
  selectedProfileApplicationId.value = null;
}

async function selectAccount(id: string) {
  if (accountBusy.value || publicationBusy.value || applicationBusy.value || matchingBusy.value) return;
  accountBusy.value = true;
  accountMessage.value = '';
  try {
    if (hasSession()) await logout();
    clearAccountView();
    await login(id);
    await refreshCurrentUser();
    accountMessage.value = '已登录，个人说明和匹配设置将同步保存';
  } catch (error) { accountMessage.value = (error as Error).message; }
  finally { accountBusy.value = false; }
}

async function signOut() {
  if (accountBusy.value || publicationBusy.value || applicationBusy.value || matchingBusy.value) return;
  accountBusy.value = true;
  try {
    await logout();
    clearAccountView();
    accountMessage.value = '已退出登录';
  } catch (error) { accountMessage.value = (error as Error).message; }
  finally { accountBusy.value = false; }
}
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
const profilePublications = ref<Publication[]>([]);
const editingPublication = ref<Publication | null>(null);
const publicationBusy = ref(false);
const publicationMessage = ref('');
const confirmCloseId = ref<string | null>(null);
const weeklyOpportunityCount = computed(() => opportunities.value.filter((item) =>
  item.publishedAt && Date.parse(item.publishedAt) >= Date.now() - 7 * 86400000).length);

async function loadMyPublications() {
  const userId = signedInUser.value?.id;
  if (!userId) { profilePublications.value = []; return; }
  try {
    const records = await apiRequest<Publication[]>('/me/opportunities');
    if (signedInUser.value?.id === userId) profilePublications.value = records;
    return true;
  } catch (error) { publicationMessage.value = (error as Error).message; return false; }
}

function resetPublishForm() {
  editingPublication.value = null;
  publishForm.value = { category: 'project', title: '', description: '', weeklyTime: '', duration: '', location: '', deadline: '', tags: '' };
  publishFormMessage.value = '';
  confirmCloseId.value = null;
}

function publicationStatus(item: Publication) {
  if (item.status === 'OPEN' && item.deadline && Date.parse(item.deadline) <= Date.now()) return '已截止';
  return publicationStatusLabels[item.status];
}
const selectedProfileApplicationId = ref<string | null>(null);


const profileApplicationDraft = ref('');
const isProfileApplicationEditorOpen = ref(false);
let listScrollPosition = 0;
let matchAnimationTimers: ReturnType<typeof setTimeout>[] = [];

const filteredApplicationRecords = computed(() => {
  if (selectedApplicationStatus.value === 'all') return applicationRecords.value;
  return applicationRecords.value.filter((item) => item.status === selectedApplicationStatus.value);
});

const filteredMatchPeople = computed(() => roundMatchPeople.value);



const filteredPublisherApplicationRecords = computed(() => {
  if (selectedApplicationStatus.value === 'all') return publisherApplicationRecords.value;
  return publisherApplicationRecords.value.filter((item) => item.status === selectedApplicationStatus.value);
});

const currentApplicationStatusLabels = computed(() => ({
  ...applicationStatusLabels,
  closed: '已结束',
}));

function selectApplicationViewRole(role: ApplicationViewRole) {
  applicationViewRole.value = role;
  selectedApplicationStatus.value = 'all';
}

function updatePublisherApplicationStatus(id: string, status: 'approved' | 'closed') {
  applicationAction.value = { id, action: status === 'approved' ? 'approve' : 'reject' };
}

async function loadApplications() {
  const userId = signedInUser.value?.id;
  if (!userId) return;
  try {
    const [sent, received] = await Promise.all([
      apiRequest<ApplicationRecord[]>('/me/applications?direction=sent'),
      apiRequest<ApplicationRecord[]>('/me/applications?direction=received'),
    ]);
    if (signedInUser.value?.id !== userId) return;
    sentApplications.value = sent;
    receivedApplications.value = received;
    return true;
  } catch (error) {
    if (signedInUser.value?.id === userId) applicationMessage.value = (error as Error).message;
    return false;
  }
}

async function applicationOperation(action: () => Promise<void>) {
  if (applicationBusy.value || accountBusy.value) return;
  applicationBusy.value = true;
  applicationMessage.value = '';
  try {
    if (!signedInUser.value || !hasSession()) throw new Error('请先到“我的”登录');
    await action();
  } catch (error) { applicationMessage.value = (error as Error).message; }
  finally { applicationBusy.value = false; }
}

async function confirmApplicationAction() {
  const value = applicationAction.value;
  if (!value) return;
  await applicationOperation(async () => {
    await apiRequest(`/applications/${value.id}/${value.action === 'withdraw' ? 'withdraw' : 'review'}`, {
      method: 'POST', ...(value.action === 'withdraw' ? {} : { body: JSON.stringify({ decision: value.action }) }),
    });
    applicationAction.value = null;
    applicationDetail.value = null;
    contactResult.value = null;
    await Promise.all([loadApplications(), loadOpportunities(), loadMyPublications()]);
  });
}

async function viewApplication(id: string) {
  await applicationOperation(async () => {
    applicationDetail.value = await apiRequest<ApplicationRecord>(`/applications/${id}`);
  });
}

async function viewApplicationContact(id: string) {
  await applicationOperation(async () => {
    contactResult.value = await apiRequest(`/applications/${id}/contact`);
  });
}

async function saveContact() {
  await applicationOperation(async () => {
    const result = await apiRequest<{ contact: string }>('/me/contact', { method: 'PATCH', body: JSON.stringify({ contact: contactDraft.value }) });
    contactDraft.value = result.contact;
    applicationMessage.value = result.contact ? '联系方式已保存，仅申请通过后向对方开放' : '已清空联系方式';
  });
}

function serverDay() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }

function acceptMatchResponse(result: MatchResponse) {
  matchDay.value = result.day;
  matchRemainingCount.value = result.remaining;
  if (result.enabled !== undefined) isMatchingEnabled.value = result.enabled;
  matchRoundId.value = result.round?.id ?? '';
  roundMatchPeople.value = result.round?.people ?? [];
  if (result.round) matchRequirement.value = result.round.requirement;
  matchStage.value = result.round ? 'results' : 'idle';
  activeMatchCardIndex.value = 0;
  if (signedInUser.value && result.round) {
    const key = `campus-match-pending:${signedInUser.value.id}`;
    try {
      const pending = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (pending?.requestId === result.round.requestId) sessionStorage.removeItem(key);
    } catch { /* A failed browser storage read does not invalidate the server result. */ }
  }
}

async function loadMatchingStatus() {
  if (!signedInUser.value || matchingBusy.value) return;
  const userId = signedInUser.value.id;
  const generation = ++matchingGeneration;
  try {
    const result = await apiRequest<MatchResponse>('/matching/status');
    if (signedInUser.value?.id !== userId || generation !== matchingGeneration) return;
    acceptMatchResponse(result);
  } catch (error) { if (generation === matchingGeneration) matchingMessage.value = (error as Error).message; }
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

async function startMatchRound() {
  if (matchingBusy.value || accountBusy.value || !signedInUser.value) return;
  matchingBusy.value = true;
  matchingMessage.value = '';
  const userId = signedInUser.value.id;
  const generation = ++matchingGeneration;
  const key = `campus-match-pending:${userId}`;
  const requirement = matchRequirement.value;
  let pending: { day: string; requirement: string; requestId: string };
  try { pending = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { pending = null as never; }
  if (!pending || pending.day !== serverDay() || pending.requirement !== requirement) {
    pending = { day: serverDay(), requirement, requestId: crypto.randomUUID() };
  }
  sessionStorage.setItem(key, JSON.stringify(pending));
  matchStage.value = 'matching';
  matchAnimationMessage.value = requirement ? `正在寻找“${requirement}”相关师生` : '正在根据个人说明寻找师生';
  try {
    const [result] = await Promise.all([
      apiRequest<MatchResponse>('/matching/rounds', { method: 'POST', body: JSON.stringify({ requirement, requestId: pending.requestId }) }),
      new Promise(resolve => setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500)),
    ]);
    sessionStorage.removeItem(key);
    if (generation !== matchingGeneration || signedInUser.value?.id !== userId) return;
    acceptMatchResponse(result);
    matchingMessage.value = result.message || '';
    await loadApplications();
  } catch (error) {
    if (generation === matchingGeneration) {
      matchStage.value = roundMatchPeople.value.length ? 'results' : 'idle';
      matchingMessage.value = (error as Error).message;
      matchingBusy.value = false;
      const message = matchingMessage.value;
      await loadMatchingStatus();
      matchingMessage.value = message;
    }
  } finally {
    matchingBusy.value = false;
  }
}

function openMatchRequest(person: MatchPerson) {
  if (requestedMatchIds.value.has(person.id) || applicationBusy.value || matchingBusy.value) return;
  selectedMatchPerson.value = person;
  matchIntent.value = '';
  shouldSendMatchProfile.value = true;
  matchRequestSubmitted.value = false;
  matchRequestMessage.value = '';
  isMatchSheetOpen.value = true;
}

function closeMatchRequest() {
  isMatchSheetOpen.value = false;
}

async function submitMatchRequest() {
  const person = selectedMatchPerson.value;
  if (!person || applicationBusy.value || !signedInUser.value) return;
  matchRequestMessage.value = '';
  await applicationOperation(async () => {
    await apiRequest('/matching/requests', { method: 'POST', body: JSON.stringify({
      targetUserId: person.id, roundId: matchRoundId.value, note: matchIntent.value, sendProfile: shouldSendMatchProfile.value,
    }) });
    matchRequestSubmitted.value = true;
    await loadApplications();
  });
  if (applicationMessage.value) matchRequestMessage.value = applicationMessage.value;
}

function selectMobileSection(section: MobileSection) {
  activeMobileSection.value = section;
  if (section === 'applications') void loadApplications();
  if (section === 'matching') void loadMatchingStatus();
  if (section === 'profile') profilePanel.value = 'overview';
  window.history.replaceState(null, '', `#${section}`);
  window.scrollTo(0, 0);
}

function selectProfilePanel(panel: ProfilePanel) {
  profilePanel.value = panel;
  if (panel === 'published') void loadMyPublications();
  if (panel === 'applications') void loadApplications();
  window.scrollTo(0, 0);
}

function openMatchingSettings() {
  selectMobileSection('profile');
  if (signedInUser.value) profilePanel.value = 'settings';
}

async function toggleMatchingEnabled() {
  if (accountBusy.value || matchingBusy.value || applicationBusy.value) return;
  if (!signedInUser.value) { accountMessage.value = '请先登录'; return; }
  accountBusy.value = true;
  try {
    const next = !isMatchingEnabled.value;
    await apiRequest('/me/profile', { method: 'PATCH', body: JSON.stringify({ matchingEnabled: next }) });
    isMatchingEnabled.value = next;
    resetMatchingResults();
    await loadMatchingStatus();
  } catch (error) { accountMessage.value = (error as Error).message; }
  finally { accountBusy.value = false; }
}

function updateMatchRequirement(event: Event) {
  const input = event.target as HTMLInputElement;
  const nextValue = [...input.value].slice(0, 20).join('');
  matchRequirement.value = nextValue;
  if (input.value !== nextValue) input.value = nextValue;
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

async function savePersonalProfile() {
  if (profileSaving.value || accountBusy.value) return;
  const draft = profileDraft.value;
  if (!draft.headline.trim() || !draft.introduction.trim()) {
    profileSaveMessage.value = '请先填写个人方向和个人介绍';
    return;
  }

  const nextProfile = {
    headline: draft.headline.trim(),
    introduction: draft.introduction.trim(),
    tags: splitProfileTags(draft.tags),
    availability: draft.availability.trim() || '投入时间待补充',
  };
  if (developmentAccounts.value.length && !signedInUser.value) {
    profileSaveMessage.value = '请先在我的页面选择账号登录';
    return;
  }
  if (signedInUser.value) {
    profileSaving.value = true;
    try { await apiRequest<PersonalProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(nextProfile) }); }
    catch (error) { profileSaveMessage.value = (error as Error).message; return; }
    finally { profileSaving.value = false; }
  }
  personalProfile.value = nextProfile;
  profileSaveMessage.value = '个人说明已更新';
  window.setTimeout(() => {
    isProfileEditorOpen.value = false;
    profileSaveMessage.value = '';
  }, 420);
}

function openProfilePublicationEditor(id: string) {
  const item = profilePublications.value.find((publication) => publication.id === id);
  if (!item) return;
  if (publicationBusy.value) return;
  editingPublication.value = item;
  const [weeklyTime = '', ...duration] = item.commitment.split(' · ');
  publishForm.value = {
    title: item.title, description: item.description, category: item.category.toLowerCase() as Exclude<Category, 'all'>,
    deadline: item.deadline?.slice(0, 10) ?? '', weeklyTime, duration: duration.join(' · '), location: item.location,
    tags: item.tags.join('、'),
  };
  publishFormMessage.value = '';
  selectMobileSection('publish');
}

function openProfileApplicationEditor(id: string) {
  const item = applicationRecords.value.find((application) => application.id === id);
  if (!item || item.status !== 'pending') return;
  selectedProfileApplicationId.value = id;
  profileApplicationDraft.value = item.note;
  editSendProfile.value = item.raw.sendProfile;
  applicationMessage.value = '';
  isProfileApplicationEditorOpen.value = true;
}

function closeProfileApplicationEditor() {
  isProfileApplicationEditorOpen.value = false;
  selectedProfileApplicationId.value = null;
}

async function saveProfileApplication() {
  const id = selectedProfileApplicationId.value;
  if (!id) return;
  await applicationOperation(async () => {
    await apiRequest(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ note: profileApplicationDraft.value, sendProfile: editSendProfile.value }) });
    closeProfileApplicationEditor();
    await loadApplications();
  });
}

async function persistPublication(publish: boolean) {
  if (publicationBusy.value || accountBusy.value) return;
  if (!signedInUser.value || !hasSession()) {
    publishFormMessage.value = '请先到“我的”登录，再保存或发布机会';
    return;
  }
  const form = publishForm.value;
  if (publish && (!form.title.trim() || !form.description.trim() || !form.deadline)) {
    publishFormMessage.value = '请先填写标题、机会介绍和截止日期';
    return;
  }

  publicationBusy.value = true;
  publishFormMessage.value = '';
  try {
    const body = {
      title: form.title, description: form.description, category: form.category,
      commitment: [form.weeklyTime.trim(), form.duration.trim()].filter(Boolean).join(' · '),
      location: form.location, deadline: form.deadline || null,
      tags: form.tags.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean),
    };
    let saved: Publication;
    if (editingPublication.value) {
      saved = await apiRequest<Publication>(`/opportunities/${editingPublication.value.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      saved = await apiRequest<Publication>('/opportunities', { method: 'POST', body: JSON.stringify({ ...body, intent: publish ? 'publish' : 'draft' }) });
    }
    editingPublication.value = saved;
    if (publish && saved.status === 'DRAFT') {
      saved = await apiRequest<Publication>(`/opportunities/${saved.id}/publish`, { method: 'POST' });
      editingPublication.value = saved;
    }
    publishFormMessage.value = saved.status === 'DRAFT' ? '草稿已保存，可在“我的发布”继续编辑' : '已保存并发布，首页已同步更新';
    const refreshed = await Promise.all([loadMyPublications(), loadOpportunities()]);
    if (refreshed.includes(false)) publishFormMessage.value = '保存成功，但列表刷新失败，请稍后重试';
  } catch (error) { publishFormMessage.value = (error as Error).message; }
  finally { publicationBusy.value = false; }
}

function savePublishDraft() { return persistPublication(false); }
function submitPublishForm() { return persistPublication(true); }

async function closePublication(id: string) {
  if (publicationBusy.value) return;
  publicationBusy.value = true;
  publicationMessage.value = '';
  try {
    await apiRequest(`/opportunities/${id}/close`, { method: 'POST' });
    if (editingPublication.value?.id === id) resetPublishForm();
    confirmCloseId.value = null;
    publicationMessage.value = '已关闭招募，首页不再展示';
    await Promise.all([loadMyPublications(), loadOpportunities()]);
  } catch (error) { publicationMessage.value = (error as Error).message; }
  finally { publicationBusy.value = false; }
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
  applicationMessage.value = '';
  shouldSendPersonalProfile.value = true;
  applicationSubmitted.value = false;
  isApplicationSheetOpen.value = true;
}

function closeApplicationSheet() {
  isApplicationSheetOpen.value = false;
}

async function submitApplication() {
  const id = selectedOpportunity.value?.id;
  if (!id) return;
  await applicationOperation(async () => {
    await apiRequest(`/opportunities/${id}/applications`, { method: 'POST',
      body: JSON.stringify({ note: applicationNote.value, sendProfile: shouldSendPersonalProfile.value }) });
    applicationSubmitted.value = true;
    await Promise.all([loadApplications(), loadOpportunities()]);
    if (selectedOpportunity.value?.id === id) {
      selectedOpportunity.value = opportunities.value.find(item => item.id === id) ?? selectedOpportunity.value;
    }
  });
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
  if (apiOnline.value) {
    try { item = await apiRequest<Opportunity>(`/opportunities/${item.id}`); }
    catch (error) { publicationMessage.value = (error as Error).message; await loadOpportunities(); return; }
  }
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
    return true;
  } catch {
    opportunities.value = import.meta.env.DEV ? [] : fallback;
    apiOnline.value = false;
    return false;
  } finally {
    loading.value = false;
  }
}

onMounted(loadOpportunities);
onMounted(initializeAccount);
function refreshMatchingOnFocus() {
  if (activeMobileSection.value === 'matching') void loadMatchingStatus();
}
onMounted(() => {
  window.addEventListener('focus', refreshMatchingOnFocus);
  matchingClock = setInterval(() => {
    if (signedInUser.value && matchDay.value !== serverDay()) void loadMatchingStatus();
  }, 60_000);
});
onBeforeUnmount(() => { clearMatchAnimationTimers(); clearInterval(matchingClock); window.removeEventListener('focus', refreshMatchingOnFocus); matchingGeneration++; });
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
              <span>申请通过后，双方可查看已设置的联系方式</span>
            </div>

            <p v-if="applicationMessage" role="status">{{ applicationMessage }}</p>
            <button class="application-submit-button" type="submit" :disabled="applicationBusy">
              {{ applicationBusy ? '提交中…' : '确认申请' }}
            </button>
          </form>
        </template>

        <div v-else class="application-success" role="status">
          <div class="application-success-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"></path></svg>
          </div>
          <h2 id="application-sheet-title">申请已提交</h2>
          <p>可在“申请－我发出的”查看进度；通过后双方可查看已设置的联系方式。</p>
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
        <a :class="{ active: activeMobileSection === 'opportunities' }" href="#opportunities" @click.prevent="selectMobileSection('opportunities')">找机会</a>
        <a :class="{ active: activeMobileSection === 'publish' }" href="#publish" @click.prevent="selectMobileSection('publish')">发机会</a>
        <a :class="{ active: activeMobileSection === 'applications' }" href="#applications" @click.prevent="selectMobileSection('applications')">我的申请</a>
      </nav>

      <button class="profile-button" type="button" @click="selectMobileSection('profile')">
        <span class="avatar">{{ signedInUser?.displayName.slice(0, 1) || '我' }}</span>
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

        <div class="mobile-highlight" :aria-label="`本周新增 ${weeklyOpportunityCount} 个校园机会`">
          <div class="mobile-highlight-header">
            <span class="mobile-highlight-label">
              <strong>本周机会速览</strong>
              <small>近 7 日</small>
            </span>
          </div>
          <p class="mobile-highlight-main">
            <strong>{{ weeklyOpportunityCount }}</strong>
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
            <small>{{ weeklyOpportunityCount }} 个新机会</small>
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
            <span></span>{{ apiOnline ? '后端服务已连接' : isDevelopment ? '连接失败，请重试' : '正在展示本地预览数据' }}
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
          <p v-if="publicationMessage" role="status">{{ publicationMessage }}</p>
          <p v-if="!filteredOpportunities.length">{{ apiOnline ? '暂时没有符合条件的招募机会' : '暂时无法加载机会' }}</p>
          <button v-if="!apiOnline" type="button" @click="loadOpportunities">重新加载</button>
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

    <main v-else-if="activeMobileSection === 'matching'" class="matching-page" aria-label="个人匹配">
      <p v-if="matchingMessage" class="application-feedback" role="status">{{ matchingMessage }}</p>
      <section v-if="!isMatchingEnabled" class="matching-state-page matching-start-card matching-disabled-card">
        <div class="matching-disabled-visual" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M8 11V8a4 4 0 0 1 7.5-2M7 11h10a2 2 0 0 1 2 2v6H5v-6a2 2 0 0 1 2-2Z"></path><path d="m4 4 16 16"></path></svg>
        </div>
        <small>MATCHING PAUSED</small>
        <h1>{{ signedInUser ? '匹配功能已关闭' : '登录后开始匹配' }}</h1>
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
        <small>PERSON MATCHING · 规则匹配</small>
        <h1>开始一轮个人匹配</h1>
        <p>写下这轮最想匹配到的人或合作方向。</p>
        <label class="matching-requirement-field">
          <span>匹配需求</span>
          <div>
            <input
              :value="matchRequirement"
              type="text"
              maxlength="20"
              placeholder="例如：寻找前端项目搭档"
              @input="updateMatchRequirement"
            />
            <small>{{ [...matchRequirement].length }}/20</small>
          </div>
        </label>
        <button type="button" :disabled="matchingBusy || accountBusy || !signedInUser || (matchRemainingCount === 0 && matchDay === serverDay())" @click="startMatchRound">
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
        <p v-if="filteredMatchPeople.length === 0" class="application-feedback">本轮师生已暂停匹配，请再来一轮。</p>
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
              <span class="matching-score"><strong>{{ person.score }}</strong><small>相关分</small></span>
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
              <small>{{ requestedMatchIds.has(person.id) ? '进度请到申请页查看' : '同意后即可联系' }}</small>
              <button
                type="button"
                :disabled="applicationBusy || matchingBusy || requestedMatchIds.has(person.id)"
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
          :disabled="matchingBusy || accountBusy || !signedInUser || (matchRemainingCount === 0 && matchDay === serverDay())"
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
              <em>{{ selectedMatchPerson.score }} 相关分</em>
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
                <span>对方同意后，双方可查看已设置的联系方式</span>
              </div>

              <p v-if="matchRequestMessage" role="status">{{ matchRequestMessage }}</p>
              <button class="application-submit-button" type="submit" :disabled="applicationBusy || !matchIntent.trim()">
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
          <h1>{{ editingPublication ? '编辑校园机会' : '发布校园机会' }}</h1>
          <p>把需要的人、要做的事和投入要求说清楚。</p>
        </div>
        <button type="button" aria-label="更多发布设置">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="19" cy="12" r="1.4"></circle></svg>
        </button>
      </header>

      <p v-if="!signedInUser" class="publish-form-message">请先到“我的”登录，再保存或发布机会。</p>
      <button v-if="editingPublication" type="button" :disabled="publicationBusy" @click="resetPublishForm">发布新机会</button>
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
            <span class="publish-avatar" aria-hidden="true">{{ signedInUser ? currentUserIdentity.avatar : '我' }}</span>
            <span>
              <strong>{{ signedInUser ? `${currentUserIdentity.name} · ${currentUserIdentity.college}` : '未登录' }}</strong>
              <small>{{ signedInUser ? '将以当前账号作为发起人' : '登录后即可发布' }}</small>
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 2 2 4-5"></path><circle cx="12" cy="12" r="9"></circle></svg>
          </div>
        </section>

        <p v-if="publishFormMessage" class="publish-form-message" role="status">{{ publishFormMessage }}</p>

        <div class="publish-form-actions">
          <button v-if="!editingPublication || editingPublication.status === 'DRAFT'" type="button" :disabled="publicationBusy || accountBusy || !signedInUser" @click="savePublishDraft">保存草稿</button>
          <button type="submit" :disabled="publicationBusy || accountBusy || !signedInUser">{{ publicationBusy ? '正在保存…' : editingPublication?.status === 'OPEN' ? '保存修改' : '确认发布' }}</button>
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

        <section v-if="developmentAccounts.length || signedInUser" class="account-session-panel" aria-label="账号登录">
          <strong>{{ signedInUser ? `当前账号：${signedInUser.displayName}` : '选择账号登录' }}</strong>
          <p v-if="developmentAccounts.length">本地开发账号</p>
          <div class="account-session-actions">
            <button v-for="account in developmentAccounts" :key="account.id" type="button"
              :disabled="accountBusy || profileSaving || publicationBusy || applicationBusy || matchingBusy || account.id === signedInUser?.id" @click="selectAccount(account.id)">
              {{ account.displayName }} · {{ account.role === 'TEACHER' ? '老师' : '学生' }}
            </button>
            <button v-if="signedInUser" type="button" :disabled="accountBusy || profileSaving || publicationBusy || applicationBusy || matchingBusy" @click="signOut">退出登录</button>
          </div>
          <p v-if="accountMessage" role="status">{{ accountMessage }}</p>
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
          <p v-if="publicationMessage" role="status">{{ publicationMessage }}</p>
          <p v-if="!profilePublications.length">{{ signedInUser ? '还没有发布，去发布一个校园机会吧。' : '登录后可查看你的发布。' }}</p>
          <article v-for="item in profilePublications" :key="item.id" class="profile-manage-card">
            <header><span>{{ categoryLabels[item.category.toLowerCase() as Exclude<Category, 'all'>] }}</span><em :class="{ draft: item.status === 'DRAFT' }">{{ publicationStatus(item) }}</em></header>
            <h2>{{ item.title || '未命名草稿' }}</h2>
            <p>{{ item.description }}</p>
            <div><span>{{ item.deadline ? `${item.deadline.slice(0, 10)} 截止` : '截止日期待填写' }}</span><span>{{ item.applicants }} 人申请</span></div>
            <footer>
              <button v-if="['DRAFT', 'OPEN'].includes(item.status)" type="button" :disabled="publicationBusy" @click="openProfilePublicationEditor(item.id)">{{ item.status === 'DRAFT' ? '继续编辑' : '编辑发布' }}</button>
              <button v-if="item.status === 'OPEN'" type="button" :disabled="publicationBusy" @click="confirmCloseId = item.id">关闭招募</button>
            </footer>
            <div v-if="confirmCloseId === item.id" role="group" aria-label="确认关闭招募">
              <span>关闭后停止招募，保留历史记录。</span>
              <button type="button" :disabled="publicationBusy" @click="closePublication(item.id)">确认关闭</button>
              <button type="button" :disabled="publicationBusy" @click="confirmCloseId = null">取消</button>
            </div>
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
            <p>{{ item.note }}</p>
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
        <form class="contact-settings" @submit.prevent="saveContact">
          <label class="publish-field"><span>联系方式（选填）</span><input v-model="contactDraft" maxlength="120" placeholder="钉钉号或其他你愿意提供的联系方式" /></label>
          <p>仅申请通过后向对方展示，不显示在个人卡片中。清空后停止展示；已被对方保存的信息无法收回。</p>
          <button type="submit" :disabled="applicationBusy || !signedInUser">保存联系方式</button>
          <p v-if="applicationMessage" role="status">{{ applicationMessage }}</p>
        </form>
        <p v-if="accountMessage" role="status">{{ accountMessage }}</p>
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


    </main>

    <main v-else class="applications-page" aria-label="申请与匹配">
      <div class="application-feedback"><span v-if="applicationMessage" role="status">{{ applicationMessage }}</span><span v-if="!signedInUser">登录后可查看真实申请</span><button type="button" :disabled="applicationBusy || !signedInUser" @click="loadApplications">刷新申请</button></div>
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
            <button type="button" :disabled="applicationBusy" @click="viewApplication(item.id)">查看申请</button>
            <button v-if="item.status === 'pending'" type="button" :disabled="applicationBusy" @click="openProfileApplicationEditor(item.id)">修改</button>
            <button v-if="item.status === 'pending' || item.status === 'approved'" type="button" :disabled="applicationBusy" @click="applicationAction = { id: item.id, action: 'withdraw' }">撤回</button>
            <button v-if="item.status === 'approved'" class="application-contact-button" type="button" :disabled="applicationBusy" @click="viewApplicationContact(item.id)">
              {{ item.kind === 'match' ? '联系对方' : '联系发起人' }}
            </button>
            <span v-else-if="item.status === 'pending'">可刷新查看处理进度</span>
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

          <p v-if="item.kind !== 'match'" class="publisher-application-target">申请：{{ item.opportunity }}</p>

          <div class="publisher-application-tags">
            <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
          </div>

          <blockquote>{{ item.note }}</blockquote>

          <footer>
            <button type="button" :disabled="applicationBusy" @click="viewApplication(item.id)">{{ item.hasProfile ? '查看个人说明' : '查看详情' }}</button>
            <span v-if="item.status === 'pending'" class="publisher-pending-actions">
              <button type="button" :disabled="applicationBusy" @click="updatePublisherApplicationStatus(item.id, 'closed')">{{ item.kind === 'match' ? '婉拒' : '暂不合适' }}</button>
              <button type="button" :disabled="applicationBusy" @click="updatePublisherApplicationStatus(item.id, 'approved')">{{ item.kind === 'match' ? '同意匹配' : '通过申请' }}</button>
            </span>
            <button v-else-if="item.status === 'approved'" class="application-contact-button" type="button" :disabled="applicationBusy" @click="viewApplicationContact(item.id)">{{ item.kind === 'match' ? '联系对方' : '联系申请者' }}</button>
            <span v-else>请求已归档</span>
          </footer>
        </article>

        <div v-if="filteredPublisherApplicationRecords.length === 0" class="application-record-empty">
          <strong>暂无相关申请</strong>
          <span>该状态下还没有收到申请。</span>
        </div>
      </section>
    </main>

      <div v-if="isProfileApplicationEditorOpen" class="application-sheet-backdrop" @click.self="closeProfileApplicationEditor">
        <section class="application-sheet profile-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-application-editor-title">
          <div class="application-sheet-handle" aria-hidden="true"></div>
          <header class="application-sheet-header">
            <div><h2 id="profile-application-editor-title">修改申请</h2><p>对方处理前可以更新申请说明</p></div>
            <button type="button" aria-label="关闭申请编辑" @click="closeProfileApplicationEditor"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>
          </header>
          <form class="profile-editor-form" @submit.prevent="saveProfileApplication">
            <label class="publish-field"><span>申请说明 <small>选填</small></span><textarea v-model="profileApplicationDraft" maxlength="180" placeholder="补充你希望参与的原因和相关经历"></textarea><i>{{ profileApplicationDraft.length }}/180</i></label>
            <label class="application-profile-toggle"><span>发送个人说明（重新保存当前快照）</span><input v-model="editSendProfile" type="checkbox" /></label>
            <p v-if="applicationMessage" role="status">{{ applicationMessage }}</p>
            <button class="application-submit-button" type="submit" :disabled="applicationBusy">保存修改</button>
          </form>
        </section>
      </div>
    <div v-if="applicationDetail || contactResult || applicationAction" class="application-sheet-backdrop" @click.self="!applicationBusy && (applicationDetail = null, contactResult = null, applicationAction = null)">
      <section class="application-sheet application-info-sheet" role="dialog" aria-modal="true" aria-label="申请信息">
        <header class="application-sheet-header"><h2>{{ applicationAction ? '确认操作' : contactResult ? '联系方式' : '申请详情' }}</h2><button type="button" :disabled="applicationBusy" @click="applicationDetail = null; contactResult = null; applicationAction = null">关闭</button></header>
        <template v-if="applicationAction">
          <p>{{ applicationAction.action === 'approve' ? '通过后，双方可查看各自设置的联系方式。' : applicationAction.action === 'reject' ? '确认拒绝这份申请？处理后不可修改。' : '撤回后将停止联系权限，本阶段暂不支持对同一机会重新申请。' }}</p>
          <p v-if="applicationMessage" role="status">{{ applicationMessage }}</p>
          <button class="application-submit-button" type="button" :disabled="applicationBusy" @click="confirmApplicationAction">确认{{ applicationAction.action === 'approve' ? '通过' : applicationAction.action === 'reject' ? '拒绝' : '撤回' }}</button>
        </template>
        <template v-else-if="contactResult"><h3>{{ contactResult.displayName }}</h3><p class="private-contact">{{ contactResult.contact }}</p><p>{{ contactResult.message }}</p></template>
        <template v-else-if="applicationDetail">
          <h3>{{ applicationCard(applicationDetail, applicationDetail.targetUserId === signedInUser?.id).title }}</h3>
          <h4>申请说明</h4><p>{{ applicationDetail.note || '未填写申请说明' }}</p>
          <template v-if="applicationDetail.profileSnapshot">
            <h4>提交时的个人说明</h4><strong>{{ applicationDetail.profileSnapshot.headline }}</strong><p>{{ applicationDetail.profileSnapshot.introduction }}</p><p>{{ applicationDetail.profileSnapshot.tags.join(' · ') }}</p><p>{{ applicationDetail.profileSnapshot.availability }}</p>
          </template><p v-else>未附个人说明</p>
        </template>
      </section>
    </div>

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
