import React, { useMemo } from 'react';
import { Button, message as antMessage } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import 'highlight.js/styles/github.css';
import type { Message } from '@chat/shared';
import styles from './index.module.less';

// 注册常用语言
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('go', go);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);

interface CodeMessageProps {
  message: Message;
}

const CodeMessage: React.FC<CodeMessageProps> = ({ message }) => {
  const language = message.codeLanguage || 'plaintext';

  const highlightedHtml = useMemo(() => {
    try {
      if (hljs.getLanguage(language)) {
        return hljs.highlight(message.content, { language }).value;
      }
      return hljs.highlightAuto(message.content).value;
    } catch {
      return message.content;
    }
  }, [message.content, language]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(message.content).then(() => {
      void antMessage.success('已复制');
    });
  };

  return (
    <div className={styles.codeMessage}>
      <div className={styles.header}>
        <span className={styles.language}>{language}</span>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopy}
          className={styles.copyBtn}
        >
          复制
        </Button>
      </div>
      <pre className={styles.codeBlock}>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
};

export default CodeMessage;
