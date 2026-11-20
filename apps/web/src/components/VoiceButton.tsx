import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Called with each newly confirmed phrase during recognition. Caller decides how to merge into the input field. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Browser SpeechRecognition is non-standard: typed as `any` to avoid pulling
// in a dom-speech-recognition lib for a single component. Returns null when
// the browser doesn't support it (Firefox, older Safari) — caller renders
// nothing in that case.
const SpeechRecognitionImpl: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

const LANGUAGE_KEY = 'agent-room.voice-language';

function initialLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) || navigator.language || 'en-US';
  } catch {
    return navigator.language || 'en-US';
  }
}

export function VoiceButton({ onTranscript, disabled }: Props) {
  const [language, setLanguage] = useState(initialLanguage);
  const languages = [...new Set([...(navigator.languages || []), navigator.language, language].filter(Boolean))];
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [status, setStatus] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  useEffect(() => {
    if (disabled) {
      setListening(false);
      setInterim('');
      setStatus('');
    }
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        // Cancellation must never deliver text into a room that has been left.
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      }
    };
  }, [disabled]);

  // Hidden entirely when unsupported — no UI noise, no console error.
  if (!SpeechRecognitionImpl) return null;

  function start() {
    if (disabled || recognitionRef.current) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;

    let receivedText = false;
    let failed = false;
    let nextResult = 0;
    recognition.onstart = () => {
      if (recognitionRef.current === recognition) setStatus('Listening…');
    };
    recognition.onspeechstart = () => {
      if (recognitionRef.current === recognition) setStatus('Speech detected. Recognizing…');
    };

    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      let interimText = '';
      let finalText = '';
      for (let i = nextResult; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
          nextResult = i + 1;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (finalText.trim()) {
        receivedText = true;
        transcriptRef.current(finalText.trim());
      }
      setInterim(interimText);
    };

    recognition.onerror = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      failed = true;
      const messages: Record<string, string> = {
        'no-speech': 'No speech detected. Check your microphone and selected language.',
        'audio-capture': 'Microphone unavailable. Check the browser microphone device.',
        'not-allowed': 'Microphone or speech recognition permission denied. Check site permissions.',
        'service-not-allowed': 'The browser speech recognition service is unavailable or blocked.',
        'network': 'Speech recognition connection failed. Check your network and try again.',
        'language-not-supported': 'This browser cannot recognize the selected language.',
        'aborted': 'Voice input cancelled.',
      };
      setStatus(messages[event.error] || 'Speech recognition failed. Please try again.');
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      if (!failed) setStatus(receivedText ? '' : 'No text recognized. Check your microphone and selected language, then try again.');
      setInterim('');
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognitionRef.current = recognition;
      setListening(true);
      setStatus('Starting microphone…');
      recognition.start();
    } catch {
      setStatus('Could not start speech recognition. Please try again.');
      recognitionRef.current = null;
      setListening(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <select
        aria-label="Voice input language"
        title="Choose the language you will dictate in. Your choice is saved in this browser."
        value={language}
        disabled={disabled || listening}
        onChange={event => {
          const value = event.target.value;
          setLanguage(value);
          try {
            localStorage.setItem(LANGUAGE_KEY, value);
          } catch {
            // Keep the selection for this session when browser storage is unavailable.
          }
        }}
        className="h-10 sm:h-9 max-w-28 rounded-lg border border-border bg-surface-softer px-2 text-xs text-ink-soft disabled:opacity-50"
      >
        {languages.map(code => <option key={code} value={code}>{code}</option>)}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={listening ? stop : start}
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        title={listening
          ? 'Stop listening. What was recognised so far stays in the message box.'
          : 'Dictate with your browser\'s speech recognition. The words are added to the message box for you to review — nothing is sent automatically.'}
        className={`leading-none w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition ${
          listening
            ? 'bg-red-100 text-red-600 animate-pulse'
            : 'bg-surface-softer text-ink-soft hover:bg-accent-tint hover:text-accent'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="6" y="2" width="4" height="7" rx="2" />
          <path d="M4 7.5a4 4 0 0 0 8 0M8 11.5V14" />
        </svg>
      </button>
      {(interim || status) && (
        <div role="status" className="absolute bottom-full left-0 mb-2 w-64 max-w-[75vw] px-3 py-2 bg-accent-tint text-accent-deep text-xs rounded-lg shadow-sm pointer-events-none">
          {interim || status}
        </div>
      )}
    </div>
  );
}
