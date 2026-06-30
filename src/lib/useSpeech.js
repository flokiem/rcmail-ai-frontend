import { useRef, useState, useCallback, useEffect } from 'react';

// Browser-native Web Speech API dictation. Returns whether it's supported,
// listening state, and toggle. Recognised speech is appended via onResult.
const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export function useSpeech(onResult) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  const toggle = useCallback(() => {
    if (!SR) return;
    if (listening) { stop(); return; }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim();
      if (text) onResult?.(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [listening, onResult, stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported: !!SR, listening, toggle };
}
