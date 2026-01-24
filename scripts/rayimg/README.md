# gen-img

AI image generation via Raycast using Replicate API.

## Setup

1. Get a Replicate API key from [replicate.com](https://replicate.com)
2. Copy `config.example.json` to `config.json`
3. Add your API key to `config.json`
4. Symlink `raycast-gen-img.sh` to your Raycast scripts directory

## Usage

```bash
# Direct
bun run gen-img.ts "a cat wearing a top hat"

# Via Raycast
# Trigger "Generate Image" command and enter prompt
```

## Output

- Images saved to `~/Downloads/{descriptive-name}.jpg`
- Path copied to clipboard
- macOS notification on completion/failure

## Model

Currently uses **Google Imagen 4** via Replicate.

### Free Models

If the current model stops working or requires payment, check for free alternatives at:
**https://replicate.com/collections/try-for-free**

Update `REPLICATE_MODEL` in `gen-img.ts` to switch models.

## Files

| File | Purpose |
|------|---------|
| `gen-img.ts` | Main script (Bun) |
| `raycast-gen-img.sh` | Raycast wrapper |
| `config.json` | API key (gitignored) |
| `config.example.json` | Config template |
