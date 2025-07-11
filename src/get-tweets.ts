import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const TWEET_MAX_TIME_MS = 1 * 60 * 1000;

interface Tweet {
    contents: string;
    id: string;
    createdAt: string;
}

export async function getTweets(userName: string) : Promise<Tweet[]> {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://twttrapi.p.rapidapi.com/user-tweets?username=${userName}`,
      headers: { 
        'x-rapidapi-host': 'twttrapi.p.rapidapi.com', 
        'x-rapidapi-key': process.env.RAPID_API_KEY
      }
    };
    
    const response = await axios.request(config);
    // const instructions = response.data.data.user_result.result.timeline_response.timeline.instructions;
    // const addEntries = instructions.find((x: any) => x.__typename === "TimelineAddEntries");
    // const entries = addEntries?.entries || [];
    const timelineResponse = response.data.data.user_result.result.timeline_response.timeline.instructions.filter((x: any) => x.__typename === "TimelineAddEntries");

    const tweets: Tweet[] = [];
    timelineResponse[0].entries.map((x: any) => {
        try {
            tweets.push({
                contents: x.content.content.tweetResult.result.legacy.full_text ?? x.content.content.tweetResult.result.core.user_result.result.legacy.description,
                id: x.content.content.tweetResult.result.core.user_result.result.legacy.id_str,
                createdAt: x.content.content.tweetResult.result.legacy.created_at
            })
        } catch(e) {

        }
    });

    // entries.forEach((entry: any) => {
    //     try {
    //         const tweetResult = entry?.content?.itemContent?.tweet_results?.result;

    //         tweets.push({
    //             contents: tweetResult.legacy.full_text,
    //             id: tweetResult.legacy.id_str,
    //             createdAt: tweetResult.legacy.created_at
    //         })
    //     } catch(e) {

    //     }
    // });

    // Filter out tweets not more than TWEET_MAX_TIME_MS minutes old
    return tweets.filter(x => new Date(x.createdAt).getTime() > Date.now() - TWEET_MAX_TIME_MS);
}