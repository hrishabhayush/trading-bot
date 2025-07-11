import EventEmitter from "events";
import { sendPortalTransaction } from "./swap";

type Mint = string;

interface Position {
    mint: Mint;
    entryPrice: number; // 0 until first price seen
    sizeTokens: number; // optional for % sells
    realizedSol: number;
    highestPrice: number;
    lastPrice: number; // latest price seen
    createdAt: number;
    hardStopPct: number;
    trailingPct: number;
    sold50Done: boolean;
    sold100Done: boolean;
    sold300Done: boolean;
}

export class Strategy extends EventEmitter {
    /** open positions keyed by token mint */
    private positions = new Map<Mint, Position>();

    // Call this right after successful swap
    addPosition(mint: Mint, entryPrice: number, sizeTokens: number) {
        this.positions.set(mint, {
            mint,
            entryPrice,
            sizeTokens,
            realizedSol: 0,
            highestPrice: entryPrice,
            lastPrice: entryPrice, // initialise lastPrice
            createdAt: Date.now(),
            hardStopPct: -0.30,
            trailingPct: 0.25,
            sold50Done: false,
            sold100Done: false,
            sold300Done: false,
        });
        console.log(`[STRAT] new position ${mint} @ ${entryPrice.toFixed(4)} SOL`);
    }

    // Call on every trade message from PumpPortal. 
    async onPrice(mint: Mint, lastPrice: number) {
        const position = this.positions.get(mint);
        if (!position) {
            return;
        }

        // initialise entryPrice on first tick if unknown (0)
        if (position.entryPrice === 0) {
            position.entryPrice = lastPrice;
            console.log(`[STRAT] ${mint} entryPrice set to ${lastPrice.toFixed(4)} SOL`);
        }
        position.lastPrice = lastPrice; // keep current price

        if (lastPrice > position.highestPrice) {
            position.highestPrice = lastPrice;
        }

        const pnl = (lastPrice / position.entryPrice - 1) * 100;
        console.log(`[STRAT] ${mint} price: ${lastPrice.toFixed(4)} SOL, PNL: ${pnl.toFixed(1)}%`);

            // ------- partial TPs ------- //
        if (!position.sold50Done && pnl >= 30) {
            await this.takeProfit(position, 0.4, 0.30);
            position.sold50Done = true;
        }        
        if (!position.sold100Done && pnl >= 75) {
            await this.takeProfit(position, 0.3, 0.75);
            position.sold100Done = true;
        }
        if (!position.sold300Done && pnl >= 150) {
            await this.takeProfit(position, 0.3, 1.50);
            position.sold300Done = true;
        } 
         // ------- trailing stop (only once > +50 %) -------
        if (pnl >= 50) {
            const stopPrice = position.highestPrice * (1 - position.trailingPct);
            if (lastPrice <= stopPrice) {
                await this.close(position, "TRAIL");
            }
        }
    
        // ------- hard stop -------
        if (lastPrice <= position.entryPrice * (1 + position.hardStopPct)) {
            await this.close(position, "HARD");
        }

        // ------- time stop (2 hours) -------
        if (Date.now() - position.createdAt > 2 * 60 * 60 * 1000) {
            await this.close(position, "TIME");
        }
    }

    // --------- runtime controls --------- //
    updateHardStop(mint: Mint, newPct: number) {
        const pos = this.positions.get(mint);
        if (pos) {
            pos.hardStopPct = newPct;
            console.log(`[STRAT] ${mint} hardStop set to ${newPct * 100}%`);
        }
    }

    updateTrailingStop(mint: Mint, newPct: number) {
        const pos = this.positions.get(mint);
        if (pos) {
            pos.trailingPct = newPct;
            console.log(`[STRAT] ${mint} trailingStop set to ${newPct * 100}%`);
        }
    }

    // ---------- helpers ---------- //
    private async takeProfit(pos: Position, pctToSell: number, realisedGainPct: number) {
        // Build percentage string PumpPortal expects, e.g. "40%"
        const percentStr = `${Math.round(pctToSell * 100)}%`;

        await this.sellTokens(pos, percentStr, `TP +${realisedGainPct * 100}%`);

        // Bookkeeping: we don’t recompute entryPrice; just shrink size
        pos.sizeTokens = pos.sizeTokens * (1 - pctToSell);
        // realised SOL ≈ pct sold * current price * sizeOld
        // (exact current price should be passed-in; omitted for brevity)
    }

    private async close(pos: Position, reason: string) {
        await this.sellTokens(pos, "100%", reason);
        this.positions.delete(pos.mint);
    }

    private async sellTokens(pos: Position, amount: string | number, reason: string) {
        console.log(`[STRAT] ${reason}: sell ${amount} of ${pos.mint}`);
        await sendPortalTransaction(pos.mint, amount, "sell", false);
        this.emit("sold", { mint: pos.mint, amount, reason });
    }
}

// Singleton instance used across the app
export const strategy = new Strategy();

export function getOpenPositions() {
    return [...strategy["positions"].values()];
  }

// Produce table-friendly snapshot of live positions + PnL
export function getPnlSnapshot() {
    return getOpenPositions().map((pos) => {
        const pnlPct = pos.entryPrice > 0 ? ((pos.lastPrice / pos.entryPrice - 1) * 100) : 0;
        return {
            mint: pos.mint,
            entrySOL: pos.entryPrice.toFixed(4),
            lastSOL: pos.lastPrice.toFixed(4),
            pnlPct: pnlPct.toFixed(1),
            tokensLeft: pos.sizeTokens,
            highest: pos.highestPrice.toFixed(4),
            ageMin: ((Date.now() - pos.createdAt) / 60000).toFixed(1),
        };
    });
}