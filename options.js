const defaults = { direction: "next", debug: false };

browser.storage.local.get(defaults).then((s) => {
  document.querySelector(`input[value="${s.direction}"]`).checked = true;
  document.getElementById("debug").checked = s.debug;
});

document.querySelectorAll('input[name="direction"]').forEach((el) =>
  el.addEventListener("change", () => browser.storage.local.set({ direction: el.value }))
);

document.getElementById("debug").addEventListener("change", (e) =>
  browser.storage.local.set({ debug: e.target.checked })
);
