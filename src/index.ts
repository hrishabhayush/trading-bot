import dotenv from "dotenv";
import { getTweets } from "./get-tweets";
import { getTokenFromLLM } from "./get-token-from-llm";
dotenv.config({ quiet: true });

async function main() {
    // const newTweets = await getTweets(userName);

    // for (tweet of newTweets) {
    //     const tokenAddress = await getTokenFromLLM(tweet.description);
    //     if (tokenAddress) {
    //         const txn = await createSwapInstruction();
    //         for (let i =0; i < SPAM_COUNT; i++) {
    //             sendTxn(txn);

    const tokenAddress = await getTokenFromLLM("When everyone finally wakes up to the potential to $BRETT on $ETH,  just like $PEPE. They're gonna start buying it. AyPNhxMEh5n44T8GhFCCzQzUXh2tTRagpQduVYeEpump");

    console.log(tokenAddress);
}

main();