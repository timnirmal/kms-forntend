import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY,
});

export async function POST(req: Request) {
    try {
        const { query, department, access_level, history } = await req.json();

        console.log(`${process.env.NEXT_PUBLIC_RETRIVEL_BACKEND}/complete-query`)

        const ragResponse = await fetch(`${process.env.NEXT_PUBLIC_RETRIVEL_BACKEND}/complete-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, department, access_level }),
        });

        if (!ragResponse.ok) {
            throw new Error('Failed to get context from RAG system');
        }

        const ragData = await ragResponse.json();
        console.log(ragData.answer) // also this is give success:true you can check if context is available. so when sending the context you can say error retriving context

        // Step 2: Check if context retrieval was successful
        const context = ragData.success === true ? ragData.answer : "Error retrieving context";

        // Step 3: Prepare message format for OpenAI
        const formattedContent = `
## History
${history}

## Context
${context}

## Question
${query}
        `;

        console.log("Formatted Content:", formattedContent);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant for VeracityAI. Answer the given question based on the given context" },
                {
                    role: "user",
                    content: formattedContent,
                },
            ],
            temperature: 0.3,
            max_tokens: 500,
        });

        return NextResponse.json({
            message: completion.choices[0].message.content,
            context: context,
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


