module.exports = {
  apps: [
    {
      name: 'axiom-marketplace',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: process.env.INSTANCES || 'max',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 3002,
        MARKET_PORT: process.env.MARKET_PORT || 3002
      },
      max_memory_restart: '512M',
      listen_timeout: 8000,
      kill_timeout: 4000
    }
  ]
};