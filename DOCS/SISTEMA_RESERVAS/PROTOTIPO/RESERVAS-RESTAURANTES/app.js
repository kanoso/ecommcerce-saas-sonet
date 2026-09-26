"use strict";

const byId = (id) => document.getElementById(id);
const labels = { pending: "Pendiente", confirmed: "Confirmada", cancelled: "Cancelada", rejected: "Rechazada" };
const localDate = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const formatDate = (value) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const setStatus = (element, state) => {
  element.dataset.state = state;
  element.textContent = labels[state];
};

if (document.body.dataset.page === "booking") {
  const form = byId("booking-form");
  const date = byId("booking-date");
  date.min = localDate();
  date.value = localDate(1);
  const validateDate = () => {
    date.min = localDate();
    date.setCustomValidity(date.value && date.value < date.min ? "Seleccionar hoy o una fecha futura." : "");
  };
  date.addEventListener("input", validateDate);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validateDate();
    const name = byId("guest-name");
    name.setCustomValidity(name.value.trim() ? "" : "Ingresar un nombre ficticio.");
    if (!form.reportValidity()) return;
    byId("result-date").textContent = `${formatDate(date.value)} · ${byId("time").value}`;
    byId("result-party").textContent = `${byId("party").value} persona(s)`;
    form.hidden = true;
    byId("booking-result").hidden = false;
    byId("booking-result").focus();
  });
  byId("guest-name").addEventListener("input", () => byId("guest-name").setCustomValidity(""));
  byId("new-booking").addEventListener("click", () => {
    form.reset();
    date.value = localDate(1);
    validateDate();
    form.hidden = false;
    byId("booking-result").hidden = true;
    byId("party").focus();
  });
}

if (document.body.dataset.page === "tracking") {
  const samples = [
    { code: "OL-101", state: "pending", date: localDate(1), time: "19:00", party: 2 },
    { code: "OL-102", state: "confirmed", date: localDate(1), time: "20:00", party: 4 }
  ];
  const sample = () => samples[Number(byId("tracking-sample").value)];
  const render = () => {
    const current = sample();
    setStatus(byId("tracking-status"), current.state);
    byId("tracking-title").textContent = { pending: "Todavía no hay una mesa confirmada.", confirmed: "Este ejemplo está confirmado.", cancelled: "Este ejemplo fue cancelado." }[current.state];
    byId("tracking-description").textContent = { pending: "El equipo revisaría la solicitud antes de confirmarla. Este ejemplo no bloquea mesas.", confirmed: "En una reserva real, la aprobación indicaría que el personal ya validó y asignó una mesa.", cancelled: "No quedan acciones disponibles para este ejemplo. Recargar la página restablece los datos." }[current.state];
    byId("tracking-code").textContent = current.code;
    byId("tracking-date").textContent = `${formatDate(current.date)} · ${current.time}`;
    byId("tracking-party").textContent = current.party;
    byId("cancel-booking").disabled = current.state === "cancelled";
    samples.forEach((item, index) => { byId("tracking-sample").options[index].textContent = `${item.code} · ${labels[item.state].toLowerCase()}`; });
  };
  byId("tracking-sample").addEventListener("change", () => { byId("tracking-message").textContent = ""; render(); });
  byId("cancel-booking").addEventListener("click", () => {
    byId("cancel-dialog").returnValue = "";
    byId("cancel-dialog").showModal();
  });
  byId("cancel-dialog").addEventListener("close", () => {
    if (byId("cancel-dialog").returnValue !== "confirm") return;
    sample().state = "cancelled";
    render();
    byId("tracking-message").textContent = "Cancelación simulada. No se ha enviado ningún mensaje.";
    byId("tracking-sample").focus();
  });
  render();
}

if (document.body.dataset.page === "agenda") {
  const initialRows = () => [
    { code: "OL-201", name: "Marina Ejemplo", date: localDate(), time: "12:00", party: 2, state: "confirmed" },
    { code: "OL-202", name: "Diego Demo", date: localDate(), time: "19:00", party: 4, state: "pending" },
    { code: "OL-203", name: "Lucía Muestra", date: localDate(), time: "19:30", party: 2, state: "pending" },
    { code: "OL-204", name: "Pablo Ejemplo", date: localDate(), time: "20:00", party: 6, state: "confirmed" },
    { code: "OL-205", name: "Ana Demo", date: localDate(1), time: "19:00", party: 3, state: "pending" }
  ];
  let rows = initialRows();
  byId("agenda-date").value = localDate();
  const render = () => {
    const dayRows = rows.filter((row) => row.date === byId("agenda-date").value);
    const filtered = dayRows.filter((row) => byId("status-filter").value === "all" || row.state === byId("status-filter").value);
    byId("count-total").textContent = dayRows.length;
    byId("count-pending").textContent = dayRows.filter((row) => row.state === "pending").length;
    byId("count-confirmed").textContent = dayRows.filter((row) => row.state === "confirmed").length;
    byId("visible-count").textContent = filtered.length;
    // Only fixed, internal fixture values are interpolated; no form/contact data.
    byId("agenda-rows").innerHTML = filtered.length ? filtered.map((row) => `<tr><td>${row.time}</td><td><span class="table-name">${row.name}</span><span class="table-code">${row.code}</span></td><td>${row.party}</td><td><span class="status" data-state="${row.state}">${labels[row.state]}</span></td><td>${row.state === "pending" ? `<button type="button" data-code="${row.code}" data-action="confirmed" aria-label="Simular confirmación de ${row.code}">Confirmar</button><button type="button" class="danger" data-code="${row.code}" data-action="rejected" aria-label="Simular rechazo de ${row.code}">Rechazar</button>` : "Sin acciones en esta demo"}</td></tr>`).join("") : '<tr><td colspan="5">No hay ejemplos para esta fecha y estado.</td></tr>';
  };
  byId("agenda-date").addEventListener("change", () => { byId("agenda-message").textContent = ""; render(); });
  byId("status-filter").addEventListener("change", () => { byId("agenda-message").textContent = ""; render(); });
  byId("agenda-rows").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-code]");
    if (!button) return;
    const row = rows.find((item) => item.code === button.dataset.code);
    if (!row || row.state !== "pending") return;
    row.state = button.dataset.action;
    render();
    byId("agenda-message").textContent = `${row.code}: ${labels[row.state]}. Cambio simulado, sin asignación ni validación de mesas.`;
    byId("status-filter").focus();
  });
  byId("reset-agenda").addEventListener("click", () => {
    rows = initialRows();
    byId("agenda-date").value = localDate();
    byId("status-filter").value = "all";
    render();
    byId("agenda-message").textContent = "Ejemplos restablecidos. No se modificaron otras pantallas.";
  });
  render();
}
