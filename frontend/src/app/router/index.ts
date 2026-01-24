// router/index.ts
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

// 路由懒加载 - 按需加载页面组件，减少初始包体积
const HomePage = () => import('@/pages/HomePage.vue')
const StatisticsPage = () => import('@/pages/StatisticsPage.vue')
const VocabularyManagementPage = () => import('@/pages/VocabularyManagementPage.vue')
const ReviewPage = () => import('@/pages/ReviewPage.vue')
const SpeakingPage = () => import('@/pages/SpeakingPage.vue')
const SettingsPage = () => import('@/pages/SettingsPage.vue')

const routes = [
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

router.beforeEach((to, from, next) => {
  document.title = (to.meta.title as string) || 'IELTS'
  next()
})

export default router
