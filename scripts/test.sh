#!/bin/bash
# Chat 项目 - 自动化测试脚本
#
# 用法:
#   ./scripts/test.sh              # 运行全部自动化测试（回归测试）
#   ./scripts/test.sh --version 0.1  # 只运行 v0.1.0 相关测试
#   ./scripts/test.sh --version 0.2  # 只运行 v0.2.0 相关测试
#   ./scripts/test.sh --env          # 只检查环境
#   ./scripts/test.sh --unit         # 只运行单元/集成测试（Jest）
#   ./scripts/test.sh --structure    # 只运行项目结构检查
#   ./scripts/test.sh --help         # 显示帮助

set -e

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

TOTAL_PASS=0
TOTAL_FAIL=0
SECTION_RESULTS=()

pass() { echo -e "  ${GREEN}✓${NC} $1"; TOTAL_PASS=$((TOTAL_PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; TOTAL_FAIL=$((TOTAL_FAIL + 1)); }
section() { echo -e "\n${BLUE}${BOLD}[$1]${NC}"; }

# ============================================
# 参数解析
# ============================================
RUN_ENV=false
RUN_UNIT=false
RUN_STRUCTURE=false
TARGET_VERSION=""
RUN_ALL=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --version|-v)
      TARGET_VERSION="$2"
      RUN_ALL=false
      RUN_ENV=true
      RUN_UNIT=true
      RUN_STRUCTURE=true
      shift 2
      ;;
    --env)
      RUN_ENV=true
      RUN_ALL=false
      shift
      ;;
    --unit)
      RUN_UNIT=true
      RUN_ALL=false
      shift
      ;;
    --structure)
      RUN_STRUCTURE=true
      RUN_ALL=false
      shift
      ;;
    --help|-h)
      echo "Chat 项目自动化测试脚本"
      echo ""
      echo "用法:"
      echo "  ./scripts/test.sh              全部测试（回归测试）"
      echo "  ./scripts/test.sh -v 0.2       指定版本测试"
      echo "  ./scripts/test.sh --env        环境检查"
      echo "  ./scripts/test.sh --unit       单元/集成测试"
      echo "  ./scripts/test.sh --structure  项目结构检查"
      echo ""
      echo "支持的版本: 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8"
      exit 0
      ;;
    *)
      echo "未知参数: $1 (使用 --help 查看帮助)"
      exit 1
      ;;
  esac
done

if $RUN_ALL; then
  RUN_ENV=true
  RUN_UNIT=true
  RUN_STRUCTURE=true
fi

echo ""
echo "============================================"
echo "  Chat 项目 - 自动化测试"
if [ -n "$TARGET_VERSION" ]; then
  echo "  范围: v${TARGET_VERSION}.0"
else
  echo "  范围: 全量回归测试"
fi
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ============================================
# 环境检查
# ============================================
if $RUN_ENV; then
  section "环境检查"
  bash scripts/check-env.sh 2>/dev/null || {
    echo -e "${RED}环境检查未通过，请先修复上述问题${NC}"
    exit 1
  }
fi

# ============================================
# 项目结构检查
# ============================================
run_structure_checks() {
  section "项目结构检查"

  # v0.1.0 结构
  if [ -z "$TARGET_VERSION" ] || [ "$TARGET_VERSION" = "0.1" ]; then
    echo -e "  ${BOLD}-- v0.1.0 基础结构 --${NC}"
    [ -f "pnpm-workspace.yaml" ] && pass "pnpm-workspace.yaml" || fail "pnpm-workspace.yaml 缺失"
    [ -f "tsconfig.json" ] && pass "tsconfig.json" || fail "tsconfig.json 缺失"
    [ -f "CLAUDE.md" ] && pass "CLAUDE.md" || fail "CLAUDE.md 缺失"
    [ -d "packages/client/src" ] && pass "packages/client/src/" || fail "packages/client/src/ 缺失"
    [ -d "packages/server/src" ] && pass "packages/server/src/" || fail "packages/server/src/ 缺失"
    [ -d "packages/shared/src" ] && pass "packages/shared/src/" || fail "packages/shared/src/ 缺失"
    [ -f "packages/client/webpack.config.js" ] && pass "webpack.config.js" || fail "webpack.config.js 缺失"
    [ -d "doc" ] && pass "doc/ 目录" || fail "doc/ 目录缺失"
  fi

  # v0.2.0 结构
  if [ -z "$TARGET_VERSION" ] || [ "$TARGET_VERSION" = "0.2" ]; then
    echo -e "  ${BOLD}-- v0.2.0 用户系统结构 --${NC}"
    [ -f "packages/server/src/routes/auth.ts" ] && pass "后端 auth 路由" || fail "后端 auth 路由缺失"
    [ -f "packages/server/src/routes/users.ts" ] && pass "后端 users 路由" || fail "后端 users 路由缺失"
    [ -f "packages/server/src/services/AuthService.ts" ] && pass "AuthService" || fail "AuthService 缺失"
    [ -f "packages/server/src/services/UserService.ts" ] && pass "UserService" || fail "UserService 缺失"
    [ -f "packages/server/src/middleware/auth.ts" ] && pass "auth 中间件" || fail "auth 中间件缺失"
    [ -f "packages/server/src/repositories/redis/RedisUserRepository.ts" ] && pass "RedisUserRepository" || fail "RedisUserRepository 缺失"
    [ -f "packages/server/src/repositories/redis/RedisSessionRepository.ts" ] && pass "RedisSessionRepository" || fail "RedisSessionRepository 缺失"
    [ -f "packages/client/src/pages/Login/index.tsx" ] && pass "登录页面" || fail "登录页面缺失"
    [ -f "packages/client/src/pages/Register/index.tsx" ] && pass "注册页面" || fail "注册页面缺失"
    [ -f "packages/client/src/stores/useAuthStore.ts" ] && pass "Auth Store" || fail "Auth Store 缺失"
    [ -f "packages/client/src/components/AuthGuard/index.tsx" ] && pass "AuthGuard" || fail "AuthGuard 缺失"
    [ -f "packages/client/src/components/UserSearch/index.tsx" ] && pass "UserSearch 组件" || fail "UserSearch 组件缺失"
  fi

  # v0.3.0 结构（预留）
  if [ -z "$TARGET_VERSION" ] || [ "$TARGET_VERSION" = "0.3" ]; then
    echo -e "  ${BOLD}-- v0.3.0 一对一聊天结构 --${NC}"
    # 下个版本实现时填充
    echo -e "  ${YELLOW}(待实现)${NC}"
  fi

  # v0.5.0 结构（预留）
  if [ -z "$TARGET_VERSION" ] || [ "$TARGET_VERSION" = "0.5" ]; then
    echo -e "  ${BOLD}-- v0.5.0 群组聊天结构 --${NC}"
    echo -e "  ${YELLOW}(待实现)${NC}"
  fi
}

if $RUN_STRUCTURE; then
  run_structure_checks
fi

# ============================================
# 单元 / 集成测试（Jest）
# ============================================
run_unit_tests() {
  section "自动化测试 (Jest)"

  # 根据版本过滤测试文件
  # 版本 -> 测试文件路径模式的映射
  SERVER_PATTERN=""
  CLIENT_PATTERN=""

  case "$TARGET_VERSION" in
    "0.1")
      SERVER_PATTERN="health"
      CLIENT_PATTERN="App"
      ;;
    "0.2")
      SERVER_PATTERN="(auth|users)"
      CLIENT_PATTERN="(Login|Register|App)"
      ;;
    "0.3")
      SERVER_PATTERN="(chat|message|conversation)"
      CLIENT_PATTERN="(Chat|Message|Conversation)"
      ;;
    "0.4")
      SERVER_PATTERN="(file|upload)"
      CLIENT_PATTERN="(File|Image|Audio|Code|Markdown)"
      ;;
    "0.5")
      SERVER_PATTERN="(group)"
      CLIENT_PATTERN="(Group)"
      ;;
    "0.6")
      SERVER_PATTERN="(history|search)"
      CLIENT_PATTERN="(History|Search)"
      ;;
    *)
      # 空 = 运行全部
      ;;
  esac

  JEST_EXIT=0

  # 使用 pnpm exec jest 直接调用，避免 pnpm test -- 导致的参数传递问题
  # Server 测试
  echo -e "  ${BOLD}-- 后端测试 --${NC}"
  SERVER_JEST_ARGS="--passWithNoTests --runInBand --verbose"
  if [ -n "$SERVER_PATTERN" ]; then
    SERVER_JEST_ARGS="$SERVER_JEST_ARGS --testPathPattern=$SERVER_PATTERN"
  fi
  if ! pnpm --filter @chat/server exec jest $SERVER_JEST_ARGS 2>&1 | sed 's/^/  /'; then
    JEST_EXIT=1
  fi

  # Client 测试
  echo -e "\n  ${BOLD}-- 前端测试 --${NC}"
  CLIENT_JEST_ARGS="--passWithNoTests --verbose"
  if [ -n "$CLIENT_PATTERN" ]; then
    CLIENT_JEST_ARGS="$CLIENT_JEST_ARGS --testPathPattern=$CLIENT_PATTERN"
  fi
  if ! pnpm --filter @chat/client exec jest $CLIENT_JEST_ARGS 2>&1 | sed 's/^/  /'; then
    JEST_EXIT=1
  fi

  # Shared 测试
  echo -e "\n  ${BOLD}-- 共享包测试 --${NC}"
  if ! pnpm --filter @chat/shared exec jest --passWithNoTests --verbose 2>&1 | sed 's/^/  /'; then
    JEST_EXIT=1
  fi

  return $JEST_EXIT
}

if $RUN_UNIT; then
  run_unit_tests
  UNIT_EXIT=$?
  if [ $UNIT_EXIT -eq 0 ]; then
    pass "Jest 全部测试通过"
  else
    fail "Jest 存在测试失败"
  fi
fi

# ============================================
# TypeScript 编译检查
# ============================================
if $RUN_UNIT || $RUN_ALL; then
  section "TypeScript 编译检查"
  echo -e "  ${BOLD}-- 共享包编译 --${NC}"
  if pnpm --filter @chat/shared build &>/dev/null; then
    pass "shared 编译通过"
  else
    fail "shared 编译失败"
  fi

  echo -e "  ${BOLD}-- 后端编译 --${NC}"
  if pnpm --filter @chat/server build &>/dev/null; then
    pass "server 编译通过"
  else
    fail "server 编译失败"
  fi
fi

# ============================================
# 最终结果
# ============================================
echo ""
echo "============================================"
if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}全部通过!${NC} (${TOTAL_PASS} 项检查通过)"
else
  echo -e "  ${RED}${BOLD}存在失败!${NC} ${GREEN}$TOTAL_PASS 通过${NC}, ${RED}$TOTAL_FAIL 失败${NC}"
fi
echo "============================================"
echo ""

# 生成手动测试提示
if [ -n "$TARGET_VERSION" ]; then
  TEST_DOC="doc/test/v${TARGET_VERSION}.0-test.md"
  if [ -f "$TEST_DOC" ]; then
    echo -e "${YELLOW}请按照以下测试文档完成手动测试:${NC}"
    echo "  $TEST_DOC"
    echo ""
    MANUAL_COUNT=$(grep -c '\[MANUAL\]' "$TEST_DOC" 2>/dev/null || echo "0")
    if [ "$MANUAL_COUNT" -gt 0 ]; then
      echo -e "  共 ${BOLD}${MANUAL_COUNT}${NC} 项需要手动验证"
    fi
  fi
fi

if [ "$TOTAL_FAIL" -gt 0 ]; then
  exit 1
fi
