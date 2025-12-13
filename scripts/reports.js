document.addEventListener("DOMContentLoaded", async () => {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  window.__API_TOKEN = token;

  // Today pill
  setTodayPill();

  // Apply button
  document
    .getElementById("apply-filters-btn")
    .addEventListener("click", () => loadDashboard(token));

  // Export team summary
  document
    .getElementById("export-team-btn")
    .addEventListener("click", () => exportTeamSummaryExcel(token));

  // Initial load (default: this month)
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

/**
 * This Month:
 *   start = 1st day of current month
 *   end   = last day of current month
 *
 * This Year:
 *   start = Jan 1
 *   end   = Dec 31
 *
 * NOTE: your backend treats end_date (YYYY-MM-DD) as end-of-day exclusive by adding +1 day
 * when it's a date-only string. So passing the LAST DAY works perfectly.
 */
function getRange(periodKey) {
  const now = new Date();
  if (periodKey === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start, end };
  }

  // default month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

function getPreviousRange(periodKey) {
  const now = new Date();

  if (periodKey === "year") {
    const y = now.getFullYear() - 1;
    return {
      start: new Date(y, 0, 1),
      end: new Date(y, 11, 31),
    };
  }

  // previous month
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start = new Date(
    prevMonthDate.getFullYear(),
    prevMonthDate.getMonth(),
    1
  );
  const end = new Date(
    prevMonthDate.getFullYear(),
    prevMonthDate.getMonth() + 1,
    0
  );
  return { start, end };
}

function setRangeLabel(periodKey, start, end) {
  const el = document.getElementById("range-label");
  if (!el) return;

  const label =
    periodKey === "year"
      ? `This year (${formatYYYYMMDD(start)} → ${formatYYYYMMDD(end)})`
      : `This month (${formatYYYYMMDD(start)} → ${formatYYYYMMDD(end)})`;

  el.textContent = label;
}

function pctChange(current, previous) {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  if (p <= 0) {
    // If previous is 0, treat any current > 0 as +100%, else 0%
    return c > 0 ? 100 : 0;
  }
  return ((c - p) / p) * 100;
}

function setTrend(elRootId, pct) {
  const root = document.getElementById(elRootId);
  const textEl = document.getElementById(`${elRootId}-text`);
  if (!root || !textEl) return;

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
  const text = document.getElementById("trend-target-text");
  if (!badge || !text) return;

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

function extractUsers(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.users)) return payload.users;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.users_data)) return payload.users_data;
  return [];
}

function getJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
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

async function getVisitsTotal(token, startDate, endDate, userId = null) {
  const params = {
    start_date: startDate,
    end_date: endDate,
    limit: 1,
  };
  if (userId !== null) params.user_id = userId;

  const { res, data } = await apiGet("/visits", token, params);
  if (!res.ok) return 0;

  // visits endpoint returns: { page, limit, total, count, visits }
  if (data && typeof data.total === "number") return data.total;
  return 0;
}

async function getCustomersTotal(token) {
  // customers endpoint in your backend is paginated. We only need total.
  const { res, data } = await apiGet("/customers", token, {
    page: 1,
    limit: 1,
  });
  if (!res.ok) return 0;

  if (data && typeof data.total === "number") return data.total;

  // fallback
  if (data && Array.isArray(data.data)) return data.data.length;
  return 0;
}

async function loadDashboard(token) {
  Utils.UI.hideError?.("error-message");

  const periodKey =
    document.getElementById("date-range-filter").value || "month";
  const range = getRange(periodKey);
  const prevRange = getPreviousRange(periodKey);

  const startDate = formatYYYYMMDD(range.start);
  const endDate = formatYYYYMMDD(range.end);

  const prevStart = formatYYYYMMDD(prevRange.start);
  const prevEnd = formatYYYYMMDD(prevRange.end);

  setRangeLabel(periodKey, range.start, range.end);

  // ----- Main numbers -----
  // Target & Collected are mock (0)
  const targetPct = 0;
  document.getElementById("target-achieved").innerHTML = `${targetPct.toFixed(
    1
  )}<span class="unit">%</span>`;
  document.getElementById("collected-amounts").textContent = "EGP 0.00";

  // Visits total (team scope by default based on backend permissions)
  const [visitsThis, visitsPrev] = await Promise.all([
    getVisitsTotal(token, startDate, endDate),
    getVisitsTotal(token, prevStart, prevEnd),
  ]);

  document.getElementById("visits-count").textContent = String(visitsThis);

  // Trend indicator: use visits comparison (this vs previous period)
  const visitsPct = pctChange(visitsThis, visitsPrev);
  setTrend("trend-visits", visitsPct);
  setBadgeTrend(visitsPct);

  // Customers linked (not truly date-based in current backend; showing total accessible)
  const customersTotal = await getCustomersTotal(token);
  document.getElementById("customers-linked").textContent =
    String(customersTotal);

  // Trend placeholders for endpoints not present
  setTrend("trend-collected", 0);
  // linked "trend" as numeric delta (keep simple)
  const linkedTrendEl = document.getElementById("trend-linked");
  const linkedTrendTextEl = document.getElementById("trend-linked-text");
  if (linkedTrendEl && linkedTrendTextEl) {
    linkedTrendEl.classList.add("trend-up");
    linkedTrendEl.innerHTML = `<i class="fa-solid fa-minus"></i> <span id="trend-linked-text">0</span>`;
  }

  // ----- Team breakdown -----
  await loadTeamBreakdown(token, startDate, endDate);
}

async function loadTeamBreakdown(token, startDate, endDate) {
  const teamSection = document.getElementById("team-section");
  const tbody = document.getElementById("team-table-body");
  tbody.innerHTML = "";

  // Determine admin quickly (JWT payload usually has identity; fallback to /checklogin)
  let isAdmin = false;
  const payload = getJwtPayload(token);
  if (payload && payload.sub && typeof payload.sub === "object") {
    // flask_jwt_extended commonly stores identity in "sub"
    isAdmin = !!payload.sub.admin;
  }

  if (!isAdmin) {
    const check = await apiGet("/checklogin", token);
    if (check.res.ok && check.data && check.data.admin !== undefined) {
      isAdmin = !!check.data.admin;
    }
  }

  // Fetch accessible users (for manager this should be subordinates; for admin = all)
  const { res, data } = await apiGet("/users", token);
  if (!res.ok) {
    teamSection.style.display = "none";
    Utils.UI.showError?.("Failed to load team users.", "error-message");
    return;
  }

  const users = extractUsers(data);

  // Decide if team exists:
  // - Admin: always show
  // - Non-admin: show if more than 1 user returned (self + at least one subordinate)
  const hasTeam = isAdmin ? users.length > 0 : users.length > 1;

  if (!hasTeam) {
    teamSection.style.display = "none";
    return;
  }

  teamSection.style.display = "block";

  // Build per-user visits totals (parallel with a small concurrency cap)
  const normalized = users
    .map((u) => ({
      user_id: u.user_id ?? u.id ?? u.userId ?? null,
      username: u.username ?? u.name ?? u.user_name ?? "unknown",
    }))
    .filter((u) => u.user_id !== null);

  const results = await mapWithConcurrency(normalized, 6, async (u) => {
    const visits = await getVisitsTotal(token, startDate, endDate, u.user_id);
    return { ...u, visits };
  });

  // Sort by visits desc
  results.sort((a, b) => (b.visits || 0) - (a.visits || 0));

  // Render rows
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
      <td>${u.visits || 0}</td>
      <td>EGP 0.00</td>
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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function exportTeamSummaryExcel(token) {
  try {
    const periodKey =
      document.getElementById("date-range-filter").value || "month";
    const range = getRange(periodKey);

    const startDate = formatYYYYMMDD(range.start);
    const endDate = formatYYYYMMDD(range.end);

    const params = new URLSearchParams();
    params.append("start_date", startDate);
    params.append("end_date", endDate);

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
    const now = new Date().toISOString().replace(/[:.-]/g, "").slice(0, 15); // YYYYMMDDTHHMMSS
    // Try to use filename from Content-Disposition
    let filename = "subordinates_summary" + now + ".xlsx";
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
    if (match) {
      filename = decodeURIComponent(match[1] || match[2] || filename);
    }

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
