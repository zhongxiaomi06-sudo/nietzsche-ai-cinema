"use client";
import { useEffect, useRef, useState } from "react";
import { BRANCHES } from "@/lib/world";
import { useI18n } from "@/lib/i18n";

export function GodModal({
  open,
  idx,
  initial,
  onCancel,
  onApply,
}: {
  open: boolean;
  idx: number;
  initial: string;
  onCancel: () => void;
  onApply: (v: string) => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(initial);
  useEffect(() => {
    setText(initial);
  }, [initial, open]);
  const branches = BRANCHES[idx] || [];
  return (
    <div className={`modal ${open ? "show" : ""}`} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="m-box">
        <h3>{t("god.title")}</h3>
        <p className="m-sub">{t("god.sub")}</p>
        <textarea className="god-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：让他放下笔，在山间静养……" />
        <div className="chips">
          {branches.map((b, k) => (
            <span className="chip" key={k} onClick={() => setText(b.v)}>
              {b.l}
            </span>
          ))}
        </div>
        <div className="actions">
          <button className="btn fork" onClick={() => onApply(text.trim())}>
            {t("god.apply")}
          </button>
          <button className="btn" onClick={onCancel}>
            {t("god.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ChatMsg = { role: "u" | "a"; text: string };

export function DialogModal({
  open,
  log,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  log: ChatMsg[];
  busy: boolean;
  onClose: () => void;
  onSend: (q: string) => void;
}) {
  const { t } = useI18n();
  const [val, setVal] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, busy]);
  const send = () => {
    const q = val.trim();
    if (!q || busy) return;
    onSend(q);
    setVal("");
  };
  return (
    <div className={`modal ${open ? "show" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="m-box">
        <h3>{t("dialog.title")}</h3>
        <p className="m-sub">{t("dialog.sub")}</p>
        <div className="chat-log" ref={logRef}>
          <div className="bubble a">
            <span className="who">{t("who.twin")}</span>
            {t("dialog.greet")}
          </div>
          {log.map((m, i) =>
            m.role === "u" ? (
              <div className="bubble u" key={i}>
                {m.text}
              </div>
            ) : (
              <div className="bubble a" key={i}>
                <span className="who">{t("who.twin")}</span>
                {m.text}
              </div>
            ),
          )}
          {busy && (
            <div className="bubble a">
              <span className="who">{t("who.twin")}</span>
              …
            </div>
          )}
        </div>
        <div className="chat-row">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t("dialog.placeholder")}
          />
          <button className="btn" onClick={send} disabled={busy}>
            {t("dialog.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
