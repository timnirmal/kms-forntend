'use client';

import {useEffect, useRef, useCallback, useState} from 'react';
import {usePathname, useRouter} from "next/navigation";
import {motion} from 'framer-motion';
import {FiSend, FiMic, FiMicOff, FiPlus, FiUserPlus} from 'react-icons/fi';
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

interface Collaborator {
    user_id: string;
    username: string;
    avatar_url: string | null;
    level: string; // 'read' or 'write'
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
    const initialAssistantRequested = useRef(false);

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

    // New states for collaborators and presence
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [allUsers, setAllUsers] = useState<CombinedUserDataInterface[]>([]); // For adding new collaborators
    const [showAddUserDropdown, setShowAddUserDropdown] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]); // user_ids who are online

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

    // Fetch all users for adding collaborators
    useEffect(() => {
        const loadAllUsers = async () => {
            const {data, error} = await supabase
                .from('profiles')
                .select('*');
            if (error) {
                console.error('Error fetching all users:', error);
            } else {
                const users = data.map(u => ({
                    id: u.id,
                    email: u.email,
                    username: u.username,
                    avatar_url: u.avatar_url
                }));
                setAllUsers(users);
            }
        };
        loadAllUsers();
    }, [supabase]);

    async function loadCollaborators(session_id: string) {
        const {data: colabs, error: colabError} = await supabase
            .from('colab')
            .select('user_id, level')
            .eq('session_id', session_id);

        if (colabError) {
            console.error('Error fetching collaborators:', colabError);
            return [];
        }

        const userIds = colabs.map(c => c.user_id);
        if (userIds.length === 0) return [];

        const {data: profiles, error: profilesError} = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);

        if (profilesError) {
            console.error('Error fetching collaborator profiles:', profilesError);
            return [];
        }

        return colabs.map(colab => {
            const p = profiles.find(p => p.id === colab.user_id);
            return {
                user_id: colab.user_id,
                username: p?.username || 'Unknown',
                avatar_url: p?.avatar_url || null,
                level: colab.level
            };
        });
    }

    async function setupPresence(session_id: string, currentUserId: string) {
        // Presence channel
        const presenceChannel = supabase.channel(`presence-${session_id}`, {
            config: {
                presence: { key: currentUserId }
            }
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                // state looks like { user_id: [{...}, {...}] } mapping user_id to presence data
                const online = Object.keys(state);
                setOnlineUsers(online);
            })
            .on('presence', { event: 'join' }, ({ key }) => {
                // user with id `key` joined
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                // user with id `key` left
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Track current user
                    presenceChannel.track({ user_id: currentUserId, joined_at: new Date().toISOString() });
                }
            });
    }

    // Load session info and messages
    useEffect(() => {

        const loadSessionData = async () => {
            if (!sessionId) return;
            if (!combinedUserData) return;

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

            // Load collaborators
            const loadedCollaborators = await loadCollaborators(sess.session_id);
            setCollaborators(loadedCollaborators);

            // Presence
            if (sess.mode === 'text' && combinedUserData) {
                await setupPresence(sess.session_id, combinedUserData.id);
            }

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
                user_id: c.user
            }));

            setMessages(loadedMessages);

            // If text mode, subscribe to realtime
            if (sess.mode === 'text') {
                const channel = supabase.channel(`session-${sessionId}`)
                    .on(
                        'postgres_changes',
                        {event: '*', schema: 'public', table: 'chat', filter: `session_id=eq.${sessionId}`},
                        (payload) => {
                            const newRow = payload.new as ChatRow;
                            if (payload.eventType === 'INSERT') {
                                // Add new message if not exists
                                const exists = messages.some(m => m.id === newRow.chat_id);
                                if (!exists) {
                                    const newMessage: Message = {
                                        id: newRow.chat_id,
                                        content: newRow.message,
                                        type: newRow.role === 'user' ? 'user' : (newRow.role === 'assistant' ? 'assistant' : 'system'),
                                        function_call: newRow.function_call || null,
                                        function_call_text: newRow.function_call_text || null,
                                        created_at: new Date(newRow.created_at),
                                        user_id: newRow.user
                                    };
                                    setMessages(prev => [...prev, newMessage]);
                                    // If assistant message arrives, stop processing
                                    if (newMessage.type === 'assistant') {
                                        setIsProcessing(false);
                                    }
                                }
                            } else if (payload.eventType === 'UPDATE') {
                                const newMessage = {
                                    content: newRow.message,
                                    function_call: newRow.function_call || null,
                                    function_call_text: newRow.function_call_text || null
                                };
                                setMessages(prev => prev.map(m => m.id === newRow.chat_id ? {
                                    ...m,
                                    ...newMessage
                                } : m));
                            } else if (payload.eventType === 'DELETE') {
                                // Remove deleted message
                                const oldRow = payload.old as ChatRow;
                                setMessages(prev => prev.filter(m => m.id !== oldRow.chat_id));
                            }
                        }
                    ).subscribe();

                // Check if we need an initial assistant response
                // If we have exactly one user message and no assistant messages, fetch assistant answer
                const userCount = loadedMessages.filter(m => m.type === 'user').length;
                const assistantCount = loadedMessages.filter(m => m.type === 'assistant').length;

                if (!initialAssistantRequested.current && userCount === 1 && assistantCount === 0 && loadedMessages.length === 1 && loadedMessages[0].type === 'user') {
                    initialAssistantRequested.current = true; // Mark as requested

                    // Get assistant response
                    setIsProcessing(true);
                    try {
                        const response = await fetch('http://localhost:11000/complete-query', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json',},
                            body: JSON.stringify({
                                query: loadedMessages[0].content,
                                department: [sess.department],
                                access_level: 1
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Failed to get assistant response');
                        }

                        const data = await response.json();
                        const assistantMessageContent = data.answer;

                        // Insert assistant message into chat table (Realtime will update UI)
                        const {error: insertError} = await supabase
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
                            setIsProcessing(false);
                        }
                    } catch (error) {
                        console.error('Error fetching assistant response:', error);
                        setIsProcessing(false);
                    }
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

    const buildHistoryString = () => {
        // Take last 10 messages
        const last10 = messages.slice(-10);
        // For each message, format as:
        // user (username): <content>
        // assistant: <content>
        // Find user from collaborators
        return last10.map(m => {
            let speakerName = 'assistant';
            if (m.type === 'user') {
                const userColab = collaborators.find(c => c.user_id === m.user_id);
                speakerName = userColab ? `user (${userColab.username})` : 'user (unknown)';
            }
            if (m.type === 'assistant') {
                speakerName = 'assistant';
            }
            return `${speakerName}: ${m.content}`;
        }).join('\n');
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !sessionData || sessionData.mode !== 'text') return;

        // User message: Insert into DB, rely on realtime to show it
        setIsProcessing(true);
        const userMessageContent = inputMessage.trim();
        setInputMessage('');

        // Save user message
        await saveMessageToDB('user', userMessageContent);

        // Build history if not the first message scenario
        const userCount = messages.filter(m => m.type === 'user').length;
        const assistantCount = messages.filter(m => m.type === 'assistant').length;
        let body: any = {
            query: userMessageContent,
            department: [sessionData.department],
            access_level: 1
        };
        if (!(userCount === 0 && assistantCount === 0)) {
            // Add history
            body.history = buildHistoryString();
        }

        // Get assistant response
        try {
            const response = await fetch('http://localhost:11000/complete-query', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Failed to get assistant response');

            const data = await response.json();
            const assistantMessageContent = data.answer;

            // Insert assistant message into DB (Realtime shows it)
            const {error: insertError} = await supabase
                .from('chat')
                .insert([
                    {
                        session_id: sessionData.session_id,
                        user: sessionData.user,
                        role: 'assistant',
                        message: assistantMessageContent,
                        mode: 'text',
                    },
                ]);

            if (insertError) {
                console.error('Error inserting assistant message:', insertError);
                setIsProcessing(false);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            // Insert error assistant message into DB
            const errorMsg = "I apologize, but I'm having trouble responding right now. Please try again.";
            await saveMessageToDB('assistant', errorMsg);
            setIsProcessing(false);
        }
    };

    // Add a collaborator
    const handleAddCollaborator = async (userId: string) => {
        if (!sessionData) return;

        const {error} = await supabase
            .from('colab')
            .insert([
                {session_id: sessionData.session_id, user_id: userId, level: 'write'}
            ]);

        if (error) {
            console.error('Error adding collaborator:', error);
        } else {
            // Reload collaborators
            const updated = await loadCollaborators(sessionData.session_id);
            setCollaborators(updated);
        }
        setShowAddUserDropdown(false);
    };

    // Voice mode methods unchanged
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
            // const clientItems = client.conversation.getItems();
            // Convert items to messages
            // We'll use a buffer approach now:
            if (session.mode !== 'voice') return;

            const clientItems = client.conversation.getItems();
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
                    created_at: messageBuffers.current[it.id].created_at,
                    user_id: session.user
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
        setMessages([]);
        setInputMessage('');
        router.push('/dashboard');
    };

    const availableUsersToAdd = allUsers.filter(u => !collaborators.some(c => c.user_id === u.id && u.id !== combinedUserData?.id));

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
                {mode === 'text' && (
                    <div className="mt-4 flex items-center space-x-2">
                        {/* Show collaborators */}
                        {collaborators.map(c => (
                            <div key={c.user_id} className="relative group">
                                <img
                                    src={c.avatar_url || '/default-avatar.png'}
                                    alt={c.username}
                                    className="w-8 h-8 rounded-full border border-gray-300 dark:border-zinc-600"
                                />
                                {/* Online dot */}
                                {onlineUsers.includes(c.user_id) && (
                                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-zinc-800"></span>
                                )}
                                <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 px-2 py-1 text-sm bg-black text-white rounded hidden group-hover:block">
                                    {c.username} ({c.level})
                                </div>
                            </div>
                        ))}
                        {/* Add collaborator button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowAddUserDropdown(!showAddUserDropdown)}
                                className="w-8 h-8 rounded-full bg-gray-300 dark:bg-zinc-600 flex items-center justify-center hover:bg-gray-400 transition-colors"
                            >
                                <FiUserPlus className="text-white"/>
                            </button>
                            {showAddUserDropdown && (
                                <div className="absolute top-10 left-0 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded shadow-lg p-2 w-48 z-50">
                                    {availableUsersToAdd.map(u => (
                                        <div
                                            key={u.id}
                                            className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer"
                                            onClick={() => handleAddCollaborator(u.id)}
                                        >
                                            <img src={u.avatar_url || '/default-avatar.png'} className="w-6 h-6 rounded-full" alt={u.username}/>
                                            <span className="text-sm text-gray-700 dark:text-gray-200">{u.username}</span>
                                        </div>
                                    ))}
                                    {availableUsersToAdd.length === 0 && (
                                        <div className="p-2 text-sm text-gray-500">
                                            No available users
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
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