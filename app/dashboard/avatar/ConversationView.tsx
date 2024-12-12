import { Mic, MicOff, X } from 'react-feather';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';

interface ConversationViewProps {
    items: ItemType[];
    mode: 'text' | 'voice';
    chatMethod: 'vad' | 'push_to_talk';
    isConnected: boolean;
    isRecording: boolean;
    canPushToTalk: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    changeTurnEndType: (value: string) => void;
    deleteConversationItem: (id: string) => void;
    textInput: string;
    setTextInput: (val: string) => void;
    sendTextMessage: () => void;
}

export default function ConversationView({
                                             items,
                                             mode,
                                             chatMethod,
                                             isConnected,
                                             isRecording,
                                             canPushToTalk,
                                             startRecording,
                                             stopRecording,
                                             changeTurnEndType,
                                             deleteConversationItem,
                                             textInput,
                                             setTextInput,
                                             sendTextMessage
                                         }: ConversationViewProps) {
    const isTextMode = mode === 'text';
    const isVoiceMode = mode === 'voice';

    return (
        <div className="flex-1 flex flex-col border border-gray-300 dark:border-gray-600 rounded-lg">
            <div
                className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-zinc-900"
                data-conversation-content
            >
                {!items.length && (
                    <div className="text-center text-gray-500 dark:text-gray-400">No messages yet...</div>
                )}
                {items.map((conversationItem) => {
                    const role = conversationItem.role || (conversationItem.type === 'function_call_output' ? 'function' : 'system');
                    const isUser = role === 'user';
                    const isAssistant = role === 'assistant';

                    return (
                        <div
                            key={conversationItem.id}
                            className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`relative max-w-sm p-3 rounded-xl ${
                                    isUser
                                        ? 'bg-blue-600 text-white'
                                        : isAssistant
                                            ? 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200'
                                            : 'bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200'
                                }`}
                            >
                                {conversationItem.type !== 'function_call_output' && (
                                    <>
                                        {conversationItem.formatted.tool && (
                                            <div className="italic text-sm text-gray-500 dark:text-gray-400 mb-1">
                                                Query: {(() => {
                                                try {
                                                    const args =
                                                        typeof conversationItem.formatted.tool.arguments === 'string'
                                                            ? JSON.parse(conversationItem.formatted.tool.arguments)
                                                            : conversationItem.formatted.tool.arguments;
                                                    return args.query || '(No query available)';
                                                } catch (error) {
                                                    console.error('Error parsing arguments:', error);
                                                    return '(Invalid arguments format)';
                                                }
                                            })()}
                                            </div>
                                        )}
                                        {!conversationItem.formatted.tool && role === 'user' && (
                                            <div className="whitespace-pre-wrap">
                                                {conversationItem.formatted.transcript ||
                                                    (conversationItem.formatted.audio?.length
                                                        ? '(awaiting transcript)'
                                                        : conversationItem.formatted.text ||
                                                        '(item sent)')}
                                            </div>
                                        )}
                                        {!conversationItem.formatted.tool && role === 'assistant' && (
                                            <div className="whitespace-pre-wrap">
                                                {conversationItem.formatted.transcript ||
                                                    conversationItem.formatted.text ||
                                                    '(truncated)'}
                                            </div>
                                        )}
                                        {conversationItem.formatted.file && (
                                            <audio
                                                src={conversationItem.formatted.file.url}
                                                controls
                                                className="mt-2"
                                            />
                                        )}
                                    </>
                                )}
                                <button
                                    onClick={() => deleteConversationItem(conversationItem.id)}
                                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {isTextMode && (
                <div className="flex items-center p-2 border-t border-gray-300 dark:border-gray-600">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
                        placeholder="Type your message..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                    />
                    <button
                        className="ml-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={sendTextMessage}
                    >
                        Send
                    </button>
                </div>
            )}
            {isVoiceMode && (
                <div className="flex items-center p-2 border-t border-gray-300 dark:border-gray-600">
                    {chatMethod === 'push_to_talk' && (
                        <button
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            className={`px-4 py-2 rounded-lg text-white ${isRecording ? 'bg-red-600' : 'bg-blue-600'} hover:bg-blue-700 flex items-center gap-2`}
                        >
                            {isRecording ? <MicOff /> : <Mic />}
                            {isRecording ? 'Release to Send' : isConnected ? 'Push to Talk' : 'Click to Connect & Talk'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
