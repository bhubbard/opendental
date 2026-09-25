use opendental::engine::erx::create_dosespot_sso_codes;
use opendental::engine::imaging::{apply_windowing, generate_bridge_payload};
use opendental::engine::x12::parse_x12_835;
use opendental::PracticeRepository;

fn main() {
    println!("🦷 Open Dental in Rust (opendental-rs) v{}", opendental::version());
    println!("=========================================================");

    let repo = PracticeRepository::new();

    // 1. Patient lookup
    if let Some(patient) = repo.get_patient(1) {
        println!("👤 Active Demo Patient: {}, {} (PatNum: {})", patient.l_name, patient.f_name, patient.pat_num);
    }

    // 2. Imaging Bridge
    let bridge = generate_bridge_payload("dexis", 1, "Doe", "Jane", Some("1988-03-15"), 2);
    println!("🖼️  DEXIS Bridge URI: {}", bridge.protocol_uri);

    // 3. DICOM 16-bit to 8-bit Windowing
    let raw_pixels = vec![1000u16, 1548, 2048, 2548, 3000];
    let windowed = apply_windowing(&raw_pixels, 2048, 1000, false);
    println!("🔬 Windowed 8-bit Pixels [0-255]: {:?}", windowed);

    // 4. DoseSpot eRx Single Sign-On
    let sso = create_dosespot_sso_codes("DemoClinicSecretKey", "501", None);
    println!("💊 DoseSpot SSO Code: {}...", &sso.single_sign_on_code[..32]);

    // 5. ERA 835 Remittance Parser
    let raw_835 = "BPR*I*1250.00*C*ACH*CTX*01*999999999*DA*12345678*1999999999**01*999999999*DA*87654321*20240924~CLP*101*1*500.00*400.00*50.00*12*CLM101~";
    let era = parse_x12_835(raw_835);
    println!("💵 ERA 835 Adjudication: ${:.2} paid across {} claims", era.total_paid, era.claims.len());

    println!("=========================================================");
    println!("✅ Open Dental Rust Engine Initialized Successfully.");
}
