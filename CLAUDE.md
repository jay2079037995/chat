# Chat - 即时通讯应用

## 项目简介
支持 Web 端和桌面端的即时通讯应用，采用 Monorepo 结构。

## 项目结构
```
chat/
├── packages/
│   ├── client/          # 前端 - React + Webpack + Ant Design
│   │   └── src/
│   │       ├── core/              # 模块系统基础设施
│   │       │   ├── types.ts       # ClientModule 接口
│   │       │   └── moduleRegistry.ts  # 模块注册表
│   │       ├── modules/           # 功能模块（按功能组织）
│   │       │   ├── auth/          # 认证模块（登录/注册/store/service）
│   │       │   └── home/          # 主页模块（首页/用户搜索/service）
│   │       ├── components/        # 共享组件（AuthGuard, GuestGuard）
│   │       ├── services/api.ts    # 共享 Axios 实例
│   │       └── App.tsx            # 模块驱动路由渲染
│   ├── server/          # 后端 - Express + Redis + Socket.io
│   │   └── src/
│   │       ├── core/              # 模块系统基础设施
│   │       │   ├── types.ts       # ServerModule 接口
│   │       │   ├── container.ts   # DI 容器
│   │       │   ├── tokens.ts      # 依赖 token 常量
│   │       │   └── registerRepositories.ts  # Repository 工厂注册
│   │       ├── modules/           # 功能模块（按功能组织）
│   │       │   ├── auth/          # 认证模块（路由/service/middleware）
│   │       │   └── user/          # 用户模块（路由/service）
│   │       ├── repositories/      # 数据访问层（接口 + Redis 实现）
│   │       └── app.ts             # 模块加载器
│   └── shared/          # 共享类型、常量、工具函数
├── e2e/                 # E2E 测试（Playwright）
│   ├── fixtures/        # 测试数据常量
│   ├── helpers/         # Redis/API 工具函数
│   ├── v0.1/            # v0.1.0 E2E 测试
│   └── v0.2/            # v0.2.0 E2E 测试
├── scripts/             # 自动化脚本
│   ├── test.sh          # 主测试脚本（支持版本筛选、回归测试）
│   └── check-env.sh     # 环境检查脚本
├── doc/                 # 项目文档
│   ├── requirements.md  # 需求文档
│   ├── tech-stack.md    # 技术选型
│   ├── version-plan.md  # 版本规划
│   └── test/            # 各版本测试文档（v0.1.0-test.md ~ v0.8.0-test.md）
├── design/              # UI 设计文件（Pencil .pen 格式）
├── knowledge/           # Claude Code Skill 知识库（版本控制副本）
│   ├── create-project.md  # 创建项目流程和规范
│   └── project-faq.md    # 疑难杂症与解决方案
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## 技术栈
- **语言**: TypeScript (strict mode)
- **包管理器**: pnpm (workspace)
- **前端**: React 18 + Webpack 5 + Ant Design 5 + Zustand + CSS Modules/Less + React Router 6
- **后端**: Express + Redis + Socket.io
- **桌面端**: Electron
- **测试**: Jest + React Testing Library + Supertest + Playwright (E2E)
- **代码规范**: ESLint + Prettier
- **UI 设计**: Pencil（.pen 文件，通过 MCP 工具读写）

## 开发命令
```bash
pnpm install          # 安装依赖
pnpm dev:client       # 启动前端开发服务器
pnpm dev:server       # 启动后端服务
pnpm dev              # 同时启动前后端
pnpm build            # 构建项目
pnpm test             # 运行单元/集成测试 (Jest)
pnpm test:e2e         # 运行 E2E 测试 (Playwright)
pnpm lint             # 代码检查
```

## 编码规范
- TypeScript 严格模式，避免 any
- 后端数据访问层使用 Repository 模式，预留 MongoDB 接口
- 前后端共享类型放在 packages/shared
- 每个功能写对应的测试用例
- 组件文件使用 PascalCase，工具函数使用 camelCase
- **所有源代码必须添加中文注释**，以便人类查阅和修改：
  - 文件顶部添加文件级 JSDoc 注释，说明该文件的职责
  - 接口/类/函数添加 JSDoc 注释，说明用途和关键参数
  - 接口字段添加行内 `/** */` 注释，说明字段含义
  - 关键逻辑分支添加行内注释，说明判断原因
  - 注释语言统一使用中文

## UI 设计规范

- 设计文件统一存放在 `design/` 目录，使用 Pencil `.pen` 格式
- `.pen` 文件通过 Pencil MCP 工具读写，**不得**使用 Read/Grep 等文本工具直接读取
- 文件命名规则：`{模块名}-{页面/组件}.pen`（如 `auth-login.pen`、`home-chat.pen`）
- 设计完成后使用 `get_screenshot` 工具截图验证视觉效果
- 前端实现时参考设计文件中的布局、颜色、间距等样式参数

## 模块化架构

项目采用**功能模块化架构**，前后端各功能为自包含模块，便于独立开发、移除和定制。

### 后端模块系统
- 每个功能模块实现 `ServerModule` 接口（`core/types.ts`）
- DI 容器（`core/container.ts`）通过 string token 管理依赖
- `app.ts` 遍历模块数组，自动挂载路由到 `/api/{module.name}` 和 Socket 处理器
- 添加新模块：在 `modules/` 创建目录 + 在 `app.ts` 的 modules 数组添加一行
- Repository 注册集中在 `core/registerRepositories.ts`

### 前端模块系统
- 每个功能模块实现 `ClientModule` 接口（`core/types.ts`），提供路由和 Guard 类型
- `core/moduleRegistry.ts` 列出所有模块
- `App.tsx` 动态渲染各模块路由，自动包裹 AuthGuard/GuestGuard
- 添加新模块：在 `modules/` 创建目录 + 在 `moduleRegistry.ts` 添加导入

### 新增模块步骤
1. **后端**: 创建 `server/src/modules/{name}/` 目录，包含 `index.ts`（模块定义）、`{Name}Service.ts`
2. **前端**: 创建 `client/src/modules/{name}/` 目录，包含 `index.ts`（模块定义）、`pages/`、`services/`、`stores/`
3. 分别在 `app.ts` 和 `moduleRegistry.ts` 中注册模块

## 架构设计原则
本项目是大型长期迭代项目，所有设计和编码必须遵循以下原则：

### 兼容性
- 新功能不得破坏已有功能，接口变更必须向后兼容
- 共享类型（packages/shared）的修改必须考虑对前后端双方的影响
- 数据结构变更需提供迁移方案，不能让旧数据失效

### 扩展性
- 采用模块化架构：每个功能为独立模块，通过统一接口注册
- 后端分层：模块路由 → Service → Repository，通过 DI 容器解耦
- 使用接口/抽象定义契约（如 Repository 接口），便于替换实现
- 前端组件设计为可复用、可组合的粒度（如聊天窗口同时用于私聊和群聊）
- 配置项集中管理，避免硬编码
- 消息类型、事件类型等使用枚举或常量统一管理，新增类型只需扩展不需改动框架

### 避免大规模重构
- 新增需求时优先通过新建模块而非修改已有模块来实现
- 关键模块预留扩展点（如消息处理管道、中间件链、事件监听）
- 数据模型设计预留可选字段，避免频繁改动核心数据结构
- 前端状态管理按功能模块拆分 store，各模块独立管理
- 后端各功能模块自包含路由、Service、Socket 处理器

## 数据层设计
- 当前: Redis 存储所有数据
- 后期: 冷数据迁移 MongoDB，热数据 Redis 缓存
- Repository 模式抽象数据访问，方便切换存储实现

## Claude Code Skills

本项目使用以下用户级 Skill（`~/.claude/skills/`），所有项目共享：

- **`/create-project`** — 创建新项目的完整流程和规范（Monorepo 脚手架、模块化架构、测试体系、编码规范）
- **`project-faq`** — 开发过程中遇到的疑难杂症与解决方案知识库（自动参考，遇到新问题解决后自动追加更新）

项目内 `knowledge/` 目录保存了这两个 Skill 的版本控制副本，便于追踪变更和团队共享：

- `knowledge/create-project.md` — 对应 `~/.claude/skills/create-project/SKILL.md`
- `knowledge/project-faq.md` — 对应 `~/.claude/skills/project-faq/SKILL.md`

> **同步规则**：更新 Skill 内容时，必须同时更新 `~/.claude/skills/` 和 `knowledge/` 两处文件，保持一致。

## 开发铁律
> **任何需求变更或新增功能，必须先写入 `doc/version-plan.md` 的版本规划中，按版本计划进行开发。严禁跳过规划直接开发。**

违规场景（禁止）：
- 用户提出新需求 → 直接写代码
- 发现缺陷需要改进 → 直接修改而不纳入版本计划

正确流程：
1. 将需求写入 `doc/version-plan.md`（归入现有版本或新建版本）
2. 更新 `doc/requirements.md` 中的需求描述
3. 进入计划模式（EnterPlanMode），完成实现方案设计
4. 用户确认后，按计划逐步实施
5. 实施完成后更新测试文档和 CLAUDE.md 版本状态

## 需求变更规范
每次需求变更时，必须同步更新以下文件：
1. `doc/requirements.md` - 需求文档
2. `doc/version-plan.md` - 版本规划（新需求必须归入版本）
3. `doc/test/v0.x.0-test.md` - 对应版本的测试文档
4. `.claude/plans/` - 当前执行计划
5. 如涉及全局规范变更，同步更新本文件（`CLAUDE.md`）

## 测试铁律
- **所有测试项必须为自动化测试（`[AUTO]`），禁止出现任何人工验证项（`[MANUAL]`）**
- 每个版本的测试文档（`doc/test/vX.X.0-test.md`）中所有测试项必须标记为 `[AUTO]`，并由 Jest / Playwright 等自动化框架覆盖
- 如果某个功能看似只能人工验证（如 UI 交互、Socket 广播），必须通过 mock / 组件测试 / 集成测试等手段将其转为自动化测试
- 不允许以 "需要人工验证" 为由跳过自动化测试编写

## 版本发布流程
每个版本完成后：
1. 自动化测试全部通过（`pnpm test` + `pnpm test:e2e`）
2. 运行 `bash scripts/test.sh` 全量回归，全部 AUTO 通过后标记 `[x]`
3. **更新版本号**：所有 `package.json`（根目录 + 各子包）的 `version` 字段 + 客户端首页显示版本号（`packages/client/src/modules/home/pages/Home/index.tsx` 中的 `vX.X.0`）
4. **用户确认通过后**，自动执行 `git add` + `git commit` 提交代码
5. 打上对应的版本标签（`git tag vX.X.0`）并推送到远端（`git push && git push --tags`）
6. 确认完成后再进入下一个版本开发

## 版本状态
- [x] v0.1.0 - 项目基础设施
- [x] v0.2.0 - 用户系统
- [x] v0.3.0 - 一对一聊天
- [x] v0.4.0 - 丰富消息类型
- [x] v0.5.0 - 群组聊天
- [x] v0.6.0 - 聊天记录与搜索
- [x] v0.7.0 - 缓存与离线
- [x] v0.8.0 - 桌面端（Electron）
- [x] v1.0.0 - Bot 系统（服务端）
- [x] v1.1.0 - Bot 系统（客户端）
- [x] v1.2.0 - AI 智能体桌面应用
- [x] v1.3.0 - 消息增强（撤回/编辑/引用/Emoji/Reactions）
- [x] v1.4.0 - 用户体验与通知
- [x] v1.5.0 - 会话管理
- [x] v1.6.0 - Bot 增强
- [x] v1.7.0 - 移动端基础：响应式布局 + 触摸优化
- [x] v1.8.0 - 移动端组件：全组件适配 + 交互优化
- [x] v1.9.0 - PWA 支持
- [x] v1.10.0 - 服务端机器人运行模式
- [x] v1.11.0 - 远程 Skill 系统（Electron）
- [x] v1.12.0 - 插件化 Skill + Bot 信任机制
- [x] v1.13.0 - DeepSeek 推理模型 + Bot Skill 定制
- [x] v1.14.0 - LLM 调用日志 + Skill 市场
- [x] v1.15.0 - 本地 Bot（Mastra AI 框架集成）
- [x] v1.16.0 - Skill 系统标准化（SKILL.md）
- [x] v1.17.0 - Skill 安装同步修复 + 文件上传增强
- [x] v1.18.0 - 本地 Bot 支持市场自定义 Skill
- [x] v1.19.0 - Skill 系统重构：Claude Agent Skills 标准
- [x] v1.20.0 - Skill 工作区上下文 + 交互式选项 UI
- [x] v1.21.0 - Mastra 统一运行时 + AI SDK 流式界面
