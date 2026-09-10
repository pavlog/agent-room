import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Called once with the final recognized transcript when the user stops or
   *  the recognizer ends. Caller decides how to merge into the input field. */
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

export function VoiceButton({ onTranscript, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  useEffect(() => {
    if (disabled) {
      setListening(false);
      setInterim('');
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
    recognition.lang = navigator.language || 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalText = '';

    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);
    };

    recognition.onerror = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      // 'no-speech' / 'aborted' are normal user paths (silent click, manual stop) — silent.
      if (event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
        import('./Toast.js').then(({ showToast }) => {
          showToast(`Voice error: ${event.error}`);
        });
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      const text = finalText.trim();
      if (text) transcriptRef.current(text);
      setInterim('');
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch {
      // Some browsers throw if start() is called twice in quick succession.
      recognitionRef.current = null;
      setListening(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={listening ? stop : start}
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        title={listening ? 'Stop voice input' : 'Start voice input'}
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
      {listening && interim && (
        <div className="absolute left-3 right-3 -top-7 px-3 py-1 bg-accent-tint text-accent-deep text-[11px] italic rounded-full shadow-sm truncate pointer-events-none">
          {interim}
        </div>
      )}
    </>
  );
}
