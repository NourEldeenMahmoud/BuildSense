import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);

export interface SnapshotWriteInput {
  runId: string;
  externalId: string | null;
  canonicalUrl: string;
  content: Buffer;
}

export interface SnapshotWriteResult {
  contentSha256: string;
  contentPath: string;
  bytesWritten: number;
  wasDuplicate: boolean;
}

export interface SnapshotReadResult {
  content: Buffer;
  contentPath: string;
}

export class SnapshotStore {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async writeSnapshot(input: SnapshotWriteInput): Promise<SnapshotWriteResult> {
    const contentSha256 = computeContentHash(input.content);
    const fileName = buildSnapshotFileName(input.externalId, input.canonicalUrl, contentSha256);
    const runDir = path.join(this.baseDir, input.runId);
    const contentPath = path.join(runDir, fileName);
    const fullPath = path.resolve(contentPath);

    await fs.mkdir(runDir, { recursive: true });

    const exists = await fileExists(fullPath);
    if (exists) {
      return {
        contentSha256,
        contentPath,
        bytesWritten: 0,
        wasDuplicate: true,
      };
    }

    const gzipped = await gzip(input.content, { level: 9 });
    const tempPath = `${fullPath}.tmp.${Date.now()}`;

    try {
      await fs.writeFile(tempPath, gzipped);
      await fs.rename(tempPath, fullPath);
    } catch (error) {
      await safeUnlink(tempPath);
      throw error;
    }

    return {
      contentSha256,
      contentPath,
      bytesWritten: gzipped.length,
      wasDuplicate: false,
    };
  }

  async readSnapshot(contentPath: string): Promise<SnapshotReadResult> {
    const fullPath = path.isAbsolute(contentPath)
      ? contentPath
      : path.resolve(this.baseDir, contentPath);
    const content = await fs.readFile(fullPath);
    return { content, contentPath };
  }

  async snapshotExists(contentPath: string): Promise<boolean> {
    const fullPath = path.isAbsolute(contentPath)
      ? contentPath
      : path.resolve(this.baseDir, contentPath);
    return fileExists(fullPath);
  }

  async getSnapshotPath(
    runId: string,
    externalId: string | null,
    canonicalUrl: string,
    contentSha256: string,
  ): Promise<string> {
    const fileName = buildSnapshotFileName(externalId, canonicalUrl, contentSha256);
    return `${runId}/${fileName}`;
  }
}

export function computeContentHash(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function buildSnapshotFileName(
  externalId: string | null,
  canonicalUrl: string,
  contentSha256: string,
): string {
  const shaPrefix = contentSha256.slice(0, 8);
  const identifier = externalId ?? hashUrlForFilename(canonicalUrl);
  return `${identifier}-${shaPrefix}.html.gz`;
}

export function hashUrlForFilename(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 12);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore errors on cleanup
  }
}
