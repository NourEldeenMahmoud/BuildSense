import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import {
  SnapshotStore,
  computeContentHash,
  buildSnapshotFileName,
  hashUrlForFilename,
} from './snapshot-store.js';

const gunzip = promisify(zlib.gunzip);

describe('SnapshotStore', () => {
  let tempDir: string;
  let store: SnapshotStore;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-store-test-'));
    store = new SnapshotStore(tempDir);
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.rm(path.join(tempDir, file), { recursive: true, force: true });
    }
  });

  it('writes a snapshot and returns metadata', async () => {
    const content = Buffer.from('<html>Test content</html>');
    const result = await store.writeSnapshot({
      runId: 'run-001',
      externalId: '9f503b67-b433-4434-8879-ebd003dce713',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=test',
      content,
    });

    expect(result.contentSha256).toHaveLength(64);
    expect(result.contentPath).toContain('run-001');
    expect(result.contentPath).toContain('9f503b67-b433-4434-8879-ebd003dce713');
    expect(result.contentPath).toContain('.html.gz');
    expect(result.bytesWritten).toBeGreaterThan(0);
    expect(result.wasDuplicate).toBe(false);
  });

  it('returns duplicate flag for identical content', async () => {
    const content = Buffer.from('<html>Duplicate content</html>');
    const input = {
      runId: 'run-002',
      externalId: null,
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-1',
      content,
    };

    const first = await store.writeSnapshot(input);
    const second = await store.writeSnapshot(input);

    expect(first.wasDuplicate).toBe(false);
    expect(second.wasDuplicate).toBe(true);
    expect(second.bytesWritten).toBe(0);
    expect(first.contentSha256).toBe(second.contentSha256);
  });

  it('creates separate files for different content', async () => {
    const content1 = Buffer.from('<html>Content version 1</html>');
    const content2 = Buffer.from('<html>Content version 2</html>');
    const input = {
      runId: 'run-003',
      externalId: 'product-abc',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-abc',
    };

    const first = await store.writeSnapshot({ ...input, content: content1 });
    const second = await store.writeSnapshot({ ...input, content: content2 });

    expect(first.contentSha256).not.toBe(second.contentSha256);
    expect(first.contentPath).not.toBe(second.contentPath);
  });

  it('uses URL hash when externalId is null', async () => {
    const content = Buffer.from('<html>No external ID</html>');
    const result = await store.writeSnapshot({
      runId: 'run-004',
      externalId: null,
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-no-id',
      content,
    });

    expect(result.contentPath).toContain('run-004');
    expect(result.contentPath).not.toContain('null');
    expect(result.contentPath).toMatch(/[a-z0-9]+-[a-f0-9]+\.html\.gz$/);
  });

  it('reads a written snapshot', async () => {
    const content = Buffer.from('<html>Readable content</html>');
    const written = await store.writeSnapshot({
      runId: 'run-005',
      externalId: 'product-read',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-read',
      content,
    });

    const read = await store.readSnapshot(written.contentPath);
    const decompressed = await gunzip(read.content);
    expect(decompressed).toEqual(content);
  });

  it('checks if snapshot exists', async () => {
    const content = Buffer.from('<html>Existence check</html>');
    const written = await store.writeSnapshot({
      runId: 'run-006',
      externalId: 'product-exists',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-exists',
      content,
    });

    const exists = await store.snapshotExists(written.contentPath);
    expect(exists).toBe(true);

    const notExists = await store.snapshotExists('run-006/nonexistent.html.gz');
    expect(notExists).toBe(false);
  });

  it('generates correct snapshot path', async () => {
    const snapshotPath = await store.getSnapshotPath(
      'run-007',
      'product-path',
      'https://www.sigma-computer.com/en/item?id=product-path',
      'abcdef1234567890',
    );

    expect(snapshotPath).toBe('run-007/product-path-abcdef12.html.gz');
  });
});

describe('computeContentHash', () => {
  it('returns consistent SHA-256 hash', () => {
    const content = Buffer.from('test content');
    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('returns different hash for different content', () => {
    const hash1 = computeContentHash(Buffer.from('content 1'));
    const hash2 = computeContentHash(Buffer.from('content 2'));

    expect(hash1).not.toBe(hash2);
  });
});

describe('buildSnapshotFileName', () => {
  it('uses externalId when provided', () => {
    const fileName = buildSnapshotFileName(
      '9f503b67-b433-4434-8879-ebd003dce713',
      'https://example.com',
      'abcdef1234567890',
    );

    expect(fileName).toBe('9f503b67-b433-4434-8879-ebd003dce713-abcdef12.html.gz');
  });

  it('uses URL hash when externalId is null', () => {
    const fileName = buildSnapshotFileName(
      null,
      'https://www.sigma-computer.com/en/item?id=test-product',
      'abcdef1234567890',
    );

    expect(fileName).toMatch(/^[a-z0-9]+-abcdef12\.html\.gz$/);
    expect(fileName).not.toContain('null');
  });
});

describe('hashUrlForFilename', () => {
  it('returns consistent hash', () => {
    const hash1 = hashUrlForFilename('https://example.com/test');
    const hash2 = hashUrlForFilename('https://example.com/test');

    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different URLs', () => {
    const hash1 = hashUrlForFilename('https://example.com/test1');
    const hash2 = hashUrlForFilename('https://example.com/test2');

    expect(hash1).not.toBe(hash2);
  });

  it('returns alphanumeric string', () => {
    const hash = hashUrlForFilename('https://example.com/test');
    expect(hash).toMatch(/^[a-z0-9]+$/);
    expect(hash.length).toBeLessThanOrEqual(12);
  });
});
