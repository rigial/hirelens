export const APP_NAME = "HireLens";
export const APP_TAGLINE = "Privacy-first local AI hiring assistant";

export const MODEL_TIER_CONFIG = {
  fast: {
    label: "Fast",
    model: "Qwen3-4B-Q4_K_M.gguf",
    size: "~2.5 GB",
    notes: "Ideal for laptops with 8 GB RAM or CPU-only setups.",
  },
  balanced: {
    label: "Balanced",
    model: "Qwen3-8B-Q4_K_M.gguf",
    size: "~5 GB",
    notes: "Recommended for optimal speed and extraction accuracy.",
  },
  quality: {
    label: "Quality",
    model: "Qwen3-14B-Q4_K_M.gguf",
    size: "~9 GB",
    notes: "Maximum precision for detailed qualitative insights.",
  },
};
