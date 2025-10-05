// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import StatisticsPage from '@/pages/StatisticsPage.vue'
import VocabularyManagementPage from '@/pages/VocabularyManagementPage.vue'
import ReviewPage from '@/pages/ReviewPage.vue'
import HomePage from '@/pages/HomePage.vue'
import RelationGraphPage from '@/pages/RelationGraphPage.vue'

const routes = [
  {
    path: '/',
    name: 'index',
    component: HomePage,
    meta: { title: 'IELTS 首页' }
  },
  {
    path: '/stats',
    name: 'stats',
    component: StatisticsPage,
    meta: { title: 'IELTS 单词统计' }

  },
  {
    path: '/management',
    name: 'management',
    component: VocabularyManagementPage,
    meta: { title: 'IELTS 单词管理' }
  }, {
    path: '/review',
    name: 'review',
    component: ReviewPage,
    meta: { title: 'IELTS 单词复习' },
    props: (route: any) => ({
      mode: route.query.mode || 'mode_review',
      shuffle: route.query.shuffle === 'true',
      limit: parseInt(route.query.limit) || 50
    })
  }, {
    path: '/relations',
    name: 'relations',
    component: RelationGraphPage,
    meta: { title: 'IELTS 单词关系图' }
  }]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = (to.meta.title as string) || 'IELTS'
  next()
})

export default router