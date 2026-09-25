use opendental::models::Appointment;
use opendental::PracticeRepository;

#[test]
fn test_appointment_scheduling_and_conflict_detection() {
    let repo = PracticeRepository::new();

    let apt1 = Appointment {
        apt_num: 0,
        pat_num: 1,
        apt_status: 1, // Scheduled
        pattern: Some("//XXXX//".to_string()),
        op: 1,
        note: Some("Periodic oral exam".to_string()),
        prov_num: 1,
        apt_date_time: "2024-09-25T09:00:00".to_string(),
        proc_descript: Some("D0120, D1110".to_string()),
        confirmed: Some(1),
    };

    // 1. First appointment schedules successfully
    let res1 = repo.insert_appointment(apt1);
    assert!(res1.is_ok());
    let created = res1.unwrap();
    assert_eq!(created.apt_num, 1);

    // 2. Conflicting appointment on same operatory and time is rejected
    let apt_conflict = Appointment {
        apt_num: 0,
        pat_num: 2,
        apt_status: 1,
        pattern: None,
        op: 1, // Same Op
        note: None,
        prov_num: 1,
        apt_date_time: "2024-09-25T09:00:00".to_string(), // Same time
        proc_descript: None,
        confirmed: None,
    };

    let res_conflict = repo.insert_appointment(apt_conflict);
    assert!(res_conflict.is_err());
    assert_eq!(res_conflict.unwrap_err(), "Time slot in operatory is already booked");

    // 3. Same time on different operatory succeeds
    let apt_op2 = Appointment {
        apt_num: 0,
        pat_num: 2,
        apt_status: 1,
        pattern: None,
        op: 2, // Operatory 2
        note: None,
        prov_num: 2,
        apt_date_time: "2024-09-25T09:00:00".to_string(),
        proc_descript: None,
        confirmed: None,
    };

    let res_op2 = repo.insert_appointment(apt_op2);
    assert!(res_op2.is_ok());

    // 4. Query appointments by date
    let date_apts = repo.get_appointments_by_date("2024-09-25");
    assert_eq!(date_apts.len(), 2);
}
