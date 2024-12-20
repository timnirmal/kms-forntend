import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        const prompt = `Generate a specific and contextual title (2-3 words) for a chat conversation that starts with these messages. The title should capture the main topic or purpose of the conversation. Be creative but relevant. Don't use generic words like "Chat" or "Conversation".

User message: "${messages[0]}"
Assistant response: "${messages[1]}"

Generate only the title without any additional text or punctuation.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 10,
        });

        const title = completion.choices[0].message.content?.trim() || 'New Chat';


        // Ensure the title isn't too long or generic
        const cleanedTitle = title.replace(/^["']|["']$/g, ''); // Remove leading/trailing quotes
        const finalTitle = cleanedTitle
            .split(' ')
            .slice(0, 3)
            .join(' ')
            .replace(/^(chat|conversation|discussion)/i, 'Topic');

        return NextResponse.json({
            title: finalTitle,
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