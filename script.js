"use strict";

const STORAGE_KEY = "careflow-clinic-data-v1";
const SLOT_INTERVAL = 15;
const DEFAULT_DATA = {
  patients: [
    { id: "p-1001", firstName: "Olivia", lastName: "Chen", phone: "(555) 201-4821", email: "olivia.chen@email.com", dob: "1988-03-16" },
    { id: "p-1002", firstName: "Noah", lastName: "Patel", phone: "(555) 201-7342", email: "noah.patel@email.com", dob: "1993-07-08" },
    { id: "p-1003", firstName: "Amara", lastName: "Johnson", phone: "(555) 201-1695", email: "amara.j@email.com", dob: "1976-11-22" },
    { id: "p-1004", firstName: "Ethan", lastName: "Williams", phone: "(555) 201-8954", email: "ethan.w@email.com", dob: "2001-02-14" },
    { id: "p-1005", firstName: "Mia", lastName: "Garcia", phone: "(555) 201-3086", email: "mia.garcia@email.com", dob: "1990-09-04" }
  ],
  doctors: [
    { id: "d-101", name: "Dr. Maya Brooks", specialty: "Family medicine", start: "09:00", end: "17:00", duration: 30, color: 0 },
    { id: "d-102", name: "Dr. James Wilson", specialty: "Pediatrics", start: "09:00", end: "16:00", duration: 30, color: 1 },
    { id: "d-103", name: "Dr. Sofia Rivera", specialty: "Internal medicine", start: "10:00", end: "18:00", duration: 30, color: 2 }
  ],
  appointments: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const patientName = (patient) => `${patient.firstName} ${patient.lastName}`;
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const formatTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};
const formatDate = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const statusLabel = (status) => ({ "in-progress": "In progress" }[status] || status.charAt(0).toUpperCase() + status.slice(1));
const statusClass = (status) => `status-${status}`;
const statusBadge = (status) => `<span class="status-badge ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>`;

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.patients) || !Array.isArray(parsed.doctors) || !Array.isArray(parsed.appointments)) {
      throw new Error("Stored clinic data has an invalid shape.");
    }
    return parsed;
  } catch (error) {
    console.error("Could not load clinic data from browser storage.", error);
    showToast("Saved clinic data could not be loaded. Changes may not persist.");
    return structuredClone(DEFAULT_DATA);
  }
}

let data = loadData();
let toastTimer;
let activeView = "overview";

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Could not save clinic data to browser storage.", error);
    showToast("Could not save changes. Check browser storage availability.");
    return false;
  }
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function getPatient(id) { return data.patients.find((patient) => patient.id === id); }
function getDoctor(id) { return data.doctors.find((doctor) => doctor.id === id); }
function todaysAppointments() {
  return data.appointments.filter((appointment) => appointment.date === dateKey() && appointment.status !== "cancelled")
    .sort((a, b) => a.time.localeCompare(b.time) || (a.token || "").localeCompare(b.token || ""));
}
function queueAppointments() {
  return todaysAppointments().filter((appointment) => appointment.status === "waiting" || appointment.status === "in-progress");
}
function initialsMarkup(name, tone = 0, extra = "") {
  return `<span class="patient-initials tone-${tone % 5} ${extra}">${escapeHtml(initials(name))}</span>`;
}
function personMarkup(patient, tone = 0) {
  const name = patientName(patient);
  return `<div class="patient-cell">${initialsMarkup(name, tone)}<span><strong>${escapeHtml(name)}</strong><small class="cell-secondary">${escapeHtml(patient.phone)}</small></span></div>`;
}
function doctorMarkup(doctor) {
  return `<div class="doctor-cell"><span class="tiny-avatar">${escapeHtml(initials(doctor?.name || "Unassigned"))}</span><span>${escapeHtml(doctor?.name || "Unassigned")}</span></div>`;
}
function populateSelect(select, items, placeholder, selected = "") {
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === selected ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}`;
}

function renderOverview() {
  const appointments = todaysAppointments();
  const waiting = queueAppointments().filter((item) => item.status === "waiting");
  const seen = appointments.filter((item) => item.status === "completed");
  $("#stat-appointments").textContent = appointments.length;
  $("#stat-waiting").textContent = waiting.length;
  $("#stat-seen").textContent = seen.length;
  $("#stat-doctors").textContent = data.doctors.length;
  $("#appointment-nav-count").textContent = appointments.length;

  const body = $("#today-table-body");
  body.innerHTML = appointments.slice(0, 5).map((appointment, index) => {
    const patient = getPatient(appointment.patientId);
    return `<tr><td>${escapeHtml(formatTime(appointment.time))}</td><td>${patient ? personMarkup(patient, index) : "Patient removed"}</td><td>${doctorMarkup(getDoctor(appointment.doctorId))}</td><td>${statusBadge(appointment.status)}</td><td><button class="row-action" data-history="${escapeHtml(appointment.patientId)}" aria-label="View patient history">···</button></td></tr>`;
  }).join("");
  $("#schedule-empty").hidden = appointments.length > 0;
  body.closest(".table-scroll").hidden = appointments.length === 0;

  const queue = queueAppointments();
  $("#overview-queue").innerHTML = queue.slice(0, 4).map((appointment, index) => {
    const patient = getPatient(appointment.patientId);
    const mins = waitMinutes(appointment);
    return `<div class="queue-person">${patient ? initialsMarkup(patientName(patient), index) : ""}<span class="queue-person-info"><strong>${escapeHtml(patient ? patientName(patient) : "Patient removed")}</strong><small>${escapeHtml(getDoctor(appointment.doctorId)?.name || "No doctor assigned")}</small></span><span class="queue-token">${escapeHtml(appointment.token || formatTime(appointment.time))}</span><span class="queue-wait">${appointment.status === "in-progress" ? "With doctor" : `${mins} min`}</span></div>`;
  }).join("");
  $("#queue-footer-count").textContent = `${queue.length} ${queue.length === 1 ? "patient" : "patients"} ${queue.length === 1 ? "in" : "in"} queue`;
  if (!queue.length) $("#overview-queue").innerHTML = `<div class="empty-state compact-empty"><span>✓</span><strong>Queue is clear</strong><p>Checked-in patients will appear here.</p></div>`;

  $("#today-doctors").innerHTML = data.doctors.slice(0, 3).map((doctor, index) => `<div class="doctor-mini"><span class="doctor-avatar tone-${index % 3}">${escapeHtml(initials(doctor.name))}</span><span><strong>${escapeHtml(doctor.name)}</strong><small>${escapeHtml(doctor.specialty)} · ${formatTime(doctor.start)}–${formatTime(doctor.end)}</small></span><i class="doctor-status" title="Available"></i></div>`).join("");
  if (!data.doctors.length) $("#today-doctors").innerHTML = `<div class="empty-state compact-empty"><strong>No doctors added</strong><p>Add a doctor profile to get started.</p></div>`;
}

function renderAppointments() {
  const search = ($("#appointment-search")?.value || "").trim().toLowerCase();
  const date = $("#appointment-date")?.value || dateKey();
  const status = $("#appointment-status")?.value || "all";
  const filtered = data.appointments.filter((appointment) => {
    const patient = getPatient(appointment.patientId);
    const doctor = getDoctor(appointment.doctorId);
    const haystack = `${patient ? patientName(patient) : ""} ${doctor?.name || ""} ${appointment.reason || ""}`.toLowerCase();
    return appointment.date === date && (status === "all" || appointment.status === status) && haystack.includes(search);
  }).sort((a, b) => a.time.localeCompare(b.time));
  $("#appointments-table-body").innerHTML = filtered.map((appointment, index) => {
    const patient = getPatient(appointment.patientId);
    const isUpdatable = !["completed", "cancelled"].includes(appointment.status);
    return `<tr><td>${escapeHtml(formatTime(appointment.time))}</td><td>${patient ? personMarkup(patient, index) : "Patient removed"}</td><td>${doctorMarkup(getDoctor(appointment.doctorId))}</td><td>${escapeHtml(appointment.reason)}</td><td>${statusBadge(appointment.status)}</td><td>${isUpdatable ? `<select class="table-status-select" data-status-id="${escapeHtml(appointment.id)}" aria-label="Update appointment status"><option value="">Update</option><option value="waiting">Check in</option><option value="in-progress">Start visit</option><option value="completed">Complete</option><option value="cancelled">Cancel</option></select>` : `<button class="row-action" data-history="${escapeHtml(appointment.patientId)}" aria-label="View patient history">History</button>`}</td></tr>`;
  }).join("");
  $("#appointments-empty").hidden = filtered.length > 0;
  $("#appointments-table-body").closest(".table-scroll").hidden = filtered.length === 0;
}

function waitMinutes(appointment) {
  if (appointment.status === "in-progress") return 0;
  if (appointment.type === "walk-in" && appointment.createdAt) {
    return Math.max(1, Math.floor((Date.now() - appointment.createdAt) / 60000));
  }
  const [hours, minutes] = appointment.time.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);
  return Math.max(0, Math.floor((Date.now() - scheduled.getTime()) / 60000));
}

function renderQueue() {
  const queue = queueAppointments();
  const waiting = queue.filter((item) => item.status === "waiting");
  const active = queue.filter((item) => item.status === "in-progress");
  $("#queue-waiting-count").textContent = waiting.length;
  $("#queue-active-count").textContent = active.length;
  const waitingTimes = waiting.map(waitMinutes);
  $("#queue-average-wait").textContent = waitingTimes.length ? `${Math.round(waitingTimes.reduce((sum, mins) => sum + mins, 0) / waitingTimes.length)} min` : "—";
  $("#queue-next-token").textContent = waiting[0]?.token || active[0]?.token || "—";
  $("#full-queue-list").innerHTML = queue.map((appointment, index) => {
    const patient = getPatient(appointment.patientId);
    const doctor = getDoctor(appointment.doctorId);
    return `<div class="full-queue-row"><span class="queue-token-big">${escapeHtml(appointment.token || `A${String(index + 1).padStart(2, "0")}`)}</span><div class="queue-row-patient">${patient ? initialsMarkup(patientName(patient), index) : ""}<span><strong>${escapeHtml(patient ? patientName(patient) : "Patient removed")}</strong><small>${escapeHtml(appointment.reason)}${appointment.type === "walk-in" ? " · Walk-in" : " · Appointment"}</small></span></div><div class="queue-row-doctor"><strong>${escapeHtml(doctor?.name || "Unassigned")}</strong><small>${escapeHtml(doctor?.specialty || "No specialty")}</small></div><span class="queue-wait-label">${appointment.status === "in-progress" ? "In consultation" : `${waitMinutes(appointment)} min waiting`}</span>${statusBadge(appointment.status)}<div class="queue-actions">${appointment.status === "waiting" ? `<button data-queue-action="in-progress" data-id="${escapeHtml(appointment.id)}">Start visit</button>` : `<button data-queue-action="completed" data-id="${escapeHtml(appointment.id)}">Complete</button>`}<button data-history="${escapeHtml(appointment.patientId)}">History</button></div></div>`;
  }).join("");
  $("#queue-empty").hidden = queue.length > 0;
  $("#full-queue-list").hidden = queue.length === 0;
}

function renderPatients() {
  const query = ($("#patient-search")?.value || "").trim().toLowerCase();
  const patients = data.patients.filter((patient) => `${patientName(patient)} ${patient.phone} ${patient.email}`.toLowerCase().includes(query));
  $("#patient-record-count").textContent = `${patients.length} ${patients.length === 1 ? "patient" : "patients"}`;
  $("#patients-table-body").innerHTML = patients.map((patient, index) => {
    const lastVisit = data.appointments.filter((appointment) => appointment.patientId === patient.id && appointment.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0];
    return `<tr><td>${personMarkup(patient, index)}</td><td>${escapeHtml(patient.phone)}</td><td>${escapeHtml(patient.email || "—")}</td><td>${escapeHtml(formatDate(patient.dob))}</td><td>${escapeHtml(lastVisit ? formatDate(lastVisit.date) : "No visits yet")}</td><td><button class="text-button" data-history="${escapeHtml(patient.id)}">History →</button></td></tr>`;
  }).join("");
  $("#patients-empty").hidden = patients.length > 0;
  $("#patients-table-body").closest(".table-scroll").hidden = patients.length === 0;
}

function renderDoctors() {
  $("#doctor-directory").innerHTML = data.doctors.map((doctor, index) => {
    const count = data.appointments.filter((appointment) => appointment.doctorId === doctor.id && appointment.date === dateKey() && appointment.status !== "cancelled").length;
    return `<article class="doctor-card"><div class="doctor-card-top"><span class="doctor-avatar tone-${index % 3}">${escapeHtml(initials(doctor.name))}</span><span><strong>${escapeHtml(doctor.name)}</strong><small>${escapeHtml(doctor.specialty)}</small></span></div><p>Clinic hours<br><strong>${formatTime(doctor.start)} – ${formatTime(doctor.end)}</strong> · ${Number(doctor.duration)} min visits</p><div class="doctor-card-footer"><span>▣ ${count} appointments today</span><button data-remove-doctor="${escapeHtml(doctor.id)}">Remove</button></div></article>`;
  }).join("");
  if (!data.doctors.length) $("#doctor-directory").innerHTML = `<section class="panel empty-state"><span>✚</span><strong>No doctors in your directory</strong><p>Add doctor profiles to schedule appointments.</p><button class="button button-secondary" data-open-modal="doctor-modal">Add a doctor</button></section>`;
}

function renderAll() {
  renderOverview();
  renderAppointments();
  renderQueue();
  renderPatients();
  renderDoctors();
  populateForms();
}

function populateForms() {
  populateSelect($("#appointment-patient"), data.patients.map((p) => ({ id: p.id, label: patientName(p) })), "Choose a patient");
  populateSelect($("#walkin-patient"), data.patients.map((p) => ({ id: p.id, label: patientName(p) })), "Choose a patient");
  populateSelect($("#appointment-doctor"), data.doctors.map((d) => ({ id: d.id, label: `${d.name} · ${d.specialty}` })), "Choose a doctor");
  populateSelect($("#walkin-doctor"), data.doctors.map((d) => ({ id: d.id, label: `${d.name} · ${d.specialty}` })), "Choose a doctor");
  updateAvailableSlots();
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
function fromMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function updateAvailableSlots() {
  const doctor = getDoctor($("#appointment-doctor")?.value);
  const date = $("#appointment-form-date")?.value;
  const select = $("#appointment-time");
  if (!select) return;
  if (!doctor || !date) {
    select.innerHTML = `<option value="">Choose a doctor and date first</option>`;
    $("#slot-help").textContent = "";
    return;
  }
  const duration = Number(doctor.duration) || 30;
  const start = toMinutes(doctor.start);
  const end = toMinutes(doctor.end);
  const booked = new Set(data.appointments.filter((a) => a.doctorId === doctor.id && a.date === date && a.status !== "cancelled").map((a) => a.time));
  const options = [];
  for (let time = start; time + duration <= end; time += SLOT_INTERVAL) {
    const value = fromMinutes(time);
    const taken = [...booked].some((bookedTime) => {
      const bookedAppt = data.appointments.find((a) => a.doctorId === doctor.id && a.date === date && a.time === bookedTime && a.status !== "cancelled");
      if (!bookedAppt) return false;
      const bookedStart = toMinutes(bookedTime);
      return time < bookedStart + duration && time + duration > bookedStart;
    });
    const past = date === dateKey() && time <= new Date().getHours() * 60 + new Date().getMinutes();
    if (!taken && !past) options.push(`<option value="${value}">${formatTime(value)}</option>`);
  }
  select.innerHTML = options.length ? `<option value="">Choose an available time</option>${options.join("")}` : `<option value="">No available slots</option>`;
  $("#slot-help").textContent = options.length ? `${options.length} available time${options.length === 1 ? "" : "s"} · ${duration}-minute visits` : "No slots available for this doctor and date.";
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (id === "appointment-modal") {
    $("#appointment-form-date").value = $("#appointment-form-date").value || dateKey();
    $("#appointment-error").textContent = "";
    updateAvailableSlots();
  }
  if (id === "patient-modal") $("#patient-error").textContent = "";
  if (id === "doctor-modal") $("#doctor-error").textContent = "";
  if (id === "walkin-modal") $("#walkin-error").textContent = "";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  $("input, select, button", modal)?.focus();
}
function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
function setView(view) {
  activeView = view;
  $$(".view").forEach((section) => section.classList.toggle("active-view", section.id === `${view}-view`));
  $$(".nav-link[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
  $("#breadcrumb-current").textContent = ({ overview: "Overview", appointments: "Appointments", queue: "Live queue", patients: "Patients", doctors: "Doctors" })[view];
  $("#sidebar").classList.remove("open");
  if (view === "appointments") renderAppointments();
  if (view === "patients") renderPatients();
}
function showHistory(patientId) {
  const patient = getPatient(patientId);
  if (!patient) return;
  $("#history-title").textContent = `${patient.firstName}’s visit history`;
  const visits = data.appointments.filter((appointment) => appointment.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  $("#history-content").innerHTML = `<div class="history-profile">${initialsMarkup(patientName(patient), 1)}<span><strong>${escapeHtml(patientName(patient))}</strong><small>${escapeHtml(patient.phone)}${patient.email ? ` · ${escapeHtml(patient.email)}` : ""}</small></span></div>${visits.length ? visits.map((visit) => `<article class="history-item"><strong>${escapeHtml(visit.reason)}</strong><p>${escapeHtml(getDoctor(visit.doctorId)?.name || "Doctor no longer listed")} · ${escapeHtml(statusLabel(visit.status))}</p><small>${formatDate(visit.date)}${visit.time ? ` at ${formatTime(visit.time)}` : ""}</small></article>`).join("") : `<div class="empty-state compact-empty"><strong>No visits recorded</strong><p>This patient’s appointments will show up here.</p></div>`}`;
  openModal("history-modal");
}

function updateAppointmentStatus(id, status) {
  const appointment = data.appointments.find((item) => item.id === id);
  if (!appointment) return;
  if (status === "waiting" && appointment.type !== "walk-in" && !appointment.token) {
    const issued = todaysAppointments()
      .map((item) => Number((item.token || "").match(/^A(\d+)$/)?.[1]) || 0);
    appointment.token = `A${String(Math.max(0, ...issued) + 1).padStart(2, "0")}`;
  }
  appointment.status = status;
  if (!saveData()) return;
  renderAll();
  showToast(`Appointment marked ${statusLabel(status).toLowerCase()}.`);
}

$("#today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
$("#appointment-date").value = dateKey();
$("#appointment-form-date").value = dateKey();
renderAll();

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, [data-history]");
  if (!target) return;
  if (target.dataset.view) setView(target.dataset.view);
  if (target.dataset.goView) setView(target.dataset.goView);
  if (target.dataset.openModal) openModal(target.dataset.openModal);
  if (target.hasAttribute("data-close-modal")) closeModal(target.closest(".modal-backdrop"));
  if (target.dataset.history) showHistory(target.dataset.history);
  if (target.dataset.queueAction) updateAppointmentStatus(target.dataset.id, target.dataset.queueAction);
  if (target.id === "mobile-menu") $("#sidebar").classList.toggle("open");
  if (target.id === "help-button") showToast("Contact your clinic administrator for help.");
  if (target.id === "settings-button") showToast("Clinic settings are coming soon.");
  if (target.dataset.removeDoctor) {
    const doctorId = target.dataset.removeDoctor;
    const hasAppointments = data.appointments.some((appointment) => appointment.doctorId === doctorId && !["completed", "cancelled"].includes(appointment.status));
    if (hasAppointments) {
      showToast("This doctor has active appointments and cannot be removed.");
    } else if (window.confirm("Remove this doctor from the clinic directory? Past appointments will be retained.")) {
      data.doctors = data.doctors.filter((doctor) => doctor.id !== doctorId);
      if (saveData()) { renderAll(); showToast("Doctor removed."); }
    }
  }
});

$$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) closeModal(backdrop);
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") $$(".modal-backdrop.open").forEach(closeModal);
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-status-id]") && event.target.value) {
    updateAppointmentStatus(event.target.dataset.statusId, event.target.value);
  }
});
$("#appointment-search").addEventListener("input", renderAppointments);
$("#appointment-date").addEventListener("change", renderAppointments);
$("#appointment-status").addEventListener("change", renderAppointments);
$("#patient-search").addEventListener("input", renderPatients);
$("#appointment-doctor").addEventListener("change", updateAvailableSlots);
$("#appointment-form-date").addEventListener("change", updateAvailableSlots);

$("#appointment-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const patientId = form.get("patientId");
  const doctorId = form.get("doctorId");
  const date = form.get("date");
  const time = form.get("time");
  const doctor = getDoctor(doctorId);
  const start = toMinutes(time || "00:00");
  const duration = Number(doctor?.duration) || 30;
  const overlaps = data.appointments.some((appointment) => appointment.doctorId === doctorId && appointment.date === date && appointment.status !== "cancelled" && start < toMinutes(appointment.time) + (Number(getDoctor(doctorId)?.duration) || 30) && start + duration > toMinutes(appointment.time));
  if (!getPatient(patientId) || !doctor || !time || overlaps) {
    $("#appointment-error").textContent = "That slot is no longer available. Choose another time.";
    updateAvailableSlots();
    return;
  }
  data.appointments.push({ id: makeId("a"), patientId, doctorId, date, time, reason: form.get("reason"), status: "scheduled", type: "appointment", token: "" });
  if (saveData()) {
    closeModal($("#appointment-modal"));
    event.currentTarget.reset();
    $("#appointment-form-date").value = dateKey();
    $("#appointment-date").value = date;
    renderAll();
    showToast("Appointment booked successfully.");
    setView("appointments");
  }
});

$("#walkin-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const patientId = form.get("patientId");
  const doctorId = form.get("doctorId");
  if (!getPatient(patientId) || !getDoctor(doctorId)) {
    $("#walkin-error").textContent = "Select a patient and doctor to create a queue token.";
    return;
  }
  const todaysTokens = todaysAppointments().filter((appointment) => appointment.token);
  const tokenNumber = todaysTokens.reduce((max, appointment) => Math.max(max, Number(appointment.token.replace(/\D/g, "")) || 0), 0) + 1;
  const token = `W${String(tokenNumber).padStart(2, "0")}`;
  data.appointments.push({ id: makeId("a"), patientId, doctorId, date: dateKey(), time: new Date().toTimeString().slice(0, 5), reason: form.get("reason"), status: "waiting", type: "walk-in", token, createdAt: Date.now() });
  if (saveData()) {
    closeModal($("#walkin-modal"));
    event.currentTarget.reset();
    renderAll();
    showToast(`Walk-in added to the queue · Token ${token}.`);
    setView("queue");
  }
});

$("#patient-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const phone = String(form.get("phone")).trim();
  if (data.patients.some((patient) => patient.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""))) {
    $("#patient-error").textContent = "A patient with this phone number is already registered.";
    return;
  }
  data.patients.push({ id: makeId("p"), firstName: String(form.get("firstName")).trim(), lastName: String(form.get("lastName")).trim(), phone, email: String(form.get("email")).trim(), dob: form.get("dob") });
  if (saveData()) {
    closeModal($("#patient-modal"));
    event.currentTarget.reset();
    renderAll();
    showToast("Patient registered successfully.");
  }
});

$("#doctor-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  if (form.get("start") >= form.get("end")) {
    $("#doctor-error").textContent = "Clinic end time must be after the start time.";
    return;
  }
  data.doctors.push({ id: makeId("d"), name: String(form.get("name")).trim(), specialty: String(form.get("specialty")).trim(), start: form.get("start"), end: form.get("end"), duration: Number(form.get("duration")), color: data.doctors.length % 3 });
  if (saveData()) {
    closeModal($("#doctor-modal"));
    event.currentTarget.reset();
    renderAll();
    showToast("Doctor profile added.");
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY && event.newValue) {
    try {
      const updated = JSON.parse(event.newValue);
      if (!Array.isArray(updated.patients) || !Array.isArray(updated.doctors) || !Array.isArray(updated.appointments)) {
        throw new Error("Stored clinic data has an invalid shape.");
      }
      data = updated;
      renderAll();
    } catch (error) {
      console.error("Could not apply clinic updates from another tab.", error);
      showToast("An update from another tab could not be loaded.");
    }
  }
});
setInterval(() => {
  if (activeView === "overview" || activeView === "queue") {
    renderOverview();
    renderQueue();
  }
}, 30000);
