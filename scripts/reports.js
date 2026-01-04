// reports.js (full updated file)

document.addEventListener("DOMContentLoaded", async () => {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  window.__API_TOKEN = token;

  setTodayPill();
  initDateInputs(); // ✅ new

  const applyBtn = document.getElementById("apply-filters-btn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => loadDashboard(token));
  }

  const exportBtn = document.getElementById("export-team-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportTeamSummaryExcel(token));
  }

  await loadDashboard(token);
});

const BASE_URL = "https://order-app.gemegypt.net/api";

function setTodayPill() {
  const el = document.getElementById("today-pill");
  if (!el) return;

  const d = new Date();
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  el.innerHTML = `<i class="fa-regular fa-calendar"></i> Today · ${day} ${month} ${year}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYYYYMMDD(dateObj) {
  const y = dateObj.getFullYear();
  const m = pad2(dateObj.getMonth() + 1);
  const d = pad2(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

function parseYYYYMMDD(s) {
  const str = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfThisMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * ✅ Initialize the date inputs to "this month → today" if empty
 * (You can change it to full month end if you prefer.)
 */
function initDateInputs() {
  const startEl = document.getElementById("dateStart");
  const endEl = document.getElementById("dateEnd");
  if (!startEl || !endEl) return;

  if (!startEl.value) startEl.value = formatYYYYMMDD(startOfThisMonth());
  if (!endEl.value) endEl.value = formatYYYYMMDD(todayDate());
}

/**
 * ✅ Read selected range from inputs, with safe fallback to "this month → today"
 */
function getSelectedRange() {
  const startEl = document.getElementById("dateStart");
  const endEl = document.getElementById("dateEnd");

  let startStr = (startEl?.value || "").trim();
  let endStr = (endEl?.value || "").trim();

  let start = parseYYYYMMDD(startStr);
  let end = parseYYYYMMDD(endStr);

  if (!start || !end) {
    start = startOfThisMonth();
    end = todayDate();
    startStr = formatYYYYMMDD(start);
    endStr = formatYYYYMMDD(end);

    if (startEl) startEl.value = startStr;
    if (endEl) endEl.value = endStr;
  }

  // if user picks reversed, swap
  if (start.getTime() > end.getTime()) {
    const tmp = start;
    start = end;
    end = tmp;
    startStr = formatYYYYMMDD(start);
    endStr = formatYYYYMMDD(end);
    if (startEl) startEl.value = startStr;
    if (endEl) endEl.value = endStr;
  }

  return {
    start,
    end,
    startStr: formatYYYYMMDD(start),
    endStr: formatYYYYMMDD(end),
  };
}

/**
 * ✅ Previous range with SAME length as selected range:
 * prevEnd = day before start, prevStart = prevEnd - (len-1 days)
 */
function getPreviousSameLengthRange(start, end) {
  const msDay = 24 * 60 * 60 * 1000;
  const lenDays = Math.round((end.getTime() - start.getTime()) / msDay) + 1;

  const prevEnd = new Date(start.getTime() - msDay);
  const prevStart = new Date(prevEnd.getTime() - (lenDays - 1) * msDay);

  return { prevStart, prevEnd };
}

function setRangeLabel(startStr, endStr) {
  const el = document.getElementById("range-label");
  if (!el) return;
  el.textContent = `${startStr} → ${endStr}`;
}

function pctChange(current, previous) {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  if (p <= 0) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
}

function setTrend(elRootId, pct) {
  const root = document.getElementById(elRootId);
  if (!root) return;

  const value = Number.isFinite(pct) ? pct : 0;
  const isUp = value >= 0;

  root.classList.remove("trend-up", "trend-down");
  root.classList.add(isUp ? "trend-up" : "trend-down");

  const icon = isUp
    ? `<i class="fa-solid fa-arrow-up"></i>`
    : `<i class="fa-solid fa-arrow-down"></i>`;

  root.innerHTML = `${icon} <span id="${elRootId}-text">${value.toFixed(
    1
  )}%</span>`;
}

function setBadgeTrend(pct) {
  const badge = document.getElementById("trend-target-badge");
  if (!badge) return;

  const value = Number.isFinite(pct) ? pct : 0;
  const isUp = value >= 0;

  badge.innerHTML = `${
    isUp
      ? `<i class="fa-solid fa-arrow-trend-up"></i>`
      : `<i class="fa-solid fa-arrow-trend-down"></i>`
  } <span id="trend-target-text">${value.toFixed(1)}% vs previous</span>`;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function apiGet(path, token, params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.append(k, v);
  });

  const url = `${BASE_URL}${path}${usp.toString() ? `?${usp.toString()}` : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return { res, data: await safeJson(res) };
}

/**
 * Get visits count (from data.total) + sum(amount) by paging through visits.
 * We page because /visits doesn't return a SUM.
 */
async function getVisitStats(token, startDate, endDate, userId = null) {
  const limit = 200;
  let page = 1;

  let total = 0;
  let amountSum = 0;

  while (true) {
    const params = {
      start_date: startDate,
      end_date: endDate,
      page,
      limit,
    };
    if (userId !== null) params.user_id = userId;

    const { res, data } = await apiGet("/visits", token, params);
    if (!res.ok || !data) break;

    if (page === 1) total = Number(data.total || 0);

    const visits = Array.isArray(data.visits) ? data.visits : [];
    for (const v of visits) {
      const a = Number(v.amount || 0);
      if (!Number.isNaN(a)) amountSum += a;
    }

    if (page * limit >= total) break;
    if (visits.length < limit) break;

    page += 1;
    if (page > 200) break;
  }

  return { total, amountSum };
}

async function getCustomersTotal(token) {
  const { res, data } = await apiGet("/customers", token, {
    page: 1,
    limit: 1,
  });
  if (!res.ok) return 0;
  if (data && typeof data.total === "number") return data.total;
  if (data && Array.isArray(data.data)) return data.data.length;
  return 0;
}

function extractUsers(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.users)) return payload.users;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadDashboard(token) {
  Utils.UI.hideError?.("error-message");

  // ✅ Use dashboard-like date inputs
  const { start, end, startStr, endStr } = getSelectedRange();
  setRangeLabel(startStr, endStr);

  // previous same-length range
  const { prevStart, prevEnd } = getPreviousSameLengthRange(start, end);
  const prevStartStr = formatYYYYMMDD(prevStart);
  const prevEndStr = formatYYYYMMDD(prevEnd);

  // ---- Target (mock) ----
  const targetPct = 0;
  const targetEl = document.getElementById("target-achieved");
  if (targetEl) {
    targetEl.innerHTML = `${targetPct.toFixed(1)}<span class="unit">%</span>`;
  }

  // ---- Main stats: visits + collected (sum amount) ----
  const [thisStats, prevStats] = await Promise.all([
    getVisitStats(token, startStr, endStr),
    getVisitStats(token, prevStartStr, prevEndStr),
  ]);

  const visitsThis = thisStats.total || 0;
  const visitsPrev = prevStats.total || 0;

  const amountThis = thisStats.amountSum || 0;
  const amountPrev = prevStats.amountSum || 0;

  const visitsEl = document.getElementById("visits-count");
  if (visitsEl) visitsEl.textContent = String(visitsThis);

  const collectedEl = document.getElementById("collected-amounts");
  if (collectedEl) collectedEl.textContent = Utils.Format.currency(amountThis);

  // trends
  setTrend("trend-visits", pctChange(visitsThis, visitsPrev));
  setTrend("trend-collected", pctChange(amountThis, amountPrev));

  // Badge trend (keep using visits trend for now)
  setBadgeTrend(pctChange(visitsThis, visitsPrev));

  // ---- customers linked ----
  const customersTotal = await getCustomersTotal(token);
  const customersEl = document.getElementById("customers-linked");
  if (customersEl) customersEl.textContent = String(customersTotal);

  // linked trend placeholder
  const linkedTrendEl = document.getElementById("trend-linked");
  if (linkedTrendEl) {
    linkedTrendEl.classList.add("trend-up");
    linkedTrendEl.innerHTML = `<i class="fa-solid fa-minus"></i> <span id="trend-linked-text">0</span>`;
  }

  // ---- team breakdown ----
  await loadTeamBreakdown(token, startStr, endStr);
}

async function loadTeamBreakdown(token, startDate, endDate) {
  const tbody = document.getElementById("team-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  const { res, data } = await apiGet("/users", token);
  if (!res.ok) {
    Utils.UI.showError?.("Failed to load team users.", "error-message");
    return;
  }

  const users = extractUsers(data);

  const normalized = users
    .map((u) => ({
      user_id: u.user_id ?? u.id ?? null,
      username: u.username ?? u.name ?? "unknown",
    }))
    .filter((u) => u.user_id !== null);

  if (normalized.length === 0) return;

  const results = await mapWithConcurrency(normalized, 4, async (u) => {
    const stats = await getVisitStats(token, startDate, endDate, u.user_id);
    return {
      ...u,
      visits: stats.total || 0,
      collected: stats.amountSum || 0,
    };
  });

  results.sort((a, b) => (b.visits || 0) - (a.visits || 0));

  for (const u of results) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-meta">
            <span class="user-name">${escapeHtml(u.username)}</span>
          </div>
        </div>
      </td>
      <td>0.0%</td>
      <td>${u.visits}</td>
      <td>${Utils.Format.currency(u.collected)}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;

  async function runner() {
    while (true) {
      const current = idx++;
      if (current >= items.length) break;
      results[current] = await worker(items[current]);
    }
  }

  const runners = [];
  const n = Math.min(concurrency, items.length);
  for (let i = 0; i < n; i++) runners.push(runner());
  await Promise.all(runners);
  return results;
}

async function exportTeamSummaryExcel(token) {
  try {
    const { startStr, endStr } = getSelectedRange();

    const params = new URLSearchParams();
    params.append("start_date", startStr);
    params.append("end_date", endStr);

    const url = `${BASE_URL}/visits/report/subordinates-summary/excel?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.message || "Export failed");
    }

    const blob = await res.blob();

    let filename = `team_summary_${startStr}_to_${endStr}.xlsx`;
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
    if (match) filename = decodeURIComponent(match[1] || match[2] || filename);

    const URLobj = window.URL || window.webkitURL;
    if (URLobj && typeof URLobj.createObjectURL === "function") {
      const dlUrl = URLobj.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URLobj.revokeObjectURL(dlUrl);
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        const a = document.createElement("a");
        a.href = reader.result;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      reader.readAsDataURL(blob);
    }
  } catch (e) {
    Utils.UI.showError?.(String(e.message || e), "error-message");
    console.error(e);
  }
}
