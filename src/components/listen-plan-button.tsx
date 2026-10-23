"use client";

import { useEffect, useState } from "react";
import { pickEsVoice } from "@/lib/speech";
import { LISTEN_FAILED } from "@/lib/tts";

const buttonClass =
  "inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-white px-4 text-lg font-semibold text-[#1E5B2A] ring-2 ring-[#1E5B2A]";

/**
 * Speaks the written plan with the browser's Spanish voice.
 * It does not call /api/tts, so it adds no key and no vendor cost.
 */
export function ListenPlanButton({ text }: { text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => setVoice(pickEsVoice(synth.getVoices()));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, []);

  function toggle() {
    const synth = window.speechSynthesis;
    if (!synth || !voice) {
      setFailed(true);
      return;
    }
    if (playing) {
      synth.cancel();
      setPlaying(false);
      return;
    }
    setFailed(false);
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => {
      setPlaying(false);
      setFailed(true);
    };
    synth.speak(utterance);
    setPlaying(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={buttonClass} onClick={toggle}>
        {playing ? "Pausar" : "Escuchar plan"}
      </button>
      <p className="text-[14px] text-[#57534E]">Voz generada por IA</p>
      {failed ? <p>{LISTEN_FAILED}</p> : null}
    </div>
  );
}
