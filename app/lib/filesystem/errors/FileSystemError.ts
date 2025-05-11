/**
 * ファイルシステム操作に関するエラーを表すクラス
 */
export class FileSystemError extends Error {
  /**
   * FileSystemErrorを作成
   * @param message - エラーメッセージ
   * @param code - エラーコード
   * @param path - エラーが発生したファイルパス
   * @param cause - 元となったエラー
   */
  constructor(
    message: string,
    public readonly code: string = 'UNKNOWN_ERROR',
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileSystemError';

    // causeがErrorインスタンスの場合、スタックトレースを保持
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  /**
   * ファイルが存在しない場合のエラーを作成
   * @param path - ファイルパス
   */
  static notFound(path: string): FileSystemError {
    return new FileSystemError(
      `File or directory not found: ${path}`,
      'NOT_FOUND',
      path
    );
  }

  /**
   * アクセス権限がない場合のエラーを作成
   * @param path - ファイルパス
   */
  static permissionDenied(path: string): FileSystemError {
    return new FileSystemError(
      `Permission denied: ${path}`,
      'PERMISSION_DENIED',
      path
    );
  }

  /**
   * ファイルが既に存在する場合のエラーを作成
   * @param path - ファイルパス
   */
  static alreadyExists(path: string): FileSystemError {
    return new FileSystemError(
      `File or directory already exists: ${path}`,
      'ALREADY_EXISTS',
      path
    );
  }

  /**
   * ディレクトリが空でない場合のエラーを作成
   * @param path - ディレクトリパス
   */
  static directoryNotEmpty(path: string): FileSystemError {
    return new FileSystemError(
      `Directory not empty: ${path}`,
      'DIRECTORY_NOT_EMPTY',
      path
    );
  }

  /**
   * 無効なパスの場合のエラーを作成
   * @param path - 無効なパス
   */
  static invalidPath(path: string): FileSystemError {
    return new FileSystemError(
      `Invalid path: ${path}`,
      'INVALID_PATH',
      path
    );
  }

  /**
   * ストレージの容量が不足している場合のエラーを作成
   * @param path - ファイルパス
   * @param available - 利用可能な容量（バイト）
   * @param required - 必要な容量（バイト）
   */
  static quotaExceeded(path: string, available?: number, required?: number): FileSystemError {
    const detail = available && required
      ? ` (available: ${available} bytes, required: ${required} bytes)`
      : '';

    return new FileSystemError(
      `Storage quota exceeded${detail}`,
      'QUOTA_EXCEEDED',
      path
    );
  }

  /**
   * ファイルシステムが初期化されていない場合のエラーを作成
   */
  static notInitialized(): FileSystemError {
    return new FileSystemError(
      'File system not initialized',
      'NOT_INITIALIZED'
    );
  }

  /**
   * その他のファイルシステムエラーを作成
   * @param message - エラーメッセージ
   * @param path - ファイルパス
   * @param cause - 元となったエラー
   */
  static system(message: string, path?: string, cause?: Error): FileSystemError {
    return new FileSystemError(
      message,
      'FILESYSTEM_ERROR',
      path,
      cause
    );
  }
}
