fn main() {
    // Fix: Stable Rust must explicitly watch the migrations directory so embedded SQL is rebuilt after a schema change.
    println!("cargo:rerun-if-changed=migrations");
}
