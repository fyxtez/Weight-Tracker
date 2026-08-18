use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoodSelection {
    // Feature: camelCase matches the existing Tauri DayRecord format and avoids a conversion layer during integration.
    pub food_id: String,
    pub amount: f64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DailyPayload {
    pub weight: Option<f64>,
    #[serde(default)]
    pub sleep: String,
    #[serde(default)]
    pub workout: Vec<String>,
    #[serde(default)]
    pub foods: Vec<FoodSelection>,
}

impl DailyPayload {
    pub fn validate(&self) -> Result<(), String> {
        // Fix: Reject impossible health values before they can pollute reports or synchronize to another device.
        if self.weight.is_some_and(|weight| !weight.is_finite() || !(40.0..=250.0).contains(&weight)) {
            return Err("weight must be between 40 and 250 kg".to_owned());
        }
        if self.sleep.len() > 16 {
            return Err("sleep value is too long".to_owned());
        }
        if self.workout.len() > 32 || self.workout.iter().any(|item| item.is_empty() || item.len() > 64) {
            return Err("workout contains too many or invalid values".to_owned());
        }
        if self.foods.len() > 100
            || self.foods.iter().any(|food| {
                food.food_id.is_empty()
                    || food.food_id.len() > 80
                    || !food.amount.is_finite()
                    || food.amount <= 0.0
                    || food.amount > 10_000.0
            })
        {
            return Err("foods contain too many or invalid selections".to_owned());
        }
        Ok(())
    }
}

#[derive(Debug, FromRow)]
pub struct DailyRecordRow {
    pub id: Uuid,
    pub local_date: NaiveDate,
    pub payload: Value,
    pub revision: i64,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DailyRecordResponse {
    pub id: Uuid,
    pub local_date: NaiveDate,
    pub payload: Value,
    pub revision: i64,
    pub updated_at: DateTime<Utc>,
}

impl From<DailyRecordRow> for DailyRecordResponse {
    fn from(row: DailyRecordRow) -> Self {
        Self {
            id: row.id,
            local_date: row.local_date,
            payload: row.payload,
            revision: row.revision,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ListDaysQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub limit: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::{DailyPayload, FoodSelection};

    #[test]
    fn rejects_negative_food_amount() {
        // Fix: The validation test locks the API boundary against corrupt portions before database integration tests exist.
        let payload = DailyPayload {
            weight: Some(101.2),
            sleep: "7h".to_owned(),
            workout: vec![],
            foods: vec![FoodSelection { food_id: "eggs".to_owned(), amount: -1.0 }],
        };
        assert!(payload.validate().is_err());
    }
}
