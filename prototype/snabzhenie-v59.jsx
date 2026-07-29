import React, { useState, useEffect, useRef } from "react";
import {
  Package, Truck, Mountain, Banknote, Fuel, Plane, Factory,
  Plus, ArrowLeft, ArrowRight, Check, X, ChevronUp, ChevronDown, Trash2,
  Building2, MapPin, Calendar, User, Users, Clock, AlertTriangle, Send,
  CheckCircle2, XCircle, RotateCcw, ClipboardList, Route, LogOut, KeyRound,
  Eye, EyeOff, Inbox, Archive, Pause, Play, StickyNote, Search, RefreshCw,
  Layers, Printer, BarChart3, Merge, BookOpen, ListChecks, Settings, Circle,
  Warehouse, Paperclip, Pencil, Save, Upload, FileText, Boxes,
  Table, FileDown, Database, LayoutDashboard, Undo2, Copy, Scissors,
  MessageSquare, CalendarDays, Megaphone,
  Flag, List, Columns, ChevronLeft, ChevronRight, Download, ClipboardCheck, HardHat, Minus, NotebookPen,
  ScrollText, Filter, Bell, Moon, Sun, Camera, History,
} from "lucide-react";

/* ─── Хранилище: локально в браузере ИЛИ на общем сервере ─── */
/* Чтобы включить ОБЩИЙ доступ для всех сотрудников — впишите адрес вашего сервера,
   например "https://naryady.example.com" (без "/" в конце). Сервер: папка interstroy-server.
   Пусто = прежний режим: данные хранятся только в этом браузере/устройстве. */
const SERVER_URL = "";

const HAS_STORAGE = typeof window !== "undefined" && window.storage;
const KEY = "supply:v11";
const SESSION_KEY = "supply:v11:session";
const attKey = (id) => `supply:v11:att:${id}`;

/* Подключение к серверу хранится вне React, чтобы функции ниже видели токен */
const SRV = { url: (SERVER_URL || "").replace(/\/+$/, ""), token: null, version: 0, onRemote: null, saving: false };
const srvOn = () => !!(SRV.url && SRV.token);
function srvFetch(path, opts) {
  return fetch(SRV.url + path, { ...(opts || {}), headers: { "Content-Type": "application/json", ...(SRV.token ? { Authorization: "Bearer " + SRV.token } : {}), ...((opts && opts.headers) || {}) } });
}
async function srvLogin(login, key) {
  try { const r = await fetch(SRV.url + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, key }) }); if (!r.ok) return null; return await r.json(); } catch (_) { return null; }
}

/* отложенное (debounce) сохранение всего состояния на сервер */
let _putTimer = null, _putPending = null;
function _scheduleSave(v) { _putPending = v; if (_putTimer) clearTimeout(_putTimer); _putTimer = setTimeout(_flushSave, 500); }
async function _flushSave() {
  if (!srvOn() || _putPending == null) return;
  const payload = JSON.stringify({ state: _putPending, version: SRV.version });
  _putPending = null; SRV.saving = true;
  try {
    const r = await srvFetch("/api/state", { method: "PUT", body: payload });
    if (r.status === 409) { const j = await r.json(); SRV.version = j.version; if (SRV.onRemote) SRV.onRemote(j.state); }
    else if (r.ok) { const j = await r.json(); SRV.version = j.version; }
  } catch (_) {} finally { SRV.saving = false; }
}

async function loadData(fb) {
  if (srvOn()) { try { const r = await srvFetch("/api/state"); if (r.ok) { const j = await r.json(); SRV.version = j.version; return { value: j.state, existed: true }; } } catch (_) {} return { value: fb, existed: false }; }
  if (!HAS_STORAGE) return { value: fb, existed: false };
  try {
    const r = await sGet(KEY);
    if (r && r.value != null) {
      const core = JSON.parse(r.value);
      if (core && core._sharded) {
        const part = async (n, def) => { try { const x = await sGet(shardKey(n)); return x && x.value != null ? JSON.parse(x.value) : def; } catch (_) { return def; } };
        const rq = await part("req", { requests: [] });
        const od = await part("ord", { orders: [] });
        const ms = await part("misc", {});
        const { _sharded, ...rest } = core;
        return { value: { ...rest, requests: rq.requests || [], orders: od.orders || [], dms: ms.dms || [], anon: ms.anon || [], events: ms.events || [], announcements: ms.announcements || [], notes: ms.notes || [], drafts: ms.drafts || {} }, existed: true };
      }
      return { value: core, existed: true, legacyFormat: true };
    }
  } catch (_) {}
  return { value: fb, existed: false };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Все обращения к хранилищу — через одну очередь: строго по одному, с зазором.
   Параллельные запросы перемешивают ответы моста ("Invalid response format"). */
let _sq = Promise.resolve();
let _sqLastAt = 0;
const SQ_GAP = 200;
function storageOp(fn) {
  const run = async () => {
    const wait = SQ_GAP - (Date.now() - _sqLastAt);
    if (wait > 0) await sleep(wait);
    try { return await fn(); } finally { _sqLastAt = Date.now(); }
  };
  const p = _sq.then(run, run);
  _sq = p.then(() => {}, () => {});
  return p;
}
function sGet(key) { return storageOp(() => window.storage.get(key)); }
function sSet(key, value) { return storageOp(() => window.storage.set(key, value, false)); }
function sDel(key) { return storageOp(() => window.storage.delete(key, false)); }
let _lastSaveErrMsg = "";
const STORAGE_LIMIT = 5000000;
const STORAGE_WARN = 4200000;
const SAVE_DEBOUNCE = 900;   // ждём, пока человек допечатает
const SAVE_MIN_GAP = 1200;   // не чаще одной записи в 1,2 с — хранилище ограничивает частоту
let _saveTimer = null, _savePending = null, _saving = false, _lastSaveAt = 0, _lastSavedRaw = null;
let _onSaveError = null, _onSaveOk = null;
function setSaveErrorHandler(fn) { _onSaveError = fn; }
function setSaveOkHandler(fn) { _onSaveOk = fn; }
function dataSize(v) { try { return JSON.stringify(v).length; } catch (_) { return 0; } }
/* Данные разложены по четырём ячейкам — каждая со своим лимитом 5 МБ:
   ядро (люди, справочники, маршруты), заявки, наряды, переписка/календарь. */
const SHARD_NAMES = ["core", "req", "ord", "misc"];
const shardKey = (n) => (n === "core" ? KEY : KEY + ":" + n);
function shardRaws(v) {
  const sv = stripForSave(v) || {};
  const { requests, orders, dms, anon, events, announcements, notes, drafts, ...core } = sv;
  return {
    core: JSON.stringify({ ...core, _sharded: 1 }),
    req: JSON.stringify({ requests: requests || [] }),
    ord: JSON.stringify({ orders: orders || [] }),
    misc: JSON.stringify({ dms: dms || [], anon: anon || [], events: events || [], announcements: announcements || [], notes: notes || [], drafts: drafts || {} }),
  };
}
let _lastShardRaw = {};
function markSaved(v) { try { _lastShardRaw = shardRaws(typeof v === "string" ? JSON.parse(v) : v); } catch (_) { _lastShardRaw = {}; } }

const _attSaved = {};   // файлы, ПОДТВЕРЖДЁННО записанные в отдельные ячейки
let _migrating = 0;     // сколько файлов ещё переносится (во время переноса основную запись не трогаем)

/* Готовит состояние к записи: вырезает картинки, которые уже лежат в своих ячейках. */
function stripForSave(v) {
  if (!v || typeof v !== "object") return v;
  const cleanList = (arr) => (arr || []).map((a) => {
    if (!a || !a.dataUrl || !_attSaved[a.id]) return a;
    const { dataUrl, ...meta } = a;
    return meta;
  });
  const out = { ...v };
  out.requests = (v.requests || []).map((r) => ({ ...r, attachments: cleanList(r.attachments) }));
  out.orders = (v.orders || []).map((o) => ({ ...o, attachments: cleanList(o.attachments) }));
  out.users = (v.users || []).map((u) => (u && u.avatar && _attSaved["avatar-" + u.id] ? (({ avatar, ...rest }) => rest)(u) : u));
  if (out.logo && _attSaved["companylogo"]) out.logo = null;
  return out;
}

/* Разгружает основной ключ: картинки, лежащие внутри данных, переносит в отдельные ключи. */
async function putAttSlow(id, dataUrl) {
  if (_attSaved[id]) return true;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      _attCache[id] = dataUrl;
      await sSet(attKey(id), dataUrl);
      _attSaved[id] = true;
      return true;
    } catch (_) {
      await sleep(500 * Math.pow(2, attempt));   // 0,5 → 1 → 2 → 4 → 8 с
    }
  }
  return false;
}

/* Переносит картинки из общей записи в отдельные ячейки — по одной, не спеша,
   чтобы не упереться в ограничение частоты записи. */
async function migrateInlineImages(state, onProgress) {
  if (!state || typeof state !== "object" || !HAS_STORAGE) return { state, total: 0, moved: 0 };
  const jobs = [];
  (state.requests || []).forEach((r) => (r.attachments || []).forEach((a) => { if (a && a.dataUrl) jobs.push({ id: a.id, dataUrl: a.dataUrl }); }));
  (state.orders || []).forEach((o) => (o.attachments || []).forEach((a) => { if (a && a.dataUrl) jobs.push({ id: a.id, dataUrl: a.dataUrl }); }));
  if (state.logo) jobs.push({ id: "companylogo", dataUrl: state.logo });
  (state.users || []).forEach((u) => { if (u && u.avatar) jobs.push({ id: "avatar-" + u.id, dataUrl: u.avatar }); });
  if (jobs.length === 0) return { state, total: 0, moved: 0 };
  _migrating = jobs.length;
  let moved = 0;
  for (let i = 0; i < jobs.length; i++) {
    const ok = await putAttSlow(jobs[i].id, jobs[i].dataUrl);
    if (ok) moved++;
    _migrating = jobs.length - (i + 1);
    if (onProgress) onProgress(i + 1, jobs.length);
    if (i < jobs.length - 1) await sleep(450);   // пауза между файлами
  }
  _migrating = 0;
  return { state: stripForSave(state), total: jobs.length, moved };
}

const SAVE_FAIL_BANNER_MS = 60000;   // красная тревога — только если минуту подряд не удаётся записать
let _failSince = 0, _retryDelay = 3000, _retryTimer = null;
let _onSaveState = null;
function setSaveStateHandler(fn) { _onSaveState = fn; }
async function _writeShard(name, raw) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await sSet(shardKey(name), raw);
      _lastSaveErrMsg = "";
      return true;
    } catch (e) {
      _lastSaveErrMsg = (e && (e.message || e.name)) ? String(e.message || e.name) : "хранилище отклонило запись";
      if (attempt < 2) await sleep(600 * Math.pow(2, attempt));
    }
  }
  return false;
}

async function _flushLocal() {
  _saveTimer = null;
  if (_saving) { _saveTimer = setTimeout(_flushLocal, 400); return; }
  const v = _savePending; _savePending = null;
  if (v == null || !HAS_STORAGE) return;
  if (_migrating > 0) { _savePending = v; _saveTimer = setTimeout(_flushLocal, 600); return; }   // идёт перенос фото — подождём
  let raws = null;
  try { raws = shardRaws(v); } catch (_) { return; }
  const dirty = SHARD_NAMES.filter((n) => raws[n] !== _lastShardRaw[n]);
  if (dirty.length === 0) { _failSince = 0; return; }        // ничего не изменилось — не пишем
  const over = dirty.find((n) => raws[n].length > STORAGE_LIMIT);
  if (over) { if (_onSaveError) _onSaveError("full", raws[over].length, "раздел «" + over + "» больше 5 МБ — выгрузите копию и очистите архив"); return; }
  const gap = Date.now() - _lastSaveAt;
  if (gap < SAVE_MIN_GAP) { _savePending = v; _saveTimer = setTimeout(_flushLocal, SAVE_MIN_GAP - gap); return; }
  _saving = true;
  let allOk = true, failedSize = 0;
  for (const n of dirty) {
    const ok = await _writeShard(n, raws[n]);
    if (ok) _lastShardRaw[n] = raws[n];
    else { allOk = false; failedSize = raws[n].length; }
  }
  _saving = false;
  _lastSaveAt = Date.now();
  if (allOk) {
    _failSince = 0; _retryDelay = 3000;
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    if (_onSaveState) _onSaveState("saved");
    if (_onSaveOk) _onSaveOk();
    return;
  }
  // не сдаёмся: тихие фоновые повторы с нарастающей паузой
  if (!_failSince) _failSince = Date.now();
  _savePending = v;
  if (_retryTimer) clearTimeout(_retryTimer);
  _retryTimer = setTimeout(() => { _retryTimer = null; _flushLocal(); }, _retryDelay);
  _retryDelay = Math.min(30000, Math.round(_retryDelay * 1.7));
  if (Date.now() - _failSince >= SAVE_FAIL_BANNER_MS) {
    if (_onSaveError) _onSaveError("error", failedSize, _lastSaveErrMsg);
  } else if (_onSaveState) _onSaveState("retrying");
}

function saveData(v) {
  if (srvOn()) { _scheduleSave(v); return; }
  if (!HAS_STORAGE) return;
  _savePending = v;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushLocal, SAVE_DEBOUNCE);
}
function saveDataNow(v) {
  if (srvOn()) { _scheduleSave(v); return; }
  if (!HAS_STORAGE) return;
  try {
    const raws = shardRaws(v);
    const dirty = SHARD_NAMES.filter((n) => raws[n] !== _lastShardRaw[n]);
    if (dirty.length === 0) return;
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    _savePending = null;
    for (const n of dirty) {
      const res = window.storage.set(shardKey(n), raws[n], false);   // при закрытии вкладки — без ожидания
      if (res && typeof res.then === "function") res.then(() => { _lastShardRaw[n] = raws[n]; }).catch(() => {});
    }
  } catch (_) {}
}
const _attCache = {};   // файлы, уже прочитанные/записанные в этой сессии — показываем мгновенно

async function getAtt(id) {
  if (_attCache[id]) return _attCache[id];
  if (srvOn()) { try { const r = await srvFetch("/api/att/" + id); if (r.ok) { const j = await r.json(); const d = j.data || null; if (d) _attCache[id] = d; return d; } } catch (_) {} return null; }
  if (!HAS_STORAGE) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await sGet(attKey(id));
      const d = r && r.value ? r.value : null;
      if (d) { _attCache[id] = d; return d; }
      return null;
    } catch (_) {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return null;
}

/* Записывает файл в СВОЙ ключ и ДОЖИДАЕТСЯ подтверждения. true — файл на месте. */
async function putAtt(id, dataUrl) {
  _attCache[id] = dataUrl;   // показать можно сразу
  if (srvOn()) {
    try { const r = await srvFetch("/api/att/" + id, { method: "PUT", body: JSON.stringify({ data: dataUrl }) }); return !!(r && r.ok); } catch (_) { return false; }
  }
  if (!HAS_STORAGE) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await sSet(attKey(id), dataUrl);
      _attSaved[id] = true;
      return true;
    } catch (_) {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  delete _attCache[id];
  return false;
}
function setAtt(id, dataUrl) {
  if (srvOn()) { return srvFetch("/api/att/" + id, { method: "PUT", body: JSON.stringify({ data: dataUrl }) }).catch(() => {}); }
  if (HAS_STORAGE) { try { return sSet(attKey(id), dataUrl).catch(() => {}); } catch (_) { return Promise.resolve(); } }
  return Promise.resolve();
}
function delAtt(id) {
  delete _attCache[id];
  if (srvOn()) { srvFetch("/api/att/" + id, { method: "DELETE" }).catch(() => {}); return; }
  if (HAS_STORAGE) { try { sDel(attKey(id)).catch(() => {}); } catch (_) {} }
}
/* сессия (токен) — в этом браузере, чтобы не входить каждый раз */
function saveSession(sess) { if (HAS_STORAGE) { try { sSet(SESSION_KEY, JSON.stringify(sess || null)).catch(() => {}); } catch (_) {} } }
async function loadSession() { if (HAS_STORAGE) { try { const r = await sGet(SESSION_KEY); return r && r.value ? JSON.parse(r.value) : null; } catch (_) {} } return null; }

/* ─── Утилиты ─── */
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
const pad = (n) => String(n).padStart(4, "0");
const fmtDate = (v) => { if (!v) return "—"; try { return new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch (_) { return "—"; } };
const fmtDateTime = (v) => { try { return new Date(v).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };
const fmtMoney = (v) => { if (v === "" || v == null) return "—"; const n = Number(v); return isNaN(n) ? String(v) : n.toLocaleString("ru-RU") + " ₸"; };
const genKey = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const deptName = (data, id) => (data.departments.find((d) => d.id === id) || {}).name || "";
const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const monthOf = (iso) => (iso ? String(iso).slice(0, 7) : "");
const inDateRange = (iso, from, to) => { if (!from && !to) return true; if (!iso) return false; const t = new Date(iso).getTime(); if (from && t < new Date(from + "T00:00:00").getTime()) return false; if (to && t > new Date(to + "T23:59:59.999").getTime()) return false; return true; };
const csvCell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
const toCSV = (rows) => "\ufeff" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
const mergeReqItems = (reqs) => { const map = {}; reqs.forEach((r) => (r.items || []).forEach((x) => { const k = x.name.trim().toLowerCase() + "|" + x.unit; if (!map[k]) map[k] = { name: x.name, unit: x.unit, qty: 0, src: [], refs: [] }; map[k].qty += num(x.qty); map[k].src.push(r.number + (x.qty ? ": " + x.qty : "")); map[k].refs.push({ reqId: r.id, itemId: x.id, fulfilled: !!x.fulfilled }); })); return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "ru")); };
const humanDur = (ms) => { if (ms == null) return "—"; const h = ms / 3600000; if (h < 1) return Math.max(1, Math.round(ms / 60000)) + " мин"; if (h < 24) return Math.round(h * 10) / 10 + " ч"; return Math.round((h / 24) * 10) / 10 + " дн"; };
const itemProgress = (r) => { const t = r.items || []; return { done: t.filter((i) => i.fulfilled).length, total: t.length }; };
const dayWord = (n) => { const a = n % 10, b = n % 100; if (a === 1 && b !== 11) return "день"; if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "дня"; return "дней"; };
const overdueDays = (r) => { if (!r.due || (r.status !== "approval" && r.status !== "supply")) return 0; const d = new Date(r.due); d.setHours(0, 0, 0, 0); const n = new Date(); n.setHours(0, 0, 0, 0); const diff = Math.floor((n - d) / 86400000); return diff > 0 ? diff : 0; };
const overdueStyle = (n) => n >= 10 ? "border-rose-700 bg-rose-600 text-white" : n >= 6 ? "border-rose-400 bg-rose-200 text-rose-900" : n >= 3 ? "border-rose-300 bg-rose-100 text-rose-800" : "border-rose-200 bg-rose-50 text-rose-700";
const OverdueBadge = ({ r }) => { const n = overdueDays(r); if (!n) return null; return <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${overdueStyle(n)}`}><AlertTriangle className="h-3 w-3" />просрочено {n} {dayWord(n)}</span>; };
const sizeKb = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " МБ" : Math.max(1, Math.round(b / 1024)) + " КБ");

const UNITS = ["шт", "компл", "упак", "пара", "мешок", "рулон", "лист", "бухта", "м", "м²", "м³", "кг", "т", "л", "рейс", "смена", "час"];

function imageToPng(file, maxW, maxH, cb) {
  try {
    const rd = new FileReader();
    rd.onerror = () => cb(null);
    rd.onload = () => {
      const raw = String(rd.result || "");
      const isSvg = /^data:image\/svg\+xml/i.test(raw) || /\.svg$/i.test(file.name || "");
      const img = new Image();
      img.onerror = () => cb(null);
      img.onload = () => {
        try {
          const nw = img.naturalWidth || img.width || 1, nh = img.naturalHeight || img.height || 1;
          if (isSvg) { cb({ dataUrl: raw, w: nw, h: nh }); return; }
          const render = (mw, mh) => {
            let w = nw, h = nh;
            const k = Math.min(mw / w, mh / h, 1);
            w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
            const cv = document.createElement("canvas");
            cv.width = w; cv.height = h;
            const ctx = cv.getContext("2d");
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            return { url: cv.toDataURL("image/png"), w, h };
          };
          let out = render(maxW, maxH);
          const steps = [[Math.round(maxW * 0.75), Math.round(maxH * 0.75)], [Math.round(maxW * 0.5), Math.round(maxH * 0.5)], [Math.round(maxW * 0.35), Math.round(maxH * 0.35)]];
          for (let i = 0; i < steps.length && out.url.length > 900000; i++) out = render(steps[i][0], steps[i][1]);
          cb({ dataUrl: out.url, w: out.w, h: out.h });
        } catch (e) { cb(null); }
      };
      img.src = raw;
    };
    rd.readAsDataURL(file);
  } catch (e) { cb(null); }
}

function fileToDataUrl(file, cb) {
  const reader = new FileReader();
  reader.onerror = () => cb(null);
  reader.onload = () => {
    const res = reader.result;
    if (file.type && file.type.startsWith("image/") && typeof window !== "undefined" && window.Image) {
      const img = new window.Image();
      img.onload = () => {
        try {
          const shrink = (maxSide, q) => { let w = img.width, h = img.height; if (w > maxSide || h > maxSide) { const k = Math.min(maxSide / w, maxSide / h); w = Math.round(w * k); h = Math.round(h * k); } const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); return c.toDataURL("image/jpeg", q); };
          let out = shrink(1280, 0.72);
          if (out.length > 1200000) out = shrink(1000, 0.6);
          if (out.length > 1200000) out = shrink(800, 0.5);
          cb(out);
        } catch (_) { cb(res); }
      };
      img.onerror = () => cb(res);
      img.src = res;
    } else cb(res);
  };
  reader.readAsDataURL(file);
}

/* ─── Типы заявок ─── */
const TYPES = {
  tmc: { label: "ТМЦ", pick: "Заявка на ТМЦ", short: "ТМЦ", prefix: "ТМЦ", icon: Package, color: "amber", items: true, itemsLabel: "Позиции", unit: "шт", titleKey: null, fields: [] },
  transport: { label: "Транспорт", pick: "Заявка на транспорт", short: "Транспорт", prefix: "ТР", icon: Truck, color: "sky", items: false, titleKey: "route", fields: [{ key: "cargo", label: "Что перевозим", required: true }, { key: "route", label: "Маршрут (откуда — куда)", required: true }, { key: "date", label: "Дата", date: true }, { key: "weight", label: "Вес / объём" }] },
  quarry: { label: "Карьер", pick: "Заявка на карьер", short: "Карьер", prefix: "КАР", icon: Mountain, color: "lime", items: true, itemsLabel: "Материалы карьера", unit: "м³", titleKey: null, fields: [{ key: "purpose", label: "Назначение / куда" }] },
  funds: { label: "Деньги", pick: "Заявка на деньги", short: "Деньги", prefix: "ДС", icon: Banknote, color: "emerald", items: false, titleKey: "purpose", fields: [{ key: "purpose", label: "Назначение", required: true }, { key: "amount", label: "Сумма", money: true, required: true }] },
  fuel: { label: "Топливо", pick: "Заявка на топливо", short: "Топливо", prefix: "ТОП", icon: Fuel, color: "orange", items: true, itemsLabel: "Топливо / ГСМ", unit: "л", titleKey: "vehicle", fields: [{ key: "vehicle", label: "Техника / ТС", required: true }] },
  travel: { label: "Командировочные", pick: "Командировочные", short: "Командир.", prefix: "КМ", icon: Plane, color: "violet", items: false, titleKey: "destination", fields: [{ key: "employee", label: "Сотрудник", required: true }, { key: "destination", label: "Пункт назначения", required: true }, { key: "purpose", label: "Цель поездки" }, { key: "dateFrom", label: "С", date: true }, { key: "dateTo", label: "По", date: true }, { key: "amount", label: "Сумма", money: true }] },
  production: { label: "Производство", pick: "Заявка на производство", short: "Произв.", prefix: "ПР", icon: Factory, color: "blue", items: true, itemsLabel: "Материалы и работы", unit: "шт", titleKey: "product", fields: [{ key: "product", label: "Изделие / что производим", required: true }, { key: "volume", label: "Объём / количество" }] },
};
const TYPE_KEYS = Object.keys(TYPES);
const emptyChains = () => { const o = {}; TYPE_KEYS.forEach((k) => (o[k] = [])); return o; };
const STATUS = { approval: { t: "На согласовании", c: "bg-amber-100 text-amber-800 border-amber-200" }, supply: { t: "В снабжении", c: "bg-sky-100 text-sky-800 border-sky-200" }, fulfilled: { t: "Ждёт подтверждения", c: "bg-violet-100 text-violet-800 border-violet-200" }, done: { t: "Завершена", c: "bg-emerald-100 text-emerald-800 border-emerald-200" }, rejected: { t: "Отклонена", c: "bg-rose-100 text-rose-800 border-rose-200" }, returned: { t: "На доработку", c: "bg-orange-100 text-orange-800 border-orange-200" } };
const PRIORITIES = ["Срочно", "Высокий", "Обычный", "Низкий"];
const PRANK = { "Срочно": 0, "Высокий": 1, "Обычный": 2, "Низкий": 3 };
const PCOLOR = { "Срочно": "bg-rose-50 text-rose-700 border-rose-200", "Высокий": "bg-amber-50 text-amber-700 border-amber-200", "Обычный": "bg-stone-100 text-stone-600 border-stone-200", "Низкий": "bg-stone-50 text-stone-400 border-stone-200" };
const OBJ_PALETTE = ["sky", "emerald", "violet", "amber", "rose", "teal", "lime", "orange", "blue", "cyan"];
const PRI_BORDER = { "Срочно": "border-l-rose-400", "Высокий": "border-l-amber-400", "Обычный": "border-l-stone-300", "Низкий": "border-l-stone-200" };
const TYPE_BORDER = { tmc: "border-l-amber-400", transport: "border-l-sky-400", quarry: "border-l-lime-400", funds: "border-l-emerald-400", fuel: "border-l-orange-400", travel: "border-l-violet-400", production: "border-l-blue-400" };
const PRI_SELECT = { "Срочно": "border-rose-300 text-rose-700", "Высокий": "border-amber-300 text-amber-700", "Обычный": "border-stone-300 text-stone-600", "Низкий": "border-stone-200 text-stone-400" };
const ROLES = { admin: { t: "Администратор", c: "bg-stone-900 text-white" }, requester: { t: "Заявитель", c: "bg-blue-100 text-blue-800" }, approver: { t: "Согласующий", c: "bg-amber-100 text-amber-800" }, warehouse: { t: "Склад", c: "bg-teal-100 text-teal-800" }, supply: { t: "Снабжение", c: "bg-sky-100 text-sky-800" } };
const CHAIN_ROLES = ["approver", "warehouse", "admin"];
const ACTIONS = { created: "создал заявку", approved: "согласовал", stock: "отметил наличие на складе", rejected: "отклонил", fulfilled: "отметил выполненной", confirmed: "подтвердил получение", returned: "вернул на доработку", edited: "отредактировал заявку", claimed: "взял в работу", assigned: "назначил исполнителя", released: "вернул в пул", withdrawn: "отозвал(а) заявку", resubmitted: "отправил(а) повторно", consolidated: "включил в сводную закупку", unconsolidated: "расформировал сводную" };
const SUPPLY_STAGES = [{ k: "new", t: "Входящие", dot: "bg-stone-400" }, { k: "inwork", t: "В работе", dot: "bg-sky-500" }, { k: "ordered", t: "Заказано", dot: "bg-amber-500" }, { k: "arrived", t: "На складе", dot: "bg-emerald-500" }];
const BOARD_COLS = [{ k: "new", t: "Входящие", dot: "bg-stone-400" }, { k: "inwork", t: "В работе", dot: "bg-sky-500" }, { k: "paused", t: "На паузе", dot: "bg-violet-500" }, { k: "ordered", t: "Заказано", dot: "bg-amber-500" }];
const colOf = (r) => (r.postponed ? "paused" : (r.supplyStage === "arrived" ? "ordered" : (r.supplyStage || "new")));
const ORDER = { approval: 0, supply: 1, fulfilled: 2 };

/* ─── Демо-данные ─── */
function makeSeed() {
  const dStroy = { id: uid(), name: "Строительный" }, dProd = { id: uid(), name: "Производственный" }, dTrans = { id: uid(), name: "Транспортный" };
  const departments = [dStroy, dProd, dTrans];
  const U = {
    admin: { id: uid(), login: "admin", key: "admin", name: "Владимир — администратор", role: "admin", departmentId: "" },
    stroyReq: { id: uid(), login: "prorab", key: "1111", name: "Иванов — прораб", role: "requester", departmentId: dStroy.id, orders: true },
    prodReq: { id: uid(), login: "master", key: "1212", name: "Орлов — мастер цеха", role: "requester", departmentId: dProd.id, orders: true },
    transReq: { id: uid(), login: "logist", key: "1313", name: "Гайдар — логист", role: "requester", departmentId: dTrans.id },
    headStroy: { id: uid(), login: "nstroy", key: "2001", name: "Ахметов — нач. строит. отдела", role: "approver", departmentId: dStroy.id },
    headTrans: { id: uid(), login: "ntrans", key: "2002", name: "Жуков — нач. трансп. отдела", role: "approver", departmentId: dTrans.id },
    eng: { id: uid(), login: "eng", key: "2222", name: "Сидоров — гл. инженер", role: "approver", departmentId: "" },
    mech: { id: uid(), login: "mech", key: "2333", name: "Беков — гл. механик", role: "approver", departmentId: dTrans.id },
    fin: { id: uid(), login: "fin", key: "3333", name: "Ким — финансы", role: "approver", departmentId: "" },
    dir: { id: uid(), login: "dir", key: "4444", name: "Директор", role: "approver", departmentId: "", canPrice: true },
    sklad: { id: uid(), login: "sklad", key: "6001", name: "Нурлан — кладовщик", role: "warehouse", departmentId: "" },
    snab: { id: uid(), login: "snab", key: "5555", name: "Аскар — снабженец", role: "supply", lead: true, departmentId: "" },
    snab2: { id: uid(), login: "snab2", key: "5556", name: "Алия — снабженец", role: "supply", departmentId: "" },
    snab3: { id: uid(), login: "snab3", key: "5557", name: "Серик — снабженец", role: "supply", departmentId: "" },
  };
  const users = Object.values(U);
  const objects = [
    { id: uid(), name: "ЖК «Сарыарка», блок Б", color: "sky", userIds: [U.stroyReq.id] },
    { id: uid(), name: "Школа №42 (капремонт)", color: "emerald", userIds: [U.stroyReq.id] },
    { id: uid(), name: "Цех металлоконструкций", color: "violet", userIds: [U.prodReq.id] },
    { id: uid(), name: "Автобаза / ремзона", color: "amber", userIds: [U.transReq.id] },
    { id: uid(), name: "Карьер «Восточный»", color: "lime", userIds: [U.transReq.id, U.stroyReq.id] },
  ];
  const s = (u, label) => ({ id: uid(), approverId: u.id, label });
  const chains = {
    [dStroy.id]: {
      tmc: [s(U.headStroy, "Нач. отдела"), s(U.sklad, "Склад"), s(U.eng, "Гл. инженер"), s(U.dir, "Директор")],
      transport: [s(U.headStroy, "Нач. отдела"), s(U.dir, "Директор")],
      quarry: [s(U.headStroy, "Нач. отдела"), s(U.sklad, "Склад"), s(U.dir, "Директор")],
      funds: [s(U.headStroy, "Нач. отдела"), s(U.fin, "Финансы"), s(U.dir, "Директор")],
      fuel: [s(U.headStroy, "Нач. отдела"), s(U.sklad, "Склад"), s(U.dir, "Директор")],
      travel: [s(U.fin, "Финансы"), s(U.dir, "Директор")],
      production: [s(U.eng, "Гл. инженер"), s(U.dir, "Директор")],
    },
    [dProd.id]: {
      tmc: [s(U.eng, "Гл. инженер"), s(U.sklad, "Склад"), s(U.dir, "Директор")],
      transport: [s(U.eng, "Гл. инженер"), s(U.dir, "Директор")],
      quarry: [s(U.sklad, "Склад"), s(U.dir, "Директор")],
      funds: [s(U.fin, "Финансы"), s(U.dir, "Директор")],
      fuel: [s(U.sklad, "Склад"), s(U.dir, "Директор")],
      travel: [s(U.fin, "Финансы"), s(U.dir, "Директор")],
      production: [s(U.eng, "Технолог"), s(U.dir, "Директор")],
    },
    [dTrans.id]: {
      tmc: [s(U.headTrans, "Нач. отдела"), s(U.mech, "Гл. механик"), s(U.sklad, "Склад"), s(U.dir, "Директор")],
      transport: [s(U.headTrans, "Нач. отдела"), s(U.dir, "Директор")],
      quarry: [s(U.headTrans, "Нач. отдела"), s(U.sklad, "Склад"), s(U.dir, "Директор")],
      funds: [s(U.headTrans, "Нач. отдела"), s(U.fin, "Финансы"), s(U.dir, "Директор")],
      fuel: [s(U.mech, "Гл. механик"), s(U.sklad, "Склад"), s(U.dir, "Директор")],
      travel: [s(U.headTrans, "Нач. отдела"), s(U.fin, "Финансы"), s(U.dir, "Директор")],
      production: [s(U.mech, "Гл. механик"), s(U.dir, "Директор")],
    },
  };
  const fullChain = (d, t) => chains[d][t].map((st) => { const u = users.find((x) => x.id === st.approverId); return { approverId: st.approverId, approverName: u ? u.name : "—", role: u ? u.role : "approver", label: st.label }; });
  const H = (a, u, e = {}) => ({ action: a, by: u.id, byName: u.name, ...e });
  const it = (name, unit, qty, opt = {}) => ({ id: uid(), catalogId: "", name, unit, qty, note: "", fulfilled: false, stock: {}, ...opt });

  const catalog = [
    { id: uid(), name: "Цемент М500", unit: "мешок", category: "Стройматериалы" },
    { id: uid(), name: "Песок строительный", unit: "м³", category: "Стройматериалы" },
    { id: uid(), name: "Краска фасадная", unit: "кг", category: "Отделка" },
    { id: uid(), name: "Грунтовка глубокого проникновения", unit: "л", category: "Отделка" },
    { id: uid(), name: "Арматура А500С ⌀12", unit: "т", category: "Метизы" },
    { id: uid(), name: "Уголок металлический 50×50", unit: "м", category: "Метизы" },
    { id: uid(), name: "Профлист С8", unit: "лист", category: "Метизы" },
    { id: uid(), name: "Электроды сварочные", unit: "упак", category: "Расходники" },
    { id: uid(), name: "Перчатки рабочие", unit: "пара", category: "СИЗ" },
    { id: uid(), name: "Фильтр масляный", unit: "шт", category: "Запчасти" },
    { id: uid(), name: "Тормозные колодки", unit: "компл", category: "Запчасти" },
    { id: uid(), name: "Дизельное топливо (ДТ)", unit: "л", category: "Топливо / ГСМ" },
    { id: uid(), name: "Бензин АИ-92", unit: "л", category: "Топливо / ГСМ" },
    { id: uid(), name: "Бензин АИ-95", unit: "л", category: "Топливо / ГСМ" },
    { id: uid(), name: "Масло моторное 10W-40", unit: "л", category: "Топливо / ГСМ" },
    { id: uid(), name: "Щебень фр. 5-20", unit: "м³", category: "Карьер" },
    { id: uid(), name: "Щебень фр. 20-40", unit: "м³", category: "Карьер" },
    { id: uid(), name: "Отсев", unit: "м³", category: "Карьер" },
    { id: uid(), name: "ПГС", unit: "м³", category: "Карьер" },
  ];

  const R = (o) => ({ priority: "Обычный", note: "", items: [], attachments: [], postponed: false, supplyNotes: [], objectId: "", objectName: "", objectColor: "", assignee: "", due: "", supplyStage: "new", ...o });
  const O = (i) => ({ objectId: objects[i].id, objectName: objects[i].name, objectColor: objects[i].color });
  const requests = [
    R({ id: uid(), number: "ТМЦ-0004", type: "tmc", departmentId: dStroy.id, departmentName: dStroy.name, ...O(0), requesterId: U.stroyReq.id, createdAt: ago(800), priority: "Высокий", note: "Бетонные работы, 3 этаж.", fields: {}, items: [it("Цемент М500", "мешок", "30", { fulfilled: true, stock: { status: "in", by: U.sklad.id, byName: U.sklad.name, at: ago(640) } }), it("Перчатки рабочие", "пара", "20", { stock: { status: "out", by: U.sklad.id, byName: U.sklad.name, at: ago(640) } })], chain: fullChain(dStroy.id, "tmc"), currentStageIndex: 4, status: "supply", assignee: U.snab.id, supplyStage: "inwork", due: ago(-1440), history: [H("created", U.stroyReq, { at: ago(800) }), H("approved", U.headStroy, { stage: "Нач. отдела", at: ago(700) }), H("stock", U.sklad, { stage: "Склад", at: ago(640) }), H("approved", U.eng, { stage: "Гл. инженер", at: ago(620) }), H("approved", U.dir, { stage: "Директор", at: ago(600) })] }),
    R({ id: uid(), number: "ТМЦ-0005", type: "tmc", departmentId: dProd.id, departmentName: dProd.name, ...O(2), requesterId: U.prodReq.id, createdAt: ago(500), fields: {}, items: [it("Электроды сварочные", "упак", "10"), it("Перчатки рабочие", "пара", "15"), it("Уголок металлический 50×50", "м", "12")], chain: fullChain(dProd.id, "tmc"), currentStageIndex: 3, status: "supply", due: ago(5 * 1440), history: [H("created", U.prodReq, { at: ago(500) }), H("approved", U.eng, { stage: "Гл. инженер", at: ago(450) }), H("stock", U.sklad, { stage: "Склад", at: ago(430) }), H("approved", U.dir, { stage: "Директор", at: ago(400) })] }),
    R({ id: uid(), number: "КАР-0001", type: "quarry", departmentId: dTrans.id, departmentName: dTrans.name, ...O(4), requesterId: U.transReq.id, createdAt: ago(120), priority: "Высокий", fields: { purpose: "Подсыпка подъездных путей" }, items: [it("Щебень фр. 20-40", "м³", "50"), it("Песок строительный", "м³", "30")], chain: fullChain(dTrans.id, "quarry"), currentStageIndex: 1, status: "approval", due: ago(2 * 1440), history: [H("created", U.transReq, { at: ago(120) }), H("approved", U.headTrans, { stage: "Нач. отдела", at: ago(60) })] }),
    R({ id: uid(), number: "ТОП-0001", type: "fuel", departmentId: dTrans.id, departmentName: dTrans.name, ...O(3), requesterId: U.transReq.id, createdAt: ago(90), priority: "Срочно", fields: { vehicle: "КамАЗ 6520 (гос. А123АА)" }, items: [it("Дизельное топливо (ДТ)", "л", "400")], chain: fullChain(dTrans.id, "fuel"), currentStageIndex: 1, status: "approval", history: [H("created", U.transReq, { at: ago(90) }), H("approved", U.mech, { stage: "Гл. механик", at: ago(40) })] }),
    R({ id: uid(), number: "ТР-0001", type: "transport", departmentId: dStroy.id, departmentName: dStroy.name, ...O(0), requesterId: U.stroyReq.id, createdAt: ago(200), fields: { cargo: "Плиты перекрытия ПК 60-12", route: "Завод ЖБИ → ЖК «Сарыарка»", date: "2026-06-29", weight: "≈ 18 т" }, chain: fullChain(dStroy.id, "transport"), currentStageIndex: 0, status: "approval", history: [H("created", U.stroyReq, { at: ago(200) })] }),
    R({ id: uid(), number: "КМ-0001", type: "travel", departmentId: dProd.id, departmentName: dProd.name, requesterId: U.prodReq.id, createdAt: ago(600), fields: { employee: "Петров П.С.", destination: "Алматы", purpose: "Закуп оборудования", dateFrom: "2026-06-30", dateTo: "2026-07-03", amount: "180000" }, chain: fullChain(dProd.id, "travel"), currentStageIndex: 2, status: "supply", assignee: U.snab.id, supplyStage: "ordered", due: ago(12 * 1440), supplyNotes: [{ by: U.snab.id, byName: U.snab.name, text: "Бронирую гостиницу и билеты.", at: ago(120) }], history: [H("created", U.prodReq, { at: ago(600) }), H("approved", U.fin, { stage: "Финансы", at: ago(500) }), H("approved", U.dir, { stage: "Директор", at: ago(300) })] }),
    R({ id: uid(), number: "ДС-0001", type: "funds", departmentId: dStroy.id, departmentName: dStroy.name, ...O(1), requesterId: U.stroyReq.id, createdAt: ago(1400), fields: { purpose: "Хознужды участка", amount: "75000" }, chain: fullChain(dStroy.id, "funds"), currentStageIndex: 3, status: "fulfilled", supplyNotes: [{ by: U.snab.id, byName: U.snab.name, text: "Выдано наличными в кассе.", at: ago(60) }], history: [H("created", U.stroyReq, { at: ago(1400) }), H("approved", U.headStroy, { stage: "Нач. отдела", at: ago(1300) }), H("approved", U.fin, { stage: "Финансы", at: ago(1250) }), H("approved", U.dir, { stage: "Директор", at: ago(1200) }), H("fulfilled", U.snab, { at: ago(60) })] }),
    R({ id: uid(), number: "ПР-0001", type: "production", departmentId: dTrans.id, departmentName: dTrans.name, ...O(3), requesterId: U.transReq.id, createdAt: ago(5000), priority: "Высокий", fields: { product: "Прицеп-платформа (ремонт рамы)", volume: "1 ед." }, items: [it("Уголок металлический 50×50", "м", "24", { fulfilled: true })], chain: fullChain(dTrans.id, "production"), currentStageIndex: 2, status: "done", history: [H("created", U.transReq, { at: ago(5000) }), H("approved", U.mech, { stage: "Гл. механик", at: ago(4900) }), H("approved", U.dir, { stage: "Директор", at: ago(4800) }), H("fulfilled", U.snab, { at: ago(4000) }), H("confirmed", U.transReq, { at: ago(3900) })] }),
    R({ id: uid(), number: "ТМЦ-0001", type: "tmc", departmentId: dStroy.id, departmentName: dStroy.name, ...O(0), requesterId: U.stroyReq.id, createdAt: ago(7000), fields: {}, items: [it("Краска фасадная", "кг", "200")], chain: fullChain(dStroy.id, "tmc"), currentStageIndex: 0, status: "rejected", history: [H("created", U.stroyReq, { at: ago(7000) }), H("rejected", U.headStroy, { stage: "Нач. отдела", comment: "Нет в бюджете на этот месяц.", at: ago(6900) })] }),
  ];

  const works = [
    { id: uid(), kind: "stroy", name: "Строительные работы", items: mkWorks(WB) },
    { id: uid(), kind: "elektro", name: "Электромонтажные работы", items: mkWorks(WE) },
  ];
  const ips = [
    { id: uid(), name: "ИП Серіков А.Қ.", bin: "880101300123", vat: true },
    { id: uid(), name: "ИП Нұрланов Б.С.", bin: "910515350456", vat: true },
    { id: uid(), name: "ИП Қайратова Г.М.", bin: "920820400789", vat: false },
  ];
  const oChain = (steps) => steps.map((x) => ({ id: uid(), approverId: x[0], label: x[1] }));
  const orderChains = {
    [dStroy.id]: oChain([[U.headStroy.id, "Нач. участка"], [U.dir.id, "Директор"]]),
  };
  const oSnap = (deptId) => orderChains[deptId].map((st) => { const u = users.find((x) => x.id === st.approverId); return { approverId: st.approverId, approverName: u ? u.name : "—", role: u ? u.role : "approver", label: st.label }; });
  const oLine = (i, qty) => { const w = works[0].items[i]; return { id: uid(), workId: w.id, name: w.name, unit: w.unit, price: w.price, qty }; };
  const pNow = monthKeyOf(new Date());
  const pPrev = monthKeyOf(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const orders = [
    { id: uid(), number: "Н-0001", departmentId: dStroy.id, departmentName: dStroy.name, ...O(0), period: pNow, periodLabel: periodLabel(pNow), ipId: ips[0].id, ipName: ips[0].name, catalogId: works[0].id, catalogName: works[0].name, createdAt: ago(300), requesterId: U.stroyReq.id, note: "Монолит 3-го этажа, блок Б.", lines: [oLine(0, 18), oLine(11, 60)], chain: oSnap(dStroy.id), currentStageIndex: 1, status: "approval", history: [H("created", U.stroyReq, { at: ago(300) }), H("approved", U.headStroy, { stage: "Нач. участка", at: ago(200) })] },
    { id: uid(), number: "Н-0002", departmentId: dStroy.id, departmentName: dStroy.name, ...O(1), period: pPrev, periodLabel: periodLabel(pPrev), ipId: ips[1].id, ipName: ips[1].name, catalogId: works[0].id, catalogName: works[0].name, createdAt: ago(1200), requesterId: U.stroyReq.id, note: "Кладка и штукатурка, секция 2.", lines: [oLine(16, 40), oLine(116, 120)], chain: oSnap(dStroy.id), currentStageIndex: 2, status: "approved", history: [H("created", U.stroyReq, { at: ago(1200) }), H("approved", U.headStroy, { stage: "Нач. участка", at: ago(1100) }), H("approved", U.dir, { stage: "Директор", at: ago(1000) })] },
  ];
  return { departments, objects, users, chains, catalog, requests, counters: { tmc: 6, transport: 2, quarry: 2, funds: 2, fuel: 2, travel: 2, production: 2 }, workCatalogs: works, ips, orderChains, orders, orderCounter: 2, deskView: "table", drafts: {}, notes: [], vehicles: [{ id: uid(), name: "КамАЗ 6520 самосвал · А 123 АА" }, { id: uid(), name: "КамАЗ 5511 самосвал · В 456 ВВ" }, { id: uid(), name: "ЗИЛ-130 бортовой · С 789 СС" }, { id: uid(), name: "Погрузчик XCMG LW300" }, { id: uid(), name: "Экскаватор Hitachi ZX200" }, { id: uid(), name: "ГАЗель Next · Е 234 ЕЕ" }], chat: [], dm: [], anon: [], events: [], announcements: [], brandingVer: 0 };
}

/* ─── Мелкие UI-компоненты ─── */
const Chip = ({ className, children }) => <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
const StatusBadge = ({ s }) => { const x = STATUS[s] || STATUS.approval; return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${x.c}`}>{x.t}</span>; };
const PriorityBadge = ({ p }) => <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${PCOLOR[p] || PCOLOR["Обычный"]}`}>{p}</span>;
const RoleChip = ({ r }) => { const x = ROLES[r] || ROLES.requester; return <Chip className={x.c}>{x.t}</Chip>; };
const LOGO_SZ = { 8: "h-8 w-8", 9: "h-9 w-9", 11: "h-11 w-11", 12: "h-12 w-12" };
function CompanyLogo({ data, ver, size = 9, rounded = "rounded-md", fallbackIcon = "h-5 w-5", h, maxW }) {
  const inline = data && data.logo ? data.logo : null;
  const [stored, setStored] = useState(() => _attCache["companylogo"] || null);
  useEffect(() => {
    let on = true;
    getAtt("companylogo").then((d) => { if (on) setStored(d || null); }).catch(() => { if (on) setStored(null); });
    return () => { on = false; };
  }, [ver]);
  const src = inline || stored;
  const H = h || (size === 12 ? 48 : size === 11 ? 44 : size === 8 ? 32 : 36);
  if (src) return <img src={src} alt="Логотип" className="shrink-0 object-contain" style={{ height: H, width: "auto", maxWidth: maxW || H * 5 }} />;
  const cls = LOGO_SZ[size] || LOGO_SZ[9];
  return <div className={`${cls} ${rounded} flex shrink-0 items-center justify-center bg-amber-500 text-stone-900`}><Building2 className={fallbackIcon} /></div>;
}
function TypeBadge({ type }) { const t = TYPES[type]; const Icon = t.icon; return <span className={`inline-flex items-center gap-1 rounded-md bg-${t.color}-50 px-2 py-0.5 text-xs font-medium text-${t.color}-700 border border-${t.color}-200`}><Icon className="h-3.5 w-3.5" /> {t.short}</span>; }
const DeptChip = ({ name }) => <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs text-stone-600"><Building2 className="h-3 w-3" /> {name}</span>;
const ObjChip = ({ name, color }) => name ? <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${color ? `border-${color}-200 bg-${color}-50 text-${color}-700` : "border-stone-200 bg-white text-stone-600"}`}><span className={`inline-block h-1.5 w-1.5 rounded-full ${color ? `bg-${color}-400` : "bg-stone-400"}`} />{name}</span> : null;
function StockBadge({ stock }) { if (!stock || !stock.status) return null; const m = { in: ["на складе", "bg-emerald-100 text-emerald-700"], partial: ["частично " + (stock.qty || ""), "bg-amber-100 text-amber-700"], out: ["нет на складе", "bg-rose-100 text-rose-700"] }[stock.status]; if (!m) return null; return <Chip className={m[1]}><Warehouse className="mr-1 h-3 w-3" /> {m[0]}</Chip>; }
function reqTitle(r) { const t = TYPES[r.type]; if (t.titleKey && r.fields && r.fields[t.titleKey]) return r.fields[t.titleKey]; if (r.objectName) return r.objectName; if (r.items && r.items[0] && r.items[0].name) return r.items[0].name; return r.number; }
function holderText(r) { if (r.status === "approval") { const st = r.chain[r.currentStageIndex]; return "Сейчас у: " + (st ? (st.label || st.approverName) : "—"); } if (r.status === "supply") return r.postponed ? "В снабжении · отложена" : "В снабжении · в работе"; if (r.status === "fulfilled") return "Ждёт подтверждения: " + (r.history[0] ? r.history[0].byName : ""); if (r.status === "done") return "Завершена"; if (r.status === "rejected") return "Отклонена"; return ""; }

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-100";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2";
const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50";
const card = "rounded-xl border border-stone-200 bg-white shadow-sm";
// Стандартизированные размеры равнозначных элементов:
const btnSm = "inline-flex items-center justify-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50";
const iconBtn = "inline-flex items-center justify-center rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700";
const selectCls = "rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-100";
const pillActive = "border-stone-900 bg-stone-900 text-white";
const pillIdle = "border-stone-300 bg-white text-stone-600 hover:bg-stone-50";
const pillCls = (on) => `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? pillActive : pillIdle}`;
// Типографика: единые заголовки, подписи, надзаголовки-«eyebrow»
const h1Cls = "text-xl font-semibold leading-tight tracking-tight text-stone-900";
const pageSubCls = "mt-1 text-sm leading-relaxed text-stone-500";
const eyebrowCls = "text-xs font-semibold uppercase tracking-wide text-stone-400";
const sectionLabelCls = "mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400";
function PageHead({ title, sub, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className={h1Cls}>{title}</h1>
        {sub && <p className={pageSubCls}>{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

function StageTrack({ req }) {
  const h = req.history.filter((x) => x.action === "approved" || x.action === "rejected" || x.action === "stock");
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {req.chain.map((st, i) => {
        const dec = h[i]; const cur = req.status === "approval" && i === h.length; let dot, line, ic;
        const passed = dec && (dec.action === "approved" || dec.action === "stock");
        if (passed) { dot = "bg-emerald-500 text-white border-emerald-500"; line = "bg-emerald-400"; ic = <Check className="h-4 w-4" />; }
        else if (dec && dec.action === "rejected") { dot = "bg-rose-500 text-white border-rose-500"; line = "bg-rose-300"; ic = <X className="h-4 w-4" />; }
        else if (cur) { dot = "bg-amber-400 text-stone-900 border-amber-400 ring-4 ring-amber-100 animate-pulse motion-reduce:animate-none"; line = "bg-stone-200"; ic = <span className="font-mono text-xs font-bold">{i + 1}</span>; }
        else { dot = "bg-white text-stone-400 border-stone-300"; line = "bg-stone-200"; ic = <span className="font-mono text-xs font-bold">{i + 1}</span>; }
        return (
          <div key={i} className="flex w-24 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center"><div className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : line}`} /><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${dot}`}>{ic}</div><div className={`h-0.5 flex-1 ${i === req.chain.length - 1 ? "bg-transparent" : line}`} /></div>
            <div className="mt-1.5 flex items-center gap-1 px-0.5 text-xs font-medium leading-tight text-stone-700">{st.role === "warehouse" && <Warehouse className="h-3 w-3 text-teal-600" />}{st.label || st.approverName}</div><div className="text-xs leading-tight text-stone-400">{st.approverName}</div>
          </div>
        );
      })}
    </div>
  );
}

function RequestRows({ list, me, onOpen, empty, showRequester, showDept, showHolder, users = [] }) {
  const [sortK, setSortK] = useState("created"), [dir, setDir] = useState(-1);
  const holderOf = (r) => { if (r.status === "approval") { const st = r.chain[r.currentStageIndex]; return st ? st.approverName : "—"; } if (r.status === "supply") { if (!r.assignee) return "пул снабжения"; const u = users.find((x) => x.id === r.assignee); return u ? u.name.split(/[\s\u2014]+/)[0] : "снабжение"; } if (r.status === "fulfilled") return "заявитель"; return "—"; };
  const cols = [
    { k: "number", t: "№", w: "", cmp: (a, b) => a.number.localeCompare(b.number, "ru") },
    { k: "title", t: "Заявка", w: "", cmp: (a, b) => reqTitle(a).localeCompare(reqTitle(b), "ru") },
    { k: "type", t: "Тип", w: "", cmp: (a, b) => TYPES[a.type].short.localeCompare(TYPES[b.type].short, "ru") },
    ...(showDept ? [{ k: "dept", t: "Отдел", w: "", cmp: (a, b) => (a.departmentName || "").localeCompare(b.departmentName || "", "ru") }] : []),
    ...(showRequester ? [{ k: "req", t: "Заявитель", w: "", cmp: (a, b) => ((a.history[0] || {}).byName || "").localeCompare((b.history[0] || {}).byName || "", "ru") }] : []),
    ...(showHolder ? [{ k: "holder", t: "У кого", w: "", cmp: (a, b) => holderOf(a).localeCompare(holderOf(b), "ru") }] : []),
    { k: "created", t: "Дата", w: "", cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
    { k: "overdue", t: "Просрочка", w: "", cmp: (a, b) => overdueDays(a) - overdueDays(b) },
    { k: "status", t: "Статус", w: "", cmp: (a, b) => ORDER[a.status] - ORDER[b.status] },
  ];
  const col = cols.find((c) => c.k === sortK) || cols[0];
  const rows = [...list].sort((a, b) => dir * col.cmp(a, b));
  const click = (k) => { if (k === sortK) setDir((d) => -d); else { setSortK(k); setDir(1); } };
  if (list.length === 0) return <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center"><ClipboardList className="mx-auto h-7 w-7 text-stone-300" /><p className="mt-2 text-sm text-stone-500">{empty}</p></div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-sm" style={{ minWidth: 720 }}>
        <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">{cols.map((c) => <th key={c.k} className="px-3 py-2.5 font-semibold uppercase tracking-wide"><button onClick={() => click(c.k)} className={`inline-flex items-center gap-0.5 hover:text-stone-900 ${sortK === c.k ? "text-stone-900" : ""}`}>{c.t}{sortK === c.k && (dir === 1 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}</button></th>)}</tr></thead>
        <tbody>{rows.map((r) => { const nAtt = (r.attachments || []).length; const prog = TYPES[r.type].items && r.status === "supply" ? itemProgress(r) : null; return (
          <tr key={r.id} onClick={() => onOpen(r.id)} className={`cursor-pointer border-b border-l-4 border-stone-100 transition hover:bg-stone-50 ${TYPE_BORDER[r.type] || "border-l-stone-300"} ${r.postponed ? "opacity-60" : ""}`}>
            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-stone-900">{r.number}</td>
            <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><span className="block truncate text-stone-800" style={{ maxWidth: 240 }}>{reqTitle(r)}</span>{r.objectName && reqTitle(r) !== r.objectName && <span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-${r.objectColor || "stone"}-400`} title={r.objectName} />}{nAtt > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-stone-400"><Paperclip className="h-3 w-3" />{nAtt}</span>}{prog && prog.total > 0 && <span className={`inline-flex shrink-0 items-center gap-0.5 text-xs ${prog.done === prog.total ? "text-emerald-600" : "text-stone-400"}`}><ListChecks className="h-3 w-3" />{prog.done}/{prog.total}</span>}{r.consolidatedInto && <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-50 px-1 font-mono text-xs text-amber-700"><Layers className="h-3 w-3" />{r.consolidatedInto.number}</span>}</div></td>
            <td className="px-3 py-2.5"><TypeBadge type={r.type} /></td>
            {showDept && <td className="whitespace-nowrap px-3 py-2.5 text-xs text-stone-500">{r.departmentName || "—"}</td>}
            {showRequester && <td className="whitespace-nowrap px-3 py-2.5 text-xs text-stone-500">{(r.history[0] || {}).byName || "—"}</td>}
            {showHolder && <td className="whitespace-nowrap px-3 py-2.5 text-xs text-stone-500">{holderOf(r)}</td>}
            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-stone-500">{fmtDate(r.createdAt)}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-xs">{(() => { const d = overdueDays(r); return d > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />{d} {dayWord(d)}</span> : <span className="text-stone-300">—</span>; })()}</td>
            <td className="px-3 py-2.5"><StatusBadge s={r.status} /></td>
          </tr>
        ); })}</tbody>
      </table>
    </div>
  );
}

function RequestCards({ list, me, onOpen, empty, onNew, showRequester, showDept, showHolder, selectMode, selectAnyType, selectedIds = [], onToggleSelect }) {
  if (list.length === 0) return <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center"><ClipboardList className="mx-auto h-7 w-7 text-stone-300" /><p className="mt-2 text-sm text-stone-500">{empty}</p>{onNew && <button onClick={onNew} className={`mt-3 ${btnGhost}`}><Plus className="h-4 w-4" /> Создать заявку</button>}</div>;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {list.map((r) => {
        const stage = r.chain[r.currentStageIndex]; const mineNow = r.status === "approval" && stage && stage.approverId === me.id;
        const selectable = selectMode && (selectAnyType || TYPES[r.type].items); const selected = selectedIds.includes(r.id);
        const prog = TYPES[r.type].items && r.status === "supply" ? itemProgress(r) : null;
        const nAtt = (r.attachments || []).length;
        const handle = () => { if (selectMode) { if (selectable) onToggleSelect(r.id); } else onOpen(r.id); };
        return (
          <button key={r.id} onClick={handle} className={`flex w-full flex-col gap-1 overflow-hidden rounded-lg border border-l-4 border-stone-200 bg-white p-2.5 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${TYPE_BORDER[r.type] || "border-l-stone-300"} ${selected ? "ring-2 ring-amber-300" : "hover:border-stone-300"} ${selectMode && !selectable ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-2">
              {selectMode && selectable && <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300"}`}>{selected && <Check className="h-3 w-3" />}</span>}
              <span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{reqTitle(r)}</span>
              <span className="shrink-0"><StatusBadge s={r.status} /></span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
              <TypeBadge type={r.type} />
              {showDept && r.departmentName && <DeptChip name={r.departmentName} />}
              {r.objectName && reqTitle(r) !== r.objectName && <span className="inline-flex min-w-0 max-w-full items-center gap-1"><span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-${r.objectColor || "stone"}-400`} /><span className="truncate">{r.objectName}</span></span>}
              <span className="inline-flex shrink-0 items-center gap-1 font-mono"><Calendar className="h-3 w-3" />{fmtDate(r.createdAt)}</span>
              <OverdueBadge r={r} />
              <EtaChip r={r} />
              {showRequester && r.history[0] && <span className="inline-flex shrink-0 items-center gap-1"><User className="h-3 w-3" />{r.history[0].byName}</span>}
              {prog && prog.total > 0 && <span className={`inline-flex shrink-0 items-center gap-1 ${prog.done === prog.total ? "text-emerald-600" : ""}`}><ListChecks className="h-3 w-3" />{prog.done}/{prog.total}</span>}
              {nAtt > 0 && <span className="inline-flex shrink-0 items-center gap-1"><Paperclip className="h-3 w-3" />{nAtt}</span>}
              {r.postponed && <span className="inline-flex shrink-0 items-center gap-1 text-stone-400"><Pause className="h-3 w-3" />отлож.</span>}{r.consolidatedInto && <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-amber-700"><Layers className="h-3 w-3" />{r.consolidatedInto.number}</span>}
              {mineNow && <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1 text-amber-700"><Clock className="h-3 w-3" />ждёт вас</span>}
            </div>
            {showHolder && <div className="w-full truncate border-t border-stone-100 pt-1 text-xs text-stone-500">{holderText(r)}</div>}
          </button>
        );
      })}
    </div>
  );
}

function LoginScreen({ users, onLogin, brandingVer, logo }) {
  const [login, setLogin] = useState(""), [key, setKey] = useState(""), [err, setErr] = useState(""), [showDemo, setShowDemo] = useState(false);
  const submit = () => { const u = users.find((x) => x.login.toLowerCase() === login.trim().toLowerCase() && x.key === key.trim()); if (!u) return setErr("Неверный логин или ключ."); setErr(""); onLogin(u.id); };
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center"><div className="mx-auto mb-3 flex justify-center"><CompanyLogo data={{ logo }} ver={brandingVer || 0} size={12} rounded="rounded-xl" fallbackIcon="h-7 w-7" h={72} maxW={320} /></div><h1 className="text-lg font-semibold text-stone-900">WorkFlow</h1><p className="mt-1 text-sm text-stone-500">Вход по логину и ключу</p></div>
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div><label className={labelCls}>Логин</label><input className={inputCls} value={login} onChange={(e) => setLogin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="например, prorab" autoFocus /></div>
          <div><label className={labelCls}>Ключ доступа</label><input className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="выданный ключ" type="password" /></div>
          {err && <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> {err}</div>}
          <button onClick={submit} className={`${btnPrimary} w-full`}><KeyRound className="h-4 w-4" /> Войти</button>
        </div>
        <button onClick={() => setShowDemo((v) => !v)} className="mt-4 flex w-full items-center justify-center gap-1 text-xs text-stone-400 hover:text-stone-600">{showDemo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Демо-доступы для теста</button>
        {showDemo && <div className="mt-2 overflow-hidden rounded-lg border border-stone-200 bg-white text-xs">{users.map((u) => <button key={u.id} onClick={() => { setLogin(u.login); setKey(u.key); }} className="flex w-full items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50"><span className="truncate text-stone-600">{u.name}</span><span className="flex shrink-0 items-center gap-1.5"><code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-stone-700">{u.login}</code><code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-stone-700">{u.key}</code></span></button>)}</div>}
      </div>
    </div>
  );
}

function ServerLogin({ onDone }) {
  const [login, setLogin] = useState("");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!login.trim() || !key) { setErr("Введите логин и ключ."); return; }
    setErr(""); setBusy(true);
    const res = await srvLogin(login.trim(), key);
    setBusy(false);
    if (!res) { setErr("Неверный логин/ключ или сервер недоступен."); return; }
    onDone(res);
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-stone-900"><Building2 className="h-7 w-7" /></div><div><div className="text-lg font-semibold leading-none text-stone-900">ТОО «Интерстиль»</div><div className="mt-1 text-xs text-stone-500">Вход в общую систему</div></div></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <label className={labelCls}>Логин</label>
          <input className={`${inputCls} font-mono`} value={login} onChange={(e) => setLogin(e.target.value)} placeholder="напр. admin" onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
          <label className={`${labelCls} mt-3`}>Ключ</label>
          <div className="flex gap-1.5"><input className={`${inputCls} font-mono`} type={show ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} placeholder="••••" onKeyDown={(e) => e.key === "Enter" && submit()} /><button onClick={() => setShow((v) => !v)} className="rounded-lg border border-stone-300 px-2 text-stone-500 hover:bg-stone-50">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          {err && <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" /> {err}</div>}
          <button onClick={submit} disabled={busy} className={`mt-4 w-full justify-center ${btnPrimary} disabled:opacity-50`}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {busy ? "Вход…" : "Войти"}</button>
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">Данные общие для всех сотрудников. Доступ выдаёт администратор.</p>
      </div>
    </div>
  );
}

function ItemsEditor({ items, setItems, catalog, unitDefault }) {
  const setItem = (id, patch) => setItems((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-2">
          <span className="w-5 shrink-0 text-center font-mono text-xs text-stone-400">{i + 1}</span>
          <input className={`${inputCls} flex-1`} value={x.name} onChange={(e) => setItem(x.id, { name: e.target.value })} placeholder="Наименование" />
          <input className={`${inputCls} w-20 font-mono`} value={x.qty} onChange={(e) => setItem(x.id, { qty: e.target.value })} placeholder="кол-во" inputMode="decimal" />
          <select className={`${inputCls} w-24`} value={x.unit} onChange={(e) => setItem(x.id, { unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          <button onClick={() => setItems((a) => (a.length > 1 ? a.filter((y) => y.id !== x.id) : a))} className="rounded-md p-2 text-stone-400 hover:bg-stone-200 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button onClick={() => setItems((a) => [...a, { id: uid(), catalogId: "", name: "", unit: unitDefault, qty: "", note: "", fulfilled: false, stock: {} }])} className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900"><Plus className="h-3.5 w-3.5" /> Добавить позицию</button>
    </div>
  );
}

/* ─── Новая заявка ─── */
function PickType({ onPick, onCancel }) {
  return (
    <div>
      <button onClick={onCancel} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="h-4 w-4" /> К списку</button>
      <h1 className="mb-1 text-xl font-semibold leading-tight tracking-tight text-stone-900">Новая заявка</h1>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Выберите тип — от него зависит маршрут согласования.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{TYPE_KEYS.map((k) => { const t = TYPES[k]; const Icon = t.icon; return <button key={k} onClick={() => onPick(k)} className={`group flex items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 border-stone-200 hover:border-${t.color}-300`}><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-${t.color}-50 text-${t.color}-600`}><Icon className="h-6 w-6" /></div><div><div className="font-medium text-stone-900">{t.pick}</div><div className="text-xs text-stone-400">{t.items ? "со списком позиций" : "по реквизитам"}</div></div></button>; })}</div>
    </div>
  );
}

const isToday = (iso) => { const d = new Date(iso), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };
const todayPlus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0"); return `${d.getFullYear()}-${m}-${dd}`; };
function VehicleField({ value, onChange, vehicles }) {
  const known = vehicles.some((v) => v.name === value);
  const [other, setOther] = useState(value !== "" && !known);
  if (other) return <div className="flex gap-1.5"><input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Название техники вручную" /><button onClick={() => { setOther(false); onChange(""); }} className={btnGhost} title="Выбрать из списка"><List className="h-4 w-4" /></button></div>;
  return <select className={inputCls} value={known ? value : ""} onChange={(e) => { if (e.target.value === "__other") { setOther(true); onChange(""); } else onChange(e.target.value); }}><option value="">— выберите технику —</option>{vehicles.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}<option value="__other">Другое (ввести вручную)…</option></select>;
}

function NewRequest({ type, data, me, onCancel, onCreate, onDraft, initial }) {
  const [pendFiles, setPendFiles] = useState([]);
  const chainForDept = (dep) => ((data.chains && data.chains[dep] && data.chains[dep][type]) || []).filter((st) => st.approverId);
  const newFileRef = useRef(null);
  const t = TYPES[type]; const lockedDept = !!me.departmentId;
  const [dept, setDept] = useState(me.departmentId || (data.departments[0] ? data.departments[0].id : ""));
  const myObjects = me.role === "admin" ? data.objects : data.objects.filter((o) => (o.userIds || []).includes(me.id));
  const [objectId, setObjectId] = useState(initial ? initial.objectId || "" : "");
  const [fields, setFields] = useState(initial ? { ...initial.fields } : {}); const [priority, setPriority] = useState(initial && initial.priority !== "Срочно" ? initial.priority : "Обычный"); const [note, setNote] = useState(initial ? initial.note || "" : ""); const [due, setDue] = useState(todayPlus(2));
  const [items, setItems] = useState(t.items ? (initial && initial.items && initial.items.length ? initial.items.map((x) => ({ id: uid(), catalogId: x.catalogId || "", name: x.name, unit: x.unit, qty: x.qty, note: x.note || "", fulfilled: false, stock: {} })) : [{ id: uid(), catalogId: "", name: "", unit: t.unit, qty: "", note: "", fulfilled: false, stock: {} }]) : []);
  const [err, setErr] = useState("");
  const chain = (data.chains[dept] && data.chains[dept][type]) || [];
  const minDue = todayPlus(2);
  const urgentLimit = data.urgentLimit == null ? 3 : data.urgentLimit;
  const urgentToday = data.requests.filter((r) => r.priority === "Срочно" && isToday(r.createdAt)).length;
  const urgentFull = urgentLimit > 0 && urgentToday >= urgentLimit;
  const setF = (k, v) => setFields((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!dept) return setErr("Выберите отдел.");
    for (const f of t.fields) if (f.required && !String(fields[f.key] || "").trim()) return setErr(`Заполните поле «${f.label}».`);
    const clean = items.filter((x) => x.name.trim());
    if (t.items && clean.length === 0) return setErr("Добавьте хотя бы одну позицию.");
    const urgent = priority === "Срочно";
    if (urgent && urgentFull) return setErr("Сегодня уже 3 срочные заявки — лимит на день исчерпан. Поставьте обычный приоритет и срок от 2 дней.");
    if (!urgent) { if (!due) return setErr("Укажите срок исполнения."); if (due < minDue) return setErr("Срок не может быть раньше чем через 2 дня от подачи."); }
    if (!objectId) return setErr("Выберите объект — заявку без объекта подать нельзя.");
    const obj = data.objects.find((o) => o.id === objectId);
    setErr(""); onCreate(type, { fields, priority, due: urgent ? "" : due, note: note.trim(), items: clean, departmentId: dept, objectId, objectName: obj ? obj.name : "", objectColor: obj ? obj.color : "" }, pendFiles);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onCancel} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="h-4 w-4" /> Назад</button>
      <div className="mb-4 flex items-center gap-2"><div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${t.color}-50 text-${t.color}-600`}><t.icon className="h-5 w-5" /></div><h1 className="text-xl font-semibold leading-tight tracking-tight text-stone-900">{t.pick}</h1></div>
      {initial && <div className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">Черновик заполнен по образцу заявки <span className="font-mono font-semibold">{initial.number}</span> — проверьте данные и срок перед отправкой.</div>}
      <div className={`space-y-4 p-4 sm:p-5 ${card}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Отдел</label>{lockedDept ? <div className="pt-1"><DeptChip name={deptName(data, dept)} /></div> : <select className={inputCls} value={dept} onChange={(e) => setDept(e.target.value)}>{data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}</div>
          <div><label className={labelCls}>Объект *</label><select className={inputCls} value={objectId} onChange={(e) => setObjectId(e.target.value)}><option value="">— выберите объект —</option>{myObjects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>{myObjects.length === 0 && <p className="mt-1 text-xs text-amber-700">Вам не назначены объекты — обратитесь к администратору.</p>}</div>
        </div>
        {t.fields.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{t.fields.map((f) => <div key={f.key} className={f.key === "purpose" || f.key === "route" || f.key === "cargo" ? "sm:col-span-2" : ""}><label className={labelCls}>{f.label}{f.required && " *"}</label>{f.key === "vehicle" && (data.vehicles || []).length > 0 ? <VehicleField value={fields[f.key] || ""} onChange={(v) => setF(f.key, v)} vehicles={data.vehicles} /> : <input className={inputCls} type={f.date ? "date" : "text"} inputMode={f.money ? "decimal" : undefined} value={fields[f.key] || ""} onChange={(e) => setF(f.key, e.target.value)} placeholder={f.money ? "в тенге" : ""} />}</div>)}</div>}
        {t.items && (<div><label className="mb-2 block text-xs font-medium text-stone-600">{t.itemsLabel}</label><ItemsEditor items={items} setItems={setItems} catalog={data.catalog} unitDefault={t.unit} /></div>)}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Приоритет</label><select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p} disabled={p === "Срочно" && urgentFull && priority !== "Срочно"}>{p}{p === "Срочно" && urgentLimit > 0 ? ` · сегодня ${urgentToday}/${urgentLimit}` : ""}</option>)}</select></div>
          {priority === "Срочно"
            ? <div><label className={labelCls}>Срок</label><div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" /> Срочная — без срока, вне очереди</div></div>
            : <div><label className={labelCls}>Срок исполнения *</label><input className={inputCls} type="date" min={minDue} value={due} onChange={(e) => setDue(e.target.value)} /><p className="mt-1 text-xs text-stone-400">Не раньше чем через 2 дня от подачи.</p></div>}
        </div>
        <div><label className={labelCls}>Примечание</label><textarea className={`${inputCls} h-20 resize-y`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Обоснование, особенности…" /></div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3"><div className="mb-1.5 text-xs font-medium text-stone-500">Маршрут · {deptName(data, dept)} · {t.label}</div>{chain.length === 0 ? <p className="text-xs text-amber-700">Цепочка не настроена — заявка сразу попадёт в снабжение.</p> : <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">{chain.map((st) => { const u = data.users.find((y) => y.id === st.approverId); return <span key={st.id} className="inline-flex items-center gap-1.5"><span className="rounded-md border border-stone-200 bg-white px-2 py-0.5">{st.label || (u ? u.name : "—")}</span><ArrowRight className="h-3 w-3 text-stone-300" /></span>; })}<span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700"><Package className="h-3 w-3" /> Снабжение</span></div>}</div>
        <div className={`p-4 ${card}`}>
        <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Paperclip className="h-4 w-4" /> Фото и файлы {pendFiles.length > 0 && <span className="text-stone-400">· {pendFiles.length}</span>}</div><input ref={newFileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { Array.from(e.target.files || []).forEach((f) => { const fname = f.name || "фото.jpg"; const fmime = f.type || "image/jpeg"; fileToDataUrl(f, (dataUrl) => { if (!dataUrl) { appConfirm("Не удалось прочитать файл «" + fname + "». Попробуйте другой.", { okText: "Понятно" }); return; } const bytes = Math.round((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 0.75); if (bytes > 1500000) { appConfirm("Файл «" + fname + "» слишком большой даже после сжатия и не был добавлен. Прикрепите фото (не документ-скан) или файл поменьше.", { okText: "Понятно" }); return; } if (dataSize(data) + dataUrl.length > STORAGE_WARN) { appConfirm("Не хватает места в хранилище — фото «" + fname + "» не добавлено. Освободите место: удалите фото из старых заявок (Настройки → Данные покажут занятый объём).", { okText: "Понятно" }); return; } setPendFiles((a) => [...a, { name: fname, mime: fmime, size: bytes, dataUrl }]); }); }); e.target.value = ""; }} /><button onClick={() => newFileRef.current && newFileRef.current.click()} className={btnSm}><Upload className="h-3.5 w-3.5" /> Добавить</button></div>
        {pendFiles.length === 0 ? <p className="text-xs text-stone-400">Можно приложить фото образца, счёт или чертёж.</p> : <div className="flex flex-wrap gap-2">{pendFiles.map((f, i) => <div key={i} className="relative">{f.mime.startsWith("image/") ? <img src={f.dataUrl} alt={f.name} className="h-16 w-16 rounded-lg border border-stone-200 object-cover" /> : <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-1"><Paperclip className="h-4 w-4 text-stone-400" /><span className="w-full truncate text-center text-xs text-stone-500">{f.name}</span></div>}<button onClick={() => setPendFiles((a) => a.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500 shadow-sm hover:text-rose-600" title="Убрать"><X className="h-3 w-3" /></button></div>)}</div>}
      </div>
      {chainForDept(dept).length === 0 && <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" /> <span>Для этого отдела и типа заявки <b>маршрут согласования не настроен</b> — заявка уйдёт сразу в снабжение, без согласования. Сообщите администратору, если так быть не должно.</span></div>}
      {err && <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" /> {err}</div>}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end"><button onClick={onCancel} className={`${btnGhost} w-full sm:w-auto`}>Отмена</button>{onDraft && <button onClick={() => onDraft({ type, objectId, fields, priority, note, items: items.filter((x) => x.name.trim()) })} className={`${btnGhost} w-full sm:w-auto`}><Save className="h-4 w-4" /> В черновики</button>}<button onClick={submit} className={`${btnPrimary} w-full sm:w-auto`}><Send className="h-4 w-4" /> Подать заявку</button></div>
      </div>
    </div>
  );
}

/* ─── Списки по ролям ─── */
function RequesterHome({ data, me, onOpen, onNew, onDraftOpen, api }) {
  const draft = (data.drafts || {})[me.id];
  const isDesktop = useIsDesktop();
  const mine = data.requests.filter((r) => r.requesterId === me.id && !r.consolidatedInto); const active = mine.filter((r) => r.status !== "done" && r.status !== "rejected"); const waiting = mine.filter((r) => r.status === "fulfilled"); const returned = mine.filter((r) => r.status === "returned"); const dn = deptName(data, me.departmentId);
  return (
    <div>
      <div className="mb-4 flex justify-end"><button onClick={onNew} className={btnPrimary}><Plus className="h-4 w-4" /> Новая заявка</button></div>
      {draft && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 p-3"><Save className="h-4 w-4 shrink-0 text-stone-500" /><div className="min-w-0 flex-1 text-sm text-stone-700"><span className="font-medium">Черновик:</span> {TYPES[draft.type] ? TYPES[draft.type].short : ""}{draft.items && draft.items.length ? ` · позиций: ${draft.items.length}` : ""} <span className="text-xs text-stone-400">от {fmtDateTime(draft.savedAt)}</span></div><div className="flex shrink-0 gap-1.5"><button onClick={() => onDraftOpen(draft)} className={btnSm}>Продолжить</button><button onClick={() => api.clearDraft()} className={`${btnSm} hover:!text-rose-600`}><Trash2 className="h-3.5 w-3.5" /></button></div></div>}
      {returned.length > 0 && <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800"><span className="font-medium">{returned.length} возвращено на доработку</span> — откройте заявку, исправьте и отправьте повторно.</div>}
      {waiting.length > 0 && <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800"><span className="font-medium">{waiting.length} выполнено снабжением</span> — подтвердите получение, открыв заявку.</div>}
      {isDesktop ? <RequestRows list={active.length ? active : mine} me={me} users={data.users} onOpen={onOpen} empty="Заявок пока нет." showHolder /> : <RequestCards list={active.length ? active : mine} me={me} onOpen={onOpen} empty="Заявок пока нет." onNew={onNew} />}
    </div>
  );
}
function QueueView({ data, me, api, onOpen, onOpenOrder, title, sub }) {
  const isDesktop = useIsDesktop();
  const reqQueue = data.requests.filter((r) => r.status === "approval" && r.chain[r.currentStageIndex] && r.chain[r.currentStageIndex].approverId === me.id);
  const orderQueue = (data.orders || []).filter((o) => o.status === "approval" && o.chain[o.currentStageIndex] && o.chain[o.currentStageIndex].approverId === me.id);
  const [selMode, setSelMode] = useState(false);
  const [selReq, setSelReq] = useState([]);
  const [selOrd, setSelOrd] = useState([]);
  const total = reqQueue.length + orderQueue.length;
  const selCount = selReq.length + selOrd.length;
  const toggleReq = (id) => setSelReq((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleOrd = (id) => setSelOrd((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const exitSel = () => { setSelMode(false); setSelReq([]); setSelOrd([]); };
  const selectAll = () => { setSelReq(reqQueue.map((r) => r.id)); setSelOrd(orderQueue.map((o) => o.id)); };
  const bulk = (decision) => {
    if (selCount === 0) return;
    const apply = (comment) => { selReq.forEach((id) => api.decide(id, decision, comment)); selOrd.forEach((id) => api.decideOrder(id, decision, comment)); exitSel(); };
    if (decision === "reject") {
      appPrompt("Причина отклонения для выбранных (" + selCount + "). Заявки вернутся авторам на доработку:", "").then((c) => { const comment = (c || "").trim(); if (!comment) return; apply(comment); });
    } else {
      appConfirm("Согласовать выбранные (" + selCount + ")?").then((ok) => { if (ok) apply(""); });
    }
  };
  const orderRow = (o) => {
    const sel = selOrd.includes(o.id);
    return (
      <button key={o.id} onClick={() => (selMode ? toggleOrd(o.id) : onOpenOrder(o.id))} className={`flex w-full items-center gap-2 overflow-hidden rounded-lg border bg-white p-3 text-left shadow-sm transition ${sel ? "border-sky-500 ring-2 ring-sky-300" : "border-stone-200 hover:border-sky-300"}`}>
        {selMode && <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${sel ? "border-sky-500 bg-sky-500 text-white" : "border-stone-300"}`}>{sel && <Check className="h-3.5 w-3.5" />}</span>}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{o.number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{o.ipName || "—"}</span></span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500">{o.objectName && <span className="inline-flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full bg-${o.objectColor || "stone"}-400`} />{o.objectName}</span>}<span className="inline-flex items-center gap-1 font-mono"><Calendar className="h-3 w-3" />{fmtDate(o.createdAt)}</span><span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{o.lines.length}</span></span>
        </span>
        <span className="shrink-0 font-mono text-sm font-semibold text-stone-700">{fmtMoney(orderTotal(o))}</span>
      </button>
    );
  };
  return (
    <div className={selMode ? "pb-20" : ""}>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {total > 0 && <button onClick={() => (selMode ? exitSel() : setSelMode(true))} className={selMode ? `${btnGhost} border-amber-400 text-amber-700` : btnGhost}><ListChecks className="h-4 w-4" /> {selMode ? "Отмена" : "Выбрать"}</button>}
      </div>
      {selMode && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><span>Отметьте заявки и наряды — решение применится ко всем сразу.</span>{total > 0 && <button onClick={selectAll} className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-700">Выбрать все ({total})</button>}</div>}
      {reqQueue.length > 0 && <div className="mb-5">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><ClipboardList className="h-4 w-4 text-amber-600" /> Заявки <span className="font-mono text-stone-400">{reqQueue.length}</span></div>
        {selMode ? <RequestCards list={reqQueue} me={me} onOpen={() => {}} empty="" showRequester showDept selectMode selectAnyType selectedIds={selReq} onToggleSelect={toggleReq} /> : (isDesktop ? <RequestRows list={reqQueue} me={me} users={data.users} onOpen={onOpen} empty="" showRequester showDept /> : <RequestCards list={reqQueue} me={me} onOpen={onOpen} empty="" showRequester showDept />)}
      </div>}
      {orderQueue.length > 0 && <div className="mb-5">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><ScrollText className="h-4 w-4 text-sky-600" /> Наряды <span className="font-mono text-stone-400">{orderQueue.length}</span></div>
        <div className="space-y-2">{orderQueue.map(orderRow)}</div>
      </div>}
      {total === 0 && <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center"><Inbox className="mx-auto h-7 w-7 text-stone-300" /><p className="mt-2 text-sm text-stone-500">Нет заявок и нарядов, ожидающих вас.</p></div>}
      {selMode && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white p-3 shadow-lg lg:left-60"><div className="mx-auto max-w-5xl"><div className="mb-2 text-sm text-stone-600 sm:mb-0 sm:hidden">Выбрано: <span className="font-semibold text-stone-900">{selCount}</span></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="hidden text-sm text-stone-600 sm:inline">Выбрано: <span className="font-semibold text-stone-900">{selCount}</span></span><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><button disabled={selCount === 0} onClick={() => bulk("reject")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 sm:w-auto"><X className="h-4 w-4" /> Отклонить все</button><button disabled={selCount === 0} onClick={() => bulk("approve")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 sm:w-auto"><Check className="h-4 w-4" /> Согласовать все</button></div></div></div></div>}
    </div>
  );
}

function DateRange({ from, setFrom, to, setTo }) {
  return (
    <div className="flex w-full items-center gap-1.5 lg:w-auto">
      <span className="shrink-0 text-xs font-medium text-stone-400">Дата:</span>
      <div className="flex flex-1 items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 lg:flex-none"><Calendar className="h-3.5 w-3.5 shrink-0 text-stone-400" /><span className="shrink-0 text-xs text-stone-400">с</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full min-w-0 bg-transparent text-xs text-stone-700 focus:outline-none lg:w-auto" /></div>
      <div className="flex flex-1 items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 lg:flex-none"><span className="shrink-0 text-xs text-stone-400">по</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full min-w-0 bg-transparent text-xs text-stone-700 focus:outline-none lg:w-auto" /></div>
      {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" title="Сбросить даты"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

function FilterBar({ deptF, setDeptF, typeF, setTypeF, q, setQ, departments, right, dateFrom, setDateFrom, dateTo, setDateTo }) {
  const [open, setOpen] = useState(false);
  const active = (deptF !== "all" ? 1 : 0) + (typeF !== "all" ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5" style={{ minWidth: 170 }}><Search className="h-4 w-4 shrink-0 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру или названию" className="w-full min-w-0 bg-transparent text-sm focus:outline-none" /></div>
        <button onClick={() => setOpen((v) => !v)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${open || active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><Filter className="h-4 w-4" /> Фильтры{active > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${open ? "bg-white text-stone-900" : "bg-amber-400 text-stone-900"}`}>{active}</span>}</button>
        {right}
      </div>
      <div className={`${open ? "flex" : "hidden"} flex-wrap items-center gap-1.5`}>
        <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={`${selectCls} flex-1 sm:flex-none`}><option value="all">Все отделы</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className={`${selectCls} flex-1 sm:flex-none`}><option value="all">Все типы</option>{TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].short}</option>)}</select>
        <DateRange from={dateFrom} setFrom={setDateFrom} to={dateTo} setTo={setDateTo} />
        {active > 0 && <button onClick={() => { setDeptF("all"); setTypeF("all"); setDateFrom(""); setDateTo(""); }} className="shrink-0 text-xs font-medium text-stone-500 underline hover:text-stone-800">Сбросить</button>}
      </div>
    </div>
  );
}

function Avatar({ name }) {
  const initials = (name || "?").split(/[\s\u2014]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const palette = ["bg-sky-200 text-sky-800", "bg-emerald-200 text-emerald-800", "bg-violet-200 text-violet-800", "bg-amber-200 text-amber-800", "bg-rose-200 text-rose-800", "bg-teal-200 text-teal-800"];
  let h = 0; for (const c of (name || "x")) h = (h + c.charCodeAt(0)) % palette.length;
  return <span title={name} className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${palette[h]}`}>{initials || "?"}</span>;
}
const flagColorOf = (p) => ({ "Срочно": "text-rose-500", "Высокий": "text-amber-500", "Обычный": "text-stone-300", "Низкий": "text-stone-200" }[p] || "text-stone-300");
const stageOf = (r) => r.supplyStage || "new";

let _lastSupplyTab = null;
function useIsDesktop() {
  const [desk, setDesk] = useState(typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on(); mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, []);
  return desk;
}

function SupplyHub({ data, me, api, onOpen, onConsolidate, onPrintBatch }) {
  const [list, setListRaw] = useState(() => _lastSupplyTab || "inbox");
  const setList = (v) => { _lastSupplyTab = v; setListRaw(v); };
  const isDesktop = useIsDesktop();
  const deskView = data.deskView || "table"; const setDeskView = api.setDeskView;
  const [view, setView] = useState("list");
  useEffect(() => { setView(isDesktop ? deskView : "list"); }, [isDesktop, deskView]);
  const [sort, setSort] = useState("priority");
  const [deptF, setDeptF] = useState("all"), [typeF, setTypeF] = useState("all"), [q, setQ] = useState(""), [objF, setObjF] = useState("all"), [dateFrom, setDateFrom] = useState(""), [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = (deptF !== "all" ? 1 : 0) + (typeF !== "all" ? 1 : 0) + (objF !== "all" ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);
  const [mergeMode, setMergeMode] = useState(false), [sel, setSel] = useState([]);
  const [dueOpen, setDueOpen] = useState(null), [drag, setDrag] = useState(null);
  const [tsort, setTsort] = useState({ k: "created", d: -1 });
  const myId = me.id;
  const todayStart = new Date(new Date().toDateString());
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const supply = data.requests.filter((r) => r.status === "supply" && !r.consolidatedInto);
  const fulfilled = data.requests.filter((r) => r.status === "fulfilled");
  const doneRecent = [...data.requests.filter((r) => r.status === "done")].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  const supplyUsers = data.users.filter((u) => u.role === "supply");
  const lists = [
    { k: "inbox", t: "Входящие", icon: Inbox, items: supply.filter((r) => !r.assignee) },
    { k: "mine", t: "Мои", icon: User, items: supply.filter((r) => r.assignee === myId) },
    { k: "urgent", t: "Срочные", icon: AlertTriangle, items: supply.filter((r) => ["Срочно", "Высокий"].includes(r.priority)) },
    { k: "today", t: "Срок подошёл", icon: Calendar, items: supply.filter((r) => r.due && new Date(r.due) <= todayEnd) },
    { k: "all", t: "Все активные", icon: Layers, items: supply },
    { k: "postponed", t: "Отложенные", icon: Pause, items: supply.filter((r) => r.postponed) },
    { k: "done", t: "Выполнено", icon: CheckCircle2, items: [...fulfilled, ...doneRecent] },
  ];
  const cur = lists.find((l) => l.k === list) || lists[0];
  let rows = cur.items;
  if (deptF !== "all") rows = rows.filter((r) => r.departmentId === deptF);
  if (typeF !== "all") rows = rows.filter((r) => r.type === typeF);
  if (objF !== "all") rows = rows.filter((r) => r.objectId === objF);
  rows = rows.filter((r) => inDateRange(r.createdAt, dateFrom, dateTo));
  if (q.trim()) { const x = q.toLowerCase(); rows = rows.filter((r) => r.number.toLowerCase().includes(x) || reqTitle(r).toLowerCase().includes(x)); }
  const sorters = { priority: (a, b) => (PRANK[a.priority] - PRANK[b.priority]) || (new Date(a.createdAt) - new Date(b.createdAt)), created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt), due: (a, b) => (a.due ? new Date(a.due).getTime() : 8.64e15) - (b.due ? new Date(b.due).getTime() : 8.64e15), object: (a, b) => (a.objectName || "яя").localeCompare(b.objectName || "яя", "ru") || (PRANK[a.priority] - PRANK[b.priority]), overdue: (a, b) => (overdueDays(b) - overdueDays(a)) || ((a.due ? new Date(a.due).getTime() : 8.64e15) - (b.due ? new Date(b.due).getTime() : 8.64e15)) };
  rows = [...rows].sort(sorters[sort]);
  const toggleSel = (id) => setSel((sx) => (sx.includes(id) ? sx.filter((x) => x !== id) : [...sx, id]));
  const completeReq = (r) => { const p = itemProgress(r); const ask = () => appPrompt("Фактически потрачено по заявке, ₸ (можно оставить пустым):", r.spent != null ? String(r.spent) : "").then((sIn) => { if (sIn === null) return; const v = num(sIn); api.fulfill(r.id, v > 0 ? v : null); }); if (p.total && p.done < p.total) appConfirm("Не все позиции закрыты. Отметить заявку выполненной?").then((ok) => { if (ok) ask(); }); else ask(); };
  const canRelease = me.role === "admin" || me.lead;
  const moveToCol = (r, colKey) => {
    if (colKey === "paused") { api.setPostponed(r.id, true); return; }
    if (colKey === "new") { if (!canRelease) return; api.release(r.id); api.setPostponed(r.id, false); return; }
    api.setPostponed(r.id, false); api.setSupplyStage(r.id, colKey); if (!r.assignee) api.claim(r.id);
  };
  const moveStage = (r, dir) => { const order = BOARD_COLS.map((c) => c.k); const i = order.indexOf(colOf(r)); const j = Math.min(order.length - 1, Math.max(0, i + dir)); moveToCol(r, order[j]); };
  const dueBadge = (r) => { if (!r.due) return null; const n = overdueDays(r); if (n > 0) return <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${overdueStyle(n)}`}><AlertTriangle className="h-3 w-3" />просрочено {n} {dayWord(n)}</span>; return <span className="inline-flex shrink-0 items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500"><Calendar className="h-3 w-3" />до {fmtDate(r.due)}</span>; };
  const progChip = (r) => { if (!TYPES[r.type].items) return null; const p = itemProgress(r); return p.total ? <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{p.done}/{p.total}</span> : null; };

  const priSelect = (r) => <select value={r.priority} onChange={(e) => api.setPriority(r.id, e.target.value)} title="Приоритет" className={`rounded-md border bg-white px-1.5 py-1 text-xs font-medium focus:outline-none ${PRI_SELECT[r.priority]}`}>{PRIORITIES.map((pr) => <option key={pr} value={pr}>{pr}</option>)}</select>;
  const objDot = (c) => <span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-${c || "stone"}-400`} />;

  const TCOLS = [
    { k: "number", t: "№", get: (r) => r.number },
    { k: "title", t: "Заявка", get: (r) => reqTitle(r) },
    { k: "type", t: "Тип", get: (r) => TYPES[r.type].short },
    { k: "dept", t: "Отдел", get: (r) => r.departmentName || "" },
    { k: "object", t: "Объект", get: (r) => r.objectName || "" },
    { k: "priority", t: "Приоритет", get: (r) => r.priority, cmp: (a, b) => PRANK[a.priority] - PRANK[b.priority] },
    { k: "due", t: "Срок", get: (r) => (r.due ? fmtDate(r.due) : "—"), cmp: (a, b) => (a.due ? new Date(a.due).getTime() : 8.64e15) - (b.due ? new Date(b.due).getTime() : 8.64e15) },
    { k: "status", t: "Статус", get: (r) => (STATUS[r.status] || {}).t || r.status },
    { k: "created", t: "Создана", get: (r) => fmtDate(r.createdAt), cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
    { k: "spent", t: "Потрачено", get: (r) => (r.spent != null ? r.spent : ""), cmp: (a, b) => (a.spent || 0) - (b.spent || 0) },
  ];
  const tcol = TCOLS.find((c) => c.k === tsort.k) || TCOLS[8];
  const tRows = [...rows].sort((a, b) => tsort.d * (tcol.cmp ? tcol.cmp(a, b) : String(tcol.get(a)).localeCompare(String(tcol.get(b)), "ru")));
  const thClick = (k) => setTsort((prev2) => (prev2.k === k ? { k, d: -prev2.d } : { k, d: 1 }));
  const exportRows = () => downloadFile(`zayavki-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([TCOLS.map((c) => c.t), ...(view === "table" ? tRows : rows).map((r) => TCOLS.map((c) => c.get(r)))]), "text/csv");

  const renderRow = (r) => {
    if (mergeMode) { const items = TYPES[r.type].items; const on = sel.includes(r.id); return (
      <button key={r.id} onClick={() => toggleSel(r.id)} className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left shadow-sm transition ${on ? "border-amber-400 ring-2 ring-amber-200" : "border-stone-200"}`}>
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300"}`}>{on && <Check className="h-3 w-3" />}</span>
        <span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span><TypeBadge type={r.type} /><span className="min-w-0 flex-1 truncate text-sm text-stone-700">{reqTitle(r)}</span>{!items && <span className="shrink-0 text-xs text-stone-400">без позиций</span>}
      </button>
    ); }
    const assignee = supplyUsers.find((u) => u.id === r.assignee);
    const dupObj = r.objectName && reqTitle(r) === r.objectName;
    const canClaimSwipe = !isDesktop && me.role === "supply" && !r.assignee && !r.postponed;
    const canDoneSwipe = !isDesktop && !canClaimSwipe && (me.role === "admin" || r.assignee === me.id) && r.status === "supply";
    return (
      <SwipeRow key={r.id} enabled={canClaimSwipe || canDoneSwipe} actionLabel={canClaimSwipe ? "Взять" : "Выполнено"} actionColor={canClaimSwipe ? "bg-stone-900" : "bg-emerald-600"} onAction={() => (canClaimSwipe ? api.claim(r.id) : completeReq(r))}>
      <div className={`overflow-hidden rounded-lg border border-l-4 border-stone-200 bg-white shadow-sm transition hover:border-stone-300 ${TYPE_BORDER[r.type] || "border-l-stone-300"}`}>
        <div className="flex items-center gap-2 p-2">
          <button onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 flex-col text-left">
            <div className="flex items-center gap-2"><span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{reqTitle(r)}</span></div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500"><TypeBadge type={r.type} /><DeptChip name={r.departmentName} />{r.objectName && !dupObj && <span className="inline-flex min-w-0 items-center gap-1">{objDot(r.objectColor)}<span className="truncate">{r.objectName}</span></span>}{dueBadge(r)}<EtaChip r={r} />{progChip(r)}{(r.attachments || []).length > 0 && <span className="inline-flex shrink-0 items-center gap-1"><Paperclip className="h-3 w-3" />{(r.attachments || []).length}</span>}{r.postponed && <span className="inline-flex shrink-0 items-center gap-1 text-stone-400"><Pause className="h-3 w-3" />отлож.</span>}{r.consolidatedInto && <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-amber-700"><Layers className="h-3 w-3" />{r.consolidatedInto.number}</span>}</div>
          </button>
          {r.status === "supply" ? (
            <div className="flex shrink-0 items-center gap-1">
              {!r.assignee ? <button onClick={() => api.claim(r.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 px-2 py-1 text-xs font-medium text-white hover:bg-stone-800"><Plus className="h-3.5 w-3.5" />Взять</button> : <span className="shrink-0" title={assignee ? assignee.name : ""}><Avatar name={assignee ? assignee.name : "?"} /></span>}
              <button onClick={() => completeReq(r)} title="Отметить выполненной" className="shrink-0 rounded p-1 text-stone-300 hover:bg-emerald-50 hover:text-emerald-600"><CheckCircle2 className="h-5 w-5" /></button>
            </div>
          ) : <span className="shrink-0"><StatusBadge s={r.status} /></span>}
        </div>
      </div>
      </SwipeRow>
    );
  };
  const boardCard = (r) => {
    const assignee = supplyUsers.find((u) => u.id === r.assignee);
    return (
      <div key={r.id} draggable onDragStart={() => setDrag(r.id)} onDragEnd={() => setDrag(null)} className={`cursor-grab rounded-lg border border-l-4 border-stone-200 bg-white p-2 shadow-sm ${TYPE_BORDER[r.type] || "border-l-stone-300"}`}>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><span className="font-mono text-xs font-semibold text-stone-900">{r.number}</span><TypeBadge type={r.type} /></button>
          {r.assignee ? <Avatar name={assignee ? assignee.name : "?"} /> : <button onClick={() => api.claim(r.id)} className="shrink-0 rounded bg-stone-900 px-1.5 py-0.5 text-xs text-white hover:bg-stone-800">Взять</button>}
        </div>
        <button onClick={() => onOpen(r.id)} className="mt-1 block w-full truncate text-left text-xs font-medium text-stone-800">{reqTitle(r)}</button>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-500">{r.objectName && objDot(r.objectColor)}{dueBadge(r)}<EtaChip r={r} />{progChip(r)}</div>
        <div className="mt-1.5 flex items-center gap-0.5 border-t border-stone-100 pt-1">{priSelect(r)}<span className="flex-1" /><button onClick={() => moveStage(r, -1)} className="rounded p-0.5 text-stone-400 hover:bg-stone-100" title="Назад"><ChevronLeft className="h-3.5 w-3.5" /></button><button onClick={() => moveStage(r, 1)} className="rounded p-0.5 text-stone-400 hover:bg-stone-100" title="Дальше"><ChevronRight className="h-3.5 w-3.5" /></button><button onClick={() => completeReq(r)} title="Выполнено" className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button></div>
      </div>
    );
  };

  return (
    <div className={mergeMode ? "pb-20" : ""}>
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5" style={{ minWidth: 170 }}><Search className="h-4 w-4 shrink-0 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="w-full min-w-0 bg-transparent text-sm focus:outline-none" /></div>
          <button onClick={() => setFiltersOpen((v) => !v)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${filtersOpen || activeFilters ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><Filter className="h-4 w-4" /> Фильтры{activeFilters > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${filtersOpen ? "bg-white text-stone-900" : "bg-amber-400 text-stone-900"}`}>{activeFilters}</span>}</button>
          <button onClick={() => { setMergeMode((v) => { const nx = !v; setView(nx ? "list" : (isDesktop ? deskView : "list")); return nx; }); setSel([]); }} className={`shrink-0 ${mergeMode ? `${btnGhost} border-amber-400 text-amber-700` : btnGhost}`} title={mergeMode ? "Отмена" : "Выбрать"}><ListChecks className="h-4 w-4" /><span className="hidden sm:inline"> {mergeMode ? "Отмена" : "Выбрать"}</span></button>
          {!mergeMode && <button onClick={exportRows} className={`shrink-0 ${btnGhost}`} title="Выгрузить текущий список в Excel (CSV)"><FileDown className="h-4 w-4" /><span className="hidden sm:inline"> CSV</span></button>}
          {isDesktop && !mergeMode && <div className="flex shrink-0 rounded-lg border border-stone-300 p-0.5"><button onClick={() => setDeskView("table")} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${view === "table" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"}`} title="Таблица"><Table className="h-4 w-4" /> Таблица</button><button onClick={() => setDeskView("board")} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${view === "board" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"}`} title="Доска"><Columns className="h-4 w-4" /> Доска</button></div>}
        </div>
        <div className={`${filtersOpen ? "block" : "hidden"} space-y-1.5`}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
          {view === "list" && <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${selectCls} w-full lg:w-auto`}><option value="priority">По приоритету</option><option value="created">По дате</option><option value="due">По сроку</option><option value="overdue">По просрочке</option><option value="object">По объекту</option></select>}
          <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={`${selectCls} w-full lg:w-auto`}><option value="all">Все отделы</option>{data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className={`${selectCls} w-full lg:w-auto`}><option value="all">Все типы</option>{TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].short}</option>)}</select>
          <select value={objF} onChange={(e) => setObjF(e.target.value)} className={`${selectCls} w-full lg:w-auto`}><option value="all">Все объекты</option>{data.objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </div>
          <div className="flex items-center gap-2"><DateRange from={dateFrom} setFrom={setDateFrom} to={dateTo} setTo={setDateTo} />{activeFilters > 0 && <button onClick={() => { setDeptF("all"); setTypeF("all"); setObjF("all"); setDateFrom(""); setDateTo(""); }} className="shrink-0 text-xs font-medium text-stone-500 underline hover:text-stone-800">Сбросить</button>}</div>
        </div>
      </div>
      {view !== "board" && <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {lists.map((l) => { const Icon = l.icon; const on = list === l.k; return <button key={l.k} onClick={() => setList(l.k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}><Icon className="h-4 w-4" />{l.t}<span className={`ml-0.5 rounded-full px-1.5 text-xs ${on ? "bg-stone-700 text-stone-200" : "bg-stone-100 text-stone-500"}`}>{l.items.length}</span></button>; })}
      </div>}
      {mergeMode && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Отметьте заявки с позициями — их можно распечатать (2 на лист) или объединить в одну сводную заявку снабжения (одинаковые позиции суммируются, исходные заявки откладываются со ссылкой на сводную).</div>}
      {view === "board" && !mergeMode ? (
        (() => {
          let bs = data.requests.filter((r) => !r.consolidatedInto);
          if (deptF !== "all") bs = bs.filter((r) => r.departmentId === deptF);
          if (typeF !== "all") bs = bs.filter((r) => r.type === typeF);
          if (objF !== "all") bs = bs.filter((r) => r.objectId === objF);
          bs = bs.filter((r) => inDateRange(r.createdAt, dateFrom, dateTo));
          if (q.trim()) { const x = q.toLowerCase(); bs = bs.filter((r) => r.number.toLowerCase().includes(x) || reqTitle(r).toLowerCase().includes(x)); }
          const sb = (arr) => [...arr].sort(sorters[sort]);
          const done = sb(bs.filter((r) => r.status === "fulfilled" || r.status === "done"));
          return (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {BOARD_COLS.map((col) => { const items = sb(bs.filter((r) => r.status === "supply" && colOf(r) === col.k)); return (
                <div key={col.k} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) { const dr = data.requests.find((r) => r.id === drag); if (dr) moveToCol(dr, col.k); setDrag(null); } }} className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-stone-50 p-2" style={{ minWidth: 230 }}>
                  <div className="mb-2 flex items-center justify-between px-1"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><span className={`h-2 w-2 rounded-full ${col.dot}`} /> {col.t}</div><span className="font-mono text-xs text-stone-400">{items.length}</span></div>
                  <div className="space-y-2">{items.map(boardCard)}{items.length === 0 && <div className="rounded-lg border border-dashed border-stone-200 py-6 text-center text-xs text-stone-400">пусто</div>}</div>
                </div>
              ); })}
              <div onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) { const dr = data.requests.find((r) => r.id === drag); if (dr && dr.status === "supply") completeReq(dr); setDrag(null); } }} className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-stone-50 p-2" style={{ minWidth: 230 }}>
                <div className="mb-2 flex items-center justify-between px-1"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Выполнено</div><span className="font-mono text-xs text-stone-400">{done.length}</span></div>
                <div className="space-y-2">{done.map((r) => <button key={r.id} onClick={() => onOpen(r.id)} className="block w-full overflow-hidden rounded-lg border border-l-4 border-stone-200 border-l-emerald-400 bg-white p-2.5 text-left shadow-sm hover:border-stone-300"><div className="flex items-center gap-2"><span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{reqTitle(r)}</span></div><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500"><TypeBadge type={r.type} /><StatusBadge s={r.status} /></div></button>)}{done.length === 0 && <div className="rounded-lg border border-dashed border-stone-200 py-6 text-center text-xs text-stone-400">пусто</div>}</div>
              </div>
            </div>
          );
        })()
      ) : view === "table" && !mergeMode ? (
        rows.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center text-sm text-stone-400">Здесь пусто.</div> : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full text-sm" style={{ minWidth: 920 }}>
              <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">{TCOLS.map((c) => <th key={c.k} className="px-3 py-2 font-semibold uppercase tracking-wide"><button onClick={() => thClick(c.k)} className={`inline-flex items-center gap-0.5 hover:text-stone-900 ${tsort.k === c.k ? "text-stone-900" : ""}`}>{c.t}{tsort.k === c.k && (tsort.d === 1 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}</button></th>)}</tr></thead>
              <tbody>{tRows.map((r) => <tr key={r.id} onClick={() => onOpen(r.id)} className={`cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 ${r.postponed ? "opacity-60" : ""}`}><td className="px-3 py-2 font-mono text-xs font-semibold text-stone-900">{r.number}</td><td className="px-3 py-2 text-stone-800"><span className="block truncate" style={{ maxWidth: 260 }}>{reqTitle(r)}</span></td><td className="px-3 py-2"><TypeBadge type={r.type} /></td><td className="px-3 py-2 text-xs text-stone-500">{r.departmentName}</td><td className="px-3 py-2 text-xs text-stone-500">{r.objectName || "—"}</td><td className="px-3 py-2"><PriorityBadge p={r.priority} /></td><td className="px-3 py-2 font-mono text-xs">{r.due ? fmtDate(r.due) : "—"}</td><td className="px-3 py-2"><StatusBadge s={r.status} /></td><td className="px-3 py-2 font-mono text-xs text-stone-500">{fmtDate(r.createdAt)}</td><td className="px-3 py-2 text-right font-mono text-xs">{r.spent != null ? fmtMoney(r.spent) : "—"}</td></tr>)}</tbody>
            </table>
          </div>
        )
      ) : (
        rows.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center text-sm text-stone-400">{list === "inbox" ? "Пул пуст — новых заявок нет." : list === "mine" ? "Вы пока ничего не взяли в работу." : "Здесь пусто."}</div> : <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">{rows.map(renderRow)}</div>
      )}
      {mergeMode && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white p-3 shadow-lg lg:left-60"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2"><span className="text-sm text-stone-600">Выбрано: <span className="font-semibold text-stone-900">{sel.length}</span></span><div className="flex items-center gap-2"><button disabled={sel.length === 0} onClick={() => onPrintBatch(sel)} className={`${btnGhost} disabled:opacity-40`}><Printer className="h-4 w-4" /> Печать</button><button disabled={sel.length === 0} onClick={() => onConsolidate(sel)} className={`${btnPrimary} disabled:opacity-40`}><Layers className="h-4 w-4" /> Объединить в заявку</button></div></div></div>}
    </div>
  );
}

function SwipeRow({ enabled, actionLabel, actionColor, onAction, children }) {
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  if (!enabled) return children;
  const TH = 72;
  const onTouchStart = (e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, drag: false }; };
  const onTouchMove = (e) => {
    if (!start.current) return;
    const ddx = e.touches[0].clientX - start.current.x, ddy = e.touches[0].clientY - start.current.y;
    if (!start.current.drag && Math.abs(ddx) < 12) return;
    if (!start.current.drag && Math.abs(ddy) > Math.abs(ddx)) { start.current = null; return; }
    start.current.drag = true;
    setDx(Math.max(-120, Math.min(0, ddx)));
  };
  const onTouchEnd = () => { const fire = dx <= -TH; setDx(0); start.current = null; if (fire) onAction(); };
  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className={`absolute inset-y-0 right-0 flex w-28 items-center justify-center text-xs font-semibold text-white ${actionColor}`}>{actionLabel}</div>
      <div style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 0.15s" : "none" }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>{children}</div>
    </div>
  );
}

function EtaChip({ r }) { if (!r.eta || r.status !== "supply") return null; return <span className="inline-flex shrink-0 items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700"><Clock className="h-3 w-3" />исполним к {fmtDate(r.eta)}</span>; }

function OverdueInline({ r }) { const d = overdueDays(r); if (!d) return null; return <span className="ml-1 text-rose-500">просроч. {d}\u00A0дн.</span>; }

function BankView({ data, me, onOpen }) {
  const isDesktop = useIsDesktop();
  const [deptF, setDeptF] = useState("all"), [typeF, setTypeF] = useState("all"), [q, setQ] = useState(""), [dateFrom, setDateFrom] = useState(""), [dateTo, setDateTo] = useState("");
  let list = data.requests.filter((r) => r.status !== "done" && r.status !== "rejected" && !r.consolidatedInto);
  if (deptF !== "all") list = list.filter((r) => r.departmentId === deptF);
  if (typeF !== "all") list = list.filter((r) => r.type === typeF);
  if (q.trim()) { const x = q.toLowerCase(); list = list.filter((r) => r.number.toLowerCase().includes(x) || reqTitle(r).toLowerCase().includes(x)); }
  list = list.filter((r) => inDateRange(r.createdAt, dateFrom, dateTo));
  list = [...list].sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || (PRANK[a.priority] - PRANK[b.priority]) || (new Date(b.createdAt) - new Date(a.createdAt)));
  return <div><div className="mb-3 flex items-center justify-end"><span className="font-mono text-sm text-stone-400">{list.length} в работе</span></div><FilterBar deptF={deptF} setDeptF={setDeptF} typeF={typeF} setTypeF={setTypeF} q={q} setQ={setQ} departments={data.departments} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />{isDesktop ? <RequestRows list={list} me={me} users={data.users} onOpen={onOpen} empty="Сейчас нет заявок в работе." showRequester showDept showHolder /> : <RequestCards list={list} me={me} onOpen={onOpen} empty="Сейчас нет заявок в работе." showRequester showDept showHolder />}</div>;
}

function Bar({ label, value, max, color }) { return <div className="flex items-center gap-2"><div className="w-28 shrink-0 truncate text-xs text-stone-600">{label}</div><div className="h-5 flex-1 overflow-hidden rounded bg-stone-100"><div className={`h-full ${color}`} style={{ width: (max ? Math.max(4, (value / max) * 100) : 0) + "%" }} /></div><div className="w-8 shrink-0 text-right font-mono text-xs text-stone-700">{value}</div></div>; }
function Donut({ items, size = 130 }) {
  const total = items.reduce((a, x) => a + x.v, 0);
  const R = 44, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
      <svg width={size} height={size} viewBox="0 0 110 110" className="shrink-0 -rotate-90">
        <circle cx="55" cy="55" r={R} fill="none" stroke="#e7e5e4" strokeWidth="16" />
        {total > 0 && items.filter((x) => x.v > 0).map((x, idx) => {
          const frac = x.v / total, dash = frac * C, o = off; off += dash;
          return <circle key={idx} cx="55" cy="55" r={R} fill="none" stroke={x.hex} strokeWidth="16" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} />;
        })}
      </svg>
      <div className="w-full min-w-0 space-y-1 sm:w-auto">
        {items.map((x, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: x.hex }} />
            <span className="truncate text-stone-600">{x.label}</span>
            <span className="ml-auto pl-2 font-mono font-semibold text-stone-900">{x.v}</span>
            <span className="w-9 text-right font-mono text-stone-400">{total ? Math.round((x.v / total) * 100) : 0}%</span>
          </div>
        ))}
        {total === 0 && <div className="text-xs text-stone-400">Нет данных.</div>}
      </div>
    </div>
  );
}

function Dashboard({ data, onOpen }) {
  const rs = data.requests.filter((r) => !r.consolidatedInto);
  const active = rs.filter((r) => !["done", "rejected", "returned"].includes(r.status));
  const supplyAll = rs.filter((r) => r.status === "supply");
  const pool = supplyAll.filter((r) => !r.assignee);
  const overdueList = active.filter((r) => overdueDays(r) > 0).sort((a, b) => overdueDays(b) - overdueDays(a));
  const waiting = rs.filter((r) => r.status === "fulfilled");
  const pending = rs.filter((r) => r.status === "approval");
  const now = Date.now();
  const stuck = pending.filter((r) => now - Math.max(...r.history.map((h) => new Date(h.at).getTime())) > 86400000);
  const overdueTotalDays = overdueList.reduce((acc, r) => acc + overdueDays(r), 0);
  const done7 = rs.filter((r) => (r.history || []).some((h) => ["confirmed", "fulfilled"].includes(h.action) && now - new Date(h.at).getTime() < 7 * 86400000)).length;
  const urgent = active.filter((r) => ["Срочно", "Высокий"].includes(r.priority) && r.status !== "fulfilled");
  const returned = rs.filter((r) => r.status === "returned");

  // Требуют внимания: просроченные (по дням), затем срочные не взятые, затем зависшие на согласовании
  const attSet = new Set(); const attention = [];
  const push = (r, why, cls) => { if (!attSet.has(r.id) && attention.length < 7) { attSet.add(r.id); attention.push({ r, why, cls }); } };
  overdueList.forEach((r) => push(r, `просрочено ${overdueDays(r)} дн.`, "text-rose-600"));
  urgent.filter((r) => r.status === "supply" && !r.assignee).forEach((r) => push(r, "срочная, не взята", "text-amber-700"));
  stuck.forEach((r) => { const st = r.chain[r.currentStageIndex]; push(r, `ждёт: ${st ? st.approverName : "—"} >1 дн.`, "text-stone-500"); });

  const kpis = [
    { t: "Просрочено", v: overdueList.length, c: overdueList.length ? "text-rose-600" : "text-stone-900", s: "срок прошёл" },
    { t: "Не взяты в работу", v: pool.length, c: pool.length ? "text-amber-700" : "text-stone-900", s: "в пуле снабжения" },
    { t: "Зависли на согласовании", v: stuck.length, c: stuck.length ? "text-amber-700" : "text-stone-900", s: "больше суток без решения" },
    { t: "Ждут подтверждения", v: waiting.length, c: waiting.length ? "text-violet-700" : "text-stone-900", s: "выполнено, не принято" },
    { t: "На доработке", v: returned.length, c: returned.length ? "text-orange-700" : "text-stone-900", s: "возвращены авторам" },
    { t: "Закрыто за 7 дней", v: done7, c: done7 ? "text-emerald-700" : "text-stone-900", s: "выполнено и принято" },
  ];

  // Донаты
  const stHex = { approval: "#d97706", supply: "#0284c7", fulfilled: "#7c3aed" };
  const byStatus = [
    { label: "Согласование", v: pending.length, hex: stHex.approval },
    { label: "В снабжении", v: supplyAll.length, hex: stHex.supply },
    { label: "Ждут подтверждения", v: waiting.length, hex: stHex.fulfilled },
  ];
  const typeHex = { tmc: "#d97706", transport: "#0284c7", quarry: "#57534e", funds: "#059669", fuel: "#dc2626", travel: "#7c3aed", production: "#db2777" };
  const byType = TYPE_KEYS.map((k) => ({ label: TYPES[k].short, v: active.filter((r) => r.type === k).length, hex: typeHex[k] || "#78716c" })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const loadHex = ["#0284c7", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];
  const supplyUsers = data.users.filter((u) => u.role === "supply");
  const byLoad = [{ label: "Пул (не взяты)", v: pool.length, hex: "#a8a29e" }, ...supplyUsers.map((u, i) => ({ label: u.name.split(/[\s\u2014]+/)[0], v: supplyAll.filter((r) => r.assignee === u.id).length, hex: loadHex[i % loadHex.length] }))];

  const Panel = ({ title, children }) => <div className={`p-4 ${card}`}><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</div>{children}</div>;
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <div key={i} className={`p-3 ${card}`}><div className={`${k.small ? "text-lg" : "text-2xl"} font-semibold tabular-nums ${k.c}`}>{k.v}</div><div className="mt-0.5 text-xs font-medium text-stone-700">{k.t}</div><div className="text-xs text-stone-400">{k.s}</div></div>)}
      </div>
      <Panel title="Требуют внимания">
        {attention.length === 0 ? <p className="text-sm text-stone-400">Всё спокойно — проблемных заявок нет.</p> : (
          <div className="space-y-1">
            {attention.map(({ r, why, cls }) => (
              <button key={r.id} onClick={() => onOpen && onOpen(r.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-stone-50">
                <span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{r.number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{reqTitle(r)}</span>
                <span className={`shrink-0 text-xs font-medium ${cls}`}>{why}</span>
              </button>
            ))}
          </div>
        )}
        {overdueTotalDays > 0 && <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-stone-100 pt-2 text-xs text-stone-500"><AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Суммарная просрочка: <span className="font-semibold text-rose-600">{overdueTotalDays} {dayWord(overdueTotalDays)}</span></div>}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Активные по статусу"><Donut items={byStatus} /></Panel>
        <Panel title="Активные по типам"><Donut items={byType.length ? byType : [{ label: "Нет активных", v: 0, hex: "#e7e5e4" }]} /></Panel>
        <Panel title="Загрузка снабжения"><Donut items={byLoad} /></Panel>
      </div>
    </div>
  );
}
function PrintShell({ title, onBack, children }) {
  return (
    <div className="min-h-screen bg-white">
      <style>{`@media print{.no-print{display:none!important}@page{margin:14mm}}`}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3"><button onClick={onBack} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Назад</button><div className="text-sm font-medium text-stone-700">{title}</div><button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" /> Печать</button></div>
      <div className="mx-auto max-w-3xl p-4 sm:p-6">{children}</div>
    </div>
  );
}
const QR = ({ text, size = 110 }) => <img alt="QR" width={size} height={size} src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`} className="border border-stone-200" />;
function PrintSlip({ req }) {
  const t = TYPES[req.type];
  const decs = req.history.filter((h) => ["approved", "rejected", "stock"].includes(h.action));
  const stk = (x) => x.stock && x.stock.status === "in" ? "есть" : x.stock && x.stock.status === "partial" ? "част. " + (x.stock.qty || "") : x.stock && x.stock.status === "out" ? "нет" : "—";
  return (
    <div className="slip text-stone-900">
      <div className="flex items-start justify-between border-b-2 border-stone-900 pb-1.5">
        <div className="min-w-0"><div className="text-sm font-bold leading-tight">ЗАЯВКА НА СНАБЖЕНИЕ</div><div className="truncate text-xs leading-tight">{t.label}{req.departmentName ? " · " + req.departmentName : ""}{req.objectName ? " · " + req.objectName : ""}</div></div>
        <div className="shrink-0 text-right"><div className="font-mono text-base font-bold leading-none">{req.number}</div><div className="text-xs text-stone-500">{fmtDate(req.createdAt)}</div></div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs"><span><span className="text-stone-500">Заявитель: </span>{req.history[0] && req.history[0].byName}</span><span><span className="text-stone-500">Приоритет: </span>{req.priority}</span>{req.due ? <span><span className="text-stone-500">Срок: </span>{fmtDate(req.due)}</span> : null}{t.fields.map((f) => req.fields[f.key] ? <span key={f.key}><span className="text-stone-500">{f.label}: </span>{f.money ? fmtMoney(req.fields[f.key]) : f.date ? fmtDate(req.fields[f.key]) : req.fields[f.key]}</span> : null)}</div>
      {req.note && <div className="mt-0.5 text-xs"><span className="text-stone-500">Примечание: </span>{req.note}</div>}
      {t.items && req.items.length > 0 && <table className="mt-1.5 w-full border-collapse text-xs"><thead><tr className="border-y border-stone-400 text-left"><th className="w-6 py-0.5">№</th><th className="py-0.5">Наименование</th><th className="py-0.5 text-right">Кол-во</th><th className="py-0.5 pl-2">Ед.</th><th className="py-0.5 pl-2">Склад</th></tr></thead><tbody>{req.items.map((x, i) => <tr key={x.id} className="border-b border-stone-200"><td className="py-0.5 font-mono text-stone-500">{i + 1}</td><td className="py-0.5">{x.name}</td><td className="py-0.5 text-right font-mono">{x.qty || "—"}</td><td className="py-0.5 pl-2">{x.unit}</td><td className="py-0.5 pl-2">{stk(x)}</td></tr>)}</tbody></table>}
      <div className="mt-1.5 text-xs"><span className="text-stone-500">Маршрут: </span>{req.chain.length === 0 ? "без согласования" : req.chain.map((st, i) => (st.label || st.approverName) + " " + (decs[i] ? (decs[i].action === "rejected" ? "✗" : "✓") : "·")).join("   ")}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex-1"><div className="grid grid-cols-2 gap-x-4 text-xs"><div className="border-t border-stone-400 pt-0.5 text-center text-stone-400">согласовано · подпись / дата</div><div className="border-t border-stone-400 pt-0.5 text-center text-stone-400">снабжение · подпись / дата</div></div></div>
        <div className="shrink-0 text-center"><QR text={`Заявка ${req.number} | ${t.label} | ${req.departmentName}`} size={62} /><div className="font-mono text-xs leading-none">{req.number}</div></div>
      </div>
    </div>
  );
}
function PrintBatch({ reqs, onBack, title }) {
  return (
    <div className="min-h-screen bg-stone-100">
      <style>{`
        .slip{border:1px solid #d6d3d1;border-radius:10px;padding:6mm;background:#fff;}
        .batch{display:flex;flex-direction:column;gap:6mm;max-width:190mm;margin:0 auto;}
        @media screen{.slip{box-shadow:0 1px 3px rgba(0,0,0,.08);}}
        @media print{
          @page{size:A4;margin:10mm;}
          .no-print{display:none!important}
          .batch{gap:0;max-width:none;padding:0;}
          .slip{break-inside:avoid;page-break-inside:avoid;border-radius:0;margin:0 0 6mm 0;max-height:131mm;overflow:hidden;}
          .slip:nth-child(2n){page-break-after:always;margin-bottom:0;}
        }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <button onClick={onBack} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Назад</button>
        <div className="text-sm font-medium text-stone-700">{title || "Печать"} · {reqs.length} шт · 2 на лист</div>
        <button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" /> Печать</button>
      </div>
      <div className="batch p-4">{reqs.length === 0 ? <p className="py-12 text-center text-sm text-stone-400">Нет заявок для печати.</p> : reqs.map((r) => <PrintSlip key={r.id} req={r} />)}</div>
    </div>
  );
}
function PrintRequest({ req, onBack }) { return <PrintBatch reqs={[req]} onBack={onBack} title={`Печать · ${req.number}`} />; }
function AttachmentThumb({ meta, onView, onRemove, canRemove }) {
  const [src, setSrc] = useState(() => meta.dataUrl || _attCache[meta.id] || null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (meta.dataUrl) { setSrc(meta.dataUrl); setFailed(false); return; }
    let live = true, tries = 0;
    const retry = () => { if (!live) return; tries += 1; if (tries <= 5) setTimeout(load, 300 * tries); else setFailed(true); };
    const load = () => { getAtt(meta.id).then((d) => { if (!live) return; if (d) { setSrc(d); setFailed(false); } else retry(); }).catch(retry); };
    load(); return () => { live = false; };
  }, [meta.id, meta.dataUrl]);
  const isImg = (meta.mime || "").startsWith("image/");
  const download = () => { if (!src) return; const a = document.createElement("a"); a.href = src; a.download = meta.name; a.click(); };
  return (
    <div className="relative">
      {isImg ? (
        <button onClick={() => src && onView(src)} className="block h-24 w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-50">{src ? <img src={src} alt={meta.name} className="h-full w-full object-cover" /> : failed ? <div className="flex h-full flex-col items-center justify-center gap-1 px-1 text-center text-xs text-stone-400"><FileText className="h-4 w-4" />файл не найден</div> : <div className="flex h-full items-center justify-center text-xs text-stone-300">…</div>}</button>
      ) : (
        <button onClick={download} className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 text-center"><FileText className="h-6 w-6 text-stone-400" /><span className="w-full truncate text-xs text-stone-600">{meta.name}</span></button>
      )}
      <div className="mt-1 truncate text-xs text-stone-400">{sizeKb(meta.size)}</div>
      {canRemove && <button onClick={() => onRemove(meta.id)} className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-stone-400 shadow ring-1 ring-stone-200 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}
function Attachments({ req, api, onView }) {
  const fileRef = useRef(null); const canEdit = req.status !== "done" && req.status !== "rejected"; const atts = req.attachments || [];
  return (
    <div className={`p-4 ${card}`}>
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Paperclip className="h-4 w-4" /> Файлы и фото {atts.length > 0 && <span className="text-stone-400">· {atts.length}</span>}</div>{canEdit && <><input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { Array.from(e.target.files || []).forEach((f) => api.addAttachment(req.id, f)); e.target.value = ""; }} /><button onClick={() => fileRef.current && fileRef.current.click()} className={btnGhost}><Upload className="h-4 w-4" /> Добавить</button></>}</div>
      {atts.length === 0 ? <p className="text-sm text-stone-400">Вложений нет. Можно прикрепить фото или PDF.</p> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{atts.map((a) => <AttachmentThumb key={a.id} meta={a} onView={onView} onRemove={(id) => appConfirm("Удалить это вложение из заявки?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.removeAttachment(req.id, id); })} canRemove={canEdit} />)}</div>}
    </div>
  );
}

/* ─── Редактирование согласующим ─── */
function ConsolidatedExtras({ req, data, onView, onOpenReq }) {
  if (!req.consolidated) return null;
  const sources = (req.sourceIds || []).map((id) => data.requests.find((r) => r.id === id)).filter(Boolean);
  const attGroups = sources.map((r) => ({ r, atts: r.attachments || [] })).filter((g) => g.atts.length > 0);
  const noteGroups = sources.map((r) => ({ r, notes: (r.supplyNotes || []).filter((n) => n.text && !/^Позиции включены в сводную/.test(n.text)) })).filter((g) => g.notes.length > 0);
  const totalAtt = attGroups.reduce((a, g) => a + g.atts.length, 0);
  const totalNotes = noteGroups.reduce((a, g) => a + g.notes.length, 0);
  if (totalAtt === 0 && totalNotes === 0) return null;
  return (
    <div className={`p-4 sm:p-5 ${card} border-l-4 border-l-sky-300`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400"><Layers className="h-3.5 w-3.5 text-sky-500" /> Из исходных заявок</div>
      <p className="mb-3 text-xs leading-relaxed text-stone-400">Фото и комментарии собраны из объединённых заявок. Оригиналы не изменяются — при разъединении всё останется на своих местах.</p>
      {totalAtt > 0 && <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Paperclip className="h-4 w-4" /> Вложения <span className="font-mono text-stone-400">{totalAtt}</span></div>
        <div className="space-y-3">{attGroups.map((g) => <div key={g.r.id}><button onClick={() => onOpenReq && onOpenReq(g.r.id)} className="mb-1 font-mono text-xs font-semibold text-sky-700 hover:underline">{g.r.number}</button><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{g.atts.map((a) => <AttachmentThumb key={a.id} meta={a} onView={onView} canRemove={false} />)}</div></div>)}</div>
      </div>}
      {totalNotes > 0 && <div>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><MessageSquare className="h-4 w-4" /> Комментарии <span className="font-mono text-stone-400">{totalNotes}</span></div>
        <div className="space-y-2">{noteGroups.map((g) => g.notes.map((n, i) => <div key={g.r.id + "-" + i} className="rounded-lg bg-stone-50 p-2.5 text-sm"><button onClick={() => onOpenReq && onOpenReq(g.r.id)} className="mb-0.5 font-mono text-xs font-semibold text-sky-700 hover:underline">{g.r.number}</button><div className="text-stone-700">{n.text}</div><div className="mt-0.5 text-xs text-stone-400">{n.byName} · {fmtDateTime(n.at)}</div></div>))}</div>
      </div>}
    </div>
  );
}

function EditPanel({ req, data, onCancel, onSave }) {
  const t = TYPES[req.type];
  const [fields, setFields] = useState({ ...req.fields });
  const [note, setNote] = useState(req.note || "");
  const [items, setItems] = useState((req.items || []).map((x) => ({ ...x })));
  const setF = (k, v) => setFields((p) => ({ ...p, [k]: v }));
  return (
    <div className={`p-4 sm:p-5 ${card} ring-2 ring-amber-200`}>
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-stone-800"><Pencil className="h-4 w-4 text-amber-600" /> Редактирование заявки</div>
      {t.fields.length > 0 && <div className="mb-3 grid gap-3 sm:grid-cols-2">{t.fields.map((f) => <div key={f.key} className={f.key === "purpose" || f.key === "route" || f.key === "cargo" ? "sm:col-span-2" : ""}><label className={labelCls}>{f.label}</label><input className={inputCls} type={f.date ? "date" : "text"} value={fields[f.key] || ""} onChange={(e) => setF(f.key, e.target.value)} /></div>)}</div>}
      {t.items && <div className="mb-3"><label className="mb-2 block text-xs font-medium text-stone-600">{t.itemsLabel}</label><ItemsEditor items={items} setItems={setItems} catalog={data.catalog} unitDefault={t.unit} /></div>}
      <div className="mb-3"><label className={labelCls}>Примечание</label><textarea className={`${inputCls} h-16 resize-y`} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button onClick={onCancel} className={`${btnGhost} w-full sm:w-auto`}>Отмена</button><button onClick={() => onSave({ fields, items: items.filter((x) => x.name.trim()), note: note.trim() })} className={`${btnPrimary} w-full sm:w-auto`}><Save className="h-4 w-4" /> Сохранить</button></div>
    </div>
  );
}

/* ─── Склад: наличие позиций ─── */
function StockControl({ item, api, reqId }) {
  const s = (item.stock && item.stock.status) || "";
  const opt = (val, label, cls) => <button onClick={() => api.setStock(reqId, item.id, { status: val })} className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${s === val ? cls : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}>{label}</button>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opt("in", "Есть", "border-emerald-500 bg-emerald-50 text-emerald-700")}
      {opt("partial", "Частично", "border-amber-500 bg-amber-50 text-amber-700")}
      {opt("out", "Нет", "border-rose-400 bg-rose-50 text-rose-700")}
      {s === "partial" && <input value={item.stock.qty || ""} onChange={(e) => api.setStock(reqId, item.id, { status: "partial", qty: e.target.value })} placeholder="есть кол-во" inputMode="decimal" className="w-24 rounded-md border border-stone-300 px-2 py-1 font-mono text-xs focus:outline-none" />}
    </div>
  );
}

/* ─── Карточка заявки ─── */
const Meta = ({ icon: Icon, label, value, mono, full }) => <div className={full ? "sm:col-span-2" : ""}><div className="flex items-center gap-1.5 text-xs text-stone-400"><Icon className="h-3.5 w-3.5" /> {label}</div><div className={`mt-0.5 text-stone-800 ${mono ? "font-mono text-sm" : "text-sm"}`}>{value}</div></div>;

const ORDER_ACTIONS = { created: "создал наряд", approved: "согласовал", rejected: "отклонил", edited: "изменил наряд", resubmitted: "отправил повторно" };

function HistoryModal({ title, items, labels, onClose }) {
  const icon = (a) => {
    if (a === "created") return <Plus className="h-4 w-4 text-stone-400" />;
    if (a === "rejected" || a === "returned" || a === "withdrawn") return <XCircle className="h-4 w-4 text-rose-500" />;
    if (a === "edited") return <Pencil className="h-4 w-4 text-amber-500" />;
    if (a === "stock") return <Warehouse className="h-4 w-4 text-teal-500" />;
    if (a === "resubmitted") return <Send className="h-4 w-4 text-sky-500" />;
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  };
  const list = [...(items || [])].reverse();
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl" style={{ maxHeight: "85vh" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800"><History className="h-4 w-4 text-stone-400" /> {title}<span className="font-normal text-stone-400">· {list.length}</span></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" title="Закрыть"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {list.length === 0 ? <p className="py-6 text-center text-sm text-stone-400">Пока ничего не происходило.</p> : <div className="space-y-3">{list.map((h, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-0.5 shrink-0">{icon(h.action)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-stone-700"><span className="font-medium text-stone-900">{h.byName}</span> {labels[h.action] || h.action}{h.stage && <span className="text-stone-600"> · «{h.stage}»</span>}</div>
                {h.comment && <div className="mt-0.5 text-sm text-stone-500">{h.comment}</div>}
                <div className="mt-0.5 font-mono text-xs text-stone-400">{fmtDateTime(h.at)}</div>
              </div>
            </div>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}

function RequestDetail({ req, me, data, onBack, onPrint, api, onRepeat, onOpenReq }) {
  const [showHist, setShowHist] = useState(false);
  const t = TYPES[req.type]; const stage = req.chain[req.currentStageIndex];
  const isCurrent = req.status === "approval" && stage && stage.approverId === me.id;
  const isWarehouse = isCurrent && ((stage && stage.role === "warehouse") || me.role === "warehouse");
  const isApprover = isCurrent && !isWarehouse;
  const isSupply = req.status === "supply" && (me.role === "supply" || me.role === "admin");
  const isOwnerConfirm = req.status === "fulfilled" && req.requesterId === me.id;
  const noDecisions = (req.history || []).filter((h) => ["approved", "stock", "rejected"].includes(h.action)).length === 0;
  const canOwner = req.requesterId === me.id || me.role === "admin";
  const canWithdraw = canOwner && (req.status === "approval" || req.status === "supply") && !req.consolidated && !req.consolidatedInto;
  const canEditReq = isApprover || me.role === "admin" || (canOwner && ((req.status === "approval" && noDecisions) || req.status === "returned"));
  const [comment, setComment] = useState(""), [note, setNote] = useState(""), [err, setErr] = useState(""), [editing, setEditing] = useState(false), [lightbox, setLightbox] = useState(null);
  const decide = (d) => { if (d === "reject" && !comment.trim()) return setErr("Укажите причину отклонения."); setErr(""); api.decide(req.id, d, comment.trim()); setComment(""); };
  const ret = () => { if (!comment.trim()) return setErr("Опишите, что не так."); setErr(""); api.returnToSupply(req.id, comment.trim()); setComment(""); };
  const prog = t.items ? itemProgress(req) : null;
  const finish = () => { const ask = () => appPrompt("Фактически потрачено по заявке, ₸ (можно оставить пустым):", req.spent != null ? String(req.spent) : "").then((sIn) => { if (sIn === null) return; const v = num(sIn); api.fulfill(req.id, v > 0 ? v : null); }); if (prog && prog.done < prog.total) appConfirm("Не все позиции отмечены выполненными. Завершить заявку целиком?").then((ok) => { if (ok) ask(); }); else ask(); };
  const showItemStatus = t.items && ["supply", "fulfilled", "done"].includes(req.status);

  function ActionPanel() {
    if (isApprover) return (
      <div className={`p-4 ${card} border-l-4 border-l-amber-400`}>
        <div className="mb-2 text-sm font-medium text-stone-800">Ваш этап: <span className="text-amber-700">«{stage.label || stage.approverName}»</span></div>
        <p className="mb-3 text-xs text-stone-500">Можно согласовать, отклонить или отредактировать заявку (кнопка «Изменить» вверху).</p>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (обязателен при отклонении)" className={`${inputCls} mb-3 h-16 resize-y`} />
        {err && <div className="mb-3 flex items-center gap-2 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> {err}</div>}
        <div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => decide("approve")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 sm:w-auto"><Check className="h-4 w-4" /> Согласовать</button><button onClick={() => decide("reject")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 sm:w-auto"><X className="h-4 w-4" /> Отклонить</button></div>
      </div>
    );
    if (isWarehouse) return (
      <div className={`p-4 ${card} border-l-4 border-l-teal-400`}>
        <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-800"><Warehouse className="h-4 w-4 text-teal-600" /> Этап склада</div>
        <p className="mb-3 text-xs text-stone-500">Отметьте наличие по позициям — это увидит снабжение. Затем передайте дальше.</p>
        {t.items && req.items.length > 0 ? <div className="mb-3 space-y-2">{req.items.map((x) => <div key={x.id} className="rounded-lg border border-stone-200 p-2"><div className="mb-1.5 flex items-center justify-between text-sm"><span className="text-stone-700">{x.name}</span><span className="font-mono text-xs text-stone-400">{x.qty} {x.unit}</span></div><StockControl item={x} api={api} reqId={req.id} /></div>)}</div> : <p className="mb-3 text-xs text-stone-400">В этой заявке нет позиций со склада.</p>}
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (необязательно)" className={`${inputCls} mb-3 h-14 resize-y`} />
        <div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => decide("approve")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 sm:w-auto"><ArrowRight className="h-4 w-4" /> Передать дальше</button><button onClick={() => decide("reject")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 sm:w-auto"><X className="h-4 w-4" /> Отклонить</button></div>
      </div>
    );
    if (isSupply) return (
      <div className={`p-4 ${card} border-l-4 border-l-sky-400`}>
        <div className="mb-3 text-sm font-medium text-stone-800">Обработка снабжением</div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div><div className={labelCls}>Исполнитель</div><div className="flex items-center gap-2">{(me.role === "admin" || (me.role === "supply" && me.lead)) ? <select value={req.assignee || ""} onChange={(e) => (e.target.value ? api.assignTo(req.id, e.target.value) : api.release(req.id))} className={inputCls}><option value="">— свободна (в пуле) —</option>{data.users.filter((u) => u.role === "supply").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select> : <span className="text-sm text-stone-600">{req.assignee ? (data.users.find((u) => u.id === req.assignee) || {}).name : "свободна"}</span>}{!req.assignee && me.role === "supply" && <button onClick={() => api.claim(req.id)} className={btnPrimary}>Взять</button>}</div></div>
          <div><div className={labelCls}>Срок</div>{me.role === "admin" ? <input type="date" value={req.due || ""} onChange={(e) => api.setDue(req.id, e.target.value)} className={inputCls} /> : <div className="pt-1.5 text-sm text-stone-600">{req.due ? fmtDate(req.due) : (req.priority === "Срочно" ? "срочная — без срока" : "не задан")}</div>}</div>
        </div>
        <div className="mb-3"><div className={labelCls}>Стадия в работе</div><div className="flex flex-wrap gap-1.5">{SUPPLY_STAGES.filter((st2) => st2.k !== "arrived").map((st2) => <button key={st2.k} onClick={() => api.setSupplyStage(req.id, st2.k)} className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${stageOf(req) === st2.k ? "border-sky-500 bg-sky-50 text-sky-700" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}>{st2.t}</button>)}</div></div>
        {t.items && req.items.length > 0 && <div className="mb-3 rounded-lg border border-stone-200 p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-stone-600">Закрытие позиций</span><span className="font-mono text-stone-500">{prog.done}/{prog.total}</span></div><div className="mb-2 h-1.5 overflow-hidden rounded bg-stone-100"><div className="h-full bg-emerald-400" style={{ width: (prog.total ? (prog.done / prog.total) * 100 : 0) + "%" }} /></div><div className="space-y-1">{req.items.map((x) => { const total = num(x.qty); const dq = x.deliveredQty != null && x.deliveredQty !== "" ? num(x.deliveredQty) : null; const partial = dq != null && total > 0 && dq > 0 && dq < total; return (
              <div key={x.id} className="rounded px-1 py-1 hover:bg-stone-50">
                <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={!!x.fulfilled} onChange={() => api.toggleItem(req.id, x.id)} className="accent-emerald-600" /><span className={x.fulfilled ? "text-stone-400 line-through" : "text-stone-700"}>{x.name}</span><StockBadge stock={x.stock} />{partial && <span className="rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-800">частично {dq}/{total}</span>}<span className="ml-auto font-mono text-xs text-stone-400">{x.qty} {x.unit}</span></label>
                {(me.role === "supply" || me.role === "admin") && req.status === "supply" && <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-6">
                  <input type="number" min="0" value={x.deliveredQty != null ? x.deliveredQty : ""} onChange={(e) => api.setItemDelivered(req.id, x.id, e.target.value)} placeholder="получено" className="w-24 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-700 focus:outline-none" title="Получено фактически" />
                  <input value={x.supplier || ""} onChange={(e) => api.setItemMeta(req.id, x.id, { supplier: e.target.value })} placeholder="Поставщик" className="w-32 flex-1 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-700 focus:outline-none" style={{ minWidth: 100 }} />
                  <input value={x.invoice || ""} onChange={(e) => api.setItemMeta(req.id, x.id, { invoice: e.target.value })} placeholder="Счёт №" className="w-24 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-700 focus:outline-none" />
                </div>}
                {!((me.role === "supply" || me.role === "admin") && req.status === "supply") && (x.supplier || x.invoice) && <div className="mt-0.5 pl-6 text-xs text-stone-400">{x.supplier}{x.supplier && x.invoice ? " · " : ""}{x.invoice ? "счёт " + x.invoice : ""}</div>}
              </div>
            ); })}</div></div>}
        <div className="mb-3 flex flex-wrap items-center gap-3"><div className="flex items-center gap-2"><span className="text-xs text-stone-500">Срок исполнения:</span><input type="date" value={req.eta || ""} onChange={(e) => api.setEta(req.id, e.target.value)} className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 focus:outline-none" /></div><div className="flex items-center gap-2"><span className="text-xs text-stone-500">Приоритет:</span><select value={req.priority} onChange={(e) => api.setPriority(req.id, e.target.value)} className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm focus:outline-none">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div><button onClick={() => api.togglePostpone(req.id)} className={btnGhost}>{req.postponed ? <><Play className="h-4 w-4" /> В работу</> : <><Pause className="h-4 w-4" /> Отложить</>}</button></div>
        <div className="mb-3"><div className={labelCls}>Фактически потрачено, ₸ <span className="normal-case text-stone-400">(попадает в отчёты)</span></div><input inputMode="decimal" value={req.spent != null ? String(req.spent) : ""} onChange={(e) => api.setSpent(req.id, e.target.value === "" ? null : num(e.target.value))} placeholder="—" className={inputCls} /></div>
        <button onClick={finish} className={`${btnPrimary} w-full`}><CheckCircle2 className="h-4 w-4" /> Заявка выполнена</button>
        <p className="mt-2 text-xs text-stone-400">Заявка уйдёт заявителю на подтверждение получения.</p>
      </div>
    );
    if (isOwnerConfirm) return (
      <div className={`p-4 ${card} border-l-4 border-l-violet-400`}>
        <div className="mb-2 text-sm font-medium text-stone-800">Снабжение отметило выполнение</div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (нужен при возврате)" className={`${inputCls} mb-3 h-14 resize-y`} />
        {err && <div className="mb-3 flex items-center gap-2 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> {err}</div>}
        <div className="flex flex-wrap gap-2"><button onClick={() => api.confirm(req.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"><Check className="h-4 w-4" /> Подтвердить</button><button onClick={ret} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"><RefreshCw className="h-4 w-4" /> Вернуть</button></div>
      </div>
    );
    return <div className={`p-4 text-sm text-stone-500 ${card}`}>Действий для вашей роли по этой заявке сейчас нет.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {showHist && <HistoryModal title={`История · ${req.number}`} items={req.history} labels={ACTIONS} onClose={() => setShowHist(false)} />}
      {lightbox && <div onClick={() => setLightbox(null)} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}><img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg" /><button onClick={() => setLightbox(null)} className="absolute right-4 top-4 rounded-full p-2 text-stone-700" style={{ backgroundColor: "rgba(255,255,255,0.92)" }}><X className="h-5 w-5" /></button></div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button onClick={onBack} className="inline-flex shrink-0 items-center gap-1 self-start text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="h-4 w-4" /> Назад</button><div className="flex flex-wrap gap-2 sm:justify-end">{canOwner && req.status === "returned" && !editing && <button onClick={() => { api.resubmit(req.id); }} className={btnPrimary}><Send className="h-4 w-4" /> Отправить повторно</button>}{req.requesterId === me.id && !req.consolidated && <button onClick={() => onRepeat(req)} className={btnGhost} title="Создать новую заявку по образцу этой"><Copy className="h-4 w-4" /> Повторить</button>}{canWithdraw && !editing && <button onClick={() => { appConfirm("Отозвать заявку? Она уйдёт в архив как отклонённая.", { danger: true }).then((ok) => { if (!ok) return; api.withdrawRequest(req.id); onBack(); }); }} className={btnGhost}><Undo2 className="h-4 w-4" /> Отозвать</button>}{req.consolidated && (me.role === "admin" || me.role === "supply") && req.status === "supply" && <button onClick={() => { appConfirm("Разъединить сводную заявку? Исходные заявки вернутся в работу." + ((req.attachments || []).length ? " Файлы, прикреплённые к сводной (" + req.attachments.length + "), будут перенесены в первую исходную заявку — не потеряются." : ""), { okText: "Разъединить", danger: true }).then((ok) => { if (!ok) return; api.unconsolidate(req.id); onBack(); }); }} className={btnGhost}><Scissors className="h-4 w-4" /> Разъединить</button>}{canEditReq && !editing && <button onClick={() => setEditing(true)} className={btnGhost}><Pencil className="h-4 w-4" /> Изменить</button>}<button onClick={() => setShowHist(true)} className={btnGhost}><History className="h-4 w-4" /> История{(req.history || []).length > 0 && <span className="text-stone-400"> · {req.history.length}</span>}</button><button onClick={onPrint} className={btnGhost}><Printer className="h-4 w-4" /> Печать</button></div></div>

      <div className={`p-4 sm:p-5 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-lg font-semibold text-stone-900">{req.number}</span><TypeBadge type={req.type} /><PriorityBadge p={req.priority} /><OverdueBadge r={req} />{req.postponed && <Chip className="bg-stone-200 text-stone-600"><Pause className="mr-1 h-3 w-3" /> отложена</Chip>}{req.consolidated && <Chip className="bg-sky-100 text-sky-800"><Layers className="mr-1 h-3 w-3" /> объединена</Chip>}{req.consolidatedInto && <Chip className="bg-amber-100 text-amber-800"><Layers className="mr-1 h-3 w-3" /> в сводной {req.consolidatedInto.number}</Chip>}</div><div className="mt-2 text-base font-medium text-stone-800">{reqTitle(req)}</div><div className="mt-2 flex flex-wrap items-center gap-1.5"><DeptChip name={req.departmentName} /><ObjChip name={req.objectName} color={req.objectColor} /></div></div>
          <StatusBadge s={req.status} />
        </div>
      </div>

      <div className={`px-4 py-4 sm:px-5 ${card}`}><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Маршрут</div><StageTrack req={req} /></div>

      {req.consolidatedInto && <div className={`flex flex-wrap items-center justify-between gap-2 p-3 ${card} border-l-4 border-l-amber-400`}><div className="text-sm text-stone-700">Позиции включены в сводную закупку <span className="font-mono font-semibold">{req.consolidatedInto.number}</span> — заявка отложена до её выполнения.</div><button onClick={() => onOpenReq(req.consolidatedInto.id)} className={btnGhost}>Открыть сводную <ArrowRight className="h-4 w-4" /></button></div>}
      {req.consolidated && <div className={`p-3 ${card} border-l-4 border-l-sky-400`}><div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-medium text-stone-800"><Layers className="mr-1 inline h-4 w-4 text-sky-600" />Объединённая заявка · включает исходных заявок: {(req.sourceNumbers || []).length}</div>{(me.role === "admin" || me.role === "supply") && req.status === "supply" && <button onClick={() => { appConfirm("Разъединить сводную заявку? Исходные заявки вернутся в работу." + ((req.attachments || []).length ? " Файлы, прикреплённые к сводной (" + req.attachments.length + "), будут перенесены в первую исходную заявку — не потеряются." : ""), { okText: "Разъединить", danger: true }).then((ok) => { if (!ok) return; api.unconsolidate(req.id); onBack(); }); }} className={btnGhost}><Scissors className="h-4 w-4" /> Разъединить</button>}</div><div className="flex flex-wrap gap-1.5">{(req.sourceIds || []).map((sid, i) => <button key={sid} onClick={() => onOpenReq(sid)} className="rounded-md border border-stone-200 bg-white px-2 py-0.5 font-mono text-xs text-stone-600 hover:bg-stone-50">{(req.sourceNumbers || [])[i] || "заявка"}</button>)}</div></div>}

      {editing ? <EditPanel req={req} data={data} onCancel={() => setEditing(false)} onSave={(patch) => { api.editRequest(req.id, patch); setEditing(false); }} /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {req.status === "returned" && canOwner && (() => { const rej = [...req.history].reverse().find((h) => h.action === "rejected"); return <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-orange-300 bg-orange-50 p-3"><RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-orange-900">Заявка возвращена на доработку</div>{rej && rej.comment && <div className="mt-0.5 text-sm text-orange-800">Причина: {rej.comment}</div>}<div className="mt-1 text-xs text-orange-700">Нажмите «Изменить», внесите правки и «Отправить повторно».</div></div></div>; })()}
            <div className={`p-4 sm:p-5 ${card}`}><div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2"><Meta icon={User} label="Заявитель" value={req.history[0] && req.history[0].byName} /><Meta icon={Calendar} label="Создана" value={fmtDate(req.createdAt)} mono />{req.due && <Meta icon={Calendar} label="Срок исполнения" value={fmtDate(req.due)} mono />}{!req.due && req.priority === "Срочно" && <Meta icon={AlertTriangle} label="Срок" value="срочная — вне очереди" />}{req.spent != null && <Meta icon={Banknote} label="Потрачено (факт)" value={fmtMoney(req.spent)} mono />}{t.fields.map((f) => req.fields[f.key] != null && req.fields[f.key] !== "" && <Meta key={f.key} icon={f.money ? Banknote : f.date ? Calendar : Building2} label={f.label} value={f.money ? fmtMoney(req.fields[f.key]) : f.date ? fmtDate(req.fields[f.key]) : req.fields[f.key]} mono={f.money || f.date} />)}{req.note && <Meta icon={ClipboardList} label="Примечание" value={req.note} full />}</div></div>
            {t.items && req.items.length > 0 && <div className={`p-4 sm:p-5 ${card}`}><div className="mb-2 flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t.itemsLabel}</div>{showItemStatus && <span className="text-xs text-stone-500">закрыто {prog.done}/{prog.total}</span>}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-stone-200 text-left text-xs text-stone-500">{showItemStatus && <th className="w-6 py-2" />}<th className="w-8 py-2 font-medium">№</th><th className="py-2 font-medium">Наименование</th><th className="py-2 text-right font-medium">Кол-во</th><th className="py-2 pl-3 font-medium">Ед.</th><th className="py-2 pl-3 font-medium">Склад</th></tr></thead><tbody>{req.items.map((x, i) => <tr key={x.id} className="border-b border-stone-50">{showItemStatus && <td className="py-2">{x.fulfilled ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-stone-300" />}</td>}<td className="py-2 font-mono text-xs text-stone-400">{i + 1}</td><td className={`py-2 ${x.fulfilled ? "text-stone-400 line-through" : "text-stone-800"}`}>{x.name}</td><td className="py-2 text-right font-mono">{x.qty || "—"}</td><td className="py-2 pl-3 text-stone-500">{x.unit}</td><td className="py-2 pl-3"><StockBadge stock={x.stock} /></td></tr>)}</tbody></table></div></div>}
            <Attachments req={req} api={api} onView={setLightbox} />
            <ConsolidatedExtras req={req} data={data} onView={setLightbox} onOpenReq={onOpenReq} />
            {(() => { const canComment = me.role === "admin" || me.role === "supply" || me.role === "warehouse" || canOwner || req.chain.some((cc) => cc.approverId === me.id); if (req.supplyNotes.length === 0 && !canComment) return null; return <div className={`p-4 sm:p-5 ${card}`}><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Комментарии</div>{req.supplyNotes.length > 0 ? <div className="space-y-2">{req.supplyNotes.map((n, i) => <div key={i} className="rounded-lg bg-stone-50 p-2.5 text-sm"><div className="text-stone-700">{n.text}</div><div className="mt-0.5 text-xs text-stone-400">{n.byName} · {fmtDateTime(n.at)}</div></div>)}</div> : <p className="text-xs text-stone-400">Пока нет комментариев. Здесь можно задать вопрос заявителю или уточнить детали.</p>}{canComment && <div className="mt-3 flex gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Вопрос или комментарий…" className={inputCls} onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { api.addNote(req.id, note.trim()); setNote(""); } }} /><button onClick={() => { if (note.trim()) { api.addNote(req.id, note.trim()); setNote(""); } }} className={btnGhost}><Send className="h-4 w-4" /></button></div>}</div>; })()}
          </div>
          <div className="space-y-4">
            <ActionPanel />
            
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Архив ─── */
function ArchiveView({ data, me, onOpen }) {
  const isDesktop = useIsDesktop();
  const [f, setF] = useState("all");
  const [q, setQ] = useState(""), [dateFrom, setDateFrom] = useState(""), [dateTo, setDateTo] = useState("");
  const [fOpen, setFOpen] = useState(false);
  const visible = data.requests.filter((r) => { if (r.status !== "done" && r.status !== "rejected") return false; if (me.role === "admin" || me.role === "supply") return true; if (me.role === "requester") return r.requesterId === me.id; return r.chain.some((c) => c.approverId === me.id); });
  const list = visible.filter((r) => (f === "all" || r.status === f) && inDateRange(r.createdAt, dateFrom, dateTo) && (!q.trim() || r.number.toLowerCase().includes(q.toLowerCase()) || reqTitle(r).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const arcActive = (f !== "all" ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);
  return <div><div className="mb-3 space-y-2"><div className="flex flex-wrap items-center gap-1.5"><div className="flex flex-1 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5" style={{ minWidth: 170 }}><Search className="h-4 w-4 shrink-0 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру или названию" className="w-full min-w-0 bg-transparent text-sm focus:outline-none" /></div><button onClick={() => setFOpen((v) => !v)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${fOpen || arcActive ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><Filter className="h-4 w-4" /> Фильтры{arcActive > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${fOpen ? "bg-white text-stone-900" : "bg-amber-400 text-stone-900"}`}>{arcActive}</span>}</button></div><div className={`${fOpen ? "flex" : "hidden"} flex-wrap items-center gap-1.5`}><div className="flex gap-1.5">{[{ k: "all", t: "Все" }, { k: "done", t: "Завершённые" }, { k: "rejected", t: "Отклонённые" }].map((tb) => <button key={tb.k} onClick={() => setF(tb.k)} className={pillCls(f === tb.k)}>{tb.t}</button>)}</div><DateRange from={dateFrom} setFrom={setDateFrom} to={dateTo} setTo={setDateTo} />{arcActive > 0 && <button onClick={() => { setDateFrom(""); setDateTo(""); setF("all"); }} className="shrink-0 text-xs font-medium text-stone-500 underline hover:text-stone-800">Сбросить</button>}</div></div>{isDesktop ? <RequestRows list={list} me={me} users={data.users} onOpen={onOpen} empty="Архив пуст." showRequester showDept /> : <RequestCards list={list} me={me} onOpen={onOpen} empty="Архив пуст." showRequester showDept />}</div>;
}

/* ─── Отчёты ─── */
function buildReports(data, m) {
  const inMonth = (iso) => monthOf(iso) === m;
  const spentRows = data.requests.filter((r) => r.spent != null && r.spent > 0 && inMonth(r.createdAt));
  const group = (arr, key) => { const g = {}; arr.forEach((r) => { const k = key(r) || "— не указано —"; if (!g[k]) g[k] = { name: k, sum: 0, n: 0 }; g[k].sum += r.spent; g[k].n++; }); return Object.values(g).sort((a, b) => b.sum - a.sum); };
  const byObject = group(spentRows, (r) => r.objectName);
  const byDept = group(spentRows, (r) => r.departmentName);
  const byType = group(spentRows, (r) => TYPES[r.type].label);
  const spentTotal = spentRows.reduce((sm, r) => sm + r.spent, 0);
  const fuelReqs = data.requests.filter((r) => r.type === "fuel" && inMonth(r.createdAt) && r.status !== "rejected");
  const fg = {}; fuelReqs.forEach((r) => { const k = (r.fields && r.fields.vehicle) || "— техника не указана —"; if (!fg[k]) fg[k] = { name: k, liters: 0, n: 0 }; fg[k].n++; (r.items || []).forEach((x) => { fg[k].liters += num(x.qty); }); });
  const fuel = Object.values(fg).sort((a, b) => b.liters - a.liters);
  const fuelTotal = fuel.reduce((sm, x) => sm + x.liters, 0);
  const monthOrders = (data.orders || []).filter((o) => o.period === m && o.status !== "rejected");
  const ip = buildIpSummary(monthOrders);
  const ipTotals = { count: monthOrders.length, sum: ip.reduce((sm, x) => sm + x.sum, 0) };
  return { byObject, byDept, byType, spentTotal, spentCount: spentRows.length, fuel, fuelTotal, ip, ipTotals };
}

function ReportsHub({ data, me, month, setMonth, onPrint }) {
  const months = recentMonths(11, 0);
  const R = buildReports(data, month);
  const Tbl = ({ head, rows, foot }) => (
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-stone-200 text-left text-xs text-stone-500">{head.map((h, i) => <th key={i} className={`py-2 font-medium ${i ? "pl-3 text-right" : ""}`}>{h}</th>)}</tr></thead><tbody>{rows.map((r2, i) => <tr key={i} className="border-b border-stone-50">{r2.map((c, j) => <td key={j} className={`py-2 ${j ? "pl-3 text-right font-mono" : "text-stone-800"}`}>{c}</td>)}</tr>)}</tbody>{foot && <tfoot><tr className="border-t border-stone-200 font-semibold">{foot.map((c, j) => <td key={j} className={`py-2 ${j ? "pl-3 text-right font-mono" : ""}`}>{c}</td>)}</tr></tfoot>}</table></div>
  );
  const csv = (name, head, rows) => downloadFile(`${name}-${month}.csv`, toCSV([head, ...rows]), "text/csv");
  const Rcard = ({ title, onCsv, children }) => (
    <div className={`p-4 ${card}`}><div className="mb-2 flex items-center justify-between gap-2"><div className="text-sm font-semibold text-stone-700">{title}</div>{onCsv && <button onClick={onCsv} className="rounded-md border border-stone-200 bg-white p-1 text-stone-400 hover:text-stone-700" title="Выгрузить CSV"><FileDown className="h-3.5 w-3.5" /></button>}</div>{children}</div>
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div />
        <div className="flex items-center gap-1.5"><select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}>{months.map((m2) => <option key={m2} value={m2}>{periodLabel(m2)}</option>)}</select><button onClick={onPrint} className={btnGhost}><Printer className="h-4 w-4" /> Печать</button></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Rcard title={`Расходы по объектам · ${fmtMoney(R.spentTotal)}`} onCsv={() => csv("rashody-obekty", ["Объект", "Заявок", "Сумма"], R.byObject.map((x) => [x.name, x.n, x.sum]))}>
          {R.byObject.length ? <Tbl head={["Объект", "Заявок", "Сумма"]} rows={R.byObject.map((x) => [x.name, x.n, fmtMoney(x.sum)])} foot={["Итого", R.spentCount, fmtMoney(R.spentTotal)]} /> : <p className="text-sm text-stone-400">За месяц нет заявок с указанной суммой закупки.</p>}
        </Rcard>
        <Rcard title="Расходы по отделам" onCsv={() => csv("rashody-otdely", ["Отдел", "Заявок", "Сумма"], R.byDept.map((x) => [x.name, x.n, x.sum]))}>
          {R.byDept.length ? <Tbl head={["Отдел", "Заявок", "Сумма"]} rows={R.byDept.map((x) => [x.name, x.n, fmtMoney(x.sum)])} /> : <p className="text-sm text-stone-400">Нет данных.</p>}
        </Rcard>
        <Rcard title="Расходы по типам заявок" onCsv={() => csv("rashody-tipy", ["Тип", "Заявок", "Сумма"], R.byType.map((x) => [x.name, x.n, x.sum]))}>
          {R.byType.length ? <Tbl head={["Тип", "Заявок", "Сумма"]} rows={R.byType.map((x) => [x.name, x.n, fmtMoney(x.sum)])} /> : <p className="text-sm text-stone-400">Нет данных.</p>}
        </Rcard>
        <Rcard title={`ГСМ по технике · ${R.fuelTotal ? R.fuelTotal.toLocaleString("ru-RU") + " л" : "—"}`} onCsv={() => csv("gsm-tehnika", ["Техника", "Заявок", "Литров"], R.fuel.map((x) => [x.name, x.n, x.liters]))}>
          {R.fuel.length ? <Tbl head={["Техника", "Заявок", "Литров"]} rows={R.fuel.map((x) => [x.name, x.n, x.liters.toLocaleString("ru-RU")])} foot={["Итого", "", R.fuelTotal.toLocaleString("ru-RU")]} /> : <p className="text-sm text-stone-400">Заявок на топливо за месяц нет.</p>}
        </Rcard>
        <div className="lg:col-span-2">
          <Rcard title={`Наряды по ИП · ${periodLabel(month)}`} onCsv={() => csv("svod-ip", ["ИП", "Нарядов", "Сумма"], R.ip.map((x) => [x.ip, x.count, Math.round(x.sum)]))}>
            {R.ip.length ? <Tbl head={["ИП", "Нарядов", "Сумма работ"]} rows={R.ip.map((x) => [x.ip, x.count, fmtMoney(x.sum)])} foot={["Итого", R.ipTotals.count, fmtMoney(R.ipTotals.sum)]} /> : <p className="text-sm text-stone-400">Нарядов за месяц нет.</p>}
            <p className="mt-2 text-xs text-stone-400">Отклонённые наряды не учитываются.</p>
          </Rcard>
        </div>
      </div>
    </div>
  );
}

function ReportsPrint({ month, data, onBack }) {
  const R = buildReports(data, month);
  const T = ({ title, head, rows, foot }) => (
    <div className="mt-4"><div className="mb-1 text-sm font-bold">{title}</div><table className="w-full border-collapse text-sm"><thead><tr className="border-y-2 border-stone-900 text-left">{head.map((h, i) => <th key={i} className={`py-1 ${i ? "pl-3 text-right" : ""}`}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r2, i) => <tr key={i} className="border-b border-stone-300">{r2.map((c, j) => <td key={j} className={`py-1 ${j ? "pl-3 text-right font-mono" : ""}`}>{c}</td>)}</tr>) : <tr><td className="py-2 text-stone-400" colSpan={head.length}>нет данных</td></tr>}</tbody>{foot && <tfoot><tr className="border-t-2 border-stone-900 font-semibold">{foot.map((c, j) => <td key={j} className={`py-1.5 ${j ? "pl-3 text-right font-mono" : ""}`}>{c}</td>)}</tr></tfoot>}</table></div>
  );
  return (
    <PrintShell title={`Отчёт · ${periodLabel(month)}`} onBack={onBack}>
      <div className="text-stone-900">
        <div className="border-b-2 border-stone-900 pb-3"><div className="text-lg font-bold">ОТЧЁТ ЗА {periodLabel(month).toUpperCase()}</div><div className="mt-1 text-xs text-stone-500">ТОО «Интерстиль» · WorkFlow · сформировано {fmtDate(new Date().toISOString())}</div></div>
        <T title={`Расходы по объектам (итого ${fmtMoney(R.spentTotal)})`} head={["Объект", "Заявок", "Сумма"]} rows={R.byObject.map((x) => [x.name, x.n, fmtMoney(x.sum)])} foot={R.byObject.length ? ["Итого", R.spentCount, fmtMoney(R.spentTotal)] : null} />
        <T title="Расходы по отделам" head={["Отдел", "Заявок", "Сумма"]} rows={R.byDept.map((x) => [x.name, x.n, fmtMoney(x.sum)])} />
        <T title={`ГСМ по технике (итого ${R.fuelTotal.toLocaleString("ru-RU")} л)`} head={["Техника", "Заявок", "Литров"]} rows={R.fuel.map((x) => [x.name, x.n, x.liters.toLocaleString("ru-RU")])} />
        <T title="Наряды по ИП" head={["ИП", "Нарядов", "Сумма"]} rows={R.ip.map((x) => [x.ip, x.count, fmtMoney(x.sum)])} foot={R.ip.length ? ["Итого", R.ipTotals.count, fmtMoney(R.ipTotals.sum)] : null} />
        <div className="mt-8 grid grid-cols-2 gap-8 text-xs"><div className="border-t border-stone-400 pt-1 text-center text-stone-400">составил · подпись / дата</div><div className="border-t border-stone-400 pt-1 text-center text-stone-400">директор · подпись / дата</div></div>
      </div>
    </PrintShell>
  );
}

/* ─── Настройки ─── */
function SettingsHub({ data, me, api }) {
  const [tab, setTab] = useState("users");
  const tabs = [{ k: "users", t: "Люди", icon: Users }, { k: "chains", t: "Отделы и маршруты", icon: Route }, { k: "objects", t: "Объекты", icon: MapPin }, { k: "vehicles", t: "Техника", icon: Truck }, { k: "works", t: "Списки работ", icon: HardHat }, { k: "ochains", t: "Маршруты нарядов", icon: ClipboardCheck }, { k: "ips", t: "ИП", icon: Banknote }, { k: "ann", t: "Объявления", icon: Megaphone }, { k: "data", t: "Данные", icon: Database }];
  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold leading-tight tracking-tight text-stone-900">Настройки</h1>
      <div className="mb-5 flex gap-1.5 overflow-x-auto">{tabs.map((tb) => <button key={tb.k} onClick={() => setTab(tb.k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${tab === tb.k ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><tb.icon className="h-4 w-4" /> {tb.t}</button>)}</div>
      {tab === "users" ? <AdminUsers data={data} me={me} api={api} /> : tab === "chains" ? <AdminChains data={data} api={api} /> : tab === "objects" ? <AdminObjects data={data} api={api} /> : tab === "works" ? <WorkCatalogsAdmin data={data} api={api} /> : tab === "ochains" ? <OrderChainsAdmin data={data} api={api} /> : tab === "ips" ? <IpAdmin data={data} api={api} /> : tab === "vehicles" ? <AdminVehicles data={data} api={api} /> : tab === "ann" ? <AdminAnnouncements data={data} api={api} /> : tab === "data" ? <AdminData data={data} api={api} /> : <AdminCatalog data={data} api={api} />}
    </div>
  );
}

function AdminUsers({ data, me, api }) {
  const [reveal, setReveal] = useState({}); const upd = (id, k, v) => api.updateUser(id, { [k]: v });
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold text-stone-900">Люди и доступы</h2><button onClick={api.addUser} className={btnPrimary}><Plus className="h-4 w-4" /> Добавить</button></div>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Логин и ключ вы выдаёте сотруднику для входа. Для заявителей важен отдел — от него зависит маршрут. Роль «Склад» ставится в маршрут как согласующий и отмечает наличие.</p>
      <div className="grid gap-2.5 lg:grid-cols-2">{data.users.map((u) => { const isMe = u.id === me.id; const onlyAdmin = u.role === "admin" && data.users.filter((x) => x.role === "admin").length === 1; return (
        <div key={u.id} className={`p-3 ${card}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>Имя / должность</label><input className={inputCls} value={u.name} onChange={(e) => upd(u.id, "name", e.target.value)} /></div>
            <div><label className={labelCls}>Роль</label><select className={inputCls} value={u.role} onChange={(e) => upd(u.id, "role", e.target.value)} disabled={isMe || onlyAdmin}>{Object.keys(ROLES).map((r) => <option key={r} value={r}>{ROLES[r].t}</option>)}</select></div>
            <div><label className={labelCls}>Отдел</label><select className={inputCls} value={u.departmentId || ""} onChange={(e) => upd(u.id, "departmentId", e.target.value)}><option value="">— все / не задан —</option>{data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className={labelCls}>Логин</label><input className={`${inputCls} font-mono`} value={u.login} onChange={(e) => upd(u.id, "login", e.target.value)} /></div>
            <div><label className={labelCls}>Ключ</label><div className="flex gap-1.5"><input className={`${inputCls} font-mono`} type={reveal[u.id] ? "text" : "password"} value={u.key} onChange={(e) => upd(u.id, "key", e.target.value)} /><button onClick={() => setReveal((p) => ({ ...p, [u.id]: !p[u.id] }))} className="rounded-lg border border-stone-300 px-2 text-stone-500 hover:bg-stone-50">{reveal[u.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button><button onClick={() => upd(u.id, "key", genKey())} title="Сгенерировать" className="rounded-lg border border-stone-300 px-2 text-stone-500 hover:bg-stone-50"><RefreshCw className="h-4 w-4" /></button></div></div>
          </div>
          {u.role === "supply" && <label className="mt-2 flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={!!u.lead} onChange={(e) => upd(u.id, "lead", e.target.checked)} className="accent-stone-900" /> Старший снабжения — может назначать исполнителей</label>}
          <label className="mt-2 flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={!!u.orders} onChange={(e) => upd(u.id, "orders", e.target.checked)} className="accent-stone-900" /> Доступ к разделу «Наряды»</label>
            <label className="mt-2 flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={!!u.canPrice} onChange={(e) => upd(u.id, "canPrice", e.target.checked)} className="accent-stone-900" /> Право менять цены в нарядах</label>
          <div className="mt-2 flex items-center justify-between"><div className="flex flex-wrap items-center gap-1.5"><RoleChip r={u.role} />{u.role === "supply" && u.lead && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">старший</span>}{u.departmentId && <DeptChip name={deptName(data, u.departmentId)} />}</div><button onClick={() => appConfirm("Удалить сотрудника «" + (u.name || "—") + "»? Он будет убран из маршрутов согласования; заявки, ждущие его решения, перейдут дальше по цепочке.", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteUser(u.id); })} disabled={isMe || onlyAdmin} className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-rose-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /> {isMe ? "это вы" : "удалить"}</button></div>
        </div>
      ); })}</div>
    </div>
  );
}

function AdminChains({ data, api }) {
  const [deptId, setDeptId] = useState(data.departments[0] ? data.departments[0].id : ""), [type, setType] = useState("tmc"), [manage, setManage] = useState(false);
  useEffect(() => { if (!data.departments.find((d) => d.id === deptId)) setDeptId(data.departments[0] ? data.departments[0].id : ""); }, [data.departments, deptId]);
  const chain = (data.chains[deptId] && data.chains[deptId][type]) || []; const approvers = data.users.filter((u) => CHAIN_ROLES.includes(u.role));
  const setChain = (next) => api.setChain(deptId, type, next);
  const move = (idx, dir) => { const j = idx + dir; if (j < 0 || j >= chain.length) return; const next = [...chain]; const tmp = next[idx]; next[idx] = next[j]; next[j] = tmp; setChain(next); };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold text-stone-900">Отделы и маршруты</h2><button onClick={() => setManage((v) => !v)} className="text-xs text-stone-500 hover:text-stone-800">{manage ? "Скрыть отделы" : "Управление отделами"}</button></div>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Маршрут зависит от связки <span className="font-medium text-stone-700">отдел + тип</span>. Изменения касаются новых заявок.</p>
      {manage && <div className={`mb-4 space-y-2 p-3 ${card}`}>{data.departments.map((d) => <div key={d.id} className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-stone-400" /><input className={inputCls} value={d.name} onChange={(e) => api.renameDepartment(d.id, e.target.value)} /><button onClick={() => appConfirm("Удалить отдел «" + (d.name || "—") + "»? Его маршруты согласования будут удалены, сотрудники останутся без отдела.", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteDepartment(d.id); })} disabled={data.departments.length <= 1} className={`${iconBtn} hover:!text-rose-600`}><Trash2 className="h-4 w-4" /></button></div>)}<button onClick={api.addDepartment} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"><Plus className="h-4 w-4" /> Добавить отдел</button></div>}
      <div className="mb-3 flex flex-wrap gap-1.5">{data.departments.map((d) => <button key={d.id} onClick={() => setDeptId(d.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${deptId === d.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><Building2 className="h-3.5 w-3.5" /> {d.name}</button>)}</div>
      <div className="mb-4 flex flex-wrap gap-1.5">{TYPE_KEYS.map((k) => { const Icon = TYPES[k].icon; return <button key={k} onClick={() => setType(k)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${type === k ? "border-amber-500 bg-amber-50 text-amber-800" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><Icon className="h-3.5 w-3.5" /> {TYPES[k].short}</button>; })}</div>
      <div className="mb-2 text-xs font-medium text-stone-500">Маршрут: {deptName(data, deptId)} → {TYPES[type].label}</div>
      <div className="space-y-2">{chain.map((st, idx) => <div key={st.id} className={`flex items-center gap-2 p-3 ${card}`}><div className="flex flex-col"><button onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded p-0.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button onClick={() => move(idx, 1)} disabled={idx === chain.length - 1} className="rounded p-0.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button></div><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 font-mono text-xs font-bold text-white">{idx + 1}</span><div className="grid flex-1 gap-2 sm:grid-cols-2"><input className={inputCls} value={st.label} onChange={(e) => setChain(chain.map((x) => (x.id === st.id ? { ...x, label: e.target.value } : x)))} placeholder="Название этапа" /><select className={inputCls} value={st.approverId} onChange={(e) => setChain(chain.map((x) => (x.id === st.id ? { ...x, approverId: e.target.value } : x)))}><option value="">— согласующий —</option>{approvers.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role === "warehouse" ? " (склад)" : ""}</option>)}</select></div><button onClick={() => setChain(chain.filter((x) => x.id !== st.id))} className="rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
      <button onClick={() => setChain([...chain, { id: uid(), approverId: "", label: "" }])} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-600 hover:border-stone-400 hover:bg-stone-50"><Plus className="h-4 w-4" /> Добавить этап</button>
      {approvers.length === 0 && <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" /> Нет согласующих — добавьте их в «Люди».</div>}
    </div>
  );
}

function AdminObjects({ data, api }) {
  const reqUsers = data.users.filter((u) => u.role === "requester");
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold text-stone-900">Объекты</h2><button onClick={api.addObject} className={btnPrimary}><Plus className="h-4 w-4" /> Добавить</button></div>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Объекты, на которые выписываются заявки. Отметьте, кто из заявителей может выбирать каждый объект.</p>
      <div className="space-y-2.5">{data.objects.map((o) => (
        <div key={o.id} className={`p-3 ${card}`}>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-stone-400" /><input className={inputCls} value={o.name} onChange={(e) => api.updateObject(o.id, e.target.value)} /><button onClick={() => appConfirm("Удалить объект «" + (o.name || "—") + "»? Уже созданные заявки и наряды сохранят его название.", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteObject(o.id); })} className="rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="text-xs text-stone-400">Цвет:</span>{OBJ_PALETTE.map((c) => <button key={c} onClick={() => api.setObjectColor(o.id, c)} title={c} className={`h-5 w-5 rounded-full bg-${c}-400 ${(o.color || "") === c ? "ring-2 ring-stone-900 ring-offset-1" : "hover:scale-110"}`} />)}</div>
          <div className="mt-2"><div className="mb-1 text-xs text-stone-400">Доступ:</div><div className="flex flex-wrap gap-1.5">{reqUsers.length === 0 ? <span className="text-xs text-stone-400">Нет заявителей.</span> : reqUsers.map((u) => { const on = (o.userIds || []).includes(u.id); return <button key={u.id} onClick={() => api.toggleObjectUser(o.id, u.id)} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}>{on && <Check className="mr-1 h-3 w-3" />}{u.name}</button>; })}</div></div>
        </div>
      ))}{data.objects.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 bg-white py-8 text-center text-sm text-stone-400">Объектов нет.</p>}</div>
    </div>
  );
}

function AdminCatalog({ data, api }) {
  const upd = (id, k, v) => api.updateCatalog(id, { [k]: v });
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold text-stone-900">Справочник номенклатуры</h2><button onClick={api.addCatalog} className={btnPrimary}><Plus className="h-4 w-4" /> Добавить</button></div>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Единый список названий и единиц. Из него заявители выбирают позиции — без разнобоя в наименованиях.</p>
      <div className="grid gap-2 lg:grid-cols-2">{data.catalog.map((c) => (
        <div key={c.id} className={`flex flex-wrap items-center gap-2 p-2.5 ${card}`}>
          <input className={`${inputCls} flex-1`} value={c.name} onChange={(e) => upd(c.id, "name", e.target.value)} placeholder="Наименование" />
          <input className={`${inputCls} w-32`} value={c.category || ""} onChange={(e) => upd(c.id, "category", e.target.value)} placeholder="Категория" />
          <select className={`${inputCls} w-24`} value={c.unit} onChange={(e) => upd(c.id, "unit", e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          <button onClick={() => appConfirm("Удалить эту категорию справочника?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteCatalog(c.id); })} className="rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}{data.catalog.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 bg-white py-8 text-center text-sm text-stone-400 lg:col-span-2">Справочник пуст.</p>}</div>
    </div>
  );
}

/* ─── Корневой компонент ─── */
function myNotifs(data, me) {
  const since = me.notifReadAt ? new Date(me.notifReadAt).getTime() : 0;
  const evs = [];
  const NOTIF_ACTIONS = { approved: "согласовал(а)", rejected: "отклонил(а)", fulfilled: "выполнил(а)", done: "подтвердил(а) получение", unconsolidated: "разъединил(а)", consolidated: "объединил(а)", eta: "назначил(а) срок", claimed: "взял(а) в работу" };
  data.requests.forEach((r) => {
    if (r.requesterId !== me.id) return;
    (r.history || []).forEach((h) => { if (h.by !== me.id && NOTIF_ACTIONS[h.action]) evs.push({ id: r.id + h.at + h.action, reqId: r.id, number: r.number, title: reqTitle(r), text: (h.byName || "") + " " + NOTIF_ACTIONS[h.action], comment: h.comment, at: h.at, fresh: new Date(h.at).getTime() > since }); });
  });
  return evs.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);
}

function NotifBell({ data, me, api, onOpenReq, dark }) {
  const [open, setOpen] = useState(false);
  const evs = myNotifs(data, me);
  const fresh = evs.filter((e) => e.fresh).length;
  const toggle = () => { const nx = !open; setOpen(nx); if (nx) api.markNotifsRead(); };
  return (
    <div className="relative">
      <button onClick={toggle} className={dark ? "relative inline-flex items-center justify-center rounded-lg bg-stone-800 p-2 text-stone-300 hover:bg-stone-700" : "relative inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white p-2 text-stone-600 hover:bg-stone-50"} title="События">
        <Bell className="h-4 w-4" />
        {fresh > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">{fresh}</span>}
      </button>
      {open && <>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-stone-200 bg-white text-stone-900 shadow-xl" style={{ maxWidth: "calc(100vw - 2rem)" }}>
          <div className="border-b border-stone-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">События по вашим заявкам</div>
          <div className="max-h-96 overflow-y-auto">
            {evs.length === 0 ? <div className="px-3 py-8 text-center text-sm text-stone-400">Пока событий нет.</div> : evs.map((e) => (
              <button key={e.id} onClick={() => { setOpen(false); onOpenReq(e.reqId); }} className={`block w-full border-b border-stone-50 px-3 py-2 text-left transition hover:bg-stone-50 ${e.fresh ? "bg-amber-50" : ""}`}>
                <div className="flex items-center gap-1.5"><span className="font-mono text-xs font-semibold text-stone-900">{e.number}</span><span className="truncate text-xs text-stone-400">{e.title}</span></div>
                <div className="mt-0.5 text-sm text-stone-700">{e.text}</div>
                {e.comment && <div className="mt-0.5 truncate text-xs text-stone-400">{e.comment}</div>}
                <div className="mt-0.5 font-mono text-xs text-stone-300">{fmtDateTime(e.at)}</div>
              </button>
            ))}
          </div>
        </div>
      </>}
    </div>
  );
}

let _dlgSet = null;
const appConfirm = (message, opts = {}) => new Promise((resolve) => { if (_dlgSet) _dlgSet({ kind: "confirm", message, okText: opts.okText, danger: opts.danger, resolve }); else resolve(typeof window !== "undefined" && window.confirm ? window.confirm(message) : true); });
const appPrompt = (message, def = "") => new Promise((resolve) => { if (_dlgSet) _dlgSet({ kind: "prompt", message, def, resolve }); else resolve(typeof window !== "undefined" && window.prompt ? window.prompt(message, def) : null); });

function DialogHost() {
  const [d, setD] = useState(null);
  const [val, setVal] = useState("");
  useEffect(() => { _dlgSet = (req) => { setVal(req.def || ""); setD(req); }; return () => { _dlgSet = null; }; }, []);
  if (!d) return null;
  const close = (result) => { d.resolve(result); setD(null); };
  const cancel = () => close(d.kind === "prompt" ? null : false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={cancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{d.message}</div>
        {d.kind === "prompt" && <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") close(val); if (e.key === "Escape") cancel(); }} className={`${inputCls} mt-3`} />}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={cancel} className={`${btnGhost} w-full sm:w-auto`}>Отмена</button>
          <button onClick={() => close(d.kind === "prompt" ? val : true)} className={d.danger ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 sm:w-auto" : `${btnPrimary} w-full sm:w-auto`}>{d.kind === "prompt" ? "ОК" : (d.okText || "Да")}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(makeSeed);
  const [saveErr, setSaveErr] = useState(null);
  const [saveState, setSaveState] = useState("saved");
  const [migProgress, setMigProgress] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [meId, setMeId] = useState(null);
  const [view, setView] = useState("home");
  const [activeId, setActiveId] = useState(null);
  const [newType, setNewType] = useState(null);
  const [summaryPeriod, setSummaryPeriod] = useState("");
  const [reportMonth, setReportMonth] = useState(monthKeyOf(new Date()));
  const [repeatFrom, setRepeatFrom] = useState(null);
  const [printIds, setPrintIds] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    setSaveErrorHandler((kind, size, msg) => setSaveErr({ kind, size, msg }));
    setSaveOkHandler(() => { setSaveErr(null); setSaveState("saved"); });   // получилось записать — тревогу снимаем
    setSaveStateHandler((st) => setSaveState(st));
    return () => { setSaveErrorHandler(null); setSaveOkHandler(null); setSaveStateHandler(null); };
  }, []);

  useEffect(() => { if (loaded) saveData(data); }, [data, loaded]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;
    const flush = () => { try { saveDataNow(data); } catch (_) {} };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", flush); };
  }, [data]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.getElementById("app-fonts")) {
      const l = document.createElement("link"); l.id = "app-fonts"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(l);
    }
    if (!document.getElementById("app-typo")) {
      const st = document.createElement("style"); st.id = "app-typo";
      st.textContent = ".theme-dark{background:#131110}.theme-dark.bg-stone-100{background-color:#131110!important}.theme-dark .bg-stone-100{background-color:#2b2725!important}.theme-dark .bg-white{background-color:#1e1b19!important}.theme-dark .bg-stone-50{background-color:#26221f!important}.theme-dark .hover\\:bg-stone-50:hover{background-color:#2a2623!important}.theme-dark .hover\\:bg-stone-100:hover{background-color:#2e2a27!important}.theme-dark .bg-stone-200{background-color:#3a3531!important}.theme-dark .text-stone-900{color:#f5f3f0!important}.theme-dark .text-stone-800{color:#e9e5e0!important}.theme-dark .text-stone-700{color:#d3cdc6!important}.theme-dark .text-stone-600{color:#b3aba2!important}.theme-dark .text-stone-500{color:#948c83!important}.theme-dark .text-stone-400{color:#8a8279!important}.theme-dark .text-stone-300{color:#6b645c!important}.theme-dark .border-stone-200{border-color:#33302c!important}.theme-dark .border-stone-300{border-color:#4a443e!important}.theme-dark .border-stone-100{border-color:#2a2724!important}.theme-dark .divide-stone-100>*+*{border-color:#2a2724!important}.theme-dark .border-dashed{border-color:#4a443e!important}.theme-dark .bg-amber-50,.theme-dark .bg-amber-100{background-color:#3a2c10!important}.theme-dark .text-amber-600,.theme-dark .text-amber-700,.theme-dark .text-amber-800,.theme-dark .text-amber-900{color:#fbd775!important}.theme-dark .border-amber-200,.theme-dark .border-amber-300,.theme-dark .border-amber-400{border-color:#8a681f!important}.theme-dark .bg-sky-50,.theme-dark .bg-sky-100{background-color:#12293b!important}.theme-dark .text-sky-600,.theme-dark .text-sky-700,.theme-dark .text-sky-800{color:#7cc6f5!important}.theme-dark .border-sky-200,.theme-dark .border-sky-300,.theme-dark .border-sky-500{border-color:#255d80!important}.theme-dark .bg-violet-50,.theme-dark .bg-violet-100{background-color:#261a3e!important}.theme-dark .text-violet-600,.theme-dark .text-violet-700,.theme-dark .text-violet-800{color:#c4aefc!important}.theme-dark .border-violet-200,.theme-dark .border-violet-300,.theme-dark .border-violet-400{border-color:#5a448f!important}.theme-dark .bg-emerald-50,.theme-dark .bg-emerald-100{background-color:#0e2c20!important}.theme-dark .text-emerald-600,.theme-dark .text-emerald-700,.theme-dark .text-emerald-800{color:#5fd6a4!important}.theme-dark .border-emerald-200,.theme-dark .border-emerald-300{border-color:#276e52!important}.theme-dark .bg-rose-50,.theme-dark .bg-rose-100{background-color:#3a151a!important}.theme-dark .text-rose-600,.theme-dark .text-rose-700,.theme-dark .text-rose-800{color:#f79aa6!important}.theme-dark .border-rose-200,.theme-dark .border-rose-300{border-color:#8a3542!important}.theme-dark .bg-orange-50,.theme-dark .bg-orange-100{background-color:#3a2410!important}.theme-dark .text-orange-700,.theme-dark .text-orange-800,.theme-dark .text-orange-900{color:#f7b17a!important}.theme-dark .border-orange-200,.theme-dark .border-orange-300{border-color:#8a5424!important}.theme-dark .bg-teal-50,.theme-dark .bg-teal-100{background-color:#0d2b2b!important}.theme-dark .text-teal-600,.theme-dark .text-teal-700,.theme-dark .text-teal-800{color:#5fd0d0!important}.theme-dark main .bg-stone-900,.theme-dark .z-50 .bg-stone-900{background-color:#e9e5e0!important;color:#1e1b19!important}.theme-dark main .bg-stone-900 .text-white,.theme-dark main .bg-stone-900.text-white,.theme-dark .z-50 .bg-stone-900.text-white{color:#1e1b19!important}.theme-dark ::placeholder{color:#7d766e}.theme-dark input,.theme-dark select,.theme-dark textarea{color:#f5f3f0}.theme-dark input[type=date],.theme-dark input[type=number]{color-scheme:dark}.theme-dark .shadow-sm,.theme-dark .shadow-xl,.theme-dark .shadow-lg{box-shadow:0 1px 3px rgba(0,0,0,0.6)!important}" + "body,.font-sans{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}table,.font-mono,.tnum{font-variant-numeric:tabular-nums}h1,h2,h3{letter-spacing:-0.011em}";
      document.head.appendChild(st);
    }
  }, []);

  useEffect(() => { (async () => {
    if (SRV.url) {
      SRV.onRemote = (state) => setData(state);
      const sess = await loadSession();
      if (sess && sess.token) {
        SRV.token = sess.token;
        const { existed, value } = await loadData(makeSeed());
        if (existed) { setData(value); setMeId(sess.userId); setToken(sess.token); }
        else { SRV.token = null; saveSession(null); }
      }
      setLoaded(true);
    } else {
      const ld = await loadData(makeSeed());
      const value = ld.value;
      markSaved(value);   // помечаем ровно ту форму, что пишется, — при входе без изменений записи не будет вообще
      setData(value); setLoaded(true);
      const mig = await migrateInlineImages(value, (done, total) => setMigProgress({ done, total }));
      setMigProgress(null);
      const finalState = mig.total > 0 ? mig.state : value;
      if (mig.total > 0) setData(finalState);
      if (mig.total > 0 || ld.legacyFormat) {
        // разовая тихая перекладка в ячейки: до 6 заходов, без плашки — старые данные целы
        (async () => {
          let raws = null; try { raws = shardRaws(finalState); } catch (_) { return; }
          for (let a = 0; a < 6; a++) {
            let left = SHARD_NAMES.filter((n) => raws[n] !== _lastShardRaw[n]);
            let ok = true;
            for (const n of left) { try { await sSet(shardKey(n), raws[n]); _lastShardRaw[n] = raws[n]; } catch (_) { ok = false; } }
            if (ok) return;
            await sleep(2000 * (a + 1));
          }
        })();
      }
    }
  })(); }, []);
  useEffect(() => {
    if (!SRV.url) return;
    const iv = setInterval(async () => {
      if (!SRV.token || SRV.saving || _putPending != null) return;
      try { const r = await srvFetch("/api/state"); if (r.ok) { const j = await r.json(); if (j.version > SRV.version) { SRV.version = j.version; setData(j.state); } } } catch (_) {}
    }, 4000);
    return () => clearInterval(iv);
  }, [meId]);
  const persist = (updater) => setData((prev) => (typeof updater === "function" ? updater(prev) : updater));
  const stamp = () => new Date().toISOString();
  const me = data.users.find((u) => u.id === meId) || null;
  const updateReq = (id, fn) => persist((prev) => ({ ...prev, requests: prev.requests.map((r) => (r.id === id ? fn(r) : r)) }));
  const logout = () => { if (SRV.url) { if (SRV.token) srvFetch("/api/logout", { method: "POST" }).catch(() => {}); SRV.token = null; saveSession(null); setToken(null); } setMeId(null); setView("home"); setActiveId(null); setActiveOrderId(null); };
  const TRANSIENT_VIEWS = ["detail", "print", "orderdetail", "orderprint", "new", "pickType", "neworder", "printbatch", "ordersummary", "reportsprint"];
  const backViewRef = useRef("home");
  const open = (id) => { if (!TRANSIENT_VIEWS.includes(view)) backViewRef.current = view; setActiveId(id); setView("detail"); };
  const back = () => { setActiveId(null); setView(backViewRef.current || "home"); };
  const openOrder = (id) => { if (!TRANSIENT_VIEWS.includes(view)) backViewRef.current = view; setActiveOrderId(id); setView("orderdetail"); };

  const api = {
    createRequest: (type, payload, atts) => {
      const newId = uid();
      let created;
      persist((prev) => {
        const t = TYPES[type]; const n = (prev.counters[type] || 0) + 1; const number = `${t.prefix}-${pad(n)}`;
        const src = (prev.chains[payload.departmentId] && prev.chains[payload.departmentId][type]) || [];
        const chain = src.filter((st) => st.approverId).map((st) => { const u = prev.users.find((x) => x.id === st.approverId); return { approverId: st.approverId, approverName: u ? u.name : "—", role: u ? u.role : "approver", label: st.label }; });
        const hasChain = chain.length > 0;
        const uLim = prev.urgentLimit == null ? 3 : prev.urgentLimit;
        const uToday = prev.requests.filter((r) => r.priority === "Срочно" && isToday(r.createdAt)).length;
        const pr = (payload.priority === "Срочно" && uLim > 0 && uToday >= uLim) ? "Высокий" : payload.priority;
        created = {
          id: newId, number, type, departmentId: payload.departmentId, departmentName: deptName(prev, payload.departmentId),
          objectId: payload.objectId || "", objectName: payload.objectName || "", objectColor: payload.objectColor || "",
          createdAt: stamp(), requesterId: meId, priority: pr, note: payload.note,
          fields: payload.fields, items: (payload.items || []).map((x) => ({ ...x, fulfilled: false, stock: {} })), attachments: (atts || []).map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, by: meId, byName: me.name, at: stamp() })),
          chain, currentStageIndex: 0, status: hasChain ? "approval" : "supply", assignee: "", due: pr === "Срочно" ? "" : (payload.due || ""), supplyStage: "new", postponed: false, supplyNotes: [],
          history: hasChain ? [{ action: "created", by: meId, byName: me.name, at: stamp() }] : [{ action: "created", by: meId, byName: me.name, at: stamp() }, { action: "edited", by: meId, byName: me.name, comment: "Маршрут согласования для этого отдела и типа не настроен — заявка передана в снабжение без согласования", at: stamp() }],
        };
        return { ...prev, requests: [created, ...prev.requests], counters: { ...prev.counters, [type]: n } };
      });
      open(newId);
      return newId;
    },
    resubmit: (id) => updateReq(id, (r) => ({ ...r, status: "approval", currentStageIndex: 0, history: [...r.history, { action: "resubmitted", by: meId, byName: me.name, comment: "Отправлена повторно после доработки", at: stamp() }] })),
    decide: (id, d, comment) => updateReq(id, (r) => {
      const st = r.chain[r.currentStageIndex]; const isWh = st && st.role === "warehouse";
      const action = d === "approve" ? (isWh ? "stock" : "approved") : "rejected";
      const h = [...r.history, { action, by: meId, byName: me.name, stage: st ? (st.label || st.approverName) : "", comment, at: stamp() }];
      if (d === "reject") return { ...r, history: h, status: "returned", currentStageIndex: 0 };
      const last = r.currentStageIndex + 1 >= r.chain.length;
      return { ...r, history: h, currentStageIndex: last ? r.chain.length : r.currentStageIndex + 1, status: last ? "supply" : "approval" };
    }),
    setStock: (reqId, itemId, patch) => updateReq(reqId, (r) => ({ ...r, items: r.items.map((x) => (x.id === itemId ? { ...x, stock: { ...(x.stock || {}), ...patch, by: meId, byName: me.name, at: stamp() } } : x)) })),
    setPriority: (id, p) => updateReq(id, (r) => ({ ...r, priority: p })),
    cyclePriority: (id) => updateReq(id, (r) => { const i = PRIORITIES.indexOf(r.priority); return { ...r, priority: PRIORITIES[(i + 1) % PRIORITIES.length] }; }),
    claim: (id) => updateReq(id, (r) => { if (r.assignee && r.assignee !== meId && !(me.role === "admin" || me.lead)) return r; return { ...r, assignee: meId, supplyStage: (r.supplyStage && r.supplyStage !== "new") ? r.supplyStage : "inwork", history: [...r.history, { action: "claimed", by: meId, byName: me.name, at: stamp() }] }; }),
    release: (id) => updateReq(id, (r) => { if (!(me.role === "admin" || me.lead)) return r; return { ...r, assignee: "", supplyStage: "new", history: [...r.history, { action: "released", by: meId, byName: me.name, at: stamp() }] }; }),
    assignTo: (id, userId) => updateReq(id, (r) => { if (!(me.role === "admin" || me.lead)) return r; const u = data.users.find((x) => x.id === userId); return { ...r, assignee: userId, supplyStage: (r.supplyStage && r.supplyStage !== "new") ? r.supplyStage : "inwork", history: [...r.history, { action: "assigned", by: meId, byName: me.name, comment: u ? "→ " + u.name : "", at: stamp() }] }; }),
    setDue: (id, due) => updateReq(id, (r) => ({ ...r, due })),
    setSupplyStage: (id, stage) => updateReq(id, (r) => ({ ...r, supplyStage: stage })),
    togglePostpone: (id) => updateReq(id, (r) => ({ ...r, postponed: !r.postponed })),
    setPostponed: (id, v) => updateReq(id, (r) => ({ ...r, postponed: !!v })),
    setDeskView: (v) => persist((prev) => ({ ...prev, deskView: v })),
    toggleItem: (id, itemId) => updateReq(id, (r) => ({ ...r, items: r.items.map((x) => (x.id === itemId ? { ...x, fulfilled: !x.fulfilled } : x)) })),
    addNote: (id, text) => updateReq(id, (r) => ({ ...r, supplyNotes: [...r.supplyNotes, { by: meId, byName: me.name, text, at: stamp() }] })),
    fulfill: (id, spent) => persist((prev) => {
      const src = (prev.requests || []).find((r) => r.id === id);
      const srcSet = src && src.consolidated ? new Set(src.sourceIds || []) : null;
      return { ...prev, requests: (prev.requests || []).map((r) => {
        if (r.id === id) return { ...r, status: "fulfilled", spent: spent == null ? r.spent : spent, items: (r.items || []).map((x) => ({ ...x, fulfilled: true })), history: [...r.history, { action: "fulfilled", by: meId, byName: me.name, comment: spent ? "Потрачено: " + fmtMoney(spent) : undefined, at: stamp() }] };
        if (srcSet && srcSet.has(r.id)) return { ...r, status: "fulfilled", postponed: false, consolidatedInto: undefined, wasConsolidated: src.number, items: (r.items || []).map((x) => ({ ...x, fulfilled: true })), history: [...r.history, { action: "fulfilled", by: meId, byName: me.name, comment: "Закуплено в составе сводной " + src.number + " — подтвердите получение", at: stamp() }] };
        return r;
      }) };
    }),
    confirm: (id) => updateReq(id, (r) => ({ ...r, status: "done", history: [...r.history, { action: "confirmed", by: meId, byName: me.name, at: stamp() }] })),
    returnToSupply: (id, comment) => updateReq(id, (r) => ({ ...r, status: "supply", history: [...r.history, { action: "returned", by: meId, byName: me.name, comment, at: stamp() }] })),
    editRequest: (id, patch) => updateReq(id, (r) => {
      const oldItems = r.items || []; const merged = (patch.items || []).map((x) => { const prevIt = oldItems.find((o) => o.id === x.id); return { ...x, fulfilled: prevIt ? prevIt.fulfilled : false, stock: prevIt ? prevIt.stock : {} }; });
      return { ...r, fields: patch.fields != null ? patch.fields : r.fields, items: patch.items != null ? merged : r.items, note: patch.note != null ? patch.note : r.note, history: [...r.history, { action: "edited", by: meId, byName: me.name, at: stamp() }] };
    }),
    addAttachment: (reqId, file) => { fileToDataUrl(file, async (dataUrl) => { if (!dataUrl) { appConfirm("Не удалось прочитать файл. Попробуйте другой.", { okText: "Понятно" }); return; } const bytes = Math.round((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 0.75); if (bytes > 1500000) { appConfirm("Файл «" + file.name + "» слишком большой даже после сжатия и не был прикреплён.", { okText: "Понятно" }); return; } const aid = uid(); const ok = await putAtt(aid, dataUrl); if (!ok) { appConfirm("Файл «" + (file.name || "фото") + "» не удалось сохранить — возможно, в хранилище кончилось место. Файл не прикреплён.", { okText: "Понятно" }); return; } updateReq(reqId, (r) => ({ ...r, attachments: [...(r.attachments || []), { id: aid, name: file.name || "фото.jpg", mime: file.type || "image/jpeg", size: bytes, by: meId, byName: me.name, at: stamp() }] })); }); },
    removeAttachment: (reqId, attId) => { delAtt(attId); updateReq(reqId, (r) => ({ ...r, attachments: (r.attachments || []).filter((a) => a.id !== attId) })); },
    addUser: () => persist((prev) => { let nn = prev.users.length + 1; while (prev.users.some((u) => u.login === "user" + nn)) nn += 1; return { ...prev, users: [...prev.users, { id: uid(), login: "user" + nn, key: genKey(), name: "Новый сотрудник", role: "requester", departmentId: prev.departments[0] ? prev.departments[0].id : "" }] }; }),
    updateUser: (id, patch) => { if (patch && patch.login != null) { const lg = String(patch.login).trim().toLowerCase(); if (lg && (data.users || []).some((u) => u.id !== id && String(u.login || "").trim().toLowerCase() === lg)) { appConfirm("Логин «" + patch.login + "» уже занят другим сотрудником. Логины должны быть уникальными, иначе вход будет неоднозначным.", { okText: "Понятно" }); return; } } return persist((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })); },
    deleteUser: (id) => persist((prev) => {
      const chains = {};
      Object.keys(prev.chains || {}).forEach((dep) => { const byType = {}; Object.keys(prev.chains[dep] || {}).forEach((tp) => { byType[tp] = (prev.chains[dep][tp] || []).filter((st) => st.approverId !== id); }); chains[dep] = byType; });
      const orderChains = {};
      Object.keys(prev.orderChains || {}).forEach((dep) => { orderChains[dep] = (prev.orderChains[dep] || []).filter((st) => st.approverId !== id); });
      const requests = (prev.requests || []).map((r) => {
        let out = r;
        if (r.assignee === id) out = { ...out, assignee: "" };
        if (r.status === "approval" && (r.chain || []).some((st) => st.approverId === id)) {
          const chain = (r.chain || []).filter((st) => st.approverId !== id);
          const idx = Math.min(r.currentStageIndex, chain.length);
          out = { ...out, chain, currentStageIndex: idx, status: chain.length === 0 || idx >= chain.length ? "supply" : "approval",
            history: [...(r.history || []), { action: "edited", by: meId, byName: me.name, comment: "Согласующий удалён — этап снят автоматически", at: stamp() }] };
        }
        return out;
      });
      const orders = (prev.orders || []).map((o) => {
        if (o.status !== "approval" || !(o.chain || []).some((st) => st.approverId === id)) return o;
        const chain = (o.chain || []).filter((st) => st.approverId !== id);
        const idx = Math.min(o.currentStageIndex, chain.length);
        return { ...o, chain, currentStageIndex: idx, status: chain.length === 0 || idx >= chain.length ? "approved" : "approval",
          history: [...(o.history || []), { action: "edited", by: meId, byName: me.name, comment: "Согласующий удалён — этап снят автоматически", at: stamp() }] };
      });
      return { ...prev, users: prev.users.filter((u) => u.id !== id), chains, orderChains, requests, orders };
    }),
    setUrgentLimit: (n) => persist((prev) => ({ ...prev, urgentLimit: Math.max(0, Math.min(99, Math.round(Number(n) || 0))) })),
    setChain: (deptId, type, next) => persist((prev) => ({ ...prev, chains: { ...prev.chains, [deptId]: { ...prev.chains[deptId], [type]: next } } })),
    addDepartment: () => persist((prev) => { const d = { id: uid(), name: "Новый отдел" }; return { ...prev, departments: [...prev.departments, d], chains: { ...prev.chains, [d.id]: emptyChains() } }; }),
    renameDepartment: (id, name) => persist((prev) => ({ ...prev, departments: prev.departments.map((d) => (d.id === id ? { ...d, name } : d)) })),
    deleteDepartment: (id) => persist((prev) => { if (prev.departments.length <= 1) return prev; const chains = { ...prev.chains }; delete chains[id]; return { ...prev, departments: prev.departments.filter((d) => d.id !== id), chains, users: prev.users.map((u) => (u.departmentId === id ? { ...u, departmentId: "" } : u)) }; }),
    addObject: () => persist((prev) => ({ ...prev, objects: [...prev.objects, { id: uid(), name: "Новый объект", userIds: [], color: OBJ_PALETTE[prev.objects.length % OBJ_PALETTE.length] }] })),
    updateObject: (id, name) => persist((prev) => ({ ...prev, objects: prev.objects.map((o) => (o.id === id ? { ...o, name } : o)) })),
    setObjectColor: (id, color) => persist((prev) => ({ ...prev, objects: prev.objects.map((o) => (o.id === id ? { ...o, color } : o)) })),
    toggleObjectUser: (objId, userId) => persist((prev) => ({ ...prev, objects: prev.objects.map((o) => (o.id === objId ? { ...o, userIds: (o.userIds || []).includes(userId) ? o.userIds.filter((x) => x !== userId) : [...(o.userIds || []), userId] } : o)) })),
    deleteObject: (id) => persist((prev) => ({ ...prev, objects: prev.objects.filter((o) => o.id !== id) })),
    addCatalog: () => persist((prev) => ({ ...prev, catalog: [...prev.catalog, { id: uid(), name: "Новая позиция", unit: "шт", category: "Прочее" }] })),
    updateCatalog: (id, patch) => persist((prev) => ({ ...prev, catalog: prev.catalog.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    deleteCatalog: (id) => persist((prev) => ({ ...prev, catalog: prev.catalog.filter((c) => c.id !== id) })),
    addOrderAtt: (orderId, file) => { fileToDataUrl(file, async (dataUrl) => { if (!dataUrl) { appConfirm("Не удалось прочитать файл. Попробуйте другой.", { okText: "Понятно" }); return; } const bytes = Math.round((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 0.75); if (bytes > 1500000) { appConfirm("Файл «" + file.name + "» слишком большой даже после сжатия и не был прикреплён.", { okText: "Понятно" }); return; } const aid = uid(); const ok = await putAtt(aid, dataUrl); if (!ok) { appConfirm("Файл «" + (file.name || "фото") + "» не удалось сохранить — возможно, в хранилище кончилось место. Файл не прикреплён.", { okText: "Понятно" }); return; } persist((prev) => ({ ...prev, orders: (prev.orders || []).map((o) => (o.id === orderId ? { ...o, attachments: [...(o.attachments || []), { id: aid, name: file.name || "фото.jpg", mime: file.type || "image/jpeg", size: bytes, by: meId, byName: me.name, at: stamp() }] } : o)) })); }); },
    removeOrderAtt: (orderId, attId) => { delAtt(attId); persist((prev) => ({ ...prev, orders: (prev.orders || []).map((o) => (o.id === orderId ? { ...o, attachments: (o.attachments || []).filter((a) => a.id !== attId) } : o)) })); },
    createOrder: (payload) => {
      let created;
      persist((prev) => {
        let ips = prev.ips || []; let pIpId = payload.ipId; const pIpName = (payload.ipName || "").trim();
        if (pIpName && !pIpId) { const ex = ips.find((x) => x.name.trim().toLowerCase() === pIpName.toLowerCase()); if (ex) pIpId = ex.id; else { const nu = { id: uid(), name: pIpName, vat: true }; ips = [...ips, nu]; pIpId = nu.id; } }
        payload = { ...payload, ipId: pIpId };
        prev = { ...prev, ips };
        const n = (prev.orderCounter || 0) + 1; const number = `Н-${pad(n)}`;
        const src = prev.orderChains[payload.departmentId] || [];
        const chain = src.filter((st) => st.approverId).map((st) => { const u = prev.users.find((x) => x.id === st.approverId); return { approverId: st.approverId, approverName: u ? u.name : "—", role: u ? u.role : "approver", label: st.label }; });
        const hasChain = chain.length > 0;
        created = { id: uid(), number, departmentId: payload.departmentId, departmentName: deptName(prev, payload.departmentId), objectId: payload.objectId || "", objectName: payload.objectName || "", objectColor: payload.objectColor || "", period: payload.period || "", periodLabel: payload.periodLabel || "", ipId: payload.ipId || "", ipName: payload.ipName || "", catalogId: payload.catalogId, catalogName: payload.catalogName, createdAt: stamp(), requesterId: meId, note: payload.note || "", lines: payload.lines, chain, currentStageIndex: 0, status: hasChain ? "approval" : "approved", history: [{ action: "created", by: meId, byName: me.name, at: stamp() }] };
        return { ...prev, orders: [created, ...prev.orders], orderCounter: n };
      });
      if (created) openOrder(created.id);
    },
    updateOrderLine: (id, lineId, patchIn) => { if (patchIn && patchIn.price != null && !me.canPrice && me.role !== "admin") { appConfirm("У вас нет права менять цены в нарядах. Обратитесь к администратору.", { okText: "Понятно" }); return; } const patch = { ...patchIn }; if (patch.qty != null) { const q = num(patch.qty); patch.qty = q < 0 ? "0" : String(patch.qty); if (q < 0) patch.qty = "0"; } if (patch.price != null) patch.price = Math.max(0, Number(patch.price) || 0); return persist((prev) => ({ ...prev, orders: prev.orders.map((o) => { if (o.id !== id) return o; const ln = (o.lines || []).find((l) => l.id === lineId); if (!ln) return o; const lines = o.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)); const what = patch.price != null ? ("цена: " + fmtMoney(ln.price) + " → " + fmtMoney(patch.price)) : ("кол-во: " + ln.qty + " → " + patch.qty); return { ...o, lines, history: [...o.history, { action: "edited", by: meId, byName: me.name, comment: ln.name + " · " + what, at: stamp() }] }; }) })); },
    removeOrderLine: (id, lineId) => persist((prev) => ({ ...prev, orders: prev.orders.map((o) => { if (o.id !== id) return o; const ln = (o.lines || []).find((l) => l.id === lineId); if (!ln) return o; return { ...o, lines: o.lines.filter((l) => l.id !== lineId), history: [...o.history, { action: "edited", by: meId, byName: me.name, comment: "удалена позиция: " + ln.name, at: stamp() }] }; }) })),
    resubmitOrder: (id) => persist((prev) => ({ ...prev, orders: (prev.orders || []).map((o) => (o.id === id ? { ...o, status: "approval", currentStageIndex: 0, history: [...o.history, { action: "resubmitted", by: meId, byName: me.name, comment: "Отправлен повторно после доработки", at: stamp() }] } : o)) })),
    decideOrder: (id, d, comment) => { const o0 = (data.orders || []).find((x) => x.id === id); if (d === "approve" && o0 && (!o0.lines || o0.lines.length === 0)) { appConfirm("В наряде нет ни одной позиции — согласовать его нельзя. Верните наряд автору или добавьте работы.", { okText: "Понятно" }); return; } return persist((prev) => ({ ...prev, orders: prev.orders.map((o) => { if (o.id !== id) return o; const st = o.chain[o.currentStageIndex]; const h = [...o.history, { action: d === "approve" ? "approved" : "rejected", by: meId, byName: me.name, stage: st ? (st.label || st.approverName) : "", comment, at: stamp() }]; if (d === "reject") return { ...o, history: h, status: "rejected" }; const last = o.currentStageIndex + 1 >= o.chain.length; return { ...o, history: h, currentStageIndex: last ? o.chain.length : o.currentStageIndex + 1, status: last ? "approved" : "approval" }; }) })); },
    addWorkList: () => persist((prev) => ({ ...prev, workCatalogs: [...(prev.workCatalogs || []), { id: uid(), name: "Новый список работ", items: [] }] })),
    renameWorkList: (id, name) => persist((prev) => ({ ...prev, workCatalogs: prev.workCatalogs.map((c) => (c.id === id ? { ...c, name } : c)) })),
    deleteWorkList: (id) => persist((prev) => ({ ...prev, workCatalogs: prev.workCatalogs.filter((c) => c.id !== id) })),
    importWorkList: (name, items) => persist((prev) => ({ ...prev, workCatalogs: [...(prev.workCatalogs || []), { id: uid(), name, items: items.map((w) => ({ id: uid(), name: String(w.name || "").trim(), unit: String(w.unit || "").trim(), price: Number(w.price) || 0 })).filter((w) => w.name) }] })),
    addWorkItem: (catId) => persist((prev) => ({ ...prev, workCatalogs: prev.workCatalogs.map((c) => (c.id === catId ? { ...c, items: [{ id: uid(), name: "", unit: "шт.", price: 0 }, ...c.items] } : c)) })),
    updateWorkItem: (catId, itemId, patch) => persist((prev) => ({ ...prev, workCatalogs: prev.workCatalogs.map((c) => (c.id === catId ? { ...c, items: c.items.map((w) => (w.id === itemId ? { ...w, ...patch } : w)) } : c)) })),
    deleteWorkItem: (catId, itemId) => persist((prev) => ({ ...prev, workCatalogs: prev.workCatalogs.map((c) => (c.id === catId ? { ...c, items: c.items.filter((w) => w.id !== itemId) } : c)) })),
    setOrderChain: (deptId, chain) => persist((prev) => ({ ...prev, orderChains: { ...prev.orderChains, [deptId]: chain } })),
    addIp: () => persist((prev) => ({ ...prev, ips: [...(prev.ips || []), { id: uid(), name: "ИП ", bin: "", vat: true }] })),
    updateIp: (id, patch) => persist((prev) => ({ ...prev, ips: (prev.ips || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    deleteIp: (id) => persist((prev) => ({ ...prev, ips: (prev.ips || []).filter((x) => x.id !== id) })),
    createNote: () => { const id = uid(); persist((prev) => ({ ...prev, notes: [{ id, userId: meId, title: "", body: "", createdAt: stamp(), updatedAt: stamp() }, ...(prev.notes || [])] })); return id; },
    updateNote: (id, patch) => persist((prev) => ({ ...prev, notes: (prev.notes || []).map((nn) => (nn.id === id ? { ...nn, ...patch, updatedAt: stamp() } : nn)) })),
    deleteNote: (id) => persist((prev) => ({ ...prev, notes: (prev.notes || []).filter((nn) => nn.id !== id) })),
    sendChat: (text) => persist((prev) => ({ ...prev, chat: [...(prev.chat || []), { id: uid(), by: meId, byName: me.name, role: me.role, text, at: stamp() }].slice(-500) })),
    markChatRead: () => persist((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === meId ? { ...u, chatReadAt: stamp() } : u)) })),
    markNotifsRead: () => persist((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === meId ? { ...u, notifReadAt: stamp() } : u)) })),
    setTheme: (th) => persist((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === meId ? { ...u, theme: th } : u)) })),
    setAvatar: (file) => { imageToPng(file, 320, 320, async (res) => { if (!res || !res.dataUrl) { appConfirm("Не удалось прочитать изображение. Подойдёт PNG, JPG или SVG.", { okText: "Понятно" }); return; } const ok = await putAtt("avatar-" + meId, res.dataUrl); if (!ok) { appConfirm("Фото профиля не удалось сохранить — возможно, в хранилище кончилось место.", { okText: "Понятно" }); return; } persist((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === meId ? { ...u, avatar: null, avatarVer: (u.avatarVer || 0) + 1 } : u)) })); }); },
    saveDraft: (payload) => persist((prev) => ({ ...prev, drafts: { ...(prev.drafts || {}), [meId]: { ...payload, savedAt: stamp() } } })),
    clearDraft: () => persist((prev) => { const d = { ...(prev.drafts || {}) }; delete d[meId]; return { ...prev, drafts: d }; }),
    setEta: (id, eta) => updateReq(id, (r) => ({ ...r, eta: eta || undefined, history: [...r.history, { action: "eta", by: meId, byName: me.name, comment: eta ? "Срок исполнения: " + fmtDate(eta) : "Срок исполнения снят", at: stamp() }] })),
    setItemDelivered: (id, itemId, qty) => updateReq(id, (r) => ({ ...r, items: r.items.map((x) => { if (x.id !== itemId) return x; const total = num(x.qty); const dq = Math.max(0, num(qty)); return { ...x, deliveredQty: qty === "" ? undefined : qty, fulfilled: total > 0 && dq >= total ? true : (dq > 0 ? false : x.fulfilled) }; }) })),
    setItemMeta: (id, itemId, patch) => updateReq(id, (r) => ({ ...r, items: r.items.map((x) => (x.id === itemId ? { ...x, ...patch } : x)) })),
    sendDM: (toId, text) => persist((prev) => ({ ...prev, dm: [...(prev.dm || []), { id: uid(), from: meId, to: toId, text, at: stamp(), readBy: [meId] }].slice(-2000) })),
    markDMRead: (peerId) => persist((prev) => ({ ...prev, dm: (prev.dm || []).map((m) => (m.from === peerId && m.to === meId && !(m.readBy || []).includes(meId) ? { ...m, readBy: [...(m.readBy || []), meId] } : m)) })),
    sendAnon: (text) => persist((prev) => ({ ...prev, anon: [...(prev.anon || []), { id: uid(), text, at: stamp() }].slice(-500) })),
    addEvent: (date, title) => persist((prev) => ({ ...prev, events: [...(prev.events || []), { id: uid(), userId: meId, date, title, at: stamp() }] })),
    deleteEvent: (id) => persist((prev) => ({ ...prev, events: (prev.events || []).filter((e) => e.id !== id) })),
    addAnnouncement: (text) => persist((prev) => ({ ...prev, announcements: [...(prev.announcements || []), { id: uid(), by: meId, byName: me.name, text, at: stamp() }].slice(-50) })),
    deleteAnnouncement: (id) => persist((prev) => ({ ...prev, announcements: (prev.announcements || []).filter((a) => a.id !== id) })),
    togglePinAnnouncement: (id) => persist((prev) => ({ ...prev, announcements: (prev.announcements || []).map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : { ...a, pinned: false })) })),
    markAnnRead: () => persist((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === meId ? { ...u, annReadAt: stamp() } : u)) })),
    setLogo: (file) => { imageToPng(file, 1400, 500, async (res) => { if (!res || !res.dataUrl) { appConfirm("Не удалось прочитать изображение. Подойдёт PNG (в том числе с прозрачным фоном), JPG или SVG.", { okText: "Понятно" }); return; } const ok = await putAtt("companylogo", res.dataUrl); if (!ok) { appConfirm("Логотип не удалось сохранить — возможно, в хранилище кончилось место.", { okText: "Понятно" }); return; } persist((prev) => ({ ...prev, logo: null, logoW: res.w, logoH: res.h, brandingVer: (prev.brandingVer || 0) + 1 })); }); },
    clearLogo: () => { delAtt("companylogo"); persist((prev) => ({ ...prev, logo: null, logoW: 0, logoH: 0, brandingVer: (prev.brandingVer || 0) + 1 })); },
    withdrawRequest: (id) => updateReq(id, (r) => ({ ...r, status: "rejected", history: [...r.history, { action: "withdrawn", by: meId, byName: me.name, comment: "Отозвана заявителем", at: stamp() }] })),
    setSpent: (id, v) => updateReq(id, (r) => ({ ...r, spent: v })),
    consolidate: (ids) => {
      const pre = (data.requests || []).filter((r) => ids.includes(r.id) && TYPES[r.type] && TYPES[r.type].items && r.status === "supply" && !r.consolidatedInto && !r.consolidated);
      if (pre.length < 2) { appConfirm("Для объединения выберите минимум две активные заявки с позициями (не входящие в другую сводную).", { okText: "Понятно" }); return; }
      let created = null;
      persist((prev) => {
        const reqs = prev.requests.filter((r) => ids.includes(r.id) && TYPES[r.type].items && r.status === "supply" && !r.consolidatedInto && !r.consolidated);
        if (reqs.length < 2) return prev;
        const n = (prev.counters.consol || 0) + 1; const number = `СВ-${pad(n)}`;
        const lines = mergeReqItems(reqs).map((l) => ({ id: uid(), catalogId: "", name: l.name, unit: l.unit, qty: String(l.qty || ""), note: l.src.join("; "), srcRefs: l.refs, fulfilled: l.refs.length > 0 && l.refs.every((rf) => rf.fulfilled), stock: {} }));
        created = { id: uid(), number, type: "tmc", consolidated: true, sourceIds: reqs.map((r) => r.id), sourceNumbers: reqs.map((r) => r.number), departmentId: "", departmentName: "Сводная закупка", objectId: "", objectName: "", objectColor: "", createdAt: stamp(), requesterId: meId, priority: reqs.some((r) => r.priority === "Срочно") ? "Срочно" : reqs.some((r) => r.priority === "Высокий") ? "Высокий" : "Обычный", note: "Объединяет заявки: " + reqs.map((r) => r.number).join(", "), fields: {}, items: lines, attachments: [], chain: [], currentStageIndex: 0, status: "supply", assignee: meId, due: "", supplyStage: "inwork", postponed: false, supplyNotes: [], history: [{ action: "created", by: meId, byName: me.name, at: stamp() }] };
        const srcSet = new Set(reqs.map((r) => r.id));
        return { ...prev, counters: { ...prev.counters, consol: n }, requests: [created, ...prev.requests.map((r) => (srcSet.has(r.id) ? { ...r, consolidatedInto: { id: created.id, number }, postponed: true, supplyNotes: [...(r.supplyNotes || []), { by: meId, byName: me.name, text: `Позиции включены в сводную ${number}.`, at: stamp() }], history: [...r.history, { action: "consolidated", by: meId, byName: me.name, comment: "→ " + number, at: stamp() }] } : r))] };
      });
      return created ? created.id : null;
    },
    unconsolidate: (id) => persist((prev) => {
      const c = prev.requests.find((r) => r.id === id); if (!c || !c.consolidated) return prev;
      const srcSet = new Set(c.sourceIds || []);
      const doneMap = {};
      (c.items || []).forEach((cl) => { if (cl.fulfilled) (cl.srcRefs || []).forEach((rf) => { doneMap[rf.reqId + "|" + rf.itemId] = true; }); });
      const cAtts = c.attachments || [];
      const keep = cAtts.length > 0 || c.spent != null;
      const first = (c.sourceIds || [])[0];
      const firstNum = ((prev.requests.find((r) => r.id === first) || {}).number) || "исходную заявку";
      const restored = prev.requests.map((r) => {
        if (!srcSet.has(r.id)) return r;
        const extra = (r.id === first && cAtts.length > 0) ? cAtts.map((a) => ({ ...a, fromConsolidated: c.number })) : [];
        return { ...r, consolidatedInto: undefined, postponed: false,
          attachments: [...(r.attachments || []), ...extra],
          items: (r.items || []).map((it) => (doneMap[r.id + "|" + it.id] ? { ...it, fulfilled: true } : it)),
          history: [...r.history, { action: "unconsolidated", by: meId, byName: me.name, comment: c.number + " расформирована" + (extra.length ? " · файлы сводной (" + extra.length + ") перенесены сюда" : ""), at: stamp() }] };
      });
      const withoutC = restored.filter((r) => r.id !== id);
      if (!keep) return { ...prev, requests: withoutC };
      const archived = { ...c, status: "rejected", attachments: [], postponed: false, note: (c.note || "") + " · Расформирована; файлы перенесены в " + firstNum, history: [...c.history, { action: "unconsolidated", by: meId, byName: me.name, comment: "Сводная расформирована; позиции возвращены в исходные заявки", at: stamp() }] };
      return { ...prev, requests: [...withoutC, archived] };
    }),
    addVehicle: () => persist((prev) => ({ ...prev, vehicles: [...(prev.vehicles || []), { id: uid(), name: "Новая техника" }] })),
    updateVehicle: (id, name) => persist((prev) => ({ ...prev, vehicles: (prev.vehicles || []).map((v) => (v.id === id ? { ...v, name } : v)) })),
    deleteVehicle: (id) => persist((prev) => ({ ...prev, vehicles: (prev.vehicles || []).filter((v) => v.id !== id) })),
    importState: (state) => { persist(() => state); setView("home"); setActiveId(null); setActiveOrderId(null); },
    reset: () => { const msg = SRV.url ? "Сбросить ВСЕ общие данные на сервере к демо? Это затронет всех пользователей." : "Сбросить все данные к демо-состоянию?"; appConfirm(msg, { danger: true }).then((ok) => { if (!ok) return; const seed = makeSeed(); persist(seed); setView("home"); setActiveId(null); setActiveOrderId(null); }); },
  };

  if (!loaded) return <div className="flex min-h-screen items-center justify-center bg-stone-100"><div className="flex items-center gap-2 text-stone-400"><RefreshCw className="h-5 w-5 animate-spin motion-reduce:animate-none" /> Загрузка…</div></div>;
  if (SRV.url && !me) return <ServerLogin onDone={(res) => { SRV.token = res.token; SRV.version = res.version; setData(res.state); setMeId(res.userId); setToken(res.token); saveSession({ token: res.token, userId: res.userId }); }} />;
  if (!me) return <LoginScreen users={data.users} brandingVer={data.brandingVer || 0} logo={data.logo || null} onLogin={(id) => { setMeId(id); setView("home"); }} />;

  const activeReq = data.requests.find((r) => r.id === activeId) || null;
  const activeOrder = (data.orders || []).find((o) => o.id === activeOrderId) || null;
  if (view === "print" && activeReq) return <PrintRequest req={activeReq} onBack={() => setView("detail")} />;
  if (view === "ordersummary") return <OrdersSummaryPrint period={summaryPeriod} data={data} onBack={() => setView("orders")} />;
  if (view === "reportsprint") return <ReportsPrint month={reportMonth} data={data} onBack={() => setView("reports")} />;
  if (view === "printbatch") return <PrintBatch reqs={data.requests.filter((r) => printIds.includes(r.id))} onBack={() => setView("home")} title="Печать заявок" />;
  if (view === "orderprint" && activeOrder) return <OrderPrint order={activeOrder} onBack={() => setView("orderdetail")} />;

  const mdn = deptName(data, me.departmentId);
  const homeIcon = me.role === "requester" ? ClipboardList : me.role === "approver" ? Inbox : me.role === "warehouse" ? Warehouse : Package;
  const homeLabel = me.role === "requester" ? "Заявки" : me.role === "approver" ? "Очередь" : me.role === "warehouse" ? "Склад" : "Снабжение";
  const supplyItems = [{ k: "home", label: homeLabel, icon: homeIcon }, { k: "bank", label: "Банк", icon: Layers }];
  const orderApprover = Object.values(data.orderChains || {}).some((ch) => ch.some((st) => st.approverId === me.id));
  const orderItems = [];
  if (me.orders || me.role === "admin" || orderApprover) orderItems.push({ k: "orders", label: "Наряды", icon: ScrollText });
  const personalItems = [{ k: "notebook", label: "Личный кабинет", icon: User }];
  const sysItems = [];
  const navGroups = [{ title: "Снабжение", accent: "amber", items: supplyItems }, { title: "Наряды", accent: "sky", items: orderItems }, { title: "Личное", accent: "violet", items: personalItems }, { title: "Система", accent: "stone", items: sysItems }].filter((g) => g.items.length > 0);
  const badge = (k) => {
    if (k === "notebook") { const gc = (data.chat || []).filter((m2) => m2.by !== me.id && (!me.chatReadAt || new Date(m2.at) > new Date(me.chatReadAt))).length; const dm = (data.dm || []).filter((m2) => m2.to === me.id && !(m2.readBy || []).includes(me.id)).length; return gc + dm; }
    if (k === "orders") return (data.orders || []).filter((o) => o.status === "approval" && o.chain[o.currentStageIndex] && o.chain[o.currentStageIndex].approverId === me.id).length;
    if (k !== "home") return 0;
    if (me.role === "approver" || me.role === "warehouse") return data.requests.filter((r) => r.status === "approval" && r.chain[r.currentStageIndex] && r.chain[r.currentStageIndex].approverId === me.id).length + (data.orders || []).filter((o) => o.status === "approval" && o.chain[o.currentStageIndex] && o.chain[o.currentStageIndex].approverId === me.id).length;
    if (me.role === "supply" || me.role === "admin") return data.requests.filter((r) => r.status === "supply" && !r.assignee).length;
    if (me.role === "requester") return data.requests.filter((r) => r.requesterId === me.id && r.status === "fulfilled").length;
    return 0;
  };
  const isActive = (k) => view === k || (k === "home" && ["detail", "pickType", "new"].includes(view)) || (k === "orders" && ["neworder", "orderdetail", "orderprint"].includes(view));
  const navBtn = (n, desktop) => { const b = badge(n.k); const on = isActive(n.k); const Icon = n.icon; const onCls = `bg-${n.accent || "stone"}-600 text-white`; if (desktop) return <button key={n.k} onClick={() => { setView(n.k); setActiveId(null); setActiveOrderId(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${on ? onCls : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"}`}><Icon className="h-5 w-5" /><span className="flex-1 text-left">{n.label}</span>{b > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs font-bold text-stone-900">{b}</span>}</button>; return <button key={n.k} onClick={() => { setView(n.k); setActiveId(null); setActiveOrderId(null); }} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${on ? onCls : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"}`}><Icon className="h-4 w-4" /> {n.label}{b > 0 && <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-xs font-bold text-stone-900">{b}</span>}</button>; };

  let content;
  if (view === "detail" && activeReq) content = <RequestDetail req={activeReq} me={me} data={data} onBack={back} onPrint={() => setView("print")} api={api} onOpenReq={open} onRepeat={(r) => { setRepeatFrom(r); setNewType(r.type); setView("new"); }} />;
  else if (view === "pickType") content = <PickType onPick={(t) => { setNewType(t); setView("new"); }} onCancel={back} />;
  else if (view === "new" && newType) content = <NewRequest type={newType} data={data} me={me} initial={repeatFrom} onCancel={() => { setRepeatFrom(null); setView("pickType"); }} onDraft={(p2) => { api.saveDraft(p2); setRepeatFrom(null); setView("home"); }} onCreate={async (t2, p2, files) => {
    try {
      setRepeatFrom(null);
      const atts = [];
      let failed = 0;
      for (const p3 of (files || [])) {
        const aid = uid();
        const ok = await putAtt(aid, p3.dataUrl);
        if (ok) atts.push({ id: aid, name: p3.name, mime: p3.mime, size: p3.size });
        else failed++;
      }
      api.clearDraft();
      api.createRequest(t2, p2, atts);
      if (failed) appConfirm("Заявка создана, но " + failed + " файл(ов) не удалось сохранить — возможно, в хранилище кончилось место. Прикрепите их заново в карточке заявки.", { okText: "Понятно" });
    } catch (e2) { appConfirm("Не удалось создать заявку: " + (e2 && e2.message ? e2.message : "неизвестная ошибка"), { okText: "Понятно" }); }
  }} />;
  else if (view === "bank") content = <BankView data={data} me={me} onOpen={open} />;
  else if (view === "dashboard") content = <Dashboard data={data} onOpen={open} />;
  else if (view === "log" && me.role === "admin") content = <ActionLog data={data} onOpen={open} onOpenOrder={openOrder} />;
  else if (view === "settings") content = <SettingsHub data={data} me={me} api={api} />;
  else if (view === "archive") content = <ArchiveView data={data} me={me} onOpen={open} />;
  else if (view === "orders") content = <OrdersHub data={data} me={me} onOpen={openOrder} onNew={() => setView("neworder")} onSummary={(pk) => { setSummaryPeriod(pk); setView("ordersummary"); }} />;
  else if (view === "neworder") content = <NewOrder data={data} me={me} onCancel={() => setView("orders")} onCreate={api.createOrder} />;
  else if (view === "orderdetail" && activeOrder) content = <OrderDetail order={activeOrder} me={me} data={data} api={api} onBack={() => { setActiveOrderId(null); setView(backViewRef.current || "orders"); }} onPrint={() => setView("orderprint")} />;
  else if (view === "notebook") content = <Notebook data={data} me={me} api={api} onOpenReq={open} onOpenOrder={openOrder} reportMonth={reportMonth} setReportMonth={setReportMonth} onReportsPrint={() => setView("reportsprint")} />;
  else if (view === "reports" && me.role === "admin") content = <ReportsHub data={data} me={me} month={reportMonth} setMonth={setReportMonth} onPrint={() => setView("reportsprint")} />;
  else if (me.role === "requester") content = <RequesterHome data={data} me={me} onOpen={open} onNew={() => setView("pickType")} onDraftOpen={(d) => { setRepeatFrom(d); setNewType(d.type); setView("new"); }} api={api} />;
  else if (me.role === "approver") content = <QueueView data={data} me={me} api={api} onOpen={open} onOpenOrder={openOrder} title="Очередь" sub="Согласование заявок и нарядов, ожидающих вас." />;
  else if (me.role === "warehouse") content = <QueueView data={data} me={me} api={api} onOpen={open} onOpenOrder={openOrder} title="Очередь склада" sub="Наличие по заявкам; наряды на согласование, если назначены вам." />;
  else content = <SupplyHub data={data} me={me} api={api} onOpen={open} onConsolidate={(ids) => { const cid = api.consolidate(ids); if (cid) open(cid); }} onPrintBatch={(ids) => { setPrintIds(ids); setView("printbatch"); }} />;

  const anns = data.announcements || [];
  const pinnedAnn = [...anns].reverse().find((a) => a.pinned) || null;
  const lastAnn = anns.length ? anns[anns.length - 1] : null;
  const annUnread = lastAnn && !lastAnn.pinned && (!me.annReadAt || new Date(lastAnn.at) > new Date(me.annReadAt));
  const annBanner = (pinnedAnn || annUnread) ? (
    <>
      {pinnedAnn && <div className="mb-4 flex items-start gap-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 shadow-sm">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">Объявление <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900">закреплено</span></div><div className="whitespace-pre-wrap text-sm text-amber-900">{pinnedAnn.text}</div><div className="mt-1 text-xs text-amber-700">{pinnedAnn.byName} · {fmtDateTime(pinnedAnn.at)}</div></div>
        {me.role === "admin" && <button onClick={() => api.togglePinAnnouncement(pinnedAnn.id)} className="rounded p-1 text-amber-500 hover:bg-amber-100" title="Открепить"><X className="h-4 w-4" /></button>}
      </div>}
      {annUnread && lastAnn !== pinnedAnn && <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-amber-900">Объявление</div><div className="whitespace-pre-wrap text-sm text-amber-900">{lastAnn.text}</div><div className="mt-1 text-xs text-amber-700">{lastAnn.byName} · {fmtDateTime(lastAnn.at)}</div></div>
        <button onClick={api.markAnnRead} className="rounded p-1 text-amber-500 hover:bg-amber-100" title="Прочитано, скрыть"><X className="h-4 w-4" /></button>
      </div>}
    </>
  ) : null;
  const moduleKey = ["orders", "neworder", "orderdetail"].includes(view) ? "orders" : ["notebook", "chat"].includes(view) ? "personal" : "supply";
  const mod = MODULES[moduleKey];
  const ModIcon = mod.icon;
  const moduleStrip = <div className={`mb-4 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm border-${mod.accent}-200`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-${mod.accent}-100 text-${mod.accent}-700`}><ModIcon className="h-5 w-5" /></div><div className="min-w-0"><div className="text-sm font-semibold text-stone-900">{mod.title}</div><div className="text-xs text-stone-500">{mod.sub}</div></div></div>;
  const dark = me.theme === "dark";
  return (
    <div className={`min-h-screen bg-stone-100 font-sans text-stone-900 ${dark ? "theme-dark" : ""}`}><DialogHost />
      {saveState === "retrying" && !saveErr && <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-lg"><RefreshCw className="h-3.5 w-3.5" /> Сохраняю изменения… повторяю</div>}
      {migProgress && <div className="fixed inset-x-0 top-0 z-50 border-b border-sky-700 bg-sky-600 px-4 py-2 text-sm text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <Camera className="h-4 w-4 shrink-0" />
          <span>Переношу фото в хранилище: {migProgress.done} из {migProgress.total} — не закрывайте вкладку</span>
        </div>
      </div>}
      {saveErr && <div className="fixed inset-x-0 top-0 z-50 border-b border-rose-700 bg-rose-600 px-4 py-2.5 text-sm text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{saveErr.kind === "full" ? "Запись слишком большая — данные НЕ сохранены" : "Не удалось сохранить данные"}</div>
            <div className="mt-0.5 leading-snug">Размер записи: <b>{(saveErr.size / 1024).toFixed(0)} КБ</b>. Хранилище ответило: <b>{saveErr.msg || "без объяснения"}</b>.</div>
            <div className="mt-0.5 leading-snug">Не закрывайте вкладку: выгрузите резервную копию (Настройки → Данные) и покажите этот текст разработчику.</div>
          </div>
          <button onClick={() => setSaveErr(null)} className="shrink-0 rounded p-1 hover:bg-rose-700" title="Скрыть"><X className="h-4 w-4" /></button>
        </div>
      </div>}
      <header className="sticky top-0 z-20 border-b border-stone-800 bg-stone-900 text-stone-50 lg:hidden">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5"><CompanyLogo data={data} ver={data.brandingVer || 0} size={8} h={30} maxW={150} /><div className="min-w-0"><div className="truncate text-sm font-semibold leading-tight">{me.name}</div></div></div>
            <div className="flex shrink-0 items-center gap-1.5"><NotifBell data={data} me={me} api={api} onOpenReq={open} dark /><button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs text-stone-300 hover:bg-stone-700"><LogOut className="h-3.5 w-3.5" /> Выйти</button></div>
          </div>
          <nav className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-0.5">{navGroups.map((g, gi) => <React.Fragment key={g.title}>{gi > 0 && <span className="mx-0.5 h-5 w-px shrink-0 bg-stone-700" />}{g.items.map((it) => navBtn({ ...it, accent: g.accent }, false))}</React.Fragment>)}{me.role === "admin" && <button onClick={api.reset} title="Сбросить демо" className="ml-auto shrink-0 rounded-lg px-2 py-1.5 text-stone-500 hover:bg-stone-800 hover:text-stone-300"><RotateCcw className="h-4 w-4" /></button>}</nav>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-stone-800 bg-stone-900 text-stone-50 lg:flex">
        <div className="flex items-center gap-2.5 border-b border-stone-800 px-4 py-4"><CompanyLogo data={data} ver={data.brandingVer || 0} size={9} fallbackIcon="h-6 w-6" h={34} maxW={175} /><div><div className="text-sm font-semibold leading-none">ТОО «Интерстиль»</div><div className="mt-1 text-xs text-stone-400">Внутренняя система</div></div></div>
        <div className="border-b border-stone-800 px-4 py-3"><div className="truncate text-sm font-medium">{me.name}</div></div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">{navGroups.map((g) => <div key={g.title}><div className={`mb-1 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-${g.accent}-400`}><span className={`h-1.5 w-1.5 rounded-full bg-${g.accent}-500`} />{g.title}</div><div className="space-y-1">{g.items.map((it) => navBtn({ ...it, accent: g.accent }, true))}</div></div>)}</nav>
        <div className="space-y-1 border-t border-stone-800 p-3"><div className="mb-1 flex items-center gap-1.5 px-1"><NotifBell data={data} me={me} api={api} onOpenReq={open} dark /></div>{me.role === "admin" && <button onClick={api.reset} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-400 hover:bg-stone-800 hover:text-stone-200"><RotateCcw className="h-5 w-5" /> Сбросить демо</button>}<button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-300 hover:bg-stone-800"><LogOut className="h-5 w-5" /> Выйти</button></div>
      </aside>

      <main className="lg:pl-60"><div className="px-3 py-4 lg:px-6 lg:py-6">{annBanner}{content}</div></main>
      <footer className="mt-2 border-t border-stone-200 px-4 pb-8 pt-4 text-center text-xs text-stone-400 lg:pl-60">Прототип · данные сохраняются в браузере этого устройства (без общего сервера)</footer>
    </div>
  );
}

/* ============================ МОДУЛЬ «НАРЯДЫ» ============================ */
const mkWorks = (arr) => arr.map((x) => ({ id: uid(), name: x[0], unit: x[1], price: x[2] }));
const orderTotal = (o) => (o.lines || []).reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
const buildIpSummary = (orders) => { const m = {}; orders.forEach((o) => { const k = o.ipName || "— без ИП —"; if (!m[k]) m[k] = { ip: k, count: 0, sum: 0, numbers: [] }; m[k].count++; m[k].sum += orderTotal(o); m[k].numbers.push(o.number); }); return Object.values(m).sort((a, b) => b.sum - a.sum); };
const ORDER_STATUS = { approval: { t: "Согласование", c: "bg-amber-50 text-amber-700 border-amber-200" }, approved: { t: "Согласован", c: "bg-emerald-50 text-emerald-700 border-emerald-200" }, rejected: { t: "Отклонён", c: "bg-rose-50 text-rose-700 border-rose-200" } };
const OrderStatusBadge = ({ s }) => { const x = ORDER_STATUS[s] || ORDER_STATUS.approval; return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${x.c}`}>{x.t}</span>; };

const downloadFile = (name, text, type) => { try { const blob = new Blob([text], { type: (type || "text/plain") + ";charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); } catch (e) {} };
const catToCSV = (cat) => { const esc = (c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`; const rows = [["Наименование", "Ед.изм.", "Стоимость"].map(esc).join(";")]; (cat.items || []).forEach((w) => rows.push([w.name, w.unit, w.price].map(esc).join(";"))); return "\ufeff" + rows.join("\r\n"); };
const parseCSVLine = (line) => { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else { if (ch === '"') q = true; else if (ch === ";" || ch === ",") { out.push(cur); cur = ""; } else cur += ch; } } out.push(cur); return out; };
const parseImport = (text) => {
  const t = (text || "").trim(); if (!t) return null;
  if (t[0] === "{" || t[0] === "[") { try { const j = JSON.parse(t); const arr = Array.isArray(j) ? j : (j.items || []); const items = arr.map((w) => ({ name: w.name, unit: w.unit, price: w.price })); return { name: (!Array.isArray(j) && j.name) ? j.name : "", items }; } catch (e) { return null; } }
  const lines = t.split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return null;
  let start = 0; const first = parseCSVLine(lines[0]).join(" ").toLowerCase();
  if (first.includes("наимен") || first.includes("стоим") || first.includes("price") || first.includes("name")) start = 1;
  const items = []; for (let i = start; i < lines.length; i++) { const c = parseCSVLine(lines[i]); if (!c[0] || !c[0].trim()) continue; const price = String(c[2] || "").replace(/[^0-9.,]/g, "").replace(",", "."); items.push({ name: c[0].trim(), unit: (c[1] || "").trim(), price: price }); }
  return { name: "", items };
};

const WB = [
["Бетонирование стен, колонн, ригелей, лестниц","куб. м",25000,50],["Бетонирование ленточных фундаментов, стаканов, плит перекрытия","куб. м",20000,60],["Бетонирование с армированием основания пола","куб. м",20000,30],["Бетонная подготовка под отдельные фундаменты, фундаментной плиты","куб. м",10000,70],["Врезка дверных замков","шт.",2000,25],["Гидроизоляция обмазочная горячим битумом 1 слой","кв. м",450,20],["Гидроизоляция обмазочная мастикой 1 слой","кв. м",200,20],["Гидроизоляция оклеечная 1 слой","кв. м",600,20],["Засыпка инертных материалов вручную (Щебень +300 тг)","куб. м",1300,null],["Засыпка интерных материалов вручную с послойной трамбовкой (Щебень +300 тг)","куб. м",1600,null],
["Засыпка керамзита с разуклонкой под стяжку кровли","кв. м",600,20],["Кладка перегородок из одинарного кирпича толщиной 120 мм","кв. м",3500,50],["Кладка перегородок из одинарного кирпича толщиной 250 мм","кв. м",5000,60],["Кладка перегородок из полуторного кирпича","кв. м",3000,60],["Кладка перегородок из полуторного кирпича толщиной 250 мм","кв. м",4500,60],["Кладка стен из блоков «Экотон» толщиной 200 мм","кв. м",3500,50],["Кладка стен из блоков «Экотон» толщиной 250 мм","кв. м",4000,50],["Кладка стен из блоков «Экотон» толщиной 300 мм и более","куб. м",13000,50],["Кладка стен из одинарного кирпича толщиной 380 мм и выше","куб. м",15000,50],["Кладка стен из одинарного облицовочного кирпича","кв. м",13000,50],
["Кладка стен из пескоблока толщиной 200 мм","куб. м",4000,50],["Кладка стен из полуторного кирпича толщиной 380 мм и выше","куб. м",15000,50],["Кладка стен из полуторного облицовочного кирпича","кв. м",10000,50],["Кладка стен из СКЦ толщиной 400 мм и более","куб. м",15000,50],["Кладка стен из СКЦ толщиной до 400 мм","кв. м",5000,50],["Монтаж ветровой планки из профнастила с каркасом","пог. м",2000,80],["Монтаж водосточной системы","пог. м",1500,80],["Монтаж временного забора из профнастила","кв. м",900,30],["Монтаж дверных ограничителей","шт.",300,80],["Монтаж двустворчатых дверных блоков с замком и установкой наличника","шт.",12000,30],
["Монтаж декоративной рейки (дейды)","пог. м",800,30],["Монтаж доборных элементов (откосы)","проем",5000,30],["Монтаж доборных элементов на сэндвич-панель","пог. м",500,30],["Монтаж доски с каркасом","кв. м",2500,30],["Монтаж колонн верхних","шт.",15000,30],["Монтаж колонн нижних до 3 м","шт.",10000,30],["Монтаж кровли из металлочерепицы с установкой каркаса","кв. м",4000,50],["Монтаж металлических порожков","пог. м",500,50],["Монтаж металлической двери","шт.",7000,30],["Монтаж металлоконструкций","т",80000,50],
["Монтаж одностворчатых дверных блоков с замком и установкой наличника","блок",8000,30],["Монтаж оконных сливов","пог. м",800,60],["Монтаж отбойников на деформационные швы","пог. м",1000,30],["Монтаж откосов в круговую (один проём) 3×500 мм","шт.",2300,30],["Монтаж парапетных крышек (оцинк., неоцинк.) шириной до 600 мм без каркаса","пог. м",1000,30],["Монтаж парапетных крышек (оцинк., неоцинк.) шириной свыше 600 мм без каркаса","пог. м",1300,30],["Монтаж парапетных крышек шириной до 600 мм с каркасом","пог. м",1700,30],["Монтаж парапетных крышек шириной свыше 600 мм с каркасом","пог. м",2000,30],["Монтаж плит перекрытия и лотков","шт.",4500,50],["Монтаж подоконников","пог. м",800,30],
["Монтаж потолка «Armstrong»","кв. м",1500,20],["Монтаж потолка реечного","кв. м",2500,30],["Монтаж профнастила (кровля, отделка стен)","кв. м",1000,50],["Монтаж профнастила (потолок)","кв. м",1500,50],["Монтаж полов из бруса со шлифовкой","кв.м",10000,30],["Монтаж ригелей, прогонов","шт.",8000,80],["Монтаж стеновых панелей (евровагонка)","кв. м",3000,30],["Монтаж сэндвич-панелей кровельных","кв. м",2100,70],["Монтаж сэндвич-панелей стеновых","кв. м",2500,60],["Монтаж снегозадержателей","пог.",1500,30],
["Монтаж террасной доски","кв.м.",10000,30],["Монтаж ФБС с заделкой замков","шт.",4000,50],["Монтаж чистового забора из профнастила","кв. м",1500,80],["Наплавление Бикроста на кровле в два слоя","кв. м",1200,50],["Наплавление Бикроста на кровле в один слой","кв. м",600,50],["Настил ДСП, фанеры по дереву","кв. м",1000,50],["Настил ДСП, фанеры по дереву на стену с каркасом","кв. м",3000,50],["Настил ДСП, фанеры по стяжке","кв. м",1500,50],["Настил ковролина на клею","кв. м",900,30],["Настил линолеума на клею","кв. м",800,30],
["Облицовка мрамором/ гранитом","кв. м",12000,30],["Облицовка стен плиткой (кафелем)","кв. м",4000,30],["Облицовка фасада металлокассетами с установкой каркаса и утеплением","кв. м",5000,30],["Облицовка цоколя плиткой «Кабанчик»","кв. м",4000,30],["Облицовка чаши бассейна плиткой (кафелем) стены/ пол","кв. м",5500,40],["Обшивка ГКЛ потолков в 1 слой","кв. м",2300,30],["Обшивка ГКЛ потолков в 2 слоя","кв. м",2500,30],["Обшивка ГКЛ стен в 1 слой","кв. м",2200,30],["Обшивка ГКЛ стен в 2 слоя","кв. м",2400,30],["Побелка стен и потолков","кв. м",300,30],
["Подготовка и грунтовка пола под покрытие","кв. м",300,30],["Покраска металлоконструкций (на подвесной платформе) в 1 слой","кв. м",600,30],["Покраска металлоконструкций (на подвесной платформе) в 2 слоя","кв. м",700,30],["Покраска металлоконструкций в 1 слой","кв. м",500,30],["Покраска металлоконструкций в 2 слоя","кв. м",600,30],["Покраска стен, полов и потолков с ремонтом","кв. м",500,30],["Приготовление бетона вручную","куб. м",8000,30],["Укладка брусчатки","кв. м",2500,30],["Укладка дорожного бордюра","пог. м",2000,50],["Укладка тротуарного поребрика","пог. м",1400,30],
["Укладка пластикового плинтуса","пог. м",250,10],["Укладка керамогранитного плинтуса","пог. м",500,30],["Укладка деревянного плинтуса (евро)","пог. м",800,20],["Укладка гранитного плинтуса","пог. м",1500,30],["Укладка кладочной сетки под стяжку","кв. м",100,30],["Укладка ламинатной доски","кв. м",2000,30],["Укладка минераловатных плит на основание под стяжку","кв. м",200,80],["Укладка напольной плитки","кв. м",4000,30],["Укладка паркетной доски","кв. м",3000,30],["Укладка пеноплекса (XPS) на основание под стяжку","кв. м",250,30],
["Установка вентиляционных решёток/анемостата","шт.",500,80],["Установка декоративного карниза высотой от 50 мм","пог. м",500,30],["Устройство бетонных полов (финишных под вертолет)","кв. м",2500,30],["Устройство витражных, дверных, оконных откосов из ГКЛ","пог. м",700,30],["Устройство деформационных швов на фасаде (металлических)","пог. м",500,30],["Устройство коробов из ГКЛ шириной более 300 мм","кв. м",2000,30],["Устройство коробов из ГКЛ шириной менее 300 мм","пог. м",2000,30],["Устройство наливного пола","кв. м",700,50],["Устройство пароизоляции с проклейкой швов","кв. м",180,80],["Устройство цементно-песчаной стяжки без шлифовки","кв. м",1200,80],
["Устройство цементно-песчаной стяжки с шлифовкой","кв. м",1500,80],["Утепление стен минераловатными плитами","кв. м",800,50],["Шпатлевка стен/потолков по ГКЛ/штукатурке","кв. м",2000,30],["Шпатлевка черновая клеем по фасадной сетке по пенопласту (под гидроизоляцию)","кв. м",700,30],["Шпатлевка черновая клеем по фасадной сетке по пенопласту (под отделку)","кв. м",1000,30],["Штукатурка стен","кв. м",1500,30],["Штукатурка стен по сетке с монтажом","кв. м",1800,50],["Штукатурка стен под маяк","кв. м",2500,50],
];

const WE = [
["Вязка проводов на промежуточных опорах","шт.",400,null],["Гидроизоляция опор","кв. м",200,null],["Доработка траншеи","пог. м",200,null],["Затяжка кабеля в гильзу Ø 100 мм сечением жил до 120 мм²","пог. м",350,30],["Затяжка кабеля в гильзу Ø 100 мм сечением жил до 35 мм²","пог. м",300,25],["Затяжка кабеля в гильзу Ø 100 мм сечением жил до 70 мм²","пог. м",320,30],["Изготовление и монтаж греющих электродов","пог. м",200,40],["Концевая заделка кабеля с бумажной изоляцией до 120 мм²","шт.",400,30],["Концевая заделка кабеля с бумажной изоляцией до 240 мм²","шт.",600,30],["Концевая заделка кабеля с бумажной изоляцией до 50 мм²","шт.",250,20],
["Концевая заделка кабеля с ПВХ изоляцией до 10 мм²","шт.",50,20],["Концевая заделка кабеля с ПВХ изоляцией до 120 мм²","шт.",220,30],["Концевая заделка кабеля с ПВХ изоляцией до 150 мм²","шт.",250,30],["Концевая заделка кабеля с ПВХ изоляцией до 240 мм²","шт.",280,35],["Концевая заделка кабеля с ПВХ изоляцией до 35 мм²","шт.",90,20],["Концевая заделка кабеля с ПВХ изоляцией до 4 мм²","шт.",30,10],["Концевая заделка кабеля с ПВХ изоляцией до 70 мм²","шт.",100,20],["Монтаж блоков ФБС","шт.",2000,null],["Монтаж ВРУ и ШР с подключением и расключением","шт.",25000,40],["Монтаж гофротрубы до Ø 32 мм","пог. м",300,25],
["Монтаж гофротрубы от Ø 32 мм","пог. м",350,30],["Монтаж греющих проводов","пог. м",50,30],["Монтаж и подключение Т.Т до 10 кВ /5","шт.",12000,40],["Монтаж и подключение Т.Т до 1000/5 и выше","шт.",5000,40],["Монтаж и подключение Т.Т до 150/5","шт.",2000,40],["Монтаж и подключение Т.Т до 400/5","шт.",2200,40],["Монтаж и подключение трёхфазного ПУ ЕвроАльфа","шт.",30000,40],["Монтаж и подключение трёхфазного ПУ прямого включения","шт.",6500,40],["Монтаж и подключение трёхфазного ПУ через трансформаторы тока","шт.",14000,40],["Монтаж изоляторов типа ПС-70","шт.",900,30],
["Монтаж изоляторов типа ШС-20","шт.",180,20],["Монтаж интернет-кабеля","пог. м",300,30],["Монтаж кабельных каналов","пог. м",350,30],["Монтаж кабельных лотков","пог. м",800,30],["Монтаж кабельных полок, стоек, подвесов","шт.",600,30],["Монтаж кабеля до 150 мм²","пог. м",600,30],["Монтаж кабеля до 240 мм²","пог. м",800,30],["Монтаж кабеля до 25 мм² с штробой","пог. м",800,30],["Монтаж кабеля до 70 мм²","пог. м",300,30],["Монтаж КИПиА","шт.",15000,40],
["Монтаж контура заземления и молниеотводов","пог. м",300,25],["Монтаж концевых муфт 3КНТп10 150–240","шт.",18000,30],["Монтаж концевых муфт 3КНТп10 25–50","шт.",12000,30],["Монтаж концевых муфт 3КНТп10 70–120","шт.",15000,30],["Монтаж концевых муфт 4КНТп1 150–240","шт.",14000,30],["Монтаж концевых муфт 4КНТп1 25–50","шт.",10000,30],["Монтаж концевых муфт 4КНТп1 70–120","шт.",12000,30],["Монтаж КТП на блоки с расключением","шт.",45000,40],["Монтаж КТПНГ на блоки с расключением","шт.",45000,40],["Монтаж мачтовых рубильников","шт.",4200,40],
["Монтаж перфорированного короба 100–200 мм","шт.",1200,30],["Монтаж перфорированного короба 300–400 мм","шт.",1500,30],["Монтаж провода АППВ, ПВС, ПУНГП","пог. м",150,30],["Монтаж проходных изоляторов","шт.",1900,40],["Монтаж разрядников РВО","шт.",1500,30],["Монтаж рубильников до 630 А","шт.",6300,40],["Монтаж светильников 4–10 ламп на потолок и стены","шт.",5000,30],["Монтаж светильников до 3 ламп на потолок и стены","шт.",3000,30],["Монтаж светильников до 3 ламп на прочие конструкции","шт.",3400,30],["Монтаж соединительной муфты 3СТп10 150–240","шт.",30000,30],
["Монтаж соединительной муфты 3СТп10 25–50","шт.",20000,30],["Монтаж соединительной муфты 3СТп10 70–120","шт.",25000,30],["Монтаж соединительной муфты 4СТп1 150–240","шт.",18000,30],["Монтаж соединительной муфты 4СТп1 25–50","шт.",15000,30],["Монтаж соединительной муфты 4СТп1 70–120","шт.",15000,30],["Монтаж стальных труб Ø 100 мм","пог. м",450,30],["Монтаж стальных труб Ø 15–25 мм","пог. м",370,30],["Монтаж стальных труб Ø 50 мм","пог. м",400,30],["Монтаж стоек 1200 мм","шт.",1000,30],["Монтаж стоек 600 мм","шт.",600,30],
["Монтаж телефонного кабеля","пог. м",300,30],["Монтаж тепловых завес","шт.",2000,40],["Монтаж траверс","шт.",1000,30],["Монтаж тросовой подвески","пог. м",600,30],["Монтаж фасадных держателей","шт.",20,30],["Монтаж ЩО и ЩР с расключением","шт.",10000,30],["Монтаж электродов контура заземления","шт.",2500,40],["Монтаж ячеек КСО, КРУН","шт.",120000,50],["Обратная засыпка траншеи","пог. м",450,null],["Подвеска и натяжка провода АС","пог. м",150,40],
["Подвеска и натяжка провода СИП 10–25 мм²","пог. м",180,40],["Подвеска и натяжка провода СИП 35–70 мм²","пог. м",200,40],["Подключение вентиляторов и систем кондиционирования","шт.",3000,40],["Подключение к проводу СИП","шт.",400,40],["Покрытие кабеля кирпичом","пог. м",150,null],["Разгрузка опор","шт.",500,null],["Раскатка провода АС","пог. м",100,40],["Раскатка провода СИП 10–25 мм²","пог. м",150,40],["Раскатка провода СИП 35–70 мм²","пог. м",180,40],["Расключение щитов 12 групп","шт.",6500,20],
["Расключение щитов 24 групп","шт.",7500,20],["Расключение щитов 36 групп","шт.",8000,30],["Расключение щитов 72 групп","шт.",14400,30],["Распайка распредкоробок","шт.",800,20],["Рытьё траншеи вручную","пог. м",1000,null],["Сборка щитов ЩО и ЩР ниже 36 группы","шт.",7500,30],["Сборка щитов ЩО и ЩР свыше 36 группы","шт.",15000,30],["Сверление под розетки, выключатели и распредкоробки","шт.",150,null],["Укладка сигнальной ленты","пог. м",90,null],["Установка одностоечной опоры","шт.",5000,40],
["Установка опоры с двумя укосинами","шт.",14000,40],["Установка опоры с одной укосиной","шт.",10000,40],["Установка подрозетников и распредкоробок","шт.",100,10],["Установка пускателей 0 и 1 величины","шт.",2000,30],["Установка пускателей 2 и 3 величины","шт.",3000,30],["Установка пускателей 4, 5 и 6 величины","шт.",5000,30],["Установка розеток и выключателей","шт.",500,30],["Установка рукосушилок","шт.",2000,30],["Установка трансформатора от 25 до 160 кВА с расключением","шт.",50000,40],["Установка трансформатора с расключением","шт.",48000,40],
["Установка ЯТП","шт.",1500,40],["Устройство ниш под эл. щит 340×160 в кирпичной стене","шт.",2000,null],["Устройство ниш под эл. щит 340×160 в пенобетоне","шт.",1500,null],["Устройство ниш под эл. щит 400×400 в кирпичной стене","шт.",3000,null],["Устройство ниш под эл. щит 400×400 в пенобетоне","шт.",2500,null],["Устройство песчаной подушки","пог. м",400,null],
];

function OrderStageTrack({ order }) {
  if (!order.chain || order.chain.length === 0) return <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Без согласования — наряд утверждён сразу.</div>;
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {order.chain.map((st, i) => {
        const passed = i < order.currentStageIndex && order.status !== "rejected";
        const rejectedHere = order.status === "rejected" && i === order.currentStageIndex;
        const current = order.status === "approval" && i === order.currentStageIndex;
        const cls = rejectedHere ? "border-rose-300 bg-rose-50 text-rose-700" : passed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : current ? "border-amber-300 bg-amber-50 text-amber-700" : "border-stone-200 bg-white text-stone-400";
        return (
          <React.Fragment key={st.approverId + "_" + i}>
            {i > 0 && <div className={`h-0.5 w-4 shrink-0 ${passed || rejectedHere ? "bg-emerald-300" : "bg-stone-200"}`} />}
            <div className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${cls}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${passed ? "bg-emerald-500 text-white" : rejectedHere ? "bg-rose-500 text-white" : current ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-500"}`}>{passed ? <Check className="h-3 w-3" /> : rejectedHere ? <X className="h-3 w-3" /> : i + 1}</span>
              <div className="text-xs"><div className="font-medium leading-tight">{st.label || st.approverName}</div><div className="leading-tight opacity-70">{st.approverName}</div></div>
            </div>
          </React.Fragment>
        );
      })}
      <div className={`ml-1 flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${order.status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-400"}`}><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">Утверждён</span></div>
    </div>
  );
}

function ImportWorksButton({ onImport }) {
  const ref = useRef(null);
  const handle = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { const r = parseImport(String(fr.result || "")); if (r && r.items && r.items.length) onImport(r.name || f.name.replace(/\.[^.]+$/, ""), r.items); else appConfirm("Не удалось распознать файл. Поддерживаются JSON (из экспорта) и CSV: Наименование;Ед.изм.;Стоимость", { okText: "Понятно" }); e.target.value = ""; }; fr.readAsText(f, "utf-8"); };
  return (<><input ref={ref} type="file" accept=".json,.csv,.txt" onChange={handle} className="hidden" /><button onClick={() => ref.current && ref.current.click()} className={btnGhost}><Upload className="h-4 w-4" /> Импорт</button></>);
}


function WorkCatalogsAdmin({ data, api }) {
  const [open, setOpen] = useState("");
  const [q, setQ] = useState("");
  const cats = data.workCatalogs || [];
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-stone-900">Списки работ</h2><div className="flex items-center gap-2"><ImportWorksButton onImport={(name, items) => api.importWorkList(name || "Импортированный список", items)} /><button onClick={api.addWorkList} className={btnPrimary}><Plus className="h-4 w-4" /> Список</button></div></div>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Из этих списков формируются наряды. Можно держать несколько списков, править расценки, выгружать и загружать (JSON или CSV: Наименование;Ед.изм.;Стоимость).</p>
      <div className="space-y-3">{cats.length === 0 ? <p className="rounded-lg border border-dashed border-stone-300 bg-white py-8 text-center text-sm text-stone-400">Списков нет. Добавьте или импортируйте.</p> : cats.map((c) => {
        const isOpen = open === c.id;
        const items = isOpen && q.trim() ? c.items.filter((w) => w.name.toLowerCase().includes(q.toLowerCase())) : c.items;
        return (
          <div key={c.id} className={`p-3 ${card}`}>
            <div className="flex flex-wrap items-center gap-2">
              <HardHat className="h-4 w-4 shrink-0 text-stone-400" />
              <input className={`${inputCls} min-w-0 flex-1`} value={c.name} onChange={(e) => api.renameWorkList(c.id, e.target.value)} />
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{c.items.length} поз.</span>
              <button onClick={() => downloadFile(c.name + ".json", JSON.stringify({ name: c.name, items: c.items.map((w) => ({ name: w.name, unit: w.unit, price: w.price })) }, null, 2), "application/json")} title="Экспорт JSON" className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Download className="h-4 w-4" /></button>
              <button onClick={() => downloadFile(c.name + ".csv", catToCSV(c), "text/csv")} title="Экспорт CSV" className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><FileText className="h-4 w-4" /></button>
              <button onClick={() => { setOpen(isOpen ? "" : c.id); setQ(""); }} className={`shrink-0 ${btnGhost}`}>{isOpen ? "Свернуть" : "Изменить"}</button>
              <button onClick={() => { appConfirm(`Удалить список «${c.name}»?`, { danger: true }).then((ok) => { if (ok) api.deleteWorkList(c.id); }); }} title="Удалить список" className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            {isOpen && <div className="mt-3 border-t border-stone-100 pt-3">
              <div className="mb-2 flex flex-wrap items-center gap-2"><button onClick={() => api.addWorkItem(c.id)} className={btnGhost}><Plus className="h-4 w-4" /> Строка</button><div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5"><Search className="h-4 w-4 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск в списке…" className="w-full bg-transparent text-sm focus:outline-none" /></div></div>
              <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">{items.length === 0 ? <p className="py-4 text-center text-sm text-stone-400">Ничего не найдено.</p> : items.map((w) => <div key={w.id} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-stone-50 p-1.5"><input className={`${inputCls} min-w-0 flex-1`} value={w.name} onChange={(e) => api.updateWorkItem(c.id, w.id, { name: e.target.value })} placeholder="Наименование" /><input className={`${inputCls} w-20`} value={w.unit} onChange={(e) => api.updateWorkItem(c.id, w.id, { unit: e.target.value })} placeholder="ед." /><input type="number" className={`${inputCls} w-28`} value={w.price} onChange={(e) => api.updateWorkItem(c.id, w.id, { price: Number(e.target.value) || 0 })} placeholder="цена" /><button onClick={() => appConfirm("Удалить работу «" + (w.name || "—") + "» из списка расценок?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteWorkItem(c.id, w.id); })} className="shrink-0 rounded p-1.5 text-stone-400 hover:bg-stone-200 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
            </div>}
          </div>
        );
      })}</div>
    </div>
  );
}

function OrderChainsAdmin({ data, api }) {
  const dept = data.departments.find((d) => /строит/i.test(d.name)) || data.departments[0] || null;
  const approvers = data.users.filter((u) => u.role === "approver" || u.role === "admin");
  const chain = dept ? (data.orderChains[dept.id] || []) : [];
  const set = (next) => { if (dept) api.setOrderChain(dept.id, next); };
  const addStep = () => set([...chain, { id: uid(), approverId: approvers[0] ? approvers[0].id : "", label: "Согласование" }]);
  const updStep = (id, patch) => set(chain.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  const delStep = (id) => set(chain.filter((st) => st.id !== id));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= chain.length) return; const a = [...chain]; const t = a[i]; a[i] = a[j]; a[j] = t; set(a); };
  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-900">Маршрут согласования нарядов</h2>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Единый маршрут для всех строительных нарядов. Наряд проходит этапы по порядку, затем считается утверждённым.</p>
      <div className={`p-4 ${card}`}>
        <div className="space-y-2">{chain.length === 0 ? <p className="text-sm text-stone-400">Маршрут пуст — наряды утверждаются сразу после подачи.</p> : chain.map((st, i) => <div key={st.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">{i + 1}</span><input className={`${inputCls} w-40`} value={st.label} onChange={(e) => updStep(st.id, { label: e.target.value })} placeholder="Этап" /><select className={`${inputCls} min-w-0 flex-1`} value={st.approverId} onChange={(e) => updStep(st.id, { approverId: e.target.value })}>{approvers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="flex shrink-0 items-center gap-0.5"><button onClick={() => move(i, -1)} className="rounded p-1 text-stone-400 hover:bg-stone-200"><ChevronUp className="h-4 w-4" /></button><button onClick={() => move(i, 1)} className="rounded p-1 text-stone-400 hover:bg-stone-200"><ChevronDown className="h-4 w-4" /></button><button onClick={() => delStep(st.id)} className="rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
        <button onClick={addStep} className={`mt-3 ${btnGhost}`}><Plus className="h-4 w-4" /> Добавить этап</button>
      </div>
    </div>
  );
}

/* ============================ v9: МЕСЯЦЫ / МОДУЛИ / НОВЫЕ ЭКРАНЫ ============================ */
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const periodLabel = (key) => { if (!key) return "—"; const a = String(key).split("-"); const mi = Number(a[1]) - 1; return (MONTHS[mi] || a[1]) + " " + a[0]; };
const recentMonths = (back, fwd) => { const out = []; const n = new Date(); for (let i = -fwd; i <= back; i++) { out.push(monthKeyOf(new Date(n.getFullYear(), n.getMonth() - i, 1))); } return out; };
const MODULES = {
  supply: { title: "Снабжение", sub: "Заявки и закупки по отделам.", icon: Boxes, accent: "amber" },
  orders: { title: "Наряды", sub: "Наряды на работы. Отдельный модуль, не связан со снабжением.", icon: ScrollText, accent: "sky" },
  personal: { title: "Блокнот", sub: "Личные записи — их видите только вы.", icon: NotebookPen, accent: "violet" },
};

function NewOrder({ data, me, onCancel, onCreate }) {
  const cats = data.workCatalogs || [];
  const cat = cats.find((c) => c.kind === "stroy") || cats[0] || null;
  const stroyDept = data.departments.find((d) => /строит/i.test(d.name)) || data.departments[0] || null;
  const knownIps = (data.ips || []);
  const months = recentMonths(18, 18).sort().reverse();
  const [period, setPeriod] = useState(monthKeyOf(new Date()));
  const [ipName, setIpName] = useState("");
  const [objectId, setObjectId] = useState("");
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const myObjects = me.role === "admin" ? data.objects : data.objects.filter((o) => (o.userIds || []).includes(me.id));
  const chainPreview = stroyDept ? (data.orderChains[stroyDept.id] || []).filter((st) => st.approverId) : [];
  const qtyOf = (w) => { const l = lines.find((x) => x.workId === w.id); return l ? l.qty : 0; };
  const inc = (w) => setLines((a) => { const ex = a.find((l) => l.workId === w.id); if (ex) return a.map((l) => (l.workId === w.id ? { ...l, qty: (Number(l.qty) || 0) + 1 } : l)); return [...a, { id: uid(), workId: w.id, name: w.name, unit: w.unit, price: w.price, qty: 1 }]; });
  const dec = (w) => setLines((a) => { const ex = a.find((l) => l.workId === w.id); if (!ex) return a; const v = (Number(ex.qty) || 0) - 1; if (v <= 0) return a.filter((l) => l.workId !== w.id); return a.map((l) => (l.workId === w.id ? { ...l, qty: v } : l)); });
  const setQtyFor = (w, val) => setLines((a) => { const ex = a.find((l) => l.workId === w.id); if (!ex) { if (Number(val) > 0) return [...a, { id: uid(), workId: w.id, name: w.name, unit: w.unit, price: w.price, qty: val }]; return a; } return a.map((l) => (l.workId === w.id ? { ...l, qty: val } : l)); });
  const removeLine = (id) => setLines((a) => a.filter((l) => l.id !== id));
  const total = lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
  const filtered = cat ? cat.items.filter((w) => !q.trim() || w.name.toLowerCase().includes(q.toLowerCase())) : [];
  const submit = () => {
    if (!stroyDept) return setErr("Не настроен строительный отдел.");
    if (!period) return setErr("Укажите месяц наряда.");
    if (!ipName.trim()) return setErr("Укажите ИП — выберите из списка или введите новое.");
    const clean = lines.filter((l) => Number(l.qty) > 0);
    if (clean.length === 0) return setErr("Добавьте хотя бы одну работу с количеством.");
    const obj = data.objects.find((o) => o.id === objectId);
    const ipEx = knownIps.find((x) => x.name.trim().toLowerCase() === ipName.trim().toLowerCase());
    setErr("");
    onCreate({ departmentId: stroyDept.id, period, periodLabel: periodLabel(period), ipId: ipEx ? ipEx.id : "", ipName: ipName.trim(), objectId, objectName: obj ? obj.name : "", objectColor: obj ? obj.color : "", catalogId: cat ? cat.id : "", catalogName: cat ? cat.name : "", note: note.trim(), lines: clean });
  };
  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={onCancel} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="h-4 w-4" /> К нарядам</button>
      <h1 className="mb-1 text-xl font-semibold leading-tight tracking-tight text-stone-900">Новый наряд</h1>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Строительный наряд — работы из расценок, сумма считается автоматически.</p>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div>Работаем только с ИП на <span className="font-semibold">общеустановленном режиме</span> (плательщики НДС). На ИП по упрощёнке закрыть наряд нельзя.</div></div>
      <div className={`p-4 ${card}`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={labelCls}>За какой месяц</label><select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>{months.map((m) => <option key={m} value={m}>{periodLabel(m)}</option>)}</select></div>
          <div><label className={labelCls}>На какое ИП закрыть</label><input list="ip-suggest" className={inputCls} value={ipName} onChange={(e) => setIpName(e.target.value)} placeholder="Начните вводить или выберите" /><datalist id="ip-suggest">{knownIps.map((x) => <option key={x.id} value={x.name} />)}</datalist><p className="mt-1 text-xs text-stone-400">Новое ИП сохранится и появится в подсказках в следующий раз.</p></div>
          <div><label className={labelCls}>Объект</label><select className={inputCls} value={objectId} onChange={(e) => setObjectId(e.target.value)}><option value="">— не указан —</option>{myObjects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        </div>
        {chainPreview.length > 0 && <p className="mt-2 text-xs text-stone-400">Маршрут: {chainPreview.map((st) => st.label).join(" → ")} → утверждён</p>}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={`flex flex-col p-3 ${card}`}>
          <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5"><Search className="h-4 w-4 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск работы…" className="w-full bg-transparent text-sm focus:outline-none" /></div>
          <div className="max-h-96 space-y-1 overflow-y-auto pr-1">{filtered.length === 0 ? <p className="py-6 text-center text-sm text-stone-400">{cat ? "Ничего не найдено." : "Список работ не настроен."}</p> : filtered.slice(0, 300).map((w) => { const qv = qtyOf(w); const on = Number(qv) > 0; return (
            <div key={w.id} className={`flex items-center gap-2 rounded-lg border p-2 transition ${on ? "border-sky-300 bg-sky-50" : "border-stone-200 bg-white"}`}>
              <span className="min-w-0 flex-1"><span className="block text-sm text-stone-800">{w.name}</span><span className="text-xs text-stone-400">{w.unit} · {fmtMoney(w.price)}{on ? <span className="ml-1 font-medium text-sky-600">· в наряде</span> : ""}</span></span>
              {on ? <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700"><Check className="h-3.5 w-3.5" /> В наряде</span> : <button onClick={() => inc(w)} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-stone-700"><Plus className="h-3.5 w-3.5" /> Добавить</button>}
            </div>
          ); })}</div>
        </div>
        <div className={`flex flex-col p-3 ${card}`}>
          <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-stone-700">В наряде</span><span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">{lines.length} поз.</span></div>
          {lines.length === 0 ? <p className="flex-1 py-6 text-center text-sm text-stone-400">Добавляйте работы слева — выбранные подсветятся.</p> : <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">{lines.map((l) => <div key={l.id} className="rounded-lg bg-stone-50 p-2"><div className="flex items-start gap-2"><span className="min-w-0 flex-1 text-sm leading-snug text-stone-800">{l.name}</span><button onClick={() => removeLine(l.id)} className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div><div className="mt-1.5 flex items-center gap-2"><input type="number" min="0" value={l.qty} onChange={(e) => setLines((a) => a.map((x) => (x.id === l.id ? { ...x, qty: e.target.value } : x)))} className="w-20 shrink-0 rounded-md border border-stone-300 bg-white px-1 py-1 text-center text-sm" title="Количество" /><span className="min-w-0 flex-1 truncate text-xs text-stone-400">{l.unit} × {fmtMoney(l.price)}</span><span className="shrink-0 font-mono text-sm font-semibold text-stone-800">{fmtMoney((Number(l.price) || 0) * (Number(l.qty) || 0))}</span></div></div>)}</div>}
          <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-2"><span className="text-sm font-medium text-stone-600">Итого</span><span className="font-mono text-lg font-bold text-stone-900">{fmtMoney(total)}</span></div>
        </div>
      </div>
      <div className={`mt-4 p-4 ${card}`}>
        <label className={labelCls}>Примечание</label>
        <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Участок, объём, сроки…" />
        {err && <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> {err}</div>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"><button onClick={onCancel} className={`${btnGhost} w-full sm:w-auto`}>Отмена</button><button onClick={submit} className={`${btnPrimary} w-full sm:w-auto`}><Send className="h-4 w-4" /> Подать наряд</button></div>
      </div>
    </div>
  );
}

function OrdersSummaryPrint({ period, data, onBack }) {
  const orders = (data.orders || []).filter((o) => o.period === period && o.status !== "rejected");
  const rows = buildIpSummary(orders);
  const sum = rows.reduce((sm, x) => sm + x.sum, 0);
  return (
    <PrintShell title={`Свод по ИП · ${periodLabel(period)}`} onBack={onBack}>
      <div className="text-stone-900">
        <div className="flex items-start justify-between border-b-2 border-stone-900 pb-3"><div><div className="text-lg font-bold">СВОД ПО НАРЯДАМ — {periodLabel(period).toUpperCase()}</div><div className="mt-1 text-sm">Нарядов: {orders.length} (отклонённые не учитываются)</div></div><div className="text-right text-xs text-stone-500">сформировано {fmtDate(new Date().toISOString())}</div></div>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead><tr className="border-y-2 border-stone-900 text-left"><th className="py-1.5">ИП</th><th className="py-1.5 text-right">Нарядов</th><th className="py-1.5 pl-3 text-right">Сумма работ</th></tr></thead>
          <tbody>{rows.length ? rows.map((x) => <tr key={x.ip} className="border-b border-stone-300"><td className="py-1.5">{x.ip}<div className="font-mono text-xs text-stone-500">{x.numbers.join(", ")}</div></td><td className="py-1.5 text-right font-mono">{x.count}</td><td className="py-1.5 pl-3 text-right font-mono">{fmtMoney(x.sum)}</td></tr>) : <tr><td colSpan={3} className="py-3 text-center text-stone-400">Нарядов за месяц нет.</td></tr>}</tbody>
          <tfoot><tr className="border-t-2 border-stone-900 font-semibold"><td className="py-2">Итого</td><td className="py-2 text-right font-mono">{orders.length}</td><td className="py-2 pl-3 text-right font-mono">{fmtMoney(sum)}</td></tr></tfoot>
        </table>
        <div className="mt-10 grid grid-cols-2 gap-8 text-xs"><div className="border-t border-stone-400 pt-1 text-center text-stone-400">составил · подпись / дата</div><div className="border-t border-stone-400 pt-1 text-center text-stone-400">директор · подпись / дата</div></div>
      </div>
    </PrintShell>
  );
}

function OrderRows({ list, onOpen }) {
  const [sortK, setSortK] = useState("created"), [dir, setDir] = useState(-1);
  const cols = [
    { k: "number", t: "№", cmp: (a, b) => a.number.localeCompare(b.number, "ru") },
    { k: "ip", t: "ИП", cmp: (a, b) => (a.ipName || "").localeCompare(b.ipName || "", "ru") },
    { k: "object", t: "Объект", cmp: (a, b) => (a.objectName || "").localeCompare(b.objectName || "", "ru") },
    { k: "lines", t: "Позиций", cmp: (a, b) => a.lines.length - b.lines.length },
    { k: "sum", t: "Сумма", cmp: (a, b) => orderTotal(a) - orderTotal(b) },
    { k: "created", t: "Создан", cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
    { k: "status", t: "Статус", cmp: (a, b) => ((ORDER_STATUS[a.status] || {}).t || "").localeCompare((ORDER_STATUS[b.status] || {}).t || "", "ru") },
  ];
  const col = cols.find((c) => c.k === sortK) || cols[6];
  const rows = [...list].sort((a, b) => dir * col.cmp(a, b));
  const click = (k) => { if (k === sortK) setDir((d) => -d); else { setSortK(k); setDir(1); } };
  const rAlign = ["lines", "sum"];
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-sm" style={{ minWidth: 760 }}>
        <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">{cols.map((c) => <th key={c.k} className={`px-3 py-2 font-semibold uppercase tracking-wide ${rAlign.includes(c.k) ? "text-right" : ""}`}><button onClick={() => click(c.k)} className={`inline-flex items-center gap-0.5 hover:text-stone-900 ${sortK === c.k ? "text-stone-900" : ""}`}>{c.t}{sortK === c.k && (dir === 1 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}</button></th>)}</tr></thead>
        <tbody>{rows.map((o) => <tr key={o.id} onClick={() => onOpen(o.id)} className="cursor-pointer border-b border-stone-100 transition hover:bg-stone-50"><td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-stone-900">{o.number}</td><td className="px-3 py-2 text-stone-800"><span className="block truncate" style={{ maxWidth: 220 }}>{o.ipName || "—"}</span></td><td className="px-3 py-2 text-xs text-stone-500"><span className="inline-flex items-center gap-1">{o.objectName && <span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-${o.objectColor || "stone"}-400`} />}{o.objectName || "—"}</span></td><td className="px-3 py-2 text-right font-mono text-xs text-stone-500">{o.lines.length}</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(orderTotal(o))}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-stone-500">{fmtDate(o.createdAt)}</td><td className="px-3 py-2"><OrderStatusBadge s={o.status} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function OrdersHub({ data, me, onOpen, onNew, onSummary }) {
  const isDesktop = useIsDesktop();
  const all = data.orders || [];
  const canCreate = me.orders || me.role === "admin";
  const pending = all.filter((o) => o.status === "approval" && o.chain[o.currentStageIndex] && o.chain[o.currentStageIndex].approverId === me.id);
  const mine = me.role === "admin" ? all : all.filter((o) => o.requesterId === me.id || o.chain.some((st) => st.approverId === me.id));
  const groupsMap = {};
  [...mine].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((o) => { const k = o.period || "—"; (groupsMap[k] = groupsMap[k] || []).push(o); });
  const periods = Object.keys(groupsMap).sort().reverse();
  const oc = (o) => (
    <button key={o.id} onClick={() => onOpen(o.id)} className="flex w-full flex-col gap-1 overflow-hidden rounded-lg border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:border-sky-300">
      <div className="flex items-center gap-2"><span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{o.number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{o.ipName || "—"}</span><span className="shrink-0"><OrderStatusBadge s={o.status} /></span></div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">{o.objectName && <span className="inline-flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full bg-${o.objectColor || "stone"}-400`} />{o.objectName}</span>}<span className="inline-flex items-center gap-1 font-mono"><Calendar className="h-3 w-3" />{fmtDate(o.createdAt)}</span><span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{o.lines.length} поз.</span><span className="ml-auto font-mono font-semibold text-stone-700">{fmtMoney(orderTotal(o))}</span></div>
    </button>
  );
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2"><div />{canCreate && <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"><Plus className="h-4 w-4" /> Новый наряд</button>}</div>
      {pending.length > 0 && <div className="mb-5"><div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700"><Clock className="h-4 w-4" /> Ждут вашего согласования · {pending.length}</div>{isDesktop ? <OrderRows list={pending} onOpen={onOpen} /> : <div className="grid gap-2 sm:grid-cols-2">{pending.map(oc)}</div>}</div>}
      {periods.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center"><HardHat className="mx-auto h-7 w-7 text-stone-300" /><p className="mt-2 text-sm text-stone-500">Нарядов пока нет.</p>{canCreate && <button onClick={onNew} className={`mt-3 ${btnGhost}`}><Plus className="h-4 w-4" /> Создать наряд</button>}</div> : periods.map((pk) => <div key={pk} className="mb-5"><div className="mb-2 flex flex-wrap items-center gap-2"><Calendar className="h-4 w-4 text-sky-600" /><span className="text-sm font-semibold text-stone-800">{pk === "—" ? "Без месяца" : periodLabel(pk)}</span><span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{groupsMap[pk].length}</span><span className="ml-auto font-mono text-xs text-stone-500">{fmtMoney(groupsMap[pk].reduce((s, o) => s + orderTotal(o), 0))}</span><button onClick={() => onSummary(pk)} className="rounded-md border border-stone-200 bg-white p-1 text-stone-400 hover:text-stone-700" title="Свод по ИП за месяц (печать)"><Printer className="h-3.5 w-3.5" /></button><button onClick={() => downloadFile(`naryady-${pk}.csv`, toCSV([["№", "ИП", "Объект", "Статус", "Позиций", "Сумма", "Создан"], ...groupsMap[pk].map((o) => [o.number, o.ipName, o.objectName, (ORDER_STATUS[o.status] || {}).t, o.lines.length, Math.round(orderTotal(o)), fmtDate(o.createdAt)])]), "text/csv")} className="rounded-md border border-stone-200 bg-white p-1 text-stone-400 hover:text-stone-700" title="Выгрузить наряды месяца в CSV"><FileDown className="h-3.5 w-3.5" /></button></div>{(() => { const byObj = {}; groupsMap[pk].forEach((o) => { const ok2 = o.objectName || "яя-без-объекта"; (byObj[ok2] = byObj[ok2] || []).push(o); }); const objKeys = Object.keys(byObj).sort((a, b) => a.localeCompare(b, "ru")); return objKeys.map((ok2) => { const grp = byObj[ok2]; const first = grp[0]; const label = first.objectName || "Без объекта"; return <div key={ok2} className="mb-3"><div className="mb-1.5 flex items-center gap-1.5 pl-0.5 text-xs font-semibold text-stone-500"><span className={`inline-block h-2 w-2 rounded-full bg-${first.objectColor || "stone"}-400`} />{label}<span className="font-normal text-stone-400">· {grp.length}</span><span className="ml-auto font-mono font-normal text-stone-400">{fmtMoney(grp.reduce((s2, o) => s2 + orderTotal(o), 0))}</span></div>{isDesktop ? <OrderRows list={grp} onOpen={onOpen} /> : <div className="grid gap-2 sm:grid-cols-2">{grp.map(oc)}</div>}</div>; }); })()}</div>)}
    </div>
  );
}

function OrderDetail({ order, me, data, api, onBack, onPrint }) {
  const isDesktop = useIsDesktop();
  const [oLightbox, setOLightbox] = useState(null);
  const [oShowHist, setOShowHist] = useState(false);
  const oFileRef = useRef(null);
  const oAtts = order.attachments || [];
  const oCanEdit = order.status !== "done" && (order.status !== "rejected" || order.requesterId === me.id || me.role === "admin");
  const [comment, setComment] = useState("");
  const isCurrent = order.status === "approval" && order.chain[order.currentStageIndex] && order.chain[order.currentStageIndex].approverId === me.id;
  const isOrderOwner = order.requesterId === me.id;
  const canFixRejected = order.status === "rejected" && (isOrderOwner || me.role === "admin");
  const canEditLines = isCurrent || me.role === "admin" || canFixRejected;
  const canEditPrice = canEditLines && (!!me.canPrice || me.role === "admin");
  const [editLines, setEditLines] = useState(false);
  const askRemoveLine = (l) => appConfirm("Удалить позицию «" + l.name + "» из наряда?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.removeOrderLine(order.id, l.id); });
  const total = orderTotal(order);
  return (
    <div className="mx-auto max-w-4xl">
      {oShowHist && <HistoryModal title={`История · ${order.number}`} items={order.history} labels={ORDER_ACTIONS} onClose={() => setOShowHist(false)} />}
      {oLightbox && <div onClick={() => setOLightbox(null)} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}><img src={oLightbox} alt="" className="max-h-full max-w-full rounded-lg" /><button onClick={() => setOLightbox(null)} className="absolute right-4 top-4 rounded-full p-2 text-stone-700" style={{ backgroundColor: "rgba(255,255,255,0.92)" }}><X className="h-5 w-5" /></button></div>}
      <div className="mb-4 flex items-center justify-between gap-2"><button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="h-4 w-4" /> Назад</button><div className="flex items-center gap-2">{canFixRejected && <button onClick={() => appConfirm("Отправить наряд на согласование повторно?", { okText: "Отправить" }).then((ok) => { if (ok) api.resubmitOrder(order.id); })} className={btnPrimary}><Send className="h-4 w-4" /> Отправить повторно</button>}<button onClick={() => setOShowHist(true)} className={btnGhost}><History className="h-4 w-4" /> История{(order.history || []).length > 0 && <span className="text-stone-400"> · {order.history.length}</span>}</button><button onClick={onPrint} className={btnGhost}><Printer className="h-4 w-4" /> Печать</button></div></div>
      <div className={`p-4 ${card}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-lg font-semibold text-stone-900">{order.number}</span><span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Строительный наряд</span></div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5"><DeptChip name={order.departmentName} /><ObjChip name={order.objectName} color={order.objectColor} /></div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500"><span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> За {order.periodLabel || "—"}</span><span className="inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5" /> {order.ipName || "—"}</span></div>
          </div>
          <OrderStatusBadge s={order.status} />
        </div>
        {order.note && <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">{order.note}</p>}
      </div>
      <div className={`mt-4 p-4 ${card}`}>
        <div className="mb-3 text-sm font-semibold text-stone-700">Маршрут согласования</div>
        <OrderStageTrack order={order} />
      </div>
      <div className={`mt-4 overflow-hidden ${card}`}>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5"><span className="text-sm font-semibold text-stone-700">Состав работ</span>{canEditLines && order.lines.length > 0 && <button onClick={() => setEditLines((v) => !v)} className={editLines ? `${btnSm} border-stone-900 text-stone-900` : btnSm}><Pencil className="h-3.5 w-3.5" /> {editLines ? "Готово" : "Править"}</button>}</div>
        {!isDesktop ? <div className="divide-y divide-stone-100">{order.lines.map((l, i) => <div key={l.id} className="px-4 py-2.5"><div className="flex items-start gap-2"><span className="shrink-0 font-mono text-xs text-stone-400">{i + 1}.</span><span className="min-w-0 flex-1 text-sm leading-snug text-stone-800">{l.name}</span>{editLines && <button onClick={() => askRemoveLine(l)} className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600" title="Удалить позицию"><Trash2 className="h-4 w-4" /></button>}</div>{editLines ? <div className="mt-1.5 flex items-center gap-2 pl-5"><input type="number" min="0" value={l.qty} onChange={(e) => api.updateOrderLine(order.id, l.id, { qty: e.target.value })} className="w-16 rounded-md border border-stone-300 bg-white px-1 py-1 text-center text-sm" title="Количество" /><span className="shrink-0 text-xs text-stone-400">{l.unit} ×</span>{canEditPrice ? <input type="number" min="0" value={l.price} onChange={(e) => api.updateOrderLine(order.id, l.id, { price: Number(e.target.value) || 0 })} className="w-24 rounded-md border border-stone-300 bg-white px-1 py-1 text-right text-sm" title="Цена" /> : <span className="shrink-0 font-mono text-xs text-stone-500">{fmtMoney(l.price)}</span>}<span className="ml-auto shrink-0 font-mono text-sm font-semibold text-stone-800">{fmtMoney((Number(l.price) || 0) * (Number(l.qty) || 0))}</span></div> : <div className="mt-1 flex items-center justify-between pl-5 text-xs text-stone-500"><span className="font-mono">{l.qty} {l.unit} × {fmtMoney(l.price)}</span><span className="font-mono text-sm font-semibold text-stone-800">{fmtMoney((Number(l.price) || 0) * (Number(l.qty) || 0))}</span></div>}</div>)}<div className="flex items-center justify-between px-4 py-2.5"><span className="text-sm font-medium text-stone-600">Итого</span><span className="font-mono text-lg font-bold text-stone-900">{fmtMoney(total)}</span></div></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-stone-200 text-left text-xs text-stone-500"><th className="px-3 py-2">№</th><th className="px-3 py-2">Наименование</th><th className="px-3 py-2 text-right">Кол-во</th><th className="px-3 py-2">Ед.</th><th className="px-3 py-2 text-right">Цена</th><th className="px-3 py-2 text-right">Сумма</th>{editLines && <th className="px-2 py-2" />}</tr></thead><tbody>{order.lines.map((l, i) => <tr key={l.id} className="border-b border-stone-100"><td className="px-3 py-2 font-mono text-stone-400">{i + 1}</td><td className="px-3 py-2 text-stone-800">{l.name}</td><td className="px-3 py-2 text-right font-mono">{editLines ? <input type="number" min="0" value={l.qty} onChange={(e) => api.updateOrderLine(order.id, l.id, { qty: e.target.value })} className="w-20 rounded-md border border-stone-300 bg-white px-1 py-1 text-center text-sm" /> : l.qty}</td><td className="px-3 py-2 text-stone-500">{l.unit}</td><td className="px-3 py-2 text-right font-mono text-stone-600">{editLines && canEditPrice ? <input type="number" min="0" value={l.price} onChange={(e) => api.updateOrderLine(order.id, l.id, { price: Number(e.target.value) || 0 })} className="w-28 rounded-md border border-stone-300 bg-white px-1 py-1 text-right text-sm" /> : fmtMoney(l.price)}</td><td className="px-3 py-2 text-right font-mono font-semibold text-stone-800">{fmtMoney((Number(l.price) || 0) * (Number(l.qty) || 0))}</td>{editLines && <td className="px-2 py-2 text-right"><button onClick={() => askRemoveLine(l)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600" title="Удалить позицию"><Trash2 className="h-4 w-4" /></button></td>}</tr>)}</tbody><tfoot><tr><td colSpan={editLines ? 6 : 5} className="px-3 py-2.5 text-right text-sm font-medium text-stone-600">Итого</td><td className="px-3 py-2.5 text-right font-mono text-lg font-bold text-stone-900">{fmtMoney(total)}</td></tr></tfoot></table></div>}
      </div>
      {isCurrent && <div className={`mt-4 p-4 ${card}`}>
        <div className="mb-2 text-sm font-semibold text-stone-700">Ваше решение</div>
        <textarea className={inputCls} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (необязательно)…" />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><button onClick={() => api.decideOrder(order.id, "approve", comment.trim())} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:w-auto"><Check className="h-4 w-4" /> Согласовать</button><button onClick={() => api.decideOrder(order.id, "reject", comment.trim())} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 sm:w-auto"><X className="h-4 w-4" /> Отклонить</button></div>
      </div>}
            <div className={`mb-4 p-4 ${card}`}>
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Paperclip className="h-4 w-4" /> Файлы и фото {oAtts.length > 0 && <span className="text-stone-400">· {oAtts.length}</span>}</div>{oCanEdit && <><input ref={oFileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { Array.from(e.target.files || []).forEach((f) => api.addOrderAtt(order.id, f)); e.target.value = ""; }} /><button onClick={() => oFileRef.current && oFileRef.current.click()} className={btnGhost}><Upload className="h-4 w-4" /> Добавить</button></>}</div>
        {oAtts.length === 0 ? <p className="text-sm text-stone-400">Вложений нет. Можно прикрепить фото или PDF.</p> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{oAtts.map((a) => <AttachmentThumb key={a.id} meta={a} onView={setOLightbox} onRemove={(id) => appConfirm("Удалить это вложение из наряда?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.removeOrderAtt(order.id, id); })} canRemove={oCanEdit} />)}</div>}
      </div>
      
    </div>
  );
}

function OrderPrint({ order, onBack }) {
  const total = orderTotal(order);
  const decs = order.history.filter((h) => h.action === "approved" || h.action === "rejected");
  return (
    <div className="min-h-screen bg-stone-100">
      <style>{`@media print{@page{size:A4;margin:12mm;}.no-print{display:none!important}.order-print-sheet{padding:0!important;max-width:none!important}.order-print-sheet table{font-size:12px}}`}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3"><button onClick={onBack} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Назад</button><div className="text-sm font-medium text-stone-700">Наряд {order.number}</div><button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" /> Печать</button></div>
      <div className="order-print-sheet mx-auto max-w-3xl bg-white p-8 text-stone-900">
        <div className="flex items-start justify-between border-b-2 border-stone-900 pb-3"><div><div className="text-lg font-bold">НАРЯД НА СТРОИТЕЛЬНЫЕ РАБОТЫ</div><div className="mt-1 text-sm text-stone-600">{order.departmentName}{order.objectName ? " · " + order.objectName : ""}</div><div className="text-sm">За месяц: <span className="font-semibold">{order.periodLabel || "—"}</span></div><div className="text-sm">Закрыть на ИП: <span className="font-semibold">{order.ipName || "—"}</span></div></div><div className="text-right"><div className="font-mono text-xl font-bold">{order.number}</div><div className="text-sm text-stone-500">{fmtDate(order.createdAt)}</div></div></div>
        <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">Расчёты только с ИП на общеустановленном режиме (плательщики НДС).</div>
        {order.note && <p className="mt-3 text-sm">{order.note}</p>}
        <table className="mt-4 w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}><colgroup><col style={{ width: "6%" }} /><col style={{ width: "42%" }} /><col style={{ width: "12%" }} /><col style={{ width: "10%" }} /><col style={{ width: "15%" }} /><col style={{ width: "15%" }} /></colgroup><thead><tr className="border-y border-stone-400 text-left"><th className="px-1 py-1.5">№</th><th className="px-1 py-1.5">Наименование работ</th><th className="px-1 py-1.5 text-right">Кол-во</th><th className="px-1 py-1.5">Ед.</th><th className="px-1 py-1.5 text-right">Цена</th><th className="px-1 py-1.5 text-right">Сумма</th></tr></thead><tbody>{order.lines.map((l, i) => <tr key={l.id} className="border-b border-stone-200 align-top"><td className="px-1 py-1.5 font-mono text-stone-500">{i + 1}</td><td className="px-1 py-1.5" style={{ wordBreak: "break-word" }}>{l.name}</td><td className="px-1 py-1.5 text-right font-mono">{l.qty}</td><td className="px-1 py-1.5">{l.unit}</td><td className="px-1 py-1.5 text-right font-mono">{fmtMoney(l.price)}</td><td className="px-1 py-1.5 text-right font-mono">{fmtMoney((Number(l.price) || 0) * (Number(l.qty) || 0))}</td></tr>)}</tbody><tfoot><tr className="border-t-2 border-stone-400"><td colSpan={5} className="px-1 py-2 text-right font-semibold">Итого</td><td className="px-1 py-2 text-right font-mono text-base font-bold">{fmtMoney(total)}</td></tr></tfoot></table>
        <div className="mt-6 text-sm"><div className="mb-1 font-semibold">Маршрут согласования:</div>{order.chain.length === 0 ? <div className="text-stone-500">без согласования</div> : order.chain.map((st, i) => <div key={i} className="flex items-center justify-between border-b border-stone-100 py-1"><span>{i + 1}. {st.label || st.approverName} ({st.approverName})</span><span className="text-stone-500">{decs[i] ? (decs[i].action === "rejected" ? "отклонил" : "согласовал") + " · " + fmtDate(decs[i].at) : "ожидает"}</span></div>)}</div>
        <div className="mt-12 flex justify-end text-sm"><div style={{ width: 260 }} className="border-t border-stone-400 pt-1 text-center text-stone-500">Директор · подпись / дата</div></div>
      </div>
    </div>
  );
}

function ChatView({ data, me, api }) {
  const msgs = data.chat || [];
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [msgs.length]);
  useEffect(() => {
    const unread = msgs.some((m) => m.by !== me.id && (!me.chatReadAt || new Date(m.at) > new Date(me.chatReadAt)));
    if (unread) api.markChatRead();
  }, [msgs.length]);
  const send = () => { const t = text.trim(); if (!t) return; api.sendChat(t); setText(""); };
  const roleOf = (m) => (ROLES[m.role] ? ROLES[m.role].t : "");
  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className={`overflow-y-auto p-3 ${card}`} style={{ minHeight: 340, maxHeight: "62vh" }}>
        {msgs.length === 0 && <p className="py-12 text-center text-sm text-stone-400">Сообщений пока нет — напишите первым.</p>}
        <div className="space-y-2">
          {msgs.map((m) => { const mine = m.by === me.id; return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-md rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "bg-amber-500 text-stone-900" : "border border-stone-200 bg-white text-stone-800"}`}>
                <div className={`mb-0.5 text-xs font-semibold ${mine ? "text-stone-700" : "text-stone-500"}`}>{mine ? "Вы" : m.byName}{!mine && roleOf(m) ? " · " + roleOf(m) : ""}</div>
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                <div className={`mt-0.5 text-right text-xs ${mine ? "text-stone-700" : "text-stone-400"}`}>{fmtDateTime(m.at)}</div>
              </div>
            </div>
          ); })}
          <div ref={endRef} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение всем сотрудникам…" className={inputCls} />
        <button onClick={send} disabled={!text.trim()} className={`${btnPrimary} disabled:opacity-40`}><Send className="h-4 w-4" /></button>
      </div>
      {!SRV.url && <p className="mt-2 text-xs text-stone-400">Локальный режим: сообщения видны только в этом браузере. Общая переписка между сотрудниками работает в серверном режиме.</p>}
    </div>
  );
}

function CalendarPane({ data, me, api }) {
  const pad2 = (n2) => String(n2).padStart(2, "0");
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(todayKey);
  const [title, setTitle] = useState("");
  const events = (data.events || []).filter((e) => e.userId === me.id);
  const byDate = {}; events.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  const first = new Date(cur.y, cur.m, 1);
  const off = (first.getDay() + 6) % 7;
  const dim = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = []; for (let i = 0; i < 42; i++) { const d = i - off + 1; cells.push(d >= 1 && d <= dim ? d : null); }
  const keyOf = (d) => `${cur.y}-${pad2(cur.m + 1)}-${pad2(d)}`;
  const nav = (dir) => setCur((p2) => { const m2 = p2.m + dir; return { y: p2.y + Math.floor(m2 / 12), m: ((m2 % 12) + 12) % 12 }; });
  const add = () => { const t = title.trim(); if (!t) return; api.addEvent(sel, t); setTitle(""); };
  const selEvents = byDate[sel] || [];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={`p-3 lg:col-span-2 ${card}`}>
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => nav(-1)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100"><ChevronLeft className="h-4 w-4" /></button>
          <div className="text-sm font-semibold text-stone-800">{periodLabel(`${cur.y}-${pad2(cur.m + 1)}`)}</div>
          <button onClick={() => nav(1)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-400">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="h-16 rounded-lg bg-stone-100" />;
            const k2 = keyOf(d); const evs = byDate[k2] || []; const isSel = sel === k2; const isToday = todayKey === k2;
            return (
              <button key={i} onClick={() => setSel(k2)} className={`flex h-16 flex-col items-start gap-0.5 overflow-hidden rounded-lg border p-1 text-left transition ${isSel ? "border-amber-400 bg-amber-50" : "border-stone-200 bg-white hover:bg-stone-50"}`}>
                <span className={isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white" : "text-xs font-semibold text-stone-600"}>{d}</span>
                {evs.slice(0, 2).map((e) => <span key={e.id} className="w-full truncate rounded bg-sky-100 px-1 text-xs leading-4 text-sky-800">{e.title}</span>)}
                {evs.length > 2 && <span className="text-xs text-stone-400">+{evs.length - 2}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`p-4 ${card}`}>
        <div className="mb-2 text-sm font-semibold text-stone-800">{fmtDate(sel)}</div>
        <div className="mb-3 flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Новое событие…" className={inputCls} /><button onClick={add} disabled={!title.trim()} className={`${btnPrimary} disabled:opacity-40`}><Plus className="h-4 w-4" /></button></div>
        {selEvents.length === 0 ? <p className="text-sm text-stone-400">Событий на этот день нет.</p> : <div className="space-y-1.5">{selEvents.map((e) => <div key={e.id} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2 text-sm"><CalendarDays className="h-4 w-4 shrink-0 text-sky-500" /><span className="min-w-0 flex-1 truncate text-stone-700">{e.title}</span><button onClick={() => appConfirm("Удалить событие «" + (e.title || "—") + "» из календаря?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteEvent(e.id); })} className={`${iconBtn} hover:!text-rose-600`}><Trash2 className="h-4 w-4" /></button></div>)}</div>}
        <p className="mt-3 text-xs text-stone-400">Личный календарь — события видите только вы.</p>
      </div>
    </div>
  );
}

function ActionLog({ data, onOpen, onOpenOrder }) {
  const [q, setQ] = useState("");
  const evs = [];
  data.requests.forEach((r) => (r.history || []).forEach((h) => evs.push({ kind: "req", id: r.id, number: r.number, title: reqTitle(r), h })));
  (data.orders || []).forEach((o) => (o.history || []).forEach((h) => evs.push({ kind: "order", id: o.id, number: o.number, title: o.ipName || "", h })));
  let list = evs.sort((a, b) => new Date(b.h.at) - new Date(a.h.at));
  if (q.trim()) { const x = q.toLowerCase(); list = list.filter((e) => e.number.toLowerCase().includes(x) || (e.h.byName || "").toLowerCase().includes(x) || (ACTIONS[e.h.action] || e.h.action || "").toLowerCase().includes(x)); }
  list = list.slice(0, 300);
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5"><Search className="h-4 w-4 shrink-0 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру, человеку, действию" className="w-full min-w-0 bg-transparent text-sm focus:outline-none" /></div>
      <div className={`divide-y divide-stone-100 ${card}`}>
        {list.length === 0 ? <div className="py-10 text-center text-sm text-stone-400">Записей нет.</div> : list.map((e, i) => (
          <button key={i} onClick={() => (e.kind === "req" ? onOpen(e.id) : onOpenOrder(e.id))} className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left text-sm transition hover:bg-stone-50">
            <span className="w-32 shrink-0 font-mono text-xs text-stone-400">{fmtDateTime(e.h.at)}</span>
            <span className="shrink-0 font-mono text-xs font-semibold text-stone-900">{e.number}</span>
            <span className="min-w-0 flex-1 truncate text-stone-700"><span className="font-medium">{e.h.byName || "—"}</span> {ACTIONS[e.h.action] || e.h.action}{e.h.comment ? <span className="text-stone-400"> · {e.h.comment}</span> : null}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-400">Показываются последние 300 записей по заявкам и нарядам.</p>
    </div>
  );
}

function DirectMessages({ data, me, api }) {
  const isDesktop = useIsDesktop();
  const contacts = data.users.filter((u) => u.id !== me.id);
  const dms = data.dm || [];
  const [peer, setPeer] = useState(null);
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const convo = peer ? dms.filter((m) => (m.from === me.id && m.to === peer) || (m.from === peer && m.to === me.id)).sort((a, b) => new Date(a.at) - new Date(b.at)) : [];
  const unreadFrom = (uid) => dms.filter((m) => m.from === uid && m.to === me.id && !(m.readBy || []).includes(me.id)).length;
  const lastAt = (uid) => { const arr = dms.filter((m) => (m.from === me.id && m.to === uid) || (m.from === uid && m.to === me.id)); return arr.length ? Math.max(...arr.map((m) => new Date(m.at).getTime())) : 0; };
  useEffect(() => { if (peer) api.markDMRead(peer); }, [peer, convo.length]);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [convo.length, peer]);
  const send = () => { const t = text.trim(); if (!t || !peer) return; api.sendDM(peer, t); setText(""); };
  const peerUser = contacts.find((u) => u.id === peer);
  const sortedContacts = [...contacts].sort((a, b) => (unreadFrom(b.id) - unreadFrom(a.id)) || (lastAt(b.id) - lastAt(a.id)) || a.name.localeCompare(b.name, "ru"));
  const contactList = (
    <div className="space-y-1">
      {sortedContacts.map((u) => { const un = unreadFrom(u.id); const on = peer === u.id; return (
        <button key={u.id} onClick={() => setPeer(u.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${on ? "border-violet-400 bg-violet-50" : "border-stone-200 bg-white hover:bg-stone-50"}`}>
          <Avatar name={u.name} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-stone-800">{u.name}</span><span className="mt-0.5 block"><RoleChip r={u.role} /></span></span>
          {un > 0 && <span className="shrink-0 rounded-full bg-violet-500 px-1.5 text-xs font-bold text-white">{un}</span>}
        </button>
      ); })}
      {contacts.length === 0 && <p className="text-sm text-stone-400">Нет других сотрудников.</p>}
    </div>
  );
  const convoPane = peer ? (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2">{!isDesktop && <button onClick={() => setPeer(null)} className="rounded-md p-1 text-stone-500 hover:bg-stone-100"><ArrowLeft className="h-4 w-4" /></button>}<Avatar name={peerUser ? peerUser.name : "?"} /><div className="min-w-0"><div className="truncate text-sm font-semibold text-stone-800">{peerUser ? peerUser.name : ""}</div></div></div>
      <div className={`overflow-y-auto p-3 ${card}`} style={{ minHeight: 300, maxHeight: "52vh" }}>
        {convo.length === 0 && <p className="py-10 text-center text-sm text-stone-400">Сообщений пока нет. Напишите первым.</p>}
        <div className="space-y-2">{convo.map((m) => { const mine = m.from === me.id; return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-xs rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "bg-violet-500 text-white" : "border border-stone-200 bg-white text-stone-800"}`}><div className="whitespace-pre-wrap break-words">{m.text}</div><div className={`mt-0.5 text-right text-xs ${mine ? "text-violet-100" : "text-stone-400"}`}>{fmtDateTime(m.at)}</div></div></div>; })}<div ref={endRef} /></div>
      </div>
      <div className="mt-2 flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение…" className={inputCls} /><button onClick={send} disabled={!text.trim()} className={`${btnPrimary} disabled:opacity-40`}><Send className="h-4 w-4" /></button></div>
      {!SRV.url && <p className="mt-2 text-xs text-stone-400">Локальный режим: переписка видна только в этом браузере.</p>}
    </div>
  ) : <div className="flex items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-400">Выберите собеседника из списка.</div>;
  if (!isDesktop) return <div>{peer ? convoPane : contactList}</div>;
  return <div className="grid gap-4 lg:grid-cols-3"><div className="lg:col-span-1">{contactList}</div><div className="lg:col-span-2">{convoPane}</div></div>;
}

function AnonWrite({ me, api }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const send = () => { const t = text.trim(); if (!t) return; api.sendAnon(t); setText(""); setSent(true); };
  return (
    <div className="mx-auto max-w-2xl">
      <div className={`p-4 ${card}`}>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-stone-800"><EyeOff className="h-4 w-4 text-stone-500" /> Анонимное сообщение администратору</div>
        <p className="mb-3 text-sm leading-relaxed text-stone-500">Администратор увидит только текст — без вашего имени и должности. Ответить на анонимное сообщение он не сможет.</p>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setSent(false); }} placeholder="Что хотите сообщить…" className={`${inputCls} h-32 resize-y`} />
        <div className="mt-2 flex flex-wrap items-center gap-3"><button onClick={send} disabled={!text.trim()} className={`${btnPrimary} w-full sm:w-auto disabled:opacity-40`}><Send className="h-4 w-4" /> Отправить анонимно</button>{sent && <span className="text-sm font-medium text-emerald-600">Отправлено анонимно.</span>}</div>
      </div>
    </div>
  );
}

function AnonInbox({ data }) {
  const list = [...(data.anon || [])].reverse();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center gap-2 text-sm text-stone-500"><EyeOff className="h-4 w-4" /> Анонимные сообщения сотрудников. Отправитель не сохраняется и не отслеживается.</div>
      {list.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center text-sm text-stone-400">Анонимных сообщений пока нет.</div> : <div className="space-y-2">{list.map((a) => <div key={a.id} className={`p-3 ${card}`}><div className="whitespace-pre-wrap text-sm text-stone-800">{a.text}</div><div className="mt-1 font-mono text-xs text-stone-400">{fmtDateTime(a.at)}</div></div>)}</div>}
    </div>
  );
}

function UserPhoto({ user, size = 48 }) {
  const [src, setSrc] = useState(() => user.avatar || _attCache["avatar-" + user.id] || null);
  useEffect(() => {
    if (user.avatar) { setSrc(user.avatar); return; }
    let on = true;
    getAtt("avatar-" + user.id).then((d) => { if (on) setSrc(d || null); }).catch(() => { if (on) setSrc(null); });
    return () => { on = false; };
  }, [user.id, user.avatar, user.avatarVer]);
  if (src) return <img src={src} alt="" className="shrink-0 rounded-full object-cover ring-1 ring-stone-200" style={{ width: size, height: size }} />;
  return <div className="flex shrink-0 items-center justify-center rounded-full bg-stone-900 font-semibold text-white" style={{ width: size, height: size, fontSize: size / 3 }}>{(user.name || "?").trim().slice(0, 1).toUpperCase()}</div>;
}

function Messenger({ data, me, api }) {
  const isAdmin = me.role === "admin";
  const [sub, setSub] = useState("chat");
  const gcUnread = (data.chat || []).filter((m2) => m2.by !== me.id && (!me.chatReadAt || new Date(m2.at) > new Date(me.chatReadAt))).length;
  const dmUnread = (data.dm || []).filter((m2) => m2.to === me.id && !(m2.readBy || []).includes(me.id)).length;
  const subs = [
    { k: "chat", t: "Общий чат", icon: MessageSquare, badge: gcUnread },
    { k: "dm", t: "Личные", icon: Users, badge: dmUnread },
    isAdmin ? { k: "anon", t: "Анонимные", icon: EyeOff, badge: (data.anon || []).length } : { k: "anonwrite", t: "Анонимно админу", icon: EyeOff, badge: 0 },
  ];
  return (
    <div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {subs.map((tb) => <button key={tb.k} onClick={() => setSub(tb.k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${sub === tb.k ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><tb.icon className="h-3.5 w-3.5" /> {tb.t}{tb.badge > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${sub === tb.k ? "bg-white text-stone-900" : "bg-violet-500 text-white"}`}>{tb.badge}</span>}</button>)}
      </div>
      {sub === "chat" ? <ChatView data={data} me={me} api={api} /> : sub === "dm" ? <DirectMessages data={data} me={me} api={api} /> : sub === "anon" ? <AnonInbox data={data} /> : <AnonWrite me={me} api={api} />}
    </div>
  );
}

function Notebook({ data, me, api, onOpenReq, onOpenOrder, reportMonth, setReportMonth, onReportsPrint }) {
  const isAdmin = me.role === "admin";
  const [tab, setTab] = useState("notes");
  const avatarRef = useRef(null);
  const dark = me.theme === "dark";
  const gcUnread = (data.chat || []).filter((m2) => m2.by !== me.id && (!me.chatReadAt || new Date(m2.at) > new Date(me.chatReadAt))).length;
  const dmUnread = (data.dm || []).filter((m2) => m2.to === me.id && !(m2.readBy || []).includes(me.id)).length;
  const msgBadge = gcUnread + dmUnread;
  const tabs = [
    { k: "notes", t: "Заметки", icon: NotebookPen, badge: 0 },
    { k: "calendar", t: "Календарь", icon: CalendarDays, badge: 0 },
    { k: "messenger", t: "Мессенджер", icon: MessageSquare, badge: msgBadge },
  ];
  if (me.role === "supply" || isAdmin) tabs.push({ k: "dashboard", t: "Дашборд", icon: LayoutDashboard, badge: 0 });
  if (isAdmin) tabs.push({ k: "reports", t: "Отчёты", icon: BarChart3, badge: 0 });
  tabs.push({ k: "archive", t: "Архив", icon: Archive, badge: 0 });
  if (isAdmin) tabs.push({ k: "log", t: "Журнал", icon: BookOpen, badge: 0 });
  if (isAdmin) tabs.push({ k: "settings", t: "Настройки", icon: Settings, badge: 0 });
  const content = tab === "notes" ? <NotebookNotes data={data} me={me} api={api} /> : tab === "calendar" ? <CalendarPane data={data} me={me} api={api} /> : tab === "messenger" ? <Messenger data={data} me={me} api={api} /> : tab === "dashboard" ? <Dashboard data={data} onOpen={onOpenReq} /> : tab === "reports" ? <ReportsHub data={data} me={me} month={reportMonth} setMonth={setReportMonth} onPrint={onReportsPrint} /> : tab === "archive" ? <ArchiveView data={data} me={me} onOpen={onOpenReq} /> : tab === "log" ? <ActionLog data={data} onOpen={onOpenReq} onOpenOrder={onOpenOrder} /> : <SettingsHub data={data} me={me} api={api} />;
  const themeBtn = <button onClick={() => api.setTheme(dark ? "" : "dark")} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50" title="Переключить тему">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{dark ? "День" : "Ночь"}</button>;
  const profile = (
    <div className={`flex items-center gap-3 p-4 ${card}`}>
      <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) api.setAvatar(f); e.target.value = ""; }} />
      <button onClick={() => avatarRef.current && avatarRef.current.click()} className="group relative shrink-0 rounded-full" title="Изменить фото">
        <UserPhoto user={me} size={48} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 group-hover:text-stone-800"><Camera className="h-3 w-3" /></span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight text-stone-900">{me.name}</div>
        {me.departmentId && <div className="mt-0.5 text-xs text-stone-500">{deptName(data, me.departmentId)}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">{themeBtn}<RoleChip r={me.role} /></div>
    </div>
  );
  return (
    <div>
      <div className="mb-4">{profile}</div>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tb) => <button key={tb.k} onClick={() => setTab(tb.k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${tab === tb.k ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}><tb.icon className="h-4 w-4" /> {tb.t}{tb.badge > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${tab === tb.k ? "bg-white text-stone-900" : "bg-violet-500 text-white"}`}>{tb.badge}</span>}</button>)}
      </div>
      {content}
    </div>
  );
}

function NotebookNotes({ data, me, api }) {
  const myNotes = (data.notes || []).filter((n) => n.userId === me.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const [sel, setSel] = useState(myNotes[0] ? myNotes[0].id : null);
  const active = myNotes.find((n) => n.id === sel) || null;
  const create = () => { const id = api.createNote(); setSel(id); };
  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800"><Eye className="mt-0.5 h-4 w-4 shrink-0" /><div>Это ваш личный блокнот. Записи видите <span className="font-semibold">только вы</span> — они хранятся в этом браузере и не передаются другим пользователям.</div></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <button onClick={create} className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"><Plus className="h-4 w-4" /> Новая запись</button>
          <div className="space-y-1.5">{myNotes.length === 0 ? <p className="rounded-lg border border-dashed border-stone-300 bg-white py-8 text-center text-sm text-stone-400">Записей нет.</p> : myNotes.map((n) => <button key={n.id} onClick={() => setSel(n.id)} className={`flex w-full flex-col overflow-hidden rounded-lg border p-2.5 text-left transition ${sel === n.id ? "border-violet-400 bg-violet-50" : "border-stone-200 bg-white hover:border-stone-300"}`}><span className="truncate text-sm font-medium text-stone-800">{(n.title || "").trim() || "Без названия"}</span><span className="truncate text-xs text-stone-400">{(n.body || "").trim() || "Пусто"}</span><span className="mt-0.5 font-mono text-xs text-stone-400">{fmtDate(n.updatedAt)}</span></button>)}</div>
        </div>
        <div className="lg:col-span-2">{active ? <div className={`p-4 ${card}`}><div className="mb-2 flex items-center justify-between gap-2"><input className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-stone-900 focus:outline-none" value={active.title} onChange={(e) => api.updateNote(active.id, { title: e.target.value })} placeholder="Заголовок записи" /><button onClick={() => { appConfirm("Удалить запись?", { danger: true }).then((ok) => { if (ok) { api.deleteNote(active.id); setSel(null); } }); }} className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div><textarea className="w-full resize-y rounded-lg border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-800 focus:border-violet-400 focus:outline-none" rows={16} value={active.body} onChange={(e) => api.updateNote(active.id, { body: e.target.value })} placeholder="Текст записи…" /><div className="mt-2 text-right font-mono text-xs text-stone-400">Изменено: {fmtDate(active.updatedAt)}</div></div> : <div className="flex items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-400">Выберите запись или создайте новую.</div>}</div>
      </div>
    </div>
  );
}

function AdminAnnouncements({ data, api }) {
  const [text, setText] = useState("");
  const list = [...(data.announcements || [])].reverse();
  const post = () => { const t = text.trim(); if (!t) return; api.addAnnouncement(t); setText(""); };
  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold text-stone-900">Объявления</h2>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Последнее объявление показывается всем сотрудникам плашкой поверх приложения, пока каждый не закроет её крестиком.</p>
      <div className={`mb-4 p-4 ${card}`}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст объявления…" className={`${inputCls} h-24 resize-y`} />
        <button onClick={post} disabled={!text.trim()} className={`${btnPrimary} mt-2 disabled:opacity-40`}><Megaphone className="h-4 w-4" /> Опубликовать</button>
      </div>
      {list.length === 0 ? <p className="text-sm text-stone-400">Объявлений ещё не было.</p> : <div className="space-y-2">{list.map((a) => <div key={a.id} className={`flex items-start gap-2 p-3 ${card}`}><Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><div className="min-w-0 flex-1"><div className="whitespace-pre-wrap text-sm text-stone-800">{a.text}</div><div className="mt-1 text-xs text-stone-400">{a.byName} · {fmtDateTime(a.at)}{a.pinned && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">закреплено</span>}</div></div><button onClick={() => api.togglePinAnnouncement(a.id)} className={a.pinned ? "inline-flex items-center justify-center rounded-md bg-amber-100 p-1.5 text-amber-700 hover:bg-amber-200" : iconBtn} title={a.pinned ? "Открепить" : "Закрепить для всех"}><Flag className="h-4 w-4" /></button><button onClick={() => appConfirm("Удалить объявление?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteAnnouncement(a.id); })} className={`${iconBtn} hover:!text-rose-600`} title="Удалить"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
    </div>
  );
}

function AdminVehicles({ data, api }) {
  const list = data.vehicles || [];
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold text-stone-900">Справочник техники</h2><button onClick={api.addVehicle} className={btnPrimary}><Plus className="h-4 w-4" /> Добавить</button></div>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Подставляется в заявках «Транспорт» и «Топливо» и используется в отчёте ГСМ по технике.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((v) => <div key={v.id} className={`flex items-center gap-2 p-2.5 ${card}`}><Truck className="h-4 w-4 shrink-0 text-stone-400" /><input className={`${inputCls} flex-1`} value={v.name} onChange={(e) => api.updateVehicle(v.id, e.target.value)} /><button onClick={() => appConfirm("Удалить технику «" + (v.name || v.plate || "—") + "» из справочника?", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteVehicle(v.id); })} className={`${iconBtn} hover:!text-rose-600`}><Trash2 className="h-4 w-4" /></button></div>)}
        {list.length === 0 && <p className="text-sm text-stone-400">Список пуст — добавьте технику.</p>}
      </div>
    </div>
  );
}

function AdminData({ data, api }) {
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const [busy, setBusy] = useState("");
  const stampDate = new Date().toISOString().slice(0, 10);
  const expData = () => downloadFile(`interstil-backup-${stampDate}.json`, JSON.stringify({ app: "interstil", ver: 11, exportedAt: new Date().toISOString(), state: data }), "application/json");
  const expFull = async () => {
    setBusy("Собираю вложения…");
    try {
      const atts = [];
      const seen = {};
      for (const r of (data.requests || [])) for (const a of (r.attachments || [])) { if (a.dataUrl) { if (!seen[a.id]) { seen[a.id] = 1; atts.push({ id: a.id, dataUrl: a.dataUrl }); } } else { const d = await getAtt(a.id); if (d && !seen[a.id]) { seen[a.id] = 1; atts.push({ id: a.id, dataUrl: d }); } } }
      for (const o of (data.orders || [])) for (const a of (o.attachments || [])) { if (a.dataUrl && !seen[a.id]) { seen[a.id] = 1; atts.push({ id: a.id, dataUrl: a.dataUrl }); } }
      downloadFile(`interstil-backup-full-${stampDate}.json`, JSON.stringify({ app: "interstil", ver: 11, exportedAt: new Date().toISOString(), state: data, attachments: atts }), "application/json");
    } finally { setBusy(""); }
  };
  const doImport = (file) => {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(String(rd.result));
        const st = j.state && Array.isArray(j.state.users) ? j.state : (Array.isArray(j.users) ? j : null);
        if (!st || !st.users.length) throw new Error("bad");
        appConfirm(`Заменить ВСЕ текущие данные на данные из файла (заявок: ${(st.requests || []).length}, нарядов: ${(st.orders || []).length})? Действие необратимо.`, { danger: true }).then((ok) => { if (!ok) return; (j.attachments || []).forEach((a) => { if (a && a.id && a.dataUrl) setAtt(a.id, a.dataUrl); }); api.importState(st); });
      } catch (e) { appConfirm("Файл не распознан как резервная копия этой системы.", { okText: "Понятно" }); }
    };
    rd.readAsText(file);
  };
  const uLim = data.urgentLimit == null ? 3 : data.urgentLimit;
  const mainSize = dataSize(data);
  const attList = [].concat(...(data.requests || []).map((r) => r.attachments || []), ...(data.orders || []).map((o) => o.attachments || []));
  const attSize = attList.reduce((a, x) => a + (Number(x.size) || 0), 0);
  const used = mainSize + attSize;
  const TOTAL = 25000000;   // 5 МБ на ключ; файлы лежат отдельными ключами
  const pct = Math.min(100, Math.round((used / TOTAL) * 100));
  const photos = attList.length;
  return (
    <div className="max-w-2xl space-y-4">
      <div className={`p-4 ${card}`}>
        <h2 className="mb-1 text-lg font-semibold text-stone-900">Занято места</h2>
        <p className="mb-3 text-sm leading-relaxed text-stone-500">Записи (заявки, наряды, справочники) хранятся отдельно от фотографий — каждое фото лежит в своей ячейке. Поэтому таблица сохраняется мгновенно, сколько бы снимков ни накопилось.</p>
        <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-stone-200"><div className={`h-full rounded-full ${pct >= 85 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: pct + "%" }} /></div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={pct >= 85 ? "font-semibold text-rose-600" : "text-stone-600"}>{(used / 1048576).toFixed(2)} МБ занято</span>
          <span className="text-stone-400">записи: {(mainSize / 1024).toFixed(0)} КБ · вложений: {photos} ({(attSize / 1048576).toFixed(1)} МБ)</span>
        </div>
        {pct >= 85 && <p className="mt-2 text-xs font-medium text-rose-600">Место почти кончилось. Удалите фото из старых заявок или выгрузите копию и очистите архив.</p>}
      </div>
      <div className={`p-4 ${card}`}>
        <h2 className="mb-1 text-lg font-semibold text-stone-900">Правила заявок</h2>
        <p className="mb-3 text-sm leading-relaxed text-stone-500">Сколько заявок с приоритетом «Срочно» можно подать за один день. Когда лимит исчерпан, «Срочно» становится недоступно до завтра.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-stone-700">Лимит срочных заявок в день</label>
          <input type="number" min="0" max="99" value={uLim} onChange={(e) => api.setUrgentLimit(e.target.value)} className={`${inputCls} w-24 text-center`} />
          <button onClick={() => api.setUrgentLimit(0)} className={btnSm}>Без лимита</button>
        </div>
        <p className="mt-2 text-xs text-stone-400">{uLim === 0 ? "Сейчас: без ограничений — «Срочно» доступно всегда." : `Сейчас: не более ${uLim} в день.`} Значение 0 снимает ограничение.</p>
      </div>
      <div className={`p-4 ${card}`}>
        <h2 className="mb-1 text-lg font-semibold text-stone-900">Резервная копия</h2>
        <p className="mb-3 text-sm leading-relaxed text-stone-500">{SRV.url ? "Данные хранятся на общем сервере; копия — дополнительная страховка." : "Данные хранятся в браузере этого устройства. Регулярно выгружайте копию — очистка браузера удалит всё безвозвратно."}</p>
        <div className="flex flex-wrap gap-2"><button onClick={expData} className={btnPrimary}><FileDown className="h-4 w-4" /> Выгрузить данные (JSON)</button><button onClick={expFull} disabled={!!busy} className={btnGhost}><FileDown className="h-4 w-4" /> {busy || "Выгрузить с вложениями"}</button></div>
      </div>
      <div className={`p-4 ${card}`}>
        <h2 className="mb-1 text-lg font-semibold text-stone-900">Восстановление из копии</h2>
        <p className="mb-3 text-sm leading-relaxed text-stone-500">Загрузка файла <b>полностью заменит</b> текущие данные{SRV.url ? " на сервере — для всех пользователей" : ""}.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { doImport(e.target.files && e.target.files[0]); e.target.value = ""; }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} className={btnGhost}><Upload className="h-4 w-4" /> Загрузить копию…</button>
      </div>
      <div className={`p-4 ${card}`}>
        <h2 className="mb-1 text-lg font-semibold text-stone-900">Логотип компании</h2>
        <p className="mb-3 text-sm leading-relaxed text-stone-500">Показывается в шапке приложения и на экране входа. Подойдёт PNG с прозрачным фоном, JPG или SVG — любой ширины: размер подберётся сам, пропорции сохранятся, подложки не будет.</p>
        <div className="flex flex-wrap items-center gap-3">
          <CompanyLogo data={data} ver={data.brandingVer || 0} size={12} rounded="rounded-xl" fallbackIcon="h-7 w-7" h={56} maxW={280} />
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) api.setLogo(f); e.target.value = ""; }} />
          <button onClick={() => logoRef.current && logoRef.current.click()} className={btnGhost}><Upload className="h-4 w-4" /> Загрузить логотип</button>
          <button onClick={api.clearLogo} className={btnGhost}><Trash2 className="h-4 w-4" /> Вернуть стандартный</button>
        </div>
      </div>
    </div>
  );
}

function IpAdmin({ data, api }) {
  const ips = data.ips || [];
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold text-stone-900">ИП-подрядчики</h2><button onClick={api.addIp} className={btnPrimary}><Plus className="h-4 w-4" /> Добавить</button></div>
      <p className="mb-3 text-sm leading-relaxed text-stone-500">На эти ИП закрываются наряды. В наряде можно выбрать только ИП на общеустановленном режиме (с НДС).</p>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div>Снимите галочку «Плательщик НДС», если ИП на упрощёнке — тогда он не появится в выборе при создании наряда.</div></div>
      <div className="space-y-2.5">{ips.length === 0 ? <p className="rounded-lg border border-dashed border-stone-300 bg-white py-8 text-center text-sm text-stone-400">ИП не добавлены.</p> : ips.map((x) => (
        <div key={x.id} className={`p-3 ${card}`}>
          <div className="flex flex-wrap items-center gap-2"><Banknote className="h-4 w-4 shrink-0 text-stone-400" /><input className={`${inputCls} min-w-0 flex-1`} value={x.name} onChange={(e) => api.updateIp(x.id, { name: e.target.value })} placeholder="Наименование ИП" /><input className={`${inputCls} w-44`} value={x.bin || ""} onChange={(e) => api.updateIp(x.id, { bin: e.target.value })} placeholder="ИИН/БИН" /><button onClick={() => appConfirm("Удалить ИП «" + (x.name || "—") + "»? Уже созданные наряды сохранят его название.", { okText: "Удалить", danger: true }).then((ok) => { if (ok) api.deleteIp(x.id); })} className="shrink-0 rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>
          <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={!!x.vat} onChange={(e) => api.updateIp(x.id, { vat: e.target.checked })} className="accent-stone-900" /> Плательщик НДС · общеустановленный режим {x.vat ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">доступен для нарядов</span> : <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">скрыт в нарядах</span>}</label>
        </div>
      ))}</div>
    </div>
  );
}
