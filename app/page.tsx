"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dfUpsertSession } from "@/lib/dfClient";
/**
 * =========================
 * STUDENT-EDITABLE ZONE (DATA MODEL)
 * Students MAY extend this type (e.g., add values, goals, roles),
 * but should keep name + shortBio at minimum.
 * =========================
 */
type TemporalSelf = {
  name: string;
  age?: number | "";
  shortBio: string;
  description: string;
};

export default function CustomizePage() {
  const router = useRouter();

  const [past, setPast] = useState<TemporalSelf>({
    name: "",
    age: "",
    shortBio: "",
    description: "",
  });

  const [future, setFuture] = useState<TemporalSelf>({
    name: "",
    age: "",
    shortBio: "",
    description: "",
  });

  /**
   * =========================
   * STUDENT-EDITABLE ZONE (VALIDATION LOGIC)
   * Students may change what is required to proceed.
   * =========================
   */
  const canProceed =
    past.name.trim() &&
    past.shortBio.trim() &&
    future.name.trim() &&
    future.shortBio.trim();

  async function handleNext() {
    const sessionId =
      localStorage.getItem("sessionId") ??
      (() => {
        const id = crypto.randomUUID();
        localStorage.setItem("sessionId", id);
        return id;
      })();

    localStorage.setItem(
      "temporalSelves",
      JSON.stringify({
        sessionId,
        createdAt: new Date().toISOString(),
        pastSelf: past,
        futureSelf: future,
      })
    );
    // Removed dfUpsertSession call - data will be sent at the end

    router.push("/chat");
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: 16 }}>
      {/**
       * =========================
       * STUDENT-EDITABLE ZONE (PAGE TITLE & INTRO)
       * Students may reframe the study context here.
       * =========================
       */}
      <h1 style={{ marginTop: 0 }}>Customize Your Past and Future Selves</h1>
      <p style={{ maxWidth: 760, color: "#444", lineHeight: 1.45 }}>
        You will define two versions of yourself: one from the past and one from
        the future. These descriptions will shape how each self talks to you in
        the next step.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        <TemporalSelfCard
          title="Past Self"
          hint="Who were you at an earlier stage of this journey?"
          value={past}
          onChange={setPast}
        />

        <TemporalSelfCard
          title="Future Self"
          hint="Who might you become later in this journey?"
          value={future}
          onChange={setFuture}
        />
      </div>

      <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
        <button
          disabled={!canProceed}
          onClick={handleNext}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #cfcfcf",
            background: canProceed ? "#f0f0f0" : "#e0e0e0",
            cursor: canProceed ? "pointer" : "not-allowed",
            fontSize: 14,
          }}
        >
          Next → Chat
        </button>
      </div>

      {!canProceed ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
          <b>Please do not enter any sensitive data that you are not comfortable sharing with others. All the data will be visible to the research team and will be used for data analysis. </b>
        </p>
      ) : null}
    </main>
  );
}

/**
 * =========================
 * STUDENT-EDITABLE ZONE (FIELD WORDING & PROMPTS)
 * Students may change labels, placeholders, or add/remove fields.
 * =========================
 */
function TemporalSelfCard(props: {
  title: string;
  hint: string;
  value: TemporalSelf;
  onChange: (v: TemporalSelf) => void;
}) {
  const { title, hint, value, onChange } = props;

  const isFuture = title === "Future Self";

  const questions = isFuture ? [
    "Briefly describe who you are 5-10 years from now.",
    "What experiences or lessons do you think your future self has gained since now?",
    "What kind of advice or attitude do you think your future self would have toward your current worries?",
    "What is one educational worry or challenge you are currently facing that you would like to discuss with your future self?"
  ] : [
    "Briefly describe who you were 5-10 years before now.",
    "What experiences or lessons did you gaine since then?",
    "What kind of advice or attitude do you think give past self would have toward your current worries?",
    "What is one educational worry or challenge you are currently facing that you would like to discuss with your past self?"
  ];

  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const bio = Object.values(answers).filter(a => a.trim()).join('. ');
    onChange({ ...value, shortBio: bio });
  }, [answers, onChange]);


  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box", // ✅ prevents overflowing the card
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cfcfcf",
    fontSize: 14,
    background: "#fff",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: 600,
  };

  const helpStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#666",
    marginTop: 6,
    lineHeight: 1.35,
  };

  return (
    <section
      style={{
        border: "1px solid #e2e2e2",
        borderRadius: 12,
        padding: 16,
        background: "#fafafa",
        overflow: "hidden", // ✅ visual safety net
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
      </div>

      <p style={{ fontSize: 13, color: "#555", marginTop: 8, marginBottom: 0 }}>
        {hint}
      </p>

      <div style={{ marginTop: 14 }}>
        <div style={labelStyle}>Name (required)</div>
        <input
          style={inputStyle}
          value={value.name}
          placeholder="e.g., Me at the beginning"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <div style={helpStyle}>This name will be used in the chat interface.</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={labelStyle}>Age (optional)</div>
        <input
          type="number"
          style={inputStyle}
          value={value.age}
          placeholder="Your age, with a 5-10 years age difference"
          onChange={(e) =>
            onChange({
              ...value,
              age: e.target.value ? Number(e.target.value) : "",
            })
          }
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={labelStyle}>Profile details (required)</div>
        <div style={{ marginBottom: 20 }}>
          <div style={helpStyle}>
            These details will be combined to create the short bio that shapes the persona of the assistant you will talk to.
          </div>
        </div>
        {questions.map((q, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>{q}</div>
            <input
              style={inputStyle}
              value={answers[`q${i}`] || ""}
              placeholder="Your answer here..."
              onChange={(e) => setAnswers(prev => ({ ...prev, [`q${i}`]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {/* <div style={{ marginTop: 14 }}>
        <div style={labelStyle}>Short bio (required)</div>
        <input
          style={inputStyle}
          placeholder="1–2 sentences describing this self (tone, situation, mindset)"
          value={value.shortBio}
          onChange={(e) => onChange({ ...value, shortBio: e.target.value })}
        />
        <div style={helpStyle}>
          The short bio directly shapes the persona of the assistant you will talk to.
        </div>
      </div> */}

      <div style={{ marginTop: 14 }}>
        <div style={labelStyle}>Description (optional)</div>
        <textarea
          rows={4}
          style={{
            ...inputStyle,
            resize: "vertical",
            lineHeight: 1.4,
          }}
          placeholder="Add more detail: values, constraints, goals, what this self is struggling with, how they speak..."
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </div>
    </section>
  );
}
