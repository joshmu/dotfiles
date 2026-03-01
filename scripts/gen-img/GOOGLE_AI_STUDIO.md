# Google AI Studio Integration (Future)

Reference doc for adding Google AI Studio as a second provider to gen-img.

## Status: Backlog

Blocked by: Google AI Studio API key has zero free tier quota for image generation models. Need to either enable billing on the Google Cloud project or create a new API key with free tier access.

## Key Findings (March 2026)

- **Nano Banana 2** (Gemini 3.1 Flash Image) has **no free tier** — requires paid billing
- **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`) is supposedly free (500/day, 10 RPM) but our API key returned `limit: 0`
- Available models: `gemini-2.5-flash-image`, `gemini-3.1-flash-image-preview`, `gemini-2.0-flash-exp-image-generation`
- List models: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY"`

## Architecture (Ready to Implement)

Designed and tested multi-provider architecture — see git history or plan file for details:

- Provider interface: `ImageResult { data: ArrayBuffer; extension: string }`
- Config: `{ replicateApiKey?, googleApiKey? }` with `requireKey()` validation
- CLI: `--provider replicate|google` / `-P` flag
- Gemini REST API (no SDK): POST to `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Request: `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }`
- Response: base64 image in `candidates[0].content.parts[].inlineData.data`

## To Resume

1. Fix API key quota — try creating a new key at https://aistudio.google.com/apikey
2. Or enable billing on the Google Cloud project linked to the key
3. Test with: `curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=API_KEY" -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"a cat"}]}],"generationConfig":{"responseModalities":["TEXT","IMAGE"]}}'`
4. If that works, implement the multi-provider architecture from the plan
