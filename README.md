# AI Prompt + Image Workflow Tool

A full-stack Node.js + Express web app with two workflows:

1. **Text Workflow**
   - User enters a prompt
   - App enhances prompt using OpenAI
   - User approves improved prompt
   - App generates an image using Hugging Face (Stable Diffusion XL)

2. **Image Workflow**
   - User uploads an image
   - App analyzes image (caption, objects, style) using OpenAI vision
   - App generates similar variation images using Hugging Face

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express
- APIs:
  - OpenAI (`gpt-4o-mini`) for prompt enhancement and image analysis
  - Hugging Face Inference API for image generation

## Project Structure

```text
project-1/
  api/
    index.js              # Vercel serverless entry
  public/
    index.html            # React frontend entry (CDN)
    react-app.js          # React UI logic
    styles.css            # Basic clean styling
  src/
    app.js                # Express app + API routes
  .env.example
  .gitignore
  package.json
  server.js               # Local server entry
  vercel.json             # Vercel config
```

## Environment Variables

Copy `.env.example` to `.env` and fill values:

```env
OPENAI_API_KEY=your_openai_api_key_here
HF_API_KEY=your_huggingface_api_key_here
PORT=3000
```

## Local Run Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start in development mode:
   ```bash
   npm run dev
   ```
3. Open:
   - `http://localhost:3000`

## API Endpoints

- `POST /api/enhance-text`
  - Body: `{ "prompt": "..." }`
  - Returns: improved prompt
- `POST /api/generate-image`
  - Body: `{ "prompt": "..." }`
  - Returns: generated image (base64 data URL)
- `POST /api/generate-from-text` (backward-compatible alias)
  - Body: `{ "prompt": "..." }`
  - Returns: generated image (base64 data URL)
- `POST /api/analyze-image`
  - FormData: `image` file
  - Returns: `caption`, `objects`, `style`
- `POST /api/generate-variations`
  - Body: `{ "analysis": { ... } }`
  - Returns: variation prompts + images

## Vercel Deployment

### Option A: Vercel Dashboard

1. Push this project to GitHub.
2. Import the repository in Vercel.
3. In **Project Settings -> Environment Variables**, add:
   - `OPENAI_API_KEY`
   - `HF_API_KEY`
4. Deploy (Vercel auto-detects `vercel.json`).

### Option B: Vercel CLI

1. Install CLI:
   ```bash
   npm i -g vercel
   ```
2. Login:
   ```bash
   vercel login
   ```
3. Link and deploy:
   ```bash
   vercel
   ```
4. Set production environment variables:
   ```bash
   vercel env add OPENAI_API_KEY production
   vercel env add HF_API_KEY production
   ```
5. Redeploy production:
   ```bash
   vercel --prod
   ```

`vercel.json` is included for simple Express API + static frontend routing.

### Runtime Notes

- Node runtime is pinned via `package.json` engines (`>=18`) for Vercel compatibility.
- Unknown `/api/*` routes return JSON 404 instead of HTML fallback.

## Notes

- Keep API keys secret and never commit `.env`.
- Free-tier API limits may affect generation speed.
