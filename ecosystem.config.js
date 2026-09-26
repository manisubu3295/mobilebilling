// PM2 process list for production: the API, the billing app and the H2O shop
// website. Start / reload all three with:
//   pm2 startOrReload ecosystem.config.js --update-env && pm2 save
//
// Each app runs from its own folder so it picks up that folder's env file:
//   backend/.env            (DATABASE_URL, MASTER_DATABASE_URL, JWT secrets, FRONTEND_URL, PORT …)
//   frontend/.env.local     (NEXT_PUBLIC_API_URL — read at build time)
//   h2o-website/.env.local  (NEXT_PUBLIC_API_BASE — read at build time)
// Ports can be overridden per server with API_PORT / WEB_PORT / SITE_PORT.
const API_PORT = process.env.API_PORT || 4000;
const WEB_PORT = process.env.WEB_PORT || 3000;
const SITE_PORT = process.env.SITE_PORT || 3001;

const common = {
  exec_mode: 'fork',
  instances: 1,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 3000,
  time: true, // timestamps in `pm2 logs`
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'billing-api',
      cwd: './backend',
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', PORT: API_PORT },
      max_memory_restart: '700M',
    },
    {
      ...common,
      name: 'billing-web',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${WEB_PORT}`,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
    },
    {
      ...common,
      name: 'h2o-website',
      cwd: './h2o-website',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${SITE_PORT}`,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
  ],
};
