/* ============================================================
   Vitae — app logic
   All data stays in this browser (localStorage). No servers.
   ============================================================ */
"use strict";

const STORE_KEY = "vitae_data_v1";
/* migrate data saved under the old app name, if any */
if (!localStorage.getItem(STORE_KEY) && localStorage.getItem("folio_data_v1")) {
  localStorage.setItem(STORE_KEY, localStorage.getItem("folio_data_v1"));
}

/* ---------- State ---------- */
const blankState = () => ({
  basics: { fullName: "", headline: "", email: "", phone: "", location: "", link: "", summary: "", photo: "" },
  education: [], courses: [], activities: [], volunteering: [], projects: [],
  skills: [], languages: [], interests: []
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return blankState();
    return Object.assign(blankState(), JSON.parse(raw));
  } catch { return blankState(); }
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  updateProgress();
  renderCV();
}

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMonth(v) {
  if (!v) return "";
  const [y, m] = v.split("-");
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
}
function fmtRange(start, end) {
  const s = fmtMonth(start), e = fmtMonth(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `${s} – Present`;
  return e || "";
}

/* ---------- Section definitions ---------- */
const SECTIONS = [
  {
    key: "education", title: "Education", hint: "Schools, high school profile, university",
    addLabel: "Add education",
    fields: [
      { key: "institution", label: "School / institution", type: "text", placeholder: "e.g. Colegiul Național ..." , required: true },
      { key: "degree", label: "Programme / specialisation", type: "text", placeholder: "e.g. Mathematics–Informatics" },
      { key: "start", label: "From", type: "month" },
      { key: "end", label: "To (leave empty if ongoing)", type: "month" },
      { key: "details", label: "Highlights (results, olympiads, favourite subjects…)", type: "textarea", span2: true }
    ],
    main: e => e.institution, sub: e => [e.degree, fmtRange(e.start, e.end)].filter(Boolean).join(" · ")
  },
  {
    key: "activities", title: "Activities & Experience", hint: "School clubs, theatre plays, competitions, jobs, internships",
    addLabel: "Add activity",
    fields: [
      { key: "title", label: "Role / activity", type: "text", placeholder: "e.g. Actor — school theatre play", required: true },
      { key: "org", label: "Organisation / place", type: "text", placeholder: "e.g. School drama club" },
      { key: "start", label: "From", type: "month" },
      { key: "end", label: "To (leave empty if ongoing)", type: "month" },
      { key: "details", label: "What you did and what you're proud of", type: "textarea", span2: true, placeholder: "e.g. Played the lead role in \"...\"; rehearsed weekly for 3 months; performed for 200+ people." }
    ],
    main: e => e.title, sub: e => [e.org, fmtRange(e.start, e.end)].filter(Boolean).join(" · ")
  },
  {
    key: "volunteering", title: "Volunteering", hint: "Community work, charity events, helping out",
    addLabel: "Add volunteering",
    fields: [
      { key: "title", label: "Role", type: "text", placeholder: "e.g. Volunteer", required: true },
      { key: "org", label: "Organisation / cause", type: "text", placeholder: "e.g. Red Cross local branch" },
      { key: "start", label: "From", type: "month" },
      { key: "end", label: "To (leave empty if ongoing)", type: "month" },
      { key: "details", label: "What you did and the impact", type: "textarea", span2: true }
    ],
    main: e => e.title, sub: e => [e.org, fmtRange(e.start, e.end)].filter(Boolean).join(" · ")
  },
  {
    key: "courses", title: "Courses & Certifications", hint: "Trainings, workshops, online courses, diplomas",
    addLabel: "Add course",
    fields: [
      { key: "title", label: "Course / certification", type: "text", placeholder: "e.g. First Aid Certificate", required: true },
      { key: "org", label: "Provider", type: "text", placeholder: "e.g. Crucea Roșie / Coursera" },
      { key: "end", label: "When", type: "month" },
      { key: "details", label: "What you learned", type: "textarea", span2: true }
    ],
    main: e => e.title, sub: e => [e.org, fmtMonth(e.end)].filter(Boolean).join(" · ")
  },
  {
    key: "projects", title: "Projects & Creations", hint: "Paintings, exhibitions, school projects, anything you made",
    addLabel: "Add project",
    fields: [
      { key: "title", label: "Project", type: "text", placeholder: "e.g. Watercolour series \"Seasons\"", required: true },
      { key: "end", label: "When", type: "month" },
      { key: "link", label: "Link (optional)", type: "url", placeholder: "https://..." },
      { key: "details", label: "Describe it", type: "textarea", span2: true }
    ],
    main: e => e.title, sub: e => [fmtMonth(e.end), e.link].filter(Boolean).join(" · ")
  }
];

const CHIP_SECTIONS = [
  { key: "skills", title: "Skills", hint: "e.g. Public speaking, Photoshop, teamwork, drawing", placeholder: "Type a skill and press Add" },
  { key: "languages", title: "Languages", hint: "Add the level too, e.g. English — B2", placeholder: "e.g. English — B2" },
  { key: "interests", title: "Passions & Interests", hint: "e.g. Painting, theatre, reading, baking", placeholder: "Type a passion and press Add" }
];

/* ---------- Render: My Story ---------- */
function renderSections() {
  const host = $("#sectionsHost");
  let html = "";

  for (const sec of SECTIONS) {
    const entries = state[sec.key];
    html += `<div class="card section-card" data-section="${sec.key}">
      <div class="card-head"><h2>${sec.title}</h2><span class="card-hint">${sec.hint}</span></div>
      <div class="entries">`;
    if (!entries.length) {
      html += `<div class="empty-note">Nothing here yet — add your first one whenever you're ready.</div>`;
    } else {
      for (const e of entries) {
        html += `<div class="entry">
          <div class="entry-main">
            <b>${esc(sec.main(e))}</b>
            <div class="entry-sub">${esc(sec.sub(e))}</div>
            ${e.details ? `<div class="entry-details">${esc(e.details)}</div>` : ""}
          </div>
          <div class="entry-actions">
            <button class="icon-btn" data-edit="${e.id}" aria-label="Edit">✎</button>
            <button class="icon-btn" data-del="${e.id}" aria-label="Delete">🗑</button>
          </div>
        </div>`;
      }
    }
    html += `</div><button class="btn small" data-add="${sec.key}">＋ ${sec.addLabel}</button></div>`;
  }

  for (const sec of CHIP_SECTIONS) {
    const items = state[sec.key];
    html += `<div class="card" data-chips="${sec.key}">
      <div class="card-head"><h2>${sec.title}</h2><span class="card-hint">${sec.hint}</span></div>
      <div class="chips">${items.map((v, i) =>
        `<span class="chip">${esc(v)}<button data-chipdel="${i}" aria-label="Remove ${esc(v)}">✕</button></span>`).join("") ||
        `<span class="empty-note">Nothing yet.</span>`}</div>
      <div class="chip-input">
        <input type="text" placeholder="${sec.placeholder}" data-chipinput="${sec.key}">
        <button class="btn small" data-chipadd="${sec.key}">Add</button>
      </div>
    </div>`;
  }

  host.innerHTML = html;
}

/* Event delegation for story sections */
$("#sectionsHost").addEventListener("click", (ev) => {
  const t = ev.target;
  const card = t.closest("[data-section]");
  if (t.dataset.add) return openModal(t.dataset.add);
  if (card && t.dataset.edit) return openModal(card.dataset.section, t.dataset.edit);
  if (card && t.dataset.del) {
    const sec = card.dataset.section;
    if (confirm("Delete this entry?")) {
      state[sec] = state[sec].filter(e => e.id !== t.dataset.del);
      saveState(); renderSections(); toast("Entry deleted");
    }
    return;
  }
  const chipCard = t.closest("[data-chips]");
  if (chipCard && t.dataset.chipadd !== undefined && t.dataset.chipadd) return addChip(t.dataset.chipadd);
  if (chipCard && t.dataset.chipdel !== undefined) {
    const key = chipCard.dataset.chips;
    state[key].splice(+t.dataset.chipdel, 1);
    saveState(); renderSections();
  }
});
$("#sectionsHost").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && ev.target.dataset.chipinput) {
    ev.preventDefault();
    addChip(ev.target.dataset.chipinput);
  }
});
function addChip(key) {
  const input = document.querySelector(`[data-chipinput="${key}"]`);
  const v = input.value.trim();
  if (!v) return;
  if (!state[key].includes(v)) state[key].push(v);
  input.value = "";
  saveState(); renderSections();
  document.querySelector(`[data-chipinput="${key}"]`)?.focus();
}

/* ---------- Basics ---------- */
function fillBasicsForm() {
  for (const k of ["fullName","headline","email","phone","location","link","summary"]) {
    const el = $("#f_" + k); if (el) el.value = state.basics[k] || "";
  }
}
$("#saveBasics").addEventListener("click", () => {
  for (const k of ["fullName","headline","email","phone","location","link","summary"]) {
    state.basics[k] = $("#f_" + k).value.trim();
  }
  saveState();
  $("#basicsSaved").textContent = "Saved ✓";
  setTimeout(() => $("#basicsSaved").textContent = "", 2000);
});

/* ---------- Photo (compressed and stored locally) ---------- */
function refreshPhotoUI() {
  const has = !!state.basics.photo;
  $("#photoPreview").classList.toggle("hidden", !has);
  $("#photoRemove").classList.toggle("hidden", !has);
  if (has) $("#photoPreview").src = state.basics.photo;
}
$("#photoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const MAX = 320;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    state.basics.photo = c.toDataURL("image/jpeg", 0.85);
    URL.revokeObjectURL(img.src);
    saveState(); refreshPhotoUI(); toast("Photo added ✓");
  };
  img.onerror = () => toast("Couldn't read that image — try another one");
  img.src = URL.createObjectURL(file);
  e.target.value = "";
});
$("#photoRemove").addEventListener("click", () => {
  state.basics.photo = "";
  saveState(); refreshPhotoUI(); toast("Photo removed");
});

/* ---------- Modal (add / edit entries) ---------- */
let modalCtx = null;

function openModal(sectionKey, entryId = null) {
  const sec = SECTIONS.find(s => s.key === sectionKey);
  if (!sec) return;
  const entry = entryId ? state[sectionKey].find(e => e.id === entryId) : null;
  modalCtx = { sectionKey, entryId };

  $("#modalTitle").textContent = (entry ? "Edit — " : "Add — ") + sec.title;
  $("#modalBody").innerHTML = `<div class="form-grid">` + sec.fields.map(f => {
    const val = esc(entry ? entry[f.key] || "" : "");
    const span = f.span2 ? " class=\"span2\"" : "";
    if (f.type === "textarea")
      return `<label${span}>${f.label}<textarea rows="4" data-field="${f.key}" placeholder="${esc(f.placeholder || "")}">${val}</textarea></label>`;
    return `<label${span}>${f.label}<input type="${f.type}" data-field="${f.key}" value="${val}" placeholder="${esc(f.placeholder || "")}"></label>`;
  }).join("") + `</div>`;

  $("#modalBackdrop").classList.remove("hidden");
  $("#modalBody").querySelector("input,textarea")?.focus();
}
function closeModal() { $("#modalBackdrop").classList.add("hidden"); modalCtx = null; }

$("#modalClose").addEventListener("click", closeModal);
$("#modalCancel").addEventListener("click", closeModal);
$("#modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

$("#modalSave").addEventListener("click", () => {
  if (!modalCtx) return;
  const sec = SECTIONS.find(s => s.key === modalCtx.sectionKey);
  const values = {};
  $("#modalBody").querySelectorAll("[data-field]").forEach(el => values[el.dataset.field] = el.value.trim());
  const required = sec.fields.find(f => f.required);
  if (required && !values[required.key]) { toast(`Please fill in "${required.label}"`); return; }

  if (modalCtx.entryId) {
    const e = state[modalCtx.sectionKey].find(x => x.id === modalCtx.entryId);
    Object.assign(e, values);
    toast("Entry updated");
  } else {
    state[modalCtx.sectionKey].push(Object.assign({ id: uid() }, values));
    toast("Added to your story ✨");
  }
  saveState(); renderSections(); closeModal();
});

/* ---------- Progress ---------- */
function updateProgress() {
  const checks = [
    !!state.basics.fullName, !!state.basics.summary,
    state.education.length > 0, state.activities.length > 0,
    state.volunteering.length > 0, state.courses.length > 0,
    state.projects.length > 0, state.skills.length >= 3,
    state.languages.length > 0, state.interests.length > 0
  ];
  const pct = Math.round(checks.filter(Boolean).length / checks.length * 100);
  $("#progressFill").style.width = pct + "%";
  $("#progressText").textContent = pct >= 100 ? "Your story: 100% told — beautiful! 🎉" : `Your story: ${pct}% told`;
}

/* ---------- CV rendering ---------- */
function cvItems(list, mapFn) {
  return list.map(mapFn).join("");
}
function cvSection(title, inner) {
  return inner ? `<div class="cv-section"><div class="cv-section-title">${title}</div>${inner}</div>` : "";
}
function cvEntry(title, org, date, details, link) {
  return `<div class="cv-item">
    <div class="cv-item-head">
      <span><span class="cv-item-title">${esc(title)}</span>${org ? ` <span class="cv-item-org">· ${esc(org)}</span>` : ""}</span>
      ${date ? `<span class="cv-item-date">${esc(date)}</span>` : ""}
    </div>
    ${details ? `<div class="cv-item-details">${esc(details)}</div>` : ""}
    ${link ? `<div class="cv-item-details">${esc(link)}</div>` : ""}
  </div>`;
}

function cvBlocks() {
  const b = state.basics;
  return {
    education: cvSection("Education", cvItems(state.education, e =>
      cvEntry(e.institution, e.degree, fmtRange(e.start, e.end), e.details))),
    activities: cvSection("Experience & Activities", cvItems(state.activities, e =>
      cvEntry(e.title, e.org, fmtRange(e.start, e.end), e.details))),
    volunteering: cvSection("Volunteering", cvItems(state.volunteering, e =>
      cvEntry(e.title, e.org, fmtRange(e.start, e.end), e.details))),
    projects: cvSection("Projects", cvItems(state.projects, e =>
      cvEntry(e.title, "", fmtMonth(e.end), e.details, e.link))),
    courses: cvSection("Courses & Certifications", cvItems(state.courses, e =>
      cvEntry(e.title, e.org, fmtMonth(e.end), e.details))),
    skills: cvSection("Skills", state.skills.length ? `<div class="cv-inline">${state.skills.map(s => `<span class="cv-pill">${esc(s)}</span>`).join("")}</div>` : ""),
    languages: cvSection("Languages", state.languages.length ? `<div class="cv-inline">${state.languages.map(s => `<span class="cv-pill">${esc(s)}</span>`).join("")}</div>` : ""),
    interests: cvSection("Interests", state.interests.length ? `<div>${state.interests.map(esc).join(" · ")}</div>` : ""),
    summary: b.summary ? `<div class="cv-summary">${esc(b.summary)}</div>` : "",
    contact: [b.email, b.phone, b.location, b.link].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join(""),
    photo: b.photo ? `<img class="cv-photo" src="${b.photo}" alt="">` : ""
  };
}

const TEMPLATES = ["modern", "classic", "sidebar", "elegant", "timeline", "compact", "minimal"];

function renderCV() {
  const b = state.basics;
  const sheet = $("#cvSheet");
  let template = localStorage.getItem("vitae_template") || "modern";
  if (!TEMPLATES.includes(template)) template = "modern";
  document.querySelectorAll(".tpl-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.tpl === template));
  sheet.className = "cv-sheet " + template;

  const hasContent = b.fullName || state.education.length || state.activities.length;
  if (!hasContent) {
    sheet.innerHTML = `<div class="cv-placeholder">Your CV will appear here as you fill in your story ✍</div>`;
    return;
  }
  const k = cvBlocks();
  const nameBlock = `<div class="cv-name">${esc(b.fullName) || "Your Name"}</div>
      ${b.headline ? `<div class="cv-headline">${esc(b.headline)}</div>` : ""}`;

  if (template === "sidebar") {
    sheet.innerHTML = `
      <aside class="cvs-side">
        <div class="cv-side-head">${k.photo}${nameBlock}
          ${k.contact ? `<div class="cv-contact">${k.contact}</div>` : ""}</div>
        ${k.skills}${k.languages}${k.interests}
      </aside>
      <div class="cvs-main">
        ${k.summary}${k.education}${k.activities}${k.volunteering}${k.projects}${k.courses}
      </div>`;
    return;
  }

  if (template === "elegant") {
    sheet.innerHTML = `
      <div class="cve-main">
        <div class="cv-header">${nameBlock}</div>
        ${k.summary}${k.education}${k.activities}${k.volunteering}${k.projects}${k.courses}
      </div>
      <aside class="cve-side">
        ${k.photo}
        ${k.contact ? `<div class="cv-contact">${k.contact}</div>` : ""}
        ${k.skills}${k.languages}${k.interests}
      </aside>`;
    return;
  }

  if (template === "timeline") {
    sheet.innerHTML = `
      <div class="cv-header ${k.photo ? "with-photo" : ""}">
        ${k.photo}<div class="cv-head-text">${nameBlock}
        ${k.contact ? `<div class="cv-contact">${k.contact}</div>` : ""}</div>
      </div>
      ${k.summary}
      <div class="cv-timeline">${k.education}${k.activities}${k.volunteering}</div>
      ${k.projects}${k.courses}${k.skills}${k.languages}${k.interests}`;
    return;
  }

  /* modern, classic, compact, minimal — single column */
  sheet.innerHTML = `
    <div class="cv-header ${k.photo ? "with-photo" : ""}">
      ${k.photo}<div class="cv-head-text">${nameBlock}
      ${k.contact ? `<div class="cv-contact">${k.contact}</div>` : ""}</div>
    </div>
    ${k.summary}${k.education}${k.activities}${k.volunteering}
    ${k.projects}${k.courses}${k.skills}${k.languages}${k.interests}
  `;
}

$("#tplPicker").addEventListener("click", (e) => {
  const btn = e.target.closest(".tpl-btn");
  if (!btn) return;
  localStorage.setItem("vitae_template", btn.dataset.tpl);
  renderCV();
});
$("#printBtn").addEventListener("click", () => window.print());

/* ---------- Save as PDF / Share (generated on this device) ---------- */
function pdfFileName() {
  const n = (state.basics.fullName || "My").trim().replace(/\s+/g, "_");
  return `${n}_CV.pdf`;
}
function pdfWorker() {
  return html2pdf().set({
    margin: [10, 10, 12, 10],
    filename: pdfFileName(),
    image: { type: "jpeg", quality: 0.96 },
    html2canvas: { scale: 2, useCORS: true, windowWidth: 1024 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  }).from($("#cvSheet"));
}
async function withBusy(btn, label, fn) {
  const old = btn.textContent;
  btn.textContent = label; btn.disabled = true;
  try { await fn(); }
  catch (err) { console.error(err); toast("Couldn't create the PDF — try the Print button instead"); }
  finally { btn.textContent = old; btn.disabled = false; }
}

$("#pdfBtn").addEventListener("click", (e) => withBusy(e.target, "Preparing…", async () => {
  await pdfWorker().save();
  toast("CV saved as PDF ✓");
}));

$("#shareBtn").addEventListener("click", (e) => withBusy(e.target, "Preparing…", async () => {
  const blob = await pdfWorker().output("blob");
  const file = new File([blob], pdfFileName(), { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "My CV" }).catch(() => {});
  } else {
    // fallback: just download it
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = pdfFileName();
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Sharing isn't available here — the PDF was downloaded instead");
  }
}));

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    tab.classList.add("active");
    $("#view-" + tab.dataset.view).classList.add("active");
    window.scrollTo({ top: 0 });
  });
});

/* ============================================================
   PDF IMPORT (LinkedIn export or any CV) — processed locally
   ============================================================ */
const SECTION_KEYWORDS = [
  { re: /^(summary|about|profile|professional summary)\b/i, target: "summary" },
  { re: /^(experience|work experience|activities|professional experience|employment)\b/i, target: "activities" },
  { re: /^(education|studies|academic)\b/i, target: "education" },
  { re: /^(volunteer|volunteering|community)\b/i, target: "volunteering" },
  { re: /^(skills|top skills|competen)/i, target: "skills" },
  { re: /^(languages)\b/i, target: "languages" },
  { re: /^(courses|certifications|licenses|licences|training)\b/i, target: "courses" },
  { re: /^(projects|portfolio)\b/i, target: "projects" },
  { re: /^(interests|hobbies|passions)\b/i, target: "interests" }
];
const TARGET_LABELS = {
  summary: "About me (summary)", education: "Education", activities: "Activities & Experience",
  volunteering: "Volunteering", courses: "Courses & Certifications", projects: "Projects",
  skills: "Skills", languages: "Languages", interests: "Passions & Interests", skip: "— Skip this part —"
};

async function handlePdf(file) {
  const status = $("#importStatus");
  status.textContent = "Reading PDF…";
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // group items by vertical position to reconstruct lines
      let rows = {};
      for (const it of content.items) {
        const y = Math.round(it.transform[5]);
        (rows[y] = rows[y] || []).push(it.str);
      }
      const ordered = Object.keys(rows).map(Number).sort((a, b) => b - a)
        .map(y => rows[y].join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
      lines.push(...ordered);
    }
    if (!lines.length) {
      status.textContent = "Couldn't read text from this PDF (it may be a scanned image). Try another file, or add things by hand in My Story.";
      return;
    }
    buildImportReview(lines);
    status.textContent = `Found ${lines.length} lines of text. Review them below ↓`;
  } catch (err) {
    console.error(err);
    status.textContent = "Something went wrong while reading the PDF. Try another file, or add things by hand in My Story.";
  }
}

function buildImportReview(lines) {
  // split into blocks by section keywords
  const blocks = [];
  let current = { target: "skip", header: "Beginning of document", text: [] };
  for (const line of lines) {
    const kw = line.length < 45 ? SECTION_KEYWORDS.find(k => k.re.test(line)) : null;
    if (kw) {
      if (current.text.length) blocks.push(current);
      current = { target: kw.target, header: line, text: [] };
    } else {
      current.text.push(line);
    }
  }
  if (current.text.length) blocks.push(current);

  // detect contact info in the whole text
  const all = lines.join("\n");
  const email = (all.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || "";
  const phone = (all.match(/(\+?\d[\d\s().-]{7,}\d)/) || [])[0] || "";

  const host = $("#importReview");
  let html = "";

  if (email || phone) {
    html += `<div class="import-block">
      <div class="import-block-head"><b>Contact details found</b></div>
      <p class="small">${esc([email, phone].filter(Boolean).join(" · "))}</p>
      <div class="import-block-foot"><button class="btn small primary" id="useContact" data-email="${esc(email)}" data-phone="${esc(phone)}">Use as my contact details</button></div>
    </div>`;
  }

  blocks.forEach((b, i) => {
    const options = Object.keys(TARGET_LABELS).map(k =>
      `<option value="${k}" ${k === b.target ? "selected" : ""}>${TARGET_LABELS[k]}</option>`).join("");
    html += `<div class="import-block" data-block="${i}">
      <div class="import-block-head">
        <b>${esc(b.header)}</b>
        <select data-target>${options}</select>
      </div>
      <textarea rows="5" data-text>${esc(b.text.join("\n"))}</textarea>
      <div class="import-block-foot"><button class="btn small primary" data-addblock="${i}">Add to My Story</button></div>
    </div>`;
  });

  host.innerHTML = html;
  $("#importReviewCard").classList.remove("hidden");
}

$("#importReview").addEventListener("click", (ev) => {
  const t = ev.target;
  if (t.id === "useContact") {
    if (t.dataset.email) state.basics.email = state.basics.email || t.dataset.email;
    if (t.dataset.phone) state.basics.phone = state.basics.phone || t.dataset.phone;
    saveState(); fillBasicsForm(); toast("Contact details saved");
    return;
  }
  if (t.dataset.addblock !== undefined) {
    const block = t.closest(".import-block");
    const target = block.querySelector("[data-target]").value;
    const text = block.querySelector("[data-text]").value.trim();
    if (target === "skip" || !text) { toast("Choose a section first"); return; }

    if (target === "summary") {
      state.basics.summary = text;
      fillBasicsForm();
    } else if (["skills", "languages", "interests"].includes(target)) {
      const items = text.split(/[,\n·•]+/).map(s => s.trim()).filter(s => s && s.length < 60);
      for (const it of items) if (!state[target].includes(it)) state[target].push(it);
    } else {
      const linesArr = text.split("\n").map(s => s.trim()).filter(Boolean);
      const title = (linesArr[0] || "Imported entry").slice(0, 90);
      const details = linesArr.slice(1).join("\n");
      const entry = { id: uid(), details };
      if (target === "education") entry.institution = title; else entry.title = title;
      state[target].push(entry);
    }
    saveState(); renderSections();
    t.textContent = "Added ✓"; t.disabled = true;
    toast("Added to your story — polish it in My Story");
  }
});

/* dropzone wiring */
const dz = $("#dropzone");
$("#pdfInput").addEventListener("change", (e) => { if (e.target.files[0]) handlePdf(e.target.files[0]); });
["dragover", "dragenter"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f && f.type === "application/pdf") handlePdf(f);
  else toast("Please drop a PDF file");
});

/* ---------- Backup ---------- */
$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vitae-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup exported");
});
$("#importJsonInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.basics) throw new Error("bad file");
    state = Object.assign(blankState(), data);
    saveState(); fillBasicsForm(); renderSections();
    toast("Backup restored ✓");
  } catch { toast("That doesn't look like a Vitae backup file"); }
  e.target.value = "";
});
$("#wipeBtn").addEventListener("click", () => {
  if (confirm("Delete ALL data from this device? This cannot be undone.") &&
      confirm("Are you sure? Export a backup first if you haven't.")) {
    state = blankState();
    saveState(); fillBasicsForm(); renderSections();
    toast("All data deleted");
  }
});

/* ---------- Init ---------- */
fillBasicsForm();
refreshPhotoUI();
renderSections();
updateProgress();
renderCV();

/* PWA: makes "Add to Home Screen" install the app with its own icon */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
