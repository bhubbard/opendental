use opendental::models::Patient;
use opendental::PracticeRepository;

#[test]
fn test_patient_crud_and_search() {
    let repo = PracticeRepository::new();

    // 1. Initial demo patient exists
    let p1 = repo.get_patient(1).expect("Demo patient 1 should exist");
    assert_eq!(p1.l_name, "Doe");
    assert_eq!(p1.f_name, "Jane");

    // 2. Insert new patient
    let new_pat = Patient {
        pat_num: 0,
        l_name: "Williams".to_string(),
        f_name: "Robert".to_string(),
        middle_i: Some("B".to_string()),
        preferred: Some("Bob".to_string()),
        pat_status: 0,
        gender: 1, // Male
        birthdate: "1975-11-20".to_string(),
        ssn: Some("987-65-4321".to_string()),
        address: Some("456 Oak St".to_string()),
        city: Some("Oakland".to_string()),
        state: Some("CA".to_string()),
        zip: Some("94612".to_string()),
        wireless_phone: Some("510-555-0188".to_string()),
        email: Some("bob.williams@example.com".to_string()),
        pri_prov: Some(1),
        clinic_num: Some(1),
    };

    let created = repo.insert_patient(new_pat);
    assert_eq!(created.pat_num, 2);

    // 3. Search by partial name
    let found_name = repo.search_patients("will");
    assert_eq!(found_name.len(), 1);
    assert_eq!(found_name[0].pat_num, 2);

    // 4. Search by phone
    let found_phone = repo.search_patients("510-555");
    assert_eq!(found_phone.len(), 1);
    assert_eq!(found_phone[0].l_name, "Williams");
}
