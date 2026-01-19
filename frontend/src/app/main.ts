// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import '../shared/styles/base.css'
import router from './router'
import { createPinia } from 'pinia'

// 创建应用实例，变量名是 app（小写）
const app = createApp(App)

// 使用路由
app.use(router)
app.use(createPinia())

// 挂载到 DOM
app.mount('#app')