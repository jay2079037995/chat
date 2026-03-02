# Chat - 版本规划

## 开发流程

每个版本完成后：
1. 自动化测试全部通过
2. 开发者（Claude）自测验证功能
3. **用户确认测试通过后**，再进入下一个版本开发

---

## v0.1.0 - 项目基础设施

**目标**：搭建完整的项目骨架，确保前后端可独立启动运行。

- [ ] Monorepo 初始化（pnpm workspace）
- [ ] 前端脚手架（React + Webpack + TypeScript + Ant Design + Zustand + CSS Modules/Less + React Router）
- [ ] 后端脚手架（Express + TypeScript + Redis + Socket.io + Repository 模式）
- [ ] 共享包（shared types, constants, utils）
- [ ] 代码规范配置（ESLint + Prettier + tsconfig 严格模式）
- [ ] 测试框架配置（Jest + React Testing Library + Supertest）
- [ ] CLAUDE.md 生成

**验证标准**：
- `pnpm install` 成功
- `pnpm dev:client` 前端开发服务器启动
- `pnpm dev:server` 后端服务启动
- `pnpm test` 测试通过
- `pnpm build` 构建成功

---

## v0.2.0 - 用户系统

**目标**：完成注册、登录、用户搜索功能。

### 后端
- [ ] POST `/api/auth/register` - 注册（用户名唯一校验、bcrypt 密码加密），注册成功自动登录返回 Token + Session
- [ ] POST `/api/auth/login` - HTTP 登录（返回 JWT Token + Session ID）
- [ ] POST `/api/auth/session` - Token 自动登录，验证 Token 有效性并返回最新 Session ID
- [ ] GET `/api/auth/me` - 获取当前用户信息（需要有效 Session）
- [ ] POST `/api/auth/logout` - 登出（销毁 Session）
- [ ] GET `/api/users/search?q=keyword` - 搜索用户
- [ ] Redis 数据结构设计（用户信息 Hash、Token 存储、Session 存储）
- [ ] JWT Token 认证中间件
- [ ] Session 验证中间件（HTTP 请求和 WebSocket 连接均需验证）

### 前端
- [ ] 注册页面（表单校验、错误提示）
- [ ] 登录页面
- [ ] 路由守卫（未登录跳转登录页）
- [ ] 自动登录逻辑（启动时检测本地 Token，有效则自动获取 Session）
- [ ] Token 持久化存储（localStorage）
- [ ] Session 管理（Zustand store，内存中持有当前 Session ID）
- [ ] 用户搜索组件
- [ ] 登出功能（清除 Token + Session，断开 WebSocket）

### 测试
- [ ] 后端：注册/登录 API 测试、Token 自动登录测试、Session 验证测试、搜索 API 测试
- [ ] 前端：注册/登录表单组件测试、自动登录流程测试

---

## v0.3.0 - 一对一聊天

**目标**：实现基本的一对一实时聊天功能。

### 后端
- [ ] Socket.io 连接管理（Session ID 验证、心跳检测，Session 无效拒绝连接）
- [ ] 私聊消息收发事件
- [ ] 在线状态管理
- [ ] 消息存储（Redis List/Sorted Set）
- [ ] 会话列表 API

### 前端
- [ ] 会话列表组件
- [ ] 聊天窗口组件
- [ ] 文字消息输入与展示
- [ ] 在线状态显示
- [ ] 消息已读/未读状态
- [ ] WebSocket 连接管理（Zustand store）

### 测试
- [ ] 后端：WebSocket 消息收发测试
- [ ] 前端：聊天组件渲染测试

---

## v0.4.0 - 丰富消息类型

**目标**：支持图片、录音、代码、Markdown、文件等消息类型。

### 后端
- [ ] 文件上传 API（multer）
- [ ] 文件存储（本地文件系统，预留 OSS 接口）
- [ ] 文件大小限制、类型校验

### 前端
- [ ] 图片消息：上传、预览、缩略图
- [ ] 录音消息：浏览器录音、音频播放控件
- [ ] 代码消息：代码输入框、语法高亮展示
- [ ] Markdown 消息：Markdown 编辑与渲染
- [ ] 文件消息：文件上传进度、下载

### 测试
- [ ] 后端：文件上传 API 测试
- [ ] 前端：各消息类型组件渲染测试

---

## v0.5.0 - 群组聊天

**目标**：实现群组创建、管理和群消息功能。

### 后端
- [ ] POST `/api/groups` - 创建群组
- [ ] POST `/api/groups/:id/members` - 邀请成员
- [ ] GET `/api/groups/:id` - 群组信息
- [ ] DELETE `/api/groups/:id/members/:userId` - 移除成员
- [ ] Socket.io Room 管理
- [ ] 群消息广播

### 前端
- [ ] 创建群组对话框
- [ ] 群成员列表展示
- [ ] 群聊天窗口（复用一对一聊天组件）
- [ ] 群组管理界面

### 测试
- [ ] 后端：群组 CRUD 测试、群消息广播测试
- [ ] 前端：群组相关组件测试

---

## v0.6.0 - 聊天记录与搜索

**目标**：支持聊天记录持久化和搜索功能。

### 后端
- [ ] GET `/api/messages/:conversationId` - 分页获取历史消息
- [ ] GET `/api/messages/search?q=keyword` - 搜索聊天记录
- [ ] Redis 消息索引优化

### 前端
- [ ] 历史消息滚动加载（上滑加载更多）
- [ ] 聊天记录搜索界面
- [ ] 搜索结果高亮定位

### 测试
- [ ] 后端：分页查询测试、搜索 API 测试
- [ ] 前端：滚动加载测试、搜索组件测试

---

## v0.7.0 - 缓存与离线

**目标**：优化前端缓存策略，支持离线消息同步。

### 前端
- [ ] IndexedDB / localStorage 缓存（用户信息、会话列表、最近消息）
- [ ] 缓存更新策略（对比服务端数据版本）
- [ ] 上线后同步未读消息
- [ ] 未读消息计数显示

### 后端
- [ ] 离线消息队列（Redis List）
- [ ] 上线时推送离线消息

### 测试
- [ ] 缓存读写测试
- [ ] 离线消息同步测试

---

## v0.8.0 - 桌面端

**目标**：使用 Electron 打包桌面端应用。

- [ ] Electron 主进程配置
- [ ] 加载 Web 端构建产物
- [ ] 桌面端窗口管理（尺寸、位置记忆）
- [ ] 原生菜单栏
- [ ] 系统托盘
- [ ] 打包配置
  - [ ] macOS（.dmg）
  - [ ] Windows（.exe）
  - [ ] Linux（.AppImage）

### 测试
- [ ] Electron 打包成功验证
- [ ] 基本功能回归测试

---

## v0.9.0 - 界面美化

**目标**：全面美化应用界面，活泼多彩风格（类似 Discord/Slack），渐变色图标，提升视觉品质。

### 全局
- [ ] CSS 自定义属性（`:root` 变量定义完整配色体系）
- [ ] Ant Design 主题配置（主色 #667eea、圆角 8px）
- [ ] 自定义滚动条（6px 宽、渐变色 thumb）
- [ ] App 图标（512x512 蓝紫渐变 + 白色气泡）
- [ ] 托盘图标（22x22）
- [ ] Favicon（32x32）

### 登录 / 注册页
- [ ] 动画渐变背景（蓝紫+青色，8s 循环）
- [ ] 毛玻璃卡片（backdrop-filter blur）
- [ ] Logo 区域（渐变图标 + 渐变标题 + 副标题）
- [ ] 装饰浮动圆形

### 主页布局
- [ ] 渐变 Header（蓝紫渐变背景 + 白色文字）
- [ ] 深色侧边栏（#2c2f3e + 适配搜索框/按钮）
- [ ] 渐变占位区

### 会话列表
- [ ] 暗底适配（文字颜色、头像渐变）
- [ ] 选中项渐变左边框 + 半透明背景

### 聊天窗口
- [ ] 自己的气泡蓝紫渐变 + 发光阴影
- [ ] 对方气泡白色 + 轻阴影
- [ ] 气泡圆角 16px + hover 微缩放
- [ ] 消息时间置于气泡上方
- [ ] 一对一和群聊均显示发送者用户名
- [ ] 在线状态点发光光圈

### 消息类型组件
- [ ] 图片消息圆角 + 阴影
- [ ] 代码消息渐变 header
- [ ] Markdown 消息主题色链接/代码块/引用
- [ ] 文件消息主题色图标

### 其他组件
- [ ] 消息工具栏渐变激活状态
- [ ] 创建群聊对话框美化
- [ ] 群成员面板在线指示器发光
- [ ] 消息搜索渐变高亮

### 测试
- [ ] 全量自动化测试通过（151 tests）
- [ ] `pnpm build` 编译通过
- [ ] 视觉检查全部页面

---

## v1.0.0 - @提及功能

**目标**：群聊中支持 @提及 成员，高亮显示，被 @ 的用户收到通知。

### 共享类型
- [ ] `Message` 添加 `mentions?: string[]` 字段
- [ ] Socket 新增 `mention:notify` Server→Client 事件

### 后端
- [ ] `ChatService` 注入 `IUserRepository`，解析消息中 `@username` → userId
- [ ] `RedisMessageRepository` 序列化/反序列化 `mentions` 字段
- [ ] `ChatModule` 消息广播后对被 @ 用户 emit `mention:notify`

### 前端
- [ ] `MentionInput` 组件（基于 Ant Design Mentions，@ 触发下拉成员列表）
- [ ] `ChatWindow` 群聊使用 `MentionInput`，私聊保持 `TextArea`
- [ ] `MessageBubble` 中 `@username` 高亮渲染
- [ ] Socket store 监听 `mention:notify`，弹出通知

### 测试
- [ ] 服务端：@解析、序列化、通知测试
- [ ] 前端：MentionInput 组件测试

---

## v1.1.0 - 机器人系统

**目标**：Telegram 风格机器人，外部程序通过 HTTP API 轮询收取消息、发送消息。

### 共享类型
- [ ] `User` 添加 `isBot?`、`botOwnerId?` 字段
- [ ] 新增 `Bot`、`BotUpdate` 类型

### 后端
- [ ] `IUserRepository` 新增 `createBot`、`findBotByToken`、`getBotsByOwner`、`deleteBot`
- [ ] `RedisUserRepository` 实现机器人 CRUD（含 token 索引）
- [ ] `BotService`：创建机器人、getUpdates（BLPOP 长轮询）、sendMessage、enqueueUpdate
- [ ] `BotModule`：5 个 API 路由（create/list/delete + getUpdates/sendMessage）
- [ ] `ChatModule` 消息发送后检查参与者中的机器人，入队 bot_updates
- [ ] GET `/api/chat/conversations` 返回 `botUserIds`

### 前端
- [ ] `botService` HTTP 服务（create/list/delete）
- [ ] `BotManager` Drawer 组件（创建/列表/删除机器人，显示 token）
- [ ] Home Header 添加"机器人"按钮
- [ ] `useChatStore` 新增 `botUserIds` 状态
- [ ] 会话列表/群成员中机器人用户标识

### 测试
- [ ] 服务端：机器人 CRUD、getUpdates、sendMessage 完整测试
- [ ] 前端：BotManager 组件测试
