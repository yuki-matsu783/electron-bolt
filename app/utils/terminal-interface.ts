import type { WebContainer } from '@webcontainer/api';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('TerminalInterface');

// Terminal interface for executing commands
export interface TerminalInterface {
  /**
   * Execute a command in the terminal
   * @param command The command to execute
   * @param options Options for command execution
   * @returns Promise with the result of the command execution
   */
  exec(command: string, options?: {
    /** The current working directory */
    cwd?: string;
    /** Environment variables to pass to the command */
    env?: Record<string, string>;
    /** Whether to output to stderr and stdout */
    output?: boolean;
  }): Promise<{ 
    /** The exit code of the process */
    exitCode: number;
    /** The output of the command */
    stdout: string;
    /** The error output of the command */
    stderr: string;
  }>;

  /**
   * Spawn an interactive terminal session
   * @param options Options for the terminal session
   * @returns A terminal session object
   */
  spawn(options?: {
    /** The current working directory */
    cwd?: string;
    /** Environment variables to pass to the process */
    env?: Record<string, string>;
  }): Promise<TerminalSession>;
}

export interface TerminalSession {
  /** The terminal instance ID */
  id: string;
  
  /** Write data to the terminal */
  write(data: string): Promise<void>;
  
  /** Close the terminal session */
  kill(): Promise<void>;
  
  /** Add event listener for terminal output */
  onData(callback: (data: string) => void): void;
  
  /** Add event listener for terminal exit */
  onExit(callback: (code: number) => void): void;
  
  /** Remove all event listeners */
  removeAllListeners(): void;
}

// WebContainer implementation of the terminal interface
export class WebContainerTerminal implements TerminalInterface {
  private webcontainer: WebContainer;
  
  constructor(webcontainer: WebContainer) {
    this.webcontainer = webcontainer;
  }
  
  async exec(command: string, options?: {
    cwd?: string;
    env?: Record<string, string>;
    output?: boolean;
  }): Promise<{ exitCode: number; stdout: string; stderr: string; }> {
    try {
      logger.debug(`Executing command: ${command}`);
      
      // Parse the command into parts
      const [cmd, ...args] = command.split(' ').filter(Boolean);
      
      // Execute the command in the WebContainer
      return await this.webcontainer.spawn(cmd, args, {
        cwd: options?.cwd,
        env: options?.env,
        output: options?.output
      });
    } catch (error) {
      logger.error(`Failed to execute command: ${command}`, error);
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Error executing command: ${command}\n${error}`
      };
    }
  }
  
  async spawn(options?: {
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<TerminalSession> {
    logger.debug('Spawning terminal session with WebContainer');
    
    // Use WebContainer's shell - typically /bin/sh
    const process = await this.webcontainer.spawn('sh', [], {
      cwd: options?.cwd,
      env: options?.env,
      terminal: {
        cols: 80,
        rows: 30
      }
    });
    
    const sessionId = `terminal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      id: sessionId,
      
      async write(data: string): Promise<void> {
        return process.input.write(data);
      },
      
      async kill(): Promise<void> {
        return process.kill();
      },
      
      onData(callback: (data: string) => void): void {
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              callback(data);
            }
          })
        );
      },
      
      onExit(callback: (code: number) => void): void {
        process.exit.then(callback);
      },
      
      removeAllListeners(): void {
        // No explicit cleanup needed for WebContainer terminal
      }
    };
  }
}

// Mock implementation for OPFS (when running in environments without WebContainer)
export class MockTerminal implements TerminalInterface {
  async exec(command: string, options?: {
    cwd?: string;
    env?: Record<string, string>;
    output?: boolean;
  }): Promise<{ exitCode: number; stdout: string; stderr: string; }> {
    logger.debug(`Mock executing command: ${command}`);
    
    // Return mock responses based on common commands
    if (command.startsWith('ls') || command.startsWith('dir')) {
      return {
        exitCode: 0,
        stdout: 'file1.js\nfile2.js\ndirectory1/\n',
        stderr: ''
      };
    } else if (command.startsWith('pwd')) {
      return {
        exitCode: 0,
        stdout: options?.cwd || '/workspace',
        stderr: ''
      };
    } else if (command.startsWith('echo')) {
      const echoContent = command.substring(5);
      return {
        exitCode: 0,
        stdout: echoContent + '\n',
        stderr: ''
      };
    } else if (command.startsWith('npm') || command.startsWith('yarn') || command.startsWith('pnpm')) {
      // Simulate package manager commands
      if (command.includes('install')) {
        return {
          exitCode: 0,
          stdout: 'Installing packages...\nDone\n',
          stderr: ''
        };
      } else if (command.includes('run')) {
        return {
          exitCode: 0,
          stdout: 'Running script...\nServer started at http://localhost:3000\n',
          stderr: ''
        };
      }
    } else if (command.startsWith('git')) {
      return {
        exitCode: 0,
        stdout: 'Git operation simulated\n',
        stderr: ''
      };
    }
    
    // Default response for unrecognized commands
    return {
      exitCode: 0,
      stdout: `Mock execution of: ${command}\n(Note: Running in OPFS mode without actual terminal execution)\n`,
      stderr: ''
    };
  }
  
  async spawn(options?: {
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<TerminalSession> {
    logger.debug('Spawning mock terminal session');
    
    const sessionId = `mock_terminal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let dataCallbacks: ((data: string) => void)[] = [];
    let exitCallbacks: ((code: number) => void)[] = [];
    
    return {
      id: sessionId,
      
      async write(data: string): Promise<void> {
        logger.debug(`Mock terminal received: ${data}`);
        
        // Generate mock responses to common terminal inputs
        let response = '';
        
        if (data.trim().startsWith('ls')) {
          response = 'file1.js\nfile2.js\ndirectory1/\n';
        } else if (data.trim().startsWith('cd ')) {
          response = ''; // cd commands don't produce output
        } else if (data.trim().startsWith('echo ')) {
          response = data.trim().substring(5) + '\n';
        } else {
          response = `Mock terminal: ${data.trim()}\n`;
        }
        
        // Notify registered callbacks with the response
        setTimeout(() => {
          dataCallbacks.forEach(callback => callback(response));
        }, 100);
      },
      
      async kill(): Promise<void> {
        logger.debug('Mock terminal killed');
        
        // Trigger exit callbacks
        exitCallbacks.forEach(callback => callback(0));
        
        // Clear callbacks
        dataCallbacks = [];
        exitCallbacks = [];
      },
      
      onData(callback: (data: string) => void): void {
        dataCallbacks.push(callback);
      },
      
      onExit(callback: (code: number) => void): void {
        exitCallbacks.push(callback);
      },
      
      removeAllListeners(): void {
        dataCallbacks = [];
        exitCallbacks = [];
      }
    };
  }
}

/**
 * Factory function to create the appropriate terminal implementation
 */
export async function createTerminal(useWebContainer: boolean, webcontainer?: WebContainer): Promise<TerminalInterface> {
  if (useWebContainer && webcontainer) {
    return new WebContainerTerminal(webcontainer);
  } else {
    return new MockTerminal();
  }
}