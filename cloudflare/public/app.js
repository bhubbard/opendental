// Open Dental Cloudflare Edge Client
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initDateNavigator();
  initWebSocket();
  loadOperatorySchedule();
  loadPatientsList();
  renderToothChart();
  initImagingViewer();
  initPaymentsModule();
  initErxModule();
  initFormsSignatureModule();
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
      if (targetTab === "tab-imaging") renderDicomRadiograph();
      if (targetTab === "tab-payments") loadPatientLedger(selectedPatientId);
      if (targetTab === "tab-erx") loadPatientPrescriptions(selectedPatientId);
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

// Durable Object WebSocket
function initWebSocket() {
  const wsStatus = document.getElementById("ws-status");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/schedule?clinicId=1`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      wsStatus.textContent = "Edge DO: Connected (Live)";
      wsStatus.parentElement.style.background = "#dcfce7";
      wsStatus.parentElement.style.color = "#15803d";
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "APPOINTMENT_MOVED" || msg.type === "APPOINTMENT_CREATED") {
          loadOperatorySchedule();
        }
      } catch (err) {
        console.warn("WebSocket parse error:", err);
      }
    };

    socket.onclose = () => {
      wsStatus.textContent = "Edge DO: Reconnecting...";
      wsStatus.parentElement.style.background = "#fef3c7";
      wsStatus.parentElement.style.color = "#b45309";
      setTimeout(initWebSocket, 3000);
    };
  } catch {
    wsStatus.textContent = "Edge DO: Standalone Mode";
  }
}

// Operatory Schedule
async function loadOperatorySchedule() {
  const container = document.getElementById("operatory-calendar");
  if (!container) return;

  try {
    const apts = await fetch(`/api/v1/appointments?date=${currentDate}&clinicId=1`).then(r => r.json());
    container.innerHTML = "";

    const ops = [
      { id: 1, name: "Operatory 1", prov: "Dr. Smith" },
      { id: 2, name: "Operatory 2", prov: "Dr. Jones" },
      { id: 3, name: "Operatory 3", prov: "Hyg. Davis" }
    ];

    ops.forEach(op => {
      const col = document.createElement("div");
      col.className = "op-column";

      const header = document.createElement("div");
      header.className = "op-header";
      header.innerHTML = `<h3>${op.name}</h3><span>${op.prov}</span>`;
      col.appendChild(header);

      const opApts = apts.filter(a => a.Op === op.id);
      if (opApts.length === 0) {
        const empty = document.createElement("div");
        empty.style.padding = "24px";
        empty.style.color = "#94a3b8";
        empty.style.textAlign = "center";
        empty.style.fontSize = "0.85rem";
        empty.textContent = "No appointments scheduled";
        col.appendChild(empty);
      } else {
        opApts.forEach(apt => {
          const card = document.createElement("div");
          card.className = "apt-card";
          const time = new Date(apt.AptDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          card.innerHTML = `
            <div class="apt-time">${time}</div>
            <div class="apt-patient">${apt.PatientName || `Patient #${apt.PatNum}`}</div>
            <div class="apt-proc">${apt.ProcDescript || "Exam / Prophy"}</div>
          `;
          card.addEventListener("click", () => {
            selectedPatientId = apt.PatNum;
            document.querySelectorAll(".nav-item button")[1].click();
          });
          col.appendChild(card);
        });
      }

      container.appendChild(col);
    });
  } catch (err) {
    console.error("Failed to load operatory schedule:", err);
  }
}

// Patients List
async function loadPatientsList() {
  const tbody = document.getElementById("patient-table-body");
  if (!tbody) return;

  try {
    const res = await fetch("/api/v1/patients?limit=20").then(r => r.json());
    tbody.innerHTML = "";

    res.patients.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${p.PatNum}</strong></td>
        <td>${p.LName}, ${p.FName}</td>
        <td>${p.Birthdate}</td>
        <td>${p.WirelessPhone || p.HmPhone || "—"}</td>
        <td>Dr. Provider</td>
        <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">Patient</span></td>
        <td>
          <button class="btn-icon btn-select-pat" data-id="${p.PatNum}">Open Chart</button>
        </td>
      `;
      tr.querySelector(".btn-select-pat").addEventListener("click", () => {
        selectedPatientId = p.PatNum;
        document.getElementById("chart-patient-name").textContent = `${p.LName}, ${p.FName}`;
        document.getElementById("chart-patient-id").textContent = `PatNum: ${p.PatNum}`;
        document.querySelectorAll(".nav-item button")[2].click();
      });
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load patients:", err);
  }
}

// Tooth Chart
function renderToothChart() {
  const maxilla = document.getElementById("maxillary-teeth");
  const mandibula = document.getElementById("mandibular-teeth");
  if (!maxilla || !mandibula) return;

  maxilla.innerHTML = "";
  mandibula.innerHTML = "";

  for (let i = 1; i <= 16; i++) {
    maxilla.appendChild(createToothElement(i));
  }
  for (let i = 32; i >= 17; i--) {
    mandibula.appendChild(createToothElement(i));
  }
}

function createToothElement(num) {
  const tooth = document.createElement("div");
  tooth.className = "tooth-item";
  tooth.setAttribute("data-tooth", num);

  tooth.innerHTML = `
    <span class="tooth-num">${num}</span>
    <div class="tooth-crown">
      <div class="crown-surface" data-surface="O"></div>
    </div>
  `;

  tooth.addEventListener("click", () => {
    tooth.classList.toggle("selected");
  });

  return tooth;
}

// -------------------------------------------------------------
// Imaging & DICOM Viewer Module
// -------------------------------------------------------------
function initImagingViewer() {
  const canvas = document.getElementById("dicom-canvas");
  const sliderCenter = document.getElementById("slider-window-center");
  const sliderWidth = document.getElementById("slider-window-width");
  const chkInvert = document.getElementById("chk-invert-contrast");
  const valCenter = document.getElementById("val-window-center");
  const valWidth = document.getElementById("val-window-width");
  const btnAcquire = document.getElementById("btn-sensor-acquire");
  const btnDexis = document.getElementById("btn-bridge-dexis");
  const btnSchick = document.getElementById("btn-bridge-schick");

  if (!canvas) return;

  const updateWindowing = () => {
    valCenter.textContent = sliderCenter.value;
    valWidth.textContent = sliderWidth.value;
    renderDicomRadiograph();
  };

  sliderCenter?.addEventListener("input", updateWindowing);
  sliderWidth?.addEventListener("input", updateWindowing);
  chkInvert?.addEventListener("change", renderDicomRadiograph);

  btnAcquire?.addEventListener("click", async () => {
    alert("⚡ Triggering Hardware Radiographic Sensor (TWAIN/WebUSB)...\nCapturing 16-bit exposure at 65 kVp, 7 mA, 120 ms.");
    try {
      const res = await fetch("/api/v1/imaging/acquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          PatNum: selectedPatientId,
          ToothNumbers: "19",
          SensorModel: "Schick 33 / Dexis Titanium",
          KVP: 65,
          ExposureTimeMs: 120,
          XRayTubeCurrentMA: 7.0
        })
      }).then(r => r.json());

      alert(`✅ Radiograph Acquired & Saved to Cloudflare R2!\nDocNum: ${res.DocNum}\nSOP Instance UID: ${res.SOPInstanceUID}`);
      renderDicomRadiograph();
    } catch (err) {
      alert(`Acquisition failed: ${err.message}`);
    }
  });

  btnDexis?.addEventListener("click", async () => {
    const res = await fetch(`/api/v1/imaging/bridges/dexis/patient/${selectedPatientId}`).then(r => r.json());
    alert(`🚀 DEXIS Bridge Launcher:\nExecutable: ${res.executable}\nURI: ${res.protocolUri}\nInfoFile:\n${res.infoFileContent}`);
  });

  btnSchick?.addEventListener("click", async () => {
    const res = await fetch(`/api/v1/imaging/bridges/schick/patient/${selectedPatientId}`).then(r => r.json());
    alert(`🚀 Schick CDR Bridge Launcher:\nExecutable: ${res.executable}\nArguments: ${res.commandLineArgs}\nURI: ${res.protocolUri}`);
  });
}

function renderDicomRadiograph() {
  const canvas = document.getElementById("dicom-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const sliderCenter = document.getElementById("slider-window-center");
  const sliderWidth = document.getElementById("slider-window-width");
  const chkInvert = document.getElementById("chk-invert-contrast");

  const center = sliderCenter ? parseInt(sliderCenter.value, 10) : 2048;
  const windowWidth = sliderWidth ? parseInt(sliderWidth.value, 10) : 4096;
  const invert = chkInvert ? chkInvert.checked : false;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const min = center - windowWidth / 2;
  const max = center + windowWidth / 2;

  // Synthesize realistic 16-bit radiograph dental anatomy
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Simulation of alveolar bone, pulp chamber, and radio-opaque enamel crown
      const baseBone = 1600 + Math.sin(x / 15) * 200 + Math.cos(y / 20) * 150;
      const crown = dist < 120 ? (120 - dist) * 16 : 0;
      const pulp = dist < 35 ? -600 : 0; // radiolucent pulp chamber
      const raw16 = Math.max(0, Math.min(4095, baseBone + crown + pulp));

      // Windowing calculation
      let val8 = 0;
      if (raw16 <= min) val8 = 0;
      else if (raw16 >= max) val8 = 255;
      else val8 = Math.round(((raw16 - min) / (max - min)) * 255);

      if (invert) val8 = 255 - val8;

      data[idx] = val8;     // R
      data[idx + 1] = val8; // G
      data[idx + 2] = val8; // B
      data[idx + 3] = 255;  // A
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// -------------------------------------------------------------
// Payments & Ledger Module
// -------------------------------------------------------------
function initPaymentsModule() {
  const btnCharge = document.getElementById("btn-open-charge-modal");
  btnCharge?.addEventListener("click", async () => {
    const amountStr = prompt("Enter payment amount to charge via Stripe EMV Terminal ($):", "250.00");
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Invalid payment amount.");
      return;
    }

    try {
      const res = await fetch("/api/v1/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          PatNum: selectedPatientId,
          Amount: amount,
          PaymentSource: 4, // Stripe Terminal
          CardNumberMasked: "************4242",
          AutoSplit: true
        })
      }).then(r => r.json());

      alert(`✅ EMV Payment Approved!\nPayNum: ${res.PayNum}\nAmount: $${res.PayAmt.toFixed(2)}\nSplits: ${res.Splits.length} procedure allocations`);
      loadPatientLedger(selectedPatientId);
    } catch (err) {
      alert(`Payment failed: ${err.message}`);
    }
  });
}

async function loadPatientLedger(patNum) {
  const tbody = document.getElementById("ledger-table-body");
  if (!tbody) return;

  try {
    const res = await fetch(`/api/v1/payments/ledger/${patNum}`).then(r => r.json());
    document.getElementById("ledger-total-billed").textContent = `$${res.Summary.TotalBilled.toFixed(2)}`;
    document.getElementById("ledger-ins-paid").textContent = `$${res.Summary.TotalInsurancePaid.toFixed(2)}`;
    document.getElementById("ledger-pat-paid").textContent = `$${res.Summary.TotalPatientPaid.toFixed(2)}`;
    document.getElementById("ledger-balance-due").textContent = `$${res.Summary.PatientBalanceDue.toFixed(2)}`;

    tbody.innerHTML = "";

    res.Procedures.forEach(proc => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${proc.ProcDate}</td>
        <td><strong>${proc.ProcCode}</strong> - ${proc.Descript}</td>
        <td>$${proc.ProcFee.toFixed(2)}</td>
        <td>—</td>
        <td>—</td>
        <td>$${proc.ProcFee.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });

    res.Payments.forEach(pay => {
      const tr = document.createElement("tr");
      tr.style.background = "#f0fdf4";
      tr.innerHTML = `
        <td>${pay.PayDate}</td>
        <td>💳 Patient Payment (${pay.Receipt || "EMV Terminal"})</td>
        <td>—</td>
        <td>—</td>
        <td style="color: #16a34a; font-weight: 700;">-$${pay.SplitAmt.toFixed(2)}</td>
        <td>Allocated to Proc #${pay.ProcNum || "Unearned"}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load patient ledger:", err);
  }
}

// -------------------------------------------------------------
// eRx & EPCS Prescribing Module
// -------------------------------------------------------------
function initErxModule() {
  const selSchedule = document.getElementById("erx-dea-schedule");
  const epcsGroup = document.getElementById("epcs-auth-group");
  const btnSubmitRx = document.getElementById("btn-submit-rx");
  const btnDoseSpot = document.getElementById("btn-launch-dosespot");

  selSchedule?.addEventListener("change", () => {
    if (selSchedule.value !== "None") {
      epcsGroup.style.display = "block";
    } else {
      epcsGroup.style.display = "none";
    }
  });

  btnSubmitRx?.addEventListener("click", async () => {
    const drug = document.getElementById("erx-drug-input").value;
    const sig = document.getElementById("erx-sig-input").value;
    const disp = document.getElementById("erx-disp-input").value;
    const schedule = selSchedule.value;
    const epcsToken = document.getElementById("erx-epcs-token")?.value;
    const alertBanner = document.getElementById("rx-alert-banner");

    try {
      const res = await fetch("/api/v1/erx/prescribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          PatNum: selectedPatientId,
          ProvNum: 1,
          Drug: drug,
          Sig: sig,
          Disp: disp,
          DeaSchedule: schedule,
          EpcsAuthToken: epcsToken
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alertBanner.style.display = "block";
        alertBanner.textContent = `⚠️ Prescribing Error: ${data.error}`;
        return;
      }

      alertBanner.style.display = "none";
      alert(`✅ eRx Transmitted Successfully!\nRxNum: ${data.RxNum}\nDrug: ${data.Drug}\nSchedule: ${data.DeaSchedule}\nEPCS Sig: ${data.EpcsSignature || "N/A"}`);
      loadPatientPrescriptions(selectedPatientId);
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  });

  btnDoseSpot?.addEventListener("click", async () => {
    const res = await fetch("/api/v1/erx/dosespot/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ PatNum: selectedPatientId, ProvNum: 1 })
    }).then(r => r.json());

    alert(`🚀 Opening DoseSpot eRx Single Sign-On:\n\nURL: ${res.ssoUrl}\n\nSingleSignOnCode: ${res.singleSignOnCode.slice(0, 32)}...\nSingleSignOnUserIdVerify: ${res.singleSignOnUserIdVerify}`);
  });
}

async function loadPatientPrescriptions(patNum) {
  const tbody = document.getElementById("rx-table-body");
  if (!tbody) return;

  try {
    const res = await fetch(`/api/v1/erx/patient/${patNum}`).then(r => r.json());
    tbody.innerHTML = "";

    res.Prescriptions.forEach(rx => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rx.RxDate}</td>
        <td><strong>${rx.Drug}</strong></td>
        <td>${rx.Sig}</td>
        <td>${rx.Disp}</td>
        <td>${rx.ProvAbbr || "Dr. Smith"}</td>
        <td><span class="badge" style="background: #e0f2fe; color: #0369a1;">Standard eRx</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load prescriptions:", err);
  }
}

// -------------------------------------------------------------
// Forms & Signature Canvas Module
// -------------------------------------------------------------
function initFormsSignatureModule() {
  const canvas = document.getElementById("signature-canvas");
  const btnSubmit = document.getElementById("btn-submit-sheet");
  if (!canvas || !btnSubmit) return;

  const ctx = canvas.getContext("2d");
  let drawing = false;

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2;

  canvas.addEventListener("mousedown", (e) => {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });

  canvas.addEventListener("mousemove", (e) => {
    if (drawing) {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }
  });

  canvas.addEventListener("mouseup", () => { drawing = false; });
  canvas.addEventListener("mouseleave", () => { drawing = false; });

  btnSubmit.addEventListener("click", async () => {
    const sigData = canvas.toDataURL("image/png");
    const emergency = document.getElementById("form-emergency").value;
    const penAllergy = document.getElementById("chk-penicillin").checked;
    const consent = document.getElementById("chk-consent").checked;

    try {
      const res = await fetch("/api/v1/sheets/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          PatNum: selectedPatientId,
          SheetType: 1, // Medical History
          Description: "eClipboard Patient Medical History & Consent",
          SignatureData: sigData,
          Fields: {
            EmergencyContact: emergency,
            PenicillinAllergy: penAllergy ? "Yes" : "No",
            ConsentSigned: consent ? "Yes" : "No"
          }
        })
      }).then(r => r.json());

      alert(`✅ eClipboard Form Submitted & Cryptographically Archived!\nSheetNum: ${res.SheetNum}\nSigned: ${res.Signed}`);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (err) {
      alert(`Submission failed: ${err.message}`);
    }
  });
}

// Treatment Plan
async function loadTreatmentPlan(patNum) {
  const tbody = document.getElementById("tp-table-body");
  if (!tbody) return;

  try {
    const res = await fetch(`/api/v1/procedurelogs?patNum=${patNum}&status=1`).then(r => r.json());
    tbody.innerHTML = "";

    let total = 0;
    res.procedures.forEach((proc, idx) => {
      total += proc.ProcFee;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="badge" style="background:#fef3c7; color:#b45309;">Priority ${idx + 1}</span></td>
        <td><strong>#${proc.ToothNum || "All"}</strong></td>
        <td>${proc.ProcCode}</td>
        <td>${proc.Descript}</td>
        <td>$${proc.ProcFee.toFixed(2)}</td>
        <td>$${(proc.ProcFee * 0.8).toFixed(2)}</td>
        <td>$${(proc.ProcFee * 0.2).toFixed(2)}</td>
        <td>TP</td>
      `;
      tbody.appendChild(tr);
    });
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
