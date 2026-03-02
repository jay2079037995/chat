/**
 * ConversationContextMenu 组件测试
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ConversationContextMenu from '../src/modules/chat/components/ConversationContextMenu';

const mockTogglePin = jest.fn().mockResolvedValue(undefined);
const mockToggleMute = jest.fn().mockResolvedValue(undefined);
const mockToggleArchive = jest.fn().mockResolvedValue(undefined);
const mockDeleteConversation = jest.fn().mockResolvedValue(undefined);
const mockSetConversationTags = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      togglePinConversation: mockTogglePin,
      toggleMuteConversation: mockToggleMute,
      toggleArchiveConversation: mockToggleArchive,
      deleteConversation: mockDeleteConversation,
      setConversationTags: mockSetConversationTags,
    }),
}));

const defaultProps = {
  conversationId: 'conv1',
  position: { x: 100, y: 100 },
  isPinned: false,
  isMuted: false,
  isArchived: false,
  tags: [] as string[],
  onClose: jest.fn(),
};

const renderMenu = (overrides = {}) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <ConversationContextMenu {...defaultProps} {...overrides} />
    </ConfigProvider>,
  );
};

describe('ConversationContextMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render menu items', () => {
    renderMenu();
    expect(screen.getByText('置顶')).toBeTruthy();
    expect(screen.getByText('免打扰')).toBeTruthy();
    expect(screen.getByText('标签')).toBeTruthy();
    expect(screen.getByText('归档')).toBeTruthy();
    expect(screen.getByText('删除')).toBeTruthy();
  });

  it('should show "取消置顶" when isPinned', () => {
    renderMenu({ isPinned: true });
    expect(screen.getByText('取消置顶')).toBeTruthy();
  });

  it('should show "取消免打扰" when isMuted', () => {
    renderMenu({ isMuted: true });
    expect(screen.getByText('取消免打扰')).toBeTruthy();
  });

  it('should show "取消归档" when isArchived', () => {
    renderMenu({ isArchived: true });
    expect(screen.getByText('取消归档')).toBeTruthy();
  });

  it('should call togglePin and onClose on pin click', () => {
    const onClose = jest.fn();
    renderMenu({ onClose });
    fireEvent.click(screen.getByText('置顶'));
    expect(mockTogglePin).toHaveBeenCalledWith('conv1');
    expect(onClose).toHaveBeenCalled();
  });

  it('should call toggleMute and onClose on mute click', () => {
    const onClose = jest.fn();
    renderMenu({ onClose });
    fireEvent.click(screen.getByText('免打扰'));
    expect(mockToggleMute).toHaveBeenCalledWith('conv1');
    expect(onClose).toHaveBeenCalled();
  });

  it('should call toggleArchive and onClose on archive click', () => {
    const onClose = jest.fn();
    renderMenu({ onClose });
    fireEvent.click(screen.getByText('归档'));
    expect(mockToggleArchive).toHaveBeenCalledWith('conv1');
    expect(onClose).toHaveBeenCalled();
  });

  it('should show tag input on tag click', () => {
    renderMenu();
    fireEvent.click(screen.getByText('标签'));
    expect(screen.getByPlaceholderText('添加标签')).toBeTruthy();
  });

  it('should display existing tags', () => {
    renderMenu({ tags: ['工作', '重要'] });
    fireEvent.click(screen.getByText('标签'));
    expect(screen.getByText('工作')).toBeTruthy();
    expect(screen.getByText('重要')).toBeTruthy();
  });

  it('should close on Escape key', () => {
    const onClose = jest.fn();
    renderMenu({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
