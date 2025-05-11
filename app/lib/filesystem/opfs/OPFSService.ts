import type {
  FileContent,
  FileInfo,
  FileOperationOptions,
  FileSystemCapabilities,
  FilePath,
  ReadDirectoryOptions,
} from '../interfaces/types';
import type { FileSystemService } from '../interfaces/FileSystemService';
import { FileSystemError } from '../errors/FileSystemError';
import { pathUtils } from './utils/path';
import * as opfsUtils from './utils/opfs';

/**
 * Origin Private File System (OPFS)を使用したファイルシステムサービスの実装
 */
export class OPFSService implements FileSystemService {
  private root: FileSystemDirectoryHandle | null = null;

  /**
   * ファイルシステムの初期化
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
      // SSRの場合は何もしない
      return;
    }

    try {
      this.root = await navigator.storage.getDirectory();
      // 読み書き権限を確認
      await opfsUtils.requestPermission(this.root, 'readwrite');
    } catch (error) {
      throw new FileSystemError(
        'Failed to initialize OPFS',
        'FILESYSTEM_ERROR',
        '/',
        error instanceof Error ? error : undefined
      );
    }
  }

  private ensureClient() {
    if (typeof window === 'undefined') {
      throw new FileSystemError(
        'OPFS is only available in browser environment',
        'ENVIRONMENT_ERROR',
        '/'
      );
    }
  }

  /**
   * ファイルシステムのケーパビリティを取得
   */
  async getCapabilities(): Promise<FileSystemCapabilities> {
    this.ensureClient();
    const estimate = await navigator.storage.estimate();
    
    return {
      // 基本的な操作のサポート
      canCreateFiles: true,
      canCreateDirectories: true,
      canDelete: true,
      canMove: true,
      canCopy: true,
      // 拡張機能のサポート
      maxFileSize: undefined, // OPFSには明示的な制限がない
      availableSpace: estimate.quota ? estimate.quota - (estimate.usage || 0) : undefined,
      persistenceSupported: true,
      streamingSupported: true,
      binarySupported: true,
    };
  }

  /**
   * ファイルの作成
   */
  async createFile(path: FilePath, content: FileContent, options?: FileOperationOptions): Promise<void> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const fileHandle = await opfsUtils.getFileHandle(this.root, path, { create: true });
      await opfsUtils.writeFileContent(fileHandle, content);
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ファイルの読み取り
   */
  async readFile(path: FilePath, options?: { binary?: boolean }): Promise<FileContent> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const fileHandle = await opfsUtils.getFileHandle(this.root, path);
      return options?.binary
        ? await opfsUtils.readFileBinary(fileHandle)
        : await opfsUtils.readFileContent(fileHandle);
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ファイルの書き込み
   */
  async writeFile(path: FilePath, content: FileContent, options?: FileOperationOptions): Promise<void> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const fileHandle = await opfsUtils.getFileHandle(this.root, path, { create: true });
      await opfsUtils.writeFileContent(fileHandle, content);
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ファイルの削除
   */
  async deleteFile(path: FilePath): Promise<void> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const dirPath = pathUtils.dirname(path);
      const fileName = pathUtils.basename(path);
      const dirHandle = await opfsUtils.getDirectoryHandle(this.root, dirPath);
      await dirHandle.removeEntry(fileName);
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ファイルまたはディレクトリの存在確認
   */
  async exists(path: FilePath): Promise<boolean> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const dirPath = pathUtils.dirname(path);
      const name = pathUtils.basename(path);
      const dirHandle = await opfsUtils.getDirectoryHandle(this.root, dirPath);
      
      try {
        await dirHandle.getFileHandle(name);
        return true;
      } catch {
        try {
          await dirHandle.getDirectoryHandle(name);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * ディレクトリの作成
   */
  async createDirectory(path: FilePath, options?: FileOperationOptions): Promise<void> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      await opfsUtils.getDirectoryHandle(this.root, path, { create: true });
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ディレクトリの読み取り
   */
  async readDirectory(path: FilePath, options?: ReadDirectoryOptions): Promise<FileInfo[]> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const dirHandle = await opfsUtils.getDirectoryHandle(this.root, path);
      const entries: FileInfo[] = [];

      for await (const [name, entry] of dirHandle.entries()) {
        if (options?.pattern && !name.match(options.pattern)) {
          continue;
        }

        const entryPath = pathUtils.join(path, name);
        const info: FileInfo = {
          name,
          path: entryPath,
          type: entry.kind,
        };

        if (entry.kind === 'file') {
          const file = await (entry as FileSystemFileHandle).getFile();
          info.size = file.size;
          info.modified = file.lastModified;
        }

        entries.push(info);

        if (options?.recursive && entry.kind === 'directory') {
          const subEntries = await this.readDirectory(entryPath, options);
          entries.push(...subEntries);
        }
      }

      return entries;
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ディレクトリの削除
   */
  async deleteDirectory(path: FilePath, options?: FileOperationOptions): Promise<void> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      if (pathUtils.isRoot(path)) {
        throw new FileSystemError('Cannot delete root directory', 'PERMISSION_DENIED', path);
      }

      const dirPath = pathUtils.dirname(path);
      const dirName = pathUtils.basename(path);
      const parentDir = await opfsUtils.getDirectoryHandle(this.root, dirPath);
      await parentDir.removeEntry(dirName, { recursive: options?.recursive });
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ファイルまたはディレクトリの情報取得
   */
  async getFileInfo(path: FilePath): Promise<FileInfo> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const parentPath = pathUtils.dirname(path);
      const name = pathUtils.basename(path);
      const parentDirHandle = await opfsUtils.getDirectoryHandle(this.root, parentPath);

      try {
        // まずファイルとして試す
        const fileHandle = await parentDirHandle.getFileHandle(name);
        const file = await fileHandle.getFile();
        return {
          name,
          path,
          type: 'file',
          size: file.size,
          modified: file.lastModified,
        };
      } catch {
        // ディレクトリとして試す
        const childDirHandle = await parentDirHandle.getDirectoryHandle(name);
        return {
          name,
          path,
          type: 'directory',
        };
      }
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ファイルまたはディレクトリのコピー
   */
  async copy(sourcePath: FilePath, destinationPath: FilePath, options?: FileOperationOptions): Promise<void> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const sourceInfo = await this.getFileInfo(sourcePath);

      if (sourceInfo.type === 'file') {
        const content = await this.readFile(sourcePath, { binary: true });
        await this.writeFile(destinationPath, content, options);
      } else {
        await this.createDirectory(destinationPath, options);
        const entries = await this.readDirectory(sourcePath);
        
        for (const entry of entries) {
          const relativeDestPath = pathUtils.join(
            destinationPath,
            entry.path.slice(sourcePath.length + 1)
          );
          await this.copy(entry.path, relativeDestPath, options);
        }
      }
    } catch (error) {
      opfsUtils.handleFileSystemError(error, sourcePath);
    }
  }

  /**
   * ファイルまたはディレクトリの移動
   */
  async move(sourcePath: FilePath, destinationPath: FilePath, options?: FileOperationOptions): Promise<void> {
    await this.copy(sourcePath, destinationPath, options);
    await this.deleteFile(sourcePath).catch(() => this.deleteDirectory(sourcePath, options));
  }

  /**
   * WritableStreamの作成
   */
  async createWriteStream(path: FilePath, options?: FileOperationOptions): Promise<WritableStream> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const fileHandle = await opfsUtils.getFileHandle(this.root, path, { create: true });
      return await fileHandle.createWritable();
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * ReadableStreamの作成
   */
  async createReadStream(path: FilePath): Promise<ReadableStream> {
    this.ensureClient();
    if (!this.root) throw new Error('FileSystem not initialized');

    try {
      const fileHandle = await opfsUtils.getFileHandle(this.root, path);
      const file = await fileHandle.getFile();
      return file.stream();
    } catch (error) {
      opfsUtils.handleFileSystemError(error, path);
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    // OPFSの場合、特別なクリーンアップは不要
    this.root = null;
  }

  /**
   * ファイルシステムの変更を監視
   * 注: OPFSでは実際の変更監視は行わず、インターフェースを満たすためのダミー実装を提供
   */
  watch(_path: FilePath, _callback: (event: any) => void, _options?: any): () => void {
    // ダミーのクリーンアップ関数を返す
    return () => {};
  }
}
