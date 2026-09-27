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
  BACKEND_URL: "",
  HISTORY_LIMIT: 10,          // turns of history sent to the backend
  REQUEST_TIMEOUT_MS: 30000,  // backend request timeout
  CONTACT_URL: "/contact",    // fallback destination
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
    "How do I book a strategy call?",
  ];

  var FALLBACK_HTML =
    "Looks like I'm offline right now — the human way still works. " +
    "Book a free strategy call and Jeromy will get back to you within 24 hours.";

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
    // minimal linkification for bare URLs and /contact-style paths
    var safe = esc(text).replace(
      /(https?:\/\/[^\s<]+|\/contact|\/free-playbook|\/services|\/about)/g,
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
    a.textContent = "Book a strategy call →";
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
  function toggle(force) {
    var open = typeof force === "boolean" ? force : !root.classList.contains("cc-open");
    root.classList.toggle("cc-open", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    fab.setAttribute("aria-label", open ? "Close concierge chat" : "Open concierge chat");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open && !opened) {
      opened = true;
      addText("assistant", GREETING);
      renderStarters();
      history.push({ role: "assistant", content: GREETING });
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
      }, 600);
      return;
    }

    showTyping();
    postToBackend(message).then(
      function (data) {
        hideTyping();
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
      },
      function () {
        hideTyping();
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
})();
