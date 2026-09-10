import { defineConfig, loadEnv } from 'vite';
import { handleLukeRequest, isLukeApi } from './server/luke-chat.mjs';

function maskKey(key: string) {
  if (!key) return 'MISSING';
  if (key.length < 12) return `set (${key.length} chars, looks short)`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function lukeChatPlugin(apiKey: string, debug: boolean) {
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
  const debug = mode !== 'production';
  return {
    plugins: [lukeChatPlugin(apiKey, debug)],
  };
});
