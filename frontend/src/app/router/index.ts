// router/index.ts
import { defineAsyncComponent } from 'vue'
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { useAuth } from '@/shared/composables/useAuth'

// 使用 defineAsyncComponent 包裹懒加载，让 Vue Router 立即导航，
// chunk 加载交给 App.vue 的 <Suspense> fallback 骨架屏处理。
// 部署后旧 chunk 404 在 onError 中直接刷新
const lazyPage = (loader: () => Promise<any>) =>
  defineAsyncComponent({
    loader,
    onError(error, _retry, fail) {
      if (
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Importing a module script failed')
      ) {
        window.location.reload()
        return
      }
      fail()
    }
  })

const LoginPage = lazyPage(() => import('@/pages/LoginPage.vue'))
const HomePage = lazyPage(() => import('@/pages/HomePage.vue'))
const StatisticsPage = lazyPage(() => import('@/pages/StatisticsPage.vue'))
const VocabularyManagementPage = lazyPage(() => import('@/pages/VocabularyManagementPage.vue'))
const ReviewPage = lazyPage(() => import('@/pages/ReviewPage.vue'))
const SpeakingPage = lazyPage(() => import('@/pages/SpeakingPage.vue'))
const WritingPage = lazyPage(() => import('@/pages/WritingPage.vue'))
const SettingsPage = lazyPage(() => import('@/pages/SettingsPage.vue'))
const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage.vue'))
const CourseLessonPage = lazyPage(() => import('@/pages/CourseLessonPage.vue'))

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    name: 'index',
    component: HomePage,
    meta: { title: '词汇学习', depth: 0 }
  },
  {
    path: '/stats',
    name: 'stats',
    component: StatisticsPage,
    meta: { title: '单词统计', depth: 1 }
  },
  {
    path: '/management',
    name: 'management',
    component: VocabularyManagementPage,
    meta: { title: '单词管理', depth: 1 }
  },
  {
    path: '/review',
    name: 'review',
    component: ReviewPage,
    meta: { title: '单词复习', depth: 1 },
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
    meta: { title: '口语练习', depth: 1 }
  },
  {
    path: '/writing',
    name: 'writing',
    component: WritingPage,
    meta: { title: '写作练习', depth: 1 }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: { title: '设置', depth: 1 }
  },
  // ── 课程路由 ──
  // 课程 index 页面作为 HomePage 的 tab 渲染（通过 meta.defaultTab 标识）
  {
    path: '/uk',
    redirect: '/uk/'
  },
  {
    path: '/uk/',
    name: 'course-uk-index',
    component: HomePage,
    meta: { title: '乌克兰语课程', depth: 0, defaultTab: 'course-uk' }
  },
  {
    path: '/uk/:lessonId',
    name: 'course-uk-lesson',
    component: CourseLessonPage,
    props: (route: RouteLocationNormalized) => ({
      courseId: 'ukrainian',
      lessonId: route.params.lessonId
    }),
    meta: { title: '乌克兰语课程', depth: 2 }
  },
  {
    path: '/legal',
    redirect: '/legal/'
  },
  {
    path: '/legal/',
    name: 'course-legal-index',
    component: HomePage,
    meta: { title: '法律英语课程', depth: 0, defaultTab: 'course-legal' }
  },
  {
    path: '/legal/:lessonId',
    name: 'course-legal-lesson',
    component: CourseLessonPage,
    props: (route: RouteLocationNormalized) => ({
      courseId: 'legal-english',
      lessonId: route.params.lessonId
    }),
    meta: { title: '法律英语课程', depth: 2 }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    meta: { title: '页面未找到', public: true }
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
    document.title = (to.meta.title as string) || '词汇学习'
    next()
  }
})

export default router
