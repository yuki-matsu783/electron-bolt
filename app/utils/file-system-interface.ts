import type { WebContainer } from '@webcontainer/api';
import { WORK_DIR } from './constants';
import { path } from './path';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('FileSystemInterface');

// 全てのファイルシステム実装のための共通インターフェース
export interface FileSystemInterface {
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
  watchFile(path: string, options: { persistent: boolean }, callback: (event: any) => void): Promise<{ close: () => void }>;
  watchPath(config: { include: string[]; exclude?: string[]; includeContent?: boolean }, callback: any): { close: () => void };
  resolveWorkdirPath(filePath: string): string;
  workdir: string;
}

// WebContainerを使用する実装
export class WebContainerFileSystem implements FileSystemInterface {
  private webcontainer: WebContainer;

  constructor(webcontainer: WebContainer) {
    this.webcontainer = webcontainer;
  }

  get workdir(): string {
    return this.webcontainer.workdir;
  }

  async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
    try {
      const relativePath = path.relative(this.webcontainer.workdir, filePath);
      if (!relativePath) {
        throw new Error(`EINVAL: invalid file path, write '${relativePath}'`);
      }
      return await this.webcontainer.fs.writeFile(relativePath, content);
    } catch (error) {
      logger.error('Failed to write file', error);
      throw error;
    }
  }

  async readFile(filePath: string): Promise<Uint8Array> {
    try {
      const relativePath = path.relative(this.webcontainer.workdir, filePath);
      if (!relativePath) {
        throw new Error(`EINVAL: invalid file path, read '${relativePath}'`);
      }
      return await this.webcontainer.fs.readFile(relativePath);
    } catch (error) {
      logger.error('Failed to read file', error);
      throw error;
    }
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      const relativePath = path.relative(this.webcontainer.workdir, dirPath);
      if (!relativePath) {
        throw new Error(`EINVAL: invalid directory path, mkdir '${relativePath}'`);
      }
      return await this.webcontainer.fs.mkdir(relativePath, options);
    } catch (error) {
      logger.error('Failed to create directory', error);
      throw error;
    }
  }

  async rm(filePath: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      const relativePath = path.relative(this.webcontainer.workdir, filePath);
      if (!relativePath) {
        throw new Error(`EINVAL: invalid path, rm '${relativePath}'`);
      }
      return await this.webcontainer.fs.rm(relativePath, options);
    } catch (error) {
      logger.error('Failed to remove path', error);
      throw error;
    }
  }

  async watchFile(filePath: string, options: { persistent: boolean }, callback: (event: any) => void): Promise<{ close: () => void }> {
    try {
      const relativePath = path.relative(this.webcontainer.workdir, filePath);
      if (!relativePath) {
        throw new Error(`EINVAL: invalid file path, watch '${relativePath}'`);
      }
      return await this.webcontainer.fs.watch(relativePath, options, callback);
    } catch (error) {
      logger.error('Failed to watch file', error);
      throw error;
    }
  }

  watchPath(config: { include: string[]; exclude?: string[]; includeContent?: boolean }, callback: any): { close: () => void } {
    try {
      return this.webcontainer.internal.watchPaths(config, callback);
    } catch (error) {
      logger.error('Failed to watch paths', error);
      throw error;
    }
  }

  resolveWorkdirPath(filePath: string): string {
    return filePath;
  }
}

// Origin Private File System (OPFS)を使用する実装
export class OPFSFileSystem implements FileSystemInterface {
  private rootDirectory: FileSystemDirectoryHandle | null = null;
  private activeWatchers: Map<string, { intervalId: number; callback: Function }> = new Map();
  private fileContents: Map<string, Uint8Array> = new Map();
  private _workdir: string;
  
  constructor(workdir: string = WORK_DIR) {
    this._workdir = workdir;
  }
  
  get workdir(): string {
    return this._workdir;
  }
  
  private async ensureRootDirectory(): Promise<FileSystemDirectoryHandle> {
    if (!this.rootDirectory) {
      try {
        // Get access to the origin private file system
        const root = await navigator.storage.getDirectory();
        
        // Create or open the workspace directory
        try {
          this.rootDirectory = await root.getDirectoryHandle('workspace', { create: true });
        } catch (error) {
          logger.error('Failed to create workspace directory', error);
          throw new Error('Failed to create workspace directory');
        }
      } catch (error) {
        logger.error('Failed to access Origin Private File System', error);
        throw new Error('Failed to access Origin Private File System');
      }
    }
    
    return this.rootDirectory;
  }
  
  private async getDirectoryFromPath(dirPath: string, create: boolean = false): Promise<FileSystemDirectoryHandle> {
    const root = await this.ensureRootDirectory();
    const normalizedPath = this.normalizePath(dirPath);
    
    if (normalizedPath === '' || normalizedPath === '/' || normalizedPath === '.') {
      return root;
    }
    
    const parts = normalizedPath.split('/').filter(Boolean);
    let currentDir = root;
    
    for (const part of parts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part, { create });
      } catch (error) {
        logger.error(`Failed to get directory ${part} in ${normalizedPath}`, error);
        throw new Error(`Failed to get directory ${part} in ${normalizedPath}`);
      }
    }
    
    return currentDir;
  }
  
  private async getFileFromPath(filePath: string, create: boolean = false): Promise<FileSystemFileHandle> {
    const normalizedPath = this.normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    
    let dirPath, fileName;
    
    if (lastSlashIndex === -1) {
      dirPath = '';
      fileName = normalizedPath;
    } else {
      dirPath = normalizedPath.substring(0, lastSlashIndex);
      fileName = normalizedPath.substring(lastSlashIndex + 1);
    }
    
    const directory = await this.getDirectoryFromPath(dirPath, create);
    
    try {
      return await directory.getFileHandle(fileName, { create });
    } catch (error) {
      logger.error(`Failed to get file ${fileName} in ${dirPath}`, error);
      throw new Error(`Failed to get file ${fileName} in ${dirPath}`);
    }
  }
  
  private normalizePath(filePath: string): string {
    // Remove workdir prefix if present
    let normalizedPath = filePath;
    if (normalizedPath.startsWith(this._workdir)) {
      normalizedPath = normalizedPath.substring(this._workdir.length);
    }
    
    // Remove leading slash
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    return normalizedPath;
  }

  async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
    try {
      const fileHandle = await this.getFileFromPath(filePath, true);
      const writable = await fileHandle.createWritable();
      
      let data: Uint8Array;
      if (typeof content === 'string') {
        const encoder = new TextEncoder();
        data = encoder.encode(content);
      } else {
        data = content;
      }
      
      await writable.write(data);
      await writable.close();
      
      // Cache the content for the file watcher
      this.fileContents.set(filePath, data);
      
      logger.debug(`File written successfully: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to write file ${filePath}`, error);
      throw error;
    }
  }
  
  async readFile(filePath: string): Promise<Uint8Array> {
    try {
      const fileHandle = await this.getFileFromPath(filePath);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      
      // Cache the content for the file watcher
      this.fileContents.set(filePath, data);
      
      return data;
    } catch (error) {
      logger.error(`Failed to read file ${filePath}`, error);
      throw error;
    }
  }
  
  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      await this.getDirectoryFromPath(dirPath, true);
      logger.debug(`Directory created successfully: ${dirPath}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}`, error);
      throw error;
    }
  }
  
  async rm(filePath: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      const normalizedPath = this.normalizePath(filePath);
      const lastSlashIndex = normalizedPath.lastIndexOf('/');
      
      if (lastSlashIndex === -1) {
        // Removing a file or directory from the root
        const root = await this.ensureRootDirectory();
        await root.removeEntry(normalizedPath, options);
      } else {
        const dirPath = normalizedPath.substring(0, lastSlashIndex);
        const name = normalizedPath.substring(lastSlashIndex + 1);
        
        const directory = await this.getDirectoryFromPath(dirPath);
        await directory.removeEntry(name, options);
      }
      
      // Remove from cache if it was a watched file
      this.fileContents.delete(filePath);
      
      logger.debug(`Successfully removed ${filePath}`);
    } catch (error) {
      logger.error(`Failed to remove ${filePath}`, error);
      throw error;
    }
  }
  
  async watchFile(filePath: string, options: { persistent: boolean }, callback: (event: any) => void): Promise<{ close: () => void }> {
    // Store original content for comparison
    try {
      await this.readFile(filePath);
    } catch (error) {
      logger.debug(`File ${filePath} doesn't exist yet, will watch for creation`);
    }
    
    const watcherId = `watcher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Set up polling to check for file changes
    const intervalId = window.setInterval(async () => {
      try {
        const currentContent = await this.readFile(filePath);
        const previousContent = this.fileContents.get(filePath);
        
        if (!previousContent || !this.arraysEqual(currentContent, previousContent)) {
          // Content has changed
          this.fileContents.set(filePath, currentContent);
          callback({
            type: 'change',
            filename: filePath
          });
        }
      } catch (error) {
        // File might have been deleted
        if (this.fileContents.has(filePath)) {
          this.fileContents.delete(filePath);
          callback({
            type: 'delete',
            filename: filePath
          });
        }
      }
    }, 1000); // Check every second
    
    this.activeWatchers.set(watcherId, {
      intervalId,
      callback
    });
    
    return {
      close: () => {
        const watcher = this.activeWatchers.get(watcherId);
        if (watcher) {
          clearInterval(watcher.intervalId);
          this.activeWatchers.delete(watcherId);
        }
      }
    };
  }
  
  watchPath(config: { include: string[]; exclude?: string[]; includeContent?: boolean }, callback: any): { close: () => void } {
    // This is a simplified implementation that just watches the include patterns
    const watcherIds: string[] = [];
    
    for (const pattern of config.include) {
      // Convert glob pattern to a specific path (simplified)
      // In a real implementation, you would need a more sophisticated glob matching system
      const basePath = pattern.replace(/\*\*\/\*\.\w+$/, '');
      
      const watcherId = `path_watcher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Set up polling to check for file changes
      const intervalId = window.setInterval(async () => {
        try {
          // In a real implementation, you would scan directories matching the pattern
          // For now, we'll just simulate an event every 5 seconds
          callback({
            path: basePath + 'simulated_file.js',
            type: 'change'
          });
        } catch (error) {
          logger.error(`Error in path watcher for ${pattern}`, error);
        }
      }, 5000); 
      
      this.activeWatchers.set(watcherId, {
        intervalId,
        callback
      });
      
      watcherIds.push(watcherId);
    }
    
    return {
      close: () => {
        for (const id of watcherIds) {
          const watcher = this.activeWatchers.get(id);
          if (watcher) {
            clearInterval(watcher.intervalId);
            this.activeWatchers.delete(id);
          }
        }
      }
    };
  }
  
  resolveWorkdirPath(filePath: string): string {
    // Make sure the path includes the workdir prefix
    if (!filePath.startsWith(this._workdir)) {
      return path.join(this._workdir, filePath);
    }
    return filePath;
  }
  
  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

/**
 * Factory function to create the appropriate file system implementation
 */
export async function createFileSystem(useWebContainer: boolean, webcontainer?: Promise<WebContainer>): Promise<FileSystemInterface> {
  if (useWebContainer) {
    if (!webcontainer) {
      throw new Error('WebContainer promise is required when useWebContainer is true');
    }
    return new WebContainerFileSystem(await webcontainer);
  } else {
    return new OPFSFileSystem();
  }
}