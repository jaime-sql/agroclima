"use client";

import { useState, type FormEvent } from "react";
import {
  ASK_FAILED,
  ASK_MAX_QUESTION_CHARS,
  type AskDay,
  type AskGrounding,
} from "@/lib/ask";

const primary =
  "min-h-14 w-full rounded-2xl bg-[#1E5B2A] px-4 text-lg font-semibold text-white disabled:opacity-70";

export function AskBox({
  place,
  days,
  diagnosis,
}: {
  place: string;
  days: AskDay[];
  diagnosis: AskGrounding["diagnosis"];
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, place, days, diagnosis }),
      });
      const payload = (await response.json()) as { answer?: unknown };
      setAnswer(typeof payload.answer === "string" ? payload.answer : ASK_FAILED);
    } catch {
      setAnswer(ASK_FAILED);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      <label className="font-semibold" htmlFor="agroclima-pregunta">
        Pregúntele a AgroClima
      </label>
      <textarea
        id="agroclima-pregunta"
        className="min-h-28 w-full rounded-2xl bg-white p-4 text-lg text-[#1C1917] ring-2 ring-[#1E5B2A]"
        maxLength={ASK_MAX_QUESTION_CHARS}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
      />
      <button type="submit" className={primary} disabled={pending}>
        {pending ? "Preguntando…" : "Preguntar"}
      </button>
      {answer ? <p>{answer}</p> : null}
    </form>
  );
}
