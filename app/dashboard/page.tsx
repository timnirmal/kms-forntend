'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiSend, FiMic, FiMicOff } from 'react-icons/fi';
import { createClient } from "@/utils/supabase/client";
import {motion} from "framer-motion";
// import { useSession } from 'next-auth/react';

interface Department {
    department_id: string;
    name: string;
}

interface CombinedUserData {
    id: string;
    email: string | null;
    username: string | null;
    avatar_url: string | null;
}

export default function DashboardPage() {
    const router = useRouter();
    const supabase = createClient();

    const [combinedUserData, setCombinedUserData] = useState<CombinedUserData | null>(null);

    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false); // Dummy state, no functionality here yet

    const [showDepartmentModal, setShowDepartmentModal] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            // setIsLoading(true);
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();

                if (userError || !user) {
                    router.push("/sign-in");
                    return;
                }

                const { data: userProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                // if (profileError) {
                //     // setError('Failed to load profile data.');
                //     return;
                // }

                const combinedData: CombinedUserData = {
                    id: user.id,
                    email: userProfile.email,
                    username: userProfile.username,
                    avatar_url: userProfile.avatar_url,
                };

                setCombinedUserData(combinedData);
            } catch (err) {
                console.error('Error fetching user data:', err);
            }
            // finally {
            //     setIsLoading(false);
            // }
        };

        fetchUserData();
    }, [supabase, router]);

    useEffect(() => {
        // Fetch departments from Supabase
        const fetchDepartments = async () => {
            const { data, error } = await supabase
                .from('department')
                .select('*');

            if (error) {
                console.error('Error fetching departments:', error);
            } else if (data && data.length > 0) {
                setDepartments(data);
                // If we have none selected, pick the first by default
                if (!selectedDepartment) {
                    setSelectedDepartment(data[0].department_id);
                }
            }
        };

        fetchDepartments();
    }, [supabase]);

    const handleModeSwitchOnSend = () => {
        // If user typed a message and is sending it, we consider that text mode
        setMode('text');
    };

    const handleModeSwitchOnMic = () => {
        // If user clicked mic, switch to voice mode
        setMode('voice');
    };

    const handleSendAndGoToChat = async () => {
        if (!inputMessage.trim() || !selectedDepartment || !combinedUserData) return;

        handleModeSwitchOnSend();  // ensure mode is 'text'

        // Create a session in supabase
        const { data: sessionData, error: sessionError } = await supabase
            .from('session')
            .insert([
                {
                    user: combinedUserData.id,
                    mode: 'text',
                    department: selectedDepartment
                }
            ])
            .select(); // to get the newly created session_id

        if (sessionError || !sessionData || sessionData.length === 0) {
            console.error('Error creating session:', sessionError);
            return;
        }

        const newSession = sessionData[0];
        const newSessionId = newSession.session_id;

        // Insert the initial message into chat table
        const { error: chatError } = await supabase
            .from('chat')
            .insert([
                {
                    session_id: newSessionId,
                    user: combinedUserData.id,
                    role: 'user',
                    message: inputMessage,
                    mode: 'text'
                }
            ]);

        if (chatError) {
            console.error('Error inserting chat message:', chatError);
            return;
        }

        // Insert the initial message into chat table
        const { error: colabError } = await supabase
            .from('colab')
            .insert([
                {
                    session_id: newSessionId,
                    user_id: combinedUserData.id,
                    level: "write"
                }
            ]);

        if (colabError) {
            console.error('Error inserting colab message:', colabError);
            return;
        }

        // Redirect to /dashboard/[session_id]
        router.push(`/dashboard/${newSessionId}`);
    };

    const handleConnectVoice = async () => {
        if (!selectedDepartment || !combinedUserData) return;

        handleModeSwitchOnMic(); // ensure mode is 'voice'

        // Create a session in supabase for voice mode
        const { data: sessionData, error: sessionError } = await supabase
            .from('session')
            .insert([
                {
                    user: combinedUserData.id,
                    mode: 'voice',
                    department: selectedDepartment
                }
            ])
            .select();

        if (sessionError || !sessionData || sessionData.length === 0) {
            console.error('Error creating voice session:', sessionError);
            return;
        }

        const newSession = sessionData[0];
        const newSessionId = newSession.session_id;

        // For voice mode initial connection, we might not have a text message yet
        // If you want to send an initial user message, do it here.
        // Otherwise just redirect:
        router.push(`/dashboard/${newSessionId}`);
    };

    const handleNewChat = () => {
        // If you want to open a department modal or something else, you can do so here
        // Currently set to open a modal. If you don't need a modal anymore, remove this.
        setShowDepartmentModal(true);
    };

    return (
        <div className="p-6">
            {/* Top Bar */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-8 mb-6">
                <div className="flex justify-between items-center">
                    {/* Welcome Banner */}
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                    >
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                    Welcome back {combinedUserData?.username}! 👋
                                </h1>
                                <p className="text-gray-600 dark:text-gray-300">
                                    How can I assist you today?
                                </p>
                            </div>
                    </motion.div>
                    {/*<div>*/}
                    {/*    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">*/}
                    {/*        Chat Session: (No session)*/}
                    {/*    </h1>*/}
                    {/*    <p className="text-gray-600 dark:text-gray-300">*/}
                    {/*        Department: {*/}
                    {/*        selectedDepartment*/}
                    {/*            ? departments.find(d => d.department_id === selectedDepartment)?.name*/}
                    {/*            : 'Not selected'*/}
                    {/*    } | Mode: {mode}*/}
                    {/*    </p>*/}
                    {/*</div>*/}
                    <div className="flex items-center space-x-4">
                        {/* Department selection dropdown */}
                        <select
                            value={selectedDepartment || ''}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="p-2 bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-lg"
                        >
                            {departments.map((dept) => (
                                <option key={dept.department_id} value={dept.department_id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>

                        {/*<button*/}
                        {/*    onClick={handleNewChat}*/}
                        {/*    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"*/}
                        {/*>*/}
                        {/*    <FiPlus className="w-5 h-5" />*/}
                        {/*    <span>New Chat</span>*/}
                        {/*</button>*/}
                    </div>
                </div>
            </div>

            {/* Chat Area (Empty clone) */}
            <div className="flex space-x-2">
                <div className="w-full bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6">
                    <div className="h-[calc(100vh-28rem)] overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-zinc-600">
                        {/* No messages here since it's a placeholder */}
                    </div>

                    {/* Lower Control Bar */}
                    <div className="flex items-center space-x-4">
                        <button
                            // onMouseDown={() => {
                            //     setIsRecording(true);
                            //     handleModeSwitchOnMic();
                            // }}
                            // onMouseUp={() => setIsRecording(false)}
                            onClick={handleConnectVoice}
                            className={`p-2 rounded-full transition-colors ${
                                isRecording
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white'
                            }`}
                        >
                            {isRecording ? <FiMicOff size={20}/> : <FiMic size={20}/>}
                        </button>
                        {/* Text input */}
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 p-4 rounded-xl bg-gray-100 dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={handleSendAndGoToChat}
                            className="p-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiSend size={20}/>
                        </button>
                    </div>
                </div>
            </div>

            {/*/!* Additional Controls *!/*/}
            {/*<div className="mt-8">*/}
            {/*    /!*<h2 className="text-xl font-bold mb-2">Send a Text Message</h2>*!/*/}
            {/*    /!*<p className="mb-2">Type your message above and click below to start a real chat:</p>*!/*/}
            {/*    /!*<button*!/*/}
            {/*    /!*    onClick={handleSendAndGoToChat}*!/*/}
            {/*    /!*    className="px-4 py-2 bg-green-500 text-white rounded-lg mr-4"*!/*/}
            {/*    /!*>*!/*/}
            {/*    /!*    Send & Go to Chat*!/*/}
            {/*    /!*</button>*!/*/}

            {/*    /!*<h2 className="text-xl font-bold mt-8 mb-2">Connect via Voice</h2>*!/*/}
            {/*    /!*<p className="mb-2">Click the mic button above to enter voice mode. Then connect:</p>*!/*/}
            {/*    /!*<button*!/*/}
            {/*    /!*    onClick={handleConnectVoice}*!/*/}
            {/*    /!*    disabled={mode !== 'voice'}*!/*/}
            {/*    /!*    className="px-4 py-2 bg-purple-500 text-white rounded-lg"*!/*/}
            {/*    /!*>*!/*/}
            {/*    /!*    Connect & Go to Chat*!/*/}
            {/*    /!*</button>*!/*/}
            {/*    /!*{mode !== 'voice' && (*!/*/}
            {/*    /!*    <p className="text-red-600 mt-2">Click mic button to switch to Voice mode first!</p>*!/*/}
            {/*    /!*)}*!/*/}
            {/*</div>*/}

            {/*<div className="mt-4">*/}
            {/*    <p>Current mode: {mode}</p>*/}
            {/*</div>*/}
        </div>
    );
}
