'use client'

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools/index.js';
import { instructions } from '@/utils/conversation_config.js';
import { WavRenderer } from '@/utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '@/components/button/Button';
import { Toggle } from '@/components/toggle/Toggle';

// import './ConsolePage.scss';

const LOCAL_RELAY_SERVER_URL: string =
    process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

/**
 * Type for all event logs
 */
interface RealtimeEvent {
    time: string;
    source: 'client' | 'server';
    count?: number;
    event: { [key: string]: any };
}

/**
 * Type for RAG query response
 */
interface RAGResponse {
    answer: string;
    sources?: string[];
}

interface Category {
    id: string;
    department: string;
}

let departmentOfSelectedCategory: string = '';

export default function ConsolePage() {
    // Add new state for category
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories] = useState<Category[]>([
        { id: 'finance', department: 'Finance' },
        { id: 'hr', department: 'HR' },
        { id: 'AI', department: 'AI' },
        { id: 'marketing', department: 'Marketing' },
    ]);

    const selectedCategoryObject = categories.find(category => category.id === selectedCategory);
    departmentOfSelectedCategory = selectedCategoryObject ? selectedCategoryObject.department : '';
    const apiKey = LOCAL_RELAY_SERVER_URL
        ? ''
        : localStorage.getItem('tmp::voice_api_key') ||
        prompt('OpenAI API Key') ||
        '';
    if (apiKey !== '') {
        localStorage.setItem('tmp::voice_api_key', apiKey);
    }

    const wavRecorderRef = useRef<WavRecorder>(
        new WavRecorder({ sampleRate: 24000 })
    );
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(
        new WavStreamPlayer({ sampleRate: 24000 })
    );
    const clientRef = useRef<RealtimeClient>(
        new RealtimeClient(
            LOCAL_RELAY_SERVER_URL
                ? { url: LOCAL_RELAY_SERVER_URL }
                : {
                    apiKey: apiKey,
                    dangerouslyAllowAPIKeyInBrowser: true
                }
        )
    );

    const clientCanvasRef = useRef<HTMLCanvasElement>(null);
    const serverCanvasRef = useRef<HTMLCanvasElement>(null);
    const eventsScrollHeightRef = useRef(0);
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    const startTimeRef = useRef<string>(new Date().toISOString());

    const [items, setItems] = useState<ItemType[]>([]);
    const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
    const [expandedEvents, setExpandedEvents] = useState<{
        [key: string]: boolean;
    }>({});
    const [isConnected, setIsConnected] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);
    const [isRecording, setIsRecording] = useState(false);

    const formatTime = useCallback((timestamp: string) => {
        const startTime = startTimeRef.current;
        const t0 = new Date(startTime).valueOf();
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

    const resetAPIKey = useCallback(() => {
        const apiKey = prompt('OpenAI API Key');
        if (apiKey !== null) {
            localStorage.clear();
            localStorage.setItem('tmp::voice_api_key', apiKey);
            window.location.reload();
        }
    }, []);

    const connectConversation = useCallback(async () => {
        if (!selectedCategory) {
            alert('Please select a category before starting the conversation');
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
        client.sendUserMessageContent([
            {
                type: `input_text`,
                text: `Hello!`,
            },
        ]);

        if (client.getTurnDetectionType() === 'server_vad') {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
    }, [selectedCategory]);

    const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedCategory(event.target.value);
    };
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

    const deleteConversationItem = useCallback(async (id: string) => {
        const client = clientRef.current;
        client.deleteItem(id);
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
        const conversationEls = [].slice.call(
            document.body.querySelectorAll('[data-conversation-content]')
        );
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
                        WavRenderer.drawBars(
                            clientCanvas,
                            clientCtx,
                            result.values,
                            '#0099ff',
                            10,
                            0,
                            8
                        );
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
                        WavRenderer.drawBars(
                            serverCanvas,
                            serverCtx,
                            result.values,
                            '#009900',
                            10,
                            0,
                            8
                        );
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
        client.addTool({
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
                            department: [departmentOfSelectedCategory],
                            access_level: 1
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to get response from RAG system');
                    }

                    const result: RAGResponse = await response.json();
                    return result;
                } catch (error) {
                    console.error('Error querying RAG system:', error);
                    return {
                        answer: 'Sorry, I encountered an error while trying to answer your question. Please try again.',
                        sources: []
                    };
                }
            });

        client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
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

        client.on('conversation.updated', async ({ item, delta }: any) => {
            const items = client.conversation.getItems();
            if (delta?.audio) {
                wavStreamPlayer.add16BitPCM(delta.audio, item.id);
            }
            if (item.status === 'completed' && item.formatted.audio?.length) {
                const wavFile = await WavRecorder.decode(
                    item.formatted.audio,
                    24000,
                    24000
                );
                item.formatted.file = wavFile;
            }
            setItems(items);
        });

        setItems(client.conversation.getItems());

        return () => {
            client.reset();
        };
    }, []);

    return (
        <div data-component="ConsolePage">
            <div className="content-top">
                <div className="content-title">
                    <img src="/logo_image.png" />
                    <span>Knowledge Management System</span>
                </div>
                <div className="content-api-key">
                    {!LOCAL_RELAY_SERVER_URL && (
                        <Button
                            icon={Edit}
                            iconPosition="end"
                            buttonStyle="flush"
                            label={`api key: ${apiKey.slice(0, 3)}...`}
                            onClick={() => resetAPIKey()}
                        />
                    )}
                </div>
            </div>
            <div className="content-main">
                <div className="content-logs">
                    <div className="content-block category-selection">
                        <div className="content-block-title">Select Category</div>
                        <div className="content-block-body">
                            <select
                                value={selectedCategory}
                                onChange={handleCategoryChange}
                                className="category-dropdown"
                                disabled={isConnected}
                            >
                                <option value="">Select a category...</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.department}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="content-block conversation">
                        <div className="content-block-title">Conversation</div>
                        <div className="content-block-body" data-conversation-content>
                            {!items.length && `Awaiting Connection...`}
                            {items.map((conversationItem) => (
                                <div className="conversation-item" key={conversationItem.id}>
                                    <div className={`speaker ${conversationItem.role || ''}`}>
                                        <div>
                                            {conversationItem.type !== 'function_call_output' &&
                                                (conversationItem.role || conversationItem.type).replaceAll(
                                                    '_',
                                                    ' '
                                                )}
                                        </div>
                                        <div
                                            className="close"
                                            onClick={() => deleteConversationItem(conversationItem.id)}
                                        >
                                            <X />
                                        </div>
                                    </div>
                                    <div className={`speaker-content`}>
                                        {/* Tool response */}
                                        {conversationItem.type !== 'function_call_output' && (
                                            // <div>{conversationItem.formatted.output}</div>
                                            <>
                                                {/* Tool call */}
                                                {!!conversationItem.formatted.tool && (
                                                    <div>
                                                        {(() => {
                                                            try {
                                                                // Parse if arguments is a string, otherwise access directly
                                                                const args = typeof conversationItem.formatted.tool.arguments === 'string'
                                                                    ? JSON.parse(conversationItem.formatted.tool.arguments)
                                                                    : conversationItem.formatted.tool.arguments;

                                                                return args.query || '(No query available)'; // Display the query or a fallback
                                                            } catch (error) {
                                                                console.error('Error parsing arguments:', error);
                                                                return '(Invalid arguments format)';
                                                            }
                                                        })()}
                                                    </div>
                                                )}
                                                {!conversationItem.formatted.tool &&
                                                    conversationItem.role === 'user' && (
                                                        <div>
                                                            {conversationItem.formatted.transcript ||
                                                                (conversationItem.formatted.audio?.length
                                                                    ? '(awaiting transcript)'
                                                                    : conversationItem.formatted.text ||
                                                                    '(item sent)')}
                                                        </div>
                                                    )}
                                                {!conversationItem.formatted.tool &&
                                                    conversationItem.role === 'assistant' && (
                                                        <div>
                                                            {conversationItem.formatted.transcript ||
                                                                conversationItem.formatted.text ||
                                                                '(truncated)'}
                                                        </div>
                                                    )}
                                                {conversationItem.formatted.file && (
                                                    <audio
                                                        src={conversationItem.formatted.file.url}
                                                        controls
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="content-actions">
                        <Toggle
                            defaultValue={false}
                            labels={['manual', 'vad']}
                            values={['none', 'server_vad']}
                            onChange={(_, value) => changeTurnEndType(value)}
                        />
                        <div className="spacer" />
                        {isConnected && canPushToTalk && (
                            <Button
                                label={isRecording ? 'release to send' : 'push to talk'}
                                buttonStyle={isRecording ? 'alert' : 'regular'}
                                disabled={!isConnected || !canPushToTalk}
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                            />
                        )}
                        <div className="spacer" />
                        <Button
                            label={isConnected ? 'disconnect' : 'connect'}
                            iconPosition={isConnected ? 'end' : 'start'}
                            icon={isConnected ? X : Zap}
                            buttonStyle={isConnected ? 'regular' : 'action'}
                            onClick={isConnected ? disconnectConversation : connectConversation}
                            disabled={!selectedCategory && !isConnected}
                        />
                    </div>
                    <div className="content-block events">
                        <div className="visualization">
                            <div className="visualization-entry client">
                                <canvas ref={clientCanvasRef} />
                            </div>
                            <div className="visualization-entry server">
                                <canvas ref={serverCanvasRef} />
                            </div>
                        </div>
                        <div className="content-block-title">Events Log</div>
                        <div className="content-block-body" ref={eventsScrollRef}>
                            {/* Display 'Awaiting Connection...' if there are no events */}
                            {!realtimeEvents.length && `Awaiting Connection...`}

                            {/* Variables to track times across the event list */}
                            {(() => {
                                let lastInputAudioBufferTime: Date | null = null;
                                let lastFunctionCallTime: Date | null = null;

                                return (
                                    realtimeEvents
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
                                        .map((realtimeEvent, i) => {
                                            const count = realtimeEvent.count;
                                            const event = { ...realtimeEvent.event };
                                            const eventType = event.type;
                                            const eventTime = new Date(realtimeEvent.time);

                                            // Define response time variables
                                            let functioncallTimeDifference = null;
                                            let audioTimeDifference = null;
                                            let totaltimeDifference = null;
                                            // Update and calculate time differences based on event type
                                            if (eventType === 'input_audio_buffer.commit') {
                                                lastInputAudioBufferTime = eventTime;
                                            } else if (eventType === 'response.done' && lastInputAudioBufferTime) {
                                                functioncallTimeDifference =
                                                    (eventTime.getTime() - lastInputAudioBufferTime.getTime()) / 1000; // in seconds
                                                lastFunctionCallTime = eventTime;
                                            } else if (eventType === 'response.content_part.added' && lastFunctionCallTime && lastInputAudioBufferTime) {
                                                audioTimeDifference =
                                                    (eventTime.getTime() - lastFunctionCallTime.getTime()) / 1000; // in seconds
                                                totaltimeDifference =
                                                    (eventTime.getTime() - lastInputAudioBufferTime.getTime()) / 1000; // in seconds
                                            }

                                            // Render each filtered event
                                            return (
                                                <div className="event" key={event.event_id}>
                                                    <div className="event-timestamp">{formatTime(realtimeEvent.time)}</div>
                                                    <div className="event-details">
                                                        <div
                                                            className="event-summary"
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
                                                        >
                                                            <div
                                                                className={`event-source ${
                                                                    event.type === 'error' ? 'error' : realtimeEvent.source
                                                                }`}
                                                            >
                                                                {realtimeEvent.source === 'client' ? <ArrowUp /> : <ArrowDown />}
                                                                <span>
                                  {event.type === 'error' ? 'error!' : realtimeEvent.source}
                                </span>
                                                            </div>
                                                            <div className="event-type">
                                                                {event.type}
                                                                {count && ` (${count})`}
                                                            </div>
                                                        </div>
                                                        {!!expandedEvents[event.event_id] && (
                                                            <div className="event-payload">
                                                                {JSON.stringify(event, null, 2)}
                                                            </div>
                                                        )}
                                                        {/* Display response time differences */}
                                                        {functioncallTimeDifference !== null && (
                                                            <div className="response-time">
                                                                Total time from input to RAG = {functioncallTimeDifference} seconds
                                                            </div>
                                                        )}
                                                        {audioTimeDifference !== null && (
                                                            <div className="response-time">
                                                                Total time from RAG to response = {audioTimeDifference} seconds
                                                            </div>
                                                        )}
                                                        {totaltimeDifference !== null && (
                                                            <div className="response-time">
                                                                Total time from input to response = {totaltimeDifference} seconds
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                );
                            })()}
                        </div>
                        ;
                    </div>
                </div>

            </div>
        </div>
    );
}