import dotenv from "dotenv";
import { getTweets } from "./get-tweets";
import { getTokenFromLLM } from "./get-token-from-llm";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { swap, sendPortalTransaction } from "./swap";

dotenv.config({ quiet: true });

const SOL_AMOUNT = 0.001;

async function main(userName: string) {
    const newTweets = await getTweets(userName);
    console.log(newTweets);
    for (let tweet of newTweets) {
        const tokenAddress = await getTokenFromLLM(tweet.contents);
        if (tokenAddress !== "null") {
            console.log(`Trying to execute tweet => ${tweet.contents}`);
            await sendPortalTransaction(tokenAddress, SOL_AMOUNT);
        }
    }
}

main("CraftAgent_");