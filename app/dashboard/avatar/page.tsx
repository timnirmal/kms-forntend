'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools/index.js';
import { instructions } from '@/utils/conversation_config.js';
import { WavRenderer } from '@/utils/wav_renderer';
import { X, Zap, Mic, MicOff } from 'react-feather';
import { Toggle } from '@/components/toggle/Toggle';
import { v4 as uuidv4 } from 'uuid';
import {createClient} from "@/utils/supabase/client";

export default function ConsolePage() {
    const supabase = createClient();

    // Hardcoded category
    const [selectedCategory] = useState('AI');

    // Session & Logging
    const [sessionId] = useState<string>(uuidv4());
    const [showLogs, setShowLogs] = useState(false);

    // Chat Method: 'vad' or 'push_to_talk'
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
        const pad = (n: number) => {
            let s = n + '';
            while (s.length < 2) {
                s = '0' + s;
            }
            return s;
        };
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
        client.sendUserMessageContent([{ type: `input_text`, text: `Hello!` }]);

        // If using VAD, start recording immediately
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
        setIsRecording(true);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const trackSampleOffset = await wavStreamPlayer.interrupt();
        if (trackSampleOffset?.trackId) {
            const { trackId, offset } = trackSampleOffset;
            await client.cancelResponse(trackId, offset);
        }
        await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    };

    const stopRecording = async () => {
        setIsRecording(false);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.pause();
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
        const clientCanvas = clientCanvasRef.current;
        let clientCtx: CanvasRenderingContext2D | null = null;

        const wavStreamPlayer = wavStreamPlayerRef.current;
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
                wavStreamPlayer.add16BitPCM(delta.audio, item.id);
            }
            // If item completed with audio, decode
            if (item.status === 'completed' && item.formatted.audio?.length) {
                const wavFile = await WavRecorder.decode(item.formatted.audio, 24000, 24000);
                item.formatted.file = wavFile;
            }

            setItems(newItems);
            // Insert this item into the database
            insertMessageIntoDB(item).catch(console.error);
        });

        setItems(client.conversation.getItems());

        return () => {
            client.reset();
        };
    }, [sessionId, selectedCategory]);

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-black text-gray-600 dark:text-gray-300 p-4">
            <div className="flex justify-between items-center mb-4">
                <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                    Knowledge Management Chat
                </div>
                <div className="flex gap-2">
                    {/*<button*/}
                    {/*    onClick={() => setShowLogs(!showLogs)}*/}
                    {/*    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-zinc-800"*/}
                    {/*>*/}
                    {/*    {showLogs ? 'Hide Logs' : 'Show Logs'}*/}
                    {/*</button>*/}
                    <button
                        className={`px-4 py-2 rounded-lg text-white ${
                            isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        onClick={isConnected ? disconnectConversation : connectConversation}
                    >
                        {isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                </div>
            </div>

            {/* Conversation Area */}
            <div className="flex flex-col md:flex-row gap-4 flex-1">
                <div className="flex-1 flex flex-col border border-gray-300 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300 dark:border-gray-600">
                        <div className="font-bold">Conversation</div>
                        <Toggle
                            defaultValue={chatMethod === 'vad'}
                            labels={['manual', 'vad']}
                            values={['none', 'server_vad']}
                            onChange={(_, value) => changeTurnEndType(value)}
                        />
                    </div>
                    <div
                        className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-zinc-900"
                        data-conversation-content
                    >
                        {!items.length && (
                            <div className="text-center text-gray-500 dark:text-gray-400">Awaiting Connection...</div>
                        )}
                        {items.map((conversationItem) => {
                            const role = conversationItem.role || (conversationItem.type === 'function_call_output' ? 'function' : 'system');
                            const isUser = role === 'user';
                            const isAssistant = role === 'assistant';
                            const isFunction = role === 'function';

                            return (
                                <div
                                    key={conversationItem.id}
                                    className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`relative max-w-sm p-3 rounded-xl ${
                                            isUser
                                                ? 'bg-blue-600 text-white'
                                                : isAssistant
                                                    ? 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200'
                                                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200'
                                        }`}
                                    >
                                        {conversationItem.type !== 'function_call_output' && (
                                            <>
                                                {conversationItem.formatted.tool && (
                                                    <div className="italic text-sm text-gray-500 dark:text-gray-400 mb-1">
                                                        Query: {(() => {
                                                        try {
                                                            const args =
                                                                typeof conversationItem.formatted.tool.arguments === 'string'
                                                                    ? JSON.parse(conversationItem.formatted.tool.arguments)
                                                                    : conversationItem.formatted.tool.arguments;
                                                            return args.query || '(No query available)';
                                                        } catch (error) {
                                                            console.error('Error parsing arguments:', error);
                                                            return '(Invalid arguments format)';
                                                        }
                                                    })()}
                                                    </div>
                                                )}
                                                {!conversationItem.formatted.tool && role === 'user' && (
                                                    <div className="whitespace-pre-wrap">
                                                        {conversationItem.formatted.transcript ||
                                                            (conversationItem.formatted.audio?.length
                                                                ? '(awaiting transcript)'
                                                                : conversationItem.formatted.text ||
                                                                '(item sent)')}
                                                    </div>
                                                )}
                                                {!conversationItem.formatted.tool && role === 'assistant' && (
                                                    <div className="whitespace-pre-wrap">
                                                        {conversationItem.formatted.transcript ||
                                                            conversationItem.formatted.text ||
                                                            '(truncated)'}
                                                    </div>
                                                )}
                                                {conversationItem.formatted.file && (
                                                    <audio
                                                        src={conversationItem.formatted.file.url}
                                                        controls
                                                        className="mt-2"
                                                    />
                                                )}
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                const client = clientRef.current;
                                                client.deleteItem(conversationItem.id);
                                            }}
                                            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center p-2 border-t border-gray-300 dark:border-gray-600">
                        {/* If chatMethod === 'push_to_talk' show push-to-talk button */}
                        {chatMethod === 'push_to_talk' && isConnected && canPushToTalk && (
                            <button
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                className={`px-4 py-2 rounded-lg text-white ${isRecording ? 'bg-red-600' : 'bg-blue-600'} hover:bg-blue-700 flex items-center gap-2`}
                            >
                                {isRecording ? <MicOff /> : <Mic />}
                                {isRecording ? 'Release to Send' : 'Push to Talk'}
                            </button>
                        )}

                        {/* If chatMethod === 'vad', just show a mic state */}
                        {chatMethod === 'vad' && isConnected && (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                <Mic />
                                {isRecording ? 'Listening...' : 'Connected'}
                            </div>
                        )}
                    </div>
                </div>

                {showLogs && (
                    <div className="w-full md:w-1/3 flex flex-col border border-gray-300 dark:border-gray-600 rounded-lg">
                        <div className="font-bold p-2 border-b border-gray-300 dark:border-gray-600">Events Log</div>
                        <div className="flex items-center justify-between p-2">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Client (blue) / Server (green)</div>
                        </div>
                        <div className="p-2 flex gap-2">
                            <div className="flex-1 bg-gray-50 dark:bg-zinc-800" style={{ height: '50px' }}>
                                <canvas ref={clientCanvasRef} className="w-full h-full" />
                            </div>
                            <div className="flex-1 bg-gray-50 dark:bg-zinc-800" style={{ height: '50px' }}>
                                <canvas ref={serverCanvasRef} className="w-full h-full" />
                            </div>
                        </div>
                        <div
                            className="flex-1 overflow-y-auto text-sm p-2 bg-gray-50 dark:bg-zinc-900"
                            ref={eventsScrollRef}
                        >
                            {!realtimeEvents.length && `Awaiting Connection...`}
                            {(() => {
                                let lastInputAudioBufferTime: Date | null = null;
                                let lastFunctionCallTime: Date | null = null;

                                return realtimeEvents
                                    .filter((realtimeEvent) => {
                                        const source = realtimeEvent.source;
                                        const eventType = realtimeEvent.event.type;
                                        const output = realtimeEvent.event.response?.output;
                                        return (
                                            (source === 'client' && eventType === 'input_audio_buffer.commit') ||
                                            (source === 'server' && eventType === 'response.content_part.added') ||
                                            (source === 'server' &&
                                                eventType === 'response.done' &&
                                                output?.some((item: { type: string }) => item.type === 'function_call'))
                                        );
                                    })
                                    .map((realtimeEvent) => {
                                        const count = realtimeEvent.count;
                                        const event = { ...realtimeEvent.event };
                                        const eventType = event.type;
                                        const eventTime = new Date(realtimeEvent.time);

                                        let functioncallTimeDifference = null;
                                        let audioTimeDifference = null;
                                        let totaltimeDifference = null;

                                        if (eventType === 'input_audio_buffer.commit') {
                                            lastInputAudioBufferTime = eventTime;
                                        } else if (eventType === 'response.done' && lastInputAudioBufferTime) {
                                            functioncallTimeDifference =
                                                (eventTime.getTime() - lastInputAudioBufferTime.getTime()) / 1000;
                                            lastFunctionCallTime = eventTime;
                                        } else if (
                                            eventType === 'response.content_part.added' &&
                                            lastFunctionCallTime &&
                                            lastInputAudioBufferTime
                                        ) {
                                            audioTimeDifference =
                                                (eventTime.getTime() - lastFunctionCallTime.getTime()) / 1000;
                                            totaltimeDifference =
                                                (eventTime.getTime() - lastInputAudioBufferTime.getTime()) / 1000;
                                        }

                                        return (
                                            <div className="mb-4" key={event.event_id}>
                                                <div className="font-bold text-gray-800 dark:text-gray-200">
                                                    {formatTime(realtimeEvent.time)}
                                                </div>
                                                <div
                                                    onClick={() => {
                                                        const id = event.event_id;
                                                        const expanded = { ...expandedEvents };
                                                        if (expanded[id]) {
                                                            delete expanded[id];
                                                        } else {
                                                            expanded[id] = true;
                                                        }
                                                        setExpandedEvents(expanded);
                                                    }}
                                                    className="cursor-pointer text-gray-700 dark:text-gray-300"
                                                >
                          <span className={`mr-2 ${realtimeEvent.source === 'client' ? 'text-blue-600' : 'text-green-600'}`}>
                            {realtimeEvent.source}
                          </span>
                                                    <span>{event.type}{count && ` (${count})`}</span>
                                                </div>
                                                {!!expandedEvents[event.event_id] && (
                                                    <pre className="text-xs bg-gray-200 dark:bg-zinc-700 p-1 rounded whitespace-pre-wrap">
                            {JSON.stringify(event, null, 2)}
                          </pre>
                                                )}
                                                {functioncallTimeDifference !== null && (
                                                    <div className="text-xs italic">
                                                        Total time from input to RAG = {functioncallTimeDifference}s
                                                    </div>
                                                )}
                                                {audioTimeDifference !== null && (
                                                    <div className="text-xs italic">
                                                        Total time from RAG to response = {audioTimeDifference}s
                                                    </div>
                                                )}
                                                {totaltimeDifference !== null && (
                                                    <div className="text-xs italic">
                                                        Total time from input to response = {totaltimeDifference}s
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
