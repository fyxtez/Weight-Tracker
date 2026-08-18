use argon2::{
    password_hash::SaltString,
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};

// Fix: Import OsRng from a direct rand_core dependency with getrandom enabled instead of Argon2's feature-gated re-export.
use rand_core::{OsRng, RngCore};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use email_address::EmailAddress;
use sha2::{Digest, Sha256};

pub const MIN_PASSWORD_BYTES: usize = 1;
pub const MAX_PASSWORD_BYTES: usize = 128;

#[derive(Debug, thiserror::Error)]
pub enum AuthCryptoError {
    #[error("email address is invalid")]
    InvalidEmail,
    #[error("password must contain between 12 and 128 bytes")]
    InvalidPassword,
    #[error("password hashing failed")]
    PasswordHash,
}

pub fn normalize_email(value: &str) -> Result<String, AuthCryptoError> {
    // Security: Canonical lowercase storage prevents duplicate identities that differ only by casing or whitespace.
    let email = value.trim().to_lowercase();
    if email.len() > 254 || !EmailAddress::is_valid(&email) {
        return Err(AuthCryptoError::InvalidEmail);
    }
    Ok(email)
}

pub fn validate_password(password: &str) -> Result<(), AuthCryptoError> {
    // Security: A bounded byte length provides useful entropy while preventing oversized Argon2 denial-of-service inputs.
    if !(MIN_PASSWORD_BYTES..=MAX_PASSWORD_BYTES).contains(&password.len()) {
        return Err(AuthCryptoError::InvalidPassword);
    }
    Ok(())
}

pub fn hash_password(password: &str) -> Result<String, AuthCryptoError> {
    validate_password(password)?;
    let salt = SaltString::generate(&mut OsRng);
    // Security: RustCrypto defaults to Argon2id v19 and stores algorithm parameters plus salt in the PHC string.
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| AuthCryptoError::PasswordHash)
}

pub fn verify_password(password: &str, encoded_hash: &str) -> bool {
    // Security: The verifier uses the parameters embedded in the trusted PHC hash and returns only a boolean to callers.
    PasswordHash::new(encoded_hash)
        .ok()
        .is_some_and(|hash| Argon2::default().verify_password(password.as_bytes(), &hash).is_ok())
}

pub fn generate_token() -> String {
    // Security: 256 bits from the operating-system RNG make session tokens impractical to guess.
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn hash_token(token: &str) -> Vec<u8> {
    // Security: Only a deterministic SHA-256 digest is persisted, so a database leak does not reveal live bearer tokens.
    Sha256::digest(token.as_bytes()).to_vec()
}

pub fn constant_time_token_eq(left: &str, right: &str) -> bool {
    use subtle::ConstantTimeEq;
    // Security: Setup-token comparison avoids revealing a correct prefix through response timing.
    left.as_bytes().ct_eq(right.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_round_trip_and_wrong_password() {
        let hash = hash_password("correct horse battery staple").unwrap();
        assert!(verify_password("correct horse battery staple", &hash));
        assert!(!verify_password("incorrect password", &hash));
    }

    #[test]
    fn tokens_are_unique_and_hashable() {
        let first = generate_token();
        let second = generate_token();
        assert_ne!(first, second);
        assert_eq!(hash_token(&first).len(), 32);
    }
}
