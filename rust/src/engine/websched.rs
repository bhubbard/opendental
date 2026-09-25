#[derive(Debug, Clone, PartialEq)]
pub struct AvailableSlot {
    pub op_num: i64,
    pub prov_num: i64,
    pub date_time_start: String,
    pub date_time_end: String,
}

/// Computes open operatory slots for a specific date and filters out any conflicting booked appointments.
pub fn compute_available_slots(
    date_str: &str,
    operatories: &[(i64, i64)], // (OpNum, ProvDentist)
    existing_appointment_times: &[(i64, String)], // (OpNum, AptDateTime)
) -> Vec<AvailableSlot> {
    let standard_hours = ["09:00:00", "10:00:00", "11:00:00", "13:00:00", "14:00:00", "15:00:00", "16:00:00"];
    let mut available = Vec::new();

    for &(op_num, prov_num) in operatories {
        for time_slot in standard_hours {
            let start_dt = format!("{}T{}", date_str, time_slot);
            let hour: u32 = time_slot[0..2].parse().unwrap_or(9);
            let end_dt = format!("{}T{:02}:00:00", date_str, hour + 1);

            let is_booked = existing_appointment_times
                .iter()
                .any(|&(booked_op, ref booked_dt)| booked_op == op_num && booked_dt.contains(time_slot));

            if !is_booked {
                available.push(AvailableSlot {
                    op_num,
                    prov_num,
                    date_time_start: start_dt,
                    date_time_end: end_dt,
                });
            }
        }
    }

    available
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_available_slots_filters_booked() {
        let ops = vec![(1, 1)]; // Op 1, Prov 1
        let booked = vec![(1, "2024-09-24T09:00:00".to_string())]; // 9am is booked

        let slots = compute_available_slots("2024-09-24", &ops, &booked);

        // 7 slots total - 1 booked = 6 slots available
        assert_eq!(slots.len(), 6);
        assert!(!slots.iter().any(|s| s.date_time_start.contains("09:00:00")));
        assert!(slots.iter().any(|s| s.date_time_start.contains("10:00:00")));
    }
}
