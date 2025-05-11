import { FileSystemError } from '../../errors/FileSystemError';
import type { FileContent } from '../../interfaces/types';
import { pathUtils } from './path';

/**
 * ファイルシステムのパーミッションを要求
 * @param handle - ファイルシステムハンドル
 * @param mode - 要求するパーミッション（'read' または 'readwrite'）
 */
export async function requestPermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<void> {
  try {
    const result = await handle.queryPermission({ mode });
    if (result === 'granted') return;

    const newResult = await handle.requestPermission({ mode });
    if (newResult !== 'granted') {
      throw new FileSystemError(
        `Permission denied: ${mode} access not granted`,
        'PERMISSION_DENIED'
      );
    }
  } catch (error) {
    throw FileSystemError.system(
      'Failed to request permissions',
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * ファイルハンドルを取得
 * @param root - ルートディレクトリハンドル
 * @param path - ファイルパス
 * @param options - オプション
 */
export async function getFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  options: { create?: boolean } = {}
): Promise<FileSystemFileHandle> {
  try {
    const segments = pathUtils.split(path);
    if (segments.length === 0) {
      throw FileSystemError.invalidPath(path);
    }

    const fileName = segments.pop()!;
    let currentDir = root;

    // 親ディレクトリのパスを取得
    for (const segment of segments) {
      currentDir = await currentDir.getDirectoryHandle(segment, { create: options.create });
    }

    return currentDir.getFileHandle(fileName, options);
  } catch (error) {
    if (error instanceof FileSystemError) throw error;
    
    if (error instanceof Error && error.name === 'NotFoundError') {
      throw FileSystemError.notFound(path);
    }
    
    throw FileSystemError.system(
      'Failed to get file handle',
      path,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * ディレクトリハンドルを取得
 * @param root - ルートディレクトリハンドル
 * @param path - ディレクトリパス
 * @param options - オプション
 */
export async function getDirectoryHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  options: { create?: boolean } = {}
): Promise<FileSystemDirectoryHandle> {
  try {
    if (pathUtils.isRoot(path)) return root;

    const segments = pathUtils.split(path);
    let currentDir = root;

    for (const segment of segments) {
      currentDir = await currentDir.getDirectoryHandle(segment, options);
    }

    return currentDir;
  } catch (error) {
    if (error instanceof FileSystemError) throw error;
    
    if (error instanceof Error && error.name === 'NotFoundError') {
      throw FileSystemError.notFound(path);
    }
    
    throw FileSystemError.system(
      'Failed to get directory handle',
      path,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * ファイルの内容を文字列として読み取り
 * @param handle - ファイルハンドル
 */
export async function readFileContent(handle: FileSystemFileHandle): Promise<string> {
  try {
    const file = await handle.getFile();
    return file.text();
  } catch (error) {
    throw FileSystemError.system(
      'Failed to read file content',
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * ファイルの内容をバイナリとして読み取り
 * @param handle - ファイルハンドル
 */
export async function readFileBinary(handle: FileSystemFileHandle): Promise<Uint8Array> {
  try {
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw FileSystemError.system(
      'Failed to read file binary',
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * ファイルに内容を書き込み
 * @param handle - ファイルハンドル
 * @param content - 書き込む内容
 */
export async function writeFileContent(
  handle: FileSystemFileHandle,
  content: FileContent
): Promise<void> {
  try {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    throw FileSystemError.system(
      'Failed to write file content',
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * ファイルシステムのエラーをハンドリング
 * @param error - 発生したエラー
 * @param path - エラーが発生したパス
 */
export function handleFileSystemError(error: unknown, path?: string): never {
  if (error instanceof FileSystemError) throw error;

  if (error instanceof Error) {
    switch (error.name) {
      case 'NotFoundError':
        throw FileSystemError.notFound(path ?? '');
      case 'NotAllowedError':
        throw FileSystemError.permissionDenied(path ?? '');
      case 'QuotaExceededError':
        throw FileSystemError.quotaExceeded(path ?? '');
      case 'TypeError':
        throw FileSystemError.invalidPath(path ?? '');
      default:
        throw FileSystemError.system(error.message, path, error);
    }
  }

  throw FileSystemError.system('Unknown error occurred', path);
}
