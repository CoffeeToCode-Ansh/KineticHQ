// admin.js — standalone script for admin.html only. Does not touch script.js.

const STATUS_LABELS = { new: "New", "in-progress": "In progress", resolved: "Resolved" };
const TOKEN_KEY = "kinetichq_admin_token";

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || "",
  page: 1,
  limit: 10,
  total: 0,
  search: "",
  status: "",
  activeEnquiryId: null,
  debounceTimer: null,
};

// ---------- Elements ----------
const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const tokenInput = document.getElementById("tokenInput");
const loginError = document.getElementById("loginError");

const dashboard = document.getElementById("dashboard");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const refreshBtn = document.getElementById("refreshBtn");
const listMeta = document.getElementById("listMeta");
const enquiriesBody = document.getElementById("enquiriesBody");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageLabel = document.getElementById("pageLabel");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalName = document.getElementById("modalName");
const modalEmail = document.getElementById("modalEmail");
const modalPhone = document.getElementById("modalPhone");
const modalDate = document.getElementById("modalDate");
const modalMessage = document.getElementById("modalMessage");
const modalStatusSelect = document.getElementById("modalStatusSelect");
const modalSaveBtn = document.getElementById("modalSaveBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");
const modalFeedback = document.getElementById("modalFeedback");

// ---------- API helper ----------
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": state.token,
      ...(options.headers || {}),
    },
  });
  let body = null;
  try { body = await res.json(); } catch (_) { /* no body */ }
  return { status: res.status, ok: res.ok, body };
}

// ---------- Auth ----------
function showDashboard() {
  loginScreen.hidden = true;
  dashboard.hidden = false;
  loadEnquiries();
}

function showLogin(message) {
  dashboard.hidden = true;
  loginScreen.hidden = false;
  if (message) {
    loginError.textContent = message;
    loginError.hidden = false;
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const candidate = tokenInput.value.trim();
  if (!candidate) return;
  state.token = candidate;
  const { ok, status } = await apiFetch("/api/enquiries?limit=1");
  if (ok) {
    sessionStorage.setItem(TOKEN_KEY, candidate);
    loginError.hidden = true;
    showDashboard();
  } else if (status === 401) {
    state.token = "";
    loginError.textContent = "Invalid token. Please try again.";
    loginError.hidden = false;
  } else {
    loginError.textContent = "Could not reach the server. Please try again.";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  state.token = "";
  tokenInput.value = "";
  showLogin();
});

// ---------- List loading ----------
function buildQuery() {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (state.status) params.set("status", state.status);
  params.set("page", state.page);
  params.set("limit", state.limit);
  return params.toString();
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch (_) {
    return iso || "—";
  }
}

function renderRows(enquiries) {
  enquiriesBody.innerHTML = "";
  if (enquiries.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const enquiry of enquiries) {
    const id = typeof enquiry._id === "string" ? enquiry._id : (enquiry._id && enquiry._id.toString());
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(enquiry.name)}</td>
      <td>${escapeHtml(enquiry.email)}</td>
      <td>${escapeHtml(enquiry.phone)}</td>
      <td><span class="status-pill ${enquiry.status}">${STATUS_LABELS[enquiry.status] || enquiry.status}</span></td>
      <td>${formatDate(enquiry.createdAt)}</td>
      <td class="row-actions">
        <button class="btn-secondary" data-action="view" data-id="${id}">View</button>
        <button class="btn-danger" data-action="delete" data-id="${id}">Delete</button>
      </td>
    `;
    enquiriesBody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadEnquiries() {
  loadingState.hidden = false;
  emptyState.hidden = true;
  const { ok, status, body } = await apiFetch(`/api/enquiries?${buildQuery()}`);
  loadingState.hidden = true;

  if (status === 401) {
    showLogin("Session expired. Please log in again.");
    return;
  }
  if (!ok || !body || !body.ok) {
    listMeta.textContent = (body && body.error) || "Could not load enquiries.";
    enquiriesBody.innerHTML = "";
    return;
  }

  state.total = body.total;
  const totalPages = Math.max(Math.ceil(state.total / state.limit), 1);
  listMeta.textContent = `${state.total} enquir${state.total === 1 ? "y" : "ies"} found`;
  pageLabel.textContent = `Page ${state.page} of ${totalPages}`;
  prevPageBtn.disabled = state.page <= 1;
  nextPageBtn.disabled = state.page >= totalPages;

  renderRows(body.enquiries);
}

// ---------- Search / filter / pagination ----------
searchInput.addEventListener("input", () => {
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadEnquiries();
  }, 350);
});

statusFilter.addEventListener("change", () => {
  state.status = statusFilter.value;
  state.page = 1;
  loadEnquiries();
});

refreshBtn.addEventListener("click", loadEnquiries);

prevPageBtn.addEventListener("click", () => {
  if (state.page > 1) { state.page -= 1; loadEnquiries(); }
});
nextPageBtn.addEventListener("click", () => {
  state.page += 1;
  loadEnquiries();
});

// ---------- Row actions (event delegation) ----------
enquiriesBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === "view") {
    openModal(id);
  } else if (action === "delete") {
    if (!confirm("Delete this enquiry? This cannot be undone.")) return;
    const { ok, status, body } = await apiFetch(`/api/enquiries/${id}`, { method: "DELETE" });
    if (status === 401) return showLogin("Session expired. Please log in again.");
    if (ok) {
      loadEnquiries();
    } else {
      alert((body && body.error) || "Could not delete enquiry.");
    }
  }
});

// ---------- Modal ----------
async function openModal(id) {
  state.activeEnquiryId = id;
  modalFeedback.hidden = true;
  const { ok, status, body } = await apiFetch(`/api/enquiries/${id}`);
  if (status === 401) return showLogin("Session expired. Please log in again.");
  if (!ok || !body || !body.ok) {
    alert((body && body.error) || "Could not load enquiry.");
    return;
  }
  const enquiry = body.enquiry;
  modalName.textContent = enquiry.name;
  modalEmail.textContent = enquiry.email;
  modalPhone.textContent = enquiry.phone;
  modalDate.textContent = formatDate(enquiry.createdAt);
  modalMessage.textContent = enquiry.message || "—";
  modalStatusSelect.value = enquiry.status;
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
  state.activeEnquiryId = null;
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalSaveBtn.addEventListener("click", async () => {
  if (!state.activeEnquiryId) return;
  modalSaveBtn.disabled = true;
  const { ok, status, body } = await apiFetch(`/api/enquiries/${state.activeEnquiryId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: modalStatusSelect.value }),
  });
  modalSaveBtn.disabled = false;
  if (status === 401) return showLogin("Session expired. Please log in again.");
  modalFeedback.hidden = false;
  if (ok) {
    modalFeedback.textContent = "Status updated.";
    modalFeedback.className = "feedback-text success";
    loadEnquiries();
  } else {
    modalFeedback.textContent = (body && body.error) || "Could not update status.";
    modalFeedback.className = "feedback-text error";
  }
});

modalDeleteBtn.addEventListener("click", async () => {
  if (!state.activeEnquiryId) return;
  if (!confirm("Delete this enquiry? This cannot be undone.")) return;
  const { ok, status, body } = await apiFetch(`/api/enquiries/${state.activeEnquiryId}`, { method: "DELETE" });
  if (status === 401) return showLogin("Session expired. Please log in again.");
  if (ok) {
    closeModal();
    loadEnquiries();
  } else {
    modalFeedback.hidden = false;
    modalFeedback.textContent = (body && body.error) || "Could not delete enquiry.";
    modalFeedback.className = "feedback-text error";
  }
});

// ---------- Boot ----------
if (state.token) {
  showDashboard();
} else {
  showLogin();
}
