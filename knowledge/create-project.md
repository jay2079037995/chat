---
name: create-project
description: 创建新的全栈项目。当用户要求创建新项目、初始化项目、搭建项目脚手架时使用此 skill。
argument-hint: [项目名称]
---

# 创建项目 Skill

根据以下经过实战验证的流程和规范，帮助用户从零创建一个高质量的全栈项目。

## 创建流程

### 第 1 步：需求确认

在开始之前，向用户确认以下信息：

1. **项目名称**：英文小写，用作目录名和 package name
2. **项目类型**：Web 应用 / 移动端 / CLI 工具 / 库
3. **前端框架**：React / Vue / 无前端
4. **后端框架**：Express / Fastify / NestJS / 无后端
5. **数据库**：Redis / MongoDB / PostgreSQL / SQLite
6. **是否需要桌面端**：Electron / Tauri / 不需要
7. **包管理器**：pnpm（推荐）/ npm / yarn

### 第 2 步：项目脚手架

#### 2.1 Monorepo 初始化（推荐）

```bash
mkdir {项目名}
cd {项目名}
git init
pnpm init
```

创建 `pnpm-workspace.yaml`：
```yaml
packages:
  - 'packages/*'
```

#### 2.2 目录结构

```
{项目名}/
├── packages/
│   ├── client/          # 前端
│   ├── server/          # 后端
│   └── shared/          # 共享类型、常量、工具函数
├── e2e/                 # E2E 测试
├── scripts/             # 自动化脚本
├── doc/                 # 项目文档
│   ├── requirements.md  # 需求文档
│   ├── tech-stack.md    # 技术选型
│   ├── version-plan.md  # 版本规划
│   └── test/            # 测试文档
├── pnpm-workspace.yaml
├── package.json         # 根 package（scripts、devDependencies）
├── tsconfig.json        # 根 TypeScript 配置
├── .gitignore
├── .prettierrc
├── .eslintrc.js
└── CLAUDE.md            # Claude Code 项目指引
```

#### 2.3 共享包 (shared)

共享包是 Monorepo 的核心，前后端共用的类型和工具都放在这里：

```
packages/shared/
├── src/
│   ├── types/           # 共享类型定义
│   │   └── index.ts
│   ├── constants/       # 共享常量
│   │   └── index.ts
│   ├── utils/           # 共享工具函数
│   │   └── index.ts
│   └── index.ts         # 统一导出
├── package.json
└── tsconfig.json
```

package.json 关键配置：
```json
{
  "name": "@{项目名}/shared",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

### 第 3 步：后端搭建

#### 3.1 模块化架构（推荐）

```
packages/server/src/
├── core/                        # 模块系统基础设施
│   ├── types.ts                 # ServerModule 接口定义
│   ├── container.ts             # DI 容器（轻量工厂模式）
│   ├── tokens.ts                # 依赖 token 常量
│   └── registerRepositories.ts  # Repository 工厂注册
├── modules/                     # 功能模块（每个模块自包含）
│   └── {模块名}/
│       ├── index.ts             # 模块定义（路由 + 注册）
│       ├── {Name}Service.ts     # 业务逻辑
│       ├── middleware.ts        # 模块中间件（可选）
│       └── utils.ts             # 模块工具函数（可选）
├── repositories/                # 数据访问层
│   ├── interfaces/              # Repository 接口
│   └── {db}/                    # 具体实现（redis/ mongodb/）
├── config/
│   └── index.ts                 # 环境配置（dotenv）
├── app.ts                       # Express 应用 + 模块加载器
└── index.ts                     # 入口（启动 HTTP + WebSocket）
```

#### 3.2 核心接口设计

```typescript
/** 服务端模块接口 */
interface ServerModule {
  name: string;
  register(ctx: ModuleContext): ModuleRegistration;
}

/** 模块上下文（DI 容器的只读视图） */
interface ModuleContext {
  resolve<T>(token: string): T;
}

/** 模块注册返回值 */
interface ModuleRegistration {
  router?: Router;
  socketHandler?: (io: TypedIO, socket: TypedSocket) => void;
}
```

#### 3.3 DI 容器

采用轻量工厂模式，无装饰器、无 reflect-metadata：
- `registerFactory(token, factory)` — 注册工厂函数（惰性单例）
- `registerInstance(token, instance)` — 注册已有实例
- `resolve<T>(token)` — 解析依赖

#### 3.4 Repository 模式

数据访问层必须通过接口抽象，方便后续切换存储实现：

```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(dto: CreateUserDTO): Promise<User>;
  search(query: string, excludeId?: string): Promise<User[]>;
}
```

### 第 4 步：前端搭建

#### 4.1 模块化架构（推荐）

```
packages/client/src/
├── core/                        # 模块系统基础设施
│   ├── types.ts                 # ClientModule 接口
│   └── moduleRegistry.ts       # 模块注册表
├── modules/                     # 功能模块
│   └── {模块名}/
│       ├── index.ts             # 模块定义（路由 + Guard）
│       ├── pages/               # 页面组件
│       ├── components/          # 模块内组件
│       ├── services/            # API 请求封装
│       └── stores/              # Zustand 状态管理
├── components/                  # 共享组件（Guard、布局等）
├── services/
│   └── api.ts                   # 共享 Axios 实例
├── App.tsx                      # 模块驱动路由渲染
└── index.tsx                    # 入口
```

#### 4.2 核心接口设计

```typescript
interface ClientModule {
  name: string;
  routes: RouteObject[];
  guard?: 'auth' | 'guest' | 'none';
}
```

#### 4.3 App.tsx 模块驱动路由

App.tsx 从 moduleRegistry 读取所有模块，自动渲染路由并包裹 Guard：

```typescript
const guardMap = { auth: AuthGuard, guest: GuestGuard } as const;

{modules.map((mod) =>
  mod.routes.map((route) => {
    const Guard = mod.guard && mod.guard !== 'none' ? guardMap[mod.guard] : null;
    const element = Guard
      ? React.createElement(Guard, null, route.element)
      : route.element;
    return <Route key={`${mod.name}-${route.path}`} path={route.path} element={element} />;
  }),
)}
```

### 第 5 步：测试体系搭建

#### 5.1 测试铁律

> **所有测试项必须为自动化测试（`[AUTO]`），禁止出现任何人工验证项（`[MANUAL]`）。**

- 每个版本的测试文档（`doc/test/vX.X.0-test.md`）中所有测试项必须标记为 `[AUTO]`
- 如果某个功能看似只能人工验证（如 UI 交互、Socket 广播、点击外部关闭浮层），必须通过以下手段转为自动化测试：
  - **Socket 广播** → mock io/socket 对象，验证 `socket.to().emit()` 调用
  - **UI 交互** → React Testing Library `fireEvent` / `userEvent` 模拟用户操作
  - **动态导入组件** → `jest.mock()` 同时拦截静态和动态 `import()`
  - **CSS Module 环境** → 避免依赖 CSS class 选择器，使用 `data-testid` 或 DOM 结构查询
- 不允许以 "需要人工验证" 为由跳过自动化测试编写

#### 5.2 测试框架配置

- **单元/集成测试**: Jest + React Testing Library (前端) + Supertest (后端)
- **E2E 测试**: Playwright
- **测试脚本**: `scripts/test.sh`（支持版本筛选、回归测试）

#### 5.3 后端测试约定

```typescript
// 使用内存 Redis (ioredis-mock) 进行测试
// Supertest 直接测试 Express app，无需启动服务器
import request from 'supertest';
import { createApp } from '../src/app';
```

#### 5.4 前端测试约定

```typescript
// jest.mock 路径必须与实际 import 路径一致
// 使用 @testing-library/react 的 render + screen
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
```

### 第 6 步：配置文件

#### 6.1 TypeScript 配置

根目录 `tsconfig.json`：
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

#### 6.2 环境配置

使用 `dotenv` 从 `.env` 文件读取环境变量，config 集中管理：

```typescript
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || '{项目名}-jwt-secret-dev',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
};
```

### 第 7 步：CLAUDE.md 编写

每个项目必须创建 `CLAUDE.md`，包含以下必备章节：

1. **项目简介** — 一句话说明项目用途
2. **项目结构** — 目录树 + 各目录说明
3. **技术栈** — 完整列出使用的技术
4. **开发命令** — 常用 CLI 命令
5. **编码规范** — 命名、注释、测试等规范
6. **架构设计原则** — 兼容性、扩展性、避免重构
7. **数据层设计** — 当前存储方案和未来迁移计划
8. **版本状态** — 各版本完成情况

### 第 8 步：版本管理

#### 8.1 版本规划

将需求拆分为多个版本迭代（v0.1.0 ~ v0.x.0），每个版本聚焦一个核心功能：

```
v0.1.0 - 项目基础设施（脚手架、配置、CI）
v0.2.0 - 核心功能 A
v0.3.0 - 核心功能 B
...
```

#### 8.2 版本发布流程

1. 全部测试通过（单元 + 集成 + E2E）
2. 用户确认后 `git commit` + `git tag v0.x.0`
3. 确认完成后再进入下一版本

---

## 编码规范（通用）

1. **TypeScript 严格模式**，避免 `any`
2. **所有源代码添加中文注释**：文件级 JSDoc、接口/类/函数级注释、字段注释、关键逻辑行内注释
3. **Repository 模式**抽象数据访问，预留存储替换能力
4. **模块化架构**：每个功能为独立模块，通过统一接口注册
5. **前后端共享类型**放在 `packages/shared`
6. **每个功能写对应测试，且所有测试必须为自动化测试（`[AUTO]`），禁止 `[MANUAL]`**
7. **组件文件 PascalCase，工具函数 camelCase**
8. **每次需求变更同步更新**：`doc/requirements.md`、测试文档、`CLAUDE.md`

## 架构设计原则

1. **兼容性** — 新功能不破坏旧功能，接口向后兼容
2. **扩展性** — 通过新增模块而非修改已有模块实现新需求
3. **避免大规模重构** — 核心数据结构预留可选字段，关键模块预留扩展点
4. **分层解耦** — 路由 → Service → Repository，各层通过接口通信
