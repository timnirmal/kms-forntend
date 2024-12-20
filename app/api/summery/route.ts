import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // Format messages for inclusion in the prompt
        const formattedMessages = messages
            .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
            .join('\n');

        const prompt = `Generate a specific and contextual summary for a chat conversation that starts with these messages. 
The summary should capture the main points or purpose of the conversation. 
At the end, add a section where the user can understand the context of the last few messages to seamlessly re-enter the chat.

Messages:
${formattedMessages}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 1000,
        });

        const summery = completion.choices[0].message.content?.trim() || 'New Chat';

        console.log(summery)

        return NextResponse.json({
            summery: summery,
            status: 200
        });
    } catch (error) {
        console.error('Error generating title:', error);
        return NextResponse.json(
            { title: 'New Chat' },
            { status: 200 }
        );
    }
} 