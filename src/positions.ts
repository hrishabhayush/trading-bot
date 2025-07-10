import { getOpenPositions } from "./strategy";

console.table(
    getOpenPositions().map(pos => ({
        mint: pos.mint,
        entrySOL: pos.entryPrice.toFixed(4),
        tokensLeft: pos.sizeTokens,
        highest: pos.highestPrice.toFixed(4),
        ageMin: ((Date.now() - pos.createdAt) / 60000).toFixed(1),
    }))
);