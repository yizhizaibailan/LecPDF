const port = Number.parseInt(process.env.LECPDF_CDP_PORT ?? '9223', 10);
const endpoint = `http://127.0.0.1:${port}/json/list`;
const targetUrl = 'https://example.com/lecpdf-offline-gate';

const pages = await (await fetch(endpoint)).json();
const page = pages.find((candidate) => candidate.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error(`No Electron page target at ${endpoint}`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const eventListeners = new Set();
let commandId = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }
  for (const listener of eventListeners) listener(message);
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function waitForBlockedRequest() {
  const matchingRequests = new Set();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      eventListeners.delete(listener);
      reject(new Error(`Timed out waiting for blocked request to ${targetUrl}`));
    }, 5000);
    const listener = (message) => {
      if (message.method === 'Network.requestWillBeSent' && message.params.request.url === targetUrl) {
        matchingRequests.add(message.params.requestId);
      }
      if (message.method === 'Network.loadingFailed' && matchingRequests.has(message.params.requestId)) {
        clearTimeout(timeout);
        eventListeners.delete(listener);
        resolve(message.params);
      }
    };
    eventListeners.add(listener);
  });
}

await command('Network.enable');
const blockedRequest = waitForBlockedRequest();
await command('Runtime.evaluate', {
  expression: `fetch(${JSON.stringify(targetUrl)}).catch(() => undefined)`,
});
const failure = await blockedRequest;
if (failure.errorText !== 'net::ERR_BLOCKED_BY_CLIENT') {
  throw new Error(`Expected ERR_BLOCKED_BY_CLIENT, received ${failure.errorText}`);
}

const result = {
  labId: 'baseline-manual',
  verdict: '原生支持',
  checks: [
    {
      id: 'remote-http-blocked',
      passed: true,
      detail: `${targetUrl} -> ${failure.errorText}`,
    },
    {
      id: 'sandbox-preload-available',
      passed: true,
      detail: 'window.lecSpike.saveResult invoked through Electron 44 CDP',
    },
  ],
  evidence: [
    'electron@44.0.0',
    'https://www.electronjs.org/docs/latest/tutorial/sandbox',
  ],
  commercialDecision: { status: 'not-needed' },
};

const saved = await command('Runtime.evaluate', {
  expression: `window.lecSpike.saveResult(${JSON.stringify(result)})`,
  awaitPromise: true,
  returnByValue: true,
});
if (saved.exceptionDetails) throw new Error(saved.exceptionDetails.text);

socket.close();
console.log(JSON.stringify({ targetUrl, errorText: failure.errorText, resultFile: 'results/baseline-manual.json' }));
