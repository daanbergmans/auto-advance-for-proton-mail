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
  const AWAIT_OPEN_MS = 2500;
  const FALLBACK_MS = 500;

  let settings = { direction: "next", debug: false };
  let lastOpen = null; // { id, order: string[], base: string } — email seen open
  let pending = null; // { from, at } — an email closed; waiting to see if it left the list
  let awaiting = null; // { id, order, base, at } — an email we asked Proton to open

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

  const samePath = (a, b) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

  function pickTarget(from, ids) {
    const present = new Set(ids);
    const i = from.order.indexOf(from.id);
    if (i === -1) return null;
    const below = from.order.slice(i + 1);
    const above = from.order.slice(0, i).reverse();
    const [first, second] = settings.direction === "previous" ? [above, below] : [below, above];
    return first.find((id) => present.has(id)) || second.find((id) => present.has(id)) || null;
  }

  function open(id, from, ids) {
    const row = rows().find((el) => el.getAttribute("data-element-id") === id);
    if (!row) return;
    log("opening", id);
    // Remember the neighbour order as it is now, so that if this email is
    // deleted before we ever see it open (very fast clicking), we can still
    // work out what comes after it.
    const order = from.order.filter((x) => x === id || ids.includes(x));
    awaiting = { id, order, base: from.base, at: Date.now() };
    row.click();

    // Fallback in case Proton ignores the synthetic click: navigate via the router.
    // Only if this email is still the one we're waiting for and nothing has
    // happened since — never reopen an email the user already dealt with.
    setTimeout(() => {
      if (!awaiting || awaiting.id !== id) return;
      if (segments().includes(id) || !listIds().includes(id)) return;
      if (!samePath(location.pathname, from.base)) return;
      log("click didn't open it, using URL fallback");
      history.pushState(history.state, "", `${from.base}/${encodeURIComponent(id)}${location.search}`);
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    }, FALLBACK_MS);
  }

  function tick() {
    const ids = listIds();
    const segs = segments();
    const openId = segs.find((s) => ids.includes(s)) || null;
    const now = Date.now();

    // The previously open email is no longer in the URL: it was closed.
    if (lastOpen && !segs.includes(lastOpen.id) && openId !== lastOpen.id) {
      if (!openId) {
        pending = { from: lastOpen, at: now };
        log("closed", lastOpen.id);
      }
      lastOpen = null;
    }

    if (awaiting) {
      if (openId === awaiting.id) {
        awaiting = null; // it opened normally; tracked via lastOpen from here
      } else if (openId) {
        awaiting = null; // user opened something else themselves
      } else if (ids.length && !ids.includes(awaiting.id) && samePath(location.pathname, awaiting.base)) {
        // The email we opened was removed before we caught it being open
        // (two deletes in quick succession). Treat it as closed and removed.
        log("removed before seen open", awaiting.id);
        pending = { from: awaiting, at: now };
        awaiting = null;
      } else if (now - awaiting.at > AWAIT_OPEN_MS) {
        awaiting = null;
      }
    }

    if (openId) {
      lastOpen = { id: openId, order: ids, base: basePathFor(openId) };
      pending = null;
    }

    if (pending) {
      const { from, at } = pending;
      if (now - at > WAIT_FOR_REMOVAL_MS || !samePath(location.pathname, from.base) || openId) {
        pending = null; // user went elsewhere, or opened something themselves
      } else if (ids.length && !ids.includes(from.id)) {
        pending = null;
        const target = pickTarget(from, ids);
        if (target) open(target, from, ids);
      }
    }
  }

  // Run on a timer, and also right away whenever the page changes, so fast
  // clicks between two timer ticks aren't missed.
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      tick();
    }, 0);
  };
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("popstate", schedule);
  setInterval(tick, TICK_MS);
})();