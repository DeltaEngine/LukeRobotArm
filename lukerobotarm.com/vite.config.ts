import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { handleLukeRequest, isLukeApi } from './server/luke-chat.mjs';
import { handleCatalogRequest, isCatalogApi } from './server/prices.mjs';

function maskKey(key: string) {
  if (!key) return 'MISSING';
  if (key.length < 12) return `set (${key.length} chars, looks short)`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function lukeChatPlugin(apiKey: string, debug: boolean, mongoUrl: string) {
  const env = { apiKey, debug };

  function attach(server: {
    middlewares: { use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void };
  }) {
    server.middlewares.use((req: { url?: string; originalUrl?: string; method?: string }, res: {
      headersSent?: boolean;
      statusCode: number;
      setHeader: (k: string, v: string) => void;
      end: (s?: string) => void;
    }, next: () => void) => {
      const url = req.originalUrl || req.url || '';
      if (isCatalogApi(url)) {
        if (mongoUrl) process.env.LUKE_MONGO_URL ||= mongoUrl;
        console.log(`[catalog] ${req.method} ${url.split('?')[0]}`);
        void handleCatalogRequest(req)
          .then((out) => {
            if (res.headersSent) return;
            res.statusCode = out.status;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(out.json ? JSON.stringify(out.json) : '');
          })
          .catch((err: unknown) => {
            if (res.headersSent) return;
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(err) }));
          });
        return;
      }
      if (!isLukeApi(url)) {
        next();
        return;
      }
      console.log(`[luke-session] ${req.method} ${url.split('?')[0]}`);
      void handleLukeRequest(req, env)
        .then((out) => {
          if (res.headersSent) return;
          res.statusCode = out.status;
          if (out.json) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(out.json, null, 2));
          } else {
            res.end();
          }
        })
        .catch((err: unknown) => {
          console.error('[luke-session] handler error', err);
          if (res.headersSent) return;
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        });
    });
  }

  return {
    name: 'luke-chat',
    configureServer(server: { middlewares: { use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void } }) {
      console.log(`[luke-session] plugin loaded, debug=${debug}, key=${maskKey(apiKey)}`);
      attach(server);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void } }) {
      attach(server);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const mongoUrl = env.LUKE_MONGO_URL || process.env.LUKE_MONGO_URL || '';
  const debug = mode !== 'production';
  return {
    plugins: [lukeChatPlugin(apiKey, debug, mongoUrl), VitePWA({
      // Activate updates after existing windows close; never reload during robot control.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'app-icon-180.png'],
      manifest: {
        id: '/', name: 'Luke Robot Arm', short_name: 'Luke',
        description: 'Control your Luke Robot Arm from your phone or laptop.',
        start_url: '/#overview', scope: '/', display: 'standalone',
        theme_color: '#1a1a1a', background_color: '#1a1a1a',
        icons: [
          { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,ico,wasm}'],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/ws(?:\/|$)/],
        // APIs and robot traffic stay network-only; videos are too large to precache.
        runtimeCaching: [],
      },
    })],
  };
});
