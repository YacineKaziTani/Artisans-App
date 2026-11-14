// Runs before the app renders (a plain script in <head>, so no flash of the
// wrong theme). Kept outside index.html so the CSP can stay free of inline
// scripts. Mirrors src/lib/theme.ts.
(function () {
  var mode = "system";
  try {
    mode = localStorage.getItem("theme") || "system";
  } catch (e) {}
  var dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
})();
