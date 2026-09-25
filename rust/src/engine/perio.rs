/// Port of OpenDentBusiness.PerioExam and 6-site periodontal measurement charting.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PerioSequenceType {
    Probing = 0,
    Bleeding = 1,
    Suppuration = 2,
    GingivalMargin = 3,
    Mobility = 4,
    Furcation = 5,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SixSiteMeasurement {
    pub tooth_num: i32, // 1 to 32
    pub sequence_type: i32,
    pub mesio_buccal: i32,
    pub buccal: i32,
    pub disto_buccal: i32,
    pub mesio_lingual: i32,
    pub lingual: i32,
    pub disto_lingual: i32,
}

impl SixSiteMeasurement {
    pub fn new(tooth: i32, seq: PerioSequenceType, mb: i32, b: i32, db: i32, ml: i32, l: i32, dl: i32) -> Self {
        Self {
            tooth_num: tooth,
            sequence_type: seq as i32,
            mesio_buccal: mb,
            buccal: b,
            disto_buccal: db,
            mesio_lingual: ml,
            lingual: l,
            disto_lingual: dl,
        }
    }

    /// Checks if any site on the tooth has deep probing depths (>= 5mm, indicating active periodontal disease)
    pub fn has_deep_pocket(&self) -> bool {
        self.mesio_buccal >= 5
            || self.buccal >= 5
            || self.disto_buccal >= 5
            || self.mesio_lingual >= 5
            || self.lingual >= 5
            || self.disto_lingual >= 5
    }

    /// Count of bleeding sites (where value > 0)
    pub fn bleeding_site_count(&self) -> usize {
        [
            self.mesio_buccal,
            self.buccal,
            self.disto_buccal,
            self.mesio_lingual,
            self.lingual,
            self.disto_lingual,
        ]
        .iter()
        .filter(|&&v| v > 0)
        .count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perio_deep_pocket_detection() {
        let healthy = SixSiteMeasurement::new(19, PerioSequenceType::Probing, 3, 2, 3, 3, 2, 3);
        assert!(!healthy.has_deep_pocket());

        let diseased = SixSiteMeasurement::new(19, PerioSequenceType::Probing, 3, 2, 6, 3, 2, 3);
        assert!(diseased.has_deep_pocket());
    }

    #[test]
    fn test_bleeding_site_calculation() {
        let bleeding = SixSiteMeasurement::new(14, PerioSequenceType::Bleeding, 1, 0, 1, 0, 0, 1);
        assert_eq!(bleeding.bleeding_site_count(), 3);
    }
}
