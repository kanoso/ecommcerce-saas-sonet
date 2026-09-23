/**
 * PM2 process definition for tiendi-web (Angular SSR).
 * The @angular/ssr server listens on process.env.PORT (default 4000) — pinned to 4200.
 */
module.exports = {
  apps: [
    {
      name: 'tiendi-web',
      cwd: __dirname,
      script: 'web/dist/tiendi-web/server/server.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4200,
      },
    },
  ],
};
