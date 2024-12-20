'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {motion, AnimatePresence} from 'framer-motion';
import {FiMessageSquare, FiTrash2, FiClock, FiArrowRight, FiX, FiTag, FiFilter, FiEye} from 'react-icons/fi';
import {Database} from '@/types/types';
import {createClient} from "@/utils/supabase/client";
import ReactMarkdown from "react-markdown";

type Session = Database['public']['Tables']['session']['Row'];
type Chat = Database['public']['Tables']['chat']['Row'];
type Department = Database['public']['Tables']['department']['Row'];

interface Message {
    id: string;
    content: string;
    type: 'user' | 'assistant';
    timestamp: Date;
}

export default function ChatHistory() {
    const supabase = createClient();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [summaryModalSession, setSummaryModalSession] = useState<Session | null>(null); // For summary view modal

    // Add new state variable for loading summary and API response
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [sessionSummary, setSessionSummary] = useState<string | null>(null);

    const router = useRouter();

    // Fetch departments
    useEffect(() => {
        const fetchDepartments = async () => {
            const {data, error} = await supabase
                .from('department')
                .select('*');
            if (error) {
                console.error('Error fetching departments:', error);
            } else if (data && data.length > 0) {
                setDepartments(data);
            }
        };
        fetchDepartments();
    }, [supabase]);

    // Fetch all sessions
    useEffect(() => {
        const fetchSessions = async () => {
            const {data, error} = await supabase
                .from('session')
                .select('*')
                .order('created_at', {ascending: false});
            if (error) {
                console.error('Error fetching sessions:', error);
            } else {
                setSessions(data || []);
            }
        };
        fetchSessions();

        // Realtime subscription for sessions
        const channel = supabase.channel('public:session')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'session'},
                async () => {
                    const {data, error} = await supabase
                        .from('session')
                        .select('*')
                        .order('created_at', {ascending: false});
                    if (!error) {
                        setSessions(data || []);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    // Filter sessions by selected department
    const filteredSessions = selectedDepartment === 'all'
        ? sessions
        : sessions.filter((session) => session.department === selectedDepartment);

    const handleDeleteChat = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        const {error} = await supabase
            .from('session')
            .delete()
            .eq('session_id', sessionId);
        if (error) {
            console.error('Error deleting session:', error);
        } else {
            setSelectedSession(null);
        }
    };

    const handleContinueChat = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        localStorage.setItem('currentChatId', sessionId);
        router.push(`/dashboard/${sessionId}`);
    };

    const handleViewChat = async (session: Session) => {
        setSelectedSession(session);
        setLoadingMessages(true);
        const {data: chats, error} = await supabase
            .from('chat')
            .select('*')
            .eq('session_id', session.session_id)
            .order('created_at', {ascending: true});

        if (error) {
            console.error('Error fetching chat messages:', error);
            setLoadingMessages(false);
            return;
        }

        const filteredMessages = (chats || [])
            .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
            .map((msg) => ({
                id: msg.chat_id,
                content: msg.message,
                type: msg.role === 'user' ? 'user' : 'assistant',
                timestamp: new Date(msg.created_at!)
            }));

        setSessionMessages(filteredMessages);
        setLoadingMessages(false);
    };

    // Function to load summary when modal opens
    const handleViewSummary = async (session: Session) => {
        setSummaryModalSession(session); // Open the modal
        setLoadingSummary(true); // Start loading
        setSessionSummary(null); // Reset the previous summary

        try {
            // Fetch session messages to send to the API
            const {data: chats, error} = await supabase
                .from('chat')
                .select('*')
                .eq('session_id', session.session_id)
                .order('created_at', {ascending: true});

            if (error) {
                throw new Error('Failed to fetch chat messages');
            }

            const messages = (chats || []).map((msg) => ({
                id: msg.chat_id,
                content: msg.message,
                role: msg.role,
                timestamp: msg.created_at,
            }));

            console.log(messages)

            // Call the API to generate the summary
            const response = await fetch('/api/summery', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({messages}),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch session summary');
            }

            const data = await response.json();
            console.log(data)
            setSessionSummary(data.summery || 'No summary available');
        } catch (error) {
            console.error('Error fetching session summary:', error);
            setSessionSummary('Failed to load summary.');
        } finally {
            setLoadingSummary(false); // Stop loading
        }
    };

    // Helper to get last message excerpt if no summary is available
    const getLastMessageExcerpt = (session: Session): string => {
        // Find the last message of the session from sessions or from previously stored state
        // Since we have all sessions, we can do a quick fetch:
        // For performance you might want to store last msg excerpt in session table
        // Here, just find the last user or assistant message from sessionMessages if it's the currently selected session
        // If not selected, do a quick fetch:

        const sessionId = session.session_id;
        // If we have selectedSession and it matches sessionId, use sessionMessages directly
        if (selectedSession?.session_id === sessionId && sessionMessages.length > 0) {
            const lastMsg = sessionMessages[sessionMessages.length - 1];
            return truncateString(lastMsg.content, 100);
        } else {
            // If not selected, we do a quick fetch of last message synchronously (not ideal)
            // For simplicity, assume sessions are frequently updated and you won't need a separate fetch here.
            // You could do a separate minimal fetch for the last message:
            // Since user asked for code changes only, we do a synchronous approach:
            // Return a placeholder if we cannot load messages right now.
            return 'No messages...';
        }
    };

    const truncateString = (str: string, maxLength: number) => {
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    };

    return (
        <div className="p-6">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-8 mb-6"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Chat History
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            View and manage your previous conversations
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <FiFilter className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                        >
                            <option value="all">All Departments</option>
                            {departments.map((dept) => (
                                <option key={dept.department_id} value={dept.department_id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-4">
                {filteredSessions.length > 0 ? (
                    filteredSessions.map((session) => (
                        <motion.div
                            key={session.session_id}
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            onClick={() => handleViewChat(session)}
                            className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                        <FiMessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400"/>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {session.title ? session.title : (session.mode === 'text' ? 'Text Session' : 'Voice Session')}
                                        </h3>
                                        <div className="flex items-center space-x-3 mt-1">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                                                <FiClock className="w-4 h-4 mr-1"/>
                                                {new Date(session.created_at!).toLocaleString()}
                                            </p>
                                            <div className="flex items-center text-sm text-blue-500 dark:text-blue-400">
                                                <FiTag className="w-4 h-4 mr-1"/>
                                                {departments.find((d) => d.department_id === session.department)?.name || 'Unknown'}
                                                &nbsp;|&nbsp; {session.model === 'pro' ? 'Pro Mode' : 'Fast Mode'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={(e) => handleDeleteChat(e, session.session_id)}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                        title="Delete chat"
                                    >
                                        <FiTrash2 className="w-5 h-5"/>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                {/*<p className="text-gray-600 dark:text-gray-300 line-clamp-2 flex-1">*/}
                                {/*    {session.summery ? session.summery : getLastMessageExcerpt(session)}*/}
                                {/*</p>*/}
                            </div>

                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewSummary(session);
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200  rounded-lg transition-colors mr-3"
                                    title="View Summary"
                                >
                                    <span>Summerize</span>
                                    <FiEye className="w-4 h-4"/>
                                </button>
                                <button
                                    onClick={(e) => handleContinueChat(e, session.session_id)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                >
                                    <span>Continue Chat</span>
                                    <FiArrowRight className="w-4 h-4"/>
                                </button>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-white dark:bg-zinc-800 rounded-xl">
                        <FiMessageSquare className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600"/>
                        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                            {selectedDepartment === 'all' ? 'No chat history' : `No chats in this department`}
                        </h3>
                        <p className="mt-2 text-gray-500 dark:text-gray-400">
                            {selectedDepartment === 'all'
                                ? 'Start a new chat to see it here'
                                : 'Select a different department or start a new chat'}
                        </p>
                    </div>
                )}
            </div>

            {/* Chat Viewer Modal */}
            <AnimatePresence>
                {selectedSession && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedSession(null)}
                    >
                        <motion.div
                            initial={{scale: 0.95}}
                            animate={{scale: 1}}
                            exit={{scale: 0.95}}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
                        >
                            <div
                                className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                        {selectedSession.title ? selectedSession.title : (selectedSession.mode === 'text' ? 'Text Session' : 'Voice Session')}
                                    </h2>
                                    <div className="flex items-center space-x-3 mt-1">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(selectedSession.created_at!).toLocaleString()}
                                        </p>
                                        <div className="flex items-center text-sm text-blue-500 dark:text-blue-400">
                                            <FiTag className="w-4 h-4 mr-1"/>
                                            {departments.find((d) => d.department_id === selectedSession.department)?.name || 'Unknown'}
                                            &nbsp;|&nbsp; {selectedSession.model === 'pro' ? 'Pro Mode' : 'Fast Mode'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedSession(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[calc(70vh-8rem)] space-y-4">
                                {loadingMessages ? (
                                    <p className="text-gray-600 dark:text-gray-300">Loading messages...</p>
                                ) : (
                                    sessionMessages.map((message) => (
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
                                                    {message.timestamp.toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                                <button
                                    onClick={(e) => handleContinueChat(e, selectedSession.session_id)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                >
                                    <span>Continue Chat</span>
                                    <FiArrowRight className="w-4 h-4"/>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Summary Modal */}
            <AnimatePresence>
                {summaryModalSession && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSummaryModalSession(null)}
                    >
                        <motion.div
                            initial={{scale: 0.95}}
                            animate={{scale: 1}}
                            exit={{scale: 0.95}}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
                        >
                            <div
                                className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Conversation Summary
                                </h2>
                                <button
                                    onClick={() => setSummaryModalSession(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
                                {loadingSummary ? (
                                    <p className="text-gray-600 dark:text-gray-300">Loading summary...</p>
                                ) : (
                                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                        <ReactMarkdown>
                                            {sessionSummary}
                                        </ReactMarkdown>
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
