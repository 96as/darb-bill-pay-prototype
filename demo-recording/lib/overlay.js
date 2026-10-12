// Injected into every page while recording (Playwright addInitScript; no app change):
// - hides the prototype-only Demo button;
// - draws a visible cursor that follows the real mouse and a ripple on every click.
// Plain JS on purpose: functions compiled by tsx can't be sent to the browser.
// Everything is drawn with CSSOM so strict-CSP pages (the payment confirmation) still show it.
(function () {
  const opts = window.__DEMO_OVERLAY_OPTS || { mobile: false };
  const w = window;
  if (w.__demoOverlay) return;
  w.__demoOverlay = true;

  const size = opts.mobile ? 44 : 22;
  let x = -100;
  let y = -100;

  const cursor = document.createElement("div");
  cursor.setAttribute("data-demo-overlay", "cursor");
  Object.assign(cursor.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    width: `${size}px`,
    height: `${size}px`,
    marginLeft: `${-size / 2}px`,
    marginTop: `${-size / 2}px`,
    borderRadius: "50%",
    background: opts.mobile ? "rgba(30, 30, 30, 0.28)" : "rgba(17, 24, 39, 0.82)",
    border: opts.mobile ? "2px solid rgba(255,255,255,0.85)" : "2.5px solid #ffffff",
    boxShadow: "0 1px 6px rgba(0,0,0,0.35)",
    pointerEvents: "none",
    zIndex: "2147483647",
    transform: "translate(-100px, -100px)",
    transition: "width 120ms, height 120ms",
  });

  const hide = () => {
    for (const label of ["Demo controls", "أدوات العرض التجريبي"]) {
      document.querySelectorAll(`[aria-label="${label}"]`).forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
    }
  };

  const place = () => {
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };

  const ripple = (cx, cy) => {
    const r = document.createElement("div");
    r.setAttribute("data-demo-overlay", "ripple");
    const d = opts.mobile ? 70 : 46;
    Object.assign(r.style, {
      position: "fixed",
      left: `${cx - d / 2}px`,
      top: `${cy - d / 2}px`,
      width: `${d}px`,
      height: `${d}px`,
      borderRadius: "50%",
      border: "3px solid rgba(37, 99, 235, 0.9)",
      background: "rgba(37, 99, 235, 0.18)",
      pointerEvents: "none",
      zIndex: "2147483646",
      opacity: "1",
      transform: "scale(0.3)",
      transition: "transform 450ms ease-out, opacity 450ms ease-out",
    });
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => {
      r.style.transform = "scale(1.4)";
      r.style.opacity = "0";
    });
    setTimeout(() => r.remove(), 600);
  };

  const ensure = () => {
    if (!cursor.isConnected && document.documentElement) document.documentElement.appendChild(cursor);
    hide();
  };

  document.addEventListener("mousemove", (e) => {
    x = e.clientX;
    y = e.clientY;
    place();
  }, true);
  document.addEventListener("mousedown", (e) => {
    cursor.style.width = `${size * 0.8}px`;
    cursor.style.height = `${size * 0.8}px`;
    ripple(e.clientX, e.clientY);
  }, true);
  document.addEventListener("mouseup", () => {
    cursor.style.width = `${size}px`;
    cursor.style.height = `${size}px`;
  }, true);

  // A stylesheet hides the button from the first paint (React 19 tolerates extra nodes in <head>).
  const addStyle = () => {
    const s = document.createElement("style");
    s.setAttribute("data-demo-overlay", "style");
    s.textContent = '[aria-label="Demo controls"],[aria-label="أدوات العرض التجريبي"]{display:none!important}';
    (document.head ?? document.documentElement).appendChild(s);
  };
  if (document.head) addStyle();
  else document.addEventListener("DOMContentLoaded", addStyle);

  // The cursor is added after hydration (and re-added if React replaces the tree), never during it.
  const start = () => {
    ensure();
    setInterval(ensure, 250);
    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
