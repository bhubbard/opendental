// Open Dental Cloudflare Edge Client
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initDateNavigator();
  initWebSocket();
  loadOperatorySchedule();
  loadPatientsList();
  renderToothChart();
  initApiSandbox();
});

let currentDate = new Date().toISOString().split("T")[0];
let selectedPatientId = 1;
let socket = null;

// Navigation
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item button");
  navItems.forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
      btn.parentElement.classList.add("active");

      const targetTab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
      const targetPane = document.getElementById(targetTab);
      if (targetPane) targetPane.classList.add("active");

      if (targetTab === "tab-schedule") loadOperatorySchedule();
      if (targetTab === "tab-patients") loadPatientsList();
      if (targetTab === "tab-ledger") loadTreatmentPlan(selectedPatientId);
      if (targetTab === "tab-docs") loadDocuments(selectedPatientId);
    });
  });
}

// Date Navigator
function initDateNavigator() {
  const dateLabel = document.getElementById("current-date-display");
  const updateDisplay = () => {
    dateLabel.textContent = new Date(currentDate + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };
  updateDisplay();

  document.getElementById("btn-prev-day").addEventListener("click", () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    currentDate = d.toISOString().split("T")[0];
    updateDisplay();
    loadOperatorySchedule();
  });

  document.getElementById("btn-next-day").addEventListener("click", () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    currentDate = d.toISOString().split("T")[0];
    updateDisplay();
    loadOperatorySchedule();
  });

  document.getElementById("btn-today").addEventListener("click", () => {
    currentDate = new Date().toISOString().split("T")[0];
    updateDisplay();
    loadOperatorySchedule();
  });
}

// WebSocket Connection to Durable Objects
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/schedule?clinicId=1`;

  try {
    socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      document.getElementById("ws-status").textContent = "Edge Connected (DO)";
    };
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "APPOINTMENT_CREATED" || data.type === "APPOINTMENT_UPDATED") {
          loadOperatorySchedule();
        }
      } catch {}
    };
    socket.onclose = () => {
      document.getElementById("ws-status").textContent = "Edge Offline (Reconnecting)";
      setTimeout(initWebSocket, 3000);
    };
  } catch {
    document.getElementById("ws-status").textContent = "HTTP Polling Mode";
  }
}

// Operatory Schedule
async function loadOperatorySchedule() {
  try {
    const [opsRes, aptsRes] = await Promise.all([
      fetch("/api/v1/providers/operatories").then(r => r.json()),
      fetch(`/api/v1/appointments?date=${currentDate}&clinicId=1`).then(r => r.json())
    ]);

    const grid = document.getElementById("operatory-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const operatories = opsRes.operatories || [];
    const appointments = aptsRes.appointments || [];

    operatories.forEach(op => {
      const col = document.createElement("div");
      col.className = "op-column";

      col.innerHTML = `
        <div class="op-header">
          <div class="op-name">${op.OpName}</div>
          <div class="op-provider">${op.HygAbbr ? op.HygAbbr + ' / ' : ''}${op.DentistAbbr || 'Dr. Brandon Hubbard'}</div>
        </div>
        <div class="op-slots" id="op-slot-${op.OperatoryNum}"></div>
      `;

      grid.appendChild(col);

      const slotsContainer = col.querySelector(`#op-slot-${op.OperatoryNum}`);
      const opApts = appointments.filter(a => a.Op === op.OperatoryNum);

      if (opApts.length === 0) {
        slotsContainer.innerHTML = `<div style="color: #94a3b8; font-size: 0.82rem; text-align: center; margin-top: 20px;">No appointments</div>`;
      } else {
        opApts.forEach(apt => {
          const card = document.createElement("div");
          card.className = "apt-card";
          const time = new Date(apt.AptDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const statusClasses = {
            1: "status-scheduled",
            2: "status-complete",
            3: "status-arrived",
            4: "status-seated"
          };
          const statusLabels = {
            1: "Scheduled",
            2: "Complete",
            3: "Arrived",
            4: "In Chair"
          };

          card.innerHTML = `
            <div class="apt-time">${time}</div>
            <div class="apt-patient">${apt.PatientName || 'Patient #' + apt.PatNum}</div>
            <div class="apt-procs">${apt.ProcDescript || 'Dental Exam'}</div>
            <span class="apt-status-badge ${statusClasses[apt.AptStatus] || 'status-scheduled'}">
              ${statusLabels[apt.AptStatus] || 'Scheduled'}
            </span>
          `;

          card.addEventListener("click", () => {
            selectedPatientId = apt.PatNum;
            loadTreatmentPlan(apt.PatNum);
            loadDocuments(apt.PatNum);
          });

          slotsContainer.appendChild(card);
        });
      }
    });
  } catch (err) {
    console.error("Failed to load operatory schedule:", err);
  }
}

// Patients List
async function loadPatientsList() {
  const container = document.getElementById("patients-table-body");
  if (!container) return;

  try {
    const res = await fetch("/api/v1/patients").then(r => r.json());
    container.innerHTML = "";

    (res.patients || []).forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${p.PatNum}</strong></td>
        <td><strong>${p.LName}, ${p.FName}</strong> ${p.Preferred ? `(${p.Preferred})` : ''}</td>
        <td>${p.Birthdate}</td>
        <td>${p.WirelessPhone || p.HmPhone || '—'}</td>
        <td>${p.City || ''}, ${p.State || ''}</td>
        <td>
          <button class="btn-icon" onclick="selectPatient(${p.PatNum})">View Chart</button>
        </td>
      `;
      container.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load patients:", err);
  }
}

window.selectPatient = (patNum) => {
  selectedPatientId = patNum;
  document.querySelector('[data-tab="tab-chart"]').click();
  loadTreatmentPlan(patNum);
  loadDocuments(patNum);
};

// Interactive 32-Tooth Dental Chart
const TOOTH_CONDITIONS = {};

function renderToothChart() {
  const upperArch = document.getElementById("upper-arch-teeth");
  const lowerArch = document.getElementById("lower-arch-teeth");
  if (!upperArch || !lowerArch) return;

  upperArch.innerHTML = "";
  lowerArch.innerHTML = "";

  // Upper Arch (1 to 16)
  for (let i = 1; i <= 16; i++) {
    upperArch.appendChild(createToothElement(String(i)));
  }

  // Lower Arch (32 down to 17)
  for (let i = 32; i >= 17; i--) {
    lowerArch.appendChild(createToothElement(String(i)));
  }
}

function createToothElement(num) {
  const el = document.createElement("div");
  el.className = "tooth-item";
  el.id = `tooth-${num}`;

  el.innerHTML = `
    <span class="tooth-num">${num}</span>
    <div class="tooth-visual"></div>
    <span class="tooth-cond-text" id="tooth-cond-${num}">OK</span>
  `;

  el.addEventListener("click", () => {
    document.querySelectorAll(".tooth-item").forEach(t => t.classList.remove("selected"));
    el.classList.add("selected");
    document.getElementById("selected-tooth-label").textContent = `Tooth #${num}`;
  });

  return el;
}

window.setToothStatus = (status) => {
  const selected = document.querySelector(".tooth-item.selected");
  if (!selected) {
    alert("Please click on a tooth in the chart first.");
    return;
  }
  const toothNum = selected.id.replace("tooth-", "");
  selected.className = `tooth-item selected status-${status}`;
  document.getElementById(`tooth-cond-${toothNum}`).textContent = status.substring(0, 4).toUpperCase();
};

// Treatment Plan / Ledger
async function loadTreatmentPlan(patNum) {
  const container = document.getElementById("tp-table-body");
  if (!container) return;

  try {
    const res = await fetch(`/api/v1/procedurelogs/logs?patNum=${patNum}`).then(r => r.json());
    container.innerHTML = "";

    let total = 0;
    (res.procedures || []).forEach(proc => {
      total += proc.ProcFee;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><code>${proc.ProcCode}</code></td>
        <td>${proc.Descript}</td>
        <td>${proc.ToothNum ? '#' + proc.ToothNum : '—'}</td>
        <td>${proc.Surf || '—'}</td>
        <td>$${proc.ProcFee.toFixed(2)}</td>
        <td><span class="apt-status-badge ${proc.ProcStatus === 2 ? 'status-complete' : 'status-scheduled'}">
          ${proc.ProcStatus === 2 ? 'Completed' : 'Planned'}
        </span></td>
      `;
      container.appendChild(tr);
    });

    document.getElementById("tp-total-amount").textContent = `$${total.toFixed(2)}`;
  } catch (err) {
    console.error("Failed to load treatment plan:", err);
  }
}

// Documents (Cloudflare R2)
async function loadDocuments(patNum) {
  const container = document.getElementById("docs-grid");
  if (!container) return;

  try {
    const res = await fetch(`/api/v1/documents?patNum=${patNum}`).then(r => r.json());
    container.innerHTML = "";

    if (!res.documents || res.documents.length === 0) {
      container.innerHTML = `<p style="color: #94a3b8;">No documents or X-rays stored in Cloudflare R2 for this patient.</p>`;
      return;
    }

    res.documents.forEach(doc => {
      const card = document.createElement("div");
      card.className = "apt-card";
      card.innerHTML = `
        <div style="font-weight: 700;">${doc.FileName}</div>
        <div style="font-size: 0.78rem; color: #64748b;">${new Date(doc.DateCreated).toLocaleDateString()} · ${(doc.FileSize / 1024).toFixed(1)} KB</div>
        <div style="margin-top: 8px;">
          <a href="/api/v1/documents/${doc.DocNum}/download" target="_blank" class="btn-icon" style="text-decoration: none;">Download from R2</a>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load documents:", err);
  }
}

// API Sandbox
function initApiSandbox() {
  const runBtn = document.getElementById("btn-run-query");
  if (!runBtn) return;

  runBtn.addEventListener("click", async () => {
    const queryInput = document.getElementById("sql-query-input").value;
    const output = document.getElementById("query-output");
    output.textContent = "Executing against Cloudflare D1...";

    try {
      const res = await fetch("/api/v1/queries/ShortQuery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ SqlCommand: queryInput })
      }).then(r => r.json());

      output.textContent = JSON.stringify(res, null, 2);
    } catch (err) {
      output.textContent = `Error: ${err.message}`;
    }
  });
}
