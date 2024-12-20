'use client';

import {useState} from "react";
import {createClient} from "@/utils/supabase/client";
import {FiCopy, FiMessageSquare, FiThumbsDown, FiThumbsUp, FiVolume2, FiX} from "react-icons/fi";
import {motion} from 'framer-motion';

export default function MessageToolbar({message, sessionId, userId}) {
    const supabase = createClient();

    const [isPlayingTTS, setIsPlayingTTS] = useState(false);
    const [feedback, setFeedback] = useState(null); // {like: true/false/null}
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [commentText, setCommentText] = useState('');

    const handleTTS = () => {
        if (isPlayingTTS) {
            window.speechSynthesis.cancel();
            setIsPlayingTTS(false);
        } else {
            const utterance = new SpeechSynthesisUtterance(message.content);
            utterance.onend = () => setIsPlayingTTS(false);
            setIsPlayingTTS(true);
            window.speechSynthesis.speak(utterance);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(message.content);
        // alert("Message copied!");
    };

    const handleLike = async (val) => {
        // val: true (like), false (dislike), null (remove)
        setFeedback(val);
        await saveFeedback(val);
    };

    const saveFeedback = async (val) => {
        // Insert or update feedback in feedback table
        const { error } = await supabase
            .from('feedback')
            .insert([{
                user_id: userId,
                session_id: sessionId,
                chat_id: message.id,
                like: val,
                message: null
            }], {upsert: true});
        if (error) console.error('Error saving feedback:', error);
    };

    const handleCommentSubmit = async () => {
        const { error } = await supabase
            .from('feedback')
            .insert([{
                user_id: userId,
                session_id: sessionId,
                chat_id: message.id,
                like: null,
                message: commentText
            }]);
        if (error) {
            console.error('Error submitting comment:', error);
        } else {
            setCommentText('');
            setShowCommentModal(false);
        }
    };

    return (
        <div className="flex items-center space-x-2 mt-1">
            {/* TTS Button */}
            <button
                onClick={handleTTS}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={isPlayingTTS ? "Stop Reading" : "Read Aloud"}
            >
                {isPlayingTTS ? <FiX/> : <FiVolume2/>}
            </button>

            {/* Copy Button */}
            <button
                onClick={handleCopy}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Copy Text"
            >
                <FiCopy/>
            </button>

            {/* Like/Dislike Buttons */}
            <button
                onClick={() => handleLike(feedback === true ? null : true)}
                className={`p-1 ${feedback === true ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                title="Like"
            >
                <FiThumbsUp/>
            </button>
            <button
                onClick={() => handleLike(feedback === false ? null : false)}
                className={`p-1 ${feedback === false ? 'text-red-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                title="Dislike"
            >
                <FiThumbsDown/>
            </button>

            {/* Comment Button */}
            <button
                onClick={() => setShowCommentModal(true)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Add Comment"
            >
                <FiMessageSquare/>
            </button>

            {/* Comment Modal */}
            {showCommentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{opacity: 0, scale: 0.95}}
                        animate={{opacity: 1, scale: 1}}
                        className="bg-white dark:bg-zinc-800 rounded-xl p-4 max-w-md w-full shadow-xl"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Add a Comment
                            </h3>
                            <button
                                onClick={() => setShowCommentModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <FiX className="w-5 h-5"/>
                            </button>
                        </div>
                        <textarea
                            className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                            rows={5}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Your comment..."
                        />
                        <div className="flex justify-end space-x-2 mt-4">
                            <button
                                onClick={() => setShowCommentModal(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                            >Cancel</button>
                            <button
                                onClick={handleCommentSubmit}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >Send</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
