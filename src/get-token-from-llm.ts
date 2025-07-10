import OpenAI from "openai";
import dotenv from "dotenv";
import { TokenListProvider } from "@solana/spl-token-registry";

dotenv.config({ quiet: true });

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

let tokenMap: Map<string, string> = new Map();

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

    const response = await getTokenFromLLM(contents);

    if (response === "null") return "null";

    // Check if it's likely a base58 Solana address
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (base58Regex.test(response)) {
        return response;
    }

    const mint = tokenMap?.get(response.toUpperCase());
    return mint ?? "null";
}