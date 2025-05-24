import * as path from 'path';
import * as http from 'http';
import Koa from 'koa';
import koaStatic from 'koa-static';
import { Deferred } from '@opensumi/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@opensumi/ide-core-node';

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  try {
    console.log('Starting server...');
    const app = new Koa();
    const deferred = new Deferred<http.Server>();
    process.env.EXT_MODE = 'js';
    const port = process.env.IDE_SERVER_PORT || 8000;
    
    // In production, __dirname is /release/out/node
    // So we need to go up one level to /release/out
    const baseDir = process.env.NODE_ENV === 'production' ? 
      path.join(__dirname, '..') : 
      path.join(__dirname, '../../../');
      
    const workspaceDir = process.env.WORKSPACE_DIR || 
      path.join(baseDir, 'workspace');
      
    const extensionDir = process.env.EXTENSION_DIR || 
      path.join(baseDir, 'extensions');
      
    const extensionHost = process.env.EXTENSION_HOST_ENTRY || 
      path.join(baseDir, 'ext-host/index.js');

    // Debug logging
    console.log('Server startup info:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('port:', port);
    console.log('baseDir:', baseDir);
    console.log('workspaceDir:', workspaceDir);
    console.log('extensionDir:', extensionDir);
    console.log('extensionHost:', extensionHost);
    console.log('__dirname:', __dirname);

    // Verify directories exist
    const fs = require('fs');
    if (!fs.existsSync(baseDir)) {
      throw new Error(`Base directory does not exist: ${baseDir}`);
    }
    if (!fs.existsSync(workspaceDir)) {
      console.warn(`Workspace directory does not exist: ${workspaceDir}`);
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    if (!fs.existsSync(extensionDir)) {
      console.warn(`Extension directory does not exist: ${extensionDir}`);
      fs.mkdirSync(extensionDir, { recursive: true });
    }
    if (!fs.existsSync(extensionHost)) {
      throw new Error(`Extension host does not exist: ${extensionHost}`);
    }

    // Add health check endpoint
    app.use(async (ctx, next) => {
      if (ctx.path === '/health') {
        ctx.body = { status: 'ok' };
        return;
      }
      await next();
    });

    let opts: IServerAppOpts = {
      use: app.use.bind(app),
      processCloseExitThreshold: 5 * 60 * 1000,
      terminalPtyCloseThreshold: 5 * 60 * 1000,
      staticAllowOrigin: '*',
      staticAllowPath: [
        workspaceDir,
        extensionDir,
        '/',
      ],
      extHost: extensionHost,
    };

    opts.marketplace = {
      showBuiltinExtensions: true,
    }
    
    if (Array.isArray(arg1)) {
      opts = {
        ...opts,
         modulesInstances: arg1,
        };
    } else {
      opts = {
        ...opts,
        ...arg1,
      };
    }

    console.log('Initializing server app...');
    const serverApp = new ServerApp(opts);
    const server = http.createServer(app.callback());

    if (process.env.NODE_ENV === 'production') {
      // In production, serve static files from /release/out
      const staticPath = baseDir;
      console.log('Serving static files from:', staticPath);
      if (!fs.existsSync(staticPath)) {
        throw new Error(`Static files directory does not exist: ${staticPath}`);
      }
      app.use(koaStatic(staticPath));
    }

    console.log('Starting server app...');
    await serverApp.start(server);

    server.on('error', (err) => {
      deferred.reject(err);
      console.error('Server error: ' + err.message);
      setTimeout(process.exit, 0, 1);
    });

    server.listen(Number(port), '0.0.0.0', () => {
      console.log('=================================');
      console.log(`Server is ready on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log('=================================');
      deferred.resolve(server);
    });
    return deferred.promise;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
