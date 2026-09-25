pub mod engine;
pub mod models;
pub mod repository;
pub mod server;

pub use repository::PracticeRepository;

pub fn version() -> &'static str {
    "24.3.0"
}
