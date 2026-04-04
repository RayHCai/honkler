import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

const uploadDir = join(process.cwd(), env.UPLOAD_DIR, 'documents');

// Ensure uploads directory exists on first import
const _ensureDir = mkdir(uploadDir, { recursive: true });

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  _mimeType: string,
): Promise<{ key: string; url: string }> {
  const key = `documents/${randomUUID()}-${originalName}`;
  const filePath = join(process.cwd(), env.UPLOAD_DIR, key);

  await writeFile(filePath, buffer);

  const baseUrl = `http://localhost:${env.PORT}`;
  return {
    key,
    url: `${baseUrl}/uploads/${key}`,
  };
}

export async function deleteFile(key: string): Promise<void> {
  const filePath = join(process.cwd(), env.UPLOAD_DIR, key);
  await unlink(filePath);
}

export function getFileUrl(key: string): string {
  return `http://localhost:${env.PORT}/uploads/${key}`;
}
