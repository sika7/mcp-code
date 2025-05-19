mod core;
use core::{adapters, executor, registry};

use axum::{routing::post, Json, Router};
use crate::adapters::{api::ApiAdapter, calculator::CalculatorAdapter, file::FileAdapter};
use crate::executor::Executor;
use crate::registry::Registry;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel(32);

    // Registryにアダプターを登録
    let mut registry = Registry::new();
    registry.register("api", Box::new(ApiAdapter::new()));
    registry.register("file", Box::new(FileAdapter::new()));
    registry.register("calc", Box::new(CalculatorAdapter::new()));

    // Executorを起動
    let executor = Executor::new(registry, tx.clone());

    // シンプルなリクエスト例
    let request = serde_json::json!({
        "adapter": "calc",
        "action": "add",
        "params": {
            "a": 5,
            "b": 10
        }
    });

    executor.execute(request).await;

    // 結果の受け取り
    while let Some(result) = rx.recv().await {
        println!("Result: {:?}", result);
    }
}
