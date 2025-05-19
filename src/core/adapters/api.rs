use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use crate::registry::Adapter;

pub struct ApiAdapter {
    client: Client,
}

impl ApiAdapter {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }
}

#[async_trait]
impl Adapter for ApiAdapter {
    async fn handle(&self, action: &str, params: Value) -> Result<Value, String> {
        match action {
            "get" => {
                let url = params["url"].as_str().ok_or("Missing URL")?;
                let response = self.client.get(url).send().await.map_err(|e| e.to_string())?;
                let json = response.json::<Value>().await.map_err(|e| e.to_string())?;
                Ok(json)
            }
            _ => Err("Unknown action".to_string()),
        }
    }
}
