/* redesign.js — Homepage redesign interactions: live ticker, funnel calculator, scroll annotations. */
(function () {
  'use strict';

  /* ── Scroll fade-in ── */
  var fadeEls = document.querySelectorAll('.rd-fade');
  if (fadeEls.length && 'IntersectionObserver' in window) {
    var fadeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); fadeIO.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    fadeEls.forEach(function (el) { fadeIO.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ── Hand-drawn scribbles draw themselves on scroll ── */
  var scribbles = document.querySelectorAll('.scribble');
  if (scribbles.length && 'IntersectionObserver' in window) {
    var drawIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('drawn'); drawIO.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    scribbles.forEach(function (el) { drawIO.observe(el); });
  } else {
    scribbles.forEach(function (el) { el.classList.add('drawn'); });
  }

  /* ═══════════════════════════════════════════════════
     LIVE LEADS TICKER
     Real feed: https://crm.goatleads.com/ticker.js (no CORS on the
     .json endpoint, so we load via <script> — it sets
     window.__GOAT_TICKER__ = {unique_leads, total_leads,
     leads_per_minute, updated_at}). Fallback: pace simulation.
     ═══════════════════════════════════════════════════ */
  var TICKER_URL = 'https://crm.goatleads.com/ticker.js';
  var FALLBACK_BASE = 1625819;
  var FALLBACK_PER_MIN = 7.1;
  var REFRESH_MS = 2 * 60 * 1000;
  var LOAD_TIMEOUT_MS = 5000;

  var numEl = document.getElementById('rd-ticker-number');
  var liveLabelEl = document.getElementById('rd-ticker-live-label');
  var subEl = document.getElementById('rd-ticker-sub');

  if (numEl) {
    var shown = FALLBACK_BASE;      // float, what we render
    var ratePerSec = FALLBACK_PER_MIN / 60;
    var live = false;               // true once real payload lands
    var lastFrame = null;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function fmt(n) {
      return Math.floor(n).toLocaleString('en-US');
    }
    function render() {
      numEl.innerHTML = fmt(shown) + '<span class="rd-tick-plus">+</span>';
    }
    function setLabel(isLive, perMin) {
      if (!liveLabelEl) return;
      if (isLive) {
        liveLabelEl.innerHTML = '<span class="dot"></span>Live from the GOAT Leads platform';
        if (subEl) subEl.textContent = 'Unique consumer leads, updating every 2 minutes · currently +' + perMin.toFixed(1) + '/min';
      } else {
        liveLabelEl.innerHTML = '<span class="dot"></span>Pace simulation';
        if (subEl) subEl.textContent = 'Illustrative pace based on trailing volume — connect to the live feed for the real number.';
      }
    }
    function tick(now) {
      if (lastFrame !== null) {
        var dt = Math.min((now - lastFrame) / 1000, 5);
        shown += ratePerSec * dt;
      }
      lastFrame = now;
      render();
      requestAnimationFrame(tick);
    }

    function applyPayload(p) {
      if (!p || typeof p.unique_leads !== 'number') return;
      var targetRate = (typeof p.leads_per_minute === 'number' && p.leads_per_minute >= 0)
        ? p.leads_per_minute / 60 : ratePerSec;
      // Ease toward the new rate so the counter never jumps.
      ratePerSec = ratePerSec + (targetRate - ratePerSec) * 0.35;
      // Snap to the authoritative count if we're meaningfully behind; never go backward.
      if (p.unique_leads > shown) shown = p.unique_leads;
      if (!live) { live = true; setLabel(true, p.leads_per_minute || FALLBACK_PER_MIN); }
      else if (subEl) subEl.textContent = 'Unique consumer leads, updating every 2 minutes · currently +' + (p.leads_per_minute || 0).toFixed(1) + '/min';
    }

    function loadTicker() {
      var done = false;
      var s = document.createElement('script');
      s.async = true;
      s.src = TICKER_URL + '?t=' + Date.now();
      var timer = setTimeout(function () {
        if (!done) { done = true; s.remove(); if (!live) setLabel(false); }
      }, LOAD_TIMEOUT_MS);
      s.onload = function () {
        clearTimeout(timer);
        if (done) return;
        done = true;
        try { applyPayload(window.__GOAT_TICKER__); } catch (e) {}
        if (!live) setLabel(false);
        window.__GOAT_TICKER__ = undefined;
      };
      s.onerror = function () {
        clearTimeout(timer);
        if (!done) { done = true; if (!live) setLabel(false); }
      };
      document.head.appendChild(s);
    }

    setLabel(false);
    render();
    if (!reduced) requestAnimationFrame(tick); else render();
    loadTicker();
    setInterval(loadTicker, REFRESH_MS);
  }

  /* ═══════════════════════════════════════════════════
     FUNNEL CALCULATOR v3 — weekly counts in, math out.
     1-call: leads → pickups → closes
     2-call: leads → pickups → booked → showed → closes
     Derives stage rates on the arrows. NO CPL anywhere.
     ═══════════════════════════════════════════════════ */
  var calc = document.getElementById('rd-calc');
  if (!calc) return;

  var STAGES_1CALL = ['leads', 'pickups', 'closes'];
  var STAGES_2CALL = ['leads', 'pickups', 'booked', 'showed', 'closes'];
  var STAGE_LABELS = {
    leads: 'Weekly leads', pickups: 'Pickups', booked: 'Booked',
    showed: 'Showed', closes: 'Closes', spend: 'Weekly lead spend', premium: 'Avg premium'
  };

  var state = {
    funnel: '1call',          // '1call' | '2call'
    biz: 'insurance',         // 'insurance' | 'other'
    leadType: null,
    vals: { leads: null, spend: null, pickups: null, booked: null, showed: null, closes: null, premium: null }
  };

  // Fires window.JeromyConcierge.calculatorDone(results) once per page view when the
  // visitor has a complete diagnosis set (leads + spend + closes, no errors).
  // The concierge widget listens and opens with a diagnosis-style teaser.
  var calcHookFired = false;

  // Build funnel DOM
  var funnelEl = document.getElementById('rd-funnel');
  var emptyEl = document.getElementById('rd-calc-empty');
  var resultsEl = document.getElementById('rd-results');
  var msgEl = document.getElementById('rd-calc-msg');

  function stageInputs() {
    return state.funnel === '1call' ? STAGES_1CALL : STAGES_2CALL;
  }

  function buildFunnel() {
    var stages = stageInputs();
    funnelEl.innerHTML = '';
    stages.forEach(function (key, i) {
      var node = document.createElement('div');
      node.className = 'rd-fnode';
      node.dataset.stage = key;
      var label = key === 'leads' ? 'Weekly leads in' : STAGE_LABELS[key];
      node.innerHTML =
        '<div><div class="rd-fnode__name">' + label + '</div>' +
        '<div class="rd-fnode__hint">raw weekly count</div></div>' +
        '<input type="number" min="0" inputmode="numeric" data-field="' + key + '" placeholder="0" aria-label="' + label + '">' +
        '<span class="rd-field-error" data-error-for="' + key + '"></span>';
      funnelEl.appendChild(node);
      if (i < stages.length - 1) {
        var arrow = document.createElement('div');
        arrow.className = 'rd-farrow';
        arrow.innerHTML = '<span class="line"></span><span class="rate is-empty" data-rate="' + key + '→' + stages[i + 1] + '">—</span><span class="line"></span>';
        funnelEl.appendChild(arrow);
      }
    });
    // spend + premium rows live outside the funnel flow but feed the math
    funnelEl.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var v = inp.value === '' ? null : Math.max(0, parseFloat(inp.value));
        state.vals[inp.dataset.field] = (v === null || isNaN(v)) ? null : v;
        recalc();
      });
    });
    recalc();
  }

  // Spend & premium inputs (outside funnel)
  document.querySelectorAll('#rd-calc [data-field="spend"], #rd-calc [data-field="premium"]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      var v = inp.value === '' ? null : Math.max(0, parseFloat(inp.value));
      state.vals[inp.dataset.field] = (v === null || isNaN(v)) ? null : v;
      recalc();
    });
  });

  // Toggles
  calc.querySelectorAll('[data-funnel-toggle] button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.funnel = btn.dataset.funnelToggle;
      calc.querySelectorAll('[data-funnel-toggle] button').forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      buildFunnel();
    });
  });
  calc.querySelectorAll('[data-biz-toggle] button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.biz = btn.dataset.bizToggle;
      calc.querySelectorAll('[data-biz-toggle] button').forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      var pills = document.getElementById('rd-lead-pills');
      if (pills) pills.style.display = state.biz === 'insurance' ? '' : 'none';
      updateBizWords();
      recalc();
    });
  });
  // Lead-type pills (label only — premium stays manual)
  var pillsEl = document.getElementById('rd-lead-pills');
  if (pillsEl) {
    pillsEl.querySelectorAll('.rd-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        var on = pill.getAttribute('aria-pressed') === 'true';
        pillsEl.querySelectorAll('.rd-pill').forEach(function (p) { p.setAttribute('aria-pressed', 'false'); });
        pill.setAttribute('aria-pressed', on ? 'false' : 'true');
        state.leadType = on ? null : pill.dataset.leadType;
      });
    });
  }

  function updateBizWords() {
    var isIns = state.biz === 'insurance';
    document.querySelectorAll('[data-word-premium]').forEach(function (el) {
      el.textContent = isIns ? 'premium' : 'revenue';
    });
    document.querySelectorAll('[data-word-policies]').forEach(function (el) {
      el.textContent = isIns ? 'policies' : 'customers';
    });
  }

  function money(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    return (n * 100).toFixed(1) + '%';
  }

  function recalc() {
    var stages = stageInputs();
    var v = state.vals;
    var errors = {}; // stage -> message

    // Impossible downstream counts: each stage must be <= the previous entered stage.
    var prevKey = null, prevVal = null;
    stages.forEach(function (key) {
      var cur = v[key];
      if (cur !== null && prevVal !== null && cur > prevVal) {
        errors[key] = STAGE_LABELS[key] + " can't exceed " + STAGE_LABELS[prevKey].toLowerCase() + ' (' + prevVal.toLocaleString('en-US') + ').';
      }
      if (cur !== null) { prevKey = key; prevVal = cur; }
    });

    // Render errors inline
    funnelEl.querySelectorAll('.rd-fnode').forEach(function (node) {
      var key = node.dataset.stage;
      var errEl = node.querySelector('.rd-field-error');
      if (errors[key]) {
        node.classList.add('has-error');
        errEl.textContent = '⚠ ' + errors[key];
        errEl.classList.add('show');
      } else {
        node.classList.remove('has-error');
        errEl.classList.remove('show');
      }
    });

    // Stage rates on arrows
    funnelEl.querySelectorAll('.rate').forEach(function (rateEl) {
      var parts = rateEl.dataset.rate.split('→');
      var a = v[parts[0]], b = v[parts[1]];
      if (a !== null && a > 0 && b !== null && !errors[parts[1]]) {
        rateEl.textContent = pct(b / a);
        rateEl.classList.remove('is-empty');
      } else {
        rateEl.textContent = '—';
        rateEl.classList.add('is-empty');
      }
    });

    // Derived results — NO CPL. Cost per policy, weekly premium volume, overall conversion.
    var closes = v.closes, spend = v.spend, premium = v.premium, leads = v.leads;
    var out = [];
    if (closes !== null && closes > 0 && spend !== null) {
      out.push({ label: 'Cost per ' + (state.biz === 'insurance' ? 'policy' : 'customer'), value: money(spend / closes) });
    }
    if (closes !== null && premium !== null) {
      out.push({ label: 'Weekly ' + (state.biz === 'insurance' ? 'premium' : 'revenue'), value: money(closes * premium) });
    }
    if (leads !== null && leads > 0 && closes !== null && !errors.closes) {
      out.push({ label: 'Lead → close rate', value: pct(closes / leads) });
    }

    resultsEl.innerHTML = '';
    out.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'rd-result';
      d.innerHTML = '<div class="rd-result__label">' + r.label + '</div><div class="rd-result__value">' + r.value + '</div>';
      resultsEl.appendChild(d);
    });

    // Empty state vs. revealed math
    var entered = stages.filter(function (k) { return v[k] !== null; }).length;
    var hasErrors = Object.keys(errors).length > 0;
    if (entered === 0) {
      emptyEl.style.display = '';
      emptyEl.textContent = 'Enter your weekly counts to reveal your funnel math.';
      resultsEl.style.display = 'none';
      if (msgEl) msgEl.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      resultsEl.style.display = '';
      if (msgEl) {
        msgEl.style.display = '';
        msgEl.querySelector('p').textContent = hasErrors
          ? 'One of those counts breaks the laws of physics — fix the flagged field and the math updates live.'
          : "You gave us counts. Here's the math you didn't know.";
      }
    }

    // Concierge hook: complete diagnosis set -> let the widget open the teardown.
    if (!calcHookFired && v.leads != null && v.leads > 0 &&
        v.spend != null && v.spend > 0 && v.closes != null && !hasErrors) {
      calcHookFired = true;
      var hookResults = {
        funnel: state.funnel, biz: state.biz, leadType: state.leadType,
        leads: v.leads, pickups: v.pickups, booked: v.booked,
        showed: v.showed, closes: v.closes, spend: v.spend, premium: v.premium
      };
      if (window.JeromyConcierge && typeof window.JeromyConcierge.calculatorDone === 'function') {
        window.JeromyConcierge.calculatorDone(hookResults);
      } else {
        window.dispatchEvent(new CustomEvent('jk:calculator-done', { detail: hookResults }));
      }
    }

    updateBizWords();
  }

  buildFunnel();
  updateBizWords();
})();
