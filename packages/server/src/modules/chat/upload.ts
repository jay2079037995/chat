import multer, { type FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  MAX_IMAGE_SIZE,
  MAX_FILE_SIZE,
  MAX_AVATAR_SIZE,
  ALLOWED_IMAGE_TYPES,
} from '@chat/shared';
import type { Request } from 'express';

/** 上传根目录 */
const UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'uploads');

/** 子目录 */
const UPLOAD_DIRS = {
  images: path.join(UPLOAD_ROOT, 'images'),
  audio: path.join(UPLOAD_ROOT, 'audio'),
  files: path.join(UPLOAD_ROOT, 'files'),
  avatars: path.join(UPLOAD_ROOT, 'avatars'),
};

// 启动时确保目录存在
for (const dir of Object.values(UPLOAD_DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

/** 图片存储配置 */
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIRS.images);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

/** 通用文件存储配置 */
const fileStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, UPLOAD_DIRS.audio);
    } else {
      cb(null, UPLOAD_DIRS.files);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

/** 图片类型过滤器 */
const imageFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('UNSUPPORTED_IMAGE_TYPE'));
  }
};

/** 图片上传中间件 */
export const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: imageFilter,
});

/** 通用文件上传中间件 */
export const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: MAX_FILE_SIZE },
});

/** 头像存储配置 */
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIRS.avatars);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

/** 头像上传中间件 */
export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: imageFilter,
});

/** 根据文件路径生成 URL */
export function getFileUrl(filePath: string): string {
  const relative = path.relative(UPLOAD_ROOT, filePath);
  return `/uploads/${relative.replace(/\\/g, '/')}`;
}
