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
- **测试**: Jest + React Testing Library + Supertest
- **代码规范**: ESLint + Prettier

## 开发命令
```bash
pnpm install          # 安装依赖
pnpm dev:client       # 启动前端开发服务器
pnpm dev:server       # 启动后端服务
pnpm dev              # 同时启动前后端
pnpm build            # 构建项目
pnpm test             # 运行测试
pnpm lint             # 代码检查
```

## 编码规范
- TypeScript 严格模式，避免 any
- 后端数据访问层使用 Repository 模式，预留 MongoDB 接口
- 前后端共享类型放在 packages/shared
- 每个功能写对应的测试用例
- 组件文件使用 PascalCase，工具函数使用 camelCase

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
1. 自动化测试全部通过（`pnpm test`）
2. 按 `doc/test/v0.x.0-test.md` 测试文档逐条验证，通过的标记 `[x]`
3. **用户确认通过后**，自动执行 `git add` + `git commit` 提交代码，并打上对应的版本标签（`git tag v0.x.0`）
4. 确认完成后再进入下一个版本开发

## 版本状态
- [ ] v0.1.0 - 项目基础设施
- [ ] v0.2.0 - 用户系统
- [ ] v0.3.0 - 一对一聊天
- [ ] v0.4.0 - 丰富消息类型
- [ ] v0.5.0 - 群组聊天
- [ ] v0.6.0 - 聊天记录与搜索
- [ ] v0.7.0 - 缓存与离线
- [ ] v0.8.0 - 桌面端（Electron）
