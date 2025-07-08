import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

export async function getTokenFromLLM(contents: string): Promise<string> {
    
    const completion = await client.chat.completions.create({
        model: "gpt-4o",
        store: true,
        messages: [
            {"role": "system", "content": "You are an expert crypto trader and analyst. You need to find the token address in the tweet specifically if it is a bull post. The token address is a base58 encoded string usually 32-44 characters long without any spaces and bytes 32. Return the token address in the tweet if you cant find a token address, you need to return null."},
            {"role": "user", "content": contents}
        ]
    });

    return completion.choices[0].message.content ?? "null";
}
