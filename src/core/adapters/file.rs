use async_trait::async_trait;
use serde_json::Value;
use crate::registry::Adapter;
use tokio::fs;

pub struct FileAdapter;

impl FileAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Adapter for FileAdapter {
    async fn handle(&self, action: &str, params: Value) -> Result<Value, String> {
        match action {
            "write" => {
                let path = params["path"].as_str().ok_or("Missing path")?;
                let content = params["content"].as_str().ok_or("Missing content")?;
                fs::write(path, content).await.map_err(|e| e.to_string())?;
                Ok(Value::String("File written".to_string()))
            }
            _ => Err("Unknown action".to_string()),
        }
    }
}
