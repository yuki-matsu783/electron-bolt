/**
 * システムプロセス情報を提供するAPI
 * - プロセス一覧の取得
 * - リソース使用状況の監視
 * - モック環境のサポート
 */

import type { ActionFunctionArgs, LoaderFunction } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

// Node.js環境でのみchild_processをインポート
let execSync: any;
try {
  if (typeof process !== 'undefined' && process.platform) {
    const childProcess = { execSync: null };
    execSync = childProcess.execSync;
  }
} catch {
  console.log('Cloudflare環境で実行中、child_processは利用不可');
}

// 開発環境では必要に応じてモックデータを提供
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * プロセス情報のインターフェース
 */
interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command: string;
  timestamp: number;
}

/**
 * システムのプロセス情報を取得
 * - プラットフォームに応じて適切なコマンドを実行
 * - CPUコア数を考慮
 * @returns プロセス情報の配列
 */
const getProcessInfo = (): ProcessInfo[] => {
  try {
    // Cloudflare環境で開発モードでない場合はエラー
    if (!execSync && !isDevelopment) {
      throw new Error('プロセス情報の取得は非対応の環境です');
    }

    const timestamp = Date.now();
    let cpuCount = 1;

    // CPUコア数を取得
    try {
      const platform = process.platform;
      if (platform === 'linux') {
        const cpuInfo = execSync('nproc', { encoding: 'utf-8' }).toString().trim();
        cpuCount = parseInt(cpuInfo, 10) || 1;
      } else if (platform === 'darwin') {
        const cpuInfo = execSync('sysctl -n hw.ncpu', { encoding: 'utf-8' }).toString().trim();
        cpuCount = parseInt(cpuInfo, 10) || 1;
      } else if (platform === 'win32') {
        const cpuInfo = execSync('wmic cpu get NumberOfCores', { encoding: 'utf-8' }).toString().trim();
        const match = cpuInfo.match(/\d+/);
        cpuCount = match ? parseInt(match[0], 10) : 1;
      }
    } catch (error) {
      console.error('CPU数の取得に失敗:', error);
      cpuCount = 1;
    }

    // プラットフォーム別のプロセス情報取得
    if (process.platform === 'darwin') {
      // macOS - psコマンドでプロセス情報を取得
      const output = execSync('ps -eo pid,pcpu,pmem,comm -r | head -n 11', { encoding: 'utf-8' })
        .toString()
        .trim();

      // ヘッダー行をスキップ
      const lines = output.split('\n').slice(1);

      return lines.map((line: string) => {
        const [pid, cpu, memory, ...commandParts] = line.trim().split(/\s+/);
        const command = commandParts.join(' ');
        const name = command.split('/').pop() || '';

        return {
          pid: parseInt(pid, 10),
          name,
          cpu: parseFloat(cpu) / cpuCount,
          memory: parseFloat(memory),
          command,
          timestamp,
        };
      });
    } else if (process.platform === 'linux') {
      // Linux - topコマンドでプロセス情報を取得
      const output = execSync('top -b -n 1 | head -n 17', { encoding: 'utf-8' }).toString().trim();
      const lines = output.split('\n').slice(7);

      return lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[0], 10);
        const cpu = parseFloat(parts[8]) / cpuCount;
        const memory = parseFloat(parts[9]);
        const command = parts.slice(11).join(' ');
        const name = command.split('/').pop() || '';

        return {
          pid,
          name,
          cpu,
          memory,
          command,
          timestamp,
        };
      });
    } else if (process.platform === 'win32') {
      // Windows - wmicコマンドでプロセス情報を取得
      const output = execSync('wmic process get ProcessId,Name,CommandLine /format:csv', {
        encoding: 'utf-8',
      })
        .toString()
        .trim();

      const lines = output.split('\n').slice(2);
      return lines
        .filter((line) => line.trim())
        .map((line) => {
          const [, name, commandLine, pidStr] = line.split(',');
          const pid = parseInt(pidStr, 10);

          return {
            pid,
            name: name || '',
            cpu: Math.random() * 10, // WindowsではリアルタイムのCPU使用率取得が困難
            memory: Math.random() * 20,
            command: commandLine || '',
            timestamp,
          };
        });
    }

    // サポート外のプラットフォームの場合はモックデータを返す
    return getMockProcessInfo();
  } catch (error) {
    console.error('プロセス情報の取得に失敗:', error);
    return getMockProcessInfo();
  }
};

/**
 * モックプロセス情報を生成
 * - 開発・テスト環境用
 * - リアルなプロセス情報を模倣
 */
const getMockProcessInfo = (): ProcessInfo[] => {
  const timestamp = Date.now();
  
  // ランダムな値を生成するヘルパー関数
  const randomCPU = () => Math.random() * 5;
  const randomHighCPU = () => 5 + Math.random() * 15;
  const randomMem = () => Math.random() * 10;
  const randomHighMem = () => 10 + Math.random() * 20;

  // 一般的なプロセスのモックデータを返す
  return [
    {
      pid: 1,
      name: 'system',
      cpu: randomCPU(),
      memory: randomHighMem(),
      command: 'System Process',
      timestamp,
    },
    {
      pid: 2,
      name: 'vscode',
      cpu: randomHighCPU(),
      memory: randomHighMem(),
      command: 'VS Code',
      timestamp,
    },
    // ...他のモックプロセス
  ];
};

/**
 * GETリクエストのハンドラー
 */
export const loader: LoaderFunction = async ({ request: _request }) => {
  try {
    return json(getProcessInfo());
  } catch (error) {
    console.error('プロセス情報の取得に失敗:', error);
    return json(getMockProcessInfo(), { status: 500 });
  }
};

/**
 * POSTリクエストのハンドラー
 */
export const action = async ({ request: _request }: ActionFunctionArgs) => {
  try {
    return json(getProcessInfo());
  } catch (error) {
    console.error('プロセス情報の取得に失敗:', error);
    return json(getMockProcessInfo(), { status: 500 });
  }
};
