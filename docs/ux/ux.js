// Shared top bar for the UX revamp mockups: page links + theme tabs.
// Theme comes from ?theme=, then localStorage, then "arena". Links carry the theme along.
(function () {
  const PAGES = [
    ["index.html", "Findings"],
    ["setup-revamp.html", "Setup"],
    ["duel-revamp.html", "Duel"],
    ["cards-revamp.html", "Card viewer"],
  ];
  const THEMES = [
    ["arena", "A · Arena"],
    ["holo", "B · Holo"],
    ["clean", "C · Clean"],
  ];

  const here = location.pathname.split("/").pop() || "index.html";
  let theme = new URLSearchParams(location.search).get("theme");
  if (!theme)
    try {
      theme = localStorage.getItem("ygo-ux-theme");
    } catch {
      // storage can be blocked; the theme still works for this page
    }
  if (!THEMES.some(([t]) => t === theme)) theme = "arena";

  const bar = document.createElement("div");
  bar.className = "topbar";
  bar.innerHTML =
    "<b>UX revamp</b>" +
    PAGES.map(
      ([href, label]) =>
        `<a href="${href}" data-page${href === here ? ' aria-current="page"' : ""}>${label}</a>`,
    ).join("") +
    '<span class="sep"></span>' +
    THEMES.map(
      ([t, label]) => `<button class="tab" data-t="${t}">${label}</button>`,
    ).join("") +
    '<span id="topbar-extra" style="margin-left:auto;display:flex;gap:8px"></span>';
  document.body.prepend(bar);

  function set(t) {
    document.body.dataset.theme = t;
    bar
      .querySelectorAll(".tab")
      .forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === t));
    bar
      .querySelectorAll("a[data-page]")
      .forEach(
        (a) => (a.href = a.getAttribute("href").split("?")[0] + "?theme=" + t),
      );
    try {
      localStorage.setItem("ygo-ux-theme", t);
    } catch {
      // storage can be blocked; the theme still works for this page
    }
    document.dispatchEvent(new CustomEvent("ux-theme", { detail: t }));
  }
  bar
    .querySelectorAll(".tab")
    .forEach((b) => (b.onclick = () => set(b.dataset.t)));
  set(theme);
  window.uxSetTheme = set;
})();
