"use client";

import { useState, useSyncExternalStore } from "react";
import {
  askChips,
  ASK_FAILED,
  ASK_HEADER,
  ASK_MAX_QUESTION_CHARS,
  ASK_PLACEHOLDER,
  ASK_REFUSAL,
  ASK_SOURCE,
  ASK_SHARE,
  type AskDay,
  type AskGrounding,
} from "@/lib/ask";
import { SmallListen } from "./listen-button";

const field =
  "min-h-14 w-full rounded-2xl bg-white px-4 text-lg text-[#1C1917] ring-2 ring-[#1E5B2A]";

type Answer = { id: number; text: string; refused: boolean };

export function AskBox({
  place,
  timezone,
  days,
  diagnosis,
  onShare,
}: {
  place: string;
  timezone: string | null;
  days: Array<Omit<AskDay, "label">>;
  diagnosis: AskGrounding["diagnosis"];
  onShare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [pending, setPending] = useState(false);
  const canDictate = useSyncExternalStore(emptySubscribe, speechInputSupported, () => false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setQuestion(trimmed);
    setPending(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, place, timezone, days, diagnosis }),
      });
      const payload = (await response.json()) as {
        answer?: unknown;
        refused?: unknown;
        error?: unknown;
      };
      const answer = typeof payload.answer === "string" ? payload.answer : ASK_FAILED;
      setAnswers((current) => [
        ...current,
        {
          id: current.length + 1,
          text: answer,
          refused: payload.refused === true || payload.error === "refused" || answer === ASK_REFUSAL,
        },
      ]);
    } catch {
      setAnswers((current) => [
        ...current,
        { id: current.length + 1, text: ASK_FAILED, refused: false },
      ]);
    } finally {
      setPending(false);
    }
  }

  function dictate() {
    const support = window as Window & {
      SpeechRecognition?: new () => RecognitionSession;
      webkitSpeechRecognition?: new () => RecognitionSession;
    };
    const Ctor = support.SpeechRecognition ?? support.webkitSpeechRecognition;
    if (!Ctor) return;
    const session = new Ctor();
    session.lang = "es-SV";
    session.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setQuestion(transcript);
    };
    session.start();
  }

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        className="min-h-14 w-full rounded-2xl bg-white px-4 text-left text-2xl font-semibold text-[#1E5B2A] ring-2 ring-[#1E5B2A]"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {ASK_HEADER}
      </button>
      {open ? (
        <>
          <div className="flex flex-col gap-2">
            {askChips(days).map((chip) => (
              <button
                key={chip}
                type="button"
                className="min-h-12 w-full rounded-2xl bg-[#E7E5E4] px-4 text-left text-lg"
                onClick={() => void ask(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              id="agroclima-pregunta"
              className={field}
              placeholder={ASK_PLACEHOLDER}
              maxLength={ASK_MAX_QUESTION_CHARS}
              value={question}
              aria-label={ASK_HEADER}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void ask(question);
                }
              }}
            />
            {canDictate ? (
              <button
                type="button"
                className="inline-flex h-14 min-w-14 items-center justify-center rounded-2xl bg-white text-lg ring-2 ring-[#1E5B2A]"
                aria-label="Micrófono"
                onClick={dictate}
              >
                🎤
              </button>
            ) : null}
          </div>
          {answers.map((item) => (
            <article key={item.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4">
              <div className="flex items-start gap-3">
                <p className="flex-1">{item.text}</p>
                <SmallListen text={item.text} />
              </div>
              <p>{ASK_SOURCE}</p>
              {item.refused ? (
                <button
                  type="button"
                  className="min-h-14 w-full rounded-2xl bg-[#1E5B2A] px-4 text-lg font-semibold text-white"
                  onClick={onShare}
                >
                  {ASK_SHARE}
                </button>
              ) : null}
            </article>
          ))}
        </>
      ) : null}
    </section>
  );
}

function emptySubscribe() {
  return () => {};
}

function speechInputSupported(): boolean {
  const support = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(support.SpeechRecognition || support.webkitSpeechRecognition);
}

type RecognitionSession = {
  lang: string;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
};
