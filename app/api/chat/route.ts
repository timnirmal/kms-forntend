import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY,
});

export async function POST(req: Request) {
    try {
        const { query, department, access_level, history, model } = await req.json();

        // Determine the backend URL and endpoint based on the mode
        const backendURL =
            model === 'pro'
                ? process.env.NEXT_PUBLIC_PRO_RETRIVEL_BACKEND
                : process.env.NEXT_PUBLIC_RETRIVEL_BACKEND;

        const endpoint = model === 'pro' ? '/api/route-query' : '/complete-query';

        console.log(`${backendURL}${endpoint}`);

        console.log(department)
        console.log(access_level)
        console.log(query)

        // Step 1: Query the appropriate backend
        const ragResponse = await fetch(`${backendURL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                department: model === 'fast' ? department : undefined, // Only include department for fast mode
                access_level: model === 'fast' ? access_level : undefined, // Only include access_level for fast mode
            }),
        });

        if (!ragResponse.ok) {
            throw new Error('Failed to get context from RAG system');
        }

        const ragData = await ragResponse.json();
        console.log(ragData);

        // Step 2: Extract context, sources, and imageUrls based on the API
        let context = '';
        let sources = [];
        let imageUrls = [];

        if (model === 'pro') {
            // Extract from `/api/route-query` response
            context = ragData.response?.analysis?.join('\n') || 'Error retrieving context';
            sources = ragData.response?.sources || [];
        } else {
            // Extract from `/complete-query` response
            context = ragData.finalanswer || 'Error retrieving context';
            imageUrls = ragData.imageUrls || [];
        }

        // Ensure `sources` and `imageUrls` are always included
        sources = sources || [];
        imageUrls = imageUrls || [];

        // Step 3: Prepare message format for OpenAI
        const formattedContent = `
## History
${history}

## Context
${context}

## Question
${query}
        `;

        console.log('Formatted Content:', formattedContent);

        // Step 4: Call OpenAI's Chat Completion API
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant for VeracityAI. Answer the given question based on the given context.',
                },
                {
                    role: 'user',
                    content: formattedContent,
                },
            ],
            temperature: 0.3,
            max_tokens: 500,
        });

        // Step 5: Return the response
        return NextResponse.json({
            message: completion.choices[0].message.content,
            context: context,
            sources: sources,
            imageUrls: imageUrls,
            status: 200,
            success: true,
        });
    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
