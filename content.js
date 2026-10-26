/*
 * Proton Mail Auto-Advance
 *
 * How it works: instead of hooking specific buttons (which break whenever
 * Proton redesigns its toolbar), it watches two things:
 *   1. which email is open (its ID appears in the URL), and
 *   2. which emails are in the message list.
 * When the open email closes AND it has disappeared from the list, it was
 * archived/deleted/moved/marked spam (by button, shortcut or drag) — so we
 * open its neighbour. If it closed but is still in the list (Escape, back,
 * mark as unread, applying a label), nothing happens.
 */
(() => {
  "use strict";

  const ROW_SELECTORS = [
    '[data-shortcut-target="item-container"][data-element-id]',
    "[data-element-id]",
  ];
  const TICK_MS = 150;
  const WAIT_FOR_REMOVAL_MS = 2500;

  let settings = { direction: "next", debug: false };
  let lastOpen = null; // { id, order: string[], base: string }
  let pending = null; // { from, at }
  let suppressUntil = 0;

  const log = (...a) => settings.debug && console.log("[auto-advance]", ...a);

  try {
    browser.storage.local.get(settings).then((s) => (settings = { ...settings, ...s }));
    browser.storage.onChanged.addListener((changes) => {
      for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    });
  } catch (_) {
    /* storage unavailable: keep defaults */
  }

  function rows() {
    for (const sel of ROW_SELECTORS) {
      const found = document.querySelectorAll(sel);
      if (found.length) return [...found];
    }
    return [];
  }

  function listIds() {
    const seen = new Set();
    const ids = [];
    for (const el of rows()) {
      const id = el.getAttribute("data-element-id");
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }

  function segments() {
    return location.pathname.split("/").filter(Boolean).map((s) => {
      try {
        return decodeURIComponent(s);
      } catch (_) {
        return s;
      }
    });
  }

  // Path of the folder/label the email was opened from, e.g. "/u/0/inbox".
  function basePathFor(id) {
    const raw = location.pathname.split("/").filter(Boolean);
    const segs = segments();
    const i = segs.indexOf(id);
    return "/" + raw.slice(0, i).join("/");
  }

  function pickTarget(from, ids) {
    const present = new Set(ids);
    const i = from.order.indexOf(from.id);
    if (i === -1) return null;
    const below = from.order.slice(i + 1);
    const above = from.order.slice(0, i).reverse();
    const [first, second] = settings.direction === "previous" ? [above, below] : [below, above];
    return first.find((id) => present.has(id)) || second.find((id) => present.has(id)) || null;
  }

  function open(id, base) {
    const row = rows().find((el) => el.getAttribute("data-element-id") === id);
    if (!row) return;
    log("opening", id);
    suppressUntil = Date.now() + 800;
    row.click();

    // Fallback in case Proton ignores the synthetic click: navigate via the router.
    setTimeout(() => {
      if (segments().includes(id)) return;
      log("click didn't open it, using URL fallback");
      history.pushState(history.state, "", `${base}/${encodeURIComponent(id)}${location.search}`);
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    }, 500);
  }

  function tick() {
    const ids = listIds();
    const segs = segments();
    const openId = segs.find((s) => ids.includes(s)) || null;

    // The previously open email is no longer in the URL: it was closed.
    if (lastOpen && !segs.includes(lastOpen.id) && openId !== lastOpen.id) {
      if (!openId && Date.now() > suppressUntil) {
        pending = { from: lastOpen, at: Date.now() };
        log("closed", lastOpen.id);
      }
      lastOpen = null;
    }

    if (openId) {
      lastOpen = { id: openId, order: ids, base: basePathFor(openId) };
      pending = null;
    } else if (lastOpen && segs.includes(lastOpen.id)) {
      // Still open in the URL but already gone from the list (optimistic UI).
      // Keep the last known order; the URL change will follow.
    }

    if (pending) {
      const { from, at } = pending;
      const sameFolder = location.pathname.replace(/\/+$/, "") === from.base.replace(/\/+$/, "");
      if (Date.now() - at > WAIT_FOR_REMOVAL_MS || !sameFolder || openId) {
        pending = null; // user went elsewhere, or opened something themselves
      } else if (ids.length && !ids.includes(from.id)) {
        pending = null;
        const target = pickTarget(from, ids);
        if (target) open(target, from.base);
      }
    }
  }

  setInterval(tick, TICK_MS);
})();
