'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { FiPlus, FiSend, FiMic, FiMicOff } from 'react-icons/fi';

export default function DashboardPage() {
    const router = useRouter();

    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false); // Dummy state, no functionality here

    const [showDepartmentModal, setShowDepartmentModal] = useState(false);

    useEffect(() => {
        const savedMode = localStorage.getItem('mode');
        if (savedMode === 'text' || savedMode === 'voice') {
            setMode(savedMode);
        }

        const savedDepartment = localStorage.getItem('department');
        if (savedDepartment) {
            setSelectedDepartment(savedDepartment);
        }
    }, []);

    const switchMode = () => {
        const newMode = mode === 'text' ? 'voice' : 'text';
        setMode(newMode);
        localStorage.setItem('mode', newMode);
    };

    const handleSendAndGoToChat = () => {
        if (!inputMessage.trim()) return;
        console.log(inputMessage)
        const newSessionId = uuidv4();
        localStorage.setItem('mode', mode);
        if (selectedDepartment) {
            localStorage.setItem('department', selectedDepartment);
        }
        console.log(`initialMessage-${newSessionId}`)
        localStorage.setItem(`initialMessage-${newSessionId}`, inputMessage);
        router.push(`/dashboard/${newSessionId}`);
    };

    const handleConnectVoice = () => {
        const newSessionId = uuidv4();
        localStorage.setItem('mode', 'voice');
        if (selectedDepartment) {
            localStorage.setItem('department', selectedDepartment);
        }
        router.push(`/dashboard/${newSessionId}`);
    };

    const handleNewChat = () => {
        // Dummy: no functionality here, no modal at dashboard level
        // Just showing a button similar to [id] page for UI clone
        // If needed, you can open a modal here as well, but user requested to do that in [id] only.
        setShowDepartmentModal(true);
    };

    return (
        <div className="p-6">
            {/* Top Bar Clone */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-8 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Chat Session: (No session)
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Department: {selectedDepartment || 'Not selected'} | Mode: {mode}
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

            {/* Chat Area Clone (Empty) */}
            <div className="flex space-x-2">
                <div className="w-full bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6">
                    <div className="h-[calc(100vh-28rem)] overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-zinc-600">
                        {/* No messages, just empty */}
                    </div>

                    {/* Lower Control Bar Clone */}
                    <div className="flex items-center space-x-4">
                        {/* Always show text input and send button and mic for the clone UI */}
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 p-4 rounded-xl bg-gray-100 dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={handleSendAndGoToChat}
                            // disabled={!inputMessage.trim()}
                            className="p-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiSend size={20} />
                        </button>
                        <button
                            onMouseDown={() => setIsRecording(true)}
                            onMouseUp={() => setIsRecording(false)}
                            className={`p-2 rounded-full transition-colors ${
                                isRecording
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white'
                            }`}
                        >
                            {isRecording ? <FiMicOff size={20} /> : <FiMic size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Additional Controls to Start a Real Chat Session */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-2">Send a Text Message</h2>
                <p className="mb-2">Type your message above and click below to start a real chat:</p>
                <button
                    onClick={handleSendAndGoToChat}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg mr-4"
                >
                    Send & Go to Chat
                </button>

                <h2 className="text-xl font-bold mt-8 mb-2">Connect via Voice</h2>
                <p className="mb-2">Switch mode if needed and then connect:</p>
                <button
                    onClick={handleConnectVoice}
                    disabled={mode !== 'voice'}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg"
                >
                    Connect & Go to Chat
                </button>
                {mode !== 'voice' && (
                    <p className="text-red-600 mt-2">Switch to Voice mode first!</p>
                )}
            </div>

            <div className="mt-4">
                <p>Current mode: {mode}</p>
                <button
                    onClick={switchMode}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg mt-2"
                >
                    Switch to {mode === 'text' ? 'Voice' : 'Text'} Mode
                </button>
            </div>
        </div>
    );
}
