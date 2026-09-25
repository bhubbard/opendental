use opendental::PracticeRepository;

#[test]
fn test_era835_auto_posting_and_hl7_processing() {
    let repo = PracticeRepository::new();

    // 1. ERA 835 auto-posting
    let raw_835 = "\
BPR*I*1250.00*C*ACH*CTX*01*999999999*DA*12345678*1999999999**01*999999999*DA*87654321*20240924~\r\n\
TRN*1*EFT987654321*1999999999~\r\n\
N1*PR*MetLife Dental*XX*65978~\r\n\
CLP*1*1*500.00*400.00*50.00*12*CLM1~\r\n";

    let era = repo.process_era_835(raw_835);
    assert_eq!(era.total_paid, 1250.00);
    assert_eq!(era.payer_name, "MetLife Dental");
    assert_eq!(era.claims.len(), 1);
    assert_eq!(era.claims[0].write_off, 50.0);

    // 2. Inbound HL7 ADT message
    let raw_hl7 = "\
MSH|^~\\&|EMR_SYSTEM|HOSPITAL|OPENDENTAL|CLINIC|20240924110000||ADT^A04|MSG_9912|P|2.3\r\n\
PID|1||||TAYLOR^EMILY^J||19950412|F|||100 MAIN ST^^SAN FRANCISCO^CA^94102\r\n";

    let ack_res = repo.receive_hl7_message(raw_hl7);
    assert!(ack_res.is_ok());
    let ack = ack_res.unwrap();
    assert!(ack.contains("MSA|AA|MSG_9912"));

    // Patient created via HL7 ADT
    let search = repo.search_patients("taylor");
    assert_eq!(search.len(), 1);
    assert_eq!(search[0].f_name, "EMILY");
    assert_eq!(search[0].gender, 2); // Female
}
