import { useEffect, useState, useRef } from "react";

export const blobToBase64 = (blob, callback) => {
    const reader = new FileReader();
    reader.onload = function () {
        const base64data = reader.result.split(",")[1];
        callback(base64data);
    };
    reader.readAsDataURL(blob);
};

export const useRecordVoice = () => {
    const [textByHook, setTextByHook] = useState("");
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recording, setRecording] = useState(false);
    const isRecording = useRef(false);
    const chunks = useRef([]);

    const startTextRecording = () => {
        if (mediaRecorder) {
            isRecording.current = true;
            mediaRecorder.start();
            setRecording(true);
        }
    };

    const stopTextRecording = () => {
        if (mediaRecorder) {
            isRecording.current = false;
            mediaRecorder.stop();
            setRecording(false);
        }
    };

    const getText = async (base64data) => {
        try {
            const response = await fetch("/api/transcribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    audio: base64data,
                }),
            }).then((res) => res.json());

            console.log(response)

            const { text } = response;
            setTextByHook(text);
        } catch (error) {
            console.error("Transcription error:", error);
        }
    };

    const initialMediaRecorder = (stream) => {
        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.onstart = () => {
            chunks.current = [];
        };

        mediaRecorder.ondataavailable = (event) => {
            chunks.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks.current, { type: "audio/wav" });
            blobToBase64(audioBlob, getText);
        };

        setMediaRecorder(mediaRecorder);
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then(initialMediaRecorder);
        }
    }, []);

    return { recording, startTextRecording, stopTextRecording, textByHook };
};
