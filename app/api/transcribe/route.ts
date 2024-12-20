import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY });

export async function POST(req) {
    try {
        const { audio } = await req.json();
        const buffer = Buffer.from(audio, "base64");
        // Ensure tmp directory exists
        const tmpDir = path.join(process.cwd(), "tmp"); // Adjusts to your project's root directory
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Define the full file path
        const filePath = path.join(tmpDir, "input.wav");

        // Save the buffer to a temporary file
        fs.writeFileSync(filePath, buffer);

        // Transcribe the audio file
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
        });

        // Clean up the temporary file
        fs.unlinkSync(filePath);

        return NextResponse.json({ text: transcription.text });
    } catch (error) {
        console.error("Error during transcription:", error);
        return NextResponse.error();
    }
}
