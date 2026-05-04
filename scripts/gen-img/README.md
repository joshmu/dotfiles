# gen-img

AI image generation via Raycast or CLI. Supports OpenAI (default) and Replicate.

## Setup

### OpenAI (default)

1. Set `OPENAI_API_KEY` in your environment
2. Done — no config file needed

### Replicate (optional fallback)

1. Get a Replicate API key from [replicate.com](https://replicate.com)
2. Copy `config.example.json` to `config.json`
3. Add your API key to `config.json`

### Raycast

Symlink `raycast-gen-img.sh` to your Raycast scripts directory.

## Usage

```bash
# OpenAI gpt-image-2 (default)
bun run gen-img.ts "a cat wearing a top hat"

# Higher quality / custom size
bun run gen-img.ts "minimalist coffee logo, white background" --quality high
bun run gen-img.ts "portrait shot" --size 1024x1536

# Replicate fallback
bun run gen-img.ts "neon cyberpunk skyline" --provider replicate

# Help
bun run gen-img.ts --help
```

## Output

- OpenAI: `~/Downloads/{descriptive-name}.png`
- Replicate: `~/Downloads/{descriptive-name}.jpg`
- Path copied to clipboard
- macOS notification on completion/failure

## Models

| Provider    | Default                        | Override                     |
| ----------- | ------------------------------ | ---------------------------- |
| `openai`    | `gpt-image-2`                  | `--model gpt-image-1.5` etc. |
| `replicate` | `black-forest-labs/flux-2-pro` | `--model <owner>/<name>`     |

For free Replicate alternatives: <https://replicate.com/collections/try-for-free>

## Files

| File                  | Purpose                        |
| --------------------- | ------------------------------ |
| `gen-img.ts`          | Main script (Bun)              |
| `raycast-gen-img.sh`  | Raycast wrapper                |
| `config.json`         | Replicate API key (gitignored) |
| `config.example.json` | Replicate config template      |
