import WebSocket from "ws";
import EventEmitter from "events";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

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
        // token trade messages: { mint, price } or { mint, priceSol }
        if (parsed.mint && (parsed.price || parsed.priceSol)) {
          const raw = parsed.priceSol ?? parsed.price ?? parsed.priceLamports ?? parsed.lamports;
          let priceSol = typeof raw === "string" ? parseFloat(raw) : raw;
          // If the message used `price` (lamports) instead of `priceSol` (SOL) convert it.
          if (parsed.price !== undefined && parsed.priceSol === undefined) {
            priceSol = priceSol / LAMPORTS_PER_SOL;
          }
          this.emit("price", parsed.mint as string, priceSol as number);
        // ---- NEW: handle messages packed inside `params` array ---- //
        } else if (Array.isArray(parsed.params) && parsed.params.length >= 2) {
          const maybeMint = parsed.params[0];
          const priceObj = parsed.params[1] || {};
          const raw = priceObj.priceSol ?? priceObj.price ?? priceObj.priceLamports ?? priceObj.lamports;
          if (typeof maybeMint === "string" && raw !== undefined) {
            let priceSol = typeof raw === "string" ? parseFloat(raw) : raw;
            if (priceObj.price !== undefined && priceObj.priceSol === undefined) {
              priceSol = priceSol / LAMPORTS_PER_SOL;
            }
            this.emit("price", maybeMint, priceSol as number);
          }
        } else if (Array.isArray(parsed)) {
          const maybeMint = parsed[0];
          const priceVal = parsed[1];
          if (typeof maybeMint === "string" && (typeof priceVal === "number" || typeof priceVal === "string")) {
            let priceSol = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
            // Unable to distinguish lamports vs SOL here; assume lamports if > 1000 SOL
            if (priceSol > 10_000) {
              priceSol = priceSol / LAMPORTS_PER_SOL;
            }
            this.emit("price", maybeMint, priceSol);
          }
        } else if (parsed.method === "trade.update" && Array.isArray(parsed.params) && parsed.params.length) {
          const obj = parsed.params[0] || {};
          const raw = obj.priceSol ?? obj.price ?? obj.priceLamports ?? obj.lamports;
          if (obj.mint && raw !== undefined) {
            let priceSol = typeof raw === "string" ? parseFloat(raw) : raw;
            if (obj.price !== undefined && obj.priceSol === undefined) {
              priceSol = priceSol / LAMPORTS_PER_SOL;
            }
            this.emit("price", obj.mint, priceSol as number);
          }
        } else {
          // debug once in a while
          if (parsed.mint || parsed.method === "tokenTrade" || parsed.method === "trade.update") {
            console.debug("[PumpPortalFeed] Unhandled trade msg", parsed);
          }
        }
        // Emit debug for unmatched tokenTrade
        if (parsed.method === "tokenTrade" && !parsed.mint && Array.isArray(parsed.params)) {
          console.debug("[PumpPortalFeed] tokenTrade params received but no price parsed", parsed.params.slice(0, 3));
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
