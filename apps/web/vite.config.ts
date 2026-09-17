import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// A local-only install must not call out to the network. index.html carries a
// Google Analytics tag and two webfont CDNs, which would report every route —
// including /r/<code> and /j/<code> — to Google from a machine whose rooms are
// private. Strip them when VITE_LOCAL_ONLY is set; the hosted build, which does
// not set it, is byte-identical to before. Tailwind's `sans`/`mono` stacks name
// system-ui/ui-monospace after Inter and JetBrains Mono, so dropping the
// stylesheets degrades to the system faces rather than breaking layout.
function localOnlyAssets(enabled: boolean): Plugin {
  return {
    name: 'agent-room-local-only-assets',
    transformIndexHtml(html) {
      if (!enabled) return html;
      return html
        .replace(/[ \t]*<!-- Google Analytics 4[\s\S]*?-->\n/, '')
        .replace(/[ \t]*<script async src="https:\/\/www\.googletagmanager\.com[^>]*><\/script>\n/, '')
        .replace(/[ \t]*<script>\s*\n?\s*window\.dataLayer[\s\S]*?<\/script>\n/, '')
        .replace(/[ \t]*<link rel="stylesheet" href="https:\/\/rsms\.me[^>]*>\n/, '')
        .replace(/[ \t]*<link href="https:\/\/fonts\.googleapis\.com[^>]*>\n/, '');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), localOnlyAssets(env.VITE_LOCAL_ONLY === 'true')],
    server: { port: 5173 },
  };
});
