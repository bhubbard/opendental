//! Open Dental in Rust (`opendental-rs`)
//! High-performance Rust port of Open Dental Practice Management Software.

pub mod engine;
pub mod models;
pub mod repository;

pub use repository::PracticeRepository;

pub fn version() -> &'static str {
    "24.3.0"
}
