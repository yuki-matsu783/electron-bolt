/**
 * アプリケーションの暗号化機能を提供するモジュール
 * AES-CBCを使用した安全なデータの暗号化/復号化を実装
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IV_LENGTH = 16; // 初期化ベクトル(IV)の長さ

/**
 * データを暗号化する
 * - ランダムなIVを生成
 * - AES-CBCで暗号化
 * - 暗号文とIVを結合してBase64エンコード
 * 
 * @param key 暗号化キー
 * @param data 暗号化するデータ
 * @returns Base64エンコードされた暗号文
 */
export async function encrypt(key: string, data: string) {
  // ランダムなIVを生成
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await getKey(key);

  // AES-CBCで暗号化
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    cryptoKey,
    encoder.encode(data),
  );

  // 暗号文とIVを結合
  const bundle = new Uint8Array(IV_LENGTH + ciphertext.byteLength);

  bundle.set(new Uint8Array(ciphertext));
  bundle.set(iv, ciphertext.byteLength);

  return decodeBase64(bundle);
}

/**
 * 暗号化されたデータを復号する
 * - Base64デコード
 * - IVと暗号文を分離
 * - AES-CBCで復号
 * 
 * @param key 復号キー
 * @param payload Base64エンコードされた暗号文
 * @returns 復号されたデータ
 */
export async function decrypt(key: string, payload: string) {
  const bundle = encodeBase64(payload);

  // IVと暗号文を分離
  const iv = new Uint8Array(bundle.buffer, bundle.byteLength - IV_LENGTH);
  const ciphertext = new Uint8Array(bundle.buffer, 0, bundle.byteLength - IV_LENGTH);

  const cryptoKey = await getKey(key);

  // AES-CBCで復号
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    cryptoKey,
    ciphertext,
  );

  return decoder.decode(plaintext);
}

/**
 * 文字列からAES-CBC用の暗号化キーを生成
 * @param key キー文字列
 * @returns CryptoKeyオブジェクト
 */
async function getKey(key: string) {
  return await crypto.subtle.importKey('raw', encodeBase64(key), { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
}

/**
 * Uint8ArrayをBase64文字列にデコード
 */
function decodeBase64(encoded: Uint8Array) {
  const byteChars = Array.from(encoded, (byte) => String.fromCodePoint(byte));

  return btoa(byteChars.join(''));
}

/**
 * Base64文字列をUint8Arrayにエンコード
 */
function encodeBase64(data: string) {
  return Uint8Array.from(atob(data), (ch) => ch.codePointAt(0)!);
}
