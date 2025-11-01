
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { connectToLiveSession } from '../services/geminiService';
import type { LiveSession, LiveServerMessage } from '@google/genai';
import { Blob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import type { TranscriptionTurn } from '../types';
import { MicIcon, StopIcon } from './icons';

type ConversationStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

// FIX: Added createBlob helper function as recommended by the Gemini API guidelines for efficient audio processing.
function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

const LiveConversation: React.FC = () => {
    const [status, setStatus] = useState<ConversationStatus>('idle');
    const [transcription, setTranscription] = useState<TranscriptionTurn[]>([]);
    
    const sessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const stopConversation = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        
        setStatus('idle');
    }, []);
    
    useEffect(() => {
        return () => {
            stopConversation();
        };
    }, [stopConversation]);

    const startConversation = async () => {
        setStatus('connecting');
        setTranscription([]);
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;

            const sessionPromise = connectToLiveSession({
                onOpen: () => {
                    setStatus('listening');
                    mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        // FIX: Used the createBlob helper for efficient audio encoding.
                        const pcmBlob: Blob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                },
                onMessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.outputTranscription) {
                        currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                    }
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                    }

                    if (message.serverContent?.turnComplete) {
                        const fullInput = currentInputTranscriptionRef.current.trim();
                        const fullOutput = currentOutputTranscriptionRef.current.trim();
                        
                        setTranscription(prev => [
                          ...prev,
                          ...(fullInput ? [{ speaker: 'user' as const, text: fullInput }] : []),
                          ...(fullOutput ? [{ speaker: 'model' as const, text: fullOutput }] : []),
                        ]);
                        
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';
                    }

                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData) {
                        setStatus('speaking');
                        const outputContext = outputAudioContextRef.current!;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputContext.currentTime);
                        
                        const audioBuffer = await decodeAudioData(decode(audioData), outputContext, 24000, 1);
                        const source = outputContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputContext.destination);
                        
                        source.addEventListener('ended', () => {
                            sourcesRef.current.delete(source);
                            if (sourcesRef.current.size === 0) {
                                setStatus('listening');
                            }
                        });

                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }
                    
                    if (message.serverContent?.interrupted) {
                        sourcesRef.current.forEach(source => source.stop());
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onError: (e) => {
                    console.error('Session error:', e);
                    setStatus('error');
                    stopConversation();
                },
                onClose: () => {
                    stopConversation();
                },
            });
            sessionRef.current = await sessionPromise;

        } catch (error) {
            console.error('Failed to start conversation:', error);
            setStatus('error');
        }
    };
    
    const handleToggleConversation = () => {
        if (status === 'idle' || status === 'error') {
            startConversation();
        } else {
            stopConversation();
        }
    };

    const statusText: Record<ConversationStatus, string> = {
        idle: 'Click the mic to start chatting',
        connecting: 'Connecting to Gemini...',
        listening: 'Listening... feel free to speak',
        speaking: 'Gemini is speaking...',
        error: 'An error occurred. Please try again.',
    };

    return (
        <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-full max-w-2xl h-80 bg-gray-800/50 rounded-lg p-4 overflow-y-auto border border-gray-700">
                {transcription.length === 0 && (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Conversation will appear here...
                    </div>
                )}
                <div className="space-y-4">
                    {transcription.map((turn, index) => (
                        <div key={index} className={`flex ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-xl ${
                                turn.speaker === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'
                            }`}>
                                <p className="text-sm">{turn.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="text-center">
                 <button 
                    onClick={handleToggleConversation} 
                    className={`rounded-full p-6 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-900 
                    ${status === 'listening' || status === 'speaking' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'} 
                    ${status === 'connecting' ? 'animate-pulse' : ''}`}
                    disabled={status === 'connecting'}
                >
                    {status === 'listening' || status === 'speaking' ? <StopIcon className="w-10 h-10 text-white"/> : <MicIcon className="w-10 h-10 text-white"/>}
                </button>
                <p className={`mt-4 text-lg font-medium transition-colors ${status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
                    {statusText[status]}
                </p>
            </div>
        </div>
    );
};

export default LiveConversation;