/** 仅连接截图进程发布的本机 DevTools 端点，封装请求寿命、求值及真实页面截图。 */
interface Reply { id?: number; result?: unknown; error?: { message: string } }
interface Evaluation { result: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description?: string } } }
interface Pending { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
export class DevTools {
  private sequence = 0;
  private readonly pending = new Map<number, Pending>();
  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', event => {
      const reply = JSON.parse(String(event.data)) as Reply;
      if (reply.id === undefined) return;
      const pending = this.pending.get(reply.id);
      if (!pending) return;
      this.pending.delete(reply.id); clearTimeout(pending.timer);
      if (reply.error) pending.reject(new Error(reply.error.message)); else pending.resolve(reply.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Screenshot connection closed')); }
      this.pending.clear();
    });
  }
  static async connect(url: string): Promise<DevTools> {
    if (new URL(url).hostname !== '127.0.0.1') throw new Error('Screenshot debugging must use loopback');
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('Screenshot connection timed out')); }, 10_000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Could not connect to screenshot instance')); }, { once: true });
    });
    return new DevTools(socket);
  }
  private request<T>(method: string, params: object = {}): Promise<T> {
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, 20_000);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate<T>(expression: string): Promise<T> {
    const reply = await this.request<Evaluation>('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
    return reply.result.value as T;
  }
  async reload(): Promise<void> { await this.request('Page.reload'); }
  async size(width: number, height: number, scale: number): Promise<void> {
    await this.evaluate(`window.electron.remote.getCurrentWindow().setContentSize(${width}, ${height})`);
    await this.request('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    await this.request('Page.bringToFront');
  }
  async screenshot(): Promise<Buffer> {
    const result = await this.request<{ data: string }>('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    return Buffer.from(result.data, 'base64');
  }
  close(): void { this.socket.close(); }
}
