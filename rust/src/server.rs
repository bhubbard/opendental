use std::sync::Arc;
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};
use serde_json::json;

use crate::engine::erx::create_dosespot_sso_codes;
use crate::engine::imaging::generate_bridge_payload;
use crate::models::{Appointment, ProcedureLog};
use crate::PracticeRepository;

pub fn start_server(host: &str, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let addr = format!("{}:{}", host, port);
    let server = Server::http(&addr).map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;
    let repo = Arc::new(PracticeRepository::new());

    // Pre-populate some appointments for operatory view
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let _ = repo.insert_appointment(Appointment {
        apt_num: 0,
        pat_num: 1,
        apt_status: 1,
        pattern: Some("//XXXX//".to_string()),
        op: 1,
        note: Some("Comprehensive Exam".to_string()),
        prov_num: 1,
        apt_date_time: format!("{}T09:00:00", today),
        proc_descript: Some("D0150 Comprehensive Exam, D0210 FMX".to_string()),
        confirmed: Some(1),
    });

    let _ = repo.insert_appointment(Appointment {
        apt_num: 0,
        pat_num: 1,
        apt_status: 1,
        pattern: Some("//XX//".to_string()),
        op: 2,
        note: Some("Composite Restoration".to_string()),
        prov_num: 2,
        apt_date_time: format!("{}T10:30:00", today),
        proc_descript: Some("D2391 Resin Composite - 1 Surface".to_string()),
        confirmed: Some(1),
    });

    let _ = repo.insert_procedure(ProcedureLog {
        proc_num: 0,
        pat_num: 1,
        apt_num: Some(1),
        code_num: 14,
        proc_date: today.clone(),
        proc_fee: 1350.0,
        surf: None,
        tooth_num: Some("19".to_string()),
        priority: Some(1),
        proc_status: 1, // Treatment Plan
        prov_num: 1,
        clinic_num: Some(1),
        billing_note: Some("Porcelain crown".to_string()),
    });

    let _ = repo.insert_procedure(ProcedureLog {
        proc_num: 0,
        pat_num: 1,
        apt_num: Some(1),
        code_num: 2,
        proc_date: today.clone(),
        proc_fee: 105.0,
        surf: None,
        tooth_num: None,
        priority: None,
        proc_status: 2, // Completed
        prov_num: 1,
        clinic_num: Some(1),
        billing_note: None,
    });

    println!("=================================================================");
    println!("🦷 Open Dental in Rust (opendental-rs) Web Server Running!");
    println!("🌐 URL: http://localhost:{}", port);
    println!("📡 API: http://localhost:{}/api/v1/info", port);
    println!("⚡ Native performance: Zero-overhead memory-safe edge engine");
    println!("=================================================================");

    for request in server.incoming_requests() {
        let repo = Arc::clone(&repo);
        handle_request(request, &repo);
    }

    Ok(())
}

fn handle_request(mut request: Request, repo: &PracticeRepository) {
    let url_raw = request.url().to_string();
    let (path, query) = match url_raw.split_once('?') {
        Some((p, q)) => (p, q),
        None => (url_raw.as_str(), ""),
    };
    let method = request.method().clone();

    // CORS pre-flight
    if method == Method::Options {
        let response = Response::empty(StatusCode(204))
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap())
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, PUT, DELETE, OPTIONS"[..]).unwrap())
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type, Authorization"[..]).unwrap());
        let _ = request.respond(response);
        return;
    }

    // 1. Static Web UI Files
    if path == "/" || path == "/index.html" {
        send_file_or_embedded(request, "index.html", "text/html; charset=utf-8");
        return;
    } else if path == "/styles.css" {
        send_file_or_embedded(request, "styles.css", "text/css; charset=utf-8");
        return;
    } else if path == "/app.js" {
        send_file_or_embedded(request, "app.js", "application/javascript; charset=utf-8");
        return;
    }

    // 2. Health & System Info
    if path == "/health" {
        send_json(request, 200, json!({
            "status": "healthy",
            "service": "opendental-rs",
            "engine": "rust-native",
            "version": crate::version(),
            "timestamp": chrono::Utc::now().to_rfc3339()
        }));
        return;
    }

    if path == "/api/v1/info" {
        send_json(request, 200, json!({
            "success": true,
            "practiceName": "Open Dental Cloud (Rust Engine)",
            "version": crate::version(),
            "engine": "Rust Native (opendental-rs)",
            "stats": {
                "activePatients": 1,
                "totalAppointments": 2
            }
        }));
        return;
    }

    // 3. Patients API
    if path == "/api/v1/patients" && method == Method::Get {
        let patients = repo.search_patients("");
        send_json(request, 200, json!({
            "patients": patients
        }));
        return;
    }

    // 4. Appointments API
    if path == "/api/v1/appointments" && method == Method::Get {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let date_param = query
            .split('&')
            .find(|pair| pair.starts_with("date="))
            .and_then(|pair| pair.split_once('=').map(|(_, v)| v))
            .unwrap_or(&today);

        let apts = repo.get_appointments_by_date(date_param);
        let joined_apts: Vec<_> = apts.into_iter().map(|a| {
            json!({
                "AptNum": a.apt_num,
                "PatNum": a.pat_num,
                "AptStatus": a.apt_status,
                "Op": a.op,
                "ProvNum": a.prov_num,
                "AptDateTime": a.apt_date_time,
                "ProcDescript": a.proc_descript.unwrap_or_else(|| "Exam / Prophy".to_string()),
                "PatientName": "Doe, Jane",
                "OpName": format!("Operatory {}", a.op),
                "ProvAbbr": if a.prov_num == 1 { "Dr. Smith" } else { "Dr. Jones" }
            })
        }).collect();

        send_json(request, 200, json!(joined_apts));
        return;
    }

    // 5. Treatment Plan & Procedure Logs
    if path == "/api/v1/procedurelogs" && method == Method::Get {
        let procs = repo.get_procedures_by_patient(1);
        let formatted: Vec<_> = procs.into_iter().map(|p| {
            json!({
                "ProcNum": p.proc_num,
                "PatNum": p.pat_num,
                "CodeNum": p.code_num,
                "ProcCode": if p.code_num == 14 { "D2740" } else { "D1110" },
                "Descript": if p.code_num == 14 { "Crown - Porcelain/Ceramic Substrate" } else { "Prophylaxis - Adult" },
                "ProcDate": p.proc_date,
                "ProcFee": p.proc_fee,
                "ToothNum": p.tooth_num.unwrap_or_default(),
                "ProcStatus": p.proc_status
            })
        }).collect();

        send_json(request, 200, json!({ "procedures": formatted }));
        return;
    }

    // 6. Payment Ledger & Terminal Charges
    if path.starts_with("/api/v1/payments/ledger/") && method == Method::Get {
        let pat_num = path.trim_start_matches("/api/v1/payments/ledger/").parse::<i64>().unwrap_or(1);
        let summary = repo.get_patient_ledger(pat_num);
        let procs = repo.get_procedures_by_patient(pat_num);

        send_json(request, 200, json!({
            "PatNum": pat_num,
            "Summary": {
                "TotalBilled": summary.total_billed,
                "TotalInsurancePaid": summary.total_insurance_paid,
                "TotalWriteOff": summary.total_write_off,
                "TotalPatientPaid": summary.total_patient_paid,
                "UnearnedPrepaymentBalance": summary.unearned_prepayment_balance,
                "PatientBalanceDue": summary.patient_balance_due
            },
            "Procedures": procs.into_iter().filter(|p| p.proc_status == 2).map(|p| {
                json!({
                    "ProcNum": p.proc_num,
                    "ProcDate": p.proc_date,
                    "ProcCode": "D1110",
                    "Descript": "Prophylaxis - Adult",
                    "ProcFee": p.proc_fee
                })
            }).collect::<Vec<_>>(),
            "Payments": []
        }));
        return;
    }

    if path == "/api/v1/payments/charge" && method == Method::Post {
        let mut body = String::new();
        let _ = request.as_reader().read_to_string(&mut body);
        let json_body: serde_json::Value = serde_json::from_str(&body).unwrap_or(json!({}));

        let pat_num = json_body["PatNum"].as_i64().unwrap_or(1);
        let amount = json_body["Amount"].as_f64().unwrap_or(250.0);

        let (pay, splits) = repo.charge_payment_with_auto_split(pat_num, amount, "RustEdgeSalt");

        send_json(request, 201, json!({
            "success": true,
            "PayNum": pay.pay_num,
            "PayAmt": pay.pay_amt,
            "Splits": splits
        }));
        return;
    }

    // 7. eRx & EPCS Prescribing
    if path.starts_with("/api/v1/erx/patient/") && method == Method::Get {
        send_json(request, 200, json!({
            "PatNum": 1,
            "Prescriptions": [
                {
                    "RxNum": 1,
                    "RxDate": chrono::Utc::now().format("%Y-%m-%d").to_string(),
                    "Drug": "Amoxicillin 500mg",
                    "Sig": "Take 1 cap PO TID for 7 days",
                    "Disp": "21 (twenty-one)",
                    "ProvAbbr": "Dr. Smith"
                }
            ]
        }));
        return;
    }

    if path == "/api/v1/erx/prescribe" && method == Method::Post {
        let mut body = String::new();
        let _ = request.as_reader().read_to_string(&mut body);
        let json_body: serde_json::Value = serde_json::from_str(&body).unwrap_or(json!({}));

        let drug = json_body["Drug"].as_str().unwrap_or("Amoxicillin 500mg");
        let sig = json_body["Sig"].as_str().unwrap_or("Take 1 cap TID");
        let disp = json_body["Disp"].as_str().unwrap_or("21");
        let schedule = json_body["DeaSchedule"].as_str().unwrap_or("None");
        let epcs_token = json_body["EpcsAuthToken"].as_str();

        match repo.prescribe_medication(1, 1, drug, sig, disp, schedule, epcs_token, Some("AB1234567"), Some("1234567890")) {
            Ok((rx, log)) => {
                send_json(request, 201, json!({
                    "success": true,
                    "RxNum": rx.rx_num,
                    "Drug": rx.drug,
                    "DeaSchedule": schedule,
                    "EpcsSignature": log.map(|l| l.epcs_signature)
                }));
            }
            Err(err_msg) => {
                send_json(request, 400, json!({ "error": err_msg }));
            }
        }
        return;
    }

    if path == "/api/v1/erx/dosespot/sso" && method == Method::Post {
        let sso = create_dosespot_sso_codes("DemoClinicSecretKey", "501", None);
        let sso_url = format!(
            "https://my.dosespot.com/LoginSingleSignOn.aspx?b=2&ClinicID=1001&UserID=501&SingleSignOnCode={}&SingleSignOnUserIdVerify={}&PatID=1",
            sso.single_sign_on_code, sso.single_sign_on_user_id_verify
        );

        send_json(request, 200, json!({
            "success": true,
            "ssoUrl": sso_url,
            "singleSignOnCode": sso.single_sign_on_code,
            "singleSignOnUserIdVerify": sso.single_sign_on_user_id_verify
        }));
        return;
    }

    // 8. Imaging & Hardware Sensor Bridges
    if path == "/api/v1/imaging/acquire" && method == Method::Post {
        send_json(request, 201, json!({
            "success": true,
            "DocNum": 101,
            "SOPInstanceUID": "2.16.840.1.113883.3.4337.opendental.1.xray101",
            "ToothNumbers": "19",
            "WindowCenter": 2048,
            "WindowWidth": 4096
        }));
        return;
    }

    if path.starts_with("/api/v1/imaging/bridges/") && method == Method::Get {
        let parts: Vec<&str> = path.split('/').collect();
        let bridge_name = if parts.len() > 4 { parts[4] } else { "dexis" };
        let payload = generate_bridge_payload(bridge_name, 1, "Doe", "Jane", Some("1988-03-15"), 2);

        send_json(request, 200, json!({
            "bridge": payload.bridge,
            "protocolUri": payload.protocol_uri,
            "executable": payload.executable,
            "commandLineArgs": payload.command_line_args,
            "infoFileContent": payload.info_file_content,
            "cloudUrl": payload.cloud_url
        }));
        return;
    }

    // 9. Sheets & Digital Forms
    if path == "/api/v1/sheets/submit" && method == Method::Post {
        send_json(request, 201, json!({
            "success": true,
            "SheetNum": 1,
            "Signed": true
        }));
        return;
    }

    // 10. Documents
    if path == "/api/v1/documents" && method == Method::Get {
        send_json(request, 200, json!({
            "documents": [
                {
                    "DocNum": 1,
                    "FileName": "Initial_Panoramic_XRay.dcm",
                    "DateCreated": chrono::Utc::now().to_rfc3339(),
                    "FileSize": 1420580
                },
                {
                    "DocNum": 2,
                    "FileName": "Bitewing_Tooth19.dcm",
                    "DateCreated": chrono::Utc::now().to_rfc3339(),
                    "FileSize": 524288
                }
            ]
        }));
        return;
    }

    // 11. ShortQuery Console
    if path == "/api/v1/queries/ShortQuery" && method == Method::Post {
        let patients = repo.search_patients("");
        send_json(request, 200, json!({
            "success": true,
            "columns": ["PatNum", "LName", "FName", "Birthdate", "Gender"],
            "rows": patients.into_iter().map(|p| {
                vec![
                    p.pat_num.to_string(),
                    p.l_name,
                    p.f_name,
                    p.birthdate,
                    p.gender.to_string()
                ]
            }).collect::<Vec<_>>()
        }));
        return;
    }

    // 404 Fallback
    let not_found = Response::from_string("404 Not Found")
        .with_status_code(StatusCode(404));
    let _ = request.respond(not_found);
}

fn send_json(request: Request, status_code: u16, val: serde_json::Value) {
    let body = serde_json::to_string_pretty(&val).unwrap_or_default();
    let response = Response::from_string(body)
        .with_status_code(StatusCode(status_code))
        .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json; charset=utf-8"[..]).unwrap())
        .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
    let _ = request.respond(response);
}

fn send_file_or_embedded(request: Request, file_name: &str, content_type: &str) {
    let public_dir = std::path::Path::new("cloudflare/public");
    let alt_dir = std::path::Path::new("../cloudflare/public");

    let file_path = if public_dir.join(file_name).exists() {
        public_dir.join(file_name)
    } else {
        alt_dir.join(file_name)
    };

    if let Ok(contents) = std::fs::read_to_string(&file_path) {
        let response = Response::from_string(contents)
            .with_status_code(StatusCode(200))
            .with_header(Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap())
            .with_header(Header::from_bytes(&b"Cache-Control"[..], &b"no-cache"[..]).unwrap())
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
        let _ = request.respond(response);
    } else {
        let fallback = format!("Missing {}", file_name);
        let response = Response::from_string(fallback)
            .with_status_code(StatusCode(404));
        let _ = request.respond(response);
    }
}
