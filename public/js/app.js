import { api, setSession, clearSession, getToken } from "./api.js";
const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const authSubmit = document.querySelector("#auth-submit");
const listEl = document.querySelector("#list");
const form = document.querySelector("#league-form");
const formError = document.querySelector("#form-error");
let mode = "login";
const showError = (el, message) => { el.hidden = !message; el.textContent = message || ""; };

function tableOf(league) {
  const stats = {};
  league.teams.forEach((t) => { stats[t] = { pts: 0, pj: 0, gf: 0, gc: 0 }; });
  league.matches.forEach((m) => {
    if (!stats[m.home] || !stats[m.away]) return;
    stats[m.home].pj++; stats[m.away].pj++;
    stats[m.home].gf += m.homeScore; stats[m.home].gc += m.awayScore;
    stats[m.away].gf += m.awayScore; stats[m.away].gc += m.homeScore;
    if (m.homeScore > m.awayScore) stats[m.home].pts += 3;
    else if (m.homeScore < m.awayScore) stats[m.away].pts += 3;
    else { stats[m.home].pts++; stats[m.away].pts++; }
  });
  return Object.entries(stats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));
}

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  authSubmit.textContent = mode === "login" ? "Entrar" : "Crear cuenta";
}
async function refresh() {
  const data = await api("/api/leagues");
  listEl.innerHTML = "";
  data.leagues.forEach((l) => {
    const box = document.createElement("div");
    box.className = "league";
    const title = document.createElement("strong");
    title.textContent = l.name;
    box.append(title);
    const table = document.createElement("table");
    table.innerHTML = "<tr><th>Equipo</th><th>PJ</th><th>Pts</th><th>GF</th><th>GC</th></tr>";
    tableOf(l).forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${row.name}</td><td>${row.pj}</td><td>${row.pts}</td><td>${row.gf}</td><td>${row.gc}</td>`;
      table.append(tr);
    });
    box.append(table);
    const matchForm = document.createElement("form");
    matchForm.className = "form";
    matchForm.innerHTML = `<input placeholder="Local" /><input placeholder="Visitante" /><input type="number" placeholder="Goles L" /><input type="number" placeholder="Goles V" /><button class="primary" type="submit">Agregar</button>`;
    matchForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const [home, away, hs, as] = [...matchForm.querySelectorAll("input")].map((i) => i.value.trim());
      await api(`/api/leagues/${l.id}/match`, { method: "POST", body: JSON.stringify({ home, away, homeScore: Number(hs), awayScore: Number(as) }) });
      await refresh();
    });
    box.append(matchForm);
    const del = document.createElement("button");
    del.className = "ghost";
    del.textContent = "Borrar liga";
    del.addEventListener("click", async () => { await api(`/api/leagues/${l.id}`, { method: "DELETE" }); await refresh(); });
    box.append(del);
    listEl.append(box);
  });
}
async function boot() {
  if (!getToken()) return;
  try {
    const { user } = await api("/api/auth/me");
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.querySelector("#user-name").textContent = user.username;
    await refresh();
  } catch { clearSession(); }
}
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  const fd = new FormData(authForm);
  try {
    const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
    setSession(data.token);
    authForm.reset();
    await boot();
  } catch (err) { showError(authError, err.message); }
});
document.querySelector("#logout").addEventListener("click", () => { clearSession(); appView.classList.add("hidden"); authView.classList.remove("hidden"); });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  try {
    const teams = document.querySelector("#teams").value.split(",").map((t) => t.trim()).filter(Boolean);
    await api("/api/leagues", { method: "POST", body: JSON.stringify({ name: document.querySelector("#name").value.trim(), teams }) });
    form.reset();
    await refresh();
  } catch (err) { showError(formError, err.message); }
});
boot();
