/**
 * ファイルシステムの基本的な型定義
 */

/**
 * ファイル情報を表す型
 */
export interface FileInfo {
  /** ファイル名 */
  name: string;
  /** ファイルパス */
  path: string;
  /** ファイルタイプ（ファイルまたはディレクトリ） */
  type: 'file' | 'directory';
  /** ファイルサイズ（バイト） */
  size?: number;
  /** 最終更新日時 */
  modified?: number;
  /** 作成日時 */
  created?: number;
}

/**
 * ファイルシステムが提供する機能を表す型
 */
export interface FileSystemCapabilities {
  /** ファイルの作成がサポートされているか */
  canCreateFiles: boolean;
  /** ディレクトリの作成がサポートされているか */
  canCreateDirectories: boolean;
  /** ファイルの削除がサポートされているか */
  canDelete: boolean;
  /** ファイルの移動がサポートされているか */
  canMove: boolean;
  /** ファイルのコピーがサポートされているか */
  canCopy: boolean;
  /** 最大ファイルサイズ（バイト） */
  maxFileSize?: number;
  /** 利用可能な空き容量（バイト） */
  availableSpace?: number;
  /** データの永続化がサポートされているか */
  persistenceSupported?: boolean;
  /** ストリーミング操作がサポートされているか */
  streamingSupported?: boolean;
  /** バイナリデータの操作がサポートされているか */
  binarySupported?: boolean;
}

/**
 * ファイルパスを表す型
 */
export type FilePath = string;

/**
 * ファイルの内容を表す型
 */
export type FileContent = string | Uint8Array;

export type FileSystemEventType = 'create' | 'update' | 'delete';

export interface FileSystemChangeEvent {
  type: FileSystemEventType;
  path: string;
  content?: FileContent;
}

export interface FileSystemWatchOptions {
  recursive?: boolean;
}

/**
 * ディレクトリ読み取りオプション
 */
export interface ReadDirectoryOptions {
  /** 再帰的に読み取るかどうか */
  recursive?: boolean;
  /** 除外するファイルパターン */
  exclude?: string[];
  /** 
   * 含めるファイルパターン
   * 文字列の場合はglobパターン、RegExpの場合は正規表現として扱う
   */
  pattern?: string | RegExp;
}

/**
 * ファイルシステム操作のエラー型
 */
export interface FileSystemError extends Error {
  /** エラーコード */
  code: string;
  /** エラーが発生したファイルパス */
  path?: string;
}

/**
 * ファイル操作オプション
 */
export interface FileOperationOptions {
  /** 再帰的な操作を行うかどうか */
  recursive?: boolean;
  /** 既存のファイルを上書きするかどうか */
  overwrite?: boolean;
}
