'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools/index.js';
import { instructions } from '@/utils/conversation_config.js';
import { WavRenderer } from '@/utils/wav_renderer';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from "@/utils/supabase/client";
import ConversationView from './ConversationView';
import LogsView from './LogsView';

export default function ConsolePage() {
    const supabase = createClient();

    // Hardcoded category
    const [selectedCategory] = useState('AI');

    // Session & Logging
    const [sessionId] = useState<string>(uuidv4());
    const [showLogs, setShowLogs] = useState(false);

    // Modes: 'text' or 'voice'
    // Start in text mode
    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [hasReturnedToTextMode, setHasReturnedToTextMode] = useState(false);
    // Once we switch to voice and then back to text, we cannot switch to voice again.

    // Chat Method: 'vad' or 'push_to_talk' (hardcoded to push_to_talk for voice mode)
    const [chatMethod] = useState<'vad' | 'push_to_talk'>('push_to_talk');

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_KEY || '';

    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    const clientRef = useRef<RealtimeClient>(
        new RealtimeClient({
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true
        })
    );

    const clientCanvasRef = useRef<HTMLCanvasElement>(null);
    const serverCanvasRef = useRef<HTMLCanvasElement>(null);
    const eventsScrollHeightRef = useRef(0);
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    const startTimeRef = useRef<string>(new Date().toISOString());

    const [items, setItems] = useState<ItemType[]>([]);
    const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);
    const [expandedEvents, setExpandedEvents] = useState<{ [key: string]: boolean }>({});
    const [isConnected, setIsConnected] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(chatMethod === 'push_to_talk');
    const [isRecording, setIsRecording] = useState(false);

    const formatTime = useCallback((timestamp: string) => {
        const t0 = new Date(startTimeRef.current).valueOf();
        const t1 = new Date(timestamp).valueOf();
        const delta = t1 - t0;
        const hs = Math.floor(delta / 10) % 100;
        const s = Math.floor(delta / 1000) % 60;
        const m = Math.floor(delta / 60_000) % 60;
        const pad = (n: number) => (n < 10 ? `0${n}` : n.toString());
        return `${pad(m)}:${pad(s)}.${pad(hs)}`;
    }, []);

    const connectConversation = useCallback(async () => {
        if (!selectedCategory) {
            alert('No category selected!');
            return;
        }

        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        startTimeRef.current = new Date().toISOString();
        setIsConnected(true);
        setRealtimeEvents([]);
        setItems(client.conversation.getItems());

        await wavRecorder.begin();
        await wavStreamPlayer.connect();
        await client.connect();

        // Send an initial greeting message
        client.sendUserMessageContent([{ type: `input_text`, text: `Hello!` }]);

        // If using VAD (not currently, but if changed), start recording immediately
        if (client.getTurnDetectionType() === 'server_vad' && chatMethod === 'vad') {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
    }, [selectedCategory, chatMethod]);

    const disconnectConversation = useCallback(async () => {
        setIsConnected(false);
        setRealtimeEvents([]);
        setItems([]);

        const client = clientRef.current;
        client.disconnect();

        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        await wavStreamPlayer.interrupt();
    }, []);

    const startRecording = async () => {
        // If not connected, connect first (voice mode only)
        if (!isConnected && mode === 'voice') {
            await connectConversation();
        }

        setIsRecording(true);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        const trackSampleOffset = await wavStreamPlayer.interrupt();
        if (trackSampleOffset?.trackId) {
            const { trackId, offset } = trackSampleOffset;
            await client.cancelResponse(trackId, offset);
        }

        try {
            if (!wavRecorder.recording) {
                await wavRecorder.record((data) => client.appendInputAudio(data.mono));
            }
        } catch (e) {
            console.error('Error starting recorder:', e);
            setIsRecording(false);
        }
    };

    const stopRecording = async () => {
        if (!isRecording) return; // Don't pause if we are not recording

        setIsRecording(false);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;

        if (wavRecorder.recording) {
            try {
                await wavRecorder.pause();
            } catch (e) {
                console.error('Error pausing recorder:', e);
            }
        }

        client.createResponse();
    };

    const changeTurnEndType = async (value: string) => {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        if (value === 'none' && wavRecorder.getStatus() === 'recording') {
            await wavRecorder.pause();
        }
        client.updateSession({
            turn_detection: value === 'none' ? null : { type: 'server_vad' },
        });
        if (value === 'server_vad' && client.isConnected()) {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
        setCanPushToTalk(value === 'none');
    };

    // Handle sending text messages in text mode
    const [textInput, setTextInput] = useState('');

    const sendTextMessage = () => {
        if (mode === 'text' && textInput.trim()) {
            // Just append to local conversation in text mode (no realtime connection)
            setItems((prev) => [
                ...prev,
                {
                    id: uuidv4(),
                    role: 'user',
                    type: 'input_text',
                    formatted: { text: textInput.trim() }
                }
            ]);
            setTextInput('');
        }
    };

    // Switch between modes
    const switchMode = async () => {
        if (mode === 'text') {
            // Switch to voice mode
            await connectConversation();
            setMode('voice');
        } else {
            // Switch back to text mode from voice mode
            await disconnectConversation();
            setMode('text');
            setHasReturnedToTextMode(true);
        }
    };

    useEffect(() => {
        if (eventsScrollRef.current) {
            const eventsEl = eventsScrollRef.current;
            const scrollHeight = eventsEl.scrollHeight;
            if (scrollHeight !== eventsScrollHeightRef.current) {
                eventsEl.scrollTop = scrollHeight;
                eventsScrollHeightRef.current = scrollHeight;
            }
        }
    }, [realtimeEvents]);

    useEffect(() => {
        const conversationEls = [].slice.call(document.body.querySelectorAll('[data-conversation-content]'));
        for (const el of conversationEls) {
            const conversationEl = el as HTMLDivElement;
            conversationEl.scrollTop = conversationEl.scrollHeight;
        }
    }, [items]);

    useEffect(() => {
        let isLoaded = true;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        const clientCanvas = clientCanvasRef.current;
        let clientCtx: CanvasRenderingContext2D | null = null;

        const serverCanvas = serverCanvasRef.current;
        let serverCtx: CanvasRenderingContext2D | null = null;

        const render = () => {
            if (isLoaded) {
                if (clientCanvas) {
                    if (!clientCanvas.width || !clientCanvas.height) {
                        clientCanvas.width = clientCanvas.offsetWidth;
                        clientCanvas.height = clientCanvas.offsetHeight;
                    }
                    clientCtx = clientCtx || clientCanvas.getContext('2d');
                    if (clientCtx) {
                        clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
                        const result = wavRecorder.recording
                            ? wavRecorder.getFrequencies('voice')
                            : { values: new Float32Array([0]) };
                        WavRenderer.drawBars(clientCanvas, clientCtx, result.values, '#0099ff', 10, 0, 8);
                    }
                }

                if (serverCanvas) {
                    if (!serverCanvas.width || !serverCanvas.height) {
                        serverCanvas.width = serverCanvas.offsetWidth;
                        serverCanvas.height = serverCanvas.offsetHeight;
                    }
                    serverCtx = serverCtx || serverCanvas.getContext('2d');
                    if (serverCtx) {
                        serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
                        const result = wavStreamPlayer.analyser
                            ? wavStreamPlayer.getFrequencies('voice')
                            : { values: new Float32Array([0]) };
                        WavRenderer.drawBars(serverCanvas, serverCtx, result.values, '#009900', 10, 0, 8);
                    }
                }

                window.requestAnimationFrame(render);
            }
        };
        render();

        return () => {
            isLoaded = false;
        };
    }, []);

    useEffect(() => {
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const client = clientRef.current;

        client.updateSession({ instructions: instructions });
        client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

        // Add RAG query tool
        client.addTool(
            {
                name: 'rag_query',
                description: 'Query the RAG system to answer questions about the documentation',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The question to be answered using the RAG system',
                        }
                    },
                    required: ['query']
                }
            },
            async ({ query }: { query: string }) => {
                try {
                    const response = await fetch('http://localhost:11000/complete-query', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            query,
                            department: [selectedCategory],
                            access_level: 1
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to get response from RAG system');
                    }

                    const result = await response.json();
                    return result;
                } catch (error) {
                    console.error('Error querying RAG system:', error);
                    return {
                        answer: 'Sorry, I encountered an error while trying to answer your question. Please try again.',
                        sources: []
                    };
                }
            }
        );

        client.on('realtime.event', (realtimeEvent: any) => {
            setRealtimeEvents((realtimeEvents) => {
                const lastEvent = realtimeEvents[realtimeEvents.length - 1];
                if (lastEvent?.event.type === realtimeEvent.event.type) {
                    lastEvent.count = (lastEvent.count || 0) + 1;
                    return realtimeEvents.slice(0, -1).concat(lastEvent);
                } else {
                    return realtimeEvents.concat(realtimeEvent);
                }
            });
        });

        client.on('error', (event: any) => console.error(event));

        client.on('conversation.interrupted', async () => {
            const trackSampleOffset = await wavStreamPlayer.interrupt();
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                await client.cancelResponse(trackId, offset);
            }
        });

        // Insert messages into Supabase
        async function insertMessageIntoDB(item: ItemType) {
            const role = item.role || (item.type === 'function_call_output' ? 'function' : 'system');
            const message = item.formatted?.text || item.formatted?.transcript || '';
            const function_call = item.formatted?.tool || null;
            const context = item.formatted?.tool ? JSON.stringify(item.formatted.tool) : null;

            await supabase.from('history').insert([{
                session_id: sessionId,
                role: role,
                message: message,
                context: context,
                function_call: function_call,
            }]);
        }

        client.on('conversation.updated', async ({ item, delta }: any) => {
            const newItems = client.conversation.getItems();

            // If there's audio, add to player
            if (delta?.audio) {
                wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id);
            }

            // If item completed with audio, decode
            if (item.status === 'completed' && item.formatted.audio?.length) {
                try {
                    const wavFile = await WavRecorder.decode(item.formatted.audio, 24000, 24000);
                    item.formatted.file = wavFile;
                    console.log('Decoded audio file:', wavFile);
                } catch (error) {
                    console.error('Error decoding audio file:', error);
                }
            }

            setItems(newItems);
            insertMessageIntoDB(item).catch(console.error);
        });

        setItems(client.conversation.getItems());

        return () => {
            client.reset();
        };
    }, [sessionId, selectedCategory, supabase]);

    const deleteConversationItem = useCallback((id: string) => {
        const client = clientRef.current;
        client.deleteItem(id);
    }, []);

    return (
        <div
            // className="flex flex-col min-h-screen bg-gradient-to-b from-zinc-200 to-white dark:from-zinc-900 dark:to-black text-gray-600 dark:text-gray-300 px-4"
        >
            {/*<div className="w-full flex items-center justify-between py-4">*/}
            {/*    <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">*/}
            {/*        Knowledge Management Chat*/}
            {/*    </h1>*/}
            {/*    <div className="flex gap-4">*/}
            {/*        <button*/}
            {/*            className="inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-colors"*/}
            {/*            onClick={switchMode}*/}
            {/*            disabled={hasReturnedToTextMode && mode === 'text'}*/}
            {/*        >*/}
            {/*            {mode === 'text' ? (hasReturnedToTextMode ? 'Text Mode (Voice disabled)' : 'Switch to Voice Mode') : 'Switch to Text Mode'}*/}
            {/*        </button>*/}
            {/*    </div>*/}
            {/*</div>*/}

            <div
                // className="flex flex-col md:flex-row gap-4 flex-1"
            >
                <ConversationView
                    items={items}
                    mode={mode}
                    chatMethod={chatMethod}
                    isConnected={isConnected}
                    isRecording={isRecording}
                    canPushToTalk={canPushToTalk}
                    startRecording={startRecording}
                    stopRecording={stopRecording}
                    changeTurnEndType={changeTurnEndType}
                    deleteConversationItem={deleteConversationItem}
                    textInput={textInput}
                    setTextInput={setTextInput}
                    sendTextMessage={sendTextMessage}
                />

                <LogsView
                    showLogs={showLogs}
                    setShowLogs={setShowLogs}
                    realtimeEvents={realtimeEvents}
                    expandedEvents={expandedEvents}
                    setExpandedEvents={setExpandedEvents}
                    formatTime={formatTime}
                    clientCanvasRef={clientCanvasRef}
                    serverCanvasRef={serverCanvasRef}
                    eventsScrollRef={eventsScrollRef}
                />
            </div>
        </div>
    );
}
