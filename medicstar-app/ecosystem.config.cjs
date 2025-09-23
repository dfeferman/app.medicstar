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
      name: 'worker',
      script: 'npm run worker',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1024M',
      max_restarts: 10,
    }
  ],
}
