import * as path from 'path';
import * as http from 'http';
import Koa from 'koa';
import koaStatic from 'koa-static';
import { Deferred } from '@opensumi/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@opensumi/ide-core-node';
import compress from 'koa-compress';

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const app = new Koa();
  const deferred = new Deferred<http.Server>();
  process.env.EXT_MODE = 'js';
  const port = Number(process.env.PORT) || Number(process.env.IDE_SERVER_PORT) || 8000;
  const workspaceDir = process.env.WORKSPACE_DIR || process.env.NODE_ENV === 'production' ? path.join(__dirname, '../../workspace') : path.join(__dirname, '../../../workspace');
  const extensionDir = process.env.EXTENSION_DIR || process.env.NODE_ENV === 'production' ? path.join(__dirname, '../../extensions') : path.join(__dirname, '../../../extensions');
  const extensionHost = process.env.EXTENSION_HOST_ENTRY || 
  process.env.NODE_ENV === 'production' ? path.join(__dirname, '..', '..', 'out/ext-host/index.js') : path.join(__dirname, '..', '..', '..', 'out/ext-host/index.js');

  app.use(compress({
    threshold: 0 // 0 表示所有文件都压缩
  }));

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

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server listen on port ${port}`);
    deferred.resolve(server);
  });
  return deferred.promise;
}
