use opendental::engine::imaging::{apply_windowing, generate_bridge_payload};
use opendental::models::DicomStudy;
use opendental::PracticeRepository;

#[test]
fn test_dicom_windowing_and_bridge_integration() {
    let repo = PracticeRepository::new();

    // 1. Record DICOM study
    let study = DicomStudy {
        study_num: 0,
        doc_num: 101,
        pat_num: 1,
        study_instance_uid: "2.16.840.1.113883.3.4337.1.101".to_string(),
        modality: "IO".to_string(),
        kvp: 65.0,
        exposure_time_ms: 120,
        x_ray_tube_current_ma: 7.0,
        window_center: 2048,
        window_width: 4096,
        tooth_numbers: Some("19".to_string()),
    };

    let recorded = repo.record_dicom_study(study);
    assert_eq!(recorded.study_num, 1);
    assert_eq!(recorded.modality, "IO");

    // 2. Windowing algorithm test
    let raw_data = vec![500u16, 2048, 4000];
    let pixels = apply_windowing(&raw_data, 2048, 4096, false);
    assert_eq!(pixels.len(), 3);
    assert_eq!(pixels[1], 128); // Center point maps to 128

    // 3. Bridges tests
    let dexis = generate_bridge_payload("dexis", 1, "Doe", "Jane", Some("1988-03-15"), 2);
    assert_eq!(dexis.bridge, "Dexis");
    assert!(dexis.protocol_uri.contains("dexis://open?id=1"));

    let romexis = generate_bridge_payload("romexis", 1, "Doe", "Jane", Some("1988-03-15"), 2);
    assert_eq!(romexis.bridge, "Romexis");
    assert!(romexis.protocol_uri.contains("romexis://patient?id=1"));

    let xvweb = generate_bridge_payload("xvweb", 1, "Doe", "Jane", None, 2);
    assert_eq!(xvweb.bridge, "XVWeb");
    assert!(xvweb.cloud_url.unwrap().contains("https://cloud.xvweb.com"));
}
