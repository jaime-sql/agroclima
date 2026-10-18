"use client";

import { useState, useSyncExternalStore } from "react";
import {
  askChips,
  askClientCard,
  ASK_CLIENT_FAILED,
  ASK_HEADER,
  ASK_MAX_QUESTION_CHARS,
  ASK_PLACEHOLDER,
  ASK_RETRY_BUTTON,
  ASK_RETRYING,
  ASK_SOURCE,
  ASK_SHARE,
  shouldRetryAskClient,
  type AskClientCard,
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
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(false);
  const canDictate = useSyncExternalStore(emptySubscribe, speechInputSupported, () => false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setQuestion(trimmed);
    setPending(true);
    setRetrying(false);
    const body = JSON.stringify({ question: trimmed, place, timezone, days, diagnosis });
    try {
      let card: AskClientCard | "transport" = "transport";
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        card = await postAsk(body);
        if (!shouldRetryAskClient(attempt, card !== "transport")) break;
        setRetrying(true);
      }
      if (card === "transport" || card.kind === "failure") {
        setFailed(true);
        return;
      }
      setFailed(false);
      const answer = card;
      setAnswers((current) => [
        ...current,
        { id: current.length + 1, text: answer.text, refused: answer.refused },
      ]);
    } finally {
      setPending(false);
      setRetrying(false);
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
                className="min-h-12 w-full rounded-2xl bg-[#E7E5E4] px-4 text-left text-lg disabled:opacity-60"
                disabled={pending}
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
              disabled={pending}
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
                disabled={pending}
                onClick={dictate}
              >
                🎤
              </button>
            ) : null}
          </div>
          {pending ? (
            <p role="status" className="flex items-center gap-3 text-lg">
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#1E5B2A] border-t-transparent"
                aria-hidden="true"
              />
              {retrying ? ASK_RETRYING : null}
            </p>
          ) : null}
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
          {failed && !pending ? (
            <article className="flex flex-col gap-2 rounded-2xl bg-white p-4">
              <p>{ASK_CLIENT_FAILED}</p>
              <button
                type="button"
                className="min-h-14 w-full rounded-2xl bg-[#1E5B2A] px-4 text-lg font-semibold text-white"
                onClick={() => void ask(question)}
              >
                {ASK_RETRY_BUTTON}
              </button>
            </article>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

async function postAsk(body: string): Promise<AskClientCard | "transport"> {
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    try {
      return askClientCard(await response.json());
    } catch {
      return "transport";
    }
  } catch {
    return "transport";
  }
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
