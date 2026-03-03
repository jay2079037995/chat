"use strict";
/**
 * 通用工具函数 —— 前后端共享
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.formatFileSize = formatFileSize;
/** 生成唯一 ID（时间戳 + 随机数的 36 进制组合） */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
/** 将字节数格式化为人类可读的文件大小（如 1.5 MB） */
function formatFileSize(bytes) {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
//# sourceMappingURL=index.js.map