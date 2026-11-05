(() => {
  "use strict";

  const ENTRIES_KEY = "healthapp_entries_v1";
  const SETTINGS_KEY = "healthapp_settings_v1";
  const TOTAL_WEEKS = 26;

  // ---------- Storage ----------
  function loadEntries() {
    try {
      return JSON.parse(localStorage.getItem(ENTRIES_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }

  function loadSettings() {
    let s = {};
    try {
      s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      s = {};
    }
    if (!s.weightUnit) s.weightUnit = "lb";
    if (!s.programStart) s.programStart = todayStr();
    if (s.weeklyExerciseGoal === undefined) s.weeklyExerciseGoal = 210;
    if (s.weightGoal === undefined) s.weightGoal = 180;
    if (!s.weightGoalDate) {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      s.weightGoalDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return s;
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  let entries = loadEntries();
  let settings = loadSettings();

  // ---------- Date helpers ----------
  function todayStr() {
    return toDateStr(new Date());
  }

  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(dateStr, n) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }

  function daysBetween(aStr, bStr) {
    const a = parseDate(aStr);
    const b = parseDate(bStr);
    return Math.round((b - a) / 86400000);
  }

  function formatShort(dateStr) {
    const d = parseDate(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatLong(dateStr) {
    const d = parseDate(dateStr);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  // ---------- Custom calendar date picker ----------
  function makeDatePicker({ buttonEl, popupEl, initialDate, maxDate, onSelect }) {
    let selected = initialDate;
    let viewDate = parseDate(initialDate);
    viewDate.setDate(1);

    function renderButton() {
      buttonEl.textContent = formatLong(selected);
    }

    function renderPopup() {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const startWeekday = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

      let cells = "";
      for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell"></div>`;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isSelected = dateStr === selected;
        const isToday = dateStr === todayStr();
        const isDisabled = maxDate && dateStr > maxDate;
        cells += `<button type="button" class="cal-cell cal-day${isSelected ? " cal-selected" : ""}${isToday ? " cal-today" : ""}" ${isDisabled ? "disabled" : ""} data-date="${dateStr}">${day}</button>`;
      }

      popupEl.innerHTML = `
        <div class="cal-header">
          <button type="button" class="cal-nav" data-nav="-1">‹</button>
          <span>${monthLabel}</span>
          <button type="button" class="cal-nav" data-nav="1">›</button>
        </div>
        <div class="cal-weekdays">
          <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
        </div>
        <div class="cal-grid">${cells}</div>
        <button type="button" class="cal-today-btn">Today</button>
      `;

      popupEl.querySelector('[data-nav="-1"]').addEventListener("click", () => {
        viewDate.setMonth(viewDate.getMonth() - 1);
        renderPopup();
      });
      popupEl.querySelector('[data-nav="1"]').addEventListener("click", () => {
        viewDate.setMonth(viewDate.getMonth() + 1);
        renderPopup();
      });
      popupEl.querySelectorAll(".cal-day").forEach((btn) => {
        btn.addEventListener("click", () => {
          selected = btn.dataset.date;
          renderButton();
          close();
          onSelect(selected);
        });
      });
      popupEl.querySelector(".cal-today-btn").addEventListener("click", () => {
        const t = todayStr();
        if (maxDate && t > maxDate) return;
        selected = t;
        viewDate = parseDate(t);
        viewDate.setDate(1);
        renderButton();
        close();
        onSelect(selected);
      });
    }

    function open() {
      viewDate = parseDate(selected);
      viewDate.setDate(1);
      renderPopup();
      popupEl.classList.remove("hidden");
    }

    function close() {
      popupEl.classList.add("hidden");
    }

    buttonEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (popupEl.classList.contains("hidden")) open();
      else close();
    });
    document.addEventListener("click", (ev) => {
      if (!popupEl.contains(ev.target) && ev.target !== buttonEl) close();
    });

    renderButton();

    return {
      setDate(dateStr) {
        selected = dateStr;
        renderButton();
      },
      getDate() {
        return selected;
      },
    };
  }

  function weekIndexFor(dateStr) {
    // returns 0-based week index relative to settings.programStart, or null if before start
    const diff = daysBetween(settings.programStart, dateStr);
    if (diff < 0) return null;
    return Math.floor(diff / 7);
  }

  // ---------- Tabs ----------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  function switchTab(tab) {
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${tab}`));
    if (tab === "dashboard") renderDashboard();
    if (tab === "history") renderHistory();
    if (tab === "settings") renderSettings();
  }

  // ---------- Entry Form ----------
  const entryForm = document.getElementById("entryForm");
  const weightInput = document.getElementById("weight");
  const bpSystolicInput = document.getElementById("bpSystolic");
  const bpDiastolicInput = document.getElementById("bpDiastolic");
  const notesInput = document.getElementById("notes");
  const existingEntryNotice = document.getElementById("existingEntryNotice");
  const deleteEntryBtn = document.getElementById("deleteEntryBtn");

  const entryDatePicker = makeDatePicker({
    buttonEl: document.getElementById("entryDateBtn"),
    popupEl: document.getElementById("entryDateCalendar"),
    initialDate: todayStr(),
    maxDate: todayStr(),
    onSelect: (dateStr) => loadEntryIntoForm(dateStr),
  });

  document.getElementById("copyYesterdayBtn").addEventListener("click", () => {
    const dateStr = entryDatePicker.getDate();
    const prevDate = addDays(dateStr, -1);
    const prev = entries[prevDate];
    if (!prev) {
      alert(`No entry found for ${formatShort(prevDate)}.`);
      return;
    }
    weightInput.value = prev.weight ?? "";
    bpSystolicInput.value = prev.bpSystolic ?? "";
    bpDiastolicInput.value = prev.bpDiastolic ?? "";
    notesInput.value = prev.notes ?? "";
    loadExercisesIntoForm(exercisesOf(prev));
  });

  // ---------- Exercise rows (supports multiple workouts per day) ----------
  const EXERCISE_TYPES = ["Walking", "Running", "Cycling", "Swimming", "Elliptical", "Rowing", "Other"];
  const exerciseRowsContainer = document.getElementById("exerciseRows");

  function exerciseRowEl(minutes = "", type = "") {
    const wrap = document.createElement("div");
    wrap.className = "exercise-row";
    const options = EXERCISE_TYPES.map((t) => `<option ${t === type ? "selected" : ""}>${t}</option>`).join("");
    wrap.innerHTML = `
      <div class="field-row">
        <label class="field">
          <span>Minutes</span>
          <input type="number" class="ex-minutes" inputmode="numeric" step="1" min="0" placeholder="e.g. 30" value="${minutes}">
        </label>
        <label class="field">
          <span>Type</span>
          <select class="ex-type">
            <option value="">—</option>
            ${options}
          </select>
        </label>
      </div>
      <button type="button" class="remove-exercise-btn">Remove this exercise</button>
    `;
    wrap.querySelector(".remove-exercise-btn").addEventListener("click", () => {
      wrap.remove();
      updateRemoveButtonsVisibility();
    });
    return wrap;
  }

  function addExerciseRow(minutes = "", type = "") {
    exerciseRowsContainer.appendChild(exerciseRowEl(minutes, type));
    updateRemoveButtonsVisibility();
  }

  function updateRemoveButtonsVisibility() {
    const rows = exerciseRowsContainer.querySelectorAll(".exercise-row");
    rows.forEach((r) => r.querySelector(".remove-exercise-btn").classList.toggle("hidden", rows.length === 1));
  }

  function clearExerciseRows() {
    exerciseRowsContainer.innerHTML = "";
  }

  function loadExercisesIntoForm(exercises) {
    clearExerciseRows();
    if (exercises.length) {
      exercises.forEach((ex) => addExerciseRow(ex.minutes, ex.type));
    } else {
      addExerciseRow();
    }
  }

  function getExercisesFromForm() {
    const result = [];
    exerciseRowsContainer.querySelectorAll(".exercise-row").forEach((row) => {
      const minutes = row.querySelector(".ex-minutes").value;
      const type = row.querySelector(".ex-type").value;
      if (minutes !== "" && parseInt(minutes, 10) > 0) {
        const item = { minutes: parseInt(minutes, 10) };
        if (type) item.type = type;
        result.push(item);
      }
    });
    return result;
  }

  // Normalizes an entry's exercise data, supporting the old single-exercise shape too.
  function exercisesOf(e) {
    if (!e) return [];
    if (e.exercises && e.exercises.length) return e.exercises;
    if (e.exerciseMinutes !== undefined) return [{ minutes: e.exerciseMinutes, type: e.exerciseType }];
    return [];
  }

  document.getElementById("addExerciseBtn").addEventListener("click", () => addExerciseRow());

  function loadEntryIntoForm(dateStr) {
    const e = entries[dateStr];
    if (e) {
      weightInput.value = e.weight ?? "";
      bpSystolicInput.value = e.bpSystolic ?? "";
      bpDiastolicInput.value = e.bpDiastolic ?? "";
      notesInput.value = e.notes ?? "";
      existingEntryNotice.classList.remove("hidden");
      deleteEntryBtn.classList.remove("hidden");
    } else {
      weightInput.value = "";
      bpSystolicInput.value = "";
      bpDiastolicInput.value = "";
      notesInput.value = "";
      existingEntryNotice.classList.add("hidden");
      deleteEntryBtn.classList.add("hidden");
    }
    loadExercisesIntoForm(exercisesOf(e));
    updateWeightUnitLabels();
  }

  entryForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const dateStr = entryDatePicker.getDate();
    if (!dateStr) return;

    const entry = { date: dateStr };
    if (weightInput.value !== "") entry.weight = parseFloat(weightInput.value);
    if (bpSystolicInput.value !== "") entry.bpSystolic = parseInt(bpSystolicInput.value, 10);
    if (bpDiastolicInput.value !== "") entry.bpDiastolic = parseInt(bpDiastolicInput.value, 10);
    const exercises = getExercisesFromForm();
    if (exercises.length) entry.exercises = exercises;
    if (notesInput.value.trim() !== "") entry.notes = notesInput.value.trim();

    entries[dateStr] = entry;
    saveEntries(entries);
    loadEntryIntoForm(dateStr);
    updateReminderBanner();
    flashSaved();
  });

  deleteEntryBtn.addEventListener("click", () => {
    const dateStr = entryDatePicker.getDate();
    if (!entries[dateStr]) return;
    if (!confirm(`Delete the entry for ${formatShort(dateStr)}?`)) return;
    delete entries[dateStr];
    saveEntries(entries);
    loadEntryIntoForm(dateStr);
    updateReminderBanner();
  });

  function flashSaved() {
    const btn = document.getElementById("saveBtn");
    const original = btn.textContent;
    btn.textContent = "Saved ✓";
    setTimeout(() => (btn.textContent = original), 1200);
  }

  function updateWeightUnitLabels() {
    document.querySelectorAll(".unit-label").forEach((el) => (el.textContent = settings.weightUnit));
  }

  // ---------- Reminder banner ----------
  const REMINDER_DISMISSED_KEY = "healthapp_reminder_dismissed_v1";

  function updateReminderBanner() {
    const banner = document.getElementById("reminderBanner");
    const dismissedDate = localStorage.getItem(REMINDER_DISMISSED_KEY);
    const alreadyLoggedToday = !!entries[todayStr()];
    banner.classList.toggle("hidden", alreadyLoggedToday || dismissedDate === todayStr());
  }

  document.getElementById("dismissReminderBtn").addEventListener("click", () => {
    localStorage.setItem(REMINDER_DISMISSED_KEY, todayStr());
    updateReminderBanner();
  });

  // ---------- Dashboard ----------
  function weeklyBuckets() {
    // array of TOTAL_WEEKS buckets: { weekNum, startDate, endDate, weights[], systolics[], diastolics[], exerciseMinutes[], daysLogged }
    const buckets = [];
    for (let i = 0; i < TOTAL_WEEKS; i++) {
      const startDate = addDays(settings.programStart, i * 7);
      const endDate = addDays(startDate, 6);
      buckets.push({
        weekNum: i + 1,
        startDate,
        endDate,
        weights: [],
        systolics: [],
        diastolics: [],
        exerciseMinutes: [],
        daysLogged: 0,
      });
    }

    Object.values(entries).forEach((e) => {
      const idx = weekIndexFor(e.date);
      if (idx === null || idx >= TOTAL_WEEKS) return;
      const b = buckets[idx];
      if (e.weight !== undefined) b.weights.push(e.weight);
      if (e.bpSystolic !== undefined) b.systolics.push(e.bpSystolic);
      if (e.bpDiastolic !== undefined) b.diastolics.push(e.bpDiastolic);
      const dayExercises = exercisesOf(e);
      if (dayExercises.length) b.exerciseMinutes.push(dayExercises.reduce((sum, x) => sum + x.minutes, 0));
      b.daysLogged += 1;
    });

    return buckets;
  }

  function avg(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function fmt1(n) {
    return n === null ? "—" : n.toFixed(1);
  }

  function fmt0(n) {
    return n === null ? "—" : Math.round(n);
  }

  function bpCategory(sys, dia) {
    if (sys >= 180 || dia >= 120) return { label: "Crisis", cls: "bp-crisis" };
    if (sys >= 140 || dia >= 90) return { label: "High (Stage 2)", cls: "bp-high2" };
    if (sys >= 130 || dia >= 80) return { label: "High (Stage 1)", cls: "bp-high1" };
    if (sys >= 120) return { label: "Elevated", cls: "bp-elevated" };
    return { label: "Normal", cls: "bp-normal" };
  }

  function currentStreak() {
    let streak = 0;
    let d = entries[todayStr()] ? todayStr() : addDays(todayStr(), -1);
    while (entries[d]) {
      streak++;
      d = addDays(d, -1);
    }
    return streak;
  }

  function currentWeekNumber() {
    const idx = weekIndexFor(todayStr());
    if (idx === null) return null;
    if (idx >= TOTAL_WEEKS) return TOTAL_WEEKS;
    return idx + 1;
  }

  function updateWeekPill() {
    const wk = currentWeekNumber();
    document.getElementById("currentWeekPill").textContent = wk ? `Week ${wk} / ${TOTAL_WEEKS}` : "Program not started";
  }

  function renderDashboard() {
    const buckets = weeklyBuckets();
    const allEntries = Object.values(entries).sort((a, b) => (a.date < b.date ? -1 : 1));

    // Summary cards: latest weight, latest BP, total days logged, streak
    const latestWithWeight = [...allEntries].reverse().find((e) => e.weight !== undefined);
    const latestWithBP = [...allEntries].reverse().find((e) => e.bpSystolic !== undefined);
    const latestBPCat = latestWithBP ? bpCategory(latestWithBP.bpSystolic, latestWithBP.bpDiastolic) : null;
    const summary = document.getElementById("dashSummary");
    summary.innerHTML = `
      <div class="summary-card">
        <div class="value">${latestWithWeight ? fmt1(latestWithWeight.weight) + " " + settings.weightUnit : "—"}</div>
        <div class="label">Latest Weight</div>
      </div>
      <div class="summary-card">
        <div class="value">${latestWithBP ? latestWithBP.bpSystolic + "/" + latestWithBP.bpDiastolic : "—"}</div>
        <div class="label">Latest BP</div>
        ${latestBPCat ? `<div class="bp-badge ${latestBPCat.cls}">${latestBPCat.label}</div>` : ""}
      </div>
      <div class="summary-card">
        <div class="value">${allEntries.length}</div>
        <div class="label">Days Logged</div>
      </div>
      <div class="summary-card">
        <div class="value streak-value">🔥 ${currentStreak()}</div>
        <div class="label">Day Streak</div>
      </div>
    `;

    renderGoals(buckets, allEntries);
    renderLineChart("chartWeight", buckets.map((b) => avg(b.weights)), { suffix: " " + settings.weightUnit, color: "#0f766e" });
    renderBPChart("chartBP", buckets);
    renderBarChart("chartExercise", buckets.map((b) => (b.exerciseMinutes.length ? b.exerciseMinutes.reduce((a, c) => a + c, 0) : null)), { suffix: " min", color: "#2563eb" });

    const tbody = document.querySelector("#weeklyTable tbody");
    const curWk = currentWeekNumber();
    tbody.innerHTML = buckets
      .map((b) => {
        const empty = b.daysLogged === 0;
        const isCurrent = curWk === b.weekNum;
        const avgEx = b.exerciseMinutes.length ? avg(b.exerciseMinutes) : null;
        return `<tr class="${empty ? "empty-week" : ""} ${isCurrent ? "current-week" : ""}">
          <td>${b.weekNum}</td>
          <td>${formatShort(b.startDate)}–${formatShort(b.endDate)}</td>
          <td>${b.weights.length ? fmt1(avg(b.weights)) + " " + settings.weightUnit : "—"}</td>
          <td>${b.systolics.length ? `${fmt0(avg(b.systolics))}/${fmt0(avg(b.diastolics))}` : "—"}</td>
          <td>${avgEx === null ? "—" : fmt0(avgEx)}</td>
          <td>${b.daysLogged}</td>
        </tr>`;
      })
      .join("");
  }

  function renderGoals(buckets, allEntries) {
    const container = document.getElementById("goalsSection");

    const weekIdx = weekIndexFor(todayStr());
    const curBucket = weekIdx !== null && weekIdx < TOTAL_WEEKS ? buckets[weekIdx] : null;
    const weekMinutes = curBucket ? curBucket.exerciseMinutes.reduce((a, b) => a + b, 0) : 0;
    const exGoal = settings.weeklyExerciseGoal || 0;
    const exPct = exGoal ? Math.max(0, Math.min(100, Math.round((weekMinutes / exGoal) * 100))) : 0;

    const firstWithWeight = allEntries.find((e) => e.weight !== undefined);
    const latestWithWeight = [...allEntries].reverse().find((e) => e.weight !== undefined);
    const weightGoal = settings.weightGoal;
    const daysLeft = settings.weightGoalDate ? daysBetween(todayStr(), settings.weightGoalDate) : null;
    const daysLeftText = daysLeft === null ? "" : daysLeft >= 0 ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : " · target date passed";

    let weightBlock;
    if (!weightGoal) {
      weightBlock = `<div class="goal-sub">Set a weight goal in Settings to track progress.</div>`;
    } else if (!firstWithWeight || !latestWithWeight) {
      weightBlock = `<div class="goal-sub">Log your weight to start tracking progress${daysLeftText}</div>`;
    } else {
      const start = firstWithWeight.weight;
      const current = latestWithWeight.weight;
      const totalChange = start - weightGoal;
      const doneSoFar = start - current;
      const pct = totalChange !== 0 ? Math.max(0, Math.min(100, Math.round((doneSoFar / totalChange) * 100))) : 100;
      const remaining = +(current - weightGoal).toFixed(1);
      const remainingText =
        Math.abs(remaining) < 0.05
          ? "Goal reached! 🎉"
          : `${fmt1(Math.abs(remaining))} ${settings.weightUnit} to go`;
      weightBlock = `
        <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
        <div class="goal-sub">${remainingText}${daysLeftText}</div>
      `;
    }

    container.innerHTML = `
      <div class="goal-card">
        <div class="goal-head"><span>Weekly Exercise</span><span>${weekMinutes} / ${exGoal} min</span></div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width:${exPct}%"></div></div>
      </div>
      <div class="goal-card">
        <div class="goal-head"><span>Weight Goal</span><span>${weightGoal ? fmt1(weightGoal) + " " + settings.weightUnit : "—"}</span></div>
        ${weightBlock}
      </div>
    `;
  }

  // ---------- Charts (plain inline SVG, no dependencies) ----------
  function renderLineChart(containerId, values, opts) {
    const container = document.getElementById(containerId);
    const points = values.map((v, i) => ({ i, v })).filter((p) => p.v !== null);
    if (points.length < 2) {
      container.innerHTML = `<div class="empty-state">Not enough data yet — log at least two weeks.</div>`;
      return;
    }
    const w = Math.max(320, values.length * 24);
    const h = 160;
    const padL = 36, padR = 10, padT = 10, padB = 20;
    const vs = points.map((p) => p.v);
    const minV = Math.min(...vs), maxV = Math.max(...vs);
    const range = maxV - minV || 1;

    const x = (i) => padL + (i / (values.length - 1)) * (w - padL - padR);
    const y = (v) => padT + (1 - (v - minV) / range) * (h - padT - padB);

    const path = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

    const circles = points
      .map((p) => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3" fill="${opts.color}"></circle>`)
      .join("");

    const yLabels = [minV, (minV + maxV) / 2, maxV]
      .map((v) => `<text x="2" y="${y(v).toFixed(1) * 1 + 4}" font-size="9" fill="currentColor" opacity="0.6">${v.toFixed(1)}</text>`)
      .join("");

    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="color:inherit">
      <path d="${path}" fill="none" stroke="${opts.color}" stroke-width="2"></path>
      ${circles}
      ${yLabels}
    </svg>`;
  }

  function renderBarChart(containerId, values, opts) {
    const container = document.getElementById(containerId);
    const points = values.map((v, i) => ({ i, v })).filter((p) => p.v !== null && p.v > 0);
    if (!points.length) {
      container.innerHTML = `<div class="empty-state">No exercise logged yet.</div>`;
      return;
    }
    const w = Math.max(320, values.length * 24);
    const h = 160;
    const padL = 30, padR = 10, padT = 10, padB = 20;
    const maxV = Math.max(...points.map((p) => p.v));
    const barW = (w - padL - padR) / values.length;

    const bars = values
      .map((v, i) => {
        if (v === null) return "";
        const bh = maxV ? (v / maxV) * (h - padT - padB) : 0;
        const bx = padL + i * barW + 2;
        const by = h - padB - bh;
        return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(barW - 4).toFixed(1)}" height="${bh.toFixed(1)}" fill="${opts.color}" rx="2"></rect>`;
      })
      .join("");

    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      ${bars}
      <text x="2" y="12" font-size="9" fill="currentColor" opacity="0.6">${maxV}${opts.suffix}</text>
    </svg>`;
  }

  function renderBPChart(containerId, buckets) {
    const container = document.getElementById(containerId);
    const sys = buckets.map((b) => avg(b.systolics));
    const dia = buckets.map((b) => avg(b.diastolics));
    const points = sys.map((v, i) => ({ i, sys: v, dia: dia[i] })).filter((p) => p.sys !== null);
    if (points.length < 2) {
      container.innerHTML = `<div class="empty-state">Not enough data yet — log at least two weeks.</div>`;
      return;
    }
    const w = Math.max(320, sys.length * 24);
    const h = 160;
    const padL = 36, padR = 10, padT = 10, padB = 20;
    const allV = points.flatMap((p) => [p.sys, p.dia]);
    const minV = Math.min(...allV) - 5, maxV = Math.max(...allV) + 5;
    const range = maxV - minV || 1;

    const x = (i) => padL + (i / (sys.length - 1)) * (w - padL - padR);
    const y = (v) => padT + (1 - (v - minV) / range) * (h - padT - padB);

    const pathSys = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.sys).toFixed(1)}`).join(" ");
    const pathDia = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.dia).toFixed(1)}`).join(" ");

    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <path d="${pathSys}" fill="none" stroke="#dc2626" stroke-width="2"></path>
      <path d="${pathDia}" fill="none" stroke="#2563eb" stroke-width="2"></path>
      <text x="2" y="12" font-size="9" fill="#dc2626">Systolic</text>
      <text x="55" y="12" font-size="9" fill="#2563eb">Diastolic</text>
    </svg>`;
  }

  // ---------- History ----------
  function renderHistory() {
    const list = document.getElementById("historyList");
    const allEntries = Object.values(entries).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!allEntries.length) {
      list.innerHTML = `<div class="empty-state">No entries yet. Add your first one from the Add Entry tab.</div>`;
      return;
    }
    list.innerHTML = allEntries
      .map((e) => {
        const parts = [];
        if (e.weight !== undefined) parts.push(`${e.weight} ${settings.weightUnit}`);
        if (e.bpSystolic !== undefined) {
          const cat = bpCategory(e.bpSystolic, e.bpDiastolic);
          parts.push(`<span class="${cat.cls}">BP ${e.bpSystolic}/${e.bpDiastolic} (${cat.label})</span>`);
        }
        const exercises = exercisesOf(e);
        if (exercises.length) {
          parts.push(exercises.map((x) => `${x.minutes} min${x.type ? " " + x.type : ""}`).join(" + "));
        }
        return `<div class="history-item" data-date="${e.date}">
          <div>
            <div class="hi-date">${formatShort(e.date)}</div>
            <div class="hi-details">${parts.join(" · ") || "No measurements"}</div>
          </div>
          <div class="hi-edit">Edit ›</div>
        </div>`;
      })
      .join("");

    list.querySelectorAll(".history-item").forEach((item) => {
      item.addEventListener("click", () => {
        const date = item.dataset.date;
        entryDatePicker.setDate(date);
        loadEntryIntoForm(date);
        switchTab("entry");
      });
    });
  }

  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    const rows = [["date", "weight", "weightUnit", "bpSystolic", "bpDiastolic", "exercises", "notes"]];
    Object.values(entries)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((e) => {
        const exercises = exercisesOf(e)
          .map((x) => `${x.minutes}min${x.type ? " " + x.type : ""}`)
          .join("; ");
        rows.push([
          e.date,
          e.weight ?? "",
          e.weight !== undefined ? settings.weightUnit : "",
          e.bpSystolic ?? "",
          e.bpDiastolic ?? "",
          exercises,
          (e.notes ?? "").replace(/"/g, '""'),
        ]);
      });
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-tracker-export-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ---------- Settings ----------
  const programStartPicker = makeDatePicker({
    buttonEl: document.getElementById("programStartBtn"),
    popupEl: document.getElementById("programStartCalendar"),
    initialDate: settings.programStart,
    maxDate: null,
    onSelect: (dateStr) => {
      settings.programStart = dateStr;
      saveSettings(settings);
      updateWeekPill();
    },
  });

  const weightGoalDatePicker = makeDatePicker({
    buttonEl: document.getElementById("weightGoalDateBtn"),
    popupEl: document.getElementById("weightGoalDateCalendar"),
    initialDate: settings.weightGoalDate,
    maxDate: null,
    onSelect: (dateStr) => {
      settings.weightGoalDate = dateStr;
      saveSettings(settings);
    },
  });

  function renderSettings() {
    document.getElementById("weightUnit").value = settings.weightUnit;
    programStartPicker.setDate(settings.programStart);
    document.getElementById("weeklyExerciseGoal").value = settings.weeklyExerciseGoal;
    document.getElementById("weightGoal").value = settings.weightGoal ?? "";
    weightGoalDatePicker.setDate(settings.weightGoalDate);
  }

  document.getElementById("weightUnit").addEventListener("change", (ev) => {
    settings.weightUnit = ev.target.value;
    saveSettings(settings);
    updateWeightUnitLabels();
    updateWeekPill();
  });

  document.getElementById("weeklyExerciseGoal").addEventListener("change", (ev) => {
    settings.weeklyExerciseGoal = ev.target.value === "" ? 0 : parseInt(ev.target.value, 10);
    saveSettings(settings);
  });

  document.getElementById("weightGoal").addEventListener("change", (ev) => {
    settings.weightGoal = ev.target.value === "" ? null : parseFloat(ev.target.value);
    saveSettings(settings);
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    if (!confirm("This will permanently erase all logged entries on this device. Continue?")) return;
    entries = {};
    saveEntries(entries);
    loadEntryIntoForm(entryDatePicker.getDate());
    renderHistory();
    renderDashboard();
    updateReminderBanner();
  });

  // ---------- CSV Import ----------
  function parseCsvLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        result.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  function parseExercisesField(str) {
    if (!str) return [];
    return str
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = s.match(/^(\d+)\s*min\s*(.*)$/i);
        if (!m) return null;
        const item = { minutes: parseInt(m[1], 10) };
        if (m[2]) item.type = m[2].trim();
        return item;
      })
      .filter(Boolean);
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (!lines.length) return [];
    const header = parseCsvLine(lines[0]).map((h) => h.trim());
    const idx = (name) => header.indexOf(name);
    const dateIdx = idx("date");
    if (dateIdx === -1) throw new Error("missing date column");
    const weightIdx = idx("weight");
    const bpSysIdx = idx("bpSystolic");
    const bpDiaIdx = idx("bpDiastolic");
    const exIdx = idx("exercises");
    const notesIdx = idx("notes");

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const date = (cols[dateIdx] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const entry = { date };
      if (weightIdx !== -1 && cols[weightIdx] !== "") entry.weight = parseFloat(cols[weightIdx]);
      if (bpSysIdx !== -1 && cols[bpSysIdx] !== "") entry.bpSystolic = parseInt(cols[bpSysIdx], 10);
      if (bpDiaIdx !== -1 && cols[bpDiaIdx] !== "") entry.bpDiastolic = parseInt(cols[bpDiaIdx], 10);
      if (exIdx !== -1 && cols[exIdx] !== "") {
        const exercises = parseExercisesField(cols[exIdx]);
        if (exercises.length) entry.exercises = exercises;
      }
      if (notesIdx !== -1 && cols[notesIdx] !== "") entry.notes = cols[notesIdx];
      result.push(entry);
    }
    return result;
  }

  document.getElementById("importCsvBtn").addEventListener("click", () => {
    document.getElementById("importCsvInput").click();
  });

  document.getElementById("importCsvInput").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseCsv(String(reader.result));
        if (!imported.length) {
          alert("No valid rows found in that file.");
          return;
        }
        if (!confirm(`Import ${imported.length} ${imported.length === 1 ? "entry" : "entries"}? Existing entries on the same dates will be overwritten.`)) return;
        imported.forEach((e) => {
          entries[e.date] = e;
        });
        saveEntries(entries);
        loadEntryIntoForm(entryDatePicker.getDate());
        renderHistory();
        updateReminderBanner();
        alert(`Imported ${imported.length} ${imported.length === 1 ? "entry" : "entries"}.`);
      } catch (err) {
        alert("Could not read that CSV file. Make sure it's the format exported by this app.");
      }
      ev.target.value = "";
    };
    reader.readAsText(file);
  });

  // ---------- Init ----------
  loadEntryIntoForm(todayStr());
  updateWeekPill();
  updateWeightUnitLabels();
  updateReminderBanner();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
