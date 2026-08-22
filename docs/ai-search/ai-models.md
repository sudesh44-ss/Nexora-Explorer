# Nexora AI Search — AI Model Registry & Local Runtime Abstraction

> **Phase**: Part 7 — AI Model Registry + Local Runtime Abstraction  
> **Status**: Completed & Verified  

---

## 1. Architecture: Decoupling Repository, Profile, and Runtime

Nexora AI Search strictly separates **Model Repositories** (where models are published, e.g. Hugging Face) from **Model Profiles** (metadata describing task, size, RAM requirements, quantization, licensing) and **Model Runtimes** (engines executing inference, e.g. local ONNX / Wasm / GGUF engines).

```text
                               AI Task
                    (e.g. TEXT_EMBEDDING)
                               │
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │                         AIEngine                          │
  │                                                           │
  │  ├── ModelSelector   → Matches hardware + Quality Mode    │
  │  ├── ModelRegistry   → Stores verified model profiles     │
  │  ├── ModelManager    → Manages %APPDATA%/models/installed │
  │  └── RuntimeRegistry → Routes to registered runtime       │
  └────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
  │ MockRuntime │        │ LocalRuntime│        │CloudRuntime │
  │ (Offline TS)│        │(Future GGUF)│        │ (Optional)  │
  └─────────────┘        └─────────────┘        └─────────────┘
                               │
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │                         AIResult                          │
  │       { success, modelId, dimensions: 768, vector }       │
  └───────────────────────────────────────────────────────────┘
```

---

## 2. Standard Model Profiles

| Model ID | Task | Quality Mode | Size | RAM Required | Dimensions | License |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`nomic-embed-text-v1.5`** | `TEXT_EMBEDDING` | `BALANCED` | 280 MB | 512 MB | 768 | `Apache-2.0` |
| **`bge-small-en-v1.5`** | `TEXT_EMBEDDING` | `FAST` | 67 MB | 256 MB | 384 | `MIT` |
| **`all-minilm-l6-v2`** | `TEXT_EMBEDDING` | `FAST` | 90 MB | 256 MB | 384 | `Apache-2.0` |
| **`moondream2-vision`** | `IMAGE_UNDERSTANDING` | `ACCURATE` | 1.8 GB | 2 GB | N/A | `Apache-2.0` |
| **`whisper-tiny`** | `AUDIO_TRANSCRIPTION` | `FAST` | 75 MB | 512 MB | N/A | `MIT` |

---

## 3. Hardware & Quality-Aware Model Selection

The [`ModelSelector`](file:///H:/MyFileExplorers/electron/ai-search/ai/modelSelector.cjs) dynamically chooses the optimal model without hard-coding:
1. **Hardware Validation**: Rejects models whose `ramRequirementBytes` exceeds available host RAM.
2. **GPU Filtering**: Excludes GPU-only models if the host has no dedicated GPU.
3. **Quality Mode Alignment**:
   - **`FAST`**: Chooses the smallest footprint model (`bge-small-en-v1.5` / 384 dim).
   - **`BALANCED`**: Chooses high-accuracy, low-latency models (`nomic-embed-text-v1.5` / 768 dim).
   - **`ACCURATE`**: Chooses higher dimension/larger models where memory permits.
   - **`CLOUD`**: Optional cloud providers without local compute usage.

---

## 4. Key Guarantees

1. **Zero Large Downloads on Startup**: Nexora starts instantly; model installation is decoupled from startup.
2. **Resource Manager Integration**: If the host experiences CPU/RAM spikes (`ResourceAction.PAUSE`), the AI Engine automatically defers new AI tasks.
3. **Licensing Compliance**: Models track redistribution and commercial licensing attributes explicitly. Model weights are never embedded into the GitHub repository.
4. **Offline Local-First**: Embedding generation operates completely offline without internet or API key dependencies.
