import { Dispatch, SetStateAction } from 'react';

interface LogsViewProps {
    showLogs: boolean;
    setShowLogs: Dispatch<SetStateAction<boolean>>;
    realtimeEvents: any[];
    expandedEvents: { [key: string]: boolean };
    setExpandedEvents: Dispatch<SetStateAction<{ [key: string]: boolean }>>;
    formatTime: (timestamp: string) => string;
    clientCanvasRef: React.RefObject<HTMLCanvasElement>;
    serverCanvasRef: React.RefObject<HTMLCanvasElement>;
    eventsScrollRef: React.RefObject<HTMLDivElement>;
}

export default function LogsView({
                                     showLogs,
                                     setShowLogs,
                                     realtimeEvents,
                                     expandedEvents,
                                     setExpandedEvents,
                                     formatTime,
                                     clientCanvasRef,
                                     serverCanvasRef,
                                     eventsScrollRef
                                 }: LogsViewProps) {
    if (!showLogs) {
        return null;
    }

    let lastInputAudioBufferTime: Date | null = null;
    let lastFunctionCallTime: Date | null = null;

    const filteredEvents = realtimeEvents
        .filter((realtimeEvent) => {
            const source = realtimeEvent.source;
            const eventType = realtimeEvent.event.type;
            const output = realtimeEvent.event.response?.output;
            return (
                (source === 'client' && eventType === 'input_audio_buffer.commit') ||
                (source === 'server' && eventType === 'response.content_part.added') ||
                (source === 'server' &&
                    eventType === 'response.done' &&
                    output?.some((item: { type: string }) => item.type === 'function_call'))
            );
        })
        .map((realtimeEvent) => {
            const count = realtimeEvent.count;
            const event = { ...realtimeEvent.event };
            const eventType = event.type;
            const eventTime = new Date(realtimeEvent.time);

            let functioncallTimeDifference = null;
            let audioTimeDifference = null;
            let totaltimeDifference = null;

            if (eventType === 'input_audio_buffer.commit') {
                lastInputAudioBufferTime = eventTime;
            } else if (eventType === 'response.done' && lastInputAudioBufferTime) {
                functioncallTimeDifference =
                    (eventTime.getTime() - lastInputAudioBufferTime.getTime()) / 1000;
                lastFunctionCallTime = eventTime;
            } else if (
                eventType === 'response.content_part.added' &&
                lastFunctionCallTime &&
                lastInputAudioBufferTime
            ) {
                audioTimeDifference =
                    (eventTime.getTime() - lastFunctionCallTime.getTime()) / 1000;
                totaltimeDifference =
                    (eventTime.getTime() - lastInputAudioBufferTime.getTime()) / 1000;
            }

            return { realtimeEvent, count, event, functioncallTimeDifference, audioTimeDifference, totaltimeDifference };
        });

    return (
        <div className="w-full md:w-1/3 flex flex-col border border-gray-300 dark:border-gray-600 rounded-lg">
            <div className="font-bold p-2 border-b border-gray-300 dark:border-gray-600 flex justify-between items-center">
                <span>Events Log</span>
                <button
                    onClick={() => setShowLogs(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    Hide
                </button>
            </div>
            <div className="flex items-center justify-between p-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Client (blue) / Server (green)</div>
            </div>
            <div className="p-2 flex gap-2">
                <div className="flex-1 bg-gray-50 dark:bg-zinc-800" style={{ height: '50px' }}>
                    <canvas ref={clientCanvasRef} className="w-full h-full" />
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-zinc-800" style={{ height: '50px' }}>
                    <canvas ref={serverCanvasRef} className="w-full h-full" />
                </div>
            </div>
            <div
                className="flex-1 overflow-y-auto text-sm p-2 bg-gray-50 dark:bg-zinc-900"
                ref={eventsScrollRef}
            >
                {!realtimeEvents.length && `Awaiting Connection...`}
                {filteredEvents.map(({ realtimeEvent, count, event, functioncallTimeDifference, audioTimeDifference, totaltimeDifference }) => (
                    <div className="mb-4" key={event.event_id}>
                        <div className="font-bold text-gray-800 dark:text-gray-200">
                            {formatTime(realtimeEvent.time)}
                        </div>
                        <div
                            onClick={() => {
                                const id = event.event_id;
                                const expanded = { ...expandedEvents };
                                if (expanded[id]) {
                                    delete expanded[id];
                                } else {
                                    expanded[id] = true;
                                }
                                setExpandedEvents(expanded);
                            }}
                            className="cursor-pointer text-gray-700 dark:text-gray-300"
                        >
              <span className={`mr-2 ${realtimeEvent.source === 'client' ? 'text-blue-600' : 'text-green-600'}`}>
                {realtimeEvent.source}
              </span>
                            <span>{event.type}{count && ` (${count})`}</span>
                        </div>
                        {!!expandedEvents[event.event_id] && (
                            <pre className="text-xs bg-gray-200 dark:bg-zinc-700 p-1 rounded whitespace-pre-wrap">
                {JSON.stringify(event, null, 2)}
              </pre>
                        )}
                        {functioncallTimeDifference !== null && (
                            <div className="text-xs italic">
                                Total time from input to RAG = {functioncallTimeDifference}s
                            </div>
                        )}
                        {audioTimeDifference !== null && (
                            <div className="text-xs italic">
                                Total time from RAG to response = {audioTimeDifference}s
                            </div>
                        )}
                        {totaltimeDifference !== null && (
                            <div className="text-xs italic">
                                Total time from input to response = {totaltimeDifference}s
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
