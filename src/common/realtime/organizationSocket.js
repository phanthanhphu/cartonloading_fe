import { WS_ORGANIZATION_URL } from '../../appEnv';
import { getStoredToken } from '../../routes/globalApi';
import { ORGANIZATION_REALTIME as RT } from '../../constants/appConstants';

// Singleton shared across screens: WebSocket carries invalidation events, never complete records.
const listeners = new Set();
let socket = null;
let connected = false;
let stopped = true;
let retryTimer = null;
let retryDelay = RT.RETRY_MS;
let nextSubscriptionId = 0;
const topicSubscriptions = new Map();
let buffer = '';

const sendFrame = (command, headers = {}) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const lines = [command, ...Object.entries(headers).map(([key, value]) => `${key}:${value}`)];
  socket.send(`${lines.join('\n')}\n\n\0`);
};

const topicsNeeded = () => {
  const modules = new Set([...listeners].map((entry) => entry.module));
  const topics = new Set();
  if (modules.has(RT.FACTORY)) topics.add(RT.FACTORIES_TOPIC);
  if (modules.has(RT.DEPARTMENT) || modules.has(RT.USER)) topics.add(RT.ADMIN_TOPIC);
  return topics;
};

const reconcileSubscriptions = () => {
  if (!connected) return;
  const required = topicsNeeded();
  for (const [topic, id] of topicSubscriptions) {
    if (!required.has(topic)) {
      sendFrame('UNSUBSCRIBE', { id });
      topicSubscriptions.delete(topic);
    }
  }
  for (const topic of required) {
    if (topicSubscriptions.has(topic)) continue;
    const id = `org-${++nextSubscriptionId}`;
    topicSubscriptions.set(topic, id);
    sendFrame('SUBSCRIBE', { id, destination: topic, ack: 'auto' });
  }
};

const broadcast = (notice) => {
  for (const entry of [...listeners]) {
    if (notice.module === entry.module || notice.module === RT.SYNC) {
      try { entry.callback(notice); } catch (error) { console.error('Organization refresh failed', error); }
    }
  }
};

const receive = (raw) => {
  buffer += typeof raw === 'string' ? raw : '';
  // Native STOMP frames end at NUL; heartbeat newlines are ignored.
  while (buffer.includes('\0')) {
    const end = buffer.indexOf('\0');
    const frame = buffer.slice(0, end).trimStart();
    buffer = buffer.slice(end + 1);
    const separator = frame.indexOf('\n\n');
    if (separator < 0) continue;
    const command = frame.slice(0, frame.indexOf('\n')).trim();
    if (command === 'CONNECTED') {
      connected = true;
      retryDelay = RT.RETRY_MS;
      reconcileSubscriptions();
      // Resync after a reconnect to cover changes while the socket was offline.
      broadcast({ module: RT.SYNC, action: 'RECONNECTED' });
    } else if (command === 'MESSAGE') {
      try {
        const notice = JSON.parse(frame.slice(separator + 2));
        if (typeof notice?.module === 'string') broadcast(notice);
      } catch (error) { console.error('Invalid organization event', error); }
    } else if (command === 'ERROR') {
      socket?.close();
    }
  }
};

const connect = () => {
  if (stopped || socket || !listeners.size) return;
  const token = getStoredToken();
  if (!token) { scheduleReconnect(); return; }
  try {
    const client = new WebSocket(WS_ORGANIZATION_URL, ['v12.stomp', 'v11.stomp']);
    socket = client;
    client.onopen = () => {
      // Bearer is a STOMP CONNECT header, not a query parameter or browser HTTP header.
      sendFrame('CONNECT', { 'accept-version': '1.2,1.1', host: new URL(WS_ORGANIZATION_URL).host, 'heart-beat': '0,0', authorization: `Bearer ${token}` });
    };
    client.onmessage = (event) => receive(event.data);
    client.onerror = () => { /* onclose performs bounded backoff retry */ };
    client.onclose = () => {
      if (socket !== client) return;
      socket = null;
      connected = false;
      topicSubscriptions.clear();
      buffer = '';
      scheduleReconnect();
    };
  } catch { socket = null; scheduleReconnect(); }
};

function scheduleReconnect() {
  if (stopped || !listeners.size || retryTimer !== null) return;
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RT.MAX_RETRY_MS);
  retryTimer = setTimeout(() => { retryTimer = null; connect(); }, delay);
}

/** Register a module-specific invalidation listener; unsubscribe on component unmount. */
export function subscribeOrganizationChanges(module, callback) {
  const entry = { module, callback };
  listeners.add(entry);
  stopped = false;
  if (!socket) connect();
  else reconcileSubscriptions();
  return () => {
    listeners.delete(entry);
    if (listeners.size) { reconcileSubscriptions(); return; }
    stopped = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    connected = false;
    topicSubscriptions.clear();
    buffer = '';
    const closing = socket;
    socket = null;
    closing?.close();
  };
}
