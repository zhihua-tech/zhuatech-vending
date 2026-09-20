/**
 * 上海如静知华信息科技有限公司 https://www.zhuatech.cn/
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VendingService, createDemoService } from './domain.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(process.env.VENDING_DATA_FILE || './data/vending.json');
const apiKey = process.env.VENDING_API_KEY || 'zhuatech-demo-key';
const port = Number(process.env.PORT || 18105);
const service = (() => { try { return new VendingService(JSON.parse(fs.readFileSync(dataFile, 'utf8'))); } catch { return createDemoService(); } })();
const persist = () => { fs.mkdirSync(path.dirname(dataFile), { recursive: true }); fs.writeFileSync(dataFile, JSON.stringify(service.dump(), null, 2)); };
persist();

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
};
const bodyOf = async (req) => {
  const chunks = [];
  for await (const chunk of req) { chunks.push(chunk); if (chunks.reduce((n, item) => n + item.length, 0) > 1024 * 1024) throw new Error('请求体超过1MB'); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
};
const staticFiles = {
  '/': ['terminal.html', 'text/html; charset=utf-8'], '/terminal': ['terminal.html', 'text/html; charset=utf-8'],
  '/console': ['console.html', 'text/html; charset=utf-8'], '/styles.css': ['styles.css', 'text/css; charset=utf-8']
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (staticFiles[url.pathname]) { const [name, type] = staticFiles[url.pathname]; return send(res, 200, fs.readFileSync(path.join(dirname, '..', 'public', name), 'utf8'), type); }
    if (url.pathname === '/health') return send(res, 200, { status: 'UP', service: 'zhuatech-vending' });
    if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'NOT_FOUND' });
    if (req.headers['x-api-key'] !== apiKey && req.headers['x-device-token'] === undefined) return send(res, 401, { error: 'UNAUTHORIZED' });
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await bodyOf(req) : {};
    const actor = req.headers['x-actor'] || 'api-user';
    let result;
    if (req.method === 'GET' && url.pathname === '/api/dashboard') result = service.dashboard();
    else if (req.method === 'POST' && url.pathname === '/api/products') result = service.createProduct(body, actor);
    else if (req.method === 'POST' && url.pathname === '/api/machines') result = service.registerMachine(body, actor);
    else if (req.method === 'POST' && url.pathname === '/api/promotions') result = service.createPromotion(body, actor);
    else if (req.method === 'POST' && url.pathname === '/api/orders') result = service.createOrder(body, actor, req.headers['idempotency-key'] || '');
    else {
      const slot = url.pathname.match(/^\/api\/machines\/([^/]+)\/slots$/);
      const replenish = url.pathname.match(/^\/api\/machines\/([^/]+)\/replenishments$/);
      const heartbeat = url.pathname.match(/^\/api\/machines\/([^/]+)\/heartbeat$/);
      const fault = url.pathname.match(/^\/api\/machines\/([^/]+)\/faults$/);
      const completeRep = url.pathname.match(/^\/api\/replenishments\/([^/]+)\/complete$/);
      const pay = url.pathname.match(/^\/api\/orders\/([^/]+)\/pay$/);
      const dispense = url.pathname.match(/^\/api\/orders\/([^/]+)\/dispense$/);
      const refund = url.pathname.match(/^\/api\/orders\/([^/]+)\/refund$/);
      const close = url.pathname.match(/^\/api\/work-orders\/([^/]+)\/close$/);
      if (req.method === 'POST' && slot) result = service.configureSlot(slot[1], body, actor);
      else if (req.method === 'POST' && replenish) result = service.createReplenishment(replenish[1], actor);
      else if (req.method === 'POST' && heartbeat) result = service.heartbeat(heartbeat[1], body);
      else if (req.method === 'POST' && fault) result = service.reportFault(fault[1], body, actor);
      else if (req.method === 'POST' && completeRep) result = service.completeReplenishment(completeRep[1], body, actor);
      else if (req.method === 'POST' && pay) result = service.payOrder(pay[1], body, actor);
      else if (req.method === 'POST' && dispense) result = service.reportDispense(dispense[1], body, actor);
      else if (req.method === 'POST' && refund) result = service.completeRefund(refund[1], body, actor);
      else if (req.method === 'POST' && close) result = service.closeWorkOrder(close[1], body.resolution, actor);
      else return send(res, 404, { error: 'NOT_FOUND' });
    }
    if (req.method !== 'GET') persist();
    return send(res, req.method === 'POST' ? 201 : 200, result);
  } catch (error) {
    return send(res, 400, { error: 'BUSINESS_ERROR', message: error.message });
  }
});

server.listen(port, () => console.log(`ZhuaTech Vending running at http://127.0.0.1:${port}`));
