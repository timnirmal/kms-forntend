'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FiSend, FiMic, FiMicOff, FiPlus } from 'react-icons/fi';
import DepartmentModal from '../department-modal';

interface Message {
    id: string;
    content: string;
    type: 'user' | 'assistant';
    timestamp: Date;
}

export default function ChatPage() {
    const router = useRouter();
    const pathname = usePathname();
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [department, setDepartment] = useState<string | null>(null);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const sessionId = pathname.split('/').pop() || '';

    useEffect(() => {
        const savedMode = localStorage.getItem('mode');
        if (savedMode === 'text' || savedMode === 'voice') {
            setMode(savedMode);
        }

        const savedDepartment = localStorage.getItem('department');
        if (savedDepartment) {
            setDepartment(savedDepartment);
        }

        // Check if there's an initial message stored
        const initialMessage = localStorage.getItem(`initialMessage-${sessionId}`);
        if (initialMessage) {
            const userMessage: Message = {
                id: Date.now().toString(),
                content: initialMessage,
                type: 'user',
                timestamp: new Date(),
            };
            setMessages([userMessage]);
            localStorage.removeItem(`initialMessage-${sessionId}`);

            handleAssistantResponse([userMessage]);
        } else {
            // If no initial message, load from DB or start empty
            // Example: Fetch from your database if needed
            // setMessages([]) // starting empty for now
        }
    }, [sessionId]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleAssistantResponse = async (updatedMessages: Message[]) => {
        setIsProcessing(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages }),
            });
            if (!response.ok) {
                throw new Error('Error fetching assistant response');
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
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: "I apologize, but I'm having trouble responding right now. Please try again.",
                type: 'assistant',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsProcessing(false);
            // Save final messages to DB if needed
        }
    };

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;
        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputMessage,
            type: 'user',
            timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInputMessage('');
        handleAssistantResponse(updatedMessages);
    };

    const handleNewChat = () => {
        // Show department selection modal
        setShowDepartmentModal(true);
    };

    const handleDepartmentSelected = (dept: string) => {
        localStorage.setItem('department', dept);
        setDepartment(dept);
        setShowDepartmentModal(false);
        // Redirect back to dashboard
        router.push('/dashboard');
    };

    const startRecording = () => {
        if (mode === 'voice') {
            setIsRecording(true);
            // Add logic to record audio and send to API once done
        }
    };

    const stopRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            // Process recorded audio and get assistant response
        }
    };

    return (
        <div className="p-6">
            {showDepartmentModal && (
                <DepartmentModal
                    onClose={() => setShowDepartmentModal(false)}
                    onSelect={handleDepartmentSelected}
                />
            )}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-8 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Chat Session: {sessionId}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Department: {department || 'Not selected'} | Mode: {mode}
                        </p>
                    </div>
                    <button
                        onClick={handleNewChat}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                        <FiPlus className="w-5 h-5" />
                        <span>New Chat</span>
                    </button>
                </div>
            </div>

            <div className="flex space-x-2">
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
                                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white'
                                    }`}
                                >
                                    <p>{message.content}</p>
                                    <p className="text-xs mt-1 opacity-70">
                                        {message.timestamp.toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-zinc-700 rounded-lg p-4">
                                    <div className="flex space-x-2">
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                        <div
                                            className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                                            style={{ animationDelay: '150ms' }}
                                        ></div>
                                        <div
                                            className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                                            style={{ animationDelay: '300ms' }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lower Control Bar */}
                    <div className="flex items-center space-x-4">
                        {mode === 'voice' ? (
                            // Voice Mode: show mic, hide text input and send button
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
                        ) : (
                            // Text Mode: show input and send button
                            <>
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
