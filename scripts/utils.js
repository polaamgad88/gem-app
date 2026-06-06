/**
 * Shared utilities for GEM dashboard.
 *
 * Exposes window.Utils with namespaces:
 *   Auth, UI, Format, URL, Api, Cache, Async, DOM
 */
(function () {
  "use strict";

  const API_BASE = "https://order-app.gemegypt.net/api";

  // ────────────────────────────────────────────────────────────────────────────
  // Async helpers
  // ────────────────────────────────────────────────────────────────────────────

  /** Debounce: delays fn until `wait` ms passed since last call. */
  function debounce(fn, wait = 250) {
    let t;
    const debounced = function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
    debounced.cancel = () => clearTimeout(t);
    return debounced;
  }

  /** Throttle: at most one call per `wait` ms (leading + trailing). */
  function throttle(fn, wait = 200) {
    let last = 0;
    let timer;
    let lastArgs;
    return function (...args) {
      const now = Date.now();
      lastArgs = args;
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, lastArgs);
        }, remaining);
      }
    };
  }

  /** Sleep helper. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const Async = { debounce, throttle, sleep };

  // ────────────────────────────────────────────────────────────────────────────
  // Cache (in-memory + localStorage with TTL)
  // ────────────────────────────────────────────────────────────────────────────

  const memCache = new Map();
  const inflight = new Map(); // url → Promise (dedupes concurrent GETs)

  function cacheKey(url, opts) {
    return `${opts?.method || "GET"} ${url}`;
  }

  const Cache = {
    /** Get + parse from localStorage, returns null if expired or missing. */
    getLS(key) {
      try {
        const raw = localStorage.getItem(`cache:${key}`);
        if (!raw) return null;
        const { v, exp } = JSON.parse(raw);
        if (exp && Date.now() > exp) {
          localStorage.removeItem(`cache:${key}`);
          return null;
        }
        return v;
      } catch {
        return null;
      }
    },
    setLS(key, value, ttlMs = 5 * 60 * 1000) {
      try {
        localStorage.setItem(
          `cache:${key}`,
          JSON.stringify({ v: value, exp: Date.now() + ttlMs })
        );
      } catch {
        /* quota / serialization — silent */
      }
    },
    delLS(key) {
      try {
        localStorage.removeItem(`cache:${key}`);
      } catch {
        /* noop */
      }
    },
    getMem(key) {
      const e = memCache.get(key);
      if (!e) return null;
      if (e.exp && Date.now() > e.exp) {
        memCache.delete(key);
        return null;
      }
      return e.v;
    },
    setMem(key, value, ttlMs = 60 * 1000) {
      memCache.set(key, { v: value, exp: Date.now() + ttlMs });
    },
    delMem(key) {
      memCache.delete(key);
    },
    clearMem() {
      memCache.clear();
    },
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Api: fetch wrapper with auth + retry + timeout + abort
  // ────────────────────────────────────────────────────────────────────────────

  class ApiError extends Error {
    constructor(message, { status, data, url } = {}) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
      this.url = url;
    }
  }

  function resolveUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE}${path.startsWith("/") ? path : "/" + path}`;
  }

  function buildHeaders(opts) {
    const headers = new Headers(opts.headers || {});
    if (!opts._skipAuth) {
      const token = localStorage.getItem("access_token");
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
    if (opts.body && !headers.has("Content-Type")) {
      if (opts.body instanceof FormData) {
        // browser sets multipart boundary
      } else if (opts.body instanceof URLSearchParams) {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
      } else {
        headers.set("Content-Type", "application/json");
      }
    }
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    return headers;
  }

  /**
   * Smart fetch: auto auth header, JSON encode body, retry transient errors,
   * timeout via AbortController, parse JSON response.
   *
   * @param {string} path Endpoint path or full URL.
   * @param {object} [opts]
   * @param {string} [opts.method] HTTP method (default GET).
   * @param {any}    [opts.body]   Auto-stringified unless FormData.
   * @param {object} [opts.query]  Query params object.
   * @param {number} [opts.timeout] Ms, default 30000.
   * @param {number} [opts.retries] On 5xx/network, default 2.
   * @param {AbortSignal} [opts.signal] External signal.
   * @param {boolean} [opts.raw]  If true, return Response instead of parsed JSON.
   * @returns {Promise<any>}
   */
  async function request(path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase();
    let url = resolveUrl(path);

    if (opts.query && Object.keys(opts.query).length) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined || v === null || v === "") continue;
        qs.append(k, v);
      }
      const sep = url.includes("?") ? "&" : "?";
      url += sep + qs.toString();
    }

    let bodyData = opts.body;
    // Form-encoded mode: serialize plain object to URLSearchParams.
    if (opts.form && bodyData && !(bodyData instanceof FormData) && !(bodyData instanceof URLSearchParams) && typeof bodyData !== "string") {
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(bodyData)) {
        if (v === undefined || v === null) continue;
        usp.append(k, typeof v === "boolean" ? (v ? "on" : "") : v);
      }
      bodyData = usp;
    }

    const headers = buildHeaders({ ...opts, body: bodyData });
    const body =
      bodyData && !(bodyData instanceof FormData) && !(bodyData instanceof URLSearchParams) && typeof bodyData !== "string"
        ? JSON.stringify(bodyData)
        : bodyData;

    const retries = Number.isFinite(opts.retries) ? opts.retries : 2;
    const timeoutMs = opts.timeout ?? 30000;

    let attempt = 0;
    let lastErr;

    while (attempt <= retries) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      if (opts.signal) {
        if (opts.signal.aborted) ctrl.abort();
        else opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
      }

      try {
        const res = await fetch(url, {
          method,
          headers,
          body,
          signal: ctrl.signal,
          credentials: opts.credentials,
        });
        clearTimeout(timer);

        if (res.status === 401 && !opts._skipAuth) {
          localStorage.removeItem("access_token");
          if (!window.location.pathname.endsWith("login.html")) {
            window.location.href = "login.html";
          }
          throw new ApiError("Unauthorized", { status: 401, url });
        }

        if (opts.raw) return res;

        const contentType = res.headers.get("content-type") || "";
        let data = null;
        if (res.status !== 204) {
          if (contentType.includes("application/json")) {
            data = await res.json().catch(() => null);
          } else {
            data = await res.text().catch(() => null);
          }
        }

        if (!res.ok) {
          if (res.status >= 500 && attempt < retries) {
            attempt++;
            await sleep(300 * Math.pow(2, attempt));
            continue;
          }
          const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
          throw new ApiError(msg, { status: res.status, data, url });
        }

        return data;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        if (err.name === "AbortError" && !opts.signal?.aborted) {
          // local timeout — retry
          if (attempt < retries) {
            attempt++;
            await sleep(300 * Math.pow(2, attempt));
            continue;
          }
          throw new ApiError("Request timed out", { url });
        }
        if (err instanceof ApiError) throw err;
        // network error — retry once
        if (attempt < retries) {
          attempt++;
          await sleep(300 * Math.pow(2, attempt));
          continue;
        }
        throw new ApiError(err.message || "Network error", { url });
      }
    }
    throw lastErr;
  }

  /** GET with response cached in-memory by URL (ttl default 60s, set to 0 to bypass). */
  async function getCached(path, opts = {}) {
    const url = resolveUrl(path);
    const queryStr = opts.query
      ? "?" + new URLSearchParams(opts.query).toString()
      : "";
    const key = `GET ${url}${queryStr}`;
    const ttl = opts.cacheTtl ?? 60 * 1000;

    if (ttl > 0) {
      const hit = Cache.getMem(key);
      if (hit !== null) return hit;
    }

    // dedupe concurrent identical requests
    if (inflight.has(key)) return inflight.get(key);

    const p = request(path, { ...opts, method: "GET" })
      .then((data) => {
        if (ttl > 0) Cache.setMem(key, data, ttl);
        return data;
      })
      .finally(() => inflight.delete(key));

    inflight.set(key, p);
    return p;
  }

  /** Invalidate cached GETs whose key includes any of the given path fragments. */
  function invalidate(...fragments) {
    for (const key of memCache.keys()) {
      if (fragments.some((f) => key.includes(f))) memCache.delete(key);
    }
  }

  const Api = {
    base: API_BASE,
    request,
    get: (path, opts) => request(path, { ...opts, method: "GET" }),
    getCached,
    post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
    /** POST with application/x-www-form-urlencoded body (matches backend `request.form` endpoints). */
    postForm: (path, body, opts) =>
      request(path, { ...opts, method: "POST", body, form: true }),
    patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
    put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
    del: (path, opts) => request(path, { ...opts, method: "DELETE" }),
    invalidate,
    ApiError,
  };

  // ────────────────────────────────────────────────────────────────────────────
  // DOM helpers
  // ────────────────────────────────────────────────────────────────────────────

  /** Build a DocumentFragment from an HTML string. Faster than innerHTML in loops. */
  function fragmentFromHtml(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    return tpl.content;
  }

  /** Replace child contents of `el` with array items mapped through `renderFn`. */
  function replaceChildren(el, items, renderFn) {
    if (!el) return;
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const node = renderFn(item);
      if (!node) continue;
      if (typeof node === "string") {
        frag.appendChild(fragmentFromHtml(node));
      } else {
        frag.appendChild(node);
      }
    }
    el.replaceChildren(frag);
  }

  /** Event delegation: bind ONE listener on container, fire when target matches selector. */
  function delegate(container, eventType, selector, handler) {
    if (!container) return () => {};
    const wrapped = (e) => {
      const match = e.target.closest(selector);
      if (match && container.contains(match)) {
        handler(e, match);
      }
    };
    container.addEventListener(eventType, wrapped);
    return () => container.removeEventListener(eventType, wrapped);
  }

  /** Escape HTML for safe insertion. */
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const DOM = { fragmentFromHtml, replaceChildren, delegate, escapeHtml };

  // ────────────────────────────────────────────────────────────────────────────
  // Auth (re-uses Api wrapper)
  // ────────────────────────────────────────────────────────────────────────────

  const Auth = {
    async checkLogin() {
      const token = localStorage.getItem("access_token");
      if (!token) return false;
      try {
        await Api.get("/checklogin", { retries: 0, timeout: 10000 });
        return true;
      } catch (err) {
        if (err.status === 401) return false;
        console.error("Login check failed:", err);
        return false;
      }
    },

    async requireAuth() {
      const token = localStorage.getItem("access_token");
      if (!token || !(await this.checkLogin())) {
        window.location.href = "login.html";
        return null;
      }
      return token;
    },

    async logout() {
      try {
        await Api.get("/logout", { retries: 0, timeout: 10000 });
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        localStorage.clear();
      }
      return true;
    },

    token() {
      return localStorage.getItem("access_token");
    },

    region() {
      return (localStorage.getItem("region") || "cairo").toLowerCase();
    },

    isAlex() {
      return this.region() === "alex";
    },
  };

  // ────────────────────────────────────────────────────────────────────────────
  // UI helpers
  // ────────────────────────────────────────────────────────────────────────────

  const UI = {
    showLoader(id = "loader") {
      const el = document.getElementById(id);
      if (el) el.style.display = "block";
    },
    hideLoader(id = "loader") {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    },
    showError(message, id = "error-message") {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = message;
        el.style.display = "block";
      } else {
        alert(message);
      }
    },
    hideError(id = "error-message") {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    },
    checkScreenSize() {
      const tableView = document.querySelector(".table-responsive");
      const cardView = document.querySelector(".card-view");
      if (!tableView || !cardView) return;
      if (window.innerWidth < 768) {
        tableView.style.display = "none";
        cardView.style.display = "block";
      } else {
        tableView.style.display = "block";
        cardView.style.display = "none";
      }
    },
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Format helpers
  // ────────────────────────────────────────────────────────────────────────────

  const Format = {
    date(dateStr) {
      const d = new Date(dateStr);
      if (isNaN(d)) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    },
    dateSlash(dateStr) {
      const d = new Date(dateStr);
      if (isNaN(d)) return "";
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    },
    currency(amount, currency = "EGP") {
      const n = parseFloat(amount);
      if (!Number.isFinite(n)) return `${currency} 0.00`;
      return `${currency} ${n.toFixed(2)}`;
    },
  };

  // ────────────────────────────────────────────────────────────────────────────
  // URL params
  // ────────────────────────────────────────────────────────────────────────────

  const URLh = {
    getParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    },
    getAll() {
      return Object.fromEntries(new URLSearchParams(window.location.search));
    },
  };

  // Export
  window.Utils = {
    Auth,
    UI,
    Format,
    URL: URLh,
    Api,
    Cache,
    Async,
    DOM,
    API_BASE,
  };
})();
