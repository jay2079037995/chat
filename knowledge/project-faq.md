---
name: project-faq
description: 开发过程中遇到的疑难杂症和解决方案知识库。当遇到报错、环境问题、工具冲突时自动参考此 skill。遇到新问题并解决后，自动将问题和方案追加到此文件中。
user-invocable: false
---

# 项目开发 FAQ —— 疑难杂症与解决方案

> **自动更新规则**：当开发过程中遇到新的疑难问题并成功解决后，必须将问题描述和解决方案追加到本文件对应分类下。保持知识持续积累和传承。

---

## 1. 环境与工具链

### 1.1 pnpm 命令找不到

**问题**：在 shell 中执行 `pnpm` 命令时报 `command not found`。

**原因**：pnpm 通过 corepack 安装，其 shim 路径不在默认 PATH 中。

**解决方案**：
```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:/usr/local/bin:/usr/bin:/bin:$PATH"
```

**排查技巧**：
```bash
which pnpm                    # 检查 pnpm 路径
ls /usr/local/lib/node_modules/corepack/shims/  # 确认 shim 存在
```

### 1.2 tail / head 等基础命令找不到

**问题**：在 Bash 工具中使用管道命令（如 `| tail -5`）时报 `tail: command not found`。

**原因**：Claude Code 的 shell 环境 PATH 可能不包含 `/usr/bin`。

**解决方案**：确保 PATH 包含 `/usr/bin:/bin`：
```bash
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
```

或使用完整路径：`/usr/bin/tail -5`。

---

## 2. Claude Code 工具使用

### 2.1 Edit 工具报 "File has not been read yet"

**问题**：明明已经用 Read 工具读取过文件，但 Edit 工具仍报错 `File has not been read yet`。

**原因**：文件在 Read 之后被 linter/formatter（如 ESLint、Prettier）自动修改，Claude Code 检测到文件内容已变化，要求重新读取。

**解决方案**：在 Edit 之前再次 Read 文件，获取最新内容后再编辑。

**预防措施**：
- 批量编辑时，可以先读取所有文件，然后立即编辑
- 如果项目有 save-on-edit 的 linter 配置，预期每次 Edit 后文件都会被自动格式化

### 2.2 上下文窗口溢出后恢复

**问题**：长对话导致上下文窗口压缩，之前读取的文件内容丢失。

**解决方案**：
- 利用会话摘要中的关键信息继续工作
- 重新 Read 必要的文件
- 使用 TodoWrite 工具追踪进度，避免遗漏未完成的任务

### 2.3 git commit 消息格式

**问题**：commit 消息中包含特殊字符导致命令失败。

**解决方案**：使用 HEREDOC 格式传递 commit 消息：
```bash
git commit -m "$(cat <<'EOF'
Commit message here.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 3. TypeScript 与编译

### 3.1 Monorepo 包引用报类型错误

**问题**：前端 import `@{project}/shared` 的类型时报 `Cannot find module` 或类型不匹配。

**解决方案**：共享包的 `package.json` 中必须正确设置入口：
```json
{
  "name": "@{project}/shared",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

并确保前端的 `tsconfig.json` 中有对应的 `references` 或 `paths` 配置。

### 3.2 ESM vs CJS 模块冲突

**问题**：`import` 和 `require` 混用导致运行时报错。

**解决方案**：
- 后端使用 `ts-node` 或 `tsx` 运行，在 `tsconfig.json` 中设置 `"module": "commonjs"`
- 前端由 Webpack/Vite 处理模块转换
- 共享包不做编译，直接暴露 `.ts` 源码（开发阶段）

---

## 4. 测试相关

### 4.1 Jest mock 路径必须与 import 路径完全一致

**问题**：`jest.mock('...')` 的路径与组件中的 import 路径不一致，导致 mock 不生效。

**解决方案**：mock 路径必须是被测组件的 **import 路径**，不是测试文件相对路径：
```typescript
// 组件中: import { useAuthStore } from '../../stores/useAuthStore';
// 测试中:
jest.mock('../src/modules/auth/stores/useAuthStore');  // 从测试文件到被 mock 模块的相对路径
```

**文件迁移时注意**：移动文件后，所有引用该文件的 import 和 jest.mock 路径都需要同步更新。

### 4.2 前端测试需要 MemoryRouter 包裹

**问题**：使用了 React Router 的组件在测试中报 `useNavigate() may be used only in the context of a <Router>` 错误。

**解决方案**：测试 render 时用 `MemoryRouter` 包裹：
```tsx
render(
  <MemoryRouter>
    <Login />
  </MemoryRouter>
);
```

### 4.3 后端测试使用 ioredis-mock

**问题**：测试环境没有 Redis 服务。

**解决方案**：使用 `ioredis-mock` 替代真实 Redis：
```typescript
jest.mock('ioredis', () => require('ioredis-mock'));
```

确保在测试的 setup 文件或每个测试文件顶部做 mock。

---

## 5. 架构与设计

### 5.1 避免过度工程化

**问题**：为简单场景引入不必要的复杂度（如 React.lazy、过度抽象）。

**教训**：
- 不要过早引入代码分割（React.lazy），除非有明确的性能需求
- 不要为单一用途创建 helper/utility 抽象
- 三行类似代码比一个过早的抽象更好
- DI 容器用轻量工厂模式即可，无需 reflect-metadata 等重型方案

### 5.2 模块间跨引用的处理

**问题**：模块 A 需要使用模块 B 的 store/service，如何组织导入？

**解决方案**：
- 允许跨模块直接 import，使用相对路径：`../../../auth/stores/useAuthStore`
- 共享的基础设施（Guard、API 实例）放在 `components/` 或 `services/` 共享目录
- 如果跨引用过多，考虑将共享逻辑提取到 `shared` 包或公共 `core/` 目录

### 5.3 渐进式迁移策略

**问题**：大规模重构（如从扁平目录到模块化架构）容易出错。

**最佳实践**：
1. **纯新增阶段** — 只创建新文件，不修改旧代码
2. **并行运行阶段** — 新旧代码共存，验证新代码正确
3. **切换阶段** — 修改入口文件指向新代码
4. **清理阶段** — 确认全部测试通过后删除旧代码
5. 每个阶段完成后运行全量测试

---

## 6. 前端特定问题

### 6.1 Ant Design 样式未生效

**问题**：引入 Ant Design 组件但样式缺失。

**解决方案**：
- Ant Design 5 使用 CSS-in-JS，无需额外导入样式文件
- 如果使用 Less 主题定制，确保 Webpack 配置了 `less-loader`

### 6.2 CSS Modules 类名冲突

**问题**：不同组件的 `.container` 等通用类名互相覆盖。

**解决方案**：使用 CSS Modules（`*.module.less`），类名自动加 hash 前缀：
```tsx
import styles from './index.module.less';
<div className={styles.container}>  // 编译后: container_abc123
```

### 6.3 Zustand store 在测试中的 mock

**问题**：需要 mock Zustand store 的特定状态和方法。

**解决方案**：
```typescript
jest.mock('../src/modules/auth/stores/useAuthStore');
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
  selector({
    user: null,
    loading: false,
    initialized: true,
    login: mockLogin,
    register: mockRegister,
  })
);
```

---

## 更新日志

| 日期 | 问题 | 分类 |
|------|------|------|
| 2026-03-01 | 初始版本，收录 chat 项目开发期间遇到的所有问题 | 全部 |
