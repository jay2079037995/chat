# Chat - 即时通讯应用

## 项目简介
支持 Web 端和桌面端的即时通讯应用，采用 Monorepo 结构。

## 项目结构
```
chat/
├── packages/
│   ├── client/          # 前端 - React + Webpack + Ant Design
│   ├── server/          # 后端 - Express + Redis + Socket.io
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

## 架构设计原则
本项目是大型长期迭代项目，所有设计和编码必须遵循以下原则：

### 兼容性
- 新功能不得破坏已有功能，接口变更必须向后兼容
- 共享类型（packages/shared）的修改必须考虑对前后端双方的影响
- 数据结构变更需提供迁移方案，不能让旧数据失效

### 扩展性
- 采用分层架构：路由层 → 服务层 → 数据访问层，职责清晰
- 使用接口/抽象定义契约（如 Repository 接口），便于替换实现
- 前端组件设计为可复用、可组合的粒度（如聊天窗口同时用于私聊和群聊）
- 配置项集中管理，避免硬编码
- 消息类型、事件类型等使用枚举或常量统一管理，新增类型只需扩展不需改动框架

### 避免大规模重构
- 新增需求时优先通过扩展（新增文件/模块）而非修改已有代码来实现
- 关键模块预留扩展点（如消息处理管道、中间件链、事件监听）
- 数据模型设计预留可选字段，避免频繁改动核心数据结构
- 前端状态管理按功能模块拆分 store，避免单一 store 膨胀
- 后端路由按功能模块拆分文件，保持单文件职责单一

## 数据层设计
- 当前: Redis 存储所有数据
- 后期: 冷数据迁移 MongoDB，热数据 Redis 缓存
- Repository 模式抽象数据访问，方便切换存储实现

## 需求变更规范
每次需求变更时，必须同步更新以下文件：
1. `doc/requirements.md` - 需求文档
2. `doc/test/v0.x.0-test.md` - 对应版本的测试文档
3. `.claude/plans/` - 当前执行计划
4. 如涉及全局规范变更，同步更新本文件（`CLAUDE.md`）

## 版本发布流程
每个版本完成后：
1. 自动化测试全部通过（`pnpm test` + `pnpm test:e2e`）
2. 运行 `bash scripts/test.sh` 全量回归，全部 AUTO 通过后标记 `[x]`
3. **用户确认通过后**，自动执行 `git add` + `git commit` 提交代码，并打上对应的版本标签（`git tag v0.x.0`）
4. 确认完成后再进入下一个版本开发

## 版本状态
- [x] v0.1.0 - 项目基础设施
- [ ] v0.2.0 - 用户系统
- [ ] v0.3.0 - 一对一聊天
- [ ] v0.4.0 - 丰富消息类型
- [ ] v0.5.0 - 群组聊天
- [ ] v0.6.0 - 聊天记录与搜索
- [ ] v0.7.0 - 缓存与离线
- [ ] v0.8.0 - 桌面端（Electron）
