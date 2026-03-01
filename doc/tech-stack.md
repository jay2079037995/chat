# Chat - 技术选型文档

## 技术栈总览

| 类别 | 选型 | 选择理由 |
|------|------|----------|
| 语言 | TypeScript | 类型安全，适合中大型项目，前后端统一语言 |
| 包管理器 | pnpm (workspace) | 磁盘空间高效，原生支持 Monorepo，速度快 |
| 前端框架 | React 18 | 生态成熟，组件化开发，社区资源丰富 |
| 构建工具 | Webpack 5 | 功能完善，插件生态丰富，支持复杂配置 |
| UI 组件库 | Ant Design 5 | 组件丰富，中文文档完善，适合聊天类应用 |
| 状态管理 | Zustand | 轻量、简洁，无 boilerplate，适合中型项目 |
| 样式方案 | CSS Modules + Less | 样式隔离，与 Ant Design 的 Less 变量体系兼容 |
| 路由 | React Router 6 | React 官方推荐路由方案 |
| 桌面端 | Electron | 跨平台桌面应用，可复用 Web 端代码 |
| 后端框架 | Express | 最大的 Node.js Web 框架生态，中间件丰富 |
| 数据库 | Redis | 高性能内存数据库，适合实时通信场景 |
| 数据库（后期） | MongoDB | 文档型数据库，适合存储非结构化的聊天记录 |
| 实时通信 | Socket.io | 功能完善（自动重连、房间、命名空间），开发效率高 |
| 测试框架 | Jest | 零配置测试框架，支持快照测试，社区广泛使用 |
| 前端测试 | React Testing Library | 以用户行为驱动的组件测试 |
| 后端测试 | Supertest | HTTP 断言库，配合 Express 测试 API |
| 代码规范 | ESLint + Prettier | 代码质量检查 + 格式化，业界标准 |

---

## 前端架构

```
packages/client/
├── src/
│   ├── index.tsx              # 入口文件
│   ├── App.tsx                # 根组件
│   ├── components/            # 通用组件
│   ├── pages/                 # 页面组件
│   │   ├── Login/             # 登录页
│   │   ├── Register/          # 注册页
│   │   └── Chat/              # 聊天主页
│   ├── stores/                # Zustand 状态管理
│   ├── services/              # API 请求 & WebSocket
│   ├── hooks/                 # 自定义 Hooks
│   ├── utils/                 # 工具函数
│   ├── types/                 # 类型定义
│   └── styles/                # 全局样式
├── public/                    # 静态资源
├── webpack.config.ts          # Webpack 配置
├── tsconfig.json
└── package.json
```

## 后端架构

```
packages/server/
├── src/
│   ├── index.ts               # 入口文件
│   ├── app.ts                 # Express 应用
│   ├── routes/                # 路由定义
│   ├── controllers/           # 控制器
│   ├── services/              # 业务逻辑
│   ├── repositories/          # 数据访问层（Repository 模式）
│   │   ├── interfaces/        # 抽象接口
│   │   ├── redis/             # Redis 实现
│   │   └── mongodb/           # MongoDB 实现（预留）
│   ├── middleware/             # 中间件（认证、错误处理）
│   ├── socket/                # Socket.io 处理
│   ├── config/                # 配置文件
│   ├── utils/                 # 工具函数
│   └── types/                 # 类型定义
├── tsconfig.json
└── package.json
```

## 共享包

```
packages/shared/
├── src/
│   ├── types/                 # 前后端共享类型
│   │   ├── user.ts            # 用户相关类型
│   │   ├── message.ts         # 消息相关类型
│   │   ├── group.ts           # 群组相关类型
│   │   └── socket.ts          # Socket 事件类型
│   ├── constants/             # 共享常量
│   └── utils/                 # 共享工具函数
├── tsconfig.json
└── package.json
```

---

## 数据层设计

### Repository 模式

```typescript
// 抽象接口示例
interface IUserRepository {
  create(user: CreateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  search(keyword: string): Promise<User[]>;
}

// Redis 实现
class RedisUserRepository implements IUserRepository { ... }

// MongoDB 实现（后期）
class MongoUserRepository implements IUserRepository { ... }
```

### 数据迁移策略（后期）
1. 冷数据：超过一定时间的聊天记录从 Redis 迁移到 MongoDB
2. 热数据：服务启动时从 MongoDB 加载活跃用户、最近会话到 Redis
3. 读写策略：优先读 Redis，miss 时读 MongoDB 并回写 Redis
