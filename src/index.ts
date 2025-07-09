import dotenv from "dotenv";
import { getTweets } from "./get-tweets";
import { getTokenFromLLM } from "./get-token-from-llm";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { swap } from "./swap";

dotenv.config({ quiet: true });

const SOL_AMOUNT = 0.001 * LAMPORTS_PER_SOL;

async function main() {
    // const newTweets = await getTweets(userName);

    // for (let tweet of newTweets) {
    //     const tokenAddress = await getTokenFromLLM(tweet.contents);
    //     if (tokenAddress !== "null") {
    //         await swap(tokenAddress, SOL_AMOUNT);
    //     }
    // }
    await swap("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", SOL_AMOUNT);
}

main();