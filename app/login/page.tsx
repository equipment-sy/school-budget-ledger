"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ink = "#24312B";
const ledgerLine = "#CBD1C3";
const stampGreen = "#3F6B4F";
const stampRed = "#A63A32";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "登入失敗");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360, padding: 32, background: "#fff", border: `1px solid ${ledgerLine}` }}>
        <p style={{ fontSize: 13, color: "#93762A", marginBottom: 4 }}>教務處．經費控帳系統</p>
        <h1 style={{ fontFamily: '"Noto Serif TC", serif', fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>登入</h1>

        <label style={{ fontSize: 12, color: "#5B6459" }}>帳號 Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", width: "100%", padding: "8px 10px", margin: "4px 0 14px", border: `1px solid ${ledgerLine}` }}
        />

        <label style={{ fontSize: 12, color: "#5B6459" }}>密碼</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ display: "block", width: "100%", padding: "8px 10px", margin: "4px 0 18px", border: `1px solid ${ledgerLine}` }}
        />

        {error && <p style={{ color: stampRed, fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          style={{ width: "100%", padding: "10px", background: ink, color: "#fff", border: "none", cursor: "pointer" }}
        >
          {loading ? "登入中…" : "登入"}
        </button>
      </div>
    </div>
  );
}
