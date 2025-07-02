// router/index.ts
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { useAuth } from '@/shared/composables/useAuth'

// 路由懒加载 - 按需加载页面组件，减少初始包体积
const LoginPage = () => import('@/pages/LoginPage.vue')
const HomePage = () => import('@/pages/HomePage.vue')
const StatisticsPage = () => import('@/pages/StatisticsPage.vue')
const VocabularyManagementPage = () => import('@/pages/VocabularyManagementPage.vue')
const ReviewPage = () => import('@/pages/ReviewPage.vue')
const SpeakingPage = () => import('@/pages/SpeakingPage.vue')
const WritingPage = () => import('@/pages/WritingPage.vue')
const SettingsPage = () => import('@/pages/SettingsPage.vue')

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { title: 'IELTS 登录', public: true }
  },
  {
    path: '/',
    name: 'index',
    component: HomePage,
    meta: { title: 'IELTS 首页', depth: 0 }
  },
  {
    path: '/stats',
    name: 'stats',
    component: StatisticsPage,
    meta: { title: 'IELTS 单词统计', depth: 1 }
  },
  {
    path: '/management',
    name: 'management',
    component: VocabularyManagementPage,
    meta: { title: 'IELTS 单词管理', depth: 1 }
  },
  {
    path: '/review',
    name: 'review',
    component: ReviewPage,
    meta: { title: 'IELTS 单词复习', depth: 1 },
    props: (route: RouteLocationNormalized) => ({
      mode: route.query.mode || 'mode_review',
      shuffle: route.query.shuffle === 'true',
      limit: parseInt(route.query.limit as string) || 50
    })
  },
  {
    path: '/speaking',
    name: 'speaking',
    component: SpeakingPage,
    meta: { title: 'IELTS 口语练习', depth: 1 }
  },
  {
    path: '/writing',
    name: 'writing',
    component: WritingPage,
    meta: { title: 'IELTS 写作练习', depth: 1 }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: { title: 'IELTS 设置', depth: 1 }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Auth guard
router.beforeEach(async (to, _from, next) => {
  const { currentUser, isLoading, initAuth } = useAuth()

  // Initialize auth on first navigation (lazy)
  if (isLoading.value) {
    await initAuth()
  }

  if (!to.meta.public && !currentUser.value) {
    // Not authenticated → redirect to login, preserve intended destination
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (to.name === 'login' && currentUser.value) {
    // Already authenticated → redirect to saved destination or home
    const redirect = to.query.redirect as string
    if (redirect && redirect !== '/login') {
      next(redirect)
    } else {
      next({ name: 'index' })
    }
  } else {
    document.title = (to.meta.title as string) || 'IELTS'
    next()
  }
})

// 处理部署后旧 chunk 404 的问题：自动刷新页面加载新资源
router.onError((error, to) => {
  if (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed')
  ) {
    window.location.assign(to.fullPath)
  }
})

export default router
