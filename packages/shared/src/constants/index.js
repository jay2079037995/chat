"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TAG_LENGTH = exports.MAX_CONV_TAGS = exports.TYPING_TIMEOUT = exports.MAX_BIO_LENGTH = exports.MAX_NICKNAME_LENGTH = exports.MAX_AVATAR_SIZE = exports.MAX_GROUP_MEMBERS = exports.MAX_GROUP_NAME_LENGTH = exports.MIN_GROUP_NAME_LENGTH = exports.MESSAGES_PER_PAGE = exports.ALLOWED_AUDIO_TYPES = exports.ALLOWED_IMAGE_TYPES = exports.MAX_AUDIO_SIZE = exports.MAX_IMAGE_SIZE = exports.MAX_FILE_SIZE = exports.MAX_MESSAGE_LENGTH = exports.LLM_PROVIDERS = void 0;
/** 所有 LLM Provider 配置 */
exports.LLM_PROVIDERS = {
    deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat'],
    },
    minimax: {
        baseUrl: 'https://api.minimax.io/v1',
        models: ['MiniMax-M2.5'],
    },
    openai: {
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini'],
    },
    claude: {
        baseUrl: 'https://api.anthropic.com/v1',
        models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
    },
    qwen: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: ['qwen-plus', 'qwen-turbo'],
    },
    custom: {
        baseUrl: '',
        models: [],
    },
};
/** 单条消息最大字符数 */
exports.MAX_MESSAGE_LENGTH = 5000;
/** 普通文件最大体积（10MB） */
exports.MAX_FILE_SIZE = 10 * 1024 * 1024;
/** 图片最大体积（5MB） */
exports.MAX_IMAGE_SIZE = 5 * 1024 * 1024;
/** 音频最大体积（10MB） */
exports.MAX_AUDIO_SIZE = 10 * 1024 * 1024;
/** 允许上传的图片 MIME 类型 */
exports.ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
/** 允许上传的音频 MIME 类型 */
exports.ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mp3', 'audio/wav', 'audio/ogg'];
/** 每页加载的消息数量 */
exports.MESSAGES_PER_PAGE = 50;
/** 群组名称最小长度 */
exports.MIN_GROUP_NAME_LENGTH = 2;
/** 群组名称最大长度 */
exports.MAX_GROUP_NAME_LENGTH = 50;
/** 群组最大成员数 */
exports.MAX_GROUP_MEMBERS = 100;
/** 头像最大体积（2MB） */
exports.MAX_AVATAR_SIZE = 2 * 1024 * 1024;
/** 昵称最大长度 */
exports.MAX_NICKNAME_LENGTH = 30;
/** 个人简介最大长度 */
exports.MAX_BIO_LENGTH = 200;
/** 输入指示器自动超时（毫秒） */
exports.TYPING_TIMEOUT = 3000;
/** 每个用户可为每个会话设置的最大标签数 */
exports.MAX_CONV_TAGS = 5;
/** 会话标签最大长度 */
exports.MAX_TAG_LENGTH = 20;
//# sourceMappingURL=index.js.map