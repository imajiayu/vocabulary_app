# frontend

Vue 3 + TypeScript 前端，使用 Vite 构建。

## 运行

```bash
npm install
npm run dev  # HTTPS 开发服务器
npm run build  # 生产构建
```

## 目录结构

```
src/
├── app/          # 应用入口 + 路由配置
├── pages/        # 页面组件
├── features/     # 功能模块（vocabulary/speaking/statistics）
└── shared/       # 公共资源（api/types/composables/components）
```

## 页面

| 文件 | 功能 |
|------|------|
| `HomePage.vue` | 主页导航 |
| `ReviewPage.vue` | 复习页（复习/Lapse/拼写模式） |
| `VocabularyManagementPage.vue` | 单词管理 |
| `SpeakingPage.vue` | 口语练习 |
| `StatisticsPage.vue` | 学习统计图表 |
| `SettingsPage.vue` | 用户设置 |

## 公共模块 (`shared/`)

| 目录 | 内容 |
|------|------|
| `api/` | HTTP 客户端（words/speaking/settings） |
| `services/` | WebSocket 客户端 |
| `types/` | TypeScript 类型定义 |
| `composables/` | 可组合函数（快捷键/定时器/音频） |
| `components/` | 通用 UI 组件 |

## 技术栈

- Vue 3 + Composition API
- TypeScript
- Tailwind CSS
- ECharts（图表）
- Socket.io（实时通信）
