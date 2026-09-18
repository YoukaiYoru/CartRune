const path = require('node:path');

const root = __dirname;
const embeddingsPython = path.join(root, 'apps/embeddings/.venv/bin/python');

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
      name: 'cartrune-embeddings',
      cwd: path.join(root, 'apps/embeddings'),
      script: embeddingsPython,
      args: 'service.py',
      interpreter: 'none',
      env: {
        EMBEDDINGS_PORT: '8700',
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
