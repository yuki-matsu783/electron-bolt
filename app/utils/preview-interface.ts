import type { WebContainer } from '@webcontainer/api';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('PreviewInterface');

/**
 * Common interface for preview functionality across implementations
 */
export interface PreviewInterface {
  /**
   * Start a preview server for web content
   * @param options Preview server options
   */
  startServer(options: PreviewServerOptions): Promise<PreviewServerInfo>;
  
  /**
   * Stop a running preview server
   * @param serverId ID of the server to stop
   */
  stopServer(serverId: string): Promise<void>;
  
  /**
   * Get information about all running preview servers
   */
  listServers(): Promise<PreviewServerInfo[]>;
  
  /**
   * Get preview URL for a specific file
   * @param filePath Path to the file to preview
   */
  getFilePreviewUrl(filePath: string): Promise<string>;
  
  /**
   * Get logs for a running preview server
   * @param serverId ID of the server
   */
  getServerLogs(serverId: string): Promise<string[]>;
}

/**
 * Options for starting a preview server
 */
export interface PreviewServerOptions {
  /**
   * Root directory for the server
   */
  root: string;
  
  /**
   * Port to start the server on (if available)
   */
  port?: number;
  
  /**
   * Command to start the custom server (e.g., 'npm start')
   * If not provided, a simple static file server is used
   */
  command?: string;
  
  /**
   * Base URL path for the server
   */
  basePath?: string;
  
  /**
   * Environment variables to set
   */
  env?: Record<string, string>;
}

/**
 * Information about a running preview server
 */
export interface PreviewServerInfo {
  /**
   * Unique ID for the server
   */
  id: string;
  
  /**
   * URL to access the preview
   */
  url: string;
  
  /**
   * Root directory being served
   */
  root: string;
  
  /**
   * Port the server is running on
   */
  port: number;
  
  /**
   * Status of the server
   */
  status: 'starting' | 'running' | 'stopped' | 'error';
  
  /**
   * Command used to start the server (if applicable)
   */
  command?: string;
  
  /**
   * Time when the server was started
   */
  startTime: Date;
}

/**
 * WebContainer implementation of the preview interface
 */
export class WebContainerPreview implements PreviewInterface {
  private webcontainer: WebContainer;
  private servers: Map<string, {
    process: any;
    info: PreviewServerInfo;
    logs: string[];
  }> = new Map();
  
  constructor(webcontainer: WebContainer) {
    this.webcontainer = webcontainer;
  }
  
  async startServer(options: PreviewServerOptions): Promise<PreviewServerInfo> {
    const serverId = `server_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const port = options.port || 3000;
    const url = `http://localhost:${port}${options.basePath || ''}`;
    
    try {
      // Create server info object
      const serverInfo: PreviewServerInfo = {
        id: serverId,
        url,
        root: options.root,
        port,
        status: 'starting',
        command: options.command,
        startTime: new Date()
      };
      
      // Start the actual server process
      let process: any;
      
      if (options.command) {
        // Start a custom server using the command
        process = await this.webcontainer.spawn('sh', ['-c', options.command], {
          cwd: options.root,
          env: {
            PORT: `${port}`,
            ...options.env
          }
        });
        
        const logs: string[] = [];
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              logs.push(data);
              // Check for common server started messages
              if (
                data.includes('Server running') || 
                data.includes('started server') || 
                data.includes('listening on') ||
                data.includes(`localhost:${port}`)
              ) {
                serverInfo.status = 'running';
              }
            }
          })
        );
        
        // Store the server state
        this.servers.set(serverId, {
          process,
          info: serverInfo,
          logs
        });
        
        // Set up error handling
        process.exit.then((code: number) => {
          if (code !== 0) {
            serverInfo.status = 'error';
          } else {
            serverInfo.status = 'stopped';
          }
        });
        
        // Give it some time to start
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (serverInfo.status === 'starting') {
          // Assume it's running if we haven't detected a proper startup message
          serverInfo.status = 'running';
        }
      } else {
        // Start a simple static file server
        const staticServerCode = `
          const http = require('http');
          const fs = require('fs');
          const path = require('path');
          const port = ${port};
          
          const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
          };
          
          const server = http.createServer((req, res) => {
            console.log(\`Request: \${req.url}\`);
            
            // Normalize the URL 
            let url = req.url;
            if (url === '/') url = '/index.html';
            
            // Resolve the file path
            const filePath = path.join(process.cwd(), url);
            
            fs.readFile(filePath, (err, data) => {
              if (err) {
                if (err.code === 'ENOENT') {
                  res.writeHead(404);
                  res.end('File not found');
                  return;
                }
                
                res.writeHead(500);
                res.end('Server error');
                console.error(err);
                return;
              }
              
              // Determine content type
              const ext = path.extname(filePath);
              const contentType = mimeTypes[ext] || 'application/octet-stream';
              
              res.writeHead(200, { 'Content-Type': contentType });
              res.end(data);
            });
          });
          
          server.listen(port, () => {
            console.log(\`Static server running at http://localhost:\${port}\`);
          });
        `;
        
        // Write the server script to a temp file
        await this.webcontainer.fs.writeFile('/tmp/static-server.js', staticServerCode);
        
        // Start the static server
        process = await this.webcontainer.spawn('node', ['/tmp/static-server.js'], {
          cwd: options.root,
          env: options.env
        });
        
        const logs: string[] = [];
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              logs.push(data);
              if (data.includes('Static server running')) {
                serverInfo.status = 'running';
              }
            }
          })
        );
        
        // Store the server state
        this.servers.set(serverId, {
          process,
          info: serverInfo,
          logs
        });
        
        // Set up error handling
        process.exit.then((code: number) => {
          if (code !== 0) {
            serverInfo.status = 'error';
          } else {
            serverInfo.status = 'stopped';
          }
        });
        
        // Give it some time to start
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        serverInfo.status = 'running';
      }
      
      return serverInfo;
    } catch (error) {
      logger.error('Failed to start preview server', error);
      throw error;
    }
  }
  
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server with id ${serverId} not found`);
    }
    
    try {
      await server.process.kill();
      server.info.status = 'stopped';
      return Promise.resolve();
    } catch (error) {
      logger.error(`Failed to stop server ${serverId}`, error);
      throw error;
    }
  }
  
  async listServers(): Promise<PreviewServerInfo[]> {
    return Array.from(this.servers.values()).map(server => server.info);
  }
  
  async getFilePreviewUrl(filePath: string): Promise<string> {
    // For WebContainer, we can preview any file through our servers
    // Look for a running server that might serve this file
    const servers = Array.from(this.servers.values())
      .filter(server => server.info.status === 'running')
      .filter(server => filePath.startsWith(server.info.root));
      
    if (servers.length > 0) {
      // Find the most specific (longest matching root path) server
      const server = servers.sort((a, b) => b.info.root.length - a.info.root.length)[0];
      const relativePath = filePath.substring(server.info.root.length);
      return `${server.info.url}${relativePath}`;
    }
    
    // If no suitable server is found, start a new temporary one
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    
    const serverInfo = await this.startServer({ root: dirPath });
    return `${serverInfo.url}/${fileName}`;
  }
  
  async getServerLogs(serverId: string): Promise<string[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server with id ${serverId} not found`);
    }
    
    return server.logs;
  }
}

/**
 * Mock implementation of the preview interface for OPFS
 */
export class MockPreview implements PreviewInterface {
  private servers: Map<string, {
    info: PreviewServerInfo;
    logs: string[];
    timer: NodeJS.Timeout | null;
  }> = new Map();
  
  async startServer(options: PreviewServerOptions): Promise<PreviewServerInfo> {
    const serverId = `mock_server_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const port = options.port || 3000;
    const url = `http://localhost:${port}${options.basePath || ''}`;
    
    logger.info(`[MOCK] Starting preview server at ${url} for ${options.root}`);
    
    // Create server info object
    const serverInfo: PreviewServerInfo = {
      id: serverId,
      url,
      root: options.root,
      port,
      status: 'starting',
      command: options.command,
      startTime: new Date()
    };
    
    const logs: string[] = [
      `[${new Date().toISOString()}] Starting server...`,
      `[${new Date().toISOString()}] Initializing...`,
    ];
    
    // Simulate server startup
    const timer = setTimeout(() => {
      serverInfo.status = 'running';
      logs.push(`[${new Date().toISOString()}] Server running at ${url}`);
      
      if (options.command) {
        if (options.command.includes('npm start') || options.command.includes('npm run dev')) {
          logs.push(`[${new Date().toISOString()}] webpack compiled successfully`);
        } else if (options.command.includes('next')) {
          logs.push(`[${new Date().toISOString()}] ready - started server on ${url}`);
        } else if (options.command.includes('vite')) {
          logs.push(`[${new Date().toISOString()}] Local: ${url}`);
          logs.push(`[${new Date().toISOString()}] Network: use --host to expose`);
        }
      } else {
        logs.push(`[${new Date().toISOString()}] Static file server running`);
      }
    }, 1500);
    
    // Store server state
    this.servers.set(serverId, {
      info: serverInfo,
      logs,
      timer
    });
    
    // Simulate startup delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return serverInfo;
  }
  
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`[MOCK] Server with id ${serverId} not found`);
    }
    
    logger.info(`[MOCK] Stopping server ${serverId}`);
    
    if (server.timer) {
      clearTimeout(server.timer);
    }
    
    server.info.status = 'stopped';
    server.logs.push(`[${new Date().toISOString()}] Server stopped`);
    
    return Promise.resolve();
  }
  
  async listServers(): Promise<PreviewServerInfo[]> {
    return Array.from(this.servers.values()).map(server => server.info);
  }
  
  async getFilePreviewUrl(filePath: string): Promise<string> {
    logger.info(`[MOCK] Getting preview URL for ${filePath}`);
    
    // Find existing server that might serve this file
    const servers = Array.from(this.servers.values())
      .filter(server => server.info.status === 'running')
      .filter(server => filePath.startsWith(server.info.root));
      
    if (servers.length > 0) {
      // Find the most specific (longest matching root path) server
      const server = servers.sort((a, b) => b.info.root.length - a.info.root.length)[0];
      const relativePath = filePath.substring(server.info.root.length);
      return `${server.info.url}${relativePath}`;
    }
    
    // For files like HTML, use a data URL for preview
    if (filePath.endsWith('.html')) {
      return `data:text/html;base64,PCFET0NUWVBFIGh0bWw+CjxodG1sPgo8aGVhZD4KICA8bWV0YSBjaGFyc2V0PSJVVEYtOCI+CiAgPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgogIDx0aXRsZT5QcmV2aWV3PC90aXRsZT4KICA8c3R5bGU+Ym9keXtmb250LWZhbWlseTpzYW5zLXNlcmlmO3BhZGRpbmc6MjBweH08L3N0eWxlPgo8L2hlYWQ+Cjxib2R5PgogIDxoMT5IVE1MIFByZXZpZXc8L2gxPgogIDxwPk1vY2sgcHJldmlldyBvZiBmaWxlOiAke2ZpbGVQYXRofTwvcD4KICA8cD5JbiBwcm9kdWN0aW9uLCB0aGlzIHdvdWxkIHNob3cgdGhlIGFjdHVhbCBjb250ZW50IG9mIHRoZSBmaWxlLjwvcD4KPC9ib2R5Pgo8L2h0bWw+`;
    }
    
    // For images, a mock data URL
    if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].some(ext => filePath.endsWith(ext))) {
      return `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzU1NSI+TW9jayBJbWFnZTwvdGV4dD48L3N2Zz4=`;
    }
    
    // For other files, a text preview
    return `data:text/plain;base64,TW9jayBwcmV2aWV3IGZvciBmaWxlOiAke2ZpbGVQYXRofQoKVGhpcyBpcyBhIHNpbXVsYXRlZCBwcmV2aWV3IGZvciB0ZXN0aW5nIHB1cnBvc2VzLgpJbiBwcm9kdWN0aW9uLCB0aGUgYWN0dWFsIGZpbGUgY29udGVudCB3b3VsZCBiZSBkaXNwbGF5ZWQu`;
  }
  
  async getServerLogs(serverId: string): Promise<string[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`[MOCK] Server with id ${serverId} not found`);
    }
    
    return server.logs;
  }
}

/**
 * Factory function to create the appropriate preview implementation
 */
export async function createPreview(useWebContainer: boolean, webcontainer?: Promise<WebContainer>): Promise<PreviewInterface> {
  if (useWebContainer) {
    if (!webcontainer) {
      throw new Error('WebContainer promise is required when useWebContainer is true');
    }
    return new WebContainerPreview(await webcontainer);
  } else {
    return new MockPreview();
  }
}