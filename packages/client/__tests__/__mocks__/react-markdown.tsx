import React from 'react';

const ReactMarkdown: React.FC<{ children: string; [key: string]: any }> = ({ children }) => {
  let html = children;
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  if (html.includes('<li>')) html = `<ul>${html}</ul>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export default ReactMarkdown;
