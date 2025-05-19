use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

#[async_trait]
pub trait Adapter: Send + Sync {
    async fn handle(&self, action: &str, params: Value) -> Result<Value, String>;
}

pub struct Registry {
    adapters: HashMap<String, Box<dyn Adapter>>,
}

impl Registry {
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
        }
    }

    pub fn register(&mut self, name: &str, adapter: Box<dyn Adapter>) {
        self.adapters.insert(name.to_string(), adapter);
    }

    pub async fn get(&self, name: &str) -> Option<&Box<dyn Adapter>> {
        self.adapters.get(name)
    }
}
