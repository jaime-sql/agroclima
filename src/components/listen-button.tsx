"use client";

import { useEffect, useState } from "react";
import { pickSpanishVoice } from "@/lib/speech";
import { LISTEN_FAILED, listenFallback } from "@/lib/tts";

const defaultClass =
  "min-h-14 w-full rounded-2xl bg-white px-4 text-lg font-semibold text-[#1E5B2A] ring-2 ring-[#1E5B2A] disabled:opacity-70";

export function ListenButton({
  text,
  label = "♪ Escuchar esta pantalla",
  className = defaultClass,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function listen() {
    setNote(null);
    setBusy(true);
    let serverAudio = false;
    try {
      serverAudio = await playServerAudio(text);
    } catch {
      serverAudio = false;
    }
    const choice = listenFallback({ serverAudio, hasSpanishVoice: voice !== null });
    if (choice === "browser" && voice) {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice.lang;
      utterance.voice = voice;
      synth.speak(utterance);
    } else if (choice === "failed") {
      setNote(LISTEN_FAILED);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={className} disabled={busy} onClick={() => void listen()}>
        {label}
      </button>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

async function playServerAudio(text: string): Promise<boolean> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("audio/")) return false;
  const url = URL.createObjectURL(await response.blob());
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  try {
    await audio.play();
    return true;
  } catch {
    URL.revokeObjectURL(url);
    return false;
  }
}
