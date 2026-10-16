"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    // DB에서 힌트 조회, 없으면 환경변수 폴백
    const fetchHint = async () => {
      try {
        const response = await fetch("/api/auth/hint");
        if (response.ok) {
          const data = await response.json();
          setHint(
            data.password_hint || process.env.NEXT_PUBLIC_ADMIN_HINT || null,
          );
        }
      } catch {
        setHint(process.env.NEXT_PUBLIC_ADMIN_HINT || null);
      }
    };
    fetchHint();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push("/admin");
      } else {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "비밀번호가 올바르지 않습니다");
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gray-100">
      <div className="w-full max-w-sm bg-white p-8 rounded-lg shadow-lg">
        <h1 className="font-[family-name:var(--font-cormorant)] text-3xl text-center mb-8 text-gray-900">
          Admin Access
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full h-12 px-4 border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
              autoFocus
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            loading={loading}
            disabled={!password}
          >
            로그인
          </Button>

          {hint && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                {showHint ? "힌트 숨기기" : "비밀번호 힌트"}
              </button>
              {showHint && (
                <p className="mt-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
                  {hint}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
