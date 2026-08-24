<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Category = 'all' | 'project' | 'competition' | 'research' | 'startup' | 'study';

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
  <div class="app-shell">
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

    <main>
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
            <a class="mobile-highlight-link" href="#opportunities">查看全部 <span>›</span></a>
          </div>
          <p class="mobile-highlight-main">
            <strong>18</strong>
            <span>个校园机会正在招募</span>
          </p>
          <div class="mobile-highlight-insights" aria-label="与你相关的本周机会信息">
            <span>
              <small>与你匹配</small>
              <strong>5 个</strong>
            </span>
            <span>
              <small>48 小时内截止</small>
              <strong>3 个</strong>
            </span>
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
          <article v-for="item in filteredOpportunities" :key="item.id" class="opportunity-card">
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

    <nav class="mobile-nav" aria-label="移动端导航">
      <a class="active" href="#opportunities">
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
      <a class="publish-nav" href="#publish">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
        </span>
        <span class="nav-label">发布</span>
      </a>
      <a href="#messages">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 18.5 3.5 21v-5A8.5 8.5 0 1 1 7 19.5"></path><path d="M8 11h.01M12 11h.01M16 11h.01"></path></svg>
        </span>
        <span class="nav-label">消息</span>
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
