import WebSocket from "ws";
import EventEmitter from "events";

/**
 * Singleton market data feed using ONE PumpPortal websocket.
 * Usage:
 *   feed.on("price", (mint: string, priceSol: number) => { ... })
 *   feed.subscribe([mintA, mintB]);
 *   feed.unsubscribe([mintA]);
 */
class PumpPortalFeed extends EventEmitter {
  private ws: WebSocket;
  private readonly url = "wss://pumpportal.fun/api/data";
  private pending: string[] = [];

  constructor() {
    super();
    this.ws = new WebSocket(this.url);
    this.wire();
  }

  /** Subscribe to trade stream for given mints (array of base58 strings) */
  subscribe(mints: string[]) {
    if (mints.length === 0) return;
    const msg = JSON.stringify({ method: "subscribeTokenTrade", keys: mints });
    this.send(msg);
  }

  /** Unsubscribe from trade stream for given mints */
  unsubscribe(mints: string[]) {
    if (mints.length === 0) return;
    const msg = JSON.stringify({ method: "unsubscribeTokenTrade", keys: mints });
    this.send(msg);
  }

  // ---------- internal helpers ---------- //
  private send(msg: string) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.pending.push(msg);
    }
  }

  private wire() {
    this.ws.on("open", () => {
      // flush any queued messages
      this.pending.forEach((m) => this.ws.send(m));
      this.pending = [];
    });

    this.ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        // token trade messages include { mint, price } according to docs
        if (parsed.mint && parsed.price) {
          const priceSol = typeof parsed.price === "string" ? parseFloat(parsed.price) : parsed.price;
          this.emit("price", parsed.mint as string, priceSol as number);
        }
      } catch (_) {
        // ignore malformed messages
      }
    });

    this.ws.on("close", () => {
      console.warn("[PumpPortalFeed] socket closed – reconnecting in 1s");
      setTimeout(() => {
        this.ws.removeAllListeners();
        this.ws = new WebSocket(this.url);
        this.wire();
      }, 1000);
    });

    this.ws.on("error", (err) => {
      console.error("[PumpPortalFeed] websocket error", err);
    });
  }
}

export const feed = new PumpPortalFeed();
