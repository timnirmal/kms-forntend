'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
// import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { FiSend, FiMic, FiMicOff, FiPlus } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools/index.js';
import { instructions } from '@/utils/conversation_config.js';
import { createClient } from "@/utils/supabase/client";
import { WavRenderer } from '@/utils/wav_renderer';

interface Message {
    id: string;
    content: string;
    type: 'user' | 'assistant';
    timestamp: Date;
}

export default function Dashboard() {
    // const { data: session, status } = useSession();

    const supabase = createClient();

    // State for mode: starts in text mode
    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [hasReturnedToTextMode, setHasReturnedToTextMode] = useState(false);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [currentChatId, setCurrentChatId] = useState<string>('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Voice mode related
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_KEY || '';
    const [sessionId] = useState<string>(uuidv4());
    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    const clientRef = useRef<RealtimeClient>(
        new RealtimeClient({
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true
        })
    );
    const [isConnected, setIsConnected] = useState(false);
    const [chatMethod] = useState<'vad' | 'push_to_talk'>('push_to_talk');

    const clientCanvasRef = useRef<HTMLCanvasElement>(null);
    const serverCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        // Load current chat session if exists
        const loadCurrentChat = () => {
            const savedChatId = localStorage.getItem('currentChatId');
            if (savedChatId) {
                const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
                const currentSession = sessions.find((s: any) => s.id === savedChatId);
                if (currentSession) {
                    setMessages(currentSession.messages.map((msg: Message) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    })));
                    setCurrentChatId(savedChatId);
                } else {
                    const newChatId = Date.now().toString();
                    setCurrentChatId(newChatId);
                    localStorage.setItem('currentChatId', newChatId);
                }
            } else {
                const newChatId = Date.now().toString();
                setCurrentChatId(newChatId);
                localStorage.setItem('currentChatId', newChatId);
            }
        };

        loadCurrentChat();
    }, []);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const saveCurrentSession = (msgs: Message[]) => {
        const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
        const lastMessage = msgs[msgs.length - 1]?.content || 'Empty chat';

        const currentSession = {
            id: currentChatId,
            messages: msgs,
            lastMessage,
            timestamp: new Date(),
        };

        const updatedSessions = sessions
            .filter((s: any) => s.id !== currentChatId)
            .concat([currentSession]);

        localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
    };

    const handleNewChat = () => {
        const newChatId = Date.now().toString();
        setCurrentChatId(newChatId);
        setMessages([]);
        setInputMessage('');
        localStorage.setItem('currentChatId', newChatId);
        // Reset mode states
        setMode('text');
        setHasReturnedToTextMode(false);
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim()) return;

        // Send user message
        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputMessage,
            type: 'user',
            timestamp: new Date(),
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInputMessage('');
        setIsProcessing(true);
        saveCurrentSession(updatedMessages);

        // If in voice mode and connected, send to OpenAI realtime
        if (mode === 'voice' && isConnected) {
            clientRef.current.sendUserMessageContent([
                { type: 'input_text', text: userMessage.content }
            ]);
            // The assistant's response will come via conversation.updated event
            setIsProcessing(false);
            return;
        }

        // If in text mode, use a standard API endpoint (simulate)
        if (mode === 'text') {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ messages: updatedMessages }),
                });

                if (!response.ok) {
                    throw new Error('Failed to get response');
                }

                const data = await response.json();
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    content: data.message,
                    type: 'assistant',
                    timestamp: new Date(),
                };

                const finalMessages = [...updatedMessages, assistantMessage];
                setMessages(finalMessages);
                saveCurrentSession(finalMessages);
            } catch (error) {
                console.error('Error sending message:', error);
                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    content: "I apologize, but I'm having trouble responding right now. Please try again.",
                    type: 'assistant',
                    timestamp: new Date(),
                };
                const finalMessages = [...updatedMessages, errorMessage];
                setMessages(finalMessages);
                saveCurrentSession(finalMessages);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const startRecording = async () => {
        // Start recording (push-to-talk)
        // If not connected and in voice mode, connect first
        if (mode === 'voice' && !isConnected) {
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
        if (!isRecording) return;

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

    const connectConversation = useCallback(async () => {
        if (isConnected) return;

        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        await wavRecorder.begin();
        await wavStreamPlayer.connect();
        await client.connect();

        client.updateSession({ instructions: instructions });
        client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

        setIsConnected(true);

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
                            department: ['AI'],
                            access_level: 1
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to get response from RAG system');
                    }

                    return await response.json();
                } catch (error) {
                    console.error('Error querying RAG system:', error);
                    return {
                        answer: 'Sorry, I encountered an error while trying to answer your question. Please try again.',
                        sources: []
                    };
                }
            }
        );

        client.on('conversation.updated', async ({ item, delta }: any) => {
            const clientItems = client.conversation.getItems();

            // Convert items to messages
            const convertedMessages: Message[] = clientItems.map((it: ItemType) => {
                const role = it.role || (it.type === 'function_call_output' ? 'assistant' : 'system');
                const content = it.formatted?.transcript || it.formatted?.text || '(no content)';
                // Treat 'system' and 'function' as 'assistant' for display
                const msgType: 'assistant' | 'user' = (role === 'assistant' || role === 'function' || role === 'system')
                    ? 'assistant'
                    : 'user';
                return {
                    id: it.id,
                    content,
                    type: msgType,
                    timestamp: new Date()
                };
            });

            setMessages(convertedMessages);
            saveCurrentSession(convertedMessages);

            // Handle audio if available
            if (delta?.audio) {
                wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id);
            }

            // If item completed with audio, decode
            if (item.status === 'completed' && item.formatted.audio?.length) {
                try {
                    const wavFile = await WavRecorder.decode(item.formatted.audio, 24000, 24000);
                    item.formatted.file = wavFile;
                } catch (error) {
                    console.error('Error decoding audio file:', error);
                }
            }
        });

        client.on('realtime.event', (realtimeEvent: any) => {
            // handle realtime events if needed
        });

        client.on('error', (event: any) => console.error(event));

        client.on('conversation.interrupted', async () => {
            const trackSampleOffset = await wavStreamPlayer.interrupt();
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                await client.cancelResponse(trackId, offset);
            }
        });
        // Send a welcome message
        client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }]);
    }, [isConnected, instructions]);

    const disconnectConversation = useCallback(async () => {
        if (!isConnected) return;

        setIsConnected(false);
        const client = clientRef.current;
        client.disconnect();

        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        await wavStreamPlayer.interrupt();
    }, [isConnected]);

    const switchToVoiceMode = async () => {
        // Only allow if chat is empty and not returned from voice
        if (messages.length === 0 && !hasReturnedToTextMode) {
            await connectConversation();
            setMode('voice');
        }
    };

    const cancelVoiceMode = async () => {
        // Return to text mode and disable future voice mode attempts
        await disconnectConversation();
        setMode('text');
        setHasReturnedToTextMode(true);
    };

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

    // if (status === 'loading') {
    //     return (
    //         <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
    //             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    //         </div>
    //     );
    // }

    return (
        <div className="p-6">
            {/* Welcome Banner */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-8 mb-6"
            >
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Welcome back!
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            How can I assist you today?
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Chat Interface */}
            <div className="flex space-x-2">
                {/* Main Chat Area */}
                <div className="w-full bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6">
                    {/* Chat Header with New Chat Button */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Chat</h2>
                        <button
                            onClick={handleNewChat}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            <FiPlus className="w-5 h-5" />
                            <span>New Chat</span>
                        </button>
                    </div>

                    <div
                        ref={chatContainerRef}
                        className="h-[calc(100vh-28rem)] overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-zinc-600"
                    >
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[70%] rounded-lg p-4 ${
                                        message.type === 'user'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white'
                                    }`}
                                >
                                    <p>{message.content}</p>
                                    <p className="text-xs mt-1 opacity-70">
                                        {new Date(message.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-zinc-700 rounded-lg p-4">
                                    <div className="flex space-x-2">
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls at bottom */}
                    <div className="flex items-center space-x-4">
                        {/* Mode Controls */}
                        {mode === 'text' ? (
                            <>
                                {/* If chat is empty and we haven't returned from voice, show "Switch to Voice Mode" button */}
                                {!hasReturnedToTextMode && messages.length === 0 && (
                                    <button
                                        onClick={switchToVoiceMode}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                    >
                                        Switch to Voice Mode
                                    </button>
                                )}
                                {/* Text Input + Send Button */}
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type your message..."
                                    className="flex-1 p-4 rounded-xl bg-gray-100 dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputMessage.trim()}
                                    className="p-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <FiSend size={20} />
                                </button>
                            </>
                        ) : (
                            // Voice Mode Controls
                            <div className="flex items-center space-x-4">
                                <button
                                    onMouseDown={startRecording}
                                    onMouseUp={stopRecording}
                                    className={`p-2 rounded-full transition-colors ${
                                        isRecording
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white'
                                    }`}
                                >
                                    {isRecording ? <FiMicOff size={20} /> : <FiMic size={20} />}
                                </button>
                                <button
                                    onClick={cancelVoiceMode}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                >
                                    Cancel (Back to Text)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
