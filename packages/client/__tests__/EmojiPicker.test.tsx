/**
 * EmojiPicker 组件测试 (v1.3.0)
 *
 * 测试 Emoji 选择器的打开/关闭、emoji 选择回调和点击外部关闭功能。
 * 使用 mock Picker 创建的 data-testid 元素判断浮层可见性。
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import EmojiPicker from '../src/modules/chat/components/EmojiPicker';

/** 捕获 Picker 构造时传入的 onEmojiSelect 回调 */
let capturedOnEmojiSelect: ((emoji: { native: string }) => void) | null = null;

jest.mock('@emoji-mart/data', () => ({ default: {} }));

jest.mock('emoji-mart', () => ({
  Picker: jest.fn().mockImplementation(function MockPicker(opts: any) {
    capturedOnEmojiSelect = opts.onEmojiSelect;
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'emoji-picker-inner');
    return el;
  }),
}));

/** 检查 Picker 浮层是否可见（通过 mock Picker 创建的 data-testid 元素） */
function isPickerVisible(): boolean {
  return document.querySelector('[data-testid="emoji-picker-inner"]') !== null;
}

describe('EmojiPicker (v1.3.0)', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnEmojiSelect = null;
  });

  it('初始状态不显示 Picker 浮层', () => {
    render(<EmojiPicker onSelect={mockOnSelect} />);
    expect(isPickerVisible()).toBe(false);
  });

  it('点击按钮弹出 Picker 浮层', async () => {
    const { container } = render(<EmojiPicker onSelect={mockOnSelect} />);

    // 点击触发按钮
    const triggerBtn = container.querySelector('button')!;
    await act(async () => {
      fireEvent.click(triggerBtn);
    });

    // 等待动态导入完成并渲染 Picker
    await waitFor(() => {
      expect(isPickerVisible()).toBe(true);
    });
  });

  it('选择 emoji 后触发 onSelect 回调并关闭浮层', async () => {
    const { container } = render(<EmojiPicker onSelect={mockOnSelect} />);

    // 打开 Picker
    const triggerBtn = container.querySelector('button')!;
    await act(async () => {
      fireEvent.click(triggerBtn);
    });

    // 等待 Picker 加载
    await waitFor(() => {
      expect(capturedOnEmojiSelect).not.toBeNull();
    });

    // 模拟选择 emoji
    await act(async () => {
      capturedOnEmojiSelect!({ native: '😊' });
    });

    // onSelect 应被调用
    expect(mockOnSelect).toHaveBeenCalledWith('😊');

    // 浮层应关闭
    expect(isPickerVisible()).toBe(false);
  });

  it('点击外部关闭 Picker 浮层', async () => {
    const { container } = render(
      <div>
        <div data-testid="outside">外部区域</div>
        <EmojiPicker onSelect={mockOnSelect} />
      </div>,
    );

    // 打开 Picker
    const triggerBtn = container.querySelector('button')!;
    await act(async () => {
      fireEvent.click(triggerBtn);
    });

    await waitFor(() => {
      expect(isPickerVisible()).toBe(true);
    });

    // 点击外部区域
    await act(async () => {
      fireEvent.mouseDown(screen.getByTestId('outside'));
    });

    // 浮层应关闭
    expect(isPickerVisible()).toBe(false);
  });

  it('再次点击按钮可关闭 Picker', async () => {
    const { container } = render(<EmojiPicker onSelect={mockOnSelect} />);
    const triggerBtn = container.querySelector('button')!;

    // 打开
    await act(async () => {
      fireEvent.click(triggerBtn);
    });

    await waitFor(() => {
      expect(isPickerVisible()).toBe(true);
    });

    // 再次点击关闭
    await act(async () => {
      fireEvent.click(triggerBtn);
    });

    expect(isPickerVisible()).toBe(false);
  });
});
