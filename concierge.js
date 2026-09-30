/* ==========================================================================
   JK Concierge — AI chat widget
   Floating button + chat panel. Posts {message, history} to the backend.

   BACKEND WIRING: set BACKEND_URL below to the live chat API (see CONCIERGE.md).
   While BACKEND_URL is "" the widget runs in graceful-fallback mode and
   routes visitors to /contact instead of failing.
   ========================================================================== */
const CONCIERGE_CONFIG = {
  // >>> BACKEND URL — point at the live concierge API when deployed. <<<
  // Planned production value: "https://crm.goatleads.com/concierge/chat"
  // (requires the concierge-server backend running + firewall/nginx exposure —
  //  see CONCIERGE.md). Leave "" until then; the widget degrades gracefully.
  BACKEND_URL: "https://concierge-production-6641.up.railway.app/chat",
  HISTORY_LIMIT: 10,          // turns of history sent to the backend
  REQUEST_TIMEOUT_MS: 30000,  // backend request timeout
  CONTACT_URL: "/contact#book",    // deep-link: lands on the booking calendar
};

(function () {
  "use strict";
  var CFG = CONCIERGE_CONFIG;

  var GREETING =
    "I'm Jeromy's concierge. Ask me how he scales lead gen, what working " +
    "together looks like, or whether you're a fit — straight answers, no pitch.";

  var STARTERS = [
    "What does Jeromy actually do?",
    "Am I a fit to work with him?",
    "How do I get my free funnel teardown?",
  ];

  var FALLBACK_HTML =
    "Looks like I'm offline right now — the human way still works. " +
    "Grab a free funnel teardown: Jeromy maps exactly where your funnel is " +
    "leaking on a 30-minute call.";

  /* ---------- DOM ---------- */
  var root = document.createElement("div");
  root.id = "jk-concierge";
  root.setAttribute("aria-label", "Concierge chat");
  root.innerHTML =
    '<button class="cc-fab" aria-label="Open concierge chat" aria-expanded="false">' +
      '<svg class="cc-fab-chat" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      '<svg class="cc-fab-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    "</button>" +
    '<div class="cc-panel" role="dialog" aria-label="Concierge chat panel" aria-hidden="true">' +
      '<div class="cc-header">' +
        '<span class="cc-live">Concierge</span>' +
        '<h3>Ask about working <span class="cc-accent-word">with Jeromy</span></h3>' +
        "<p>Proof, process, fit — answered straight.</p>" +
      "</div>" +
      '<div class="cc-messages" aria-live="polite"></div>' +
      '<div class="cc-starters"></div>' +
      '<div class="cc-inputrow">' +
        '<textarea class="cc-input" rows="1" placeholder="Ask a question…" aria-label="Type your message"></textarea>' +
        '<button class="cc-send" aria-label="Send message">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>' +
        "</button>" +
      "</div>" +
      '<p class="cc-disclaimer">AI assistant — answers come from jeromykovatana.com</p>' +
    "</div>";
  document.body.appendChild(root);

  var fab = root.querySelector(".cc-fab");
  var panel = root.querySelector(".cc-panel");
  var messagesEl = root.querySelector(".cc-messages");
  var startersEl = root.querySelector(".cc-starters");
  var inputEl = root.querySelector(".cc-input");
  var sendBtn = root.querySelector(".cc-send");

  var history = []; // [{role: 'user'|'assistant', content}]
  var opened = false;
  var busy = false;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function scrollDown() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, html, cls) {
    var div = document.createElement("div");
    div.className = "cc-msg cc-msg--" + role + (cls ? " " + cls : "");
    div.innerHTML = html;
    messagesEl.appendChild(div);
    scrollDown();
    return div;
  }

  function addText(role, text) {
    // minimal linkification for bare URLs and /contact-style paths (with optional #fragment)
    var safe = esc(text).replace(
      /(https?:\/\/[^\s<]+|\/contact(?:#[a-zA-Z0-9_-]+)?|\/free-playbook|\/services|\/about)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    return addMessage(role, safe);
  }

  function showTyping() {
    var div = document.createElement("div");
    div.className = "cc-msg cc-msg--assistant";
    div.id = "cc-typing";
    div.innerHTML = '<span class="cc-typing"><span></span><span></span><span></span></span>';
    messagesEl.appendChild(div);
    scrollDown();
  }
  function hideTyping() {
    var t = document.getElementById("cc-typing");
    if (t) t.remove();
  }

  function showFallback() {
    var div = addMessage("assistant", esc(FALLBACK_HTML), "cc-msg--fallback");
    var a = document.createElement("a");
    a.className = "cc-cta";
    a.href = CFG.CONTACT_URL;
    a.textContent = "Get your free funnel teardown →";
    div.appendChild(document.createElement("br"));
    div.appendChild(a);
    scrollDown();
  }

  function renderStarters() {
    startersEl.innerHTML = "";
    STARTERS.forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cc-chip";
      b.textContent = q;
      b.addEventListener("click", function () { send(q); });
      startersEl.appendChild(b);
    });
  }

  /* ---------- open / close ---------- */
  // openerText: optional first assistant line (used by proactive teasers).
  function toggle(force, openerText) {
    var open = typeof force === "boolean" ? force : !root.classList.contains("cc-open");
    if (open) dismissTeaser();
    root.classList.toggle("cc-open", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    fab.setAttribute("aria-label", open ? "Close concierge chat" : "Open concierge chat");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open && !opened) {
      opened = true;
      var first = openerText || GREETING;
      addText("assistant", first);
      renderStarters();
      history.push({ role: "assistant", content: first });
    }
    if (open) setTimeout(function () { inputEl.focus({ preventScroll: true }); }, 250);
  }
  fab.addEventListener("click", function () { toggle(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.classList.contains("cc-open")) toggle(false);
  });

  /* ---------- send ---------- */
  function postToBackend(message) {
    var payload = {
      message: message,
      history: history.slice(-CFG.HISTORY_LIMIT),
    };
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.REQUEST_TIMEOUT_MS);
    return fetch(CFG.BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error("bad status " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data.reply !== "string") throw new Error("bad payload");
        return data;
      });
  }

  function send(text) {
    var message = (text || "").trim();
    if (!message || busy) return;
    if (message.length > 2000) message = message.slice(0, 2000);

    // Decline right after a booking CTA -> the capture card goes up once the
    // concierge replies (it says the "Jeromy will text you" line itself).
    if (lastHadCTA && !captureShown && isDecline(message)) pendingCapture = true;

    busy = true;
    sendBtn.disabled = true;

    addText("user", message);
    history.push({ role: "user", content: message });
    startersEl.innerHTML = "";

    if (!CFG.BACKEND_URL) {
      // Backend not wired up yet — graceful fallback, no doomed fetch.
      setTimeout(function () {
        showFallback();
        history.push({ role: "assistant", content: FALLBACK_HTML });
        busy = false;
        sendBtn.disabled = false;
        pendingCapture = false;
      }, 600);
      return;
    }

    showTyping();
    postToBackend(message).then(
      function (data) {
        hideTyping();
        lastHadCTA = !!(data.cta && data.cta.url);
        var div = addText("assistant", data.reply);
        if (data.cta && data.cta.url && data.cta.label) {
          var a = document.createElement("a");
          a.className = "cc-cta";
          a.href = data.cta.url;
          a.textContent = data.cta.label;
          if (/^https?:\/\//.test(data.cta.url)) {
            a.target = "_blank";
            a.rel = "noopener";
          }
          div.appendChild(document.createElement("br"));
          div.appendChild(a);
          scrollDown();
        }
        history.push({ role: "assistant", content: data.reply });
        busy = false;
        sendBtn.disabled = false;
        if (pendingCapture) {
          pendingCapture = false;
          if (LEAD_URL && !captureShown) renderCaptureCard();
        }
      },
      function () {
        hideTyping();
        pendingCapture = false;
        showFallback();
        history.push({ role: "assistant", content: FALLBACK_HTML });
        busy = false;
        sendBtn.disabled = false;
      }
    );
  }

  sendBtn.addEventListener("click", function () {
    send(inputEl.value);
    inputEl.value = "";
    inputEl.style.height = "auto";
  });
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(inputEl.value);
      inputEl.value = "";
      inputEl.style.height = "auto";
    }
  });
  // auto-grow
  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + "px";
  });

  /* ================= proactive teasers =================
     Dismissible one-line openers. Teaser bubble only, never the full panel.
     Kind "35s": fires once per session after ~35s with zero interaction.
     Kind "calc": fired by window.JeromyConcierge.calculatorDone(results) when the
     homepage funnel calculator has a complete set of numbers.                */
  var TEASER_35S_TEXT = "Quick question. Are you buying leads right now, running your own ads, or a bit of both?";
  var TEASER_CALC_TEXT = "Those numbers have room. Want me to show you where it's leaking?";

  var teaserEl = null;
  var pendingCalc = null;

  /* Booking-section guard: while the #book section (calendar embed) is in the
     viewport, the teaser bubble stays hidden so it can't cover the calendar
     on mobile. A suppressed teaser may only appear after the section scrolls
     out of view; nothing else about teaser copy, timing, or triggers changes. */
  var bookSectionVisible = false;
  var calculatorSectionVisible = false;
  var mobileTeaserMedia = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

  function calculatorGuardActive() {
    return calculatorSectionVisible && mobileTeaserMedia && mobileTeaserMedia.matches;
  }

  function refreshTeaserGuard() {
    root.classList.toggle('cc-calculator-visible', !!calculatorGuardActive());
    if (bookSectionVisible || calculatorGuardActive()) dismissTeaser();
    else if (!maybeShowCalcTeaser()) maybeShowIdleTeaser();
  }

  function armBookSectionGuard() {
    var book = document.getElementById('book');
    if (!book || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      var visible = entries.some(function (e) { return e.isIntersecting; });
      bookSectionVisible = visible;
      refreshTeaserGuard();
    }, { threshold: 0.15 });
    io.observe(book);
  }
  armBookSectionGuard();

  // On mobile, defer both proactive teasers until the calculator leaves view.
  // Keep the manual launcher available and preserve the pending diagnosis.
  var calculatorSection = document.getElementById('calculator');
  if (calculatorSection && 'IntersectionObserver' in window) {
    var calculatorIO = new IntersectionObserver(function (entries) {
      calculatorSectionVisible = entries.some(function (e) { return e.isIntersecting; });
      refreshTeaserGuard();
    }, { threshold: 0 });
    calculatorIO.observe(calculatorSection);
  }
  if (mobileTeaserMedia) {
    if (mobileTeaserMedia.addEventListener) mobileTeaserMedia.addEventListener('change', refreshTeaserGuard);
    else if (mobileTeaserMedia.addListener) mobileTeaserMedia.addListener(refreshTeaserGuard);
  }

  function teaserSeen(kind) {
    try { return sessionStorage.getItem("jk_teaser_" + kind) === "1"; }
    catch (e) { return false; }
  }
  function markTeaserSeen(kind) {
    try { sessionStorage.setItem("jk_teaser_" + kind, "1"); } catch (e) {}
  }

  function dismissTeaser() {
    if (teaserEl) { teaserEl.remove(); teaserEl = null; }
  }

  // Opens the panel with the teaser line as the first assistant message.
  // autoUserMsg: optional visitor message to send immediately (calculator numbers).
  function openWithOpener(openerText, autoUserMsg) {
    dismissTeaser();
    var wasOpened = opened;
    if (!root.classList.contains("cc-open")) toggle(true, openerText);
    if (wasOpened && openerText) {
      addText("assistant", openerText);
      history.push({ role: "assistant", content: openerText });
    }
    if (autoUserMsg) send(autoUserMsg);
  }

  function showTeaser(text, kind, onActivate) {
    if (bookSectionVisible || calculatorGuardActive()) return false;
    if (teaserEl) return false;
    if (root.classList.contains("cc-open")) return false;
    if (teaserSeen(kind)) return false;
    teaserEl = document.createElement("div");
    teaserEl.className = "cc-teaser";
    teaserEl.setAttribute("role", "button");
    teaserEl.setAttribute("tabindex", "0");
    teaserEl.setAttribute("aria-label", "Open concierge chat");
    var msg = document.createElement("span");
    msg.className = "cc-teaser__text";
    msg.textContent = text;
    var x = document.createElement("button");
    x.type = "button";
    x.className = "cc-teaser__close";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "×";
    x.addEventListener("click", function (e) { e.stopPropagation(); dismissTeaser(); });
    teaserEl.appendChild(msg);
    teaserEl.appendChild(x);
    teaserEl.addEventListener("click", function () { onActivate(); });
    teaserEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(); }
    });
    root.appendChild(teaserEl);
    markTeaserSeen(kind);
    return true;
  }

  // Idle teaser: one shot per session, only if the visitor never engaged.
  // If the tab is hidden at fire time, retry once after 15s. If the booking
  // section is on screen at fire time, hold until it scrolls out of view.
  var idleTeaserDue = false;

  function maybeShowIdleTeaser() {
    if (!idleTeaserDue || bookSectionVisible || calculatorGuardActive()) return;
    showTeaser(TEASER_35S_TEXT, '35s', function () {
      openWithOpener(TEASER_35S_TEXT);
    });
  }

  setTimeout(function armIdleTeaser() {
    if (document.hidden) { setTimeout(armIdleTeaser, 15000); return; }
    idleTeaserDue = true;
    maybeShowIdleTeaser();
  }, 35000);

  function summarizeCalc(r) {
    var parts = [];
    function num(n) { return Number(n).toLocaleString("en-US"); }
    if (r.funnel === "1call") parts.push("1-call funnel");
    else if (r.funnel === "2call") parts.push("2-call funnel");
    if (r.leads != null) parts.push(num(r.leads) + " leads/week");
    if (r.pickups != null) parts.push(num(r.pickups) + " pickups");
    if (r.booked != null) parts.push(num(r.booked) + " booked");
    if (r.showed != null) parts.push(num(r.showed) + " showed");
    if (r.closes != null) parts.push(num(r.closes) + " closes");
    if (r.spend != null) parts.push("$" + num(r.spend) + "/week spend");
    if (r.premium != null) parts.push("$" + num(r.premium) + " avg premium");
    return parts.join(", ");
  }

  // Public hook for the homepage funnel calculator (redesign.js).
  // Also listens for a "jk:calculator-done" CustomEvent carrying the same payload.
  window.JeromyConcierge = window.JeromyConcierge || {};
  function maybeShowCalcTeaser() {
    if (!pendingCalc) return false;
    return showTeaser(TEASER_CALC_TEXT, "calc", function () {
      openWithOpener(
        TEASER_CALC_TEXT,
        "I just ran the funnel calculator. My numbers: " + summarizeCalc(pendingCalc || {}) + "."
      );
    });
  }
  window.JeromyConcierge.calculatorDone = function (results) {
    if (!results || results.leads == null) return;
    pendingCalc = results;
    if (root.classList.contains("cc-open")) return; // already talking, don't interrupt
    dismissTeaser(); // calculator intent outranks the idle teaser
    maybeShowCalcTeaser();
  };
  window.addEventListener("jk:calculator-done", function (e) {
    if (e && e.detail) window.JeromyConcierge.calculatorDone(e.detail);
  });

  /* ================= non-booker capture =================
     When the visitor declines the booking CTA, the concierge says the
     "Jeromy will text you himself" line and this card collects name +
     phone/email. Stored server-side (POST /lead) for Jeromy to follow up
     himself. NO auto-outreach, ever. Shows once per conversation.        */
  var LEAD_URL = CFG.BACKEND_URL ? CFG.BACKEND_URL.replace(/\/chat$/, "/lead") : "";
  var lastHadCTA = false;
  var captureShown = false;
  var pendingCapture = false;

  var DECLINE_EXACT_RE = /^(no|nah|nope)\.?$/i;
  var DECLINE_PHRASE_RE = /\b(no thanks|not interested|not right now|maybe later|i'?m good|i'?m all set|not yet|\bpass\b)/i;

  function isDecline(message) {
    var m = String(message || "").trim();
    return DECLINE_EXACT_RE.test(m) || DECLINE_PHRASE_RE.test(m);
  }

  function renderCaptureCard() {
    captureShown = true;
    var wrap = document.createElement("div");
    wrap.className = "cc-msg cc-msg--assistant cc-capture";
    wrap.innerHTML =
      '<div class="cc-capture__title">Jeromy will text you himself.</div>' +
      '<input class="cc-input cc-capture__field" data-capture="name" placeholder="Your name" autocomplete="name" maxlength="100">' +
      '<input class="cc-input cc-capture__field" data-capture="contact" placeholder="Cell or email" autocomplete="tel" maxlength="120">' +
      '<button type="button" class="cc-cta cc-capture__btn">Text me</button>' +
      '<div class="cc-capture__note">No drip sequence. No spam.</div>' +
      '<div class="cc-capture__err" role="alert"></div>';
    messagesEl.appendChild(wrap);
    scrollDown();
    var nameEl = wrap.querySelector('[data-capture="name"]');
    var contactEl = wrap.querySelector('[data-capture="contact"]');
    var btn = wrap.querySelector(".cc-capture__btn");
    var err = wrap.querySelector(".cc-capture__err");
    if (nameEl) nameEl.focus({ preventScroll: true });
    btn.addEventListener("click", function () {
      var name = (nameEl.value || "").trim();
      var contact = (contactEl.value || "").trim();
      err.textContent = "";
      if (!name) { err.textContent = "What's your name?"; nameEl.focus(); return; }
      if (!contact || contact.replace(/\D/g, "").length < 7 && contact.indexOf("@") < 0) {
        err.textContent = "Drop a cell number or email.";
        contactEl.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "Sending...";
      // "What they wanted": the visitor's recent messages, truncated. No extra form fields.
      var context = history
        .filter(function (t) { return t.role === "user"; })
        .slice(-4)
        .map(function (t) { return String(t.content).slice(0, 200); });
      fetch(LEAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, contact: contact, context: context })
      }).then(function (res) {
        if (!res.ok) throw new Error("bad status " + res.status);
        return res.json();
      }).then(function (data) {
        if (!data || !data.ok) throw new Error("bad payload");
        wrap.innerHTML = '<div class="cc-capture__title">Got it. Jeromy will text you himself.</div>';
        history.push({ role: "user", content: "[Visitor left contact info for Jeromy to text them.]" });
        scrollDown();
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = "Text me";
        err.textContent = "Didn't go through. Try again?";
      });
    });
  }
})();
