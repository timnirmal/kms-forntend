'use client';

import {useEffect, useRef, useCallback, useState} from 'react';
import {usePathname, useRouter} from "next/navigation";
import {motion} from 'framer-motion';
import {FiSend, FiMic, FiMicOff, FiPlus, FiUserPlus, FiUsers, FiTag, FiX, FiCheck, FiChevronDown} from 'react-icons/fi';
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
import {useRecordVoice} from "@/hooks/useRecord";
import MessageToolbar from "@/components/messageToolBar";

interface Message {
    id: string;
    content: string;
    type: 'user' | 'assistant' | 'system';
    function_call?: string | null;
    function_call_text?: string | null;
    created_at: Date;
    user_id?: string;
    sources?: string[]; // Array of strings for sources
    image_urls?: string[]; // Array of strings for image URLs
}

interface SessionData {
    session_id: string;
    user: string;
    mode: 'text' | 'voice';
    department: string; // department ID
    model: 'fast' | 'pro';
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
    sources?: string[]; // Array of strings for sources
    image_urls?: string[]; // Array of strings for image URLs
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

interface Department {
    department_id: string;
    name: string;
}

export default function Dashboard() {
    const supabase = createClient();
    const pathname = usePathname();
    const router = useRouter();

    // States
    const [sessionData, setSessionData] = useState<SessionData | null>(null);
    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [department, setDepartment] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const initialAssistantRequested = useRef(false);
    const [combinedUserData, setCombinedUserData] = useState<CombinedUserDataInterface | null>(null);

    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [allUsers, setAllUsers] = useState<CombinedUserDataInterface[]>([]); // For adding new collaborators

    const [showAddUserDropdown, setShowAddUserDropdown] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    // Sidebar for participants
    const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);

    // Modal for adding multiple collaborators
    const [showAddCollaboratorsModal, setShowAddCollaboratorsModal] = useState(false);
    const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<CombinedUserDataInterface[]>([]);
    const [accessLevel, setAccessLevel] = useState<'read' | 'write'>('write');
    const [customMessage, setCustomMessage] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);

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
    const connectConversationOnce = useRef(false);

    const {startTextRecording, stopTextRecording, textByHook} = useRecordVoice();

    const chatContainerRef = useRef<HTMLDivElement>(null);
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

    // Fetch all users for adding collaborators
    useEffect(() => {
        const loadAllUsers = async () => {
            const {data, error} = await supabase.from('profiles').select('id,email,username,avatar_url');
            if (error) {
                console.error('Error fetching all users:', error);
            } else {
                setAllUsers(data || []);
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

    async function loadDepartmentName(deptId: string) {
        // Fetch department name from department table
        const {data, error} = await supabase
            .from('department')
            .select('name')
            .eq('department_id', deptId)
            .single();
        if (error) {
            console.error('Error fetching department name:', error);
            return null;
        }
        return data.name;
    }

    async function setupPresence(session_id: string, currentUserId: string) {
        const presenceChannel = supabase.channel(`presence-${session_id}`, {
            config: {
                presence: {key: currentUserId}
            }
        });

        presenceChannel
            .on('presence', {event: 'sync'}, () => {
                const state = presenceChannel.presenceState();
                const online = Object.keys(state);
                setOnlineUsers(online);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    presenceChannel.track({user_id: currentUserId, joined_at: new Date().toISOString()});
                }
            });
    }

    useEffect(() => {
        const loadSessionData = async () => {
            if (!sessionId || !combinedUserData) return;

            // Fetch session info
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
            setSessionData(sess);
            setMode(sess.mode);

            // Load department name
            const name = await loadDepartmentName(sess.department);
            setDepartment(name || sess.department); // fallback to id if not found

            const loadedCollaborators = await loadCollaborators(sess.session_id);
            setCollaborators(loadedCollaborators);

            // Presence only if text mode
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

            // Subscribe to realtime if text mode
            if (sess.mode === 'text') {
                const channel = supabase.channel(`session-${sessionId}`)
                    .on(
                        'postgres_changes',
                        {event: '*', schema: 'public', table: 'chat', filter: `session_id=eq.${sessionId}`},
                        (payload) => {
                            const newRow = payload.new as ChatRow;
                            if (payload.eventType === 'INSERT') {
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
                                const updatedMessage = {
                                    content: newRow.message,
                                    function_call: newRow.function_call || null,
                                    function_call_text: newRow.function_call_text || null
                                };
                                setMessages(prev => prev.map(m => m.id === newRow.chat_id ? {
                                    ...m,
                                    ...updatedMessage
                                } : m));
                            } else if (payload.eventType === 'DELETE') {
                                const oldRow = payload.old as ChatRow;
                                setMessages(prev => prev.filter(m => m.id !== oldRow.chat_id));
                            }
                        }
                    ).subscribe();

                // Check if we need an initial assistant response
                const userCount = loadedMessages.filter(m => m.type === 'user').length;
                const assistantCount = loadedMessages.filter(m => m.type === 'assistant').length;

                if (!initialAssistantRequested.current && userCount === 1 && assistantCount === 0 && loadedMessages.length === 1 && loadedMessages[0].type === 'user') {
                    initialAssistantRequested.current = true;
                    setIsProcessing(true);
                    console.log(name)
                    console.log(sessionRows)
                    console.log(sess)
                    console.log(department)
                    try {
                        const response = await fetch('/api/chat', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json',},
                            body: JSON.stringify({
                                query: loadedMessages[0].content,
                                department: [name],
                                access_level: 1,
                                model: sess.model
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Failed to get assistant response');
                        }

                        const data = await response.json();
                        const assistantMessageContent = data.message;
                        const assistantSources = data.sources || null;
                        const assistantImages = data.imageUrls || null;

                        const {error: insertError} = await supabase
                            .from('chat')
                            .insert([
                                {
                                    session_id: sessionId,
                                    user: combinedUserData.id,
                                    role: 'assistant',
                                    message: assistantMessageContent,
                                    mode: 'text',
                                    sources: assistantSources,
                                    image_urls: assistantImages
                                },
                            ]);

                        if (insertError) {
                            console.error('Error inserting assistant message:', insertError);
                        } else {
                            // Title generation after assistant message
                            const titleResponse = await fetch('/api/generate-title', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    messages: [
                                        loadedMessages[0].content, // User's first message
                                        assistantMessageContent   // Assistant's response
                                    ]
                                })
                            });

                            if (titleResponse.ok) {
                                const {title} = await titleResponse.json();
                                const {error: titleUpdateError} = await supabase
                                    .from('session')
                                    .update({title})
                                    .eq('session_id', sessionId);

                                if (titleUpdateError) {
                                    console.error('Error updating session title:', titleUpdateError);
                                } else {
                                    setSessionData(prev => prev ? {...prev, title} : prev);
                                }
                            }

                        }
                        setIsProcessing(false);
                    } catch (error) {
                        console.error('Error fetching assistant response:', error);
                        setIsProcessing(false);
                    }
                }
            }

            // Voice mode initialization
            if (sess.mode === 'voice' && !connectConversationOnce.current && combinedUserData) {
                connectConversationOnce.current = true;
                await connectConversation(sess, combinedUserData);
            }
        };

        if (combinedUserData) {
            loadSessionData();
        }
    }, [sessionId, supabase, combinedUserData, department]);

    useEffect(() => {
        const sendMessageFromHook = async () => {
            if (!textByHook || !sessionData) return;

            // Mimic user message behavior
            setIsProcessing(true);
            const userMessageContent = textByHook.trim();

            // Add the user message to the database
            await saveMessageToDB('user', userMessageContent);

            const userCount = messages.filter(m => m.type === 'user').length;
            const assistantCount = messages.filter(m => m.type === 'assistant').length;
            let body: any = {
                query: userMessageContent,
                department: [department],
                access_level: 1,
                model: sessionData.model
            };

            // If there's message history, include it
            if (!(userCount === 0 && assistantCount === 0)) {
                body.history = buildHistoryString();
            }

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(body),
                });

                if (!response.ok) throw new Error('Failed to get assistant response');

                const data = await response.json();
                const assistantMessageContent = data.message;
                const assistantSources = data.sources || null;
                const assistantImages = data.imageUrls || null;

                // Save assistant response in the database
                await saveMessageToDB('assistant', assistantMessageContent, undefined, null, null, assistantSources, assistantImages);

                setIsProcessing(false);
            } catch (error) {
                console.error('Error sending message:', error);
                const errorMsg =
                    "I apologize, but I'm having trouble responding right now. Please try again.";
                await saveMessageToDB('assistant', errorMsg);
                setIsProcessing(false);
            } finally {
                // Reset textByHook after handling
                setInputMessage(''); // Clear the input for UI purposes
            }
        };

        sendMessageFromHook();
    }, [textByHook]); // Re-run whenever `textByHook` changes


    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const saveMessageToDB = async (
        role: 'user' | 'assistant' | 'system', content: string, openai_id?: string | null,
        function_call?: string | null, function_call_text?: string | null,
        sources?: string[] | null, image_urls?: string[] | null
    ) => {
        if (!sessionData || !combinedUserData) return;
        if (openai_id) {
            const {data: existing} = await supabase
                .from('chat')
                .select('chat_id')
                .eq('openai_id', openai_id)
                .eq('session_id', sessionData.session_id)
                .single();

            if (existing) {
                const {error: updateError} = await supabase
                    .from('chat')
                    .update({
                        message: content,
                        function_call,
                        function_call_text,
                        sources: sources || null,
                        image_urls: image_urls || null
                    })
                    .eq('chat_id', existing.chat_id);

                if (updateError) {
                    console.error('Error updating message:', updateError);
                }
                return;
            }
        }

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
                    function_call_text: function_call_text || null,
                    sources: sources || null,
                    image_urls: image_urls || null
                }
            ]);

        if (insertError) console.error('Error saving message:', insertError);
    };

    const buildHistoryString = () => {
        const last10 = messages.slice(-10);
        return last10.map(m => {
            let speakerName = m.type === 'assistant' ? 'assistant' : 'user (unknown)';
            if (m.type === 'user') {
                const userColab = collaborators.find(c => c.user_id === m.user_id);
                speakerName = userColab ? `user (${userColab.username})` : 'user (unknown)';
            }
            return `${speakerName}: ${m.content}`;
        }).join('\n');
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !sessionData || sessionData.mode !== 'text') return;

        setIsProcessing(true);
        const userMessageContent = inputMessage.trim();
        setInputMessage('');

        await saveMessageToDB('user', userMessageContent);

        const userCount = messages.filter(m => m.type === 'user').length;
        const assistantCount = messages.filter(m => m.type === 'assistant').length;
        let body: any = {
            query: userMessageContent,
            department: [department],
            access_level: 1,
            model: sessionData.model
        };
        if (!(userCount === 0 && assistantCount === 0)) {
            body.history = buildHistoryString();
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Failed to get assistant response');

            const data = await response.json();
            const assistantMessageContent = data.message;
            const assistantSources = data.sources || null;
            const assistantImages = data.imageUrls || null;

            const {error: insertError} = await supabase
                .from('chat')
                .insert([
                    {
                        session_id: sessionData.session_id,
                        user: sessionData.user,
                        role: 'assistant',
                        message: assistantMessageContent,
                        mode: 'text',
                        sources: assistantSources,
                        image_urls: assistantImages
                    },
                ]);

            if (insertError) {
                console.error('Error inserting assistant message:', insertError);
            }
            setIsProcessing(false);

        } catch (error) {
            console.error('Error sending message:', error);
            const errorMsg = "I apologize, but I'm having trouble responding right now. Please try again.";
            await saveMessageToDB('assistant', errorMsg);
            setIsProcessing(false);
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setInputMessage('');
        router.push('/dashboard');
    };

    // Add a single collaborator (legacy)
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
            const updated = await loadCollaborators(sessionData.session_id);
            setCollaborators(updated);
        }
        setShowAddUserDropdown(false);
    };

    async function removeCollaborator(userIdToRemove: string) {
        if (!sessionData) return;
        const {error} = await supabase
            .from('colab')
            .delete()
            .match({session_id: sessionData.session_id, user_id: userIdToRemove});

        if (error) {
            console.error("Error removing collaborator:", error);
            return;
        }

        const updated = await loadCollaborators(sessionData.session_id);
        setCollaborators(updated);
    }


    // Add multiple collaborators from modal
    const handleAddMultipleCollaborators = async () => {
        if (!sessionData || selectedUsersToAdd.length === 0) return;
        const newCols = selectedUsersToAdd.map(u => ({
            session_id: sessionData.session_id,
            user_id: u.id,
            level: accessLevel
        }));

        const {error} = await supabase.from('colab').insert(newCols);
        if (error) {
            console.error('Error adding collaborators:', error);
        } else {
            const updated = await loadCollaborators(sessionData.session_id);
            setCollaborators(updated);

            // Optionally send notification or handle customMessage, copy link, etc.
            // copy link
            const currentUrl = window.location.href;
            // You might want to copy this to clipboard or handle differently
            // handle customMessage sending if needed

            setShowAddCollaboratorsModal(false);
            setSelectedUsersToAdd([]);
            setAccessLevel('write');
            setCustomMessage('');
        }
    };

    // Presence & UI methods for voice mode
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
        client.updateSession({voice: "alloy"});

        setIsConnected(true);

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
                    const response = await fetch(`${process.env.NEXT_PUBLIC_RETRIVEL_BACKEND}/complete-query`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            query,
                            department: [session.department],
                            access_level: 1,
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
            if (session.mode !== 'voice') return;

            const clientItems = client.conversation.getItems();
            const newMessages: Message[] = [];

            // console.log(clientItems)

            for (const it of clientItems) {
                let role: 'user' | 'assistant' | 'system';
                let function_call = null;
                let function_call_text = null;
                let content = '';

                if (it.type === 'message') {
                    role = it.role === 'user' ? 'user' : 'assistant';
                    console.log(it.content?.[0])
                    const transcript = it.role === 'assistant'
                        ? it.content?.[0]?.transcript || it.content?.[0]?.text || ''
                        : it.content?.[0]?.transcript || it.content?.[0]?.text || '';

                    if (!messageBuffers.current[it.id]) {
                        messageBuffers.current[it.id] = {
                            role,
                            content: transcript,
                            created_at: new Date(),
                        };
                    } else {
                        messageBuffers.current[it.id].content = transcript;
                    }
                    content = messageBuffers.current[it.id].content;
                } else if (it.type === 'function_call') {
                    role = 'system';
                    function_call = it.name || null;
                    function_call_text = it.arguments || '(no arguments)';

                    if (!messageBuffers.current[it.id]) {
                        messageBuffers.current[it.id] = {
                            role,
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
                            role,
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
                            role,
                            content,
                            created_at: new Date(),
                        };
                    } else {
                        messageBuffers.current[it.id].content = content;
                    }
                }

                newMessages.push({
                    id: it.id,
                    content,
                    type: role,
                    function_call,
                    function_call_text,
                    created_at: messageBuffers.current[it.id].created_at,
                    user_id: session.user
                });

                await saveMessageToDB(
                    messageBuffers.current[it.id].role,
                    messageBuffers.current[it.id].content,
                    it.id,
                    messageBuffers.current[it.id].function_call,
                    messageBuffers.current[it.id].function_call_text
                );
            }

            setMessages(newMessages);

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

        // initial greet in voice mode if you want
        client.sendUserMessageContent([{type: 'input_text', text: 'Hello!'}]);
    }, [isConnected, sessionData]);

    // Text mode mic button: record audio, call whisper API, set input message
    const handleTranscribeAudio = async (audioBlob: Blob) => {
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'speech.wav'); // or speech.webm depending on your recording format

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });

            console.log(response)

            if (!response.ok) {
                throw new Error('Failed to transcribe audio');
            }

            const {text} = await response.json();
            setInputMessage(text);
        } catch (error) {
            console.error('Transcription error:', error);
            alert("This feature is in beta mode and encountered an error. Please try again later.");
        }
    };


    const startTextModeRecording = async () => {
        try {
            setIsRecording(true);
            const wavRecorder = wavRecorderRef.current;

            // Call `.begin()` if not already started
            if (!wavRecorder.processor) {
                await wavRecorder.begin(); // This initializes the recorder
            }

            // Start recording
            if (!wavRecorder.recording) {
                await wavRecorder.record((data) => {
                    // Process audio chunks here (optional)
                });
            }
        } catch (error) {
            console.error("Error starting recording:", error);
            alert("This feature is in beta mode. Please try again later.");
            setIsRecording(false); // Reset recording state on failure
        }
    };

    const stopTextModeRecording = async () => {
        try {
            console.log("Stopping............")
            setIsRecording(false);
            const wavRecorder = wavRecorderRef.current;

            if (wavRecorder.recording) {
                const audioData = await wavRecorder.end(); // Get raw audio data
                console.log('Audio Data Type:', typeof audioData, audioData);
                const audioBlob = new Blob([audioData], {type: 'audio/wav'}); // Convert to Blob
                if (audioBlob) {
                    await handleTranscribeAudio(audioBlob); // Pass to transcription
                }
            }
        } catch (error) {
            console.error("Error stopping recording:", error);
            alert("This feature is in beta mode. Please try again later.");
        }
    };

    // Voice mode: add cancel and switch to text mode
    const handleVoiceCancel = async () => {
        // Disconnect voice session
        const client = clientRef.current;
        await client.disconnect();
        setIsConnected(false);
        // Remain in voice mode or do something else?
    };

    const handleSwitchToTextMode = async () => {
        // Disconnect voice session and switch to text mode
        const client = clientRef.current;
        await client.disconnect();
        setIsConnected(false);
        if (sessionData) {
            // Update session mode to text if needed
            await supabase
                .from('session')
                .update({mode: 'text'})
                .eq('session_id', sessionData.session_id);
            setMode('text');
        }
    };


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

    const availableUsersToAdd = allUsers.filter(u => !collaborators.some(c => c.user_id === u.id && u.id !== combinedUserData?.id));

    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

    const isCurrentUserOnline = combinedUserData && onlineUsers.includes(combinedUserData.id);

    const availableUsersToPick = allUsers.filter(u =>
        !collaborators.some(c => c.user_id === u.id) &&
        !selectedUsersToAdd.some(su => su.id === u.id) &&
        u.id !== combinedUserData?.id
    );

    return (
        <div className="flex flex-col overflow-hidden h-[calc(100vh-5rem)] bg-gray-50 dark:bg-zinc-900">
            {/* Top Bar - sticky at top */}
            <div
                className="sticky top-0 z-10 shrink-0 border-b border-gray-200 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-lg">
                <div className="h-14 flex items-center justify-between px-4">
                    {/* Left - participants */}
                    <div className="flex items-center space-x-2">
                        {/* Participants indicator */}
                        <motion.button
                            whileHover={{scale: 1.05}}
                            whileTap={{scale: 0.95}}
                            onClick={() => setIsParticipantsPanelOpen(!isParticipantsPanelOpen)}
                            className={`p-2 rounded-lg transition-all ${
                                isParticipantsPanelOpen
                                    ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800'
                            }`}
                            title="Toggle Participants"
                        >
                            <FiUsers className="w-4 h-4"/>
                        </motion.button>
                        {/* Display up to 3 online collaborators + "more" */}
                        {(() => {
                            const onlineCollaborators = collaborators.filter(c => onlineUsers.includes(c.user_id));
                            const displayedOnlineCollaborators = onlineCollaborators.slice(0, 2);
                            const moreCount = onlineCollaborators.length - displayedOnlineCollaborators.length;

                            return (
                                <div className="flex items-center space-x-1 relative">
                                    {displayedOnlineCollaborators.map((c) => (
                                        <div
                                            key={c.user_id}
                                            className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800"
                                        >
                                            <img
                                                src={c.avatar_url || '/default-avatar.png'}
                                                alt={c.username}
                                                className="w-full h-full rounded-full"
                                            />
                                            {onlineUsers.includes(c.user_id) && (
                                                <span
                                                    className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-zinc-800"></span>
                                            )}
                                        </div>
                                    ))}
                                    {moreCount > 0 && (
                                        <motion.button
                                            whileHover={{scale: 1.05}}
                                            whileTap={{scale: 0.95}}
                                            onClick={() => setIsParticipantsPanelOpen(!isParticipantsPanelOpen)}
                                            className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 relative group"
                                            title="View more participants"
                                        >
                                            +{moreCount}
                                            <div
                                                className="absolute top-full mt-1 py-1 px-2 bg-black text-white text-xs rounded-lg opacity-0 group-hover:opacity-100">
                                                more...
                                            </div>
                                        </motion.button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Right - Department, Mode, New Chat */}
                    <div className="flex items-center space-x-3">
                        {department && (
                            <div className="flex items-center px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <FiTag className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mr-1.5"/>
                                <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  {department}
                </span>
                            </div>
                        )}
                        {sessionData && sessionData.mode === 'text' && (
                            <div className={`flex items-center px-2.5 py-1.5 rounded-lg ${
                                sessionData.model === 'fast'
                                    ? 'bg-green-50 dark:bg-green-900/30'
                                    : 'bg-purple-50 dark:bg-purple-900/30'
                            }`}>
                <span className={`text-sm font-medium ${
                    sessionData.model === 'fast'
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-purple-700 dark:text-purple-300'
                }`}>
                  {sessionData.model === 'fast' ? 'Fast Mode' : 'Pro Mode'}
                </span>
                            </div>
                        )}

                        <button
                            onClick={handleNewChat}
                            className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600
                 text-white rounded-lg transition-all shadow-sm"
                            title="New Chat"
                        >
                            <FiPlus className="w-3.5 h-3.5"/>
                            <span className="text-sm">New Chat</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
                {/* Participants Sidebar */}
                <motion.div
                    initial={{width: 0}}
                    animate={{
                        width: isParticipantsPanelOpen ? 320 : 0,
                        opacity: isParticipantsPanelOpen ? 1 : 0
                    }}
                    className="border-r border-gray-200 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50
               backdrop-blur-lg overflow-hidden"
                >
                    {isParticipantsPanelOpen && (
                        <div className="w-80 p-4 h-full overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Collaborators</h3>
                                <button
                                    onClick={() => setShowAddCollaboratorsModal(true)}
                                    className="p-2 rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    title="Add Collaborators"
                                >
                                    <FiUserPlus className="w-4 h-4"/>
                                </button>
                            </div>
                            <div className="space-y-3">
                                {collaborators.map(c => {
                                    const online = onlineUsers.includes(c.user_id);
                                    return (
                                        <div key={c.user_id}
                                             className="relative flex items-center space-x-3 p-2 rounded-md bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-700">
                                            <div className="relative">
                                                <img
                                                    src={c.avatar_url || '/default-avatar.png'}
                                                    alt={c.username}
                                                    className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800"
                                                />
                                                {/*{online && (*/}
                                                {/*    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-zinc-800"></span>*/}
                                                {/*)}*/}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-900 dark:text-white font-semibold">{c.username}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {c.level} access {online &&
                                                    <span className="text-green-500 ml-1">● online</span>}
                                                </p>
                                            </div>

                                            {combinedUserData?.id === sessionData?.user && (
                                                <button
                                                    onClick={() => removeCollaborator(c.user_id)}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded-md"
                                                    title="Remove Collaborator"
                                                >
                                                    <FiX className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Messages Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Scrollable messages */}
                    <div className="flex-1 overflow-y-auto" style={{height: 'calc(100vh - 8.5rem)'}}>
                        <div className="max-w-3xl mx-auto p-4 space-y-4" ref={chatContainerRef}>
                            {messages.length === 0 && !isProcessing ? (
                                <div
                                    className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 h-full pt-10">
                                    <p className="text-lg font-medium mb-1">No messages yet</p>
                                    <p className="text-sm">Start a new conversation</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {messages
                                        .filter((message) => message.type !== 'system') // Exclude 'system' messages
                                        .map((message) => {
                                            const sender = collaborators.find(c => c.user_id === message.user_id);
                                            const isUser = message.type === 'user';

                                            const displayName = message.type === 'assistant' ? 'Assistant' : (sender ? sender.username : 'timnirmal');
                                            const avatarUrl = message.type === 'assistant' ? '/assistant-avatar.png' : (sender?.avatar_url || '/default-avatar.png');

                                            return (
                                                <motion.div
                                                    key={message.id}
                                                    initial={{opacity: 0, y: 10}}
                                                    animate={{opacity: 1, y: 0}}
                                                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                                                >
                                                    {/* Avatar and Name */}
                                                    <div
                                                        className={`flex items-center mb-1 ${isUser ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'}`}>
                                                        <img src={avatarUrl} alt={displayName}
                                                             className="w-8 h-8 rounded-full"/>
                                                        <span
                                                            className="text-sm text-gray-700 dark:text-white font-semibold">{displayName}</span>
                                                    </div>

                                                    {/* Message Bubble */}
                                                    <div className={`relative max-w-[70%] rounded-lg p-4 ${
                                                        isUser
                                                            ? 'bg-blue-500 text-white'
                                                            : message.type === 'assistant'
                                                                ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white'
                                                                : 'bg-red-100 dark:bg-red-700 text-red-900 dark:text-white'
                                                    }`}>
                                                        <div
                                                            className="prose dark:prose-invert max-w-none whitespace-pre-wrap break-words">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm]}
                                                                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                                            >
                                                                {message.content.trim()}
                                                            </ReactMarkdown>
                                                        </div>

                                                        {/* Display sources if available */}
                                                        {message.sources && message.sources.length > 0 && (
                                                            <div className="mt-2">
                                                                <h4 className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 mb-1">Sources:</h4>
                                                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300">
                                                                    {message.sources.map((src, i) => (
                                                                        <li key={i}><a href={`#`}
                                                                                       className="text-blue-600 dark:text-blue-400 underline">{src}</a>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Display images if available */}
                                                        {message.image_urls && message.image_urls.length > 0 && (
                                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                                {message.image_urls.map((imgUrl, i) => (
                                                                    <div key={i}
                                                                         className="w-full rounded overflow-hidden border dark:border-zinc-600">
                                                                        <img src={imgUrl} alt={`Image ${i + 1}`}
                                                                             className="object-cover w-full h-auto"/>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <p className="text-[10px] mt-1 opacity-70 text-right">
                                                            {new Date(message.created_at).toLocaleTimeString()}
                                                        </p>
                                                    </div>

                                                    {/* Toolbar */}
                                                    <MessageToolbar
                                                        message={message}
                                                        sessionId={sessionData?.session_id}
                                                        userId={combinedUserData?.id}
                                                    />
                                                </motion.div>
                                            );
                                        })}

                                    {isProcessing && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 dark:bg-zinc-700 rounded-lg p-4 flex space-x-2">
                                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                                                     style={{animationDelay: '150ms'}}></div>
                                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                                                     style={{animationDelay: '300ms'}}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Bar - sticky at bottom */}
                    <div
                        className="sticky bottom-0 z-10 shrink-0 border-t border-gray-200 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-lg">
                        <div className="max-w-3xl mx-auto p-4">
                            {mode === 'text' ? (
                                <div className="relative flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type your message..."
                                        className="flex-1 p-3 pr-20 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                                    />

                                    {/* Push-to-talk mic for text mode */}
                                    <motion.button
                                        whileHover={{scale: 1.5}}
                                        whileTap={{scale: 0.95}}
                                        onMouseDown={startTextRecording}
                                        onMouseUp={stopTextRecording}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                            isRecording
                                                ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/30'
                                                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400'
                                        }`}
                                        title={isRecording ? 'Stop Recording' : 'Press and Hold to Talk'}
                                    >
                                        {isRecording ? <FiMicOff className="w-4 h-4"/> : <FiMic className="w-4 h-4"/>}
                                    </motion.button>
                                    <motion.button
                                        whileHover={{scale: 1.05}}
                                        whileTap={{scale: 0.95}}
                                        onClick={handleSendMessage}
                                        disabled={!inputMessage.trim() || isProcessing}
                                        className="p-1.5 text-blue-500 hover:text-blue-600 disabled:text-gray-400
                           disabled:hover:text-gray-400"
                                        title="Send Message"
                                    >
                                        <FiSend className="w-4 h-4"/>
                                    </motion.button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center space-x-4">
                                    <button
                                        onMouseDown={startRecording}
                                        onMouseUp={stopRecording}
                                        className={`p-2 rounded-full transition-colors ${
                                            isRecording
                                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                                : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white'
                                        }`}
                                        title="Hold to speak"
                                    >
                                        {isRecording ? <FiMicOff size={20}/> : <FiMic size={20}/>}
                                    </button>

                                    {/* Cancel and Switch to Text Mode Buttons in voice mode */}
                                    <button
                                        onClick={handleVoiceCancel}
                                        className="p-2 text-sm bg-gray-200 dark:bg-zinc-700 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200"
                                    >
                                        Cancel
                                    </button>

                                    {/*<button*/}
                                    {/*    onClick={handleSwitchToTextMode}*/}
                                    {/*    className="p-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"*/}
                                    {/*>*/}
                                    {/*    Switch to Text Mode*/}
                                    {/*</button>*/}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal for adding multiple collaborators with tags */}
                {showAddCollaboratorsModal && (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{scale: 0.95, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            className="bg-white dark:bg-zinc-800 rounded-xl p-4 max-w-md w-full shadow-xl"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Add Collaborators
                                </h3>
                                <button
                                    onClick={() => setShowAddCollaboratorsModal(false)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    <FiX className="w-5 h-5"/>
                                </button>
                            </div>

                            {/* User selection with tags */}
                            <div className="mb-4 relative">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Add People
                                </label>
                                <div
                                    className="flex flex-wrap items-center border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 p-2 cursor-text"
                                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                                >
                                    {selectedUsersToAdd.map(u => (
                                        <div key={u.id}
                                             className="flex items-center bg-blue-100 text-blue-700 rounded-full px-2 py-1 text-sm mr-2 mb-2">
                                            <img src={u.avatar_url || '/default-avatar.png'} alt={u.username}
                                                 className="w-4 h-4 rounded-full mr-1"/>
                                            <span>{u.username}</span>
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedUsersToAdd(selectedUsersToAdd.filter(su => su.id !== u.id));
                                            }} className="ml-1 text-blue-700 hover:text-blue-900"><FiX/></button>
                                        </div>
                                    ))}
                                    {selectedUsersToAdd.length === 0 && (
                                        <span
                                            className="text-gray-500 dark:text-gray-400 ml-1">Click to add people...</span>
                                    )}
                                </div>
                                {showUserDropdown && (
                                    <div
                                        className="absolute top-full mt-1 w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                                        {availableUsersToPick.length === 0 ? (
                                            <div className="p-2 text-sm text-gray-500 dark:text-gray-300">No users
                                                available</div>
                                        ) : (
                                            availableUsersToPick.map(u => (
                                                <div
                                                    key={u.id}
                                                    className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer"
                                                    onClick={() => {
                                                        setSelectedUsersToAdd([...selectedUsersToAdd, u]);
                                                        setShowUserDropdown(false);
                                                    }}
                                                >
                                                    <img src={u.avatar_url || '/default-avatar.png'} alt={u.username}
                                                         className="w-6 h-6 rounded-full mr-2"/>
                                                    <span
                                                        className="text-sm text-gray-700 dark:text-gray-200">{u.username}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Access level */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Access Level
                                </label>
                                <select
                                    value={accessLevel}
                                    onChange={(e) => setAccessLevel(e.target.value as 'read' | 'write')}
                                    className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                                >
                                    <option value="write">Write</option>
                                    <option value="read">View Only</option>
                                </select>
                            </div>

                            {/* Custom Message */}
                            <div className="mb-4">
                                <label
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Add a message (optional)
                                </label>
                                <textarea
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                                    placeholder="Write a message to send to these new collaborators..."
                                    rows={7}
                                ></textarea>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(currentUrl);
                                    }}
                                    className="px-3 py-2 text-sm bg-gray-200 dark:bg-zinc-700 rounded-lg text-gray-700 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-zinc-600"
                                >
                                    Copy Link
                                </button>
                                <div className="space-x-2">
                                    <button
                                        onClick={() => setShowAddCollaboratorsModal(false)}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddMultipleCollaborators}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}

