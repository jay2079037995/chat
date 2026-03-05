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

---

## v1.2.0 - AI 智能体桌面应用（Agent App）

**目标**：独立 Electron 桌面应用，管理 AI Agent 连接 chat 机器人，实现 LLM 驱动的多轮对话。

### 新建包 `packages/agent-app`
- [ ] Electron + React + Webpack 脚手架
- [ ] `AgentManager`：Agent 轮询循环（getUpdates → LLM → sendMessage）
- [ ] `BotClient`：HTTP 调用 chat Bot API
- [ ] `LLMClient`：统一 OpenAI 兼容格式调用（DeepSeek / MiniMax）
- [ ] `ConversationHistory`：内存对话历史管理
- [ ] `electron-store` 持久化 Agent 配置
- [ ] React UI：Agent 列表、创建/编辑表单、运行日志
- [ ] Zustand store + IPC 桥接

### 根项目
- [ ] 根 `package.json` 添加 `dev:agent-app` 和 `dist:agent-app` scripts

### 测试
- [ ] LLM Client provider 映射测试
- [ ] Bot Client URL 构建测试
- [ ] ConversationHistory 多会话隔离测试
- [ ] AgentManager 启动/停止/轮询逻辑测试

---

## v1.3.0 - 消息增强

**目标**：消息撤回/编辑、引用回复、Emoji 选择器、消息表情回应。

### 共享类型
- [ ] `Message` 添加 `recalled?: boolean`、`edited?: boolean`、`editedAt?: number`
- [ ] `Message` 添加 `replyTo?: string`、`replySnapshot?: ReplySnapshot`
- [ ] `Message` 添加 `reactions?: Record<string, string[]>`
- [ ] 新增 `ReplySnapshot` 类型（senderId + content + type）
- [ ] `ClientToServerEvents` 新增 `message:recall`、`message:edit`、`message:react`
- [ ] `ServerToClientEvents` 新增 `message:recalled`、`message:edited`、`message:reacted`
- [ ] `message:send` 事件 data 新增可选 `replyTo` 字段

### 后端
- [ ] `IMessageRepository` 新增 `getMessage(id)` 和 `updateMessage(id, updates)` 方法
- [ ] `RedisMessageRepository` 实现上述方法 + 序列化/反序列化新字段
- [ ] `ChatService` 新增 `recallMessage()`（2 分钟内、仅发送者）
- [ ] `ChatService` 新增 `editMessage()`（5 分钟内、仅文本/markdown、仅发送者）
- [ ] `ChatService` 新增 `toggleReaction()`（toggle emoji → userId[]）
- [ ] `ChatService.sendMessage()` 支持 `replyTo` 参数，自动生成 `replySnapshot`
- [ ] `ChatModule` 新增 `message:recall`、`message:edit`、`message:react` Socket handler
- [ ] Socket handler 校验权限后广播 `message:recalled`/`message:edited`/`message:reacted`

### 前端
- [ ] `MessageContextMenu` 组件：右键菜单（撤回/编辑/回复/表情/转发）
- [ ] `ReplyPreview` 组件：输入区域上方的引用条（可关闭）
- [ ] `EmojiPicker` 组件：基于 `@emoji-mart/react` 的 Emoji 选择器浮层
- [ ] `MessageBubble` 支持撤回消息显示（"xxx 撤回了一条消息"）
- [ ] `MessageBubble` 支持编辑标记显示（"(已编辑)"）
- [ ] `MessageBubble` 支持引用气泡显示（replySnapshot）
- [ ] `MessageBubble` 支持 reactions 显示（emoji pills + 计数）
- [ ] `ChatWindow` 集成引用条 + Emoji Picker + 右键菜单
- [ ] `useChatStore` 新增 `replyingTo` 状态、`sendMessage` 支持 replyTo
- [ ] `useSocketStore` 监听 `message:recalled`/`message:edited`/`message:reacted` 事件

### 测试
- [ ] 服务端：撤回（时限/权限/重复撤回）、编辑（时限/类型/权限）、引用回复（快照生成）、reaction（toggle/多用户）
- [ ] 前端：MessageContextMenu、ReplyPreview、EmojiPicker 组件测试

---

## v1.4.0 - 用户体验与通知

**目标**：用户头像/资料、已读回执 UI、输入状态指示、系统通知、暗色模式。

### 共享类型
- [ ] `User` 添加 `nickname?: string`、`avatar?: string`、`bio?: string`
- [ ] `ClientToServerEvents` 新增 `typing:start`、`typing:stop`
- [ ] `ServerToClientEvents` 新增 `typing:start`、`typing:stop`

### 后端
- [ ] `PUT /api/auth/profile` — 更新 nickname/bio
- [ ] `POST /api/auth/avatar` — 上传头像（multer）
- [ ] `GET /api/auth/user/:id` — 获取用户公开资料
- [ ] `IUserRepository` + `RedisUserRepository` 新增 `updateProfile` 方法
- [ ] `ChatModule` 新增 `typing:start`/`typing:stop` Socket 转发

### 前端
- [ ] `ProfileDrawer` 组件：编辑 nickname/bio + 上传头像
- [ ] 所有 Avatar 组件显示真实头像（有则显示图片，无则首字母）
- [ ] `MessageBubble` 显示已读状态（✓ 已发送 / ✓✓ 已读）
- [ ] `ChatWindow` 显示 "正在输入…" 指示
- [ ] 系统通知：Browser Notification API + 未读总数显示在标题
- [ ] 暗色模式：CSS 变量切换 + Ant Design `darkAlgorithm` + 主题 store + 持久化
- [ ] `useThemeStore` — 管理 light/dark/system 主题切换
- [ ] `global.less` 新增 `[data-theme="dark"]` 变量覆盖

### 测试
- [ ] 服务端：用户资料 CRUD、头像上传测试
- [ ] 前端：ProfileDrawer、暗色模式切换测试

---

## v1.5.0 - 会话管理

**目标**：置顶会话、免打扰、群消息置顶、消息转发、会话归档/删除、会话标签。

### 共享类型
- [ ] `Message` 添加 `forwardedFrom?: { conversationId, senderId, senderName }`

### 后端
- [ ] `POST /api/chat/conversations/:id/pin` — toggle 置顶
- [ ] `POST /api/chat/conversations/:id/mute` — toggle 免打扰
- [ ] `POST /api/chat/conversations/:id/archive` — 归档会话
- [ ] `DELETE /api/chat/conversations/:id` — 删除会话
- [ ] `POST /api/chat/conversations/:id/tag` — 设置标签
- [ ] `GET /api/chat/conversations/:id/pinned` — 获取置顶消息
- [ ] `message:pin` Socket 事件 — 群消息置顶
- [ ] Redis 新键：`pinned_convs:{userId}`、`muted_convs:{userId}`、`archived_convs:{userId}`、`conv_tags:{userId}`、`pinned_msg:{convId}`
- [ ] GET /api/chat/conversations 返回附带 pinnedIds/mutedIds/tags

### 前端
- [ ] `PinnedMessage` 组件：ChatWindow 顶部置顶消息条
- [ ] `ForwardModal` 组件：会话选择器弹窗
- [ ] ConversationList 右键菜单（置顶/免打扰/标签/归档/删除）
- [ ] ConversationList 置顶排序 + 标签筛选 + 归档入口
- [ ] MessageBubble 显示转发标记
- [ ] MessageContextMenu 添加"转发"/"置顶"选项

### 测试
- [ ] 服务端：置顶/免打扰/归档/标签 API 测试
- [ ] 前端：PinnedMessage、ForwardModal 组件测试

---

## v1.6.0 - Bot 增强

**目标**：Bot 获取聊天历史（让 bot 知道完整聊天内容）、更多 LLM 提供商、Bot 富文本回复、Slash 命令。

### 后端
- [ ] `GET /api/bot/getHistory?token=xxx&conversationId=yyy&limit=50&offset=0` — Bot 获取会话历史消息
- [ ] `BotService` 新增 `getHistory()` 方法（校验 bot 为会话参与者）

### Agent App
- [ ] `BotClient` 新增 `getHistory(conversationId, limit, offset)` 方法
- [ ] `AgentManager` 首次收到新 conversationId 时自动加载历史
- [ ] `ConversationHistory` 新增 `prefillHistory()` 方法
- [ ] `PROVIDERS` 扩展：OpenAI、Claude、通义千问、自定义端点
- [ ] `LLMClient` 支持 Claude API 格式（非 OpenAI 兼容）
- [ ] `LLMClient` 支持 custom provider（用户填写任意 baseUrl）
- [ ] Markdown 检测：LLM 回复含 markdown 特征时自动设置 type=markdown
- [ ] Slash 命令处理（/help、/model、/reset、/system）
- [ ] `AgentForm` UI 更新：新 provider 选项 + custom URL 输入

### 测试
- [ ] 服务端：getHistory API 权限/分页测试
- [ ] Agent App：getHistory、prefillHistory、slash 命令、markdown 检测测试

---

---

## v1.7.0 - 移动端基础（响应式布局 + 触摸优化）

**目标**：建立响应式基础设施，主布局和认证页面移动端适配，触摸基础优化。

### 前端
- [ ] `responsive.less` — 断点变量（@mobile: 768px, @tablet: 1024px）+ 响应式 mixin
- [ ] `useIsMobile` hook — 监听 viewport 宽度判断移动端
- [ ] `global.less` — 移动端变量覆盖 + touch-action + 安全区域适配
- [ ] `webpack.config.js` — viewport meta 标签（viewport-fit=cover）
- [ ] `Home.tsx` — 移动端视图切换（一次只显示会话列表 OR 聊天窗口）
- [ ] `Home/index.module.less` — 移动端全屏布局 + header 缩小(56px)
- [ ] `Login/index.module.less` — 登录卡片响应式（max-width: 420px）
- [ ] `Register/index.module.less` — 注册页面响应式
- [ ] Header 移动端精简（隐藏文字标签，仅图标）

### 测试
- [ ] useIsMobile hook 测试
- [ ] 移动端布局切换测试（视图切换、返回按钮）
- [ ] 桌面端回归（布局不变）

---

## v1.8.0 - 移动端组件（全组件适配 + 交互优化）

**目标**：对所有聊天组件做移动端适配，添加触摸交互支持。

### 前端
- [ ] `useLongPress` hook — 长按手势（500ms 触发）
- [ ] `ChatWindow` — 移动端返回按钮 + onBack prop + 精简工具栏
- [ ] `ChatWindow/index.module.less` — 移动端间距调整
- [ ] `MessageBubble/index.module.less` — 气泡 max-width: 60% → 85%（移动端）
- [ ] `ConversationList/index.module.less` — 触摸友好间距 + 长按替代右键
- [ ] `MessageContextMenu` — 移动端底部弹出 Sheet + 长按触发
- [ ] `EmojiPicker` — 移动端全屏/底部弹出
- [ ] `MessageToolbar` — 移动端精简按钮
- [ ] `ReplyPreview` — 缩小预览区高度
- [ ] `ImageMessage` — 移动端全宽 + 点击全屏预览
- [ ] `GroupMemberPanel` — 移动端 Drawer 滑出
- [ ] `CreateGroupDialog` / `MessageSearch` / `BotManager` — 移动端全屏
- [ ] `MentionInput` — 触摸键盘适配

### 测试
- [ ] useLongPress hook 测试
- [ ] ChatWindow 移动端返回按钮测试
- [ ] 桌面端全量回归

---

## v1.9.0 - PWA 支持（Service Worker + 离线 + 安装）

**目标**：将应用升级为 PWA，支持离线访问、安装到主屏幕。

### 前端
- [ ] `manifest.json` — PWA 清单（name/icons/display:standalone/theme_color）
- [ ] PWA 图标（192x192 + 512x512，复用蓝紫渐变设计）
- [ ] `registerSW.ts` — Service Worker 注册 + 更新提示
- [ ] `webpack.config.js` — Workbox 插件（CacheFirst/NetworkFirst 策略）
- [ ] `offlineQueue.ts` — 离线消息队列（网络恢复后自动重发）
- [ ] `useSocketStore` — 监听 navigator.onLine + 断线提示 + 自动重连
- [ ] `cacheService.ts` — 增强离线缓存（会话列表 + 最近消息）
- [ ] `InstallPrompt` 组件 — "添加到主屏幕" 提示条
- [ ] `index.tsx` — 入口调用 registerServiceWorker()

### 依赖
- [ ] `workbox-webpack-plugin`

### 测试
- [ ] offlineQueue 单元测试
- [ ] InstallPrompt 组件测试
- [ ] registerSW 测试
- [ ] pnpm build 生成 service-worker.js + manifest.json

---

## v1.10.0 - 服务端机器人运行模式

**目标**：创建机器人时支持选择「服务端运行」或「客户端运行」。服务端模式下无需 agent-app，服务器直接消费消息队列并调用 LLM 回复。

### 共享类型
- [ ] `BotRunMode = 'client' | 'server'` — 机器人运行模式
- [ ] `BotStatus = 'running' | 'stopped' | 'error'` — 服务端机器人状态
- [ ] `LLMProvider` — LLM 提供商类型（从 agent-app 提取到共享包）
- [ ] `LLMConfig` — LLM 配置（provider/apiKey/model/systemPrompt/contextLength/custom*）
- [ ] `ChatMessage` — LLM 对话消息类型
- [ ] `LLM_PROVIDERS` 常量 — Provider 配置信息（baseUrl/models）
- [ ] `Bot` 扩展 `runMode?`、`status?`、`llmConfig?` 字段

### 后端
- [ ] `CryptoUtils` — API Key AES-256-GCM 加解密 + 脱敏
- [ ] `LLMClient` — 服务端 LLM 调用（移植自 agent-app，支持 OpenAI 兼容 + Claude）
- [ ] `BotService` 扩展 — sendMessageByBotId、saveServerBotConfig、getServerBotConfig、setBotStatus 等
- [ ] `ServerBotRunner` — 单 Bot 轮询循环（直接 BLPOP + LLM 调用 + Redis 对话历史持久化）
- [ ] `ServerBotManager` — 多 Bot 生命周期管理 + 服务器重启自动恢复
- [ ] `POST /api/bot/create` — 支持 runMode + llmConfig 参数
- [ ] `PUT /api/bot/:id/config` — 更新服务端 Bot LLM 配置
- [ ] `POST /api/bot/:id/start` / `POST /api/bot/:id/stop` — 启停服务端 Bot
- [ ] `GET /api/bot/providers` — 返回可用 LLM providers 列表
- [ ] `GET /api/bot/list` — 返回 runMode、status、llmConfig（apiKey 脱敏）

### 前端
- [ ] `ServerBotConfigForm` — 可复用 LLM 配置表单组件
- [ ] `BotManager` 创建区域 — 新增运行模式选择 + 服务端时展开 LLM 配置表单
- [ ] `BotManager` 列表改造 — 显示运行模式标签、状态、编辑/启停按钮
- [ ] `botService` — 新增 updateBotConfig/startBot/stopBot/getProviders API

### Agent-App 适配
- [ ] `Provider`/`PROVIDERS`/`ChatMessage` 改为从 `@chat/shared` re-export

### 测试
- [ ] CryptoUtils 加解密测试
- [ ] LLMClient 调用格式测试
- [ ] ServerBotRunner + ServerBotManager 测试
- [ ] BotManager 服务端模式 UI 测试
- [ ] BotService 新方法测试
- [ ] pnpm build + pnpm test 全量通过

---

## v1.11.0 - 远程 Skill 系统（Electron）

**目标**：服务端 Bot 通过 Skill 协议远程控制用户的 Electron 桌面端，实现操作 Mac 原生应用（备忘录、相册、日历等）、文件系统、Shell 命令等能力。Bot 的 LLM 通过 function calling 决策调用哪个 Skill，指令通过 Socket.IO 下发到 Electron 客户端本地执行。

### 共享类型
- [ ] `Skill` 接口 — name/description/parameters(JSONSchema)/platform/permissions
- [ ] `SkillExecRequest` — skillName/params/requestId/targetUserId
- [ ] `SkillExecResult` — requestId/success/data/error
- [ ] `SkillPermission` — read/write/execute/dangerous 权限等级
- [ ] Socket 新增 `skill:exec` (Server→Client) / `skill:result` (Client→Server) 事件

### 后端
- [ ] `SkillRegistry` — 注册所有可用 Skill 的元数据（name/description/parameters），供 LLM function calling 使用
- [ ] `ServerBotRunner` 扩展 — LLM 调用改为 function calling 模式，tools 列表从 SkillRegistry 获取
- [ ] `ServerBotRunner` 扩展 — LLM 返回 tool_call 时，通过 Socket.IO 向目标用户 Electron 端下发 `skill:exec`
- [ ] `ServerBotRunner` 扩展 — 等待 `skill:result` 回传，将结果反馈给 LLM 继续对话
- [ ] `SkillModule` — Skill 相关 API 路由（GET /skills 列表、GET /skills/:name 详情）
- [ ] 超时机制 — Skill 执行超时（默认 30s）自动返回错误

### Electron 客户端（packages/electron）
- [ ] `SkillRuntime` — Skill 执行引擎，注册/发现/执行本地 Skill
- [ ] `SkillBridge` — Socket.IO 监听 `skill:exec` 事件，调用 SkillRuntime 执行，返回 `skill:result`
- [ ] 权限管理 — 按 Skill 权限等级弹出确认框（read 自动执行、write 需确认、dangerous 逐次确认）
- [ ] Skill 执行日志 — 记录所有 Skill 调用历史，供用户审计

### 内置 Skill（Mac 平台）
- [ ] `mac:notes` — 备忘录操作（AppleScript → Notes.app）：列出/搜索/读取/创建/更新/删除笔记
- [ ] `mac:calendar` — 日历操作（AppleScript → Calendar.app）：查看/创建/删除日程
- [ ] `mac:reminders` — 提醒事项（AppleScript → Reminders.app）：增删改查
- [ ] `mac:finder` — 文件操作（Node.js fs + child_process）：搜索/打开/移动/复制/压缩
- [ ] `mac:photos` — 相册操作（AppleScript → Photos.app）：列出相册/搜索/导出照片
- [ ] `mac:clipboard` — 剪贴板（Electron clipboard API）：读写剪贴板内容
- [ ] `mac:shell` — Shell 命令执行（child_process）：执行任意终端命令（dangerous 权限）
- [ ] `mac:browser` — 浏览器操作（AppleScript → Safari/Chrome）：打开 URL、获取当前标签页
- [ ] `mac:system-info` — 系统信息（os + child_process）：CPU/内存/磁盘/网络状态
- [ ] `mac:notification` — 系统通知（Electron Notification）：发送桌面通知

### 安全设计
- [ ] 权限分级：read（自动）、write（单次确认）、execute（单次确认）、dangerous（逐次确认 + 命令预览）
- [ ] Skill 白名单 — 用户可配置允许/禁止的 Skill 列表
- [ ] 审计日志 — 所有 Skill 执行记录可查
- [ ] Bot 权限绑定 — 每个 Bot 可配置允许使用的 Skill 子集

### 测试
- [ ] SkillRegistry 注册/查询测试
- [ ] ServerBotRunner function calling 流程测试（mock LLM tool_call）
- [ ] SkillBridge Socket.IO 通信测试
- [ ] SkillRuntime 执行 + 权限校验测试
- [ ] 各内置 Skill 单元测试（mock AppleScript/child_process）
- [ ] 超时/错误处理测试
- [ ] pnpm build + pnpm test 全量通过

---

## v1.12.0 - 插件化 Skill + Bot 信任机制

**目标**：Skill 系统从内置硬编码升级为可插拔架构，支持安装/卸载自定义 Skill 包。同时引入 Bot 级别信任机制，受信 Bot 的所有操作自动放行。

### 共享类型
- [x] SkillDefinition 增加 `source?: 'builtin' | 'custom'`、`enabled?: boolean` 字段
- [x] 新增 SkillPackageManifest 类型（manifest.json 格式，含 version?/author?）
- [x] 新增 SkillSyncRequest / SkillSyncResult 类型
- [x] 新增 BotTrustConfig 类型（botId/botUsername/trusted）
- [x] Socket ClientToServerEvents 新增 `skill:sync` 事件（带 callback）

### 服务端
- [x] SkillRegistry 新增 unregister()（仅 custom 可卸载）
- [x] SkillRegistry 新增 setEnabled()/loadEnabledStates()（Redis Hash `skill_enabled`）
- [x] SkillRegistry.generateTools() 过滤已禁用的 Skill
- [x] SkillModule 新增 PUT /api/skill/:name/enable 路由
- [x] SkillModule 新增 socketHandler 处理 skill:sync 事件

### Electron
- [x] BotTrustStore — electron-store 持久化 Bot 信任配置
- [x] PermissionManager 新增 botId 参数 — 受信 Bot 自动放行
- [x] SkillPackageManager — 扫描/安装/卸载 userData/skills/ 下的自定义 Skill 包
- [x] SkillRuntime 集成 — 查找自定义 handler + 传 botId 给 PermissionManager
- [x] Preload + IPC 新增 7 个通道

### 客户端
- [x] skillBridge 连接后同步自定义 Skill 到服务端

### 测试
- [x] SkillRegistry 增强测试 10
- [x] Skill 同步测试 4
- [x] SkillPackageManager 测试 8
- [x] Bot 信任测试 11
- [x] 现有测试无破坏（473 → 506，新增 33）
- [x] pnpm build + pnpm test 全量通过

---

## v1.13.0 - DeepSeek 推理模型 + Bot Skill 定制

**目标**：接入 DeepSeek deepseek-reasoner（R1 推理模型），完整展示思维链推理过程。同时让用户通过 UI 为每个 Bot 选择可用的 Skill，实现精细化的 Bot 能力管控。

### 需求 A: deepseek-reasoner 模型接入

deepseek-reasoner 与 deepseek-chat 的 API 差异：不支持 function calling (tools)、temperature 参数无效、响应含 `reasoning_content` 思维链字段、多轮对话不得传入 reasoning_content。

#### 共享类型
- [ ] LLM_PROVIDERS.deepseek.models 添加 `'deepseek-reasoner'`

#### 服务端
- [ ] LLMClient LLMResponse 接口 message 添加 `reasoning_content` 字段
- [ ] LLMClient 新增 `isReasonerModel()` / `formatReasonerResponse()` 辅助函数
- [ ] LLMClient `callOpenAICompatible` 推理模型不传 temperature，响应组合 reasoning_content + content
- [ ] LLMClient `callOpenAICompatibleWithTools` 推理模型不传 temperature、不传 tools
- [ ] ServerBotRunner 推理模型跳过 tool calling loop

#### Agent App
- [ ] agent-app LLMClient 同步适配（reasoning_content + 跳过 temperature）

### 需求 B: Bot Skill 定制 UI

现有 `BotService` 已有 `getBotAllowedSkills()`/`setBotAllowedSkills()` 方法但未接通。需要打通 UI → API → Runner。

#### 共享类型
- [ ] Bot 接口新增 `allowedSkills?: string[]` 字段

#### 服务端
- [ ] `GET /api/bot/list` 返回 `allowedSkills`
- [ ] 新增 `PUT /api/bot/:id/skills` 路由设置 Bot 允许的 Skill
- [ ] ServerBotRunner 构造函数接收 `allowedSkills`，generateTools 传入 `allowedFunctions` 白名单
- [ ] ServerBotRunner 新增 `updateAllowedSkills()` 热更新方法
- [ ] ServerBotManager 启动时加载 allowedSkills + 新增 `updateBotSkills()` 方法

#### 前端
- [ ] `botService` 新增 `getAvailableSkills()` / `setBotSkills()` API 方法
- [ ] BotManager 编辑 Modal 新增 Skill 选择区域（Checkbox.Group，默认全选）
- [ ] 选择 deepseek-reasoner 时 Skill 区域提示「该模型不支持 Skill 调用」并禁用

### 测试
- [ ] pnpm build 全部编译成功
- [ ] pnpm test 全部通过

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/shared/src/constants/index.ts` | deepseek models 添加 `'deepseek-reasoner'` |
| `packages/shared/src/types/bot.ts` | Bot 新增 `allowedSkills` 字段 |
| `packages/server/src/modules/bot/LLMClient.ts` | reasoning_content 处理 + 跳过 temperature |
| `packages/agent-app/src/main/llmClient.ts` | 同上（简化版） |
| `packages/server/src/modules/bot/ServerBotRunner.ts` | reasoner 跳过 tools + allowedSkills 过滤 |
| `packages/server/src/modules/bot/ServerBotManager.ts` | 启动时加载 allowedSkills + 热更新 |
| `packages/server/src/modules/bot/index.ts` | `PUT /api/bot/:id/skills` + list 返回 skills |
| `packages/client/src/modules/chat/services/botService.ts` | 新增 skill API 方法 |

---

## v1.14.0 - LLM 调用日志 + Skill 市场

**目标**：Server Bot 管理界面可查看每次 LLM API 调用的完整日志；Skill 市场 UI 支持在线浏览/搜索/安装/卸载自定义 Skill。

### 需求 A: LLM 调用日志

在 ServerBotRunner 层记录每次 LLM API 调用，存储到 Redis Sorted Set（每 bot 最多 100 条，7 天 TTL）。

#### 共享类型
- [ ] `LLMCallLog` 接口（id, botId, timestamp, request, response, error, durationMs, toolRound）

#### 服务端
- [ ] BotService 新增 `saveLLMCallLog()` / `getLLMCallLogs()` / `clearLLMCallLogs()` 方法
- [ ] LLMCallResult 接口增加 `reasoningContent` 字段
- [ ] ServerBotRunner 包装所有 LLM 调用，记录请求/响应/错误/耗时
- [ ] 新增 `GET /api/bot/:id/logs` 和 `DELETE /api/bot/:id/logs` API 端点

#### 前端
- [ ] `botService` 新增 `getBotLogs()` / `clearBotLogs()` 方法
- [ ] 新建 BotLogViewer 组件（Modal，展示日志列表 + 展开详情 + 分页 + 清空）
- [ ] BotManager 每个 server bot 增加"日志"按钮

### 需求 B: Skill 市场

定义 JSON 注册表格式，Electron 端下载/安装 Skill 包，UI 支持已安装管理和在线浏览/搜索。

#### 共享类型
- [ ] `SkillRegistryEntry` / `SkillRegistryIndex` 接口

#### Electron 端
- [ ] 新建 SkillMarketplace 管理器（注册表管理 + 下载安装）
- [ ] 新增 IPC 处理器（get-registries, set-registries, fetch-marketplace, download-install）
- [ ] Preload 暴露市场 API
- [ ] 添加 `extract-zip` 依赖

#### 前端
- [ ] 新建 SkillMarketplace UI 组件（已安装 + 在线市场 Tab，搜索，注册表管理）
- [ ] BotManager 增加"Skill 市场"按钮
- [ ] 安装/卸载后通过 Socket.IO 同步到服务端 SkillRegistry

### 测试
- [ ] pnpm build 全部编译成功
- [ ] pnpm test 全部通过

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/shared/src/types/bot.ts` | 新增 `LLMCallLog` 类型 |
| `packages/shared/src/types/skill.ts` | 新增 `SkillRegistryEntry`、`SkillRegistryIndex` 类型 |
| `packages/server/src/modules/bot/BotService.ts` | 日志存储/查询/清理方法 |
| `packages/server/src/modules/bot/LLMClient.ts` | `LLMCallResult` 增加 `reasoningContent` |
| `packages/server/src/modules/bot/ServerBotRunner.ts` | 日志记录包装 |
| `packages/server/src/modules/bot/index.ts` | `GET/DELETE /api/bot/:id/logs` |
| `packages/client/src/modules/chat/services/botService.ts` | 日志 API 方法 |
| `packages/client/src/modules/chat/components/BotManager/BotLogViewer.tsx` | **新建** 日志查看器 |
| `packages/client/src/modules/chat/components/BotManager/BotLogViewer.module.less` | **新建** 样式 |
| `packages/client/src/modules/chat/components/BotManager/SkillMarketplace.tsx` | **新建** Skill 市场 |
| `packages/client/src/modules/chat/components/BotManager/SkillMarketplace.module.less` | **新建** 样式 |
| `packages/client/src/modules/chat/components/BotManager/index.tsx` | 集成日志+市场按钮 |
| `packages/electron/src/skills/SkillMarketplace.ts` | **新建** 市场管理器 |
| `packages/electron/src/main.ts` | 市场 IPC 处理器 |
| `packages/electron/src/preload.ts` | 暴露市场 API |
| `packages/client/src/modules/chat/components/BotManager/index.tsx` | Skill 选择 UI |

---

## v1.15.0 - 本地 Bot（Mastra AI 框架集成）

**目标**：新增 `local` 运行模式，将 Mastra AI 框架嵌入 Electron 主进程，支持本地运行智能 Bot，具备流式输出和 Mastra 原生 Tool 系统。

### 核心设计

- 模型体系：完全使用 Mastra / Vercel AI SDK（@ai-sdk/openai、@ai-sdk/anthropic、@ai-sdk/google 等）
- API Key：同步到服务器（加密存 Redis，复用现有加密机制）
- Tool 系统：完全支持 Mastra `createTool()`，将现有 Skill handlers 桥接为 Mastra Tool
- 输出方式：流式（`agent.stream()`），打字机效果

### 数据流

```
用户发消息 → Server Socket.IO → 保存 DB
  → 检测 local bot → emit 'localbot:message' 到 bot owner 的 user room
  → Electron renderer → IPC → main process LocalBotManager
  → Mastra Agent.stream() → 流式 chunk → IPC → renderer → Socket.IO
  → Server 中继 'message:stream' 到会话 room → Client 打字机渲染
  → 流结束 → Server 保存完整消息到 DB
```

### 功能清单

#### 共享层
- [ ] `BotRunMode` 增加 `'local'`
- [ ] 新增 `MastraProvider` 类型（openai / anthropic / google / deepseek / qwen）
- [ ] 新增 `MastraLLMConfig` 接口（provider, apiKey, model, systemPrompt, contextLength, enabledTools）
- [ ] 新增 Socket.IO 事件（localbot:message, message:stream, localbot:stream, localbot:stream:end, localbot:error）
- [ ] 新增 `MASTRA_PROVIDERS` 常量（各厂商 displayName + models 列表）

#### 服务端
- [ ] BotService 新增 Mastra 配置 CRUD 方法（saveMastraConfig, getMastraConfig, getMastraConfigMasked）
- [ ] BotService 新增 `getLocalBotConfigs(ownerId)` 批量获取
- [ ] `deleteBot` 清理 `bot_mastra_config:` key
- [ ] 创建路由支持 `runMode='local'` + `mastraConfig`
- [ ] 新增 `GET /:id/config` 返回完整解密配置
- [ ] `PUT /:id/config` 扩展支持 mastraConfig
- [ ] Socket handler：`localbot:stream` 中继、`localbot:stream:end` 保存、`localbot:error` 错误消息
- [ ] ChatModule 消息路由：local bot 通过 Socket.IO 通知 Electron 而非 Redis enqueue

#### Electron 端
- [ ] **新建** `LocalBotManager` — Mastra Agent 生命周期管理
- [ ] **新建** `MastraToolBridge` — 现有 Skill handlers → Mastra createTool() 桥接
- [ ] main.ts 新增 IPC handlers（init, handle-message, remove, list-tools）
- [ ] preload.ts 暴露 localbot API
- [ ] 新增依赖：@mastra/core, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, zod

#### 前端
- [ ] BotManager 创建表单增加"本地运行"选项（非 Electron 禁用）
- [ ] **新建** `LocalBotConfigForm` — Mastra Provider/Model/Key/Prompt/Tools 配置表单
- [ ] **新建** `StreamingMessage` 组件 — 流式消息打字机气泡
- [ ] useChatStore 新增 streamingMessages 状态 + handleStreamChunk
- [ ] useSocketStore 监听 message:stream 事件
- [ ] ChatWindow 渲染 StreamingMessage
- [ ] initLocalBotBridge — Socket.IO ↔ Electron IPC 桥接

### 测试
- [ ] pnpm build 全部编译成功
- [ ] pnpm test 全部通过

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/shared/src/types/bot.ts` | 增加 local 模式、MastraProvider、MastraLLMConfig |
| `packages/shared/src/types/socket.ts` | 增加 localbot/streaming Socket 事件 |
| `packages/shared/src/constants/index.ts` | 增加 MASTRA_PROVIDERS |
| `packages/server/src/modules/bot/BotService.ts` | Mastra 配置 CRUD、deleteBot 清理 |
| `packages/server/src/modules/bot/index.ts` | local 模式路由、流式中继 Socket |
| `packages/server/src/modules/chat/index.ts` | local bot 消息通知 |
| `packages/electron/src/localbot/LocalBotManager.ts` | **新建** Mastra Agent 管理 |
| `packages/electron/src/localbot/MastraToolBridge.ts` | **新建** Skill → Tool 桥接 |
| `packages/electron/src/main.ts` | LocalBotManager 初始化、IPC |
| `packages/electron/src/preload.ts` | 暴露 localbot API |
| `packages/electron/package.json` | 新增 @mastra/core, @ai-sdk/* |
| `packages/client/.../BotManager/index.tsx` | 增加 local 模式 UI |
| `packages/client/.../BotManager/LocalBotConfigForm.tsx` | **新建** Mastra 配置表单 |
| `packages/client/.../StreamingMessage/index.tsx` | **新建** 打字机组件 |
| `packages/client/.../StreamingMessage/index.module.less` | **新建** 样式 |
| `packages/client/.../services/botService.ts` | 新增 local bot API |
| `packages/client/.../stores/useChatStore.ts` | streaming 状态 |
| `packages/client/.../stores/useSocketStore.ts` | message:stream 监听 |
| `packages/client/.../ChatWindow/index.tsx` | 渲染 StreamingMessage |
| `packages/client/.../services/skillBridge.ts` | initLocalBotBridge |

---

## v1.16.0 - Skill 系统标准化（Claude Plugins 兼容）

**目标**：将现有自定义 Skill 格式改造为兼容 Claude Plugins / Agent Skills Open Standard（SKILL.md 标准），实现与主流 AI Skill 生态互通。

### 背景

当前 Skill 系统使用自定义格式（manifest.json + handler.js），与业界标准不兼容，在线市场无可用 Skill。Claude Plugins 生态已有 75,000+ 插件，Anthropic 官方 Agent Skills 标准（SKILL.md）已成为行业通用格式。

### 标准格式对照

| 现有格式 | Claude Plugins 标准 |
|----------|-------------------|
| `manifest.json` — name/displayName/description/platform/permission/actions | `SKILL.md` — YAML frontmatter（name/description/version）+ Markdown 指令 |
| `handler.js` — CommonJS 导出 async 函数 | `scripts/` 目录 — Python/Bash/JS 脚本 |
| `.zip` 打包分发 | 目录结构分发，支持 Git 仓库引用 |
| 自定义 registry.json | 标准 Plugin Registry（plugin.json 清单） |

### 新的 Skill 包结构

```
skill-name/
├── SKILL.md              # 主指令文件（YAML frontmatter + Markdown）— 必需
├── scripts/              # 可执行脚本目录
│   ├── handler.js        # Node.js 处理器（兼容现有 handler）
│   └── *.sh / *.py       # 其他脚本
├── references/           # 参考文档
│   └── api-docs.md
├── assets/               # 模板和资源文件
└── examples/             # 使用示例
```

### SKILL.md 格式

```yaml
---
name: mac-notes
description: 读取、创建、更新、删除和搜索 macOS 备忘录
version: 1.0.0
license: Apache-2.0
compatibility:
  platforms: [mac]
  permissions: [read, write]
allowed-tools:
  - Bash
metadata:
  author: chat-app
  tags: [mac, notes, productivity]
  actions:
    - functionName: mac_notes_list
      description: 列出所有备忘录
      parameters: { type: object, properties: {...} }
    - functionName: mac_notes_read
      description: 读取指定备忘录
      parameters: { type: object, properties: {...} }
---

# Mac 备忘录 Skill

操作 macOS 备忘录应用...

## 使用指南
...
```

### 功能清单

#### 共享层
- [ ] `SkillDefinition` 改造为 SKILL.md frontmatter 格式（name/description/version/license/compatibility/metadata）
- [ ] 移除旧 `SkillPackageManifest` 类型，统一使用 SKILL.md 格式
- [ ] `SkillRegistryEntry` 扩展支持 SKILL.md 格式元数据

#### Electron 端
- [ ] `SkillPackageManager` 改造 — 从读取 manifest.json 改为读取/解析 SKILL.md
- [ ] 新增 `SkillMdParser` — 解析 SKILL.md YAML frontmatter + Markdown 内容
- [ ] `SkillMarketplace` 改造 — 支持从 Git 仓库 URL 安装 Skill
- [ ] `SkillMarketplace` 改造 — 默认注册表改为兼容 Claude Plugins Registry 格式
- [ ] 内置 Skill 全部改写为 SKILL.md 格式（替换原 definitions/*.ts 为 SKILL.md 文件）
- [ ] 新增 `skill:install-from-git` IPC — 从 Git 仓库克隆安装

#### 服务端
- [ ] `SkillRegistry` 适配 — 从 SKILL.md 格式的 actions 注册 tools
- [ ] 内置 Skill 定义改为 SKILL.md 文件，启动时解析加载
- [ ] `SkillModule` 新增 `GET /api/skill/registry` — 返回标准格式的 Skill 注册表

#### 前端
- [ ] `SkillMarketplace` UI 改造 — 显示 SKILL.md 格式信息（version/author/tags/license）
- [ ] 新增 "从 Git 安装" 输入框（支持 GitHub/GitLab URL）
- [ ] Skill 详情弹窗 — 渲染 SKILL.md 的 Markdown 内容

### 测试
- [ ] SkillMdParser 解析测试
- [ ] 新旧格式兼容测试
- [ ] Git 安装流程测试
- [ ] 内置 Skill 迁移后功能测试
- [ ] pnpm build + pnpm test 全量通过

---

## v1.17.0 - Skill 安装同步修复 + 文件上传增强

**目标**：修复 Skill 市场安装后 Bot 配置页无法立即看到新 Skill 的问题，同时提升文件上传大小限制。

### 修复内容
- [x] **Skill 安装同步** — Skill 市场安装/卸载 Skill 后，通过 `onSkillChanged` 回调触发 `syncSkillsToServer` 同步到服务端，Bot 配置页立即可见
- [x] **文件上传大小限制** — `MAX_FILE_SIZE` 从 10MB 提升至 1GB，解决大文件上传 413 错误
- [x] **Skill 注册表 URL** — 修正默认注册表 URL 为正确的 GitHub 仓库地址

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/client/src/modules/chat/services/skillBridge.ts` | 抽取 `syncSkillsToServer()` 为独立导出函数 |
| `packages/client/src/modules/chat/components/BotManager/index.tsx` | 传递 `onSkillChanged` 给 SkillMarketplace |
| `packages/shared/src/constants/index.ts` | MAX_FILE_SIZE 10MB → 1GB |
| `packages/electron/src/skills/SkillMarketplace.ts` | 修正注册表 URL |
| 6 个 `package.json` | 版本号 → 1.17.0 |

### 测试
- [x] pnpm build 全部编译成功
- [x] pnpm test 全部通过（82 suites, 561 tests）

---

## v1.18.0 - 本地 Bot 支持市场自定义 Skill

**目标**：让本地运行的 Bot（Mastra 模式）能够调用从 Skill 市场安装的自定义 Skill，打通 SkillPackageManager → MastraToolBridge → LocalBotManager 链路。

### 背景

当前 `MastraToolBridge.getAvailableMastraTools()` 只包装了内置 Skill handler（硬编码的 `handlers` 对象），完全未接入 `SkillPackageManager` 的自定义 Skill。导致本地 Bot 无法使用市场安装的 Skill。

### 功能清单

#### Electron 端
- [ ] `MastraToolBridge` 新增 `setPackageManager(pm)` 注入函数
- [ ] `getAvailableMastraTools()` 合并自定义 Skill（从 SkillPackageManager 获取 handler 并包装为 Mastra Tool）
- [ ] `listMastraToolInfo()` 合并自定义 Skill 信息
- [ ] `LocalBotManager` 新增 `getConfig(botId)` 方法，支持重建 Agent
- [ ] `main.ts` 注入 SkillPackageManager + Skill 安装/卸载后重建活跃 Bot 的 Tool 列表

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/electron/src/localbot/MastraToolBridge.ts` | 接入 SkillPackageManager，合并自定义 Skill tools |
| `packages/electron/src/localbot/LocalBotManager.ts` | 新增 `getConfig(botId)` 方法 |
| `packages/electron/src/main.ts` | 注入 SkillPackageManager + 安装后重建 Bot tools |
| 6 个 `package.json` | 版本号 → 1.18.0 |

### 测试
- [ ] pnpm build 全部编译成功
- [ ] pnpm test 全部通过

---

## v1.19.0 - Skill 系统重构：Claude Agent Skills 标准

**目标**：移除所有内置 Skill 和全局 Skill 市场，重构为 Claude Agent Skills 标准。每个 Bot（本地 + 服务端）拥有独立的 Skill 列表，Skill 通过 AI 读取指令 + 通用工具（bash/read/write）执行，替代原有的 handler 函数 → function calling 模式。

### 背景

当前 Skill 系统使用 26 个硬编码的 macOS handler（AppleScript/Shell），以 handler 函数 → function calling 的方式工作。需要重构为：
- **范式变化**：Skill = handler 函数 → Skill = AI 指令（SKILL.md）+ 通用工具
- **Skill 来源**：本地目录安装 + claude-plugins.dev 在线搜索安装
- **存储模型**：每个 Bot 独立副本，互不影响

### 功能清单

#### 共享层
- [ ] 新建 `claude-skill.ts` — ClaudeSkillMeta、ClaudeSkill、PluginEntry、PluginSearchResult、GenericToolExecRequest/Result 类型
- [ ] `socket.ts` — `skill:exec` → `tool:exec`，`skill:result` → `tool:result`，移除 `skill:sync`，新增 `bot:request-skills` / `bot:skill-instructions`
- [ ] `bot.ts` — 移除 `Bot.allowedSkills`、`MastraLLMConfig.enabledTools`
- [ ] `skill.ts` — 清理旧类型，仅保留 LLMTool / LLMToolCall

#### Electron 端
- [ ] 新建 `claudeskill/ClaudeSkillParser.ts` — 解析 SKILL.md YAML frontmatter，返回 ClaudeSkill
- [ ] 新建 `claudeskill/BotSkillManager.ts` — Per-bot Skill 存储管理（安装/卸载/列表/读取/系统提示词拼接）
- [ ] 新建 `claudeskill/PluginSearchClient.ts` — 封装 claude-plugins.dev API 搜索
- [ ] 新建 `claudeskill/GenericToolExecutor.ts` — 沙箱化通用工具执行（bash_exec/read_file/write_file/list_files）
- [ ] `MastraToolBridge.ts` — 完全重写，26 个 handler 包装 → 4 个通用 Mastra Tool
- [ ] `LocalBotManager.ts` — initBot() 改为注入 Skill 指令到系统提示词 + 通用工具
- [ ] `main.ts` — IPC 重写：移除 18 个 skill/trust handler，新增 bot-skill / plugin / tool IPC
- [ ] `preload.ts` — API 更新：移除旧 skill/trust API，新增 botSkill / plugin / tool API
- [ ] 删除 `skills/` 整个目录（handlers/、SkillRuntime、SkillPackageManager、SkillMarketplace、BotTrustStore、PermissionManager、AuditLogger、SkillMdParser）

#### 服务端
- [ ] 删除 `modules/skill/` 整个目录
- [ ] 新建 `bot/ToolDispatcher.ts` — 替代 SkillDispatcher，事件改为 tool:exec / tool:result
- [ ] `ServerBotRunner.ts` — 移除 SkillRegistry 依赖，工具列表改为固定 4 个通用工具定义，Skill 指令注入系统提示词
- [ ] `ServerBotManager.ts` — 移除 setSkillDependencies()，新增 skillInstructionsCache
- [ ] `BotService.ts` — 移除 getBotAllowedSkills() / setBotAllowedSkills()
- [ ] `bot/index.ts` — 移除 SkillDispatcher / skill 路由，新增 ToolDispatcher / tool:result / bot:skill-instructions handler
- [ ] `app.ts` — 移除 SkillModule 注册

#### 前端
- [ ] 新建 `BotSkillManager.tsx` — Bot 私有 Skill 管理弹窗（已安装列表 + 在线搜索 + 安装/卸载）
- [ ] `LocalBotConfigForm.tsx` — 移除 tool checkbox / enabledTools，新增「管理 Skill」按钮
- [ ] `BotManager/index.tsx` — 移除全局 SkillSelector / SkillMarketplace，服务端 Bot 也增加 Skill 管理入口
- [ ] 新建 `toolBridge.ts` — 替代 skillBridge，监听 tool:exec / bot:request-skills
- [ ] `botService.ts` — 移除 getAvailableSkills() / setBotSkills()
- [ ] 删除 `SkillMarketplace.tsx` + `SkillMarketplace.module.less` + 旧 `skillBridge.ts`

### 测试
- [ ] `electron/__tests__/claude-skill-parser.test.ts` — SKILL.md frontmatter 解析
- [ ] `electron/__tests__/bot-skill-manager.test.ts` — Per-bot 安装/卸载/列表/读取
- [ ] `electron/__tests__/generic-tool-executor.test.ts` — 通用工具执行 + 路径沙箱校验
- [ ] `electron/__tests__/plugin-search-client.test.ts` — claude-plugins.dev API mock
- [ ] `server/__tests__/tool-dispatcher.test.ts` — 通用工具 Socket.IO 分发
- [ ] `server/__tests__/server-bot-generic-tools.test.ts` — ServerBotRunner 通用工具流程
- [ ] 删除旧测试（10 个文件）
- [x] pnpm build 全部编译成功
- [x] pnpm test 全部通过

---

## v1.20.0 - Skill 工作区上下文 + 交互式选项 UI

**目标**：修复 Skill 执行时缺少工作区上下文的问题；为 AI 提供的选项添加交互式 UI（可点击按钮、输入框）。

### 背景

v1.19.0 完成 Skill 系统重构后，实际使用中发现两个问题：
1. AI 不知道自己的工作目录，导致 `bash_exec`/`read_file` 等工具无法正确执行
2. AI 提供选项时显示为纯文本，用户期望可交互的按钮 UI

### 功能清单

**Skill 工作区上下文**
- [ ] BotSkillManager.buildSystemPromptWithSkills() 注入工作区路径和工具使用说明
- [ ] GENERIC_TOOL_DEFINITIONS 工具描述改善（工作区语义）

**交互式选项 UI（JSON metadata 方案）**
- [ ] Message 类型新增 metadata 字段（MessageMetadata 接口）
- [ ] 新增 present_choices 工具定义（GENERIC_TOOL_DEFINITIONS 第 5 个）
- [ ] ServerBotRunner 拦截 present_choices，暂存 metadata
- [ ] BotService.sendMessageByBotId 支持 metadata 参数
- [ ] bot/index.ts localbot:stream:end 传递 metadata
- [ ] MastraToolBridge 新增 present_choices + 回调
- [ ] LocalBotManager metadata 传递到 onEnd
- [ ] InteractiveOptions 组件（选项按钮）
- [ ] InteractiveInput 组件（输入框）
- [ ] MessageBubble 渲染 metadata 交互组件
- [ ] ChatWindow 计算 lastBotMessageId

**版本收尾**
- [ ] 版本号 → 1.20.0
- [ ] pnpm build 全部编译成功
- [ ] pnpm test 全部通过

---

## v1.21.0 - Mastra 统一运行时 + AI SDK 流式界面

**目标**：统一服务端和本地 Bot 的运行时为 AI SDK；客户端流式显示改用 `useChat` hook（HTTP SSE）；本地 Bot 编辑页面显示工作目录路径和打开按钮。

### 背景

当前服务端 Bot 使用手写 `LLMClient.ts`（原始 HTTP 请求），本地 Bot 使用 Mastra Agent（基于 AI SDK），两者不统一。客户端通过 Socket.IO 自定义流式协议显示 Bot 回复，存在延迟和复杂度问题。

### 架构变更

```
Before:
  Server Bot:  Redis BLPOP → LLMClient (raw HTTP) → manual tool loop → sendMessage
  Local Bot:   Electron Mastra Agent → IPC → Socket.IO relay → Server save
  Client:      Socket.IO streaming → StreamingMessage component

After:
  Server Bot:  Redis BLPOP → AI SDK generateText (maxSteps) → sendMessage  (非流式触发)
  Both Bots:   HTTP POST /api/bot/chat → streamText → SSE response          (流式触发)
  Local Bot:   Agent 移至 Server，Electron 仅保留工具执行
  Client:      useChat hook → HTTP SSE → 自动流式显示
  Tools:       Server → ToolDispatcher → Socket.IO → Electron (不变)
```

### 功能清单

**依赖安装**
- [ ] server: ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, zod
- [ ] client: ai, @ai-sdk/react

**Server — ModelFactory + ServerToolBridge**
- [ ] 新建 ModelFactory.ts — 统一创建 AI SDK LanguageModel（支持所有 LLMConfig + MastraLLMConfig providers）
- [ ] 新建 ServerToolBridge.ts — 将 GENERIC_TOOL_DEFINITIONS 转换为 AI SDK tool() 格式，execute 调用 ToolDispatcher

**Server — 重构 ServerBotRunner**
- [ ] 替换 LLMClient 为 AI SDK generateText + maxSteps 自动 tool 循环
- [ ] 移除手动 tool calling loop
- [ ] 保留 Redis BLPOP 轮询（群聊 @Bot 触发路径）

**Server — HTTP 流式端点**
- [ ] 新增 POST /api/bot/chat — streamText + toDataStreamResponse (SSE)
- [ ] 支持 server 和 local 两种 bot 模式
- [ ] onFinish 保存消息到 DB + Socket.IO 广播
- [ ] ServerBotManager 新增 getSkillInstructions 公开方法

**Client — useChat 集成**
- [ ] 新建 useBotChat hook（封装 @ai-sdk/react useChat）
- [ ] ChatWindow 检测 Bot 对话，使用 useBotChat 替代 Socket.IO streaming
- [ ] Bot 对话消息发送改用 useChat.handleSubmit
- [ ] 非 Bot 对话保留现有逻辑

**Local Bot 服务端迁移**
- [ ] Local Bot Agent 从 Electron 移到 Server（HTTP 端点已支持）
- [ ] 简化 Electron LocalBotManager（移除 Agent 创建，保留工具执行）
- [ ] BotManager 移除 electronAPI.initLocalBot 调用
- [ ] 移除 localbot:stream / localbot:stream:end / localbot:error Socket 事件

**工作目录显示**
- [ ] Electron IPC: localbot:get-workspace-path + localbot:open-workspace
- [ ] preload.ts 暴露新 API
- [ ] BotManager 编辑 Modal 显示工作目录路径 + "打开" 按钮

**版本收尾**
- [ ] 版本号 → 1.21.0
- [ ] pnpm build 全部编译成功
- [ ] pnpm test 全部通过

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/server/package.json` | 新增 ai + @ai-sdk/* + zod |
| `packages/client/package.json` | 新增 ai + @ai-sdk/react |
| `packages/server/src/modules/bot/ModelFactory.ts` | **新建** AI SDK 模型工厂 |
| `packages/server/src/modules/bot/ServerToolBridge.ts` | **新建** AI SDK 工具桥接 |
| `packages/server/src/modules/bot/ServerBotRunner.ts` | 替换 LLMClient → AI SDK |
| `packages/server/src/modules/bot/ServerBotManager.ts` | 新增 getSkillInstructions |
| `packages/server/src/modules/bot/index.ts` | 新增 POST /api/bot/chat，移除 localbot socket handlers |
| `packages/client/src/modules/chat/hooks/useBotChat.ts` | **新建** useChat 封装 |
| `packages/client/.../ChatWindow/index.tsx` | Bot 对话使用 useBotChat |
| `packages/client/.../BotManager/index.tsx` | 移除 Electron Agent 初始化 + 工作目录 UI |
| `packages/electron/src/localbot/LocalBotManager.ts` | 简化：移除 Agent 创建 |
| `packages/electron/src/main.ts` | 移除 localbot Agent IPC + 新增 workspace IPC |
| `packages/electron/src/preload.ts` | 暴露 workspace IPC |
| `packages/shared/src/types/socket.ts` | 移除 localbot:stream 相关事件 |

---

## v1.22.0 - Mastra 统一运行时迁移 ✅

**目标**：将所有 AI Agent 运行逻辑统一迁移到 Mastra (`@mastra/core`) 运行时，替代直接 AI SDK 调用和手写 HTTP 请求。

### 背景

v1.21.0 完成了 AI SDK 统一和流式界面，但 LLM 调用仍分散在三处：
1. **Server**: 直接用 AI SDK `generateText`/`streamText`
2. **Agent-app**: 用原始 HTTP 请求 (`llmClient.ts`)
3. **Electron**: 残留 `@mastra/core@^0.10.0` 死代码

### 架构变更

```
Before (v1.21.0):
  Server Runner:   generateText() from 'ai'  →  直接 AI SDK
  Server /chat:    streamText() from 'ai'    →  直接 AI SDK
  Agent-app:       callLLM() raw HTTP         →  手写 HTTP 请求
  Electron:        @mastra/core@^0.10.0       →  死代码
  Tools:           AI SDK tool() format

After (v1.22.0):
  Server Runner:   Agent.generate()           →  Mastra Agent
  Server /chat:    Agent.stream()             →  Mastra Agent + pipeDataStreamToResponse
  Agent-app:       Agent.generate()           →  Mastra Agent
  Electron:        死代码已删除
  Tools:           Mastra createTool() format
  ModelFactory:    不变（创建 AI SDK LanguageModel 传给 Mastra Agent）
```

### 功能清单

**依赖安装**
- [ ] server: 新增 @mastra/core，zod 从 devDeps 移到 deps
- [ ] agent-app: 新增 @mastra/core, ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, zod
- [ ] electron: 移除 @mastra/core@^0.10.0 和 @ai-sdk/* 死代码依赖

**Server — 工具迁移 (ServerToolBridge)**
- [ ] AI SDK `tool()` → Mastra `createTool()` (5 个工具)
- [ ] `parameters` → `inputSchema`, 新增 `id` 字段

**Server — Background Runner 迁移 (ServerBotRunner)**
- [ ] `generateText()` → Mastra `Agent.generate()` + `maxSteps`
- [ ] 保留 Redis BLPOP 轮询、Slash 命令、对话历史、LLM 日志

**Server — 流式端点迁移 (POST /api/bot/chat)**
- [ ] `streamText()` → Mastra `Agent.stream()` + `pipeDataStreamToResponse`
- [ ] 保持 useChat SSE 格式兼容，客户端无需变更

**Agent-App 迁移**
- [ ] 新建 modelFactory.ts（AI SDK LanguageModel 工厂，适配 AgentConfig）
- [ ] agentManager.ts: `callLLM()` → Mastra `Agent.generate()`
- [ ] 删除 llmClient.ts（完全由 Mastra Agent 替代）

**清理**
- [ ] 删除 Electron 死代码：LocalBotManager.ts, MastraToolBridge.ts
- [ ] 删除 Server 旧 LLMClient.ts
- [ ] 删除 server 相关 LLM 测试 (llm-client*.test.ts × 3)
- [ ] 更新剩余测试 mock (server-bot*.test.ts, agentManager.test.ts, llmClient.test.ts)

**版本收尾**
- [ ] 版本号 → 1.22.0
- [ ] pnpm build 全部编译成功
- [ ] pnpm test 全部通过

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/server/package.json` | 新增 @mastra/core, zod 移到 deps |
| `packages/agent-app/package.json` | 新增 @mastra/core, ai, @ai-sdk/*, zod |
| `packages/electron/package.json` | 移除 @mastra/core, @ai-sdk/* |
| `packages/server/src/modules/bot/ServerToolBridge.ts` | tool() → createTool() |
| `packages/server/src/modules/bot/ServerBotRunner.ts` | generateText → Agent.generate |
| `packages/server/src/modules/bot/index.ts` | streamText → Agent.stream |
| `packages/agent-app/src/main/modelFactory.ts` | **新建** |
| `packages/agent-app/src/main/agentManager.ts` | callLLM → Agent.generate |
| `packages/electron/src/localbot/LocalBotManager.ts` | **删除** |
| `packages/electron/src/localbot/MastraToolBridge.ts` | **删除** |
| `packages/server/src/modules/bot/LLMClient.ts` | **删除** |
| `packages/agent-app/src/main/llmClient.ts` | **删除** |
| `server/__tests__/llm-client*.test.ts` (3 个) | **删除** |
| 其余测试文件 (4 个) | 更新 mock |

---

## v1.23.0 — Bot 聊天修复 + Agent 文件产物发送 + 交互式 UI 重设计

### 概述

修复 v1.22.0 遗留的 Bot 聊天 500 错误，新增 Agent 文件产物发送功能和交互式 UI 重设计，补充 v1.20.0-v1.22.0 缺失的测试文档。

### 问题与需求

1. **Bug**: `POST /api/bot/chat` 返回 500 — `agent.stream()` 的 `textStream`（`ReadableStream`）消费方式不兼容
2. **Feature**: Agent 生成的文件产物（图片、文件、目录）需发送到聊天中展示
3. **Feature**: `present_choices` 交互 UI 需重设计为内联决策卡片（类 Claude Code VSCode 风格）
4. **补漏**: v1.20.0 ~ v1.22.0 缺少测试文档

### 功能清单

**阶段 0：Bug Fix — Bot 聊天 500 错误**
- [ ] `server/modules/bot/index.ts`: `for await...of` → `getReader()` + `read()` 安全消费 ReadableStream
- [ ] 添加 `isReasoner` 检查（推理模型不传 tools）
- [ ] 增强错误日志

**阶段 1：Shared 类型扩展**
- [ ] `shared/types/claude-skill.ts`: GenericToolName 新增 `read_file_binary`，GENERIC_TOOL_DEFINITIONS 新增 `send_file_to_chat`，`present_choices` 支持富选项
- [ ] `shared/types/message.ts`: MessageMetadata 新增 `richItems`/`selectedIndex`/`submitted`，新增 `RichChoiceItem` 接口
- [ ] `shared/types/socket.ts`: ClientToServerEvents 新增 `message:update-metadata`

**阶段 2：Agent 文件产物发送**
- [ ] `electron/GenericToolExecutor.ts`: 新增 `read_file_binary`（base64 + zip 目录打包，50MB 限制）
- [ ] `electron/package.json`: 新增 archiver 依赖
- [ ] `server/modules/chat/upload.ts`: 新增 `saveBase64File()` 函数
- [ ] `server/modules/bot/ServerToolBridge.ts`: 新增 `send_file_to_chat` 工具 + `FileArtifact` 接口
- [ ] `server/modules/bot/ServerBotRunner.ts`: 文件产物收集 + 发送文件消息
- [ ] `server/modules/bot/BotService.ts`: 新增 `sendFileMessageByBotId()` 方法

**阶段 3：交互式 UI 重设计**
- [ ] `client/InteractiveOptions/`: 重写为内联决策卡片（圆角边框、hover 高亮、已选勾选）
- [ ] `client/InteractiveInput/`: 决策卡片风格 + 已提交状态
- [ ] `client/MessageBubble/`: 传递新 props（richItems、selectedIndex、submitted 等）
- [ ] `server/RedisMessageRepository.ts`: updateMessage 新增 metadata 字段
- [ ] `server/modules/chat/index.ts`: socket handler 新增 `message:update-metadata`

**阶段 4：测试**
- [ ] `electron/__tests__/generic-tool-executor.test.ts`: read_file_binary 用例
- [ ] `server/__tests__/server-bot-generic-tools.test.ts`: 工具数量 5→6
- [ ] `client/__tests__/InteractiveOptions.test.tsx`: **新建** 决策卡片测试
- [ ] `client/__tests__/MessageBubble.test.tsx`: metadata 扩展字段测试

**阶段 5：补充测试文档**
- [ ] `doc/test/v1.20.0-test.md` — Skill 工作区上下文 + 交互式选项 UI
- [ ] `doc/test/v1.21.0-test.md` — Mastra 统一运行时 + AI SDK 流式界面
- [ ] `doc/test/v1.22.0-test.md` — Mastra Agent 统一运行时迁移
- [ ] `doc/test/v1.23.0-test.md` — 本版本测试文档

**阶段 6：版本收尾**
- [ ] 6 个 package.json → 1.23.0
- [ ] 客户端首页版本号
- [ ] CLAUDE.md 版本列表 + Bot 测试规范 + 测试文档规范
- [ ] pnpm build + pnpm test
- [ ] 真实 DeepSeek Bot 聊天验证

### 文件清单

| 文件 | 变更 |
|------|------|
| `packages/server/src/modules/bot/index.ts` | **修复** 流式聊天 500 |
| `packages/shared/src/types/claude-skill.ts` | GenericToolName + GENERIC_TOOL_DEFINITIONS |
| `packages/shared/src/types/message.ts` | MessageMetadata 扩展 |
| `packages/shared/src/types/socket.ts` | 新增 message:update-metadata |
| `packages/electron/package.json` | 新增 archiver |
| `packages/electron/src/claudeskill/GenericToolExecutor.ts` | read_file_binary + zip |
| `packages/server/src/modules/chat/upload.ts` | saveBase64File |
| `packages/server/src/modules/bot/ServerToolBridge.ts` | send_file_to_chat + richItems |
| `packages/server/src/modules/bot/ServerBotRunner.ts` | 文件产物收集与发送 |
| `packages/server/src/modules/bot/BotService.ts` | sendFileMessageByBotId |
| `packages/server/src/repositories/redis/RedisMessageRepository.ts` | metadata 字段 |
| `packages/server/src/modules/chat/index.ts` | metadata 更新 handler |
| `packages/client/.../InteractiveOptions/` | **重写** |
| `packages/client/.../InteractiveInput/` | 样式重做 |
| `packages/client/.../MessageBubble/index.tsx` | 新 props |
| 测试文件 (4 个) | 新建/修改 |
| 测试文档 (4 个) | **新建** |
| `CLAUDE.md` | 版本列表 + Bot 测试规范 + 测试文档规范 |
| 版本相关文件 (8+ 个) | 版本号 → 1.23.0 |
