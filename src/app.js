const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const OpenAI = require("openai");
const { InferenceClient } = require("@huggingface/inference");

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

// ── File upload: memory storage, 10 MB limit, images only ──────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

// ── Lazy client init (avoids crash at startup when keys are missing) ────────
let openai = null;
let hf = null;

// ── Helpers ─────────────────────────────────────────────────────────────────
function sendError(res, status, message, details) {
  return res.status(status).json({ error: message, details: details || null });
}

function ensureEnvVars(req, res, next) {
  if (!process.env.OPENAI_API_KEY) {
    return sendError(res, 500, "OPENAI_API_KEY is not configured.");
  }
  if (!process.env.HF_API_KEY) {
    return sendError(res, 500, "HF_API_KEY is not configured.");
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (!hf) {
    hf = new InferenceClient(process.env.HF_API_KEY);
  }
  next();
}

/**
 * Strip markdown code fences that models sometimes wrap JSON in.
 * e.g. ```json { ... } ``` → { ... }
 */
function stripCodeFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/**
 * Generate an image via Hugging Face SDXL with production-quality settings.
 */
async function generateHFImage(prompt) {
  const blob = await hf.textToImage({
    model: "stabilityai/stable-diffusion-xl-base-1.0",
    inputs: prompt,
    parameters: {
      num_inference_steps: 35,   // More steps → sharper, higher quality
      guidance_scale: 7.5,       // Balances prompt adherence vs creativity
      width: 1024,
      height: 1024,
    },
  });
  const buffer = Buffer.from(await blob.arrayBuffer());
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

// ── POST /api/enhance-text ──────────────────────────────────────────────────
// Analyzes the user's raw idea (tone, intent, requirements) and returns a
// richly detailed, Stable Diffusion-optimized prompt for user approval.
app.post("/api/enhance-text", ensureEnvVars, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return sendError(res, 400, "A non-empty prompt string is required.");
  }
  if (prompt.trim().length > 2000) {
    return sendError(res, 400, "Prompt must be 2000 characters or fewer.");
  }

  try {
    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `You are an expert prompt engineer specializing in AI image generation with Stable Diffusion XL.

Your task:
1. Analyze the user's raw idea — understand their intent, subject matter, and emotional tone.
2. Craft a richly detailed, production-quality image generation prompt.

Your enhanced prompt MUST include all of the following elements naturally:
• Subject: Clear description of the main subject(s) with specific visual details
• Art style: (e.g., photorealistic, cinematic photography, digital art, oil painting, concept art)
• Lighting: (e.g., golden hour sunlight, dramatic side lighting, soft diffused studio light, neon glow)
• Color palette & mood: (e.g., warm amber tones, cool desaturated blues, vibrant jewel tones)
• Composition: (e.g., wide establishing shot, tight close-up portrait, rule of thirds, symmetrical)
• Quality boosters: masterpiece, best quality, ultra-detailed, 8K resolution, sharp focus, award-winning
• Camera/lens details when relevant: (e.g., shot on Canon EOS R5, 85mm f/1.4, shallow depth of field, bokeh)

Rules:
- Return ONLY the improved prompt text. No explanations, labels, headers, or markdown.
- Keep it under 300 words but rich and specific.
- Never add negative prompts — only describe what should BE in the image.`,
        },
        {
          role: "user",
          content: `Enhance this idea into a detailed image generation prompt:\n\n"${prompt.trim()}"`,
        },
      ],
      max_output_tokens: 350,
    });

    const improvedPrompt = completion.output_text?.trim();
    if (!improvedPrompt) {
      return sendError(res, 502, "AI returned an empty response. Please try again.");
    }

    return res.json({ improvedPrompt });
  } catch (error) {
    console.error("[enhance-text]", error.message);
    return sendError(res, 500, "Failed to enhance prompt.", error.message);
  }
});

// ── POST /api/generate-image ────────────────────────────────────────────────
// Generates a single image from an approved enhanced prompt.
app.post("/api/generate-image", ensureEnvVars, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return sendError(res, 400, "A non-empty prompt string is required.");
  }
  if (prompt.trim().length > 2000) {
    return sendError(res, 400, "Prompt must be 2000 characters or fewer.");
  }

  try {
    const imageDataUrl = await generateHFImage(prompt.trim());
    return res.json({ images: [imageDataUrl] });
  } catch (error) {
    console.error("[generate-image]", error.message);
    return sendError(res, 500, "Failed to generate image.", error.message);
  }
});

// ── POST /api/analyze-image ─────────────────────────────────────────────────
// Uses GPT-4o Vision to extract caption, objects, style, mood, lighting,
// color palette, and composition from an uploaded image.
app.post(
  "/api/analyze-image",
  ensureEnvVars,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return sendError(res, 400, "An image file is required.");
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/png";
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    try {
      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: `You are an expert AI image analyst and art critic.

Analyze the provided image thoroughly and return a single JSON object with EXACTLY these keys:
{
  "caption": "A vivid, detailed 2-3 sentence description of the full scene and its narrative",
  "objects": ["list", "of", "every", "notable", "subject", "and", "element"],
  "style": "The visual/artistic style (e.g., photorealistic, oil painting, anime, watercolor, sketch, cinematic)",
  "mood": "The emotional atmosphere (e.g., serene and peaceful, dark and mysterious, joyful and vibrant, tense and dramatic)",
  "lighting": "Lighting description (e.g., golden hour sunlight, dramatic chiaroscuro, soft overcast diffusion, neon artificial light)",
  "color_palette": "Dominant color relationships (e.g., warm ochres and rich burgundy, cool desaturated blues and greys, high-contrast black and white with pops of red)",
  "composition": "Spatial arrangement style (e.g., centered portrait with shallow depth of field, wide-angle panoramic landscape, diagonal leading lines, rule of thirds)"
}

CRITICAL rules:
- Return ONLY valid JSON. No markdown, no code fences, no extra text before or after.
- Every key must be present. Use empty string for unknown string fields, empty array for objects if none found.`,
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Analyze this image thoroughly and return the JSON analysis.",
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
              },
            ],
          },
        ],
        max_output_tokens: 450,
      });

      const raw = stripCodeFences(response.output_text || "{}");

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Graceful fallback: treat the whole text as a caption
        console.warn("[analyze-image] JSON parse failed, using raw text as caption.");
        parsed = {
          caption: raw,
          objects: [],
          style: "unknown",
          mood: "",
          lighting: "",
          color_palette: "",
          composition: "",
        };
      }

      // Ensure all expected keys exist
      const analysis = {
        caption: parsed.caption || "",
        objects: Array.isArray(parsed.objects) ? parsed.objects : [],
        style: parsed.style || "",
        mood: parsed.mood || "",
        lighting: parsed.lighting || "",
        color_palette: parsed.color_palette || "",
        composition: parsed.composition || "",
      };

      return res.json({ analysis });
    } catch (error) {
      console.error("[analyze-image]", error.message);
      return sendError(res, 500, "Failed to analyze image.", error.message);
    }
  }
);

// ── POST /api/generate-variations ──────────────────────────────────────────
// Uses the rich image analysis to generate 3 distinct artistic variations:
//   1. Faithful high-quality re-creation
//   2. Dramatic cinematic reinterpretation
//   3. Surreal / fine-art reimagining
app.post("/api/generate-variations", ensureEnvVars, async (req, res) => {
  const { analysis } = req.body;
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return sendError(res, 400, "A valid analysis object is required.");
  }

  const {
    caption,
    objects,
    style,
    mood,
    lighting,
    color_palette,
    composition,
  } = analysis;

  const objectStr = Array.isArray(objects) && objects.length
    ? objects.join(", ")
    : "various subjects";

  const baseScene   = caption       || "A creative artistic scene";
  const artStyle    = style         || "photorealistic";
  const atmosphere  = mood          || "captivating";
  const baseLight   = lighting      || "natural light";
  const colors      = color_palette || "rich tones";
  const comp        = composition   || "balanced composition";

  const quality = "masterpiece, best quality, ultra-detailed, 8K resolution, sharp focus, award-winning photography";

  const prompts = [
    // Variation 1 — Faithful high-quality re-creation
    `${baseScene}, with ${objectStr}, ${artStyle} style, ${baseLight}, ${colors}, ${comp}, ${quality}`,

    // Variation 2 — Dramatic cinematic reinterpretation
    `${baseScene}, featuring ${objectStr}, dramatic cinematic atmosphere, golden hour rim lighting, deep volumetric shadows, high contrast, vivid saturated colors, widescreen composition, ${artStyle} style, ${quality}`,

    // Variation 3 — Surreal fine-art reimagining
    `${baseScene}, featuring ${objectStr}, reimagined as painterly fine art, ${atmosphere} emotional mood, ethereal soft lighting, dreamy bokeh effects, painterly brushstroke textures, surreal details, ${colors}, ${quality}`,
  ];

  try {
    const imageData = [];
    for (const prompt of prompts) {
      const dataUrl = await generateHFImage(prompt);
      imageData.push(dataUrl);
    }
    return res.json({ prompts, images: imageData });
  } catch (error) {
    console.error("[generate-variations]", error.message);
    return sendError(res, 500, "Failed to generate variations.", error.message);
  }
});

// ── API 404 ─────────────────────────────────────────────────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("[unhandled]", err.message);
  // Handle multer-specific errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return sendError(res, 413, "File too large. Maximum size is 10 MB.");
  }
  return sendError(res, 500, "An unexpected server error occurred.", err.message);
});

module.exports = app;
