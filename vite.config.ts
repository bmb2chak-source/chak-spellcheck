import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// `npm run dev` үед api/ доторх функцуудыг локал дээр ажиллуулна.
// (Vercel дээр эдгээр нь өөрөө serverless function болж ажилладаг.)
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const route = (req.url || '').split('?')[0].replace(/^\/+|\/+$/g, '');
        if (!route || route.startsWith('_') || route.includes('..')) return next();
        const file = resolve(process.cwd(), 'api', `${route}.js`);
        if (!existsSync(file)) return next();
        try {
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end('Local API error');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // .env.local доторх нууц утгуудыг локал API-д өгнө
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) process.env[key] = value;
  }
  return { plugins: [react(), tailwindcss(), localApi()] };
});
