import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages.map((msg: any) => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            temperature: 0.3,
            max_tokens: 500,
        });

        return NextResponse.json({
            message: completion.choices[0].message.content,
            status: 200
        });
    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 