"use client";
import { useState } from "react";
export default function SettingsForm({
  currentHint,
  onSubmit,
}: {
  currentHint?: string;
  onSubmit: (data: {
    current_password: string;
    new_password?: string;
    password_hint?: string;
  }) => Promise<void>;
}) {
  const [password, setPassword] = useState(""),
    [hint, setHint] = useState(currentHint || ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="archive-form max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit({ current_password: password, password_hint: hint });
          setPassword("");
          setMessage("힌트를 저장했습니다. 비밀번호는 그대로 유지합니다.");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "저장 실패");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>기존 비밀번호를 유지합니다.</p>
      <label className="admin-field">
        현재 비밀번호
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <label className="admin-field">
        관리자용 힌트
        <input value={hint} onChange={(e) => setHint(e.target.value)} />
      </label>
      <button type="submit" disabled={busy}>
        힌트 저장
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
