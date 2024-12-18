'use client';

import {useEffect, useRef, useCallback, useState} from 'react';
import {usePathname, useRouter} from "next/navigation";
import {motion} from 'framer-motion';
import {FiSend, FiMic, FiMicOff, FiPlus} from 'react-icons/fi';
import {RealtimeClient} from '@openai/realtime-api-beta';
import {ItemType} from '@openai/realtime-api-beta/dist/lib/client.js';
import {WavRecorder, WavStreamPlayer} from '@/lib/wavtools/index.js';
import {instructions} from '@/utils/conversation_config.js';
import {createClient} from "@/utils/supabase/client";
import {WavRenderer} from '@/utils/wav_renderer';
import DepartmentModal from './department-modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';


interface Message {
    id: string;
    content: string;
    type: 'user' | 'assistant' | 'system';
    function_call?: string | null;
    function_call_text?: string | null;
    created_at: Date;
}

interface SessionData {
    session_id: string;
    user: string;
    mode: 'text' | 'voice';
    department: string;
}

interface ChatRow {
    chat_id: string;
    session_id: string;
    user: string;
    role: string;
    message: string;
    mode: string;
    created_at: string;
    function_call?: string | null;
    function_call_text?: string | null;
    openai_id?: string | null;
}

interface CombinedUserDataInterface {
    id: string;
    email: string | null;
    username: string | null;
    avatar_url: string | null;
}

export default function Dashboard() {
    const supabase = createClient();
    const pathname = usePathname();
    const router = useRouter();

    // State derived from session record
    const [sessionData, setSessionData] = useState<SessionData | null>(null);
    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [department, setDepartment] = useState<string | null>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [showDepartmentModal, setShowDepartmentModal] = useState(false);

    // Assume we have user data similar to dashboard page
    const [combinedUserData, setCombinedUserData] = useState<CombinedUserDataInterface | null>(null);

    // Voice mode related references
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_KEY || '';
    const sessionId = pathname.split('/').pop() || '';
    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({sampleRate: 24000}));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({sampleRate: 24000}));
    const clientRef = useRef<RealtimeClient>(
        new RealtimeClient({
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true
        })
    );
    const [isConnected, setIsConnected] = useState(false);
    const connectConversationOnce = useRef(false); // Track whether connectConversation has been called

    const chatContainerRef = useRef<HTMLDivElement>(null);

    // This will hold partial transcripts for each openai_id
    const messageBuffers = useRef<Record<string, {
        role: 'user' | 'assistant' | 'system',
        content: string,
        function_call?: string | null,
        function_call_text?: string | null,
        created_at: Date
    }>>({});

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const {data: {user}} = await supabase.auth.getUser();
                if (!user) {
                    router.push("/sign-in");
                    return;
                }

                const {data: userProfile} = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (!userProfile) {
                    console.error('No profile found for this user');
                    return;
                }

                const combinedData: CombinedUserDataInterface = {
                    id: user.id,
                    email: userProfile.email,
                    username: userProfile.username,
                    avatar_url: userProfile.avatar_url,
                };

                setCombinedUserData(combinedData);
            } catch (err) {
                console.error('Error fetching user data:', err);
            }
        };

        fetchUserData();
    }, [supabase, router]);

    // Load session info and messages
    useEffect(() => {

        const loadSessionData = async () => {
            if (!sessionId) return;

            // Fetch session info from Supabase
            const {data: sessionRows, error: sessionError} = await supabase
                .from('session')
                .select('*')
                .eq('session_id', sessionId)
                .single();

            if (sessionError || !sessionRows) {
                console.error('Error loading session:', sessionError);
                return;
            }

            const sess = sessionRows as SessionData;
            setSessionData(sess); // Set session data in state
            setMode(sess.mode);
            setDepartment(sess.department);

            // Fetch chat messages
            const {data: chatData, error: chatError} = await supabase
                .from('chat')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', {ascending: true});

            if (chatError) {
                console.error('Error fetching chat messages:', chatError);
                return;
            }

            const loadedMessages: Message[] = (chatData || []).map((c: ChatRow) => ({
                id: c.chat_id,
                content: c.message,
                type: c.role === 'user' ? 'user' : (c.role === 'assistant' ? 'assistant' : 'system'),
                function_call: c.function_call || null,
                function_call_text: c.function_call_text || null,
                created_at: new Date(c.created_at),
            }));

            setMessages(loadedMessages);

            // Handle assistant response if needed in text mode
            if (sess.mode === 'text' && loadedMessages.length === 1 && loadedMessages[0].type === 'user') {
                setIsProcessing(true);
                console.log(loadedMessages[0].content)
                try {
                    const response = await fetch('http://localhost:11000/complete-query', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            query: loadedMessages[0].content,
                            department: ["AI"],
                            access_level: 1
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to get assistant response');
                    }

                    const data = await response.json();
                    const assistantMessageContent = data.answer;

                    // Insert assistant message into chat table
                    const {error: insertError, data: insertedChat} = await supabase
                        .from('chat')
                        .insert([
                            {
                                session_id: sess.session_id,
                                user: sess.user,
                                role: 'assistant',
                                message: assistantMessageContent,
                                mode: 'text',
                            },
                        ]);

                    if (insertError) {
                        console.error('Error inserting assistant message:', insertError);
                    } else {
                        const assistantMessage: Message = {
                            id: insertedChat?.[0].chat_id || Date.now().toString(),
                            content: assistantMessageContent,
                            type: 'assistant',
                            created_at: new Date(),
                        };
                        setMessages([...loadedMessages, assistantMessage]);
                    }
                } catch (error) {
                    console.error('Error fetching assistant response:', error);
                } finally {
                    setIsProcessing(false);
                }
            }

            // Handle voice mode initialization
            if (sess.mode === 'voice' && !connectConversationOnce.current && combinedUserData) {
                connectConversationOnce.current = true; // Ensure connectConversation runs only once
                await connectConversation(sess, combinedUserData);
            }
        };

        if (combinedUserData) {
            loadSessionData();
        }
    }, [sessionId, supabase, combinedUserData]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const saveMessageToDB = async (role: 'user' | 'assistant' | 'system', content: string, openai_id?: string | null, function_call?: string | null, function_call_text?: string | null) => {
        console.log("Save to Supabase", openai_id, content)
        console.log(sessionData)
        console.log(combinedUserData)
        if (!sessionData || !combinedUserData) return;

        // We will "upsert" by openai_id. If openai_id is provided, we try to update; else, insert new.
        // For simplicity, if no openai_id, we just insert a new row.
        // If openai_id is present, we first try to select if a record exists with that id.
        if (openai_id) {
            const { data: existing } = await supabase
                .from('chat')
                .select('chat_id')
                .eq('openai_id', openai_id)
                .eq('session_id', sessionData.session_id)
                .single();

            if (existing) {
                // Update existing record
                const {error: updateError} = await supabase
                    .from('chat')
                    .update({
                        message: content,
                        function_call,
                        function_call_text
                    })
                    .eq('chat_id', existing.chat_id);

                if (updateError) {
                    console.error('Error updating message:', updateError);
                }
                return;
            }
        }

        // If no openai_id or no existing record found, insert new
        const {error: insertError} = await supabase
            .from('chat')
            .insert([
                {
                    session_id: sessionData.session_id,
                    user: combinedUserData.id,
                    role,
                    message: content,
                    mode: sessionData.mode,
                    openai_id: openai_id || null,
                    function_call: function_call || null,
                    function_call_text: function_call_text || null
                }
            ]);

        if (insertError) console.error('Error saving message:', insertError);
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !sessionData || sessionData.mode !== 'text') return;

        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputMessage,
            type: 'user',
            created_at: new Date(),
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInputMessage('');
        setIsProcessing(true);

        // Insert user message to DB
        await saveMessageToDB('user', userMessage.content);

        // Fetch assistant response
        try {
            const response = await fetch('http://localhost:11000/complete-query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    updatedMessages,
                    department: ["AI"],
                    access_level: 1
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get assistant response');
            }

            const data = await response.json();
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: data.message,
                type: 'assistant',
                created_at: new Date(),
            };

            // Insert assistant message into DB
            await saveMessageToDB('assistant', assistantMessage.content);

            const finalMessages = [...updatedMessages, assistantMessage];
            setMessages(finalMessages);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: "I apologize, but I'm having trouble responding right now. Please try again.",
                type: 'assistant',
                created_at: new Date(),
            };
            const finalMessages = [...updatedMessages, errorMessage];
            setMessages(finalMessages);
            await saveMessageToDB('assistant', errorMessage.content);
        } finally {
            setIsProcessing(false);
        }
    };

    // Voice mode methods
    const connectConversation = useCallback(async (session: SessionData, userData: CombinedUserDataInterface) => {
        if (isConnected || !session) return;
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        await wavRecorder.begin();
        await wavStreamPlayer.connect();
        await client.connect();

        client.updateSession({instructions: instructions});
        client.updateSession({input_audio_transcription: {model: 'whisper-1'}});

        setIsConnected(true);

        // Add your RAG query tool or other tools if needed.
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
            async ({query}: { query: string }) => {
                try {
                    const response = await fetch('http://localhost:11000/complete-query', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            query,
                            department: [session.department],
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

        client.on('conversation.updated', async ({item, delta}: any) => {
            const clientItems = client.conversation.getItems();
            // Convert items to messages
            // We'll use a buffer approach now:
            const newMessages: Message[] = [];

            for (const it of clientItems) {
                let role: 'user' | 'assistant' | 'system';
                let function_call = null;
                let function_call_text = null;
                let content = '';

                if (it.type === 'message') {
                    role = it.role === 'user' ? 'user' : 'assistant';
                    if (role === 'assistant') {
                        // For assistant messages, we accumulate transcript from streaming
                        const transcript = it.content?.find((c: any) => c.type === 'audio')?.transcript || '';
                        // Update buffer
                        if (!messageBuffers.current[it.id]) {
                            messageBuffers.current[it.id] = {
                                role: 'assistant',
                                content: transcript,
                                created_at: new Date(),
                            };
                        } else {
                            // Append new transcript parts
                            messageBuffers.current[it.id].content = transcript;
                        }
                        content = messageBuffers.current[it.id].content;
                    } else {
                        // For user messages
                        const userContent = it.content?.[0]?.text || '(no content)';
                        // Update buffer
                        if (!messageBuffers.current[it.id]) {
                            messageBuffers.current[it.id] = {
                                role: 'user',
                                content: userContent,
                                created_at: new Date(),
                            };
                        } else {
                            messageBuffers.current[it.id].content = userContent;
                        }
                        content = messageBuffers.current[it.id].content;
                    }
                } else if (it.type === 'function_call') {
                    role = 'system';
                    function_call = it.name || null;
                    function_call_text = it.arguments || '(no arguments)';

                    if (!messageBuffers.current[it.id]) {
                        messageBuffers.current[it.id] = {
                            role: 'system',
                            content: '',
                            function_call,
                            function_call_text,
                            created_at: new Date(),
                        };
                    } else {
                        messageBuffers.current[it.id].function_call = function_call;
                        messageBuffers.current[it.id].function_call_text = function_call_text;
                    }

                    content = messageBuffers.current[it.id].content;
                } else if (it.type === 'function_call_output') {
                    role = 'system';
                    function_call_text = it.output || '(no output)';

                    if (!messageBuffers.current[it.id]) {
                        messageBuffers.current[it.id] = {
                            role: 'system',
                            content: '',
                            function_call_text,
                            created_at: new Date(),
                        };
                    } else {
                        messageBuffers.current[it.id].function_call_text = function_call_text;
                    }

                    content = messageBuffers.current[it.id].content;
                } else {
                    role = 'system';
                    content = '(unknown message type)';
                    if (!messageBuffers.current[it.id]) {
                        messageBuffers.current[it.id] = {
                            role: 'system',
                            content: content,
                            created_at: new Date(),
                        };
                    } else {
                        messageBuffers.current[it.id].content = content;
                    }
                }
                //
                // console.log(it.id)
                // console.log(newMessages)
                // console.log(messageBuffers.current)

                // Add to the final messages array for rendering
                newMessages.push({
                    id: it.id,
                    content,
                    type: role,
                    function_call,
                    function_call_text,
                    created_at: messageBuffers.current[it.id].created_at
                });

                // Upsert into DB
                await saveMessageToDB(
                    messageBuffers.current[it.id].role,
                    messageBuffers.current[it.id].content,
                    it.id, // use openai_id as it.id
                    messageBuffers.current[it.id].function_call,
                    messageBuffers.current[it.id].function_call_text
                );
            }

            setMessages(newMessages);

            // Handle audio if available
            if (delta?.audio) {
                wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id);
            }
        });

        client.on('conversation.interrupted', async () => {
            const trackSampleOffset = await wavStreamPlayer.interrupt();
            if (trackSampleOffset?.trackId) {
                const {trackId, offset} = trackSampleOffset;
                await client.cancelResponse(trackId, offset);
            }
        });

        client.on('error', (event: any) => console.error(event));

        // If you want to send an initial greeting in voice mode:
        client.sendUserMessageContent([{type: 'input_text', text: 'Hello!'}]);

    }, [isConnected, sessionData]);

    const startRecording = async () => {
        if (mode !== 'voice' || !isConnected) return;

        setIsRecording(true);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        const trackSampleOffset = await wavStreamPlayer.interrupt();
        if (trackSampleOffset?.trackId) {
            const {trackId, offset} = trackSampleOffset;
            await client.cancelResponse(trackId, offset);
        }

        if (!wavRecorder.recording) {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
    };

    const stopRecording = async () => {
        if (!isRecording || mode !== 'voice' || !isConnected) return;
        setIsRecording(false);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;

        if (wavRecorder.recording) {
            await wavRecorder.pause();
        }

        client.createResponse();
    };

    const handleNewChat = () => {
        const newChatId = Date.now().toString();
        setMessages([]);
        setInputMessage('');
        router.push('/dashboard');
    };

    return (
        <div className="p-6">
            {showDepartmentModal && (
                <DepartmentModal
                    onClose={() => setShowDepartmentModal(false)}
                    onSelect={(dept: string) => {
                        setDepartment(dept);
                        setShowDepartmentModal(false);
                        router.push('/dashboard');
                    }}
                />
            )}

            {/* Welcome Banner */}
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-8 mb-6"
            >
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Session: {sessionId}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Mode: {mode} | Department: {department}
                        </p>
                    </div>
                    <button
                        onClick={handleNewChat}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                        <FiPlus className="w-5 h-5"/>
                        <span>New Chat</span>
                    </button>
                </div>
            </motion.div>

            {/* Chat Interface */}
            <div className="flex space-x-2">
                {/* Main Chat Area */}
                <div className="w-full bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6">
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
                                            : message.type === 'assistant'
                                                ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white'
                                                : 'bg-red-100 dark:bg-red-700 text-red-900 dark:text-white'
                                    }`}
                                >
                                    {/* Render Markdown Content */}
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]} // Enables GitHub Flavored Markdown
                                        rehypePlugins={[rehypeHighlight, rehypeRaw]} // Enables syntax highlighting
                                        className="prose dark:prose-invert whitespace-pre-wrap break-words" // Apply Tailwind Typography styles
                                    >
                                        {message.content.replace(/\n{2,}/g, '\n')}
                                        {/*{message.content}*/}
                                    </ReactMarkdown>
                                    <p className="text-xs mt-1 opacity-70">
                                        {new Date(message.created_at).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-zinc-700 rounded-lg p-4">
                                    <div className="flex space-x-2">
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                                             style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                                             style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls at bottom */}
                    {mode === 'text' ? (
                        <div className="flex items-center space-x-4">
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
                                <FiSend size={20}/>
                            </button>
                        </div>
                    ) : (
                        // Voice mode controls
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
                                {isRecording ? <FiMicOff size={20}/> : <FiMic size={20}/>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
