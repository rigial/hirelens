use std::collections::HashMap;
use std::fs::File;
use std::path::Path;
use candle_core::quantized::gguf_file::{self, Value};
use candle_core::{Device, Tensor};
use candle_transformers::generation::LogitsProcessor;
use candle_transformers::models::quantized_llama::ModelWeights;

#[derive(Debug, Clone)]
pub struct GenerationConfig {
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: usize,
    pub repeat_penalty: f32,
    pub repeat_last_n: usize,
}

impl Default for GenerationConfig {
    fn default() -> Self {
        Self {
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 1024,
            repeat_penalty: 1.1,
            repeat_last_n: 64,
        }
    }
}

pub struct GgufEngine {
    pub model_path: String,
    device: Device,
    model: ModelWeights,
    eos_token_id: u32,
    vocab: Vec<String>,
    token_to_id: HashMap<String, u32>,
}

impl GgufEngine {
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let path_ref = path.as_ref();
        let path_str = path_ref.to_string_lossy().to_string();

        let mut file = File::open(path_ref)
            .map_err(|e| format!("Failed to open GGUF file {}: {}", path_str, e))?;

        let content = gguf_file::Content::read(&mut file)
            .map_err(|e| format!("Failed to read GGUF content: {}", e))?;

        // Determine device: CPU for reliable universal execution
        let device = Device::Cpu;

        // Extract vocabulary and special tokens from GGUF metadata
        let mut vocab = Vec::new();
        let mut token_to_id = HashMap::new();
        let mut eos_token_id = 151645u32; // Default for Qwen2/Qwen2.5 (<|im_end|>) or 151643 (<|endoftext|>)

        if let Some(Value::Array(tokens)) = content.metadata.get("tokenizer.ggml.tokens") {
            for (idx, token_val) in tokens.iter().enumerate() {
                if let Value::String(token_str) = token_val {
                    vocab.push(token_str.clone());
                    token_to_id.insert(token_str.clone(), idx as u32);
                }
            }
        }

        if let Some(val) = content.metadata.get("tokenizer.ggml.eos_token_id") {
            match val {
                Value::U32(id) => eos_token_id = *id,
                Value::I32(id) => eos_token_id = *id as u32,
                Value::U64(id) => eos_token_id = *id as u32,
                Value::I64(id) => eos_token_id = *id as u32,
                _ => {}
            }
        }

        // Try to identify special end-of-sequence / instruct stop tokens
        for special in &["<|im_end|>", "<|endoftext|>", "</s>", "<|eot_id|>"] {
            if let Some(id) = token_to_id.get(*special) {
                eos_token_id = *id;
                break;
            }
        }

        let model = ModelWeights::from_gguf(content, &mut file, &device)
            .map_err(|e| format!("Failed to instantiate quantized model: {}", e))?;

        Ok(Self {
            model_path: path_str,
            device,
            model,
            eos_token_id,
            vocab,
            token_to_id,
        })
    }

    pub fn encode(&self, text: &str) -> Vec<u32> {
        let mut tokens = Vec::new();
        let bytes = text.as_bytes();
        let mut byte_idx = 0;

        while byte_idx < bytes.len() {
            let mut matched_token_id = None;
            let mut longest_len = 0;

            let max_lookahead = std::cmp::min(bytes.len() - byte_idx, 64);
            for len in (1..=max_lookahead).rev() {
                if let Ok(slice_str) = std::str::from_utf8(&bytes[byte_idx..byte_idx + len]) {
                    if let Some(&id) = self.token_to_id.get(slice_str) {
                        matched_token_id = Some(id);
                        longest_len = len;
                        break;
                    }
                    let with_space = format!(" {}", slice_str);
                    if let Some(&id) = self.token_to_id.get(&with_space) {
                        matched_token_id = Some(id);
                        longest_len = len;
                        break;
                    }
                    let with_gh_space = format!("Ġ{}", slice_str);
                    if let Some(&id) = self.token_to_id.get(&with_gh_space) {
                        matched_token_id = Some(id);
                        longest_len = len;
                        break;
                    }
                }
            }

            if let Some(id) = matched_token_id {
                tokens.push(id);
                byte_idx += longest_len;
            } else {
                let b = bytes[byte_idx];
                let byte_token = format!("<0x{:02X}>", b);
                if let Some(&id) = self.token_to_id.get(&byte_token) {
                    tokens.push(id);
                } else if let Ok(s) = std::str::from_utf8(&bytes[byte_idx..byte_idx + 1]) {
                    if let Some(&id) = self.token_to_id.get(s) {
                        tokens.push(id);
                    }
                }
                byte_idx += 1;
            }
        }

        if tokens.is_empty() {
            if let Some(&bos) = self.token_to_id.get("<|im_start|>") {
                tokens.push(bos);
            }
        }

        tokens
    }

    pub fn decode_token(&self, token_id: u32) -> String {
        if let Some(t) = self.vocab.get(token_id as usize) {
            t.replace(['Ġ', ' '], " ")
             .replace("<0x0A>", "\n")
             .replace("<0x20>", " ")
        } else {
            String::new()
        }
    }

    pub fn generate(&mut self, prompt: &str, config: &GenerationConfig) -> Result<String, String> {
        let formatted_prompt = if self.token_to_id.contains_key("<|im_start|>") {
            format!("<|im_start|>system\nYou are a precise AI assistant. Output ONLY requested JSON format.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n", prompt)
        } else {
            format!("[INST] {} [/INST]", prompt)
        };

        let prompt_tokens = self.encode(&formatted_prompt);
        if prompt_tokens.is_empty() {
            return Err("Failed to tokenize prompt".to_string());
        }

        let mut logits_processor = LogitsProcessor::new(
            299792458,
            Some(config.temperature),
            Some(config.top_p),
        );

        let mut all_tokens = prompt_tokens.clone();
        let mut generated_text = String::new();
        let mut pos = 0;

        // Process prompt tokens
        for i in 0..prompt_tokens.len() {
            let input = Tensor::new(&prompt_tokens[i..=i], &self.device)
                .map_err(|e| format!("Tensor error: {}", e))?
                .unsqueeze(0)
                .map_err(|e| format!("Tensor unsqueeze error: {}", e))?;

            let logits = self.model.forward(&input, pos)
                .map_err(|e| format!("Forward pass error: {}", e))?;
            pos += 1;

            if i == prompt_tokens.len() - 1 {
                let logits = logits.squeeze(0).map_err(|e| e.to_string())?;
                let logits = logits.squeeze(0).map_err(|e| e.to_string())?;

                let next_token = logits_processor.sample(&logits)
                    .map_err(|e| format!("Sample error: {}", e))?;

                all_tokens.push(next_token);
                let decoded = self.decode_token(next_token);
                generated_text.push_str(&decoded);
            }
        }

        // Autoregressive generation loop
        for _ in 0..config.max_tokens {
            let last_token = *all_tokens.last().unwrap();

            if last_token == self.eos_token_id {
                break;
            }

            if generated_text.ends_with("<|im_end|>")
                || generated_text.ends_with("<|endoftext|>")
                || generated_text.ends_with("</s>")
                || generated_text.ends_with("<|eot_id|>")
            {
                break;
            }

            let input = Tensor::new(&[last_token], &self.device)
                .map_err(|e| format!("Tensor error: {}", e))?
                .unsqueeze(0)
                .map_err(|e| format!("Tensor unsqueeze error: {}", e))?;

            let logits = self.model.forward(&input, pos)
                .map_err(|e| format!("Forward pass error: {}", e))?;
            pos += 1;

            let logits = logits.squeeze(0).map_err(|e| e.to_string())?;
            let mut logits = logits.squeeze(0).map_err(|e| e.to_string())?;

            if config.repeat_penalty > 1.0 {
                let start_at = all_tokens.len().saturating_sub(config.repeat_last_n);
                let recent_tokens = &all_tokens[start_at..];
                logits = candle_transformers::utils::apply_repeat_penalty(
                    &logits,
                    config.repeat_penalty,
                    recent_tokens,
                ).map_err(|e| format!("Repeat penalty error: {}", e))?;
            }

            let next_token = logits_processor.sample(&logits)
                .map_err(|e| format!("Sample error: {}", e))?;

            all_tokens.push(next_token);
            let decoded = self.decode_token(next_token);
            generated_text.push_str(&decoded);
        }

        let clean_text = generated_text
            .replace("<|im_end|>", "")
            .replace("<|endoftext|>", "")
            .replace("</s>", "")
            .replace("<|eot_id|>", "");

        Ok(clean_text)
    }
}
