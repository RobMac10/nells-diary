/* Nell’s Diary interactive exercise book. No tracking. Answers stay on this device. */
(function () {
  "use strict";

  const D = window.NELLS_DIARY;
  if (!D) return;

  const STORE = "nells-diary-app-v1";
  const TAGS = { seen: "Seen it myself", heard: "Heard it", unsure: "Not sure" };
  const $ = (id) => document.getElementById(id);

  const state = { page: 0, easy: false, answers: {}, evidence: {} };
  let flipping = false;
  let evPid = null;
  let noteId = null;
  let swipeX = null;
  let swipeY = null;

  function desktop() {
    return window.matchMedia("(min-width: 900px)").matches;
  }
  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function maxPage() {
    return D.pages.length - 1;
  }
  function spreadStart(i) {
    if (!desktop()) return i;
    return i % 2 === 0 ? i : i - 1;
  }
  function leavesOf(i) {
    const start = spreadStart(i);
    const list = [start];
    if (desktop() && start + 1 <= maxPage()) list.push(start + 1);
    return list;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        state.easy = !!data.easy;
        state.answers = data.answers && typeof data.answers === "object" ? data.answers : {};
        state.evidence = data.evidence && typeof data.evidence === "object" ? data.evidence : {};
      }
    } catch (err) {
      /* storage may be blocked; the book still works */
    }
  }
  function save() {
    try {
      localStorage.setItem(
        STORE,
        JSON.stringify({ easy: state.easy, answers: state.answers, evidence: state.evidence })
      );
    } catch (err) { /* ignore quota / private mode */ }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function linkify(text) {
    return escapeHtml(text).replace(/https?:\/\/[^\s)<]+/g, function (m) {
      const href = m.replace(/[.,;:]+$/, "");
      return '<a href="' + href + '">' + href + "</a>" + m.slice(href.length);
    });
  }
  function plainRuns(runs) {
    return runs.map(function (r) { return r.t === "spell" ? r.wrong : r.t; }).join("");
  }
  function entryById(id) {
    return D.entries.find(function (e) { return e.id === id; });
  }
  function noteById(id) {
    return D.notes.find(function (n) { return n.id === id; });
  }
  function paraById(pid) {
    for (let i = 0; i < D.entries.length; i++) {
      const e = D.entries[i];
      for (let j = 0; j < e.paras.length; j++) {
        if (e.paras[j].id === pid) return { entry: e, para: e.paras[j] };
      }
    }
    return null;
  }
  function pageIndexForPara(pid) {
    const found = paraById(pid);
    if (!found) return 0;
    const idx = found.entry.paras.findIndex(function (p) { return p.id === pid; });
    for (let i = 0; i < D.pages.length; i++) {
      const p = D.pages[i];
      if (p.type === "diary" && p.entry === found.entry.id && idx >= p.from && idx <= p.to) return i;
    }
    return 0;
  }
  function pageIndexForNote(nid) {
    const n = noteById(nid);
    return n ? pageIndexForPara(n.para) : 0;
  }

  function renderRuns(runs) {
    return runs.map(function (r) {
      if (r.t === "spell") {
        return (
          '<button type="button" class="spell-btn" data-wrong="' + escapeHtml(r.wrong) +
          '" data-right="' + escapeHtml(r.right) +
          '" aria-label="Spelling correction: Nell wrote ' + escapeHtml(r.wrong) +
          ', Mrs Hayes wrote ' + escapeHtml(r.right) + '">' + escapeHtml(r.wrong) + "</button>"
        );
      }
      return escapeHtml(r.t);
    }).join("");
  }

  function renderCover() {
    return (
      '<article class="exhibit-cover">' +
        '<p class="cover-kicker">' + escapeHtml(D.exhibit) + "</p>" +
        "<h2>" + escapeHtml(D.title) + "</h2>" +
        '<p class="cover-sub">' + escapeHtml(D.sub) + "</p>" +
        '<p class="cover-strap">' + escapeHtml(D.strap) + "</p>" +
        '<hr class="cover-rule">' +
        '<p class="cover-school">' + escapeHtml(D.school) + "</p>" +
        '<figure class="cover-print">' +
          '<button type="button" class="cover-zoom" aria-haspopup="dialog" aria-controls="chapel-lightbox" ' +
            'aria-label="Magnify the chapel sketch">' +
            '<img src="assets/chapel-school.jpg" width="1610" height="814" alt="' + escapeHtml(D.chapelAlt) + '">' +
          "</button>" +
          "<figcaption>" + escapeHtml(D.chapelCaption) + ". Tap to magnify.</figcaption>" +
        "</figure>" +
      "</article>"
    );
  }

  function renderFlyleaf() {
    return (
      '<img class="blot blot-1" src="assets/blot-1.png" alt="" aria-hidden="true">' +
      '<img class="blot blot-2" src="assets/blot-2.png" alt="" aria-hidden="true">' +
      '<img class="blot blot-3" src="assets/blot-3.png" alt="" aria-hidden="true">' +
      '<header class="name-block">' +
        '<p class="nm">Nell Byrne</p>' +
        '<p class="school">' + escapeHtml(D.school) + "</p>" +
        "<p>Eureka lead, Ballarat</p>" +
        "<p>1854</p>" +
      "</header>"
    );
  }

  function renderDiary(page) {
    const e = entryById(page.entry);
    let html = "";
    if (page.heading) {
      html += '<p class="place">' + escapeHtml(e.place) + "</p>";
      html += '<h3 class="date">' + escapeHtml(e.date) + "</h3>";
      if (e.classLabel) html += '<p class="class-label">' + escapeHtml(e.classLabel) + "</p>";
    }
    for (let i = page.from; i <= page.to; i++) {
      const para = e.paras[i];
      const tag = state.evidence[para.id] || "";
      const last = page.last && i === page.to;
      html += '<div class="line"' + (tag ? ' data-tag="' + tag + '"' : "") + ">";
      html += '<div class="margin">';
      if (para.note) {
        html +=
          '<button type="button" class="hayes-mark" data-note="' + para.note.id +
          '" aria-haspopup="dialog" aria-label="Mrs Hayes wrote a note. Open it.">AH</button>';
      }
      html +=
        '<button type="button" class="ev-mark" data-para="' + para.id +
        (tag ? '" data-tag="' + tag : "") +
        '" aria-haspopup="dialog" aria-label="Mark this line as evidence"></button>';
      html += "</div>";
      html += "<p" + (last ? ' class="breakoff"' : "") + ">" + renderRuns(para.runs);
      if (last) html += ' <span class="smudge" role="img" aria-label="An ink smudge where the writing breaks off."></span>';
      html += "</p></div>";
    }
    if (page.last) {
      html +=
        '<div class="end-wrap">' +
          '<p class="endline">' + escapeHtml(D.end) + "</p>" +
          '<p><a class="cta" href="' + escapeHtml(D.caseUrl) + '">' + escapeHtml(D.cta) + "</a></p>" +
        "</div>";
    }
    return html;
  }

  function renderPage(index, side) {
    const page = D.pages[index];
    const leaf = document.createElement("article");
    leaf.className = "leaf " + side;
    leaf.setAttribute("aria-label", pageLabel(index));
    if (!page || page.type === "cover") {
      leaf.classList.add("cover-leaf");
      leaf.innerHTML = renderCover();
    } else {
      leaf.classList.add("lined");
      leaf.innerHTML = page.type === "flyleaf" ? renderFlyleaf() : renderDiary(page);
    }
    return leaf;
  }

  function pageLabel(index) {
    const p = D.pages[index];
    if (!p) return "Page";
    if (p.type === "cover") return "Cover";
    if (p.type === "flyleaf") return "Flyleaf, Nell Byrne’s book";
    const e = entryById(p.entry);
    return e.date + (p.heading ? "" : ", continued");
  }

  function renderSpread() {
    const spread = $("spread");
    const indices = leavesOf(state.page);
    spread.innerHTML = "";
    spread.classList.toggle("single", indices.length === 1);
    if (indices.length === 1) {
      spread.appendChild(renderPage(indices[0], "only"));
    } else {
      spread.appendChild(renderPage(indices[0], "left"));
      spread.appendChild(renderPage(indices[1], "right"));
    }
    bindLeafEvents(spread);
    updateChrome();
  }

  function bindLeafEvents(root) {
    root.querySelectorAll(".cover-zoom").forEach(function (btn) {
      btn.addEventListener("click", openLightbox);
    });
    root.querySelectorAll(".hayes-mark").forEach(function (btn) {
      btn.addEventListener("click", function () { openNote(btn.getAttribute("data-note")); });
    });
    root.querySelectorAll(".spell-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openSpell(btn.getAttribute("data-wrong"), btn.getAttribute("data-right"));
      });
    });
    root.querySelectorAll(".ev-mark").forEach(function (btn) {
      btn.addEventListener("click", function () { openEvidence(btn.getAttribute("data-para")); });
    });
  }

  function updateChrome() {
    const start = spreadStart(state.page);
    const end = leavesOf(state.page).slice(-1)[0];
    const total = D.pages.length;
    const status = $("status");
    if (start === end) status.textContent = "Page " + (start + 1) + " of " + total;
    else status.textContent = "Pages " + (start + 1) + "–" + (end + 1) + " of " + total;
    $("prev").disabled = start <= 0;
    $("next").disabled = end >= maxPage();
    const n = Object.keys(state.answers).filter(function (k) { return (state.answers[k] || "").trim(); }).length
      + Object.keys(state.evidence).length;
    const badge = $("nb-count");
    badge.hidden = n === 0;
    badge.textContent = String(n);
    applyEasy();
  }

  function applyEasy() {
    document.body.classList.toggle("easy-read", state.easy);
    const box = $("easy-read");
    box.checked = state.easy;
    box.setAttribute("aria-checked", state.easy ? "true" : "false");
    box.parentElement.querySelector(".easy-state").textContent = state.easy ? "On" : "Off";
  }

  function flipTo(next, dir) {
    next = Math.max(0, Math.min(maxPage(), next));
    if (desktop()) next = spreadStart(next);
    if (next === spreadStart(state.page) || flipping) return;
    if (reduced() || !dir) {
      state.page = next;
      renderSpread();
      return;
    }
    flipping = true;
    const stage = $("stage");
    const ghost = $("spread").cloneNode(true);
    ghost.id = "";
    ghost.classList.add("ghost-spread");
    if ($("spread").classList.contains("single")) ghost.classList.add("single");
    stage.appendChild(ghost);
    state.page = next;
    renderSpread();
    ghost.getBoundingClientRect();
    ghost.classList.add(dir > 0 ? "fly-next" : "fly-prev");
    window.setTimeout(function () {
      ghost.remove();
      flipping = false;
    }, 600);
  }

  function go(dir) {
    const step = desktop() ? 2 : 1;
    flipTo(spreadStart(state.page) + dir * step, dir);
  }

  /* Notes, spellings, evidence */
  function openNote(id) {
    const n = noteById(id);
    if (!n) return;
    noteId = id;
    $("hayes-title").textContent = n.text;
    $("hayes-answer").value = state.answers[id] || "";
    $("hayes-dialog").showModal();
    $("hayes-answer").focus();
  }
  function closeNote() {
    $("hayes-dialog").close();
    noteId = null;
  }
  function saveNote() {
    if (!noteId) return;
    const val = $("hayes-answer").value.trim();
    if (val) state.answers[noteId] = $("hayes-answer").value;
    else delete state.answers[noteId];
    save();
    updateChrome();
    renderNotebook();
    closeNote();
  }
  function openSpell(wrong, right) {
    $("spell-wrong").textContent = wrong;
    $("spell-right").textContent = right;
    $("spell-dialog").showModal();
    $("spell-close").focus();
  }
  function openEvidence(pid) {
    const found = paraById(pid);
    if (!found) return;
    evPid = pid;
    $("ev-quote").textContent = plainRuns(found.para.runs);
    const current = state.evidence[pid] || "";
    document.querySelectorAll('input[name="ev-tag"]').forEach(function (r) {
      r.checked = r.value === current;
    });
    $("evidence-dialog").showModal();
  }
  function saveEvidence() {
    if (!evPid) return;
    const picked = document.querySelector('input[name="ev-tag"]:checked');
    if (picked) state.evidence[evPid] = picked.value;
    save();
    $("evidence-dialog").close();
    evPid = null;
    renderSpread();
    renderNotebook();
  }
  function removeEvidence() {
    if (!evPid) return;
    delete state.evidence[evPid];
    save();
    $("evidence-dialog").close();
    evPid = null;
    renderSpread();
    renderNotebook();
  }

  /* Detective's notebook */
  function notebookOpen() { return !$("notebook").hidden; }
  function setNotebook(open) {
    $("notebook").hidden = !open;
    $("open-notebook").setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("notebook-open", open);
    if (open) {
      renderNotebook();
      $("close-notebook").focus();
    }
  }
  function renderNotebook() {
    const answers = $("nb-answers");
    answers.innerHTML = D.notes.map(function (n) {
      const ans = state.answers[n.id];
      return (
        '<article class="nb-card">' +
          '<p class="meta">' + escapeHtml(n.date) + "</p>" +
          '<p class="q">' + escapeHtml(n.text) + "</p>" +
          (ans
            ? '<p class="ans">' + escapeHtml(ans) + "</p>"
            : '<p class="empty">Not yet answered.</p>') +
        "</article>"
      );
    }).join("");
    const ev = $("nb-evidence");
    const items = Object.keys(state.evidence);
    if (!items.length) {
      ev.innerHTML = '<p class="empty">No lines marked yet. Use the mark beside a line: Seen it myself, Heard it, or Not sure.</p>';
      return;
    }
    ev.innerHTML = items.map(function (pid) {
      const found = paraById(pid);
      if (!found) return "";
      const tag = state.evidence[pid];
      return (
        '<article class="nb-card">' +
          '<p class="meta">' + escapeHtml(found.entry.date) + "</p>" +
          '<p class="ans">' + escapeHtml(plainRuns(found.para.runs)) + "</p>" +
          '<p><span class="tag ' + tag + '">' + escapeHtml(TAGS[tag] || tag) + "</span></p>" +
        "</article>"
      );
    }).join("");
  }
  function notebookText() {
    const lines = ["Detective’s notebook — Nell’s Diary", "Saved on this device only.", ""];
    lines.push("Mrs Hayes’s questions");
    D.notes.forEach(function (n) {
      lines.push("");
      lines.push(n.date);
      lines.push(n.text);
      lines.push(state.answers[n.id] ? state.answers[n.id] : "(not yet answered)");
    });
    lines.push("");
    lines.push("Evidence I’ve marked");
    const items = Object.keys(state.evidence);
    if (!items.length) lines.push("(no lines marked yet)");
    items.forEach(function (pid) {
      const found = paraById(pid);
      if (!found) return;
      lines.push("");
      lines.push(found.entry.date);
      lines.push(plainRuns(found.para.runs));
      lines.push(TAGS[state.evidence[pid]] || state.evidence[pid]);
    });
    return lines.join("\n");
  }
  function copyNotebook() {
    const text = notebookText();
    const done = function () {
      $("copy-notebook").textContent = "Copied";
      window.setTimeout(function () { $("copy-notebook").textContent = "Copy"; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
    } else fallbackCopy();
    function fallbackCopy() {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      ta.remove();
      done();
    }
  }
  function printNotebook() {
    document.body.classList.add("printing-notes");
    $("notebook").hidden = false;
    window.print();
    window.setTimeout(function () {
      document.body.classList.remove("printing-notes");
      if (!notebookOpen()) $("notebook").hidden = true;
    }, 300);
  }
  function clearNotebook() {
    if (!window.confirm("Clear the answers and evidence marks saved on this device?")) return;
    state.answers = {};
    state.evidence = {};
    save();
    renderSpread();
    renderNotebook();
    updateChrome();
  }

  /* Lightbox, same pattern as Who Fired First? */
  function openLightbox() {
    const box = $("chapel-lightbox");
    $("chapel-lightbox-title").textContent = D.chapelAlt;
    box.querySelector("img").alt = D.chapelAlt;
    box.hidden = false;
    document.body.classList.add("lightbox-open");
    box.querySelector(".lightbox-close").focus();
  }
  function closeLightbox() {
    const box = $("chapel-lightbox");
    box.hidden = true;
    box.classList.remove("is-zoomed");
    document.body.classList.remove("lightbox-open");
  }

  function renderTeacher() {
    const body = $("teacher-body");
    let html = '<p class="note">This note is for teachers. It is not part of the student-facing diary, which is written to look authentic.</p>';
    D.teacher.forEach(function (block) {
      html += "<p><strong>" + escapeHtml(block.head) + "</strong> " + linkify(block.body) + "</p>";
    });
    html += '<p class="reveal">' + escapeHtml(D.reveal) + "</p>";
    html += '<p class="note">' + escapeHtml(D.easyRead) + "</p>";
    body.innerHTML = html;
  }

  /* Swipe and keys */
  function onPointerDown(ev) {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    if (ev.target.closest("button, a, textarea, input, summary, dialog")) return;
    swipeX = ev.clientX;
    swipeY = ev.clientY;
  }
  function onPointerUp(ev) {
    if (swipeX == null) return;
    const dx = ev.clientX - swipeX;
    const dy = ev.clientY - swipeY;
    swipeX = swipeY = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) go(1);
    else go(-1);
  }
  function onKey(ev) {
    const inField = ev.target && (ev.target.tagName === "TEXTAREA" || ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT");
    if (ev.key === "Escape") {
      if (!$("chapel-lightbox").hidden) { closeLightbox(); ev.preventDefault(); return; }
      if (notebookOpen() && !document.querySelector("dialog[open]")) { setNotebook(false); ev.preventDefault(); return; }
    }
    if (inField || document.querySelector("dialog[open]") || !$("chapel-lightbox").hidden) return;
    if (ev.key === "ArrowRight" || ev.key === "PageDown") { ev.preventDefault(); go(1); }
    else if (ev.key === "ArrowLeft" || ev.key === "PageUp") { ev.preventDefault(); go(-1); }
    else if (ev.key === "Home") { ev.preventDefault(); flipTo(0, -1); }
    else if (ev.key === "End") { ev.preventDefault(); flipTo(maxPage(), 1); }
  }

  function bind() {
    $("prev").addEventListener("click", function () { go(-1); });
    $("next").addEventListener("click", function () { go(1); });
    $("easy-read").addEventListener("change", function () {
      state.easy = $("easy-read").checked;
      save();
      applyEasy();
    });
    $("open-notebook").addEventListener("click", function () { setNotebook(true); });
    $("close-notebook").addEventListener("click", function () { setNotebook(false); });
    $("print-notebook").addEventListener("click", printNotebook);
    $("copy-notebook").addEventListener("click", copyNotebook);
    $("clear-notebook").addEventListener("click", clearNotebook);
    $("hayes-save").addEventListener("click", saveNote);
    $("hayes-close").addEventListener("click", closeNote);
    $("spell-close").addEventListener("click", function () { $("spell-dialog").close(); });
    $("ev-save").addEventListener("click", saveEvidence);
    $("ev-remove").addEventListener("click", removeEvidence);
    $("ev-close").addEventListener("click", function () { $("evidence-dialog").close(); evPid = null; });
    $("chapel-lightbox").querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    $("chapel-lightbox").addEventListener("click", function (ev) {
      if (ev.target.id === "chapel-lightbox") closeLightbox();
    });
    $("chapel-lightbox").querySelector("img").addEventListener("click", function (ev) {
      ev.stopPropagation();
      $("chapel-lightbox").classList.toggle("is-zoomed");
    });
    document.addEventListener("keydown", onKey);
    const stage = $("stage");
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", function () { swipeX = swipeY = null; });
    document.addEventListener("click", function (ev) {
      if (notebookOpen() && ev.target === document.body) setNotebook(false);
    });
    window.addEventListener("resize", function () {
      const snapped = spreadStart(state.page);
      if (snapped !== state.page) {
        state.page = snapped;
      }
      renderSpread();
    });
  }

  function applyQuery() {
    const q = new URLSearchParams(location.search);
    const shot = q.get("shot");
    if (q.get("page")) {
      const n = parseInt(q.get("page"), 10);
      if (!isNaN(n)) state.page = Math.max(0, Math.min(maxPage(), n));
    }
    if (shot === "cover") state.page = 0;
    if (shot === "note" || q.get("note")) {
      const nid = q.get("note") || "e0n3";
      state.page = pageIndexForNote(nid);
      window.setTimeout(function () { openNote(nid); }, 80);
    }
    if (shot === "notebook" || q.get("notebook") === "1") {
      state.page = state.page || pageIndexForNote("e0n3");
      window.setTimeout(function () { setNotebook(true); }, 80);
    }
    if (shot === "mobile") {
      if (!q.get("page")) state.page = 2;
    }
  }

  function appBase() {
    var path = location.pathname;
    if (path.endsWith("/")) return new URL(path, location.origin);
    if (/\.[a-zA-Z0-9]+$/.test(path)) return new URL(path.replace(/[^/]+$/, ""), location.origin);
    return new URL(path + "/", location.origin);
  }
  function registerSw() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    if (/[?&]shot=/.test(location.search)) return;
    var base = appBase();
    navigator.serviceWorker.register(new URL("sw.js", base).href, { scope: base.href }).catch(function () {});
  }

  load();
  renderTeacher();
  bind();
  applyQuery();
  renderSpread();
  registerSw();
})();
