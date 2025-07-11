import OpenAI from "openai";
import dotenv from "dotenv";
import { TokenListProvider } from "@solana/spl-token-registry";

dotenv.config({ quiet: true });

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

let tokenMap: Map<string, string> = new Map();

// ---------- fast local extractors ---------- //
function extractMintAddress(text: string): string | null {
    // Solana CAs are base58, 32–44 chars, excluding 0,O,l etc.
    const regex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    const match = text.match(regex);
    return match ? match[0] : null;
}

function extractTicker(text: string): string | null {
    // Expect a $TICKER pattern (2-10 alphanum chars)
    const regex = /\$([A-Za-z0-9]{2,10})/;
    const match = regex.exec(text);
    return match ? match[1].toUpperCase() : null;
}

export async function getTokenFromLLM(contents: string): Promise<string> {
    
    const completion = await client.chat.completions.create({
        model: "gpt-4o",
        store: true,
        messages: [
            {"role": "system", "content": "You are an expert crypto trader and analyst. You need to find either the token address or the token ticker in a tweet, only if it is a bullish post. The token address is a base58-encoded Solana mint address, 32–44 characters long. If no mint address is found, try to extract the token **ticker** (e.g., $DOGGO). Return just the mint address or the ticker (without $), or null if nothing is found or the post is not bullish."},
            {"role": "user", "content": contents}
        ]
    });

    return completion.choices[0].message.content ?? "null";
}

async function loadTokenMap() {
    if (tokenMap.size === 0) {
        const tokenList = await new TokenListProvider()
        .resolve()
        .then(tokens => tokens.filterByClusterSlug("mainnet-beta").getList());

        tokenMap = new Map(tokenList.map(t => [t.symbol.toUpperCase(), t.address]));
    }
}

export async function resolveTokenAddress(contents: string) : Promise<string> {
    await loadTokenMap();

    // 1) direct contract address present
    const mintDirect = extractMintAddress(contents);
    if (mintDirect) {
        return mintDirect;
    }

    // 2) ticker present and found in registry
    const ticker = extractTicker(contents);
    if (ticker) {
        const mintFromTicker = tokenMap.get(ticker);
        if (mintFromTicker) {
            return mintFromTicker;
        }
    }

    // 3) fallback to LLM (may return CA or ticker)
    const response = await getTokenFromLLM(contents);
    if (response === "null") return "null";

    // if LLM returns a CA, trust it
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (base58Regex.test(response)) {
        return response;
    }

    // else treat as ticker
    const mint = tokenMap.get(response.toUpperCase());
    return mint ?? "null";
}