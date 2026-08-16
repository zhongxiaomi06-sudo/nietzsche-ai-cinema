"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export type Fb = { role: string; score: number; text: string; chapter: number; _t?: number };

export function FeedbackModal({
  open,
  wall,
  onClose,
  onSubmit,
  onLoadWall,
}: {
  open: boolean;
  wall: Fb[] | null;
  onClose: () => void;
  onSubmit: (role: string, score: number, text: string) => Promise<void>;
  onLoadWall: () => void;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState("哲学入门者");
  const [score, setScore] = useState(0);
  const [text, setText] = useState("");
  const submit = async () => {
    if (!text.trim()) {
      alert(t("fb.needText"));
      return;
    }
    await onSubmit(role, score, text.trim());
    setText("");
    setScore(0);
  };
  return (
    <div className={`modal ${open ? "show" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="m-box">
        <h3>{t("fb.title")}</h3>
        <p className="m-sub">{t("fb.sub")}</p>
        <div className="fb-form">
          <label>{t("fb.role")}</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="哲学入门者">哲学入门者（想读尼采却被劝退）</option>
            <option value="学生/研究者">学生 / 研究者</option>
            <option value="爱好者">尼采爱好者</option>
            <option value="创作者/产品人">创作者 / 产品人</option>
            <option value="其他">其他</option>
          </select>
          <label>{t("fb.score")}</label>
          <div className="fb-stars">
            {[1, 2, 3, 4, 5].map((v) => (
              <span key={v} className={v <= score ? "on" : ""} onClick={() => setScore(v)}>
                ★
              </span>
            ))}
          </div>
          <label>{t("fb.text")}</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("fb.placeholder")} />
          <div className="chat-row" style={{ marginTop: 12 }}>
            <button className="btn fork" onClick={submit}>
              {t("fb.submit")}
            </button>
            <button className="btn" onClick={onLoadWall}>
              {t("fb.wall")}
            </button>
          </div>
        </div>
        <div className="fb-wall">
          {wall === null ? null : wall.length === 0 ? (
            <div className="fb-item">
              <div className="fb-text" style={{ color: "var(--faint)" }}>
                {t("fb.empty")}
              </div>
            </div>
          ) : (
            wall
              .slice(-12)
              .reverse()
              .map((f, i) => (
                <div className="fb-item" key={i}>
                  <div className="fb-meta">
                    {f.role || "读者"} · {"★".repeat(f.score || 0)}
                    {"☆".repeat(5 - (f.score || 0))}
                  </div>
                  <div className="fb-text">{f.text}</div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

export type Report = {
  title?: string;
  summary?: string;
  themes?: { name: string; note: string }[];
  why?: string;
  forkMeaning?: string;
  recur?: string;
  ending?: string;
  closing?: string;
  localHtml?: string;
};

export function ReportModal({ open, loading, report, onClose }: { open: boolean; loading: boolean; report: Report | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className={`modal ${open ? "show" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="m-box">
        {loading ? (
          <>
            <h3>{t("report.title")}</h3>
            <p className="m-sub">{t("report.loading")}</p>
          </>
        ) : report && report.summary ? (
          <>
            <h3 className="rep-title">{report.title || "世界线复盘"}</h3>
            <div className="rep-summary">{report.summary}</div>
            {(report.themes || []).slice(0, 5).map((th, i) => (
              <div className="rep-theme" key={i}>
                <b>{th.name}</b>
                <span>{th.note}</span>
              </div>
            ))}
            {report.why && (
              <div className="rep-line">
                <b>为何如此收场：</b>
                {report.why}
              </div>
            )}
            {report.forkMeaning && (
              <div className="rep-line">
                <b>分叉之意义：</b>
                {report.forkMeaning}
              </div>
            )}
            {report.recur && (
              <div className="rep-line">
                <b>永恒轮回：</b>
                {report.recur}
              </div>
            )}
            {(report.ending || report.closing) && (
              <div className="rep-closing">
                {report.ending} — {report.closing}
              </div>
            )}
          </>
        ) : report && report.localHtml ? (
          <>
            <h3 className="rep-title">{t("report.localTitle")}</h3>
            <div dangerouslySetInnerHTML={{ __html: report.localHtml }} />
          </>
        ) : null}
      </div>
    </div>
  );
}
