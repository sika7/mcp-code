use async_trait::async_trait;
use serde_json::Value;
use crate::registry::Adapter;

pub struct CalculatorAdapter;

impl CalculatorAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Adapter for CalculatorAdapter {
    async fn handle(&self, action: &str, params: Value) -> Result<Value, String> {
        match action {
            "add" => {
                let a = params["a"].as_i64().unwrap_or(0);
                let b = params["b"].as_i64().unwrap_or(0);
                Ok(Value::Number((a + b).into()))
            }
            _ => Err("Unknown action".to_string()),
        }
    }
}
