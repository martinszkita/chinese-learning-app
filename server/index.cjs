const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openStore, StoreError } = require('./material-store.cjs');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.pdf':'application/pdf','.mp3':'audio/mpeg','.m4a':'audio/mp4','.svg':'image/svg+xml','.json':'application/json' };
function createServer({ store = openStore(process.env.MATERIAL_DB || path.join(root, 'data/materials.sqlite')) } = {}) {
  const json = (res, status, data) => { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(data)); };
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new StoreError('Use application/json', 415);
    let length = 0, chunks = [];
    for await (const chunk of req) { length += chunk.length; if (length > 1024 * 1024) throw new StoreError('Request too large', 413); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; }
    catch { throw new StoreError('Invalid JSON'); }
  }
  const server = http.createServer(async (req, res) => {
    try {
      // This initial server is deliberately local-only. Browser writes must come from this origin.
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) throw new StoreError('Invalid host', 403);
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new StoreError('Invalid origin', 403);
      const url = new URL(req.url, `http://${req.headers.host}`);
      const route = url.pathname;
      if (route === '/api/materials' && req.method === 'GET') return json(res, 200, store.snapshot());
      if (route === '/api/collections' && req.method === 'POST') return json(res, 201, store.createCollection(await body(req)));
      let match;
      if ((match = /^\/api\/sections\/([^/]+)\/items$/.exec(route)) && req.method === 'POST') return json(res, 201, store.addItem(decodeURIComponent(match[1]), await body(req)));
      if ((match = /^\/api\/items\/([^/]+)$/.exec(route)) && req.method === 'PATCH') return json(res, 200, store.updateItem(decodeURIComponent(match[1]), await body(req)));
      if ((match = /^\/api\/placements\/([^/]+)\/audio$/.exec(route)) && req.method === 'POST') return json(res, 201, store.attachAudio(decodeURIComponent(match[1]), await body(req)));
      if (route.startsWith('/api/')) throw new StoreError('API route not found', 404);
      if (!['GET','HEAD'].includes(req.method)) throw new StoreError('Method not allowed', 405);
      const relative = route === '/' ? 'index.html' : decodeURIComponent(route).slice(1);
      const permitted = /^(?:index\.html|app\.js|bootstrap\.js|style\.css|dialog-sections\.css|js\/[\w/-]+\.js|vendor\/[\w./-]+|materials\/(?:audio\/[\w./-]+|lesson\d+\/dialog[12]\/(?:screenshots|sources)\/[\w./-]+|midterm\d+\/source\/[\w./-]+|reading\/images\/[\w./-]+))$/.test(relative);
      if (!permitted || relative.split('/').includes('..')) throw new StoreError('File not found', 404);
      const file = path.resolve(root, relative);
      let actual, stat;
      try { actual = fs.realpathSync(file); stat = fs.statSync(actual); } catch { throw new StoreError('File not found', 404); }
      if (!actual.startsWith(root + path.sep) || !stat.isFile()) throw new StoreError('File not found', 404);
      const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Accept-Ranges':'bytes', 'Content-Length':stat.size };
      let start = 0, end = stat.size - 1, status = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!range || (!range[1] && !range[2])) throw new StoreError('Invalid range', 416);
        start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
        if (start > end || start >= stat.size) { res.setHeader('Content-Range', `bytes */${stat.size}`); throw new StoreError('Invalid range', 416); }
        headers['Content-Length'] = end - start + 1; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`; status = 206;
      }
      res.writeHead(status, headers);
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(actual, { start, end }); stream.on('error', () => res.destroy()); stream.pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      const status = error.status || (error instanceof TypeError ? 400 : 500);
      if (status === 500) console.error(error);
      json(res, status, { error: status === 500 ? 'Internal server error' : error.message });
    }
  });
  server.on('close', () => store.close());
  return server;
}
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => console.log(`Chinese Exam Prep: http://127.0.0.1:${server.address().port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
module.exports = { createServer };
