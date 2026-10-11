"use client";

import { useEffect, useState } from "react";
import { pickSpanishVoice } from "@/lib/speech";

export function ListenButton({ text }: { text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => {
      setVoice(pickSpanishVoice(synth.getVoices()));
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  if (!voice) return null;

  return (
    <button
      type="button"
      className="min-h-14 w-full rounded-2xl bg-white px-4 text-lg font-semibold text-[#1E5B2A] ring-2 ring-[#1E5B2A]"
      onClick={() => {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voice.lang;
        utterance.voice = voice;
        synth.speak(utterance);
      }}
    >
      ♪ Escuchar esta pantalla
    </button>
  );
}
