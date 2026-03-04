import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Home from '../src/modules/home/pages/Home';

// Mock useIsMobile hook
let mockIsMobile = false;
jest.mock('../src/hooks/useIsMobile', () => ({
  useIsMobile: () => mockIsMobile,
}));

// Mock stores
const mockLoadConversations = jest.fn();
const mockLoadFromCache = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockStartPrivateChat = jest.fn();
let mockCurrentConversationId: string | null = null;

jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: 'user1', username: 'TestUser' },
      sessionId: 'session-1',
      logout: jest.fn(),
    }),
}));

jest.mock('../src/modules/chat/stores/useSocketStore', () => ({
  useSocketStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      connect: mockConnect,
      disconnect: mockDisconnect,
    }),
}));

jest.mock('../src/modules/chat/stores/useChatStore', () => {
  const fn = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      loadConversations: mockLoadConversations,
      loadFromCache: mockLoadFromCache,
      startPrivateChat: mockStartPrivateChat,
      currentConversationId: mockCurrentConversationId,
    });
  fn.setState = jest.fn();
  return { useChatStore: fn };
});

jest.mock('../src/modules/chat/stores/useThemeStore', () => ({
  useThemeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      isDark: false,
      setMode: jest.fn(),
    }),
}));

// Mock child components
jest.mock('../src/modules/home/components/UserSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="user-search">UserSearch</div>,
}));
jest.mock('../src/modules/chat/components/ConversationList', () => ({
  __esModule: true,
  default: () => <div data-testid="conversation-list">ConversationList</div>,
}));
jest.mock('../src/modules/chat/components/ChatWindow', () => ({
  __esModule: true,
  default: () => <div data-testid="chat-window">ChatWindow</div>,
}));
jest.mock('../src/modules/chat/components/CreateGroupDialog', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/modules/chat/components/MessageSearch', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/modules/chat/components/BotManager', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/modules/chat/components/ProfileDrawer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/modules/chat/utils/notification', () => ({
  requestNotificationPermission: jest.fn(),
}));

const renderHome = () => {
  return render(
    <ConfigProvider locale={zhCN}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </ConfigProvider>,
  );
};

describe('Home — 桌面端布局', () => {
  beforeEach(() => {
    mockIsMobile = false;
    mockCurrentConversationId = null;
    jest.clearAllMocks();
  });

  it('should render Sider with conversation list on desktop', async () => {
    await act(async () => {
      renderHome();
    });
    expect(screen.getByTestId('conversation-list')).toBeDefined();
    expect(screen.getByTestId('user-search')).toBeDefined();
  });

  it('should render header with text labels on desktop', async () => {
    await act(async () => {
      renderHome();
    });
    expect(screen.getByText('TestUser')).toBeDefined();
    expect(screen.getByText('资料')).toBeDefined();
    expect(screen.getByText('搜索')).toBeDefined();
    expect(screen.getByText('机器人')).toBeDefined();
    expect(screen.getByText('登出')).toBeDefined();
  });

  it('should show placeholder when no conversation selected', async () => {
    await act(async () => {
      renderHome();
    });
    expect(screen.getByText('欢迎使用 Chat')).toBeDefined();
    expect(screen.getByText('选择一个会话开始聊天')).toBeDefined();
  });

  it('should show version v1.15.0', async () => {
    await act(async () => {
      renderHome();
    });
    expect(screen.getByText('v1.15.0')).toBeDefined();
  });
});

describe('Home — 移动端布局', () => {
  beforeEach(() => {
    mockIsMobile = true;
    mockCurrentConversationId = null;
    jest.clearAllMocks();
  });

  it('should show conversation list view by default on mobile', async () => {
    await act(async () => {
      renderHome();
    });
    expect(screen.getByTestId('conversation-list')).toBeDefined();
    expect(screen.getByTestId('user-search')).toBeDefined();
  });

  it('should hide text labels in header on mobile', async () => {
    await act(async () => {
      renderHome();
    });
    expect(screen.queryByText('TestUser')).toBeNull();
    expect(screen.queryByText('资料')).toBeNull();
    expect(screen.queryByText('搜索')).toBeNull();
    expect(screen.queryByText('机器人')).toBeNull();
    expect(screen.queryByText('登出')).toBeNull();
  });

  it('should switch to chat view when conversation is selected', async () => {
    mockCurrentConversationId = 'conv-1';
    await act(async () => {
      renderHome();
    });
    expect(screen.getByTestId('chat-window')).toBeDefined();
  });

  it('should show back button in chat view on mobile', async () => {
    mockCurrentConversationId = 'conv-1';
    await act(async () => {
      renderHome();
    });
    // 在聊天视图中应有返回按钮（ArrowLeftOutlined 图标按钮）
    const backButton = screen.getByRole('button', { name: /arrow-left/i });
    expect(backButton).toBeDefined();
  });

  it('should switch back to list view when back button is clicked', async () => {
    mockCurrentConversationId = 'conv-1';
    await act(async () => {
      renderHome();
    });

    // 点击返回按钮
    const backButton = screen.getByRole('button', { name: /arrow-left/i });
    await act(async () => {
      fireEvent.click(backButton);
    });

    // 应回到列表视图
    expect(screen.getByTestId('conversation-list')).toBeDefined();
  });
});
