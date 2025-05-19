use crate::registry::Registry;
use serde_json::Value;
use tokio::sync::mpsc;
use serde_json::json;

pub struct Executor {
    registry: Registry,
    sender: mpsc::Sender<Value>,
}

impl Executor {
    pub fn new(registry: Registry, sender: mpsc::Sender<Value>) -> Self {
        Self { registry, sender }
    }

    pub async fn execute(&self, request: Value) {
        let adapter_name = request["adapter"].as_str().unwrap_or("");
        let action = request["action"].as_str().unwrap_or("");
        let params = request["params"].clone();

        if let Some(adapter) = self.registry.get(adapter_name).await {
            let result = adapter.handle(action, params).await;

            let response = match result {
                Ok(data) => json!({ "status": "success", "data": data }),
                Err(err) => json!({ "status": "error", "message": err }),
            };

            let _ = self.sender.send(response).await;
        }
    }
}
