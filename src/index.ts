import dotenv from "dotenv";
import { getTweets } from "./get-tweets";
import { resolveTokenAddress } from "./get-token-from-llm";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { sendPortalTransaction } from "./swap";
import { feed } from "./market-feed";
import { strategy } from "./strategy";
import { usersList } from "./users-list";
import { primusProof } from "./zktls";

dotenv.config({ quiet: true });

const SOL_AMOUNT = 0.001;

async function main(userName: string[]) {
    for (let user of userName) {
        const newTweets = await getTweets(user);
        console.log(newTweets);
        for (let tweet of newTweets) {
            const tokenAddress = await resolveTokenAddress(tweet.contents);
            if (tokenAddress !== "null") {
                console.log(`Trying to execute tweet => ${tweet.contents}`);
                await sendPortalTransaction(tokenAddress, SOL_AMOUNT, "buy", true);

                // start strategy tracking & market data
                strategy.addPosition(tokenAddress, 0, 0);
                feed.subscribe([tokenAddress]);

                // ensure price events flow into strategy
                if (!feed.listenerCount("price")) {
                    feed.on("price", (mint: string, priceSol: number) => {
                        strategy.onPrice(mint, priceSol);
                    });
                }

                // unsubscribe when position closed
                strategy.on("sold", ({ mint }: { mint: string }) => {
                    feed.unsubscribe([mint]);
                });
                await primusProof(tokenAddress, SOL_AMOUNT);
            }
        }
    }
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runLoop() {
  while (true) {
    try {
      await main(usersList);
    } catch (e) {
      console.error("[main] error", e);
    }
    await sleep(60_000); // wait 1 minute before polling again
  }
}

runLoop();