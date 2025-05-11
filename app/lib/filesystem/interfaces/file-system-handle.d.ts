/**
 * Origin Private File System (OPFS) API の型定義
 */

/**
 * ファイルシステムのハンドルの種類
 */
type FileSystemHandleKind = 'file' | 'directory';

/**
 * パーミッションの状態
 */
type PermissionState = 'granted' | 'denied' | 'prompt';

/**
 * パーミッションのモード
 */
type PermissionMode = 'read' | 'readwrite';

/**
 * パーミッションのオプション
 */
interface FileSystemPermissionDescriptor {
  mode?: PermissionMode;
}

/**
 * ファイルシステムのハンドルの基本インターフェース
 */
interface FileSystemHandle {
  readonly kind: FileSystemHandleKind;
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

/**
 * ファイルハンドルのインターフェース
 */
interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

/**
 * ディレクトリハンドルのインターフェース
 */
interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  keys(): AsyncIterableIterator<string>;
}

/**
 * Writableストリームのオプション
 */
interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

/**
 * ファイル取得オプション
 */
interface FileSystemGetFileOptions {
  create?: boolean;
}

/**
 * ディレクトリ取得オプション
 */
interface FileSystemGetDirectoryOptions {
  create?: boolean;
}

/**
 * エントリ削除オプション
 */
interface FileSystemRemoveOptions {
  recursive?: boolean;
}

/**
 * WritableFileStreamのインターフェース
 */
interface FileSystemWritableFileStream extends WritableStream {
  write(data: FileSystemWriteChunkType): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

/**
 * 書き込み可能なチャンクの型
 */
type FileSystemWriteChunkType =
  | string
  | BufferSource
  | Blob
  | WriteParams;

/**
 * 書き込みパラメータ
 */
interface WriteParams {
  type: 'write' | 'seek' | 'truncate';
  position?: number;
  data?: BufferSource | Blob | string;
  size?: number;
}

/**
 * グローバルなnavigator.storageプロパティの型拡張
 */
interface StorageManager {
  getDirectory(): Promise<FileSystemDirectoryHandle>;
  estimate(): Promise<StorageEstimate>;
}

/**
 * ストレージの見積もり情報
 */
interface StorageEstimate {
  quota?: number;
  usage?: number;
}
