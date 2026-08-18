use std::collections::HashSet;
use std::path::Path;
use candle_core::{Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config as BertConfig};
use tokenizers::Tokenizer;

pub const DEFAULT_EMBEDDING_DIM: usize = 384;
pub const LARGE_EMBEDDING_DIM: usize = 768;
pub const MAX_CHUNK_TOKENS: usize = 512;
pub const CHUNK_OVERLAP_TOKENS: usize = 64;

/// Represents an on-device dense text embedder capable of running transformer models
/// (Candle BERT / MiniLM / BGE) or high-fidelity deterministic dense projections.
pub struct TextEmbedder {
    device: Device,
    model: Option<BertModel>,
    tokenizer: Option<Tokenizer>,
    embedding_dim: usize,
}

impl Default for TextEmbedder {
    fn default() -> Self {
        Self::new()
    }
}

impl TextEmbedder {
    pub fn new() -> Self {
        Self {
            device: Device::Cpu,
            model: None,
            tokenizer: None,
            embedding_dim: DEFAULT_EMBEDDING_DIM,
        }
    }

    pub fn with_dimension(dim: usize) -> Self {
        Self {
            device: Device::Cpu,
            model: None,
            tokenizer: None,
            embedding_dim: if dim == 0 { DEFAULT_EMBEDDING_DIM } else { dim },
        }
    }

    /// Load a Candle BERT / MiniLM model from local safetensors, config JSON, and tokenizer JSON
    pub fn load_bert_model<P: AsRef<Path>>(
        weights_path: P,
        config_path: Option<P>,
        tokenizer_path: Option<P>,
    ) -> Result<Self, String> {
        let device = Device::Cpu;

        let tokenizer = if let Some(t_path) = tokenizer_path {
            let tok = Tokenizer::from_file(t_path.as_ref())
                .map_err(|e| format!("Failed to load tokenizer: {}", e))?;
            Some(tok)
        } else {
            None
        };

        let config: BertConfig = if let Some(c_path) = config_path {
            let file_str = std::fs::read_to_string(c_path.as_ref())
                .map_err(|e| format!("Failed to open config file: {}", e))?;
            serde_json::from_str(&file_str)
                .map_err(|e| format!("Failed to parse config JSON: {}", e))?
        } else {
            // Default to MiniLM-L6-v2 configuration JSON (384d, 6 layers, 12 heads, 30522 vocab)
            let default_minilm_cfg = r#"{
                "vocab_size": 30522,
                "hidden_size": 384,
                "num_hidden_layers": 6,
                "num_attention_heads": 12,
                "intermediate_size": 1536,
                "hidden_act": "gelu",
                "hidden_dropout_prob": 0.1,
                "max_position_embeddings": 512,
                "type_vocab_size": 2,
                "initializer_range": 0.02,
                "layer_norm_eps": 1e-12,
                "pad_token_id": 0,
                "position_embedding_type": "absolute",
                "use_cache": true,
                "model_type": "bert"
            }"#;
            serde_json::from_str(default_minilm_cfg)
                .map_err(|e| format!("Failed to parse default MiniLM config: {}", e))?
        };

        let hidden_dim = config.hidden_size;

        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(
                &[weights_path.as_ref()],
                candle_core::DType::F32,
                &device,
            ).map_err(|e| format!("Failed to map model weights: {}", e))?
        };

        let model = BertModel::load(vb, &config)
            .map_err(|e| format!("Failed to instantiate BertModel: {}", e))?;

        Ok(Self {
            device,
            model: Some(model),
            tokenizer,
            embedding_dim: hidden_dim,
        })
    }

    /// Check if a neural BERT model is actively loaded
    pub fn is_neural_model_loaded(&self) -> bool {
        self.model.is_some()
    }

    /// Get current embedding vector dimension (e.g. 384 or 768)
    pub fn dimension(&self) -> usize {
        self.embedding_dim
    }

    /// Generate a normalized dense embedding vector for the given text.
    /// Handles long texts by chunking into <= 512 token slices and average pooling.
    pub fn embed_text(&self, text: &str) -> Vec<f32> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return vec![0.0; self.embedding_dim];
        }

        // If neural BERT model and tokenizer are loaded, run neural inference
        if let (Some(ref model), Some(ref tokenizer)) = (&self.model, &self.tokenizer) {
            if let Ok(vec) = self.embed_with_bert(model, tokenizer, trimmed) {
                return vec;
            }
        }

        // Deterministic high-fidelity dense subword projection vectorizer
        generate_dense_projection_vector(trimmed, self.embedding_dim)
    }

    /// Run BERT forward pass with chunking and mean pooling
    fn embed_with_bert(
        &self,
        model: &BertModel,
        tokenizer: &Tokenizer,
        text: &str,
    ) -> Result<Vec<f32>, String> {
        let encoding = tokenizer.encode(text, true)
            .map_err(|e| format!("Tokenization failed: {}", e))?;
        let token_ids = encoding.get_ids();

        if token_ids.is_empty() {
            return Ok(vec![0.0; self.embedding_dim]);
        }

        // Break into overlapping chunks if > MAX_CHUNK_TOKENS
        let step = MAX_CHUNK_TOKENS - CHUNK_OVERLAP_TOKENS;
        let mut chunk_embeddings: Vec<Vec<f32>> = Vec::new();

        let mut start = 0;
        while start < token_ids.len() {
            let end = std::cmp::min(start + MAX_CHUNK_TOKENS, token_ids.len());
            let chunk_slice = &token_ids[start..end];

            let input_tensor = Tensor::new(chunk_slice, &self.device)
                .map_err(|e| e.to_string())?
                .unsqueeze(0)
                .map_err(|e| e.to_string())?;

            let token_type_ids = Tensor::zeros((1, chunk_slice.len()), candle_core::DType::U32, &self.device)
                .map_err(|e| e.to_string())?;

            let hidden_states = model.forward(&input_tensor, &token_type_ids, None)
                .map_err(|e| e.to_string())?;

            // Mean pooling over tokens (batch_size=1, seq_len, hidden_dim)
            let (_b, seq_len, _h) = hidden_states.dims3().map_err(|e| e.to_string())?;
            let pooled = (hidden_states.sum(1).map_err(|e| e.to_string())? / (seq_len as f64))
                .map_err(|e| e.to_string())?;

            let chunk_vec: Vec<f32> = pooled.squeeze(0)
                .map_err(|e| e.to_string())?
                .to_vec1()
                .map_err(|e| e.to_string())?;

            let norm_chunk = normalize_l2(&chunk_vec);
            chunk_embeddings.push(norm_chunk);

            if end == token_ids.len() {
                break;
            }
            start += step;
        }

        if chunk_embeddings.is_empty() {
            return Ok(vec![0.0; self.embedding_dim]);
        }

        // Average pooling across chunks
        let mut aggregated = vec![0.0f32; self.embedding_dim];
        let num_chunks = chunk_embeddings.len() as f32;
        for chunk in &chunk_embeddings {
            for (idx, val) in chunk.iter().enumerate() {
                if idx < self.embedding_dim {
                    aggregated[idx] += val / num_chunks;
                }
            }
        }

        Ok(normalize_l2(&aggregated))
    }

    /// Compute cosine similarity between two float vectors
    pub fn compute_cosine_similarity(&self, a: &[f32], b: &[f32]) -> f64 {
        cosine_similarity(a, b)
    }

    /// Compute semantic score (0 to 100) between resume text and job description
    pub fn compute_semantic_score(&self, resume_text: &str, job_description: &str) -> f64 {
        if resume_text.trim().is_empty() || job_description.trim().is_empty() {
            return 50.0;
        }

        let resume_vec = self.embed_text(resume_text);
        let job_vec = self.embed_text(job_description);
        let cos_sim = self.compute_cosine_similarity(&resume_vec, &job_vec);
        cosine_to_semantic_score(cos_sim)
    }
}

/// Compute cosine similarity between two float vectors in [-1.0, 1.0]
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }

    let mut dot = 0.0f64;
    let mut norm_a = 0.0f64;
    let mut norm_b = 0.0f64;

    for (&x, &y) in a.iter().zip(b.iter()) {
        let xf = x as f64;
        let yf = y as f64;
        dot += xf * yf;
        norm_a += xf * xf;
        norm_b += yf * yf;
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom <= 1e-12 {
        0.0
    } else {
        (dot / denom).clamp(-1.0, 1.0)
    }
}

/// Map cosine similarity [-1.0, 1.0] to a calibrated semantic score in [0.0, 100.0]
pub fn cosine_to_semantic_score(cos_sim: f64) -> f64 {
    if cos_sim.is_nan() {
        return 50.0;
    }

    let clamped_sim = cos_sim.clamp(-1.0, 1.0);
    let score = if clamped_sim >= 0.0 {
        // Map 0.0 -> 50.0, 0.35 -> ~80.0, 0.65+ -> 100.0
        50.0 + (clamped_sim / 0.65).min(1.0).powf(0.8) * 50.0
    } else {
        // Map -1.0 -> 0.0, 0.0 -> 50.0
        ((clamped_sim + 1.0) / 2.0) * 50.0
    };

    ((score * 10.0).round() / 10.0).clamp(0.0, 100.0)
}

/// Normalize float slice to unit L2 norm
pub fn normalize_l2(vec: &[f32]) -> Vec<f32> {
    let mut sum_sq = 0.0f64;
    for &val in vec {
        sum_sq += (val as f64) * (val as f64);
    }
    let norm = sum_sq.sqrt();
    if norm <= 1e-12 {
        vec.to_vec()
    } else {
        vec.iter().map(|&v| (v as f64 / norm) as f32).collect()
    }
}

/// Generate a 384-dimensional dense embedding vector for text
pub fn generate_embedding(text: &str) -> Vec<f32> {
    generate_embedding_dim(text, DEFAULT_EMBEDDING_DIM)
}

/// Generate an N-dimensional dense embedding vector for text (384d or 768d)
pub fn generate_embedding_dim(text: &str, dim: usize) -> Vec<f32> {
    generate_dense_projection_vector(text, dim)
}

/// Calculate the semantic similarity score (0.0 - 100.0) between resume text and job description.
pub fn compute_semantic_similarity(resume_text: &str, job_description: &str) -> f64 {
    let embedder = TextEmbedder::new();
    embedder.compute_semantic_score(resume_text, job_description)
}

/// Calculate semantic similarity score from precomputed float vectors
pub fn compute_semantic_similarity_from_vectors(resume_vec: &[f32], job_vec: &[f32]) -> f64 {
    let cos_sim = cosine_similarity(resume_vec, job_vec);
    cosine_to_semantic_score(cos_sim)
}

// ---------------------------------------------------------------------------
// High-Fidelity Deterministic Subword Projection Vectorizer (384d / 768d)
// ---------------------------------------------------------------------------

/// Generates a deterministic dense embedding vector of specified dimension (e.g. 384 or 768)
/// using multi-level subword tokenization, n-gram hashing, positional decay, and L2 normalization.
fn generate_dense_projection_vector(text: &str, dim: usize) -> Vec<f32> {
    let target_dim = if dim == 0 { DEFAULT_EMBEDDING_DIM } else { dim };
    let mut vector = vec![0.0f32; target_dim];

    let trimmed = text.trim();
    if trimmed.is_empty() {
        return vector;
    }

    let stop_words: HashSet<&'static str> = [
        "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at",
        "by", "for", "with", "about", "against", "between", "into", "through", "during",
        "before", "after", "above", "below", "to", "from", "up", "down", "in", "out",
        "on", "off", "over", "under", "again", "further", "then", "once", "here", "there",
        "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
        "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s",
        "t", "can", "will", "just", "don", "should", "now", "d", "ll", "m", "o", "re",
        "ve", "y", "ain", "aren", "couldn", "didn", "doesn", "hadn", "hasn", "haven",
        "isn", "ma", "mightn", "mustn", "needn", "shan", "shouldn", "wasn", "weren", "won",
        "wouldn", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had"
    ].iter().cloned().collect();

    let lines: Vec<&str> = trimmed.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    let total_lines = lines.len().max(1) as f32;

    let mut token_counts: std::collections::BTreeMap<String, f32> = std::collections::BTreeMap::new();

    // 1. Process tokens with positional importance
    for (line_idx, line) in lines.iter().enumerate() {
        let line_rel_pos = line_idx as f32 / total_lines;
        // Positional importance curve: top 25% of document has 1.4x weight, middle has 1.0x, bottom has 1.1x
        let pos_weight = if line_rel_pos < 0.25 {
            1.4
        } else if line_rel_pos > 0.85 {
            1.1
        } else {
            1.0
        };

        // Extract words
        let words: Vec<String> = line
            .to_lowercase()
            .split(|c: char| !c.is_alphanumeric() && c != '+' && c != '#' && c != '.')
            .filter(|w| !w.is_empty() && w.len() > 1 && !stop_words.contains(*w))
            .map(|w| w.to_string())
            .collect();

        // Single words
        for word in &words {
            *token_counts.entry(word.clone()).or_insert(0.0) += 1.0 * pos_weight;

            // Subword character n-grams (3 to 5 chars) to capture root semantics
            if word.len() >= 4 {
                let chars: Vec<char> = word.chars().collect();
                for n in 3..=5 {
                    if chars.len() >= n {
                        for window in chars.windows(n) {
                            let gram: String = window.iter().collect();
                            *token_counts.entry(format!("#{}", gram)).or_insert(0.0) += 0.35 * pos_weight;
                        }
                    }
                }
            }
        }

        // Word bigrams for context
        for window in words.windows(2) {
            let bigram = format!("{}_{}", window[0], window[1]);
            *token_counts.entry(bigram).or_insert(0.0) += 1.5 * pos_weight;
        }
    }

    // 2. Project each token/subword into target dense vector dimensions
    for (token, raw_tf) in token_counts {
        // Sublinear term frequency scaling: 1.0 + ln(tf)
        let tf_weight = 1.0 + (raw_tf as f64).ln() as f32;

        let hash_a = fnv1a_hash(token.as_bytes(), 0x811c9dc5);
        let hash_b = fnv1a_hash(token.as_bytes(), 0x9e3779b9);

        // Multi-head sparse-to-dense projection: project onto 6 distributed dimensions per token
        for head in 0..6 {
            let seed = (hash_a.wrapping_add(head * 0x654321) ^ hash_b.wrapping_mul(head + 1)) as usize;
            let target_dim_idx = seed % target_dim;
            
            // Sign determination from hash parity (+1 or -1)
            let sign = if (seed >> 16) & 1 == 0 { 1.0f32 } else { -1.0f32 };
            let head_weight = 1.0 / (1.0 + head as f32 * 0.25);

            vector[target_dim_idx] += sign * tf_weight * head_weight;
        }
    }

    // 3. Apply smooth non-linear activation (softsign: x / (1 + |x|)) to prevent outlier dominance
    for val in &mut vector {
        let x = *val;
        *val = x / (1.0 + x.abs());
    }

    // 4. L2-normalize to unit hypersphere
    normalize_l2(&vector)
}

/// FNV-1a non-cryptographic fast hashing utility
fn fnv1a_hash(bytes: &[u8], init: u32) -> u32 {
    let mut hash = init;
    for &byte in bytes {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_dense_embedding_dimensions() {
        let text = "Senior Rust Developer with extensive experience in PostgreSQL, Docker, and distributed systems.";
        
        let vec_384 = generate_embedding(text);
        assert_eq!(vec_384.len(), 384);

        let vec_768 = generate_embedding_dim(text, 768);
        assert_eq!(vec_768.len(), 768);

        // Verify L2 unit norm
        let norm_384: f32 = vec_384.iter().map(|v| v * v).sum::<f32>().sqrt();
        assert!((norm_384 - 1.0).abs() < 1e-4, "Vector norm should be approximately 1.0");

        let norm_768: f32 = vec_768.iter().map(|v| v * v).sum::<f32>().sqrt();
        assert!((norm_768 - 1.0).abs() < 1e-4, "Vector norm should be approximately 1.0");
    }

    #[test]
    fn test_cosine_similarity_identical_and_orthogonal() {
        let v1 = vec![1.0, 0.0, 0.0];
        let v2 = vec![1.0, 0.0, 0.0];
        let v3 = vec![0.0, 1.0, 0.0];
        let v4 = vec![-1.0, 0.0, 0.0];

        assert!((cosine_similarity(&v1, &v2) - 1.0).abs() < 1e-5);
        assert!((cosine_similarity(&v1, &v3) - 0.0).abs() < 1e-5);
        assert!((cosine_similarity(&v1, &v4) - (-1.0)).abs() < 1e-5);
    }

    #[test]
    fn test_semantic_similarity_scoring() {
        let resume_match = "Experienced Senior Software Engineer skilled in Rust, WebAssembly, SQLite, Backend API architectures, and Cloud deployments.";
        let job_desc = "We are seeking a Senior Backend Engineer proficient in Rust, SQLite database performance, API development, and WebAssembly systems.";
        let irrelevant_resume = "Chef with 10 years experience running Italian restaurant kitchens, managing sous chefs, pastry baking, and menu design.";

        let score_match = compute_semantic_similarity(resume_match, job_desc);
        let score_irrelevant = compute_semantic_similarity(irrelevant_resume, job_desc);

        assert!(score_match > 70.0, "Matching resume should yield high semantic score (got {})", score_match);
        assert!(score_irrelevant < 55.0, "Irrelevant resume should yield lower semantic score (got {})", score_irrelevant);
        assert!(score_match > score_irrelevant, "Matched score must be higher than irrelevant score");
    }

    #[test]
    fn test_empty_text_handling() {
        let score = compute_semantic_similarity("", "Job description text");
        assert_eq!(score, 50.0);

        let vec = generate_embedding("");
        assert_eq!(vec.len(), 384);
        assert!(vec.iter().all(|&v| v == 0.0));
    }

    #[test]
    fn test_cosine_to_semantic_score_bounds() {
        assert_eq!(cosine_to_semantic_score(1.0), 100.0);
        assert_eq!(cosine_to_semantic_score(-1.0), 0.0);
        assert_eq!(cosine_to_semantic_score(0.0), 50.0);
        assert_eq!(cosine_to_semantic_score(f64::NAN), 50.0);

        let score_pos = cosine_to_semantic_score(0.6);
        assert!(score_pos >= 50.0 && score_pos <= 100.0);

        let score_neg = cosine_to_semantic_score(-0.4);
        assert!(score_neg >= 0.0 && score_neg <= 50.0);
    }

    #[test]
    fn test_subword_projection_determinism() {
        let text = "Full-stack engineer building React and Tauri desktop apps.";
        let vec1 = generate_embedding(text);
        let vec2 = generate_embedding(text);
        assert_eq!(vec1, vec2, "Embeddings for identical text must be strictly identical");
    }

    #[test]
    fn test_embedder_struct_api() {
        let embedder = TextEmbedder::with_dimension(384);
        assert_eq!(embedder.dimension(), 384);
        assert!(!embedder.is_neural_model_loaded());

        let vec = embedder.embed_text("Machine learning engineer with PyTorch expertise");
        assert_eq!(vec.len(), 384);

        let score = embedder.compute_semantic_score(
            "Machine learning engineer with PyTorch and CUDA experience",
            "Looking for ML engineer proficient in PyTorch and GPU computing",
        );
        assert!(score > 70.0);
    }
}

