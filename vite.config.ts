import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, build } from 'vite';
import fs from 'fs';
import AdmZip from 'adm-zip';
import * as esbuild from 'esbuild';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'download-app-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const reqUrl = req.url || '';
            if (reqUrl.startsWith('/api/download-app')) {
              try {
                const parsedUrl = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);
                const type = parsedUrl.searchParams.get('type') || 'html';

                let initialData: any = { notes: null, folders: null, settings: null };
                if (req.method === 'POST') {
                  const body = await new Promise<string>((resolve) => {
                    let data = '';
                    req.on('data', chunk => { data += chunk; });
                    req.on('end', () => resolve(data));
                  });
                  if (body) {
                    try {
                      initialData = JSON.parse(body);
                    } catch (e) {
                      console.error("Failed to parse POST body:", e);
                    }
                  }
                }

                // 1. Programmatic production build using Vite to compile the latest CSS assets and responsive elements
                await build({
                  configFile: false,
                  plugins: [react(), tailwindcss()],
                  resolve: {
                    alias: {
                      '@': path.resolve(process.cwd(), '.'),
                    },
                  },
                  build: {
                    outDir: 'dist',
                    emptyOutDir: true,
                  }
                });

                const distPath = path.resolve(process.cwd(), 'dist');

                if (type === 'html') {
                  // A. Extract Compiled CSS from Vite Output
                  const assetsDir = path.join(distPath, 'assets');
                  let compiledCss = '';
                  if (fs.existsSync(assetsDir)) {
                    const files = fs.readdirSync(assetsDir);
                    const cssFile = files.find(f => f.endsWith('.css'));
                    if (cssFile) {
                      compiledCss = fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8');
                    }
                  }

                  // B. Compile JavaScript live with Esbuild into non-module IIFE format
                  // This completely avoids CORS errors under file:// protocol
                  const esbuildResult = await esbuild.build({
                    entryPoints: ['src/main.tsx'],
                    bundle: true,
                    minify: true,
                    format: 'iife',
                    platform: 'browser',
                    write: false,
                    loader: {
                      '.css': 'empty',
                      '.png': 'dataurl',
                      '.svg': 'dataurl',
                      '.woff2': 'dataurl',
                      '.woff': 'dataurl',
                      '.ttf': 'dataurl',
                    },
                    define: {
                      'process.env.NODE_ENV': '"production"'
                    }
                  });

                  if (!esbuildResult.outputFiles || esbuildResult.outputFiles.length === 0) {
                    throw new Error("Esbuild compilation failed to output a bundle.");
                  }

                  const compiledJs = esbuildResult.outputFiles[0].text;

                  const initialNotesStr = initialData.notes ? JSON.stringify(initialData.notes) : 'null';
                  const initialFoldersStr = initialData.folders ? JSON.stringify(initialData.folders) : 'null';
                  const initialSettingsStr = initialData.settings ? JSON.stringify(initialData.settings) : 'null';

                  // C. Construct the final client-side fully self-contained offline standalone HTML file
                  const standaloneHtml = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Note Android - Copia Offline Funzionante</title>
    <!-- Responsive Google fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        ${compiledCss}
    </style>
</head>
<body class="bg-black text-neutral-100 min-h-screen">
    <div id="root"></div>
    <script>
        window.__INITIAL_NOTES__ = ${initialNotesStr};
        window.__INITIAL_FOLDERS__ = ${initialFoldersStr};
        window.__INITIAL_SETTINGS__ = ${initialSettingsStr};
    </script>
    <script>
        ${compiledJs}
    </script>
</body>
</html>`;

                  res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="note_android_offline.html"',
                  });
                  res.end(standaloneHtml);
                } 
                else if (type === 'zip' || type === 'src') {
                  const zip = new AdmZip();

                  if (type === 'zip') {
                    // ZIP up the compiled production build inside dist/
                    if (fs.existsSync(distPath)) {
                      zip.addLocalFolder(distPath);
                    } else {
                      throw new Error("Cartella di build 'dist' non trovata.");
                    }
                  } else {
                    // ZIP up the entire workspace excluding node_modules, temp files, and artifacts
                    const rootDir = process.cwd();
                    const items = fs.readdirSync(rootDir);
                    const excludes = ['node_modules', 'dist', '.git', '.github', '.env', 'tmp', 'project.zip', 'build.zip', 'package-lock.json'];
                    for (const item of items) {
                      if (excludes.includes(item)) continue;
                      const itemPath = path.join(rootDir, item);
                      try {
                        const stat = fs.statSync(itemPath);
                        if (stat.isDirectory()) {
                          zip.addLocalFolder(itemPath, item);
                        } else if (stat.isFile()) {
                          zip.addLocalFile(itemPath);
                        }
                      } catch (e) {
                        console.warn("Impossibile leggere file/cartella per lo zip:", e);
                      }
                    }
                  }

                  const zipBuffer = zip.toBuffer();
                  res.writeHead(200, {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="note_android_${type === 'zip' ? 'build' : 'sorgente'}.zip"`,
                    'Content-Length': zipBuffer.length,
                  });
                  res.end(zipBuffer);
                }
              } catch (error) {
                console.error("Vite helper download api error:", error);
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Errore durante la creazione dei file dell'app: ${error instanceof Error ? error.message : String(error)}`);
              }
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
