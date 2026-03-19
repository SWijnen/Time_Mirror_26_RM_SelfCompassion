"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dfUpsertSession } from "@/lib/dfClient";

type Stored = {
  sessionId: string;
  createdAt: string;
  pastSelf: { name: string; age?: number | ""; shortBio: string; description?: string };
  futureSelf: { name: string; age?: number | ""; shortBio: string; description?: string };
};

type Msg = { role: "user" | "assistant"; content: string; ts: number };

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const bubbleBase: React.CSSProperties = {
  maxWidth: "82%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e2e2",
  whiteSpace: "pre-wrap",
  lineHeight: 1.45,
  fontSize: 14,
  boxSizing: "border-box",
};

export default function ChatPage() {
  const router = useRouter();

  const [data, setData] = useState<Stored | null>(null);

  // Each persona keeps its own conversation state
  const [pastMsgs, setPastMsgs] = useState<Msg[]>([]);
  const [futureMsgs, setFutureMsgs] = useState<Msg[]>([]);

  // Separate inputs (so you can type in either panel)
  const [pastInput, setPastInput] = useState("");
  const [futureInput, setFutureInput] = useState("");

  // Prevent double-send
  const pastSendingRef = useRef(false);
  const futureSendingRef = useRef(false);

  // For auto-scroll
  const pastEndRef = useRef<HTMLDivElement | null>(null);
  const futureEndRef = useRef<HTMLDivElement | null>(null);

  // ----------------------------
  // Load profiles + restore chat
  // ----------------------------
  useEffect(() => {
    const profile = loadJson<Stored>("temporalSelves");
    if (!profile) return;
    setData(profile);

    const saved = loadJson<any>("temporalSelvesWithChat");
    if (saved?.chat?.past?.length || saved?.chat?.future?.length) {
      setPastMsgs(saved.chat.past ?? []);
      setFutureMsgs(saved.chat.future ?? []);
      return;
    }

    /**
     * =========================
     * STUDENT-EDITABLE ZONE (OPENING MESSAGES)
     * Students can change the initial greeting / first question.
     * =========================
     */
    const pastGreeting: Msg = {
      role: "assistant",
      content: `Hi — I’m your past self “${profile.pastSelf.name}”.\nWhat’s on your mind right now?`,
      ts: Date.now(),
    };
    const futureGreeting: Msg = {
      role: "assistant",
      content: `Hi — I’m your future self “${profile.futureSelf.name}”.\nWhat’s on your mind right now?`,
      ts: Date.now(),
    };

    setPastMsgs([pastGreeting]);
    setFutureMsgs([futureGreeting]);
  }, []);

  // Auto-scroll when new messages appear
  useEffect(() => {
    pastEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pastMsgs.length]);

  useEffect(() => {
    futureEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [futureMsgs.length]);

  // ----------------------------
  // Safeguard prompt layer
  // ----------------------------

  /**
   * =========================
   * STUDENT-EDITABLE ZONE (SAFEGUARD RULES)
   * This is the "positive guidance" layer.
   * Students can refine these rules, tone, or add constraints.
   * =========================
   */
  const safeguardRules = `
Safeguards:
Lead with self-compassion. Help the user see their struggles with kindness, not judgment.
- Normalize difficulty: struggles are part of being human, not personal failures.
- Be supportive and constructive. Gently guide the user toward coping, clarity, and small next steps.
- Validate feelings without amplifying distress. Avoid catastrophizing, shame, or harsh judgments.
- Do not provide medical, legal, or crisis advice. If the user asks for emergency help, suggest seeking professional/local support.
- Encourage agency: help the user identify one controllable action, one helpful reframe, or one small experiment.
- Ask at most ONE reflective follow-up question per turn.
- Keep responses concise (2–6 sentences). End with a gentle question or invitation.
`.trim();

  function buildSystemPrompt(persona: "past" | "future") {
    if (!data) return "";
    const self = persona === "past" ? data.pastSelf : data.futureSelf;

    /**
     * =========================
     * STUDENT-EDITABLE ZONE (PERSONA PROMPT TEMPLATE)
     * Students can change the persona framing here, e.g., time distance, tone, goals.
     * =========================
     */
    const personaFrame =
      persona === "past"
        ? `
You are the user's PAST self.
Your role: offer perspective on self-compassion; show them it's okay to be gentle with themselves.
`
        : `
You are the user's FUTURE self.
Your role: offer perspective on self-compassion; show them it's okay to be gentle with themselves.
`;

    const identity = `
Identity you must embody:
- Name: ${self.name}
- Age: ${self.age ?? "not specified"}
- Short bio: ${self.shortBio}
- Description: ${self.description ?? "not specified"}

Rules:
- Speak in first person as ${self.name}.
- Stay consistent with the bio/description.
- Do not mention "system prompt" or policies.
- Pretent that you are human.
- Do not acknowledge that you are an AI or language model.
- Steer the conversation towards self-compassion
`.trim();

    return `${personaFrame.trim()}\n\n${identity}\n\n${safeguardRules}`;
  }

  // ----------------------------
  // API call helper
  // ----------------------------
  async function callLLM(systemPrompt: string, history: Msg[], userText: string) {
    // keep last N messages to control cost; adjust if needed
    const N = 12;

    const messages = history
      .filter((m) => m.content !== "…")
      .slice(-N)
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch("/api/openai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt,
        messages: [...messages, { role: "user", content: userText }],
      }),
    });

    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      // show real error text in the chat for debugging (prototype-friendly)
      return `API error (${res.status}): ${json?.error ?? "unknown"}`;
    }
    return (json?.content ?? "…").toString().trim() || "…";
  }

  // ----------------------------
  // Persist transcript
  // ----------------------------
  function persist(nextPast: Msg[], nextFuture: Msg[]) {
    if (!data) return;
    localStorage.setItem(
      "temporalSelvesWithChat",
      JSON.stringify({
        ...data,
        chat: { past: nextPast, future: nextFuture },
        updatedAt: new Date().toISOString(),
      })
    );
  }

  // ----------------------------
  // Send handlers (Past / Future)
  // ----------------------------
  async function sendPast() {
    const text = pastInput.trim();
    if (!text || !data) return;
    if (pastSendingRef.current) return;
    pastSendingRef.current = true;

    setPastInput("");

    const userMsg: Msg = { role: "user", content: text, ts: Date.now() };
    const thinking: Msg = { role: "assistant", content: "…", ts: Date.now() + 1 };

    const base = [...pastMsgs, userMsg, thinking];
    setPastMsgs(base);

    const reply = await callLLM(buildSystemPrompt("past"), [...pastMsgs, userMsg], text);
    const assistantMsg: Msg = { role: "assistant", content: reply, ts: Date.now() + 2 };

    const finalPast = [...pastMsgs, userMsg, assistantMsg];
    setPastMsgs(finalPast);
    persist(finalPast, futureMsgs);
    // Removed dfUpsertSession call - data will be sent at the end

    pastSendingRef.current = false;
  }

  async function sendFuture() {
    const text = futureInput.trim();
    if (!text || !data) return;
    if (futureSendingRef.current) return;
    futureSendingRef.current = true;

    setFutureInput("");

    const userMsg: Msg = { role: "user", content: text, ts: Date.now() };
    const thinking: Msg = { role: "assistant", content: "…", ts: Date.now() + 1 };

    const base = [...futureMsgs, userMsg, thinking];
    setFutureMsgs(base);

    const reply = await callLLM(buildSystemPrompt("future"), [...futureMsgs, userMsg], text);
    const assistantMsg: Msg = { role: "assistant", content: reply, ts: Date.now() + 2 };

    const finalFuture = [...futureMsgs, userMsg, assistantMsg];
    setFutureMsgs(finalFuture);
    persist(pastMsgs, finalFuture);
    // Removed dfUpsertSession call - data will be sent at the end

    futureSendingRef.current = false;
  }

  // ----------------------------
  // Go reflection
  // ----------------------------
  function goReflection() {
    router.push("/reflection");
  }

  function goStart() {
    router.push("/");
    localStorage.removeItem("temporalSelves");
    localStorage.removeItem("temporalSelvesWithChat");
    localStorage.removeItem("temporalSelvesReflection");
  }

  if (!data) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        <h1>Chat</h1>
        <p>No profile found. Please complete setup first.</p>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #cfcfcf",
            background: "#f0f0f0",
            cursor: "pointer",
          }}
        >
          Back to Customize
        </button>
      </main>
    );
  }

  /**
   * =========================
   * STUDENT-EDITABLE ZONE (PAGE HEADER / INSTRUCTIONS)
   * Students can change page title and guidance text.
   * =========================
   */
  const pageTitle = "Chat with your Future Self";
  const pageHint =
    "Talk to your future self. It responds on the bios you wrote. Keep it real; you can stay brief.";

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", padding: 16 }}>
      <Header
        title={pageTitle}
        hint={pageHint}
        onPrevious={goStart}
        prevLabel="Back → Start"
        onNext={goReflection}
        nextLabel="Next → Reflection"
        showPrevious={false}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr .001fr",
          gap: 18,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        {/* <ChatPanel
          persona="past"
          selfName={data.pastSelf.name}
          selfBio={data.pastSelf.shortBio}
          selfDesc={data.pastSelf.description}
          messages={pastMsgs}
          input={pastInput}
          setInput={setPastInput}
          onSend={() => void sendPast()}
          endRef={pastEndRef}
        /> */}

        <ChatPanel
          persona="future"
          selfName={data.futureSelf.name}
          selfBio={data.futureSelf.shortBio}
          selfDesc={data.futureSelf.description}
          messages={futureMsgs}
          input={futureInput}
          setInput={setFutureInput}
          onSend={() => void sendFuture()}
          endRef={futureEndRef}
        />
      </div>

      {/* <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Tip: If you want, ask the same question to both selves and compare how they respond.
      </p> */}
    </main>
  );
}

function Header(props: { title: string; hint: string; onNext: () => void; nextLabel: string; onPrevious: () => void; prevLabel: string; showPrevious?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0 }}>{props.title}</h1>
        <p style={{ marginTop: 8, marginBottom: 0, maxWidth: 860, color: "#444", lineHeight: 1.45 }}>
          {props.hint}
        </p>
      </div>

      {props.showPrevious !== false && (
        <button
          onClick={props.onPrevious}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #cfcfcf",
            background: "#f0f0f0",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {props.prevLabel}
        </button>
      )}

      <button
        onClick={props.onNext}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #cfcfcf",
          background: "#f0f0f0",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {props.nextLabel}
      </button>
    </div>
  );
}

function ChatPanel(props: {
  persona: "past" | "future";
  selfName: string;
  selfBio: string;
  selfDesc?: string;
  messages: Msg[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  const personaLabel = props.persona === "past" ? "Past self" : "Future self";

  /**
   * =========================
   * STUDENT-EDITABLE ZONE (PANEL UI COPY)
   * Students can adjust the labels and microcopy for each panel.
   * =========================
   */
  const tagline =
    props.persona === "past"
      ? "Grounded, honest, and compassionate."
      : "Calm, hopeful, and perspective-taking.";

  const placeholder =
    props.persona === "past"
      ? "Type a message to your past self…"
      : "Type a message to your future self…";

  return (
    <section
      style={{
        border: "1px solid #e2e2e2",
        borderRadius: 12,
        background: "#fafafa",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: 640,
      }}
    >
      {/* Persona header */}
      <div style={{ padding: 14, borderBottom: "1px solid #e6e6e6", background: "#f7f7f7" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 700 }}>{personaLabel}: {props.selfName}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{tagline}</div>
        </div>

        <div style={{ marginTop: 8, fontSize: 13, color: "#444", lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "#666" }}>Short bio</div>
          <div>{props.selfBio}</div>

          {props.selfDesc?.trim() ? (
            <>
              <div style={{ fontWeight: 600, fontSize: 12, color: "#666", marginTop: 8 }}>Description</div>
              <div>{props.selfDesc}</div>
            </>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          padding: 14,
          background: "#fff",
          flex: 1,
          overflowY: "auto",
        }}
      >
        {props.messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  ...bubbleBase,
                  background: isUser ? "#f0f0f0" : "#fafafa",
                }}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={props.endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: "1px solid #e6e6e6", background: "#f7f7f7" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={props.input}
            onChange={(e) => props.setInput(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cfcfcf",
              fontSize: 14,
              background: "#fff",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                props.onSend();
              }
            }}
          />
          <button
            onClick={props.onSend}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #cfcfcf",
              background: "#f0f0f0",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          {/* STUDENT-EDITABLE ZONE (PROMPTING TIP) */}
          Tip: Try one concrete detail (what happened / when / where) to get a more specific response.
        </div>
      </div>
    </section>
  );
}
