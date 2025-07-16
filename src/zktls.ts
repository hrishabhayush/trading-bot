import dotenv from "dotenv";
dotenv.config({ quiet: true });
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { PrimusCoreTLS } from "@primuslabs/zktls-core-sdk"

const mode = 'auto';
const owner = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));


export async function primusProof(tokenAddress: string, amount: number) {
    // Initialize parameters, the init function is recommended to be called when the page is initialized.
    const appId = process.env.ZKTLS_APP_ID!;
    const appSecret= process.env.ZKTLS_APP_SECRET!; 

    const zkTLS = new PrimusCoreTLS();

    const initAttestaionResult = await zkTLS.init(appId, appSecret, mode);
    console.log("primusProof initAttestaionResult=", initAttestaionResult);

    // Generate attestation request.
    const request = {
        url: "https://pumpportal.fun/api/trade-local",
        method: "POST",
        header: {
            "Content-Type": "application/json"
        },
        body: {
            "publicKey": owner.publicKey.toBase58(),
            "action": "buy",
            "mint": tokenAddress,
            "denominatedInSol": "true",     // "true" if amount is amount of SOL, "false" if amount is number of tokens
            "amount": amount,                  // amount of SOL or tokens
            "slippage": 5,                  // percent slippage allowed
            "priorityFee": 0.00001,          // priority fee
            "pool": "auto",
        }
    } as const;
    
    const responseResolves = [
        {
            keyName: 'rawTx',
            parseType: 'json',
            parsePath: '$.rawTx'
        }
    ];
    
    // Generate attestation request
    const generateRequest = zkTLS.generateRequestParams(request, responseResolves);

    generateRequest.setAttMode({
        algorithmType: "proxytls",
    });

    // Start attestation process.
    console.time("zktls prove");
    generateRequest.setSslCipher("ECDHE-ECDSA-AES128-GCM-SHA256");
    const attestation = await zkTLS.startAttestation(generateRequest);
    console.timeEnd("zktls prove");
    console.log("attestation=", attestation);

    console.time("zktls verify");
    const verifyResult = zkTLS.verifyAttestation(attestation);
    console.timeEnd("zktls verify");
    console.log("verifyResult=", verifyResult);

    return attestation;
  } 