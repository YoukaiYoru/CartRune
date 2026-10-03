const path = require('node:path');

const root = __dirname;
module.exports = {
  apps: [
    {
      name: 'cartrune-api',
      cwd: path.join(root, 'apps/api'),
      script: 'go',
      args: 'run ./cmd/api',
      interpreter: 'none',
      env: {
        APP_ENV: 'development',
        SERVER_PORT: '8080',
      },
    },
    {
      name: 'cartrune-mobile',
      cwd: path.join(root, 'apps/mobile'),
      script: 'npx',
      args: 'expo start --lan',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
