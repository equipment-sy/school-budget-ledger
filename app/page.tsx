"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseBudgetFile } from "../lib/parseBudget";
import * as XLSX from "xlsx";

const paper = "#F7F5EC";
const ink = "#24312B";
const inkSoft = "#5B6459";
const ledgerLine = "#CBD1C3";
const greenbar = "#E9EFE4";
const stampRed = "#A63A32";
const stampGold = "#93762A";
const stampGreen = "#3F6B4F";
const stampGrey = "#7A7A72";

const fmt = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;
const input = { padding: "6px 8px", border: `1px solid ${ledgerLine}`, fontSize: 13 } as const;

type Me = { id: string; name: string; role: "director" | "leader"; department_id: string | null; department_name: string | null };
type Dept = { id: string; code: string; name: string };
type Plan = { id: string; department_id: string; name: string; fiscal_year: number; period_type: "calendar" | "academic"; period_start: string; period_end: string; sponsor_org: string | null; status: "open" | "closed"; allocated_total: string };
type Item = { budget_item_id: string; plan_id: string; department_id: string; name: string; allocated_amount: number; used_amount: string; remaining_amount: string };
type Tx = { id: string; budget_item_id: string; tx_date: string; amount: number; note: string; handler_name: string | null; voided: boolean; voided_reason: string | null };

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [txByItem, setTxByItem] = useState<Record<string, Tx[]>>({});
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", year: "2026", periodType: "calendar" as "calendar" | "academic", sponsorOrg: "" });
  const [showNewItem, setShowNewItem] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", allocated: "" });
  const [txForm, setTxForm] = useState<Record<string, { date: string; amount: string; note: string; handler: string }>>({});
  const [error, setError] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", department_id: "" });
  const [createdPassword, setCreatedPassword] = useState<{ email: string; password: string } | null>(null);
  const [importPlanId, setImportPlanId] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<{ name: string; allocated: string; status: "pending" | "ok" | "error"; error?: string }[]>([]);
  const [importing, setImporting] = useState(false);

  async function reloadAll() {
    const [meR, deptR, planR, itemR] = await Promise.all([
      fetch("/api/me"), fetch("/api/departments"), fetch("/api/plans"), fetch("/api/items"),
    ]);
    if (meR.status === 401) { router.push("/login"); return; }
    const meJson = await meR.json();
    setMe(meJson);
    setDepts(await deptR.json());
    setPlans(await planR.json());
    setItems(await itemR.json());
    setSelectedDeptId((prev) => prev || meJson.department_id || "");
  }

  useEffect(() => { reloadAll(); }, []);

  async function loadTx(itemId: string) {
    const res = await fetch(`/api/transactions?budget_item_id=${itemId}`);
    const data = await res.json();
    setTxByItem((prev) => ({ ...prev, [itemId]: data }));
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  async function createPlan() {
    setError("");
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department_id: selectedDeptId, name: newPlan.name, fiscal_year: Number(newPlan.year), period_type: newPlan.periodType, sponsor_org: newPlan.sponsorOrg }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setNewPlan({ name: "", year: "2026", periodType: "calendar", sponsorOrg: "" });
    setShowNewPlan(false);
    reloadAll();
  }

  async function closePlan(planId: string) {
    setError("");
    const res = await fetch(`/api/plans/${planId}/close`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    reloadAll();
  }

  async function createItem(planId: string) {
    setError("");
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, department_id: selectedDeptId, name: newItem.name, allocated_amount: Number(newItem.allocated) }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setNewItem({ name: "", allocated: "" });
    setShowNewItem(null);
    reloadAll();
  }

  async function submitTx(item: Item) {
    setError("");
    const f = txForm[item.budget_item_id] || { date: "", amount: "", note: "", handler: "" };
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget_item_id: item.budget_item_id, department_id: item.department_id, plan_id: item.plan_id,
        tx_date: f.date, amount: Number(f.amount), note: f.note, handler_name: f.handler,
      }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setTxForm((prev) => ({ ...prev, [item.budget_item_id]: { date: "", amount: "", note: "", handler: "" } }));
    loadTx(item.budget_item_id);
    reloadAll();
  }

  async function voidTx(id: string, itemId: string) {
    const reason = window.prompt("作廢原因？");
    if (!reason) return;
    const res = await fetch(`/api/transactions/${id}/void`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
    });
    if (res.ok) loadTx(itemId);
  }

  async function loadUsers() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  }

  async function createUser() {
    setError("");
    setCreatedPassword(null);
    const res = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setCreatedPassword({ email: body.email, password: body.temp_password });
    setNewUser({ name: "", email: "", department_id: "" });
    loadUsers();
  }

  async function toggleActive(id: string, active: boolean) {
    setError("");
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    loadUsers();
  }

  async function resetPassword(id: string) {
    setError("");
    setCreatedPassword(null);
    const res = await fetch(`/api/users/${id}/reset-password`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setCreatedPassword({ email: body.email, password: body.temp_password });
    loadUsers();
  }

  async function handleImportFile(planId: string, file: File) {
    setError("");
    try {
      const parsed = await parseBudgetFile(file);
      if (parsed.length === 0) {
        setError("看不出這份檔案裡的科目和金額。Word/PDF 請確認是電腦打字（不是照片或掃描檔），並包含清楚的科目和金額；也可以改用手動新增。");
        return;
      }
      setImportPlanId(planId);
      setImportRows(parsed.map((p) => ({ name: p.name, allocated: String(p.allocated), status: "pending" as const })));
      setShowNewItem(null);
    } catch {
      setError("這份檔案讀取失敗，請確認格式是 .xlsx、.xls、.csv、.ods、.docx、.odt 或 .pdf");
    }
  }

  function updateImportRow(idx: number, patch: Partial<{ name: string; allocated: string }>) {
    setImportRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, status: "pending" } : r)));
  }
  function removeImportRow(idx: number) {
    setImportRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function confirmImport(planId: string, departmentId: string) {
    setImporting(true);
    const rows = [...importRows];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === "ok") continue;
      const amountNum = Number(rows[i].allocated);
      if (!rows[i].name.trim() || !amountNum || amountNum <= 0) {
        rows[i] = { ...rows[i], status: "error", error: "名稱或金額不完整" };
        continue;
      }
      const res = await fetch("/api/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, department_id: departmentId, name: rows[i].name.trim(), allocated_amount: amountNum }),
      });
      if (res.ok) {
        rows[i] = { ...rows[i], status: "ok" };
      } else {
        const body = await res.json().catch(() => ({}));
        rows[i] = { ...rows[i], status: "error", error: body.error || "建立失敗" };
      }
    }
    setImportRows(rows);
    setImporting(false);
    reloadAll();
    if (rows.every((r) => r.status === "ok")) {
      setImportPlanId(null);
      setImportRows([]);
    }
  }

  const [exporting, setExporting] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");

  async function submitChangePassword() {
    setPwMsg("");
    if (pwForm.next !== pwForm.confirm) { setPwMsg("兩次輸入的新密碼不一致"); return; }
    const res = await fetch("/api/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
    });
    const body = await res.json();
    if (!res.ok) { setPwMsg(body.error); return; }
    setPwMsg("密碼已更新");
    setPwForm({ current: "", next: "", confirm: "" });
  }

  async function exportDepartmentExcel() {
    setExporting(true);
    setError("");
    try {
      const deptName = depts.find((d) => d.id === selectedDeptId)?.name ?? "";
      const deptItems = items.filter((i) => i.department_id === selectedDeptId);
      const deptPlansAll = plans.filter((p) => p.department_id === selectedDeptId);
      const planName = (planId: string) => deptPlansAll.find((p) => p.id === planId)?.name ?? "";

      const res = await fetch(`/api/transactions?department_id=${selectedDeptId}`);
      const allTx: Tx[] = res.ok ? await res.json() : [];
      const txByItemAll: Record<string, Tx[]> = {};
      for (const t of allTx as any[]) {
        (txByItemAll[t.budget_item_id] ||= []).push(t);
      }

      const overviewRows = [
        ["計畫", "科目", "編列金額", "已用金額", "賸餘金額"],
        ...deptItems.map((i) => [planName(i.plan_id), i.name, i.allocated_amount, Number(i.used_amount), Number(i.remaining_amount)]),
      ];

      const detailRows: (string | number)[][] = [["計畫", "科目", "日期", "摘要", "經手人", "支出金額", "結存餘額", "狀態"]];
      for (const item of deptItems) {
        let bal = item.allocated_amount;
        const txs = (txByItemAll[item.budget_item_id] || []).sort((a, b) => a.tx_date.localeCompare(b.tx_date));
        for (const t of txs) {
          if (!t.voided) bal -= Number(t.amount);
          detailRows.push([
            planName(item.plan_id), item.name, t.tx_date.slice(0, 10), t.note, t.handler_name || "",
            Number(t.amount), t.voided ? "" : bal, t.voided ? `已作廢：${t.voided_reason ?? ""}` : "正常",
          ]);
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewRows), "科目總覽");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "支出明細");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${deptName}_支出明細表_${today}.xlsx`);
    } catch {
      setError("匯出失敗，請再試一次");
    } finally {
      setExporting(false);
    }
  }

  function rocDate(iso: string) {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return `${y - 1911}年${m}月${d}日`;
  }

  async function exportPlanReport(plan: Plan) {
    setError("");
    const res = await fetch(`/api/transactions?plan_id=${plan.id}`);
    if (!res.ok) { setError("匯出失敗，請再試一次"); return; }
    const txs: Tx[] = await res.json();
    const planItems = items.filter((i) => i.plan_id === plan.id);
    const nonVoided = txs.filter((t) => !t.voided);

    const allocated = planItems.reduce((s, i) => s + i.allocated_amount, 0);
    const used = nonVoided.reduce((s, t) => s + Number(t.amount), 0);
    const remaining = allocated - used;

    const rows: (string | number)[][] = [];
    rows.push(["臺北市政府教育局辦理各項活動實際支用明細表"]);
    rows.push([`活動計畫名稱: ${plan.name}`]);
    rows.push([`委託機關編號及名稱:${plan.sponsor_org || ""}`]);
    rows.push(["受託機關編號及名稱:05263臺北市立雙園國中"]);
    rows.push([`經費：原撥${allocated.toLocaleString()}元，實支${used.toLocaleString()}元，節餘${remaining.toLocaleString()}元`]);
    rows.push([`活動結束日:${rocDate(plan.period_end)}`]);
    rows.push(["序號", "年", "月", "日", "受款人", "用途別", "摘要", "金額"]);

    let seq = 1;
    for (const item of planItems) {
      const itemTxs = nonVoided
        .filter((t) => t.budget_item_id === item.budget_item_id)
        .sort((a, b) => a.tx_date.localeCompare(b.tx_date));
      if (itemTxs.length === 0) continue;
      let sub = 0;
      itemTxs.forEach((t, idx) => {
        const [y, m, d] = t.tx_date.slice(0, 10).split("-").map(Number);
        rows.push([seq, y - 1911, m, d, t.handler_name || "", idx === 0 ? item.name : "", t.note, Number(t.amount)]);
        sub += Number(t.amount);
        seq++;
      });
      rows.push(["", "", "", "", "", "", `${item.name}小計`, sub]);
    }
    rows.push(["", "", "", "", "", "", "合　計", used]);
    rows.push(["承辦人", "", "業務主管", "", "主辦會計", "", "機關長官", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"] = [0, 1, 2, 3, 4, 5].map((r) => ({ s: { r, c: 0 }, e: { r, c: 7 } }));
    ws["!cols"] = [{ wch: 6 }, { wch: 6 }, { wch: 5 }, { wch: 5 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "實際支用明細表");
    XLSX.writeFile(wb, `${plan.name}_實際支用明細表.xlsx`);
  }

  if (!me) return <div style={{ padding: 40 }}>載入中…</div>;

  const deptPlans = plans.filter((p) => p.department_id === selectedDeptId);
  const openPlans = deptPlans.filter((p) => p.status === "open");
  const closedPlans = [...deptPlans.filter((p) => p.status === "closed")].sort((a, b) =>
    b.period_end.localeCompare(a.period_end)
  );
  const isLeaderHere = me.role === "leader" && me.department_id === selectedDeptId;

  function renderPlan(plan: Plan, pi: number) {

              const open = expandedPlan === plan.id;
              const locked = plan.status === "closed";
              const planItems = items.filter((i) => i.plan_id === plan.id);
              return (
                <div key={plan.id} style={{ borderTop: pi === 0 ? "none" : `1px solid ${ledgerLine}` }}>
                  <div onClick={() => setExpandedPlan(open ? null : plan.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: pi % 2 ? greenbar : "#fff" }}>
                    <span style={{ padding: "3px 8px", fontSize: 12, fontWeight: 700, border: `2px solid ${locked ? stampGrey : stampGreen}`, color: locked ? stampGrey : stampGreen, borderRadius: 6 }}>
                      {locked ? "已關帳" : "使用中"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{plan.name}</p>
                      <p style={{ fontSize: 12, color: inkSoft, margin: "2px 0 0" }} className="lg-num">
                        {plan.period_type === "academic" ? "學年度" : "曆年制"}｜{plan.period_start?.slice(0, 10)} ～ {plan.period_end?.slice(0, 10)}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); exportPlanReport(plan); }}
                      style={{ fontSize: 12, padding: "4px 10px", border: `1px solid ${stampGold}`, color: stampGold, background: "transparent" }}>
                      📋 支用明細表
                    </button>
                    {isLeaderHere && !locked && (
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(`確定要將「${plan.name}」關帳嗎？`)) closePlan(plan.id); }}
                        style={{ fontSize: 12, padding: "4px 10px", border: `1px solid ${stampRed}`, color: stampRed, background: "transparent" }}>
                        年度關帳
                      </button>
                    )}
                  </div>

                  {open && (
                    <div style={{ padding: "10px 16px 18px", background: pi % 2 ? greenbar : "#fff", borderTop: `1px dashed ${ledgerLine}` }}>
                      {isLeaderHere && !locked && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          <button onClick={() => setShowNewItem(showNewItem === plan.id ? null : plan.id)}
                            style={{ fontSize: 12, padding: "4px 10px", border: `1px solid ${ink}`, background: "transparent" }}>
                            ＋ 新增科目
                          </button>
                          <label style={{ fontSize: 12, padding: "4px 10px", border: `1px solid ${stampGreen}`, color: stampGreen, background: "transparent", cursor: "pointer" }}>
                            📄 上傳經費概算表
                            <input type="file" accept=".xlsx,.xls,.csv,.docx,.pdf,.ods,.odt" style={{ display: "none" }}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(plan.id, f); e.target.value = ""; }} />
                          </label>
                        </div>
                      )}
                      {showNewItem === plan.id && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <input style={{ ...input, flex: 1 }} placeholder="科目名稱" value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} />
                          <input style={{ ...input, width: 120 }} placeholder="編列金額" value={newItem.allocated} onChange={(e) => setNewItem((p) => ({ ...p, allocated: e.target.value }))} />
                          <button onClick={() => createItem(plan.id)} style={{ padding: "6px 14px", background: stampGreen, color: "#fff", border: "none" }}>建立</button>
                        </div>
                      )}

                      {importPlanId === plan.id && (
                        <div style={{ marginBottom: 14, background: "#fff", border: `1px solid ${stampGreen}` }}>
                          <p style={{ fontSize: 12, padding: "8px 12px 0", color: inkSoft }}>
                            從檔案讀到 {importRows.length} 筆，送出前都可以在這裡修改，確認沒問題後按下方「全部建立」寫入。
                          </p>
                          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", margin: "8px 0" }}>
                            <tbody>
                              {importRows.map((r, idx) => (
                                <tr key={idx} style={{ borderBottom: `1px solid ${ledgerLine}` }}>
                                  <td style={{ padding: "4px 8px", width: "50%" }}>
                                    <input style={{ ...input, width: "100%" }} value={r.name} onChange={(e) => updateImportRow(idx, { name: e.target.value })} />
                                  </td>
                                  <td style={{ padding: "4px 8px", width: 130 }}>
                                    <input style={{ ...input, width: "100%" }} value={r.allocated} onChange={(e) => updateImportRow(idx, { allocated: e.target.value })} />
                                  </td>
                                  <td style={{ padding: "4px 8px", fontSize: 11 }}>
                                    {r.status === "ok" && <span style={{ color: stampGreen }}>已建立</span>}
                                    {r.status === "error" && <span style={{ color: stampRed }}>{r.error}</span>}
                                  </td>
                                  <td style={{ padding: "4px 8px", textAlign: "right" }}>
                                    {r.status !== "ok" && (
                                      <button onClick={() => removeImportRow(idx)} style={{ fontSize: 11, border: "none", background: "transparent", color: stampRed, cursor: "pointer" }}>刪除</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ display: "flex", gap: 8, padding: "0 8px 10px" }}>
                            <button onClick={() => setImportRows((p) => [...p, { name: "", allocated: "", status: "pending" }])}
                              style={{ fontSize: 12, padding: "6px 12px", border: `1px solid ${ledgerLine}`, background: "transparent" }}>＋ 新增一列</button>
                            <button disabled={importing} onClick={() => confirmImport(plan.id, plan.department_id)}
                              style={{ fontSize: 12, padding: "6px 14px", background: stampGreen, color: "#fff", border: "none" }}>
                              {importing ? "建立中…" : "全部建立"}
                            </button>
                            <button onClick={() => { setImportPlanId(null); setImportRows([]); }}
                              style={{ fontSize: 12, padding: "6px 14px", border: `1px solid ${ledgerLine}`, background: "transparent" }}>取消</button>
                          </div>
                        </div>
                      )}

                      {planItems.map((item) => {
                        const itemOpen = expandedItem === item.budget_item_id;
                        const remaining = Number(item.remaining_amount);
                        const color = remaining < 0 ? stampRed : remaining < item.allocated_amount * 0.15 ? stampGold : stampGreen;
                        const f = txForm[item.budget_item_id] || { date: "", amount: "", note: "", handler: "" };
                        return (
                          <div key={item.budget_item_id} style={{ background: "#fff", border: `1px solid ${ledgerLine}`, marginBottom: 8 }}>
                            <div onClick={() => { const o = itemOpen ? null : item.budget_item_id; setExpandedItem(o); if (o) loadTx(item.budget_item_id); }}
                              style={{ display: "flex", gap: 12, padding: "10px 12px", cursor: "pointer" }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{item.name}</p>
                                <p style={{ fontSize: 11, color: inkSoft, margin: "2px 0 0" }} className="lg-num">編列 {fmt(item.allocated_amount)}　已用 {fmt(Number(item.used_amount))}</p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <p className="lg-num" style={{ fontWeight: 700, color, margin: 0 }}>{fmt(remaining)}</p>
                                <p style={{ fontSize: 11, color: inkSoft, margin: 0 }}>賸餘</p>
                              </div>
                            </div>
                            {itemOpen && (
                              <div style={{ padding: "0 12px 12px", background: greenbar }}>
                                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 10 }}>
                                  <thead><tr style={{ borderBottom: `1px solid ${ledgerLine}` }}>
                                    <th style={{ textAlign: "left", padding: "6px 4px" }}>日期</th><th style={{ textAlign: "left" }}>摘要</th>
                                    <th style={{ textAlign: "right" }}>金額</th><th></th>
                                  </tr></thead>
                                  <tbody>
                                    {(txByItem[item.budget_item_id] || []).map((t) => (
                                      <tr key={t.id} style={{ borderBottom: `1px solid ${ledgerLine}`, opacity: t.voided ? 0.5 : 1 }}>
                                        <td className="lg-num" style={{ padding: "6px 4px" }}>{t.tx_date.slice(0, 10)}</td>
                                        <td>{t.note}{t.voided && `（已作廢：${t.voided_reason}）`}</td>
                                        <td className="lg-num" style={{ textAlign: "right" }}>{fmt(t.amount)}</td>
                                        <td style={{ textAlign: "right" }}>
                                          {isLeaderHere && !t.voided && (
                                            <button onClick={() => voidTx(t.id, item.budget_item_id)} style={{ fontSize: 11, border: "none", background: "transparent", color: stampRed, cursor: "pointer" }}>作廢</button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {isLeaderHere && !locked && (
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <input type="date" style={input} value={f.date} onChange={(e) => setTxForm((p) => ({ ...p, [item.budget_item_id]: { ...f, date: e.target.value } }))} />
                                    <input style={{ ...input, flex: 1, minWidth: 120 }} placeholder="摘要" value={f.note} onChange={(e) => setTxForm((p) => ({ ...p, [item.budget_item_id]: { ...f, note: e.target.value } }))} />
                                    <input style={{ ...input, width: 90 }} placeholder="經手人" value={f.handler} onChange={(e) => setTxForm((p) => ({ ...p, [item.budget_item_id]: { ...f, handler: e.target.value } }))} />
                                    <input style={{ ...input, width: 100 }} placeholder="金額" value={f.amount} onChange={(e) => setTxForm((p) => ({ ...p, [item.budget_item_id]: { ...f, amount: e.target.value } }))} />
                                    <button onClick={() => submitTx(item)} style={{ padding: "6px 14px", background: ink, color: "#fff", border: "none" }}>登記入帳</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ padding: "24px 40px", borderBottom: `1px solid ${ledgerLine}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: 13, color: stampGold, margin: 0 }}>教務處．經費控帳系統</p>
          <h1 style={{ fontFamily: '"Noto Serif TC", serif', fontSize: 28, margin: "4px 0" }}>教務處經費台帳</h1>
          <p style={{ fontSize: 13, color: inkSoft }}>{me.name}（{me.role === "director" ? "教務主任" : me.department_name}）</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {me.role === "director" && (
            <button onClick={() => { setShowUsers((v) => !v); if (!showUsers) loadUsers(); }} style={{ padding: "8px 14px", border: `1px solid ${ink}`, background: "transparent" }}>
              帳號管理
            </button>
          )}
          <button onClick={() => setShowChangePw((v) => !v)} style={{ padding: "8px 14px", border: `1px solid ${ledgerLine}`, background: "transparent" }}>
            修改密碼
          </button>
          <button onClick={logout} style={{ padding: "8px 14px", border: `1px solid ${ledgerLine}`, background: "transparent" }}>登出</button>
        </div>
      </div>

      {showChangePw && (
        <div style={{ margin: "16px 40px", padding: 16, background: "#fff", border: `1px solid ${ledgerLine}`, maxWidth: 360 }}>
          <p style={{ fontWeight: 600, marginBottom: 10 }}>修改密碼</p>
          <input type="password" placeholder="目前密碼" style={{ ...input, display: "block", width: "100%", marginBottom: 8 }}
            value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} />
          <input type="password" placeholder="新密碼（至少 6 碼）" style={{ ...input, display: "block", width: "100%", marginBottom: 8 }}
            value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} />
          <input type="password" placeholder="再輸入一次新密碼" style={{ ...input, display: "block", width: "100%", marginBottom: 10 }}
            value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} />
          {pwMsg && <p style={{ fontSize: 13, color: pwMsg === "密碼已更新" ? stampGreen : stampRed, marginBottom: 10 }}>{pwMsg}</p>}
          <button onClick={submitChangePassword} style={{ padding: "8px 16px", background: ink, color: "#fff", border: "none" }}>更新密碼</button>
        </div>
      )}

      {error && <div style={{ margin: "16px 40px", padding: 10, background: "#FBEAE8", color: stampRed, fontSize: 13 }}>{error}</div>}

      {showUsers && me.role === "director" && (
        <div style={{ margin: "16px 40px", padding: 16, background: "#fff", border: `1px solid ${ledgerLine}` }}>
          <p style={{ fontWeight: 600, marginBottom: 10 }}>建立組長帳號</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <input style={input} placeholder="姓名" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
            <input style={input} placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <select style={input} value={newUser.department_id} onChange={(e) => setNewUser((p) => ({ ...p, department_id: e.target.value }))}>
              <option value="">選擇組別</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button onClick={createUser} style={{ padding: "6px 14px", background: stampGreen, color: "#fff", border: "none" }}>建立</button>
          </div>
          {createdPassword && (
            <p style={{ fontSize: 13, background: greenbar, padding: 10, marginBottom: 14 }}>
              {createdPassword.email} 的密碼：<b className="lg-num">{createdPassword.password}</b>（請直接告訴這位使用者，畫面關閉後不會再顯示）
            </p>
          )}
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${ledgerLine}` }}>
              <th style={{ textAlign: "left", padding: 6 }}>姓名</th><th style={{ textAlign: "left" }}>Email</th>
              <th style={{ textAlign: "left" }}>角色</th><th style={{ textAlign: "left" }}>狀態</th><th></th>
            </tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${ledgerLine}`, opacity: u.active === false ? 0.5 : 1 }}>
                <td style={{ padding: 6 }}>{u.name}</td><td>{u.email}</td>
                <td>{u.role === "director" ? "教務主任" : "組長"}</td>
                <td style={{ color: u.active === false ? stampRed : stampGreen }}>{u.active === false ? "已停用" : "使用中"}</td>
                <td style={{ textAlign: "right" }}>
                  {u.role === "leader" && (
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => resetPassword(u.id)} style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${ledgerLine}`, background: "transparent", cursor: "pointer" }}>重設密碼</button>
                      <button onClick={() => toggleActive(u.id, u.active === false)}
                        style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${u.active === false ? stampGreen : stampRed}`, color: u.active === false ? stampGreen : stampRed, background: "transparent", cursor: "pointer" }}>
                        {u.active === false ? "啟用" : "停用"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex" }}>
        <div style={{ width: 200, borderRight: `1px solid ${ledgerLine}` }}>
          {depts.map((d) => (
            <button key={d.id} onClick={() => setSelectedDeptId(d.id)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none",
                borderBottom: `1px solid ${ledgerLine}`, borderLeft: d.id === selectedDeptId ? `3px solid ${stampGreen}` : "3px solid transparent",
                background: d.id === selectedDeptId ? "#EFE9D8" : "transparent", cursor: "pointer" }}>
              {d.name}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: "24px 40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: '"Noto Serif TC", serif', fontSize: 20 }}>{depts.find((d) => d.id === selectedDeptId)?.name}</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportDepartmentExcel} disabled={exporting}
                style={{ padding: "8px 14px", border: `1px solid ${stampGreen}`, color: stampGreen, background: "transparent" }}>
                {exporting ? "匯出中…" : "⬇ 匯出 Excel"}
              </button>
              {isLeaderHere && (
                <button onClick={() => setShowNewPlan((v) => !v)} style={{ padding: "8px 14px", border: `1px solid ${ink}`, background: "transparent" }}>
                  ＋ 新增經費計畫
                </button>
              )}
            </div>
          </div>

          {showNewPlan && (
            <div style={{ marginBottom: 20, padding: 14, background: "#fff", border: `1px solid ${ledgerLine}` }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={{ ...input, flex: 1 }} placeholder="計畫名稱" value={newPlan.name} onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))} />
                <select style={input} value={newPlan.periodType} onChange={(e) => setNewPlan((p) => ({ ...p, periodType: e.target.value as "calendar" | "academic" }))}>
                  <option value="calendar">曆年制（1/1–12/31）</option>
                  <option value="academic">學年度（8/1–次年7/31）</option>
                </select>
                <input style={{ ...input, width: 110 }} placeholder={newPlan.periodType === "academic" ? "起始西元年" : "會計年度"} value={newPlan.year} onChange={(e) => setNewPlan((p) => ({ ...p, year: e.target.value }))} />
                <button onClick={createPlan} style={{ padding: "6px 14px", background: stampGreen, color: "#fff", border: "none" }}>建立</button>
              </div>
              <input style={{ ...input, width: "100%", marginBottom: 8 }} placeholder="委託機關編號及名稱（選填，例如：05001教育局）"
                value={newPlan.sponsorOrg} onChange={(e) => setNewPlan((p) => ({ ...p, sponsorOrg: e.target.value }))} />
              <p style={{ fontSize: 12, color: inkSoft, margin: 0 }}>
                {newPlan.periodType === "academic"
                  ? `學年度請填「開始那一年」的西元年，例如 114 學年度（2025/8/1–2026/7/31）請填 2025。`
                  : `曆年制請填會計年度的西元年，例如 115 年度（2026/1/1–2026/12/31）請填 2026。`}
              </p>
            </div>
          )}

          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>使用中計畫</h3>
          <div style={{ border: `1px solid ${ledgerLine}`, marginBottom: 28 }}>
            {openPlans.map(renderPlan)}
            {openPlans.length === 0 && <div style={{ padding: 20, textAlign: "center", color: inkSoft, fontSize: 13 }}>目前沒有使用中的計畫</div>}
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: inkSoft }}>已關帳計畫</h3>
          <div style={{ border: `1px solid ${ledgerLine}` }}>
            {closedPlans.map(renderPlan)}
            {closedPlans.length === 0 && <div style={{ padding: 20, textAlign: "center", color: inkSoft, fontSize: 13 }}>目前沒有已關帳的計畫</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
