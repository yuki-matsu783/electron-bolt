/**
 * パス操作のためのユーティリティ関数群
 */

/**
 * パスのセパレータ
 */
const PATH_SEPARATOR = '/';

/**
 * パスを正規化する
 * - 重複するセパレータを削除
 * - 先頭と末尾のセパレータを削除
 * @param path - 正規化するパス
 * @returns 正規化されたパス
 */
function normalize(path: string): string {
  return path
    .replace(/\/+/g, PATH_SEPARATOR) // 重複するセパレータを単一のセパレータに
    .replace(/^\//, '') // 先頭のセパレータを削除
    .replace(/\/$/, ''); // 末尾のセパレータを削除
}

/**
 * 複数のパスを結合する
 * @param paths - 結合するパスの配列
 * @returns 結合されたパス
 */
function join(...paths: string[]): string {
  return normalize(paths.join(PATH_SEPARATOR));
}

/**
 * パスからディレクトリ部分を取得
 * @param path - パス
 * @returns ディレクトリパス
 */
function dirname(path: string): string {
  const normalized = normalize(path);
  const lastSeparatorIndex = normalized.lastIndexOf(PATH_SEPARATOR);
  return lastSeparatorIndex === -1 ? '' : normalized.slice(0, lastSeparatorIndex);
}

/**
 * パスからファイル名を取得
 * @param path - パス
 * @returns ファイル名
 */
function basename(path: string): string {
  const normalized = normalize(path);
  const lastSeparatorIndex = normalized.lastIndexOf(PATH_SEPARATOR);
  return lastSeparatorIndex === -1 ? normalized : normalized.slice(lastSeparatorIndex + 1);
}

/**
 * パスが相対パスかどうかを判定
 * @param path - 判定するパス
 * @returns 相対パスの場合はtrue
 */
function isRelative(path: string): boolean {
  return !path.startsWith(PATH_SEPARATOR);
}

/**
 * パスがルートパスかどうかを判定
 * @param path - 判定するパス
 * @returns ルートパスの場合はtrue
 */
function isRoot(path: string): boolean {
  return normalize(path) === '';
}

/**
 * パスが有効なパスかどうかを判定
 * @param path - 判定するパス
 * @returns 有効なパスの場合はtrue
 */
function isValid(path: string): boolean {
  // パスに使用できない文字が含まれていないかチェック
  return !path.includes('..');
}

/**
 * パスの深さを取得
 * @param path - パス
 * @returns パスの深さ（ディレクトリの階層数）
 */
function depth(path: string): number {
  const normalized = normalize(path);
  return normalized === '' ? 0 : normalized.split(PATH_SEPARATOR).length;
}

/**
 * 相対パスを絶対パスに変換
 * @param base - ベースとなるパス
 * @param relative - 相対パス
 * @returns 絶対パス
 */
function resolve(base: string, relative: string): string {
  if (!isRelative(relative)) {
    return normalize(relative);
  }
  return join(base, relative);
}

/**
 * パスをセグメントに分割
 * @param path - パス
 * @returns パスセグメントの配列
 */
function split(path: string): string[] {
  const normalized = normalize(path);
  return normalized === '' ? [] : normalized.split(PATH_SEPARATOR);
}

/**
 * パスのユーティリティ関数をエクスポート
 */
export const pathUtils = {
  normalize,
  join,
  dirname,
  basename,
  isRelative,
  isRoot,
  isValid,
  depth,
  resolve,
  split,
  SEPARATOR: PATH_SEPARATOR,
};
