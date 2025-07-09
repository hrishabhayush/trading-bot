import { Connection, Keypair, PublicKey,Transaction, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'
import axios from 'axios'
import { API_URLS } from '@raydium-io/raydium-sdk-v2'
import bs58 from 'bs58'
import dotenv from 'dotenv'

dotenv.config({ quiet: true });

const isV0Tx = true;

const connection = new Connection(process.env.RPC_URL!); 

const slippage = 5;

const owner = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));

export async function swap(tokenAddress: string, amount: number) {

    // get statistical transaction fee from API
    // vh: very high
    // h: high
    // m: medium
    const { data } = await axios.get<{
        id: string
        success: boolean
        data: { default: { vh: number; h: number; m: number } }
    }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)

    // Get the swap response
    const { data: swapResponse } = await axios.get(
        `${
          API_URLS.SWAP_HOST
        }/compute/swap-base-in?inputMint=${NATIVE_MINT}&outputMint=${tokenAddress}&amount=${amount}&slippageBps=${
          slippage * 100}&txVersion=V0`
    );
    
    // Get the swap transactions
    const { data: swapTransactions } = await axios.post<{
        id: string,
        version: string,
        success: boolean,
        data: { transaction: string }[]
    }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
        computeUnitPriceMicroLamports: String(data.data.default.h),
        swapResponse,
        txVersion: 'V0',
        wallet: owner.publicKey.toBase58(),
        wrapSol: true,
        unwrapSol: false, // true means output mint receive sol, false means output mint received wsol
    })

    // Deserialize the transaction 
    const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'))
    const allTransactions = allTxBuf.map((txBuf) =>
      isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
    )


    console.log(`total ${allTransactions.length} transactions`, swapTransactions)

    // Sign and execute the transaction
    let idx = 0
    
    for (const tx of allTransactions) {
        idx++
        const transaction = tx as VersionedTransaction
        transaction.sign([owner])
        const txId = await connection.sendTransaction(tx as VersionedTransaction, { skipPreflight: true })
        const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
            commitment: 'finalized',
        })
        console.log(`${idx} transaction sending..., txId: ${txId}`)
        await connection.confirmTransaction(
            {
            blockhash,
            lastValidBlockHeight,
            signature: txId,
            },
            'confirmed'
        )
        console.log(`${idx} transaction confirmed`)
    }
}