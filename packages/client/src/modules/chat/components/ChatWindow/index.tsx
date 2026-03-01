/**
 * 聊天窗口组件
 *
 * 显示与某用户的聊天历史，提供消息输入和发送功能。
 * 支持文字、图片、音频、代码、Markdown、文件等消息类型。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Upload, Progress, message as antMessage } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type { MessageType } from '@chat/shared';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { chatService } from '../../services/chatService';
import MessageBubble from '../MessageBubble';
import MessageToolbar from '../MessageToolbar';
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

const ChatWindow: React.FC = () => {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const participantNames = useChatStore((s) => s.participantNames);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const currentUser = useAuthStore((s) => s.user);

  const [inputValue, setInputValue] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentMessages = currentConversationId ? messages[currentConversationId] || [] : [];

  const currentConv = conversations.find((c) => c.id === currentConversationId);
  const otherParticipantId = currentConv?.participants.find((p) => p !== currentUser?.id) || '';
  const otherName = participantNames[otherParticipantId] || otherParticipantId;
  const isOnline = onlineUsers.has(otherParticipantId);

  useEffect(() => {
    if (typeof messageEndRef.current?.scrollIntoView === 'function') {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages.length]);

  // 切换消息类型时重置输入
  useEffect(() => {
    setInputValue('');
  }, [messageType]);

  /** 发送文字 / 代码 / Markdown 消息 */
  const handleSend = () => {
    if (!inputValue.trim()) return;

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
              onChange={(e) => setInputValue(e.target.value)}
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
            onChange={(e) => setInputValue(e.target.value)}
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
        return (
          <TextArea
            className={styles.textInput}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
        <span className={styles.headerName}>{otherName}</span>
        <span className={isOnline ? styles.onlineDot : styles.offlineDot} />
        <span className={styles.statusText}>{isOnline ? '在线' : '离线'}</span>
      </div>

      {/* 消息区域 */}
      <div className={styles.messageArea}>
        {currentMessages.map((msg) => {
          const isSelf = msg.senderId === currentUser?.id;
          const isMediaType = msg.type === 'image' || msg.type === 'code' || msg.type === 'file';
          return (
            <div key={msg.id}>
              <div
                className={`${styles.messageItem} ${
                  isSelf ? styles.messageItemSelf : styles.messageItemOther
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    isSelf ? styles.bubbleSelf : styles.bubbleOther
                  } ${isMediaType ? styles.bubbleMedia : ''}`}
                >
                  <MessageBubble message={msg} isSelf={isSelf} />
                </div>
              </div>
              <div
                className={`${styles.messageTime} ${
                  isSelf ? styles.messageTimeSelf : styles.messageTimeOther
                }`}
              >
                {formatMessageTime(msg.createdAt)}
              </div>
            </div>
          );
        })}
        <div ref={messageEndRef} />
      </div>

      {/* 输入区域 */}
      <div className={styles.inputArea}>
        <MessageToolbar activeType={messageType} onTypeChange={setMessageType} />
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
    </div>
  );
};

export default ChatWindow;
