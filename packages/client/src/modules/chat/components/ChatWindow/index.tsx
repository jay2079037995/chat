/**
 * 聊天窗口组件
 *
 * 显示与某用户的聊天历史，提供消息输入和发送功能。
 * 支持文字、图片、音频、代码、Markdown、文件等消息类型。
 * v1.3.0 新增：右键菜单（撤回/编辑/回复/reactions）、引用回复、编辑弹窗。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Upload, Progress, Spin, Modal, message as antMessage } from 'antd';
import { SendOutlined, TeamOutlined, CheckOutlined } from '@ant-design/icons';
import type { Message, MessageType } from '@chat/shared';
import { TYPING_TIMEOUT } from '@chat/shared';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { chatService } from '../../services/chatService';
import MessageBubble from '../MessageBubble';
import MessageToolbar from '../MessageToolbar';
import GroupMemberPanel from '../GroupMemberPanel';
import MentionInput from '../MentionInput';
import MessageContextMenu from '../MessageContextMenu';
import ReplyPreview from '../ReplyPreview';
import styles from './index.module.less';

const { TextArea } = Input;

/** 格式化消息时间戳 */
function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 代码语言选项 */
const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'sql', label: 'SQL' },
];

/** 右键菜单状态 */
interface ContextMenuState {
  visible: boolean;
  message: Message | null;
  position: { x: number; y: number };
}

const ChatWindow: React.FC = () => {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const participantNames = useChatStore((s) => s.participantNames);
  const groupNames = useChatStore((s) => s.groupNames);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const hasMore = useChatStore((s) => s.hasMore);
  const loadingMore = useChatStore((s) => s.loadingMore);
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages);
  const botUserIds = useChatStore((s) => s.botUserIds);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const lastReadMap = useChatStore((s) => s.lastReadMap);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const currentUser = useAuthStore((s) => s.user);

  const [inputValue, setInputValue] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showMemberPanel, setShowMemberPanel] = useState(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    message: null,
    position: { x: 0, y: 0 },
  });

  // 编辑弹窗状态
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');

  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const currentMessages = currentConversationId ? messages[currentConversationId] || [] : [];

  const currentConv = conversations.find((c) => c.id === currentConversationId);
  const isGroup = currentConv?.type === 'group';
  const otherParticipantId = currentConv?.participants.find((p) => p !== currentUser?.id) || '';
  const otherName = participantNames[otherParticipantId] || otherParticipantId;
  const isOnline = botUserIds.has(otherParticipantId) || onlineUsers.has(otherParticipantId);

  // 群聊信息
  const groupName = isGroup && currentConversationId ? groupNames[currentConversationId] || '群聊' : '';
  const memberCount = currentConv?.participants.length || 0;

  useEffect(() => {
    if (typeof messageEndRef.current?.scrollIntoView === 'function') {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages.length]);

  // 切换会话时清除引用状态
  useEffect(() => {
    setReplyingTo(null);
  }, [currentConversationId, setReplyingTo]);

  /** 上滑加载更多历史消息 */
  const handleScroll = useCallback(() => {
    const el = messageAreaRef.current;
    if (!el || !currentConversationId) return;

    if (el.scrollTop <= 0 && hasMore[currentConversationId] && !loadingMore) {
      const prevScrollHeight = el.scrollHeight;
      void loadMoreMessages(currentConversationId).then(() => {
        // 恢复滚动位置
        requestAnimationFrame(() => {
          if (messageAreaRef.current) {
            messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight - prevScrollHeight;
          }
        });
      });
    }
  }, [currentConversationId, hasMore, loadingMore, loadMoreMessages]);

  // 切换会话时清除输入状态
  useEffect(() => {
    return () => {
      if (isTypingRef.current && currentConversationId) {
        const { socket } = useSocketStore.getState();
        socket?.emit('typing:stop', { conversationId: currentConversationId });
        isTypingRef.current = false;
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [currentConversationId]);

  /** 处理输入变化时的 typing 状态 */
  const handleInputChange = (value: string) => {
    setInputValue(value);

    if (!currentConversationId) return;
    const { socket } = useSocketStore.getState();
    if (!socket?.connected) return;

    // 发送 typing:start
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', { conversationId: currentConversationId });
    }

    // 重置计时器
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit('typing:stop', { conversationId: currentConversationId });
      }
    }, TYPING_TIMEOUT);
  };

  /** 停止输入状态（发送时调用） */
  const stopTyping = () => {
    if (isTypingRef.current && currentConversationId) {
      const { socket } = useSocketStore.getState();
      socket?.emit('typing:stop', { conversationId: currentConversationId });
      isTypingRef.current = false;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  // 切换消息类型时重置输入
  useEffect(() => {
    setInputValue('');
  }, [messageType]);

  /** 判断自己发送的消息是否已被对方读取（仅私聊） */
  const isMessageRead = (msg: Message): boolean => {
    if (!currentConversationId || isGroup) return false;
    if (msg.senderId !== currentUser?.id) return false;
    const convReadMap = lastReadMap[currentConversationId];
    if (!convReadMap) return false;
    // 检查对方的 lastReadAt 是否 >= 消息发送时间
    return Object.entries(convReadMap).some(
      ([userId, ts]) => userId !== currentUser?.id && ts >= msg.createdAt,
    );
  };

  /** 发送文字 / 代码 / Markdown 消息 */
  const handleSend = () => {
    if (!inputValue.trim()) return;

    stopTyping();

    if (messageType === 'code') {
      sendMessage(inputValue, 'code', { codeLanguage });
    } else if (messageType === 'markdown') {
      sendMessage(inputValue, 'markdown');
    } else {
      sendMessage(inputValue);
    }

    setInputValue('');
    if (messageType !== 'text') setMessageType('text');
  };

  /** Enter 发送，Shift+Enter 换行 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** 图片上传 */
  const handleImageUpload = async (file: File) => {
    try {
      const result = await chatService.uploadImage(file);
      sendMessage(result.url, 'image', {
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
      setMessageType('text');
    } catch {
      void antMessage.error('图片上传失败');
    }
    return false;
  };

  /** 文件上传 */
  const handleFileUpload = async (file: File) => {
    try {
      setUploadProgress(0);
      const result = await chatService.uploadFile(file, (percent) => {
        setUploadProgress(percent);
      });
      sendMessage(result.url, 'file', {
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
      setUploadProgress(null);
      setMessageType('text');
    } catch {
      void antMessage.error('文件上传失败');
      setUploadProgress(null);
    }
    return false;
  };

  /** 开始录音 */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

        try {
          const result = await chatService.uploadFile(file);
          sendMessage(result.url, 'audio', {
            fileName: result.fileName,
            fileSize: result.fileSize,
            mimeType: result.mimeType,
          });
        } catch {
          void antMessage.error('音频上传失败');
        }

        setIsRecording(false);
        setRecordingDuration(0);
        setMessageType('text');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      void antMessage.error('无法访问麦克风');
    }
  };

  /** 停止录音并发送 */
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  /** 取消录音 */
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    setMessageType('text');
  };

  /** 消息气泡右键菜单 */
  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    // 已撤回消息不显示菜单
    if (msg.recalled) return;
    setContextMenu({
      visible: true,
      message: msg,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  /** 关闭右键菜单 */
  const closeContextMenu = () => {
    setContextMenu({ visible: false, message: null, position: { x: 0, y: 0 } });
  };

  /** 回复消息 */
  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
  };

  /** 打开编辑弹窗 */
  const handleEdit = (msg: Message) => {
    setEditingMessage(msg);
    setEditContent(msg.content);
  };

  /** 确认编辑消息 */
  const handleEditConfirm = () => {
    if (!editingMessage || !editContent.trim()) return;
    const { socket } = useSocketStore.getState();
    socket?.emit('message:edit', {
      messageId: editingMessage.id,
      conversationId: editingMessage.conversationId,
      newContent: editContent.trim(),
    }, (result) => {
      if (!result.success) {
        const errorMap: Record<string, string> = {
          EDIT_TIMEOUT: '已超过 5 分钟，无法编辑',
          FORBIDDEN: '只能编辑自己的消息',
          EDIT_NOT_SUPPORTED: '该类型消息不支持编辑',
          MESSAGE_RECALLED: '消息已撤回，无法编辑',
          EMPTY_MESSAGE: '内容不能为空',
          MESSAGE_TOO_LONG: '内容超过长度限制',
        };
        void antMessage.error(errorMap[result.error || ''] || '编辑失败');
      }
    });
    setEditingMessage(null);
    setEditContent('');
  };

  // 群聊可 @ 的成员列表
  const mentionMembers = isGroup && currentConv
    ? currentConv.participants
        .filter((pid) => pid !== currentUser?.id)
        .map((pid) => ({ id: pid, username: participantNames[pid] || pid }))
    : [];

  if (!currentConversationId) return null;

  /** 渲染输入区域 */
  const renderInputArea = () => {
    switch (messageType) {
      case 'image':
        return (
          <Upload
            accept="image/jpeg,image/png,image/gif,image/webp"
            showUploadList={false}
            beforeUpload={handleImageUpload}
          >
            <Button type="dashed" block>
              点击选择图片
            </Button>
          </Upload>
        );

      case 'audio':
        return isRecording ? (
          <div className={styles.recordingArea}>
            <span className={styles.recordingDot} />
            <span className={styles.recordingTime}>
              录音中 {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
            </span>
            <Button size="small" onClick={cancelRecording}>取消</Button>
            <Button size="small" type="primary" onClick={stopRecording}>发送</Button>
          </div>
        ) : (
          <Button type="dashed" block onClick={startRecording}>
            点击开始录音
          </Button>
        );

      case 'code':
        return (
          <>
            <Select
              value={codeLanguage}
              onChange={setCodeLanguage}
              options={CODE_LANGUAGES}
              size="small"
              style={{ width: 140, marginBottom: 8 }}
            />
            <TextArea
              className={styles.textInput}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入代码..."
              autoSize={{ minRows: 3, maxRows: 10 }}
              style={{ fontFamily: 'monospace' }}
            />
          </>
        );

      case 'markdown':
        return (
          <TextArea
            className={styles.textInput}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入 Markdown..."
            autoSize={{ minRows: 2, maxRows: 8 }}
          />
        );

      case 'file':
        return (
          <div>
            <Upload
              showUploadList={false}
              beforeUpload={handleFileUpload}
            >
              <Button type="dashed" block>
                点击选择文件
              </Button>
            </Upload>
            {uploadProgress !== null && (
              <Progress percent={uploadProgress} size="small" style={{ marginTop: 8 }} />
            )}
          </div>
        );

      default:
        return isGroup ? (
          <MentionInput
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            members={mentionMembers}
            placeholder="输入消息，@ 提及成员..."
          />
        ) : (
          <TextArea
            className={styles.textInput}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
        );
    }
  };

  const showSendButton = messageType === 'text' || messageType === 'code' || messageType === 'markdown';

  return (
    <div className={styles.container}>
      {/* 顶部 */}
      <div className={styles.header}>
        {isGroup ? (
          <>
            <span className={styles.headerName}>{groupName}</span>
            <span className={styles.memberCount}>({memberCount}人)</span>
            <div style={{ flex: 1 }} />
            <Button
              type="text"
              icon={<TeamOutlined />}
              onClick={() => setShowMemberPanel(true)}
            >
              成员
            </Button>
          </>
        ) : (
          <>
            <span className={styles.headerName}>{otherName}</span>
            <span className={isOnline ? styles.onlineDot : styles.offlineDot} />
            <span className={styles.statusText}>{isOnline ? '在线' : '离线'}</span>
          </>
        )}
      </div>

      {/* 输入状态指示器 */}
      {currentConversationId && (() => {
        const convTyping = typingUsers[currentConversationId];
        if (!convTyping || convTyping.size === 0) return null;
        const names = Array.from(convTyping)
          .filter((uid) => uid !== currentUser?.id)
          .map((uid) => participantNames[uid] || uid);
        if (names.length === 0) return null;
        return (
          <div className={styles.typingIndicator}>
            {names.length === 1
              ? `${names[0]} 正在输入...`
              : `${names.join('、')} 正在输入...`}
          </div>
        );
      })()}

      {/* 消息区域 */}
      <div className={styles.messageArea} ref={messageAreaRef} onScroll={handleScroll}>
        {/* 顶部加载指示 */}
        {currentConversationId && loadingMore && (
          <div className={styles.loadMoreHint}><Spin size="small" /> 加载中...</div>
        )}
        {currentConversationId && !hasMore[currentConversationId] && currentMessages.length > 0 && (
          <div className={styles.loadMoreHint}>没有更多消息</div>
        )}
        {currentMessages.map((msg) => {
          const isSelf = msg.senderId === currentUser?.id;
          const isMediaType = !msg.recalled && (msg.type === 'image' || msg.type === 'code' || msg.type === 'file');
          const senderName = isSelf ? (currentUser?.username || '') : (participantNames[msg.senderId] || msg.senderId);
          return (
            <div key={msg.id}>
              <div
                className={`${styles.messageMeta} ${
                  isSelf ? styles.messageMetaSelf : styles.messageMetaOther
                }`}
              >
                <span className={styles.senderName}>{senderName}</span>
                <span className={styles.messageTime}>
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>
              <div
                className={`${styles.messageItem} ${
                  isSelf ? styles.messageItemSelf : styles.messageItemOther
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    isSelf ? styles.bubbleSelf : styles.bubbleOther
                  } ${isMediaType ? styles.bubbleMedia : ''} ${msg.recalled ? styles.bubbleRecalled : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  <MessageBubble message={msg} isSelf={isSelf} participantNames={participantNames} />
                </div>
                {/* 已读回执标记（仅私聊 + 自己发的消息） */}
                {isSelf && !isGroup && !msg.recalled && (
                  <span className={`${styles.readReceipt} ${isMessageRead(msg) ? styles.readReceiptRead : ''}`}>
                    {isMessageRead(msg) ? (
                      <><CheckOutlined /><CheckOutlined className={styles.readReceiptSecond} /></>
                    ) : (
                      <CheckOutlined />
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messageEndRef} />
      </div>

      {/* 输入区域 */}
      <div className={styles.inputArea}>
        <MessageToolbar
          activeType={messageType}
          onTypeChange={setMessageType}
          onEmojiSelect={(emoji) => setInputValue((v) => v + emoji)}
        />

        {/* 引用回复预览条 */}
        {replyingTo && (
          <ReplyPreview
            message={replyingTo}
            senderName={participantNames[replyingTo.senderId] || replyingTo.senderId}
            onClose={() => setReplyingTo(null)}
          />
        )}

        <div className={styles.inputRow}>
          <div className={styles.inputContent}>
            {renderInputArea()}
          </div>
          {showSendButton && (
            <Button
              className={styles.sendButton}
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!inputValue.trim()}
            >
              发送
            </Button>
          )}
        </div>
      </div>

      {isGroup && currentConversationId && (
        <GroupMemberPanel
          groupId={currentConversationId}
          visible={showMemberPanel}
          onClose={() => setShowMemberPanel(false)}
        />
      )}

      {/* 右键上下文菜单 */}
      {contextMenu.visible && contextMenu.message && (
        <MessageContextMenu
          message={contextMenu.message}
          isSelf={contextMenu.message.senderId === currentUser?.id}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onReply={handleReply}
          onEdit={handleEdit}
        />
      )}

      {/* 编辑消息弹窗 */}
      <Modal
        title="编辑消息"
        open={!!editingMessage}
        onOk={handleEditConfirm}
        onCancel={() => { setEditingMessage(null); setEditContent(''); }}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !editContent.trim() }}
      >
        <TextArea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 8 }}
          placeholder="编辑消息内容..."
        />
      </Modal>
    </div>
  );
};

export default ChatWindow;
