// WebSocket connection with automatic reconnect. Messages sent while offline are
// queued and delivered once the connection is back, so no roll gets lost.

export function connect(sessionId, { onOpen, onMessage, onStatus }) {
  let ws = null;
  let queue = [];
  let attempt = 0;
  let finished = false;

  function open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?session=${encodeURIComponent(sessionId)}`);
    onStatus('connecting');

    ws.addEventListener('open', () => {
      attempt = 0;
      onStatus('online');
      onOpen();
      const pending = queue;
      queue = [];
      for (const m of pending) ws.send(JSON.stringify(m));
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      onMessage(msg);
    });

    ws.addEventListener('close', (e) => {
      if (e.code === 4404 || e.code === 4410) {
        finished = true;
        onStatus(e.code === 4404 ? 'not_found' : 'expired');
        return;
      }
      // 4429: too many devices in this experiment; try again a little later
      onStatus(e.code === 4429 ? 'full' : 'offline');
      const delay = e.code === 4429 ? 15_000 : Math.min(10_000, 500 * 2 ** attempt++);
      setTimeout(open, delay);
    });
  }

  open();

  return {
    send(msg) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else if (!finished) queue.push(msg);
    },
  };
}
