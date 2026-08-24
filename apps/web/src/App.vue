<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

type Category = 'all' | 'project' | 'competition' | 'research' | 'startup' | 'study';
type MobileSection = 'opportunities' | 'publish';

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

const categoryLabels: Record<Category, string> = {
  all: '全部',
  project: '项目',
  competition: '竞赛',
  research: '科研',
  startup: '创业',
  study: '学业',
};

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
const activeMobileSection = ref<MobileSection>(window.location.hash === '#publish' ? 'publish' : 'opportunities');
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
let listScrollPosition = 0;

function selectMobileSection(section: MobileSection) {
  activeMobileSection.value = section;
  window.history.replaceState(null, '', `#${section}`);
  window.scrollTo(0, 0);
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

      <button class="profile-button" type="button">
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

    <main v-else class="publish-page" aria-label="发布校园机会">
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

    <nav class="mobile-nav" aria-label="移动端导航">
      <a :class="{ active: activeMobileSection === 'opportunities' }" href="#opportunities" @click.prevent="selectMobileSection('opportunities')">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="3"></rect><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2"></path></svg>
        </span>
        <span class="nav-label">机会</span>
      </a>
      <a href="#matching">
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
      <a href="#applications">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"></path><path d="M14 3v4h4M9 13l2 2 4-5"></path></svg>
        </span>
        <span class="nav-label">申请</span>
      </a>
      <a href="#profile">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6"></path></svg>
        </span>
        <span class="nav-label">我的</span>
      </a>
    </nav>
  </div>
</template>
