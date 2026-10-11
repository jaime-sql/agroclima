"use client";

import { useEffect, useRef, useState } from "react";
import { LISTEN_COPY, pickSpanishVoice } from "@/lib/speech";
import { listenFallback } from "@/lib/tts";

const buttonClass =
  "inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 text-lg font-semibold text-[#1E5B2A] ring-2 ring-[#1E5B2A]";

type Phase = "idle" | "loading" | "playing" | "ended";

export function ListenButton({ text }: { text: string }) {
  const player = useAudioPlayer();
  const label =
    player.phase === "loading"
      ? LISTEN_COPY.loading
      : player.phase === "playing"
        ? LISTEN_COPY.playing
        : player.phase === "ended"
          ? LISTEN_COPY.again
          : LISTEN_COPY.idle;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={buttonClass}
        aria-busy={player.phase === "loading"}
        onClick={() => void player.toggle(text)}
      >
        {player.phase === "loading" ? (
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : null}
        {label}
      </button>
      {player.phase === "playing" ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#E7E5E4]" aria-hidden="true">
          <div className="h-1 bg-[#1E5B2A]" style={{ width: `${player.progress}%` }} />
        </div>
      ) : null}
      {player.note ? <p>{player.note}</p> : null}
    </div>
  );
}

export function SmallListen({ text }: { text: string }) {
  const player = useAudioPlayer();
  const playing = player.phase === "playing" || player.phase === "loading";
  return (
    <button
      type="button"
      className="inline-flex h-12 min-w-12 items-center justify-center rounded-full bg-white text-lg text-[#1E5B2A] ring-2 ring-[#1E5B2A]"
      aria-label={playing ? LISTEN_COPY.playing : LISTEN_COPY.idle}
      onClick={() => void player.toggle(text)}
    >
      {playing ? "❚❚" : "▶"}
    </button>
  );
}

function useAudioPlayer() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const speechRef = useRef(false);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => setVoice(pickSpanishVoice(synth.getVoices()));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function toggle(text: string) {
    if (phase === "loading") return;
    if (phase === "playing") {
      audioRef.current?.pause();
      if (speechRef.current) window.speechSynthesis?.cancel();
      speechRef.current = false;
      setPhase("ended");
      return;
    }

    setNote(null);
    setPhase("loading");
    setProgress(0);
    let serverAudio = false;
    try {
      serverAudio = await startServerAudio(text);
    } catch {
      serverAudio = false;
    }
    const choice = listenFallback({ serverAudio, hasSpanishVoice: voice !== null });
    if (choice === "browser" && voice) {
      speak(text, voice);
      return;
    }
    if (choice === "failed") {
      setPhase("idle");
      setNote(LISTEN_COPY.failed);
    }
  }

  async function startServerAudio(text: string): Promise<boolean> {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("audio/")) return false;
    releaseAudio();
    const url = URL.createObjectURL(await response.blob());
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    speechRef.current = false;
    audio.ontimeupdate = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      setProgress(Math.min(100, (audio.currentTime / audio.duration) * 100));
    };
    audio.onended = () => {
      setProgress(100);
      setPhase("ended");
    };
    try {
      await audio.play();
      setPhase("playing");
      return true;
    } catch {
      releaseAudio();
      return false;
    }
  }

  function speak(text: string, selected: SpeechSynthesisVoice) {
    const synth = window.speechSynthesis;
    synth.cancel();
    speechRef.current = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selected.lang;
    utterance.voice = selected;
    utterance.onend = () => {
      speechRef.current = false;
      setPhase("ended");
    };
    utterance.onerror = () => {
      speechRef.current = false;
      setPhase("idle");
      setNote(LISTEN_COPY.failed);
    };
    synth.speak(utterance);
    setPhase("playing");
  }

  function releaseAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }

  return { phase, progress, note, toggle };
}
