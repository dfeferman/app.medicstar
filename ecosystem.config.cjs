module.exports = {
  apps: [
    {
      name: 'app',
      script: 'npm run start',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1024M',
      max_restarts: 10,
    },
    {
      name: 'worker:products',
      script: 'npm run worker:products',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1024M',
      max_restarts: 10,
    },
    {
      name: 'worker:tracking',
      script: 'npm run worker:tracking',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1024M',
      max_restarts: 10,
    }
  ],
}
