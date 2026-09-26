// Optional checks: node DOCS/PROTOTIPO/RESERVAS-RESTAURANTES/verify.cjs
// DOM stubs exercise state logic, not browser rendering or native validation.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const pages = ["index.html", "reserva.html", "seguimiento.html", "agenda.html"];
for (const page of pages) {
  const html = fs.readFileSync(path.join(__dirname, page), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${page}: duplicate IDs`);
  for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (link.startsWith("#")) assert(ids.includes(link.slice(1)), `${page}: missing anchor`);
    else assert(fs.existsSync(path.resolve(__dirname, link)), `${page}: missing ${link}`);
  }
}
function setup(page, file) {
  const html = fs.readFileSync(path.join(__dirname, file), "utf8");
  const nodes = {};
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    nodes[id] = {
      value: "", dataset: {}, options: [{}, {}], handlers: {}, hidden: false,
      addEventListener(name, handler) { this.handlers[name] = handler; },
      setCustomValidity(message) { this.validationMessage = message; },
      reportValidity() { return !Object.values(nodes).some((node) => node.validationMessage); },
      focus() { this.focused = true; }, reset() {}, showModal() { this.open = true; }
    };
  }
  if (page === "tracking") nodes["tracking-sample"].value = "0";
  if (page === "agenda") nodes["status-filter"].value = "all";
  vm.runInNewContext(source, { document: { body: { dataset: { page } }, getElementById: (id) => { assert(nodes[id], `Missing ${id}`); return nodes[id]; } }, Date, Intl });
  const fire = (id, event, detail = {}) => nodes[id].handlers[event]({ preventDefault() {}, ...detail });
  return { nodes, fire };
}
{
  const { nodes: n, fire } = setup("booking", "reserva.html");
  n["guest-name"].value = "Alex Ejemplo";
  n.time.value = "19:00";
  n.party.value = "4";
  const validDate = n["booking-date"].value;
  n["booking-date"].value = "2000-01-01";
  fire("booking-date", "input");
  assert(n["booking-date"].validationMessage);
  fire("booking-form", "submit");
  assert.equal(n["booking-form"].hidden, false);
  n["booking-date"].value = validDate;
  fire("booking-date", "input");
  n["guest-name"].value = "   ";
  fire("booking-form", "submit");
  assert(n["guest-name"].validationMessage);
  n["guest-name"].value = "Alex Ejemplo";
  fire("guest-name", "input");
  fire("booking-form", "submit");
  assert.equal(n["booking-form"].hidden, true);
  assert.equal(n["booking-result"].hidden, false);
  assert.equal(n["result-party"].textContent, "4 persona(s)");
  fire("new-booking", "click");
  assert.equal(n["booking-form"].hidden, false);
}
{
  const { nodes: n, fire } = setup("tracking", "seguimiento.html");
  assert.equal(n["tracking-status"].textContent, "Pendiente");
  fire("cancel-booking", "click");
  n["cancel-dialog"].returnValue = "back";
  fire("cancel-dialog", "close");
  assert.equal(n["tracking-status"].textContent, "Pendiente");
  n["tracking-sample"].value = "1";
  fire("tracking-sample", "change");
  assert.equal(n["tracking-status"].textContent, "Confirmada");
  fire("cancel-booking", "click");
  n["cancel-dialog"].returnValue = "confirm";
  fire("cancel-dialog", "close");
  assert.equal(n["tracking-status"].textContent, "Cancelada");
  assert.equal(n["cancel-booking"].disabled, true);
}
{
  const { nodes: n, fire } = setup("agenda", "agenda.html");
  assert.equal(n["count-total"].textContent, 4);
  assert.equal(n["count-pending"].textContent, 2);
  n["status-filter"].value = "pending";
  fire("status-filter", "change");
  assert.equal(n["visible-count"].textContent, 2);
  const action = (code, state) => fire("agenda-rows", "click", { target: { closest: () => ({ dataset: { code, action: state } }) } });
  action("OL-202", "confirmed");
  assert.equal(n["count-confirmed"].textContent, 3);
  assert.equal(n["visible-count"].textContent, 1);
  action("OL-203", "rejected");
  assert.equal(n["visible-count"].textContent, 0);
  assert.match(n["agenda-rows"].innerHTML, /No hay ejemplos/);
  n["agenda-date"].value = "2000-01-01";
  fire("agenda-date", "change");
  assert.equal(n["count-total"].textContent, 0);
  fire("reset-agenda", "click");
  assert.equal(n["count-total"].textContent, 4);
  assert.equal(n["count-pending"].textContent, 2);
}
console.log("PASS: local links/assets, unique IDs and booking/tracking/agenda state logic. Browser rendering and native validation not tested.");
