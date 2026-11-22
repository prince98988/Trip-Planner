(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const elements = {
    welcome: $("#welcome-overlay"),
    fileInput: $("#excel-file-input"),
    welcomeImport: $("#welcome-import"),
    welcomeNew: $("#welcome-new"),
    importButton: $("#import-button"),
    sidebarImport: $("#sidebar-import"),
    exportButton: $("#export-button"),
    pdfButton: $("#pdf-button"),
    addDayButton: $("#add-day-button"),
    sidebarAddDay: $("#sidebar-add-day"),
    tripName: $("#trip-name"),
    destination: $("#trip-destination"),
    startDate: $("#trip-start"),
    endDate: $("#trip-end"),
    daysList: $("#days-list"),
    dayNavigation: $("#day-navigation"),
    toast: $("#toast"),
    dateLabel: $("#trip-date-label"),
    dateBadge: $("#trip-date-badge"),
    sidebarTripName: $("#sidebar-trip-name"),
    sidebarDestination: $("#sidebar-trip-destination"),
    breadcrumb: $("#breadcrumb-trip-name"),
    dayCountPill: $("#day-count-pill"),
    sidebarDayCount: $("#sidebar-day-count"),
    printDocument: $("#print-document"),
    essentialForm: $("#essential-form"),
    essentialsSection: $(".essentials-section"),
    essentialInput: $("#essential-input"),
    essentialsList: $("#essentials-list"),
    essentialsCount: $("#essentials-count"),
  };

  let trip = createEmptyTrip();
  let activeDayId = null;
  let toastTimer;
  let draggedItem = null;

  function createEmptyTrip() {
    return { name: "", destination: "", startDate: "", endDate: "", days: [], essentials: [] };
  }

  function createDay(date = "") {
    return {
      id: makeId(),
      date,
      activities: [],
    };
  }

  function createActivity() {
    return { time: "", activity: "", location: "", notes: "" };
  }

  function createEssential(name, packed = false) {
    return { id: makeId(), name, packed };
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function formatDate(dateString, options = { month: "short", day: "numeric", year: "numeric" }) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function formatDayDate(dateString) {
    if (!dateString) return "Add a date for this day";
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" })
      .format(new Date(`${dateString}T12:00:00`));
  }

  function formatRange(start, end) {
    if (!start && !end) return "Choose your dates";
    if (start && end) return `${formatDate(start)} — ${formatDate(end)}`;
    return formatDate(start || end);
  }

  function updateTripField(field, value) {
    trip[field] = value;
    renderSummary();
    if (field === "startDate" || field === "endDate") {
      syncDayDatesFromTrip();
      renderDays();
    }
  }

  function renderSummary() {
    const name = trip.name.trim() || "Untitled trip";
    const destination = trip.destination.trim() || "Add a destination";
    elements.sidebarTripName.textContent = name;
    elements.sidebarDestination.textContent = destination;
    elements.breadcrumb.textContent = trip.name.trim() || "New itinerary";
    elements.dateLabel.textContent = formatRange(trip.startDate, trip.endDate);
    elements.dateBadge.title = trip.destination.trim() || "Trip dates";
    const count = trip.days.length;
    elements.dayCountPill.textContent = `${count} ${count === 1 ? "day" : "days"}`;
    elements.sidebarDayCount.textContent = `${count} ${count === 1 ? "day" : "days"}`;
    const packedCount = trip.essentials.filter((item) => item.packed).length;
    elements.essentialsCount.textContent = `${packedCount} of ${trip.essentials.length} packed`;
  }

  function syncDayDatesFromTrip() {
    if (!trip.startDate) return;
    trip.days.forEach((day, index) => {
      if (!day.date) day.date = addDays(trip.startDate, index);
    });
  }

  function addDays(dateString, count) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + count);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDay() {
    const date = trip.startDate ? addDays(trip.startDate, trip.days.length) : "";
    const day = createDay(date);
    trip.days.push(day);
    activeDayId = day.id;
    renderAll();
    requestAnimationFrame(() => {
      const card = $(`[data-day-id="${day.id}"]`, elements.daysList);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function removeDay(dayId) {
    const index = trip.days.findIndex((day) => day.id === dayId);
    if (index < 0) return;
    trip.days.splice(index, 1);
    if (activeDayId === dayId) activeDayId = trip.days[Math.min(index, trip.days.length - 1)]?.id || null;
    renderAll();
  }

  function moveDay(sourceDayId, targetDayId, insertAfter) {
    if (sourceDayId === targetDayId) return;
    const sourceIndex = trip.days.findIndex((day) => day.id === sourceDayId);
    const targetIndex = trip.days.findIndex((day) => day.id === targetDayId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [day] = trip.days.splice(sourceIndex, 1);
    let destinationIndex = targetIndex + (insertAfter ? 1 : 0);
    if (sourceIndex < destinationIndex) destinationIndex -= 1;
    trip.days.splice(destinationIndex, 0, day);
    renderAll();
  }

  function moveActivity(sourceDayId, sourceActivityIndex, targetDayId, targetActivityIndex, insertAfter) {
    const sourceDay = trip.days.find((day) => day.id === sourceDayId);
    const targetDay = trip.days.find((day) => day.id === targetDayId);
    if (!sourceDay || !targetDay || !sourceDay.activities[sourceActivityIndex]) return;
    if (sourceDay === targetDay && sourceActivityIndex === targetActivityIndex) return;
    const [activity] = sourceDay.activities.splice(sourceActivityIndex, 1);
    let destinationIndex = targetActivityIndex === null
      ? targetDay.activities.length
      : targetActivityIndex + (insertAfter ? 1 : 0);
    if (sourceDay === targetDay && targetActivityIndex !== null && sourceActivityIndex < destinationIndex) {
      destinationIndex -= 1;
    }
    targetDay.activities.splice(Math.max(0, destinationIndex), 0, activity);
    activeDayId = targetDayId;
    renderAll();
  }

  function addActivity(dayId) {
    const day = trip.days.find((item) => item.id === dayId);
    if (!day) return;
    day.activities.push(createActivity());
    renderAll();
    const rows = $$(`[data-day-id="${dayId}"] .activity-row`, elements.daysList);
    const lastRow = rows[rows.length - 1];
    if (lastRow) $("input[data-field='activity']", lastRow).focus();
  }

  function updateActivity(dayId, index, field, value) {
    const day = trip.days.find((item) => item.id === dayId);
    if (day && day.activities[index]) day.activities[index][field] = value;
  }

  function renderAll() {
    renderSummary();
    renderDays();
    renderNavigation();
    renderEssentials();
    elements.tripName.value = trip.name;
    elements.destination.value = trip.destination;
    elements.startDate.value = trip.startDate;
    elements.endDate.value = trip.endDate;
  }

  function renderEssentials() {
    elements.essentialsList.innerHTML = trip.essentials.length
      ? trip.essentials.map((item) => `
        <div class="essential-item ${item.packed ? "is-packed" : ""}" data-essential-id="${escapeHtml(item.id)}">
          <label class="essential-check">
            <input type="checkbox" data-essential-packed aria-label="Mark ${escapeHtml(item.name || "essential")} as packed" ${item.packed ? "checked" : ""} />
            <span aria-hidden="true"></span>
          </label>
          <input class="essential-name" type="text" data-essential-name value="${escapeHtml(item.name)}" aria-label="Essential item" maxlength="120" />
          <button class="icon-button remove-essential" type="button" data-action="remove-essential" aria-label="Remove ${escapeHtml(item.name || "essential")}" title="Remove item">×</button>
        </div>`).join("")
      : '<p class="essentials-empty">Your list is empty. Add a must-have above or pick a quick suggestion.</p>';
    $$(".essential-suggestions [data-essential-suggestion]", elements.essentialsSection).forEach((button) => {
      button.disabled = trip.essentials.some((item) => item.name.trim().toLowerCase()
        === button.dataset.essentialSuggestion.toLowerCase());
    });
  }

  function addEssential(name) {
    const normalizedName = String(name ?? "").trim();
    if (!normalizedName) {
      elements.essentialInput.focus();
      return;
    }
    trip.essentials.push(createEssential(normalizedName));
    elements.essentialInput.value = "";
    renderAll();
    elements.essentialInput.focus();
  }

  function renderDays() {
    if (!trip.days.length) {
      elements.daysList.innerHTML = `
        <div class="empty-state">
          <span aria-hidden="true">✳</span>
          <strong>Your adventure is a blank page.</strong>
          <p>Add your first day and start filling it with the good stuff.</p>
          <button class="button button-primary" type="button" data-action="add-first-day">＋ Add your first day</button>
        </div>`;
      return;
    }
    elements.daysList.innerHTML = trip.days.map((day, index) => `
      <article class="day-card" data-day-id="${escapeHtml(day.id)}" id="day-${escapeHtml(day.id)}">
        <header class="day-card-header">
          <div class="day-heading-main">
            <span class="drag-handle day-drag-handle" draggable="true" data-drag-type="day" data-day-id="${escapeHtml(day.id)}" aria-label="Drag to reorder day ${index + 1}" title="Drag to reorder day ${index + 1}">⠿</span>
            <span class="day-number">${index + 1}</span>
            <div class="day-heading-text">
              <strong>Day ${index + 1}</strong>
              <span>${escapeHtml(formatDayDate(day.date))}</span>
            </div>
          </div>
          <div class="day-header-actions">
            <input class="day-date" type="date" aria-label="Date for day ${index + 1}" data-day-date="${escapeHtml(day.id)}" value="${escapeHtml(day.date)}" />
            <button class="icon-button delete-day" type="button" title="Remove day" aria-label="Remove day ${index + 1}" data-action="remove-day" data-day-id="${escapeHtml(day.id)}">×</button>
          </div>
        </header>
        <div class="activity-list">
          ${day.activities.length ? day.activities.map((activity, activityIndex) => renderActivity(day, activity, activityIndex)).join("") : '<div class="empty-activities">Nothing planned yet. Leave room for a happy detour.</div>'}
        </div>
        <div class="activity-footer">
          <button class="add-activity" type="button" data-action="add-activity" data-day-id="${escapeHtml(day.id)}"><span>＋</span> Add an activity</button>
        </div>
      </article>`).join("");
  }

  function renderActivity(day, activity, activityIndex) {
    return `
      <div class="activity-row" data-activity-index="${activityIndex}">
        <span class="drag-handle activity-drag-handle" draggable="true" data-drag-type="activity" data-day-id="${escapeHtml(day.id)}" data-activity-index="${activityIndex}" aria-label="Drag to move activity" title="Drag to reorder or move this activity">⠿</span>
        <div class="activity-field activity-time">
          <label for="time-${escapeHtml(day.id)}-${activityIndex}">TIME</label>
          <input id="time-${escapeHtml(day.id)}-${activityIndex}" type="time" data-field="time" value="${escapeHtml(activity.time)}" aria-label="Activity time" />
        </div>
        <div class="activity-field">
          <label for="activity-${escapeHtml(day.id)}-${activityIndex}">ACTIVITY</label>
          <input id="activity-${escapeHtml(day.id)}-${activityIndex}" type="text" data-field="activity" placeholder="What are you doing?" maxlength="160" value="${escapeHtml(activity.activity)}" />
        </div>
        <div class="activity-field activity-field-location">
          <label for="location-${escapeHtml(day.id)}-${activityIndex}">LOCATION</label>
          <input id="location-${escapeHtml(day.id)}-${activityIndex}" type="text" data-field="location" placeholder="Where?" maxlength="160" value="${escapeHtml(activity.location)}" />
        </div>
        <div class="activity-field activity-field-notes">
          <label for="notes-${escapeHtml(day.id)}-${activityIndex}">NOTES</label>
          <input id="notes-${escapeHtml(day.id)}-${activityIndex}" type="text" data-field="notes" placeholder="Little details to remember…" maxlength="300" value="${escapeHtml(activity.notes)}" />
        </div>
        <button class="icon-button remove-activity" type="button" title="Remove activity" aria-label="Remove activity" data-action="remove-activity" data-day-id="${escapeHtml(day.id)}" data-activity-index="${activityIndex}">×</button>
      </div>`;
  }

  function renderNavigation() {
    elements.dayNavigation.innerHTML = trip.days.map((day, index) => `
      <button class="day-nav-item ${day.id === activeDayId ? "active" : ""}" type="button" data-action="navigate-day" data-day-id="${escapeHtml(day.id)}">
        <span class="day-nav-number">${index + 1}</span>
        <span class="day-nav-copy"><strong>Day ${index + 1}</strong><small>${escapeHtml(formatDate(day.date, { month: "short", day: "numeric" }) || "Plan your day")}</small></span>
      </button>`).join("");
  }

  function setActiveDay(dayId) {
    activeDayId = dayId;
    renderNavigation();
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", isError);
    elements.toast.classList.add("visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 3200);
  }

  function formatActivityTime(value) {
    const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "Time flexible";
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
      .format(new Date(2000, 0, 1, Number(match[1]), Number(match[2])));
  }

  function renderPrintableTrip() {
    const activityMarkup = (activity) => `
      <article class="print-activity">
        <div class="print-activity-time">${escapeHtml(formatActivityTime(activity.time))}</div>
        <div class="print-activity-copy">
          <strong>${escapeHtml(activity.activity || "Untitled activity")}</strong>
          ${activity.location ? `<span class="print-activity-location">${escapeHtml(activity.location)}</span>` : ""}
          ${activity.notes ? `<p>${escapeHtml(activity.notes)}</p>` : ""}
        </div>
      </article>`;
    elements.printDocument.innerHTML = `
      <header class="print-cover">
        <div class="print-brand"><span>✳</span> WAYFARER <small>TRIP PLAN</small></div>
        <h1>${escapeHtml(trip.name.trim() || "My trip")}</h1>
        <p class="print-destination">${escapeHtml(trip.destination.trim() || "A new adventure")}</p>
        <div class="print-trip-meta">
          <span>${escapeHtml(formatRange(trip.startDate, trip.endDate))}</span>
          <span>${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}</span>
        </div>
      </header>
      ${trip.days.map((day, index) => `
        <section class="print-day">
          <header class="print-day-header">
            <div><span>DAY ${String(index + 1).padStart(2, "0")}</span><h2>Day ${index + 1}</h2></div>
            <time>${escapeHtml(formatDayDate(day.date))}</time>
          </header>
          <div class="print-activities">
            ${day.activities.length
              ? day.activities.map(activityMarkup).join("")
              : '<p class="print-empty-day">Nothing planned yet. Leave room for a happy detour.</p>'}
          </div>
        </section>`).join("")}
      ${trip.essentials.length ? `
        <section class="print-essentials">
          <header>
            <div><span>✦</span><h2>Trip essentials</h2></div>
            <small>${trip.essentials.filter((item) => item.packed).length} of ${trip.essentials.length} packed</small>
          </header>
          <div class="print-essential-list">
            ${trip.essentials.map((item) => `
              <div class="print-essential ${item.packed ? "is-packed" : ""}">
                <span class="print-check">${item.packed ? "✓" : ""}</span>
                <span>${escapeHtml(item.name)}</span>
              </div>`).join("")}
          </div>
        </section>` : ""}
      <footer class="print-footer">Made for the memories, not just the map. <span>✳</span></footer>`;
  }

  function exportPdf() {
    if (!trip.days.length && !trip.essentials.length) {
      showToast("Add a day or trip essential before making a PDF.", true);
      return;
    }
    renderPrintableTrip();
    const originalTitle = document.title;
    const fileTitle = (trip.name.trim() || trip.destination.trim() || "my-itinerary")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .trim();
    document.title = `${fileTitle} - Itinerary`;
    window.addEventListener("afterprint", () => {
      document.title = originalTitle;
    }, { once: true });
    showToast("Choose “Save as PDF” in the print dialog.");
    window.print();
  }

  function handleDragStart(event) {
    const handle = event.target.closest("[data-drag-type]");
    if (!handle) return;
    draggedItem = {
      type: handle.dataset.dragType,
      dayId: handle.dataset.dayId,
      activityIndex: Number(handle.dataset.activityIndex),
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(draggedItem));
    const item = handle.closest(draggedItem.type === "day" ? ".day-card" : ".activity-row");
    if (item) item.classList.add("dragging");
  }

  function clearDragIndicators() {
    $$(".drop-before, .drop-after, .drag-over", elements.daysList).forEach((item) => {
      item.classList.remove("drop-before", "drop-after", "drag-over");
    });
  }

  function handleDragOver(event) {
    if (!draggedItem) return;
    const dayCard = event.target.closest(".day-card");
    if (!dayCard) return;
    if (draggedItem.type === "day") {
      event.preventDefault();
      clearDragIndicators();
      const bounds = dayCard.getBoundingClientRect();
      dayCard.classList.add(event.clientY > bounds.top + bounds.height / 2 ? "drop-after" : "drop-before");
      event.dataTransfer.dropEffect = "move";
      return;
    }

    const activityRow = event.target.closest(".activity-row");
    const activityZone = event.target.closest(".activity-list, .activity-footer");
    if (!activityRow && !activityZone) return;
    event.preventDefault();
    clearDragIndicators();
    if (activityRow) {
      const bounds = activityRow.getBoundingClientRect();
      activityRow.classList.add(event.clientY > bounds.top + bounds.height / 2 ? "drop-after" : "drop-before");
    } else {
      activityZone.classList.add("drag-over");
    }
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event) {
    if (!draggedItem) return;
    const targetDayCard = event.target.closest(".day-card");
    if (!targetDayCard) return;
    const targetDayId = targetDayCard.dataset.dayId;
    event.preventDefault();
    if (draggedItem.type === "day") {
      const bounds = targetDayCard.getBoundingClientRect();
      moveDay(draggedItem.dayId, targetDayId, event.clientY > bounds.top + bounds.height / 2);
    } else {
      const targetRow = event.target.closest(".activity-row");
      const activityZone = event.target.closest(".activity-list, .activity-footer");
      if (!targetRow && !activityZone) return;
      const targetIndex = targetRow ? Number(targetRow.dataset.activityIndex) : null;
      const insertAfter = targetRow
        ? event.clientY > targetRow.getBoundingClientRect().top + targetRow.getBoundingClientRect().height / 2
        : true;
      moveActivity(draggedItem.dayId, draggedItem.activityIndex, targetDayId, targetIndex, insertAfter);
    }
    clearDragIndicators();
  }

  function handleDragEnd() {
    $$(".dragging", elements.daysList).forEach((item) => item.classList.remove("dragging"));
    clearDragIndicators();
    draggedItem = null;
  }

  function openFilePicker() {
    elements.fileInput.value = "";
    elements.fileInput.click();
  }

  function normalizeHeader(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findCell(row, names) {
    const accepted = names.map(normalizeHeader);
    for (const [key, value] of Object.entries(row)) {
      if (accepted.includes(normalizeHeader(key))) return value;
    }
    return "";
  }

  function excelDateToInput(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }
    if (typeof value === "number" && window.XLSX?.SSF) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
    const text = String(value ?? "").trim();
    if (!text) return "";
    const parsedDate = new Date(text);
    if (!Number.isNaN(parsedDate.getTime())) {
      return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
    }
    return "";
  }

  function excelTimeToInput(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    }
    if (typeof value === "number" && value >= 0 && value < 1) {
      const minutes = Math.round(value * 24 * 60);
      return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    const text = String(value ?? "").trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!match) return text;
    let hours = Number(match[1]);
    if (match[3]) {
      const isPm = match[3].toUpperCase() === "PM";
      hours = (hours % 12) + (isPm ? 12 : 0);
    }
    return `${String(hours).padStart(2, "0")}:${match[2]}`;
  }

  function rowsAfterHeader(sheet, headerGroups) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headerIndex = findHeaderRow(rows, headerGroups);
    if (headerIndex < 0) return [];
    const headers = rows[headerIndex].map((header) => String(header ?? "").trim());
    return rows.slice(headerIndex + 1)
      .filter((row) => row.some((value) => value !== ""))
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  }

  function findHeaderRow(rows, headerGroups) {
    return rows.findIndex((row) => {
      const headers = row.map(normalizeHeader);
      return headerGroups.every((group) => group.some((name) => headers.includes(normalizeHeader(name))));
    });
  }

  function convertTripSheet(rows) {
    const metadata = {};
    for (const row of rows) {
      const key = normalizeHeader(findCell(row, ["Field", "Property", "Trip detail", "Trip"]));
      const value = findCell(row, ["Value", "Details"]);
      if (key) metadata[key] = value;
    }
    return {
      name: String(metadata.tripname ?? metadata.name ?? ""),
      destination: String(metadata.destination ?? metadata.whereto ?? ""),
      startDate: excelDateToInput(metadata.startdate),
      endDate: excelDateToInput(metadata.enddate),
      days: [],
      essentials: [],
    };
  }

  function parseWorkbook(workbook) {
    if (!window.XLSX) throw new Error("Excel support could not load. Check your internet connection and try again.");
    const sheetNames = workbook.SheetNames || [];
    const tripSheetName = sheetNames.find((name) => normalizeHeader(name) === "trip");
    const essentialsSheetName = sheetNames.find((name) => normalizeHeader(name) === "essentials");
    const meta = tripSheetName
      ? convertTripSheet(rowsAfterHeader(workbook.Sheets[tripSheetName], [
        ["Field", "Property", "Trip detail", "Trip"],
        ["Value", "Details"],
      ]))
      : createEmptyTrip();
    const itineraryHeaders = [
      ["Day", "Day number", "Itinerary day"],
      ["Activity", "Plan", "Title", "What"],
    ];
    const itinerarySheetName = sheetNames.find((name) => normalizeHeader(name) === "itinerary")
      || sheetNames.find((name) => name !== tripSheetName && name !== essentialsSheetName
        && findHeaderRow(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "" }), itineraryHeaders) >= 0)
      || sheetNames.find((name) => name !== tripSheetName && name !== essentialsSheetName);
    const rows = itinerarySheetName
      ? rowsAfterHeader(workbook.Sheets[itinerarySheetName], itineraryHeaders)
      : [];
    const itineraryHasHeader = itinerarySheetName
      && findHeaderRow(XLSX.utils.sheet_to_json(workbook.Sheets[itinerarySheetName], { header: 1, defval: "" }), itineraryHeaders) >= 0;
    if (itinerarySheetName && !itineraryHasHeader) {
      throw new Error("Couldn't find itinerary columns. Use columns named Day, Date, Time, Activity, Location and Notes.");
    }
    const dayMap = new Map();
    rows.forEach((row, rowIndex) => {
      const dayValue = findCell(row, ["Day", "Day number", "Itinerary day"]);
      const dayKey = String(dayValue || "1");
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, createDay(excelDateToInput(findCell(row, ["Date", "Day date"]))));
      }
      const day = dayMap.get(dayKey);
      if (!day.date) day.date = excelDateToInput(findCell(row, ["Date", "Day date"]));
      const activity = {
        time: excelTimeToInput(findCell(row, ["Time", "Start time"])),
        activity: String(findCell(row, ["Activity", "Plan", "Title", "What"]) ?? "").trim(),
        location: String(findCell(row, ["Location", "Place", "Where"]) ?? "").trim(),
        notes: String(findCell(row, ["Notes", "Details", "Description"]) ?? "").trim(),
      };
      if (Object.values(activity).some(Boolean)) day.activities.push(activity);
      if (!dayValue && rowIndex === 0 && !Object.values(activity).some(Boolean)) {
        throw new Error("Couldn't find itinerary columns. Use columns named Day, Date, Time, Activity, Location and Notes.");
      }
    });
    meta.days = Array.from(dayMap.values());
    if (essentialsSheetName) {
      meta.essentials = rowsAfterHeader(workbook.Sheets[essentialsSheetName], [
        ["Essential", "Item", "Name"],
        ["Packed", "Done", "Status"],
      ]).map((row) => {
        const status = String(findCell(row, ["Packed", "Done", "Status"])).trim().toLowerCase();
        return createEssential(
          String(findCell(row, ["Essential", "Item", "Name"]) ?? "").trim(),
          ["yes", "true", "1", "packed", "done"].includes(status),
        );
      }).filter((item) => item.name);
    }
    if (!meta.startDate && meta.days[0]?.date) meta.startDate = meta.days.find((day) => day.date)?.date || "";
    if (!meta.endDate && meta.days.length) meta.endDate = meta.days.reduce((last, day) => day.date || last, "");
    if (!meta.days.length && !meta.name && !meta.destination && !meta.essentials.length) {
      throw new Error("This workbook is empty. Choose an itinerary workbook or start a new trip.");
    }
    return meta;
  }

  async function importWorkbook(file) {
    if (!file) return;
    if (!window.XLSX) {
      showToast("Excel support didn't load. Check your internet connection and retry.", true);
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      trip = parseWorkbook(workbook);
      activeDayId = trip.days[0]?.id || null;
      renderAll();
      elements.welcome.classList.add("hidden");
      showToast(`Opened “${trip.name || file.name}” successfully.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't read that Excel file.", true);
    }
  }

  function exportWorkbook() {
    if (!window.XLSX) {
      showToast("Excel support didn't load. Check your internet connection and retry.", true);
      return;
    }
    if (!trip.days.length && !trip.essentials.length) {
      showToast("Add a day or trip essential before exporting your itinerary.", true);
      return;
    }
    const metadataRows = [
      ["Trip name", trip.name.trim()],
      ["Destination", trip.destination.trim()],
      ["Start date", trip.startDate ? new Date(`${trip.startDate}T12:00:00`) : ""],
      ["End date", trip.endDate ? new Date(`${trip.endDate}T12:00:00`) : ""],
    ];
    const itineraryRows = [];
    trip.days.forEach((day, index) => {
      if (!day.activities.length) {
        itineraryRows.push([index + 1, day.date ? new Date(`${day.date}T12:00:00`) : "", "", "", "", ""]);
      } else {
        day.activities.forEach((activity) => {
          const time = activity.time.match(/^(\d{1,2}):(\d{2})$/);
          const excelTime = time ? (Number(time[1]) * 60 + Number(time[2])) / 1440 : activity.time;
          itineraryRows.push([
            index + 1,
            day.date ? new Date(`${day.date}T12:00:00`) : "",
            excelTime,
            activity.activity,
            activity.location,
            activity.notes,
          ]);
        });
      }
    });
    const workbook = XLSX.utils.book_new();
    const palette = {
      forest: "245B4D",
      green: "347967",
      mint: "EAF4EF",
      paleMint: "F5F9F6",
      orange: "E6A15C",
      paleOrange: "FFF3E5",
      blue: "F1F6F8",
      white: "FFFFFF",
      ink: "30463E",
      muted: "718279",
      line: "DDE8E1",
    };
    const titleStyle = {
      fill: { patternType: "solid", fgColor: { rgb: palette.forest } },
      font: { name: "Aptos Display", sz: 19, bold: true, color: { rgb: palette.white } },
      alignment: { horizontal: "left", vertical: "center" },
    };
    const subtitleStyle = {
      fill: { patternType: "solid", fgColor: { rgb: palette.mint } },
      font: { name: "Aptos", sz: 10, italic: true, color: { rgb: palette.muted } },
      alignment: { horizontal: "left", vertical: "center" },
    };
    const headerStyle = {
      fill: { patternType: "solid", fgColor: { rgb: palette.green } },
      font: { name: "Aptos", sz: 10, bold: true, color: { rgb: palette.white } },
      alignment: { horizontal: "left", vertical: "center" },
      border: { bottom: { style: "medium", color: { rgb: palette.forest } } },
    };
    const bottomBorder = { bottom: { style: "thin", color: { rgb: palette.line } } };
    const tripSheet = XLSX.utils.aoa_to_sheet([
      ["YOUR TRIP"],
      ["A little plan for a lot of memories."],
      [],
      ["FIELD", "DETAILS"],
      ...metadataRows,
    ]);
    tripSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    tripSheet["!cols"] = [{ wch: 20 }, { wch: 42 }];
    tripSheet["!rows"] = [{ hpt: 38 }, { hpt: 25 }, { hpt: 10 }, { hpt: 25 }, ...metadataRows.map(() => ({ hpt: 27 }))];
    styleRow(tripSheet, 0, 0, 1, titleStyle);
    styleRow(tripSheet, 1, 0, 1, subtitleStyle);
    styleRow(tripSheet, 3, 0, 1, headerStyle);
    metadataRows.forEach((row, index) => {
      const rowIndex = index + 4;
      styleCell(tripSheet, rowIndex, 0, {
        fill: { patternType: "solid", fgColor: { rgb: palette.paleOrange } },
        font: { name: "Aptos", sz: 10, bold: true, color: { rgb: palette.forest } },
        alignment: { vertical: "center" },
        border: bottomBorder,
      });
      styleCell(tripSheet, rowIndex, 1, {
        fill: { patternType: "solid", fgColor: { rgb: palette.paleMint } },
        font: { name: "Aptos", sz: 10, color: { rgb: palette.ink } },
        alignment: { vertical: "center" },
        border: bottomBorder,
        ...(index >= 2 ? { numFmt: "mmm d, yyyy" } : {}),
      });
    });

    const tripSubtitle = [trip.name.trim(), trip.destination.trim()].filter(Boolean).join("  |  ") || "Your upcoming adventure";
    const itinerarySheet = XLSX.utils.aoa_to_sheet([
      ["YOUR DAY-BY-DAY ITINERARY"],
      [tripSubtitle],
      [],
      ["DAY", "DATE", "TIME", "ACTIVITY", "LOCATION", "NOTES"],
      ...itineraryRows,
    ]);
    itinerarySheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    ];
    itinerarySheet["!cols"] = [{ wch: 9 }, { wch: 20 }, { wch: 13 }, { wch: 34 }, { wch: 28 }, { wch: 42 }];
    itinerarySheet["!rows"] = [
      { hpt: 38 },
      { hpt: 25 },
      { hpt: 10 },
      { hpt: 27 },
      ...itineraryRows.map(() => ({ hpt: 30 })),
    ];
    itinerarySheet["!autofilter"] = { ref: `A4:F${Math.max(itineraryRows.length + 4, 5)}` };
    styleRow(itinerarySheet, 0, 0, 5, titleStyle);
    styleRow(itinerarySheet, 1, 0, 5, subtitleStyle);
    styleRow(itinerarySheet, 3, 0, 5, headerStyle);
    itineraryRows.forEach((row, index) => {
      const rowIndex = index + 4;
      const dayIndex = Number(row[0]) - 1;
      const dayColor = dayIndex % 2 === 0 ? palette.white : palette.blue;
      for (let column = 0; column < 6; column += 1) {
        styleCell(itinerarySheet, rowIndex, column, {
          fill: { patternType: "solid", fgColor: { rgb: dayColor } },
          font: { name: "Aptos", sz: 10, color: { rgb: palette.ink } },
          alignment: { vertical: "center", wrapText: column >= 3 },
          border: bottomBorder,
          ...(column === 1 ? { numFmt: "ddd, mmm d, yyyy" } : {}),
          ...(column === 2 ? { numFmt: "h:mm AM/PM" } : {}),
        });
      }
      styleCell(itinerarySheet, rowIndex, 0, {
        fill: { patternType: "solid", fgColor: { rgb: palette.paleOrange } },
        font: { name: "Aptos", sz: 10, bold: true, color: { rgb: palette.forest } },
        alignment: { horizontal: "center", vertical: "center" },
        border: bottomBorder,
      });
    });
    const essentialRows = trip.essentials.map((item) => [item.name, item.packed ? "Packed" : "To pack"]);
    const essentialsSheet = XLSX.utils.aoa_to_sheet([
      ["TRIP ESSENTIALS"],
      [`${trip.essentials.filter((item) => item.packed).length} of ${trip.essentials.length} packed`],
      [],
      ["ESSENTIAL", "STATUS"],
      ...essentialRows,
    ]);
    essentialsSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    essentialsSheet["!cols"] = [{ wch: 36 }, { wch: 18 }];
    essentialsSheet["!rows"] = [
      { hpt: 38 },
      { hpt: 25 },
      { hpt: 10 },
      { hpt: 27 },
      ...essentialRows.map(() => ({ hpt: 28 })),
    ];
    essentialsSheet["!autofilter"] = { ref: `A4:B${Math.max(essentialRows.length + 4, 5)}` };
    styleRow(essentialsSheet, 0, 0, 1, titleStyle);
    styleRow(essentialsSheet, 1, 0, 1, subtitleStyle);
    styleRow(essentialsSheet, 3, 0, 1, headerStyle);
    essentialRows.forEach((row, index) => {
      const rowIndex = index + 4;
      const fill = trip.essentials[index].packed ? palette.mint : palette.paleOrange;
      styleRow(essentialsSheet, rowIndex, 0, 1, {
        fill: { patternType: "solid", fgColor: { rgb: fill } },
        font: { name: "Aptos", sz: 10, color: { rgb: palette.ink } },
        alignment: { vertical: "center" },
        border: bottomBorder,
      });
      if (trip.essentials[index].packed) {
        styleCell(essentialsSheet, rowIndex, 1, {
          fill: { patternType: "solid", fgColor: { rgb: palette.mint } },
          font: { name: "Aptos", sz: 10, bold: true, color: { rgb: palette.green } },
          alignment: { vertical: "center" },
          border: bottomBorder,
        });
      }
    });
    XLSX.utils.book_append_sheet(workbook, tripSheet, "Trip");
    XLSX.utils.book_append_sheet(workbook, itinerarySheet, "Itinerary");
    XLSX.utils.book_append_sheet(workbook, essentialsSheet, "Essentials");
    const safeName = (trip.name.trim() || trip.destination.trim() || "my-itinerary")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "my-itinerary";
    XLSX.writeFile(workbook, `${safeName}.xlsx`);
    showToast("Your Excel itinerary is ready to share.");
  }

  function styleCell(sheet, row, column, style) {
    const address = XLSX.utils.encode_cell({ r: row, c: column });
    if (!sheet[address]) sheet[address] = { t: "s", v: "" };
    sheet[address].s = style;
  }

  function styleRow(sheet, row, firstColumn, lastColumn, style) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      styleCell(sheet, row, column, style);
    }
  }

  function handleDayListClick(event) {
    const addFirst = event.target.closest("[data-action='add-first-day']");
    if (addFirst) {
      addDay();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, dayId } = button.dataset;
    if (action === "add-activity") addActivity(dayId);
    if (action === "remove-day") {
      if (window.confirm("Remove this day and all its activities?")) removeDay(dayId);
    }
    if (action === "remove-activity") {
      const day = trip.days.find((item) => item.id === dayId);
      if (day) {
        day.activities.splice(Number(button.dataset.activityIndex), 1);
        renderAll();
      }
    }
  }

  function handleEssentialSubmit(event) {
    event.preventDefault();
    addEssential(elements.essentialInput.value);
  }

  function handleEssentialClick(event) {
    const suggestion = event.target.closest("[data-essential-suggestion]");
    if (suggestion) {
      addEssential(suggestion.dataset.essentialSuggestion);
      return;
    }
    const removeButton = event.target.closest("[data-action='remove-essential']");
    if (!removeButton) return;
    const row = removeButton.closest("[data-essential-id]");
    trip.essentials = trip.essentials.filter((item) => item.id !== row.dataset.essentialId);
    renderAll();
  }

  function handleEssentialInput(event) {
    if (!event.target.matches("[data-essential-name]")) return;
    const row = event.target.closest("[data-essential-id]");
    const item = trip.essentials.find((essential) => essential.id === row.dataset.essentialId);
    if (item) item.name = event.target.value;
  }

  function handleEssentialChange(event) {
    if (!event.target.matches("[data-essential-packed]")) return;
    const row = event.target.closest("[data-essential-id]");
    const item = trip.essentials.find((essential) => essential.id === row.dataset.essentialId);
    if (!item) return;
    item.packed = event.target.checked;
    row.classList.toggle("is-packed", item.packed);
    renderSummary();
  }

  function handleDayListInput(event) {
    const dayDateInput = event.target.closest("[data-day-date]");
    if (dayDateInput) {
      const day = trip.days.find((item) => item.id === dayDateInput.dataset.dayDate);
      if (day) {
        day.date = dayDateInput.value;
        const card = dayDateInput.closest(".day-card");
        $(".day-heading-text span", card).textContent = formatDayDate(day.date);
        renderNavigation();
      }
      return;
    }
    const field = event.target.closest("[data-field]");
    if (!field) return;
    const card = field.closest(".day-card");
    const row = field.closest(".activity-row");
    updateActivity(card.dataset.dayId, Number(row.dataset.activityIndex), field.dataset.field, field.value);
  }

  function handleNavigationClick(event) {
    const button = event.target.closest("[data-action='navigate-day']");
    if (!button) return;
    const card = $(`#day-${CSS.escape(button.dataset.dayId)}`);
    setActiveDay(button.dataset.dayId);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  elements.welcomeImport.addEventListener("click", openFilePicker);
  elements.welcomeNew.addEventListener("click", () => {
    trip = createEmptyTrip();
    activeDayId = null;
    renderAll();
    elements.welcome.classList.add("hidden");
    elements.tripName.focus();
  });
  elements.importButton.addEventListener("click", openFilePicker);
  elements.sidebarImport.addEventListener("click", openFilePicker);
  elements.exportButton.addEventListener("click", exportWorkbook);
  elements.pdfButton.addEventListener("click", exportPdf);
  elements.addDayButton.addEventListener("click", addDay);
  elements.sidebarAddDay.addEventListener("click", addDay);
  elements.fileInput.addEventListener("change", (event) => importWorkbook(event.target.files?.[0]));
  elements.essentialForm.addEventListener("submit", handleEssentialSubmit);
  elements.essentialsSection.addEventListener("click", handleEssentialClick);
  elements.essentialsList.addEventListener("input", handleEssentialInput);
  elements.essentialsList.addEventListener("change", handleEssentialChange);
  elements.tripName.addEventListener("input", (event) => updateTripField("name", event.target.value));
  elements.destination.addEventListener("input", (event) => updateTripField("destination", event.target.value));
  elements.startDate.addEventListener("change", (event) => updateTripField("startDate", event.target.value));
  elements.endDate.addEventListener("change", (event) => updateTripField("endDate", event.target.value));
  elements.daysList.addEventListener("click", handleDayListClick);
  elements.daysList.addEventListener("input", handleDayListInput);
  elements.daysList.addEventListener("change", handleDayListInput);
  elements.daysList.addEventListener("dragstart", handleDragStart);
  elements.daysList.addEventListener("dragover", handleDragOver);
  elements.daysList.addEventListener("drop", handleDrop);
  elements.daysList.addEventListener("dragend", handleDragEnd);
  elements.dayNavigation.addEventListener("click", handleNavigationClick);
  elements.daysList.addEventListener("focusin", (event) => {
    const card = event.target.closest(".day-card");
    if (card) setActiveDay(card.dataset.dayId);
  });

  renderAll();
})();
