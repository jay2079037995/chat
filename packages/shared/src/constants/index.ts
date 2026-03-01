/**
 * 全局常量 —— 前后端共享的业务限制和配置
 */

/** 单条消息最大字符数 */
export const MAX_MESSAGE_LENGTH = 5000;
/** 普通文件最大体积（10MB） */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** 图片最大体积（5MB） */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
/** 音频最大体积（10MB） */
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
/** 允许上传的图片 MIME 类型 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
/** 允许上传的音频 MIME 类型 */
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'];
/** 每页加载的消息数量 */
export const MESSAGES_PER_PAGE = 50;
