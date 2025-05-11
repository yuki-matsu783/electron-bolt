import type { 
  FileInfo, 
  FileOperationOptions, 
  FileContent, 
  FilePath, 
  ReadDirectoryOptions, 
  FileSystemCapabilities,
  FileSystemChangeEvent,
  FileSystemWatchOptions
} from './types';

/**
 * ファイルシステム操作のインターフェース
 * このインターフェースは、OPFSやその他のファイルシステム実装の基本となります。
 */
export interface FileSystemService {
  /**
   * ファイルシステムの初期化
   * @throws FileSystemError - 初期化に失敗した場合
   */
  initialize(): Promise<void>;

  /**
   * ファイルシステムの機能を取得
   * @returns ファイルシステムの機能情報
   */
  getCapabilities(): Promise<FileSystemCapabilities>;

  /**
   * 新規ファイルを作成
   * @param path - ファイルパス
   * @param content - ファイルの内容（文字列またはバイナリ）
   * @param options - ファイル作成オプション
   * @throws FileSystemError - ファイルの作成に失敗した場合
   */
  createFile(path: FilePath, content: FileContent, options?: FileOperationOptions): Promise<void>;

  /**
   * ファイルの読み取り
   * @param path - ファイルパス
   * @param options - 読み取りオプション
   * @returns ファイルの内容（文字列またはバイナリ）
   * @throws FileSystemError - ファイルが存在しないか、読み取りに失敗した場合
   */
  readFile(path: FilePath, options?: { binary?: boolean }): Promise<FileContent>;

  /**
   * ファイルの書き込み（既存のファイルを上書き）
   * @param path - ファイルパス
   * @param content - 書き込む内容（文字列またはバイナリ）
   * @param options - 書き込みオプション
   * @throws FileSystemError - 書き込みに失敗した場合
   */
  writeFile(path: FilePath, content: FileContent, options?: FileOperationOptions): Promise<void>;

  /**
   * ファイルの削除
   * @param path - ファイルパス
   * @throws FileSystemError - 削除に失敗した場合
   */
  deleteFile(path: FilePath): Promise<void>;

  /**
   * ファイルまたはディレクトリの存在確認
   * @param path - パス
   * @returns 存在する場合はtrue
   */
  exists(path: FilePath): Promise<boolean>;

  /**
   * ディレクトリの作成
   * @param path - ディレクトリパス
   * @param options - 作成オプション
   * @throws FileSystemError - ディレクトリの作成に失敗した場合
   */
  createDirectory(path: FilePath, options?: FileOperationOptions): Promise<void>;

  /**
   * ディレクトリ内のファイル一覧取得
   * @param path - ディレクトリパス
   * @param options - 読み取りオプション
   * @returns ファイル情報の配列
   * @throws FileSystemError - ディレクトリが存在しないか、読み取りに失敗した場合
   */
  readDirectory(path: FilePath, options?: ReadDirectoryOptions): Promise<FileInfo[]>;

  /**
   * ディレクトリの削除
   * @param path - ディレクトリパス
   * @param options - 削除オプション
   * @throws FileSystemError - 削除に失敗した場合
   */
  deleteDirectory(path: FilePath, options?: FileOperationOptions): Promise<void>;

  /**
   * ファイル情報の取得
   * @param path - ファイルパス
   * @returns ファイル情報
   * @throws FileSystemError - ファイルが存在しないか、情報取得に失敗した場合
   */
  getFileInfo(path: FilePath): Promise<FileInfo>;

  /**
   * ファイルまたはディレクトリのコピー
   * @param source - コピー元パス
   * @param destination - コピー先パス
   * @param options - コピーオプション
   * @throws FileSystemError - コピーに失敗した場合
   */
  copy(source: FilePath, destination: FilePath, options?: FileOperationOptions): Promise<void>;

  /**
   * ファイルまたはディレクトリの移動
   * @param source - 移動元パス
   * @param destination - 移動先パス
   * @param options - 移動オプション
   * @throws FileSystemError - 移動に失敗した場合
   */
  move(source: FilePath, destination: FilePath, options?: FileOperationOptions): Promise<void>;

  /**
   * ファイルへの書き込みストリームを作成
   * @param path - ファイルパス
   * @param options - 書き込みオプション
   * @returns 書き込みストリーム
   * @throws FileSystemError - ストリームの作成に失敗した場合
   */
  createWriteStream(path: FilePath, options?: FileOperationOptions): Promise<WritableStream>;

  /**
   * ファイルからの読み取りストリームを作成
   * @param path - ファイルパス
   * @returns 読み取りストリーム
   * @throws FileSystemError - ストリームの作成に失敗した場合
   */
  createReadStream(path: FilePath): Promise<ReadableStream>;

  /**
   * ファイルシステムのクリーンアップ
   * 一時的なリソースの解放やキャッシュのクリアなどを行う
   * @throws FileSystemError - クリーンアップに失敗した場合
   */
  cleanup(): Promise<void>;

  /**
   * ファイルシステムの変更を監視
   * @param path - 監視対象のパス
   * @param callback - 変更が検出された時に呼び出されるコールバック
   * @param options - 監視オプション
   * @returns クリーンアップ用の関数
   */
  watch(path: FilePath, callback: (event: FileSystemChangeEvent) => void, options?: FileSystemWatchOptions): () => void;
}
