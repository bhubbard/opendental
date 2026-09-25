/// Port of OpenDentBusiness.Imaging.BitmapDicom and practice software bridges.

#[derive(Debug, Clone)]
pub struct BridgePayload {
    pub bridge: String,
    pub protocol_uri: String,
    pub executable: String,
    pub command_line_args: Option<String>,
    pub info_file_content: Option<String>,
    pub cloud_url: Option<String>,
}

/// Applies Open Dental 16-bit to 8-bit windowing algorithm (ported from BitmapDicom.cs).
/// Maps 16-bit radiograph sensor pixels to displayable 8-bit [0-255] grayscale using WindowCenter and WindowWidth.
pub fn apply_windowing(
    raw_16bit: &[u16],
    window_center: i32,
    window_width: i32,
    invert: bool,
) -> Vec<u8> {
    let window_min = window_center - window_width / 2;
    let window_max = window_center + window_width / 2;
    let mut output_8 = Vec::with_capacity(raw_16bit.len());

    for &val in raw_16bit {
        let v = val as i32;
        let normalized = if v <= window_min {
            0u8
        } else if v >= window_max {
            255u8
        } else {
            let num = (v - window_min) as f32;
            let den = (window_max - window_min) as f32;
            ((num / den) * 255.0).round() as u8
        };

        let final_val = if invert {
            255 - normalized
        } else {
            normalized
        };

        output_8.push(final_val);
    }

    output_8
}

/// Generates practice software bridge configurations (ported from WpfControlsOD/Bridges/).
pub fn generate_bridge_payload(
    bridge_name: &str,
    pat_num: i64,
    last_name: &str,
    first_name: &str,
    dob_opt: Option<&str>,
    gender_num: i32,
) -> BridgePayload {
    let clean_last = last_name.trim().to_uppercase();
    let clean_first = first_name.trim().to_uppercase();
    let dob = dob_opt.unwrap_or("19800101").replace('-', "");
    let gender_str = match gender_num {
        1 => "M",
        2 => "F",
        _ => "U",
    };

    match bridge_name.to_lowercase().as_str() {
        "dexis" => BridgePayload {
            bridge: "Dexis".to_string(),
            protocol_uri: format!(
                "dexis://open?id={}&last={}&first={}&dob={}&gender={}",
                pat_num, clean_last, clean_first, dob, gender_str
            ),
            executable: "Dexis.exe".to_string(),
            command_line_args: None,
            info_file_content: Some(format!(
                "{}\r\n{}\r\n{}\r\n{}\r\n{}\r\n",
                pat_num, clean_last, clean_first, dob, gender_str
            )),
            cloud_url: None,
        },
        "schick" => BridgePayload {
            bridge: "Schick".to_string(),
            protocol_uri: format!("cdr://open?patnum={}&ln={}&fn={}", pat_num, clean_last, clean_first),
            executable: "CdrApp.exe".to_string(),
            command_line_args: Some(format!("/P:{} /N:\"{}, {}\"", pat_num, clean_last, clean_first)),
            info_file_content: None,
            cloud_url: None,
        },
        "carestream" | "kodak" => BridgePayload {
            bridge: "Carestream".to_string(),
            protocol_uri: format!("csdental://patient?id={}&name={}^{}", pat_num, clean_last, clean_first),
            executable: "TW.exe".to_string(),
            command_line_args: Some(format!("-P{} -N\"{}^{}\"", pat_num, clean_last, clean_first)),
            info_file_content: None,
            cloud_url: None,
        },
        "romexis" => BridgePayload {
            bridge: "Romexis".to_string(),
            protocol_uri: format!(
                "romexis://patient?id={}&lastname={}&firstname={}&dob={}",
                pat_num, clean_last, clean_first, dob
            ),
            executable: "Romexis.exe".to_string(),
            command_line_args: Some(format!("-id \"{}\" -pn \"{}, {}\"", pat_num, clean_last, clean_first)),
            info_file_content: None,
            cloud_url: None,
        },
        "xvweb" | "apteryx" => BridgePayload {
            bridge: "XVWeb".to_string(),
            protocol_uri: format!(
                "https://cloud.xvweb.com/bridge?patid={}&last={}&first={}",
                pat_num, clean_last, clean_first
            ),
            executable: "Browser".to_string(),
            command_line_args: None,
            info_file_content: None,
            cloud_url: Some(format!("https://cloud.xvweb.com/viewer?patientId={}", pat_num)),
        },
        _ => BridgePayload {
            bridge: bridge_name.to_string(),
            protocol_uri: format!("opendental-bridge://{}?patNum={}", bridge_name, pat_num),
            executable: format!("{}.exe", bridge_name),
            command_line_args: None,
            info_file_content: None,
            cloud_url: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_windowing_16bit_to_8bit() {
        // WindowCenter = 2048, WindowWidth = 1000 => Min = 1548, Max = 2548
        let raw = vec![1000, 1548, 2048, 2548, 3000];
        let windowed = apply_windowing(&raw, 2048, 1000, false);

        assert_eq!(windowed.len(), 5);
        assert_eq!(windowed[0], 0);   // Below min -> 0
        assert_eq!(windowed[1], 0);   // Exactly min -> 0
        assert_eq!(windowed[2], 128); // Midpoint -> 128
        assert_eq!(windowed[3], 255); // Exactly max -> 255
        assert_eq!(windowed[4], 255); // Above max -> 255
    }

    #[test]
    fn test_apply_windowing_invert_contrast() {
        let raw = vec![1548, 2548];
        let normal = apply_windowing(&raw, 2048, 1000, false);
        let inverted = apply_windowing(&raw, 2048, 1000, true);

        assert_eq!(normal[0], 0);
        assert_eq!(inverted[0], 255);
        assert_eq!(normal[1], 255);
        assert_eq!(inverted[1], 0);
    }

    #[test]
    fn test_dexis_bridge_generation() {
        let bridge = generate_bridge_payload("dexis", 1042, "Smith", "Robert", Some("1980-05-15"), 1);
        assert_eq!(bridge.bridge, "Dexis");
        assert_eq!(bridge.executable, "Dexis.exe");
        assert_eq!(
            bridge.info_file_content.unwrap(),
            "1042\r\nSMITH\r\nROBERT\r\n19800515\r\nM\r\n"
        );
        assert!(bridge.protocol_uri.contains("dexis://open?id=1042&last=SMITH&first=ROBERT"));
    }

    #[test]
    fn test_schick_bridge_generation() {
        let bridge = generate_bridge_payload("schick", 2011, "Johnson", "Sarah", None, 2);
        assert_eq!(bridge.bridge, "Schick");
        assert_eq!(bridge.command_line_args.unwrap(), "/P:2011 /N:\"JOHNSON, SARAH\"");
    }
}
