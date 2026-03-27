const { useState, useCallback } = React;

/* ─── Tiny Icon helpers ─── */
const Icon = ({ children }) => <span style={{ lineHeight: 1 }}>{children}</span>;

/* ─── Download helper ─── */
function downloadImage(src, name) {
  const a = document.createElement("a");
  a.href = src;
  a.download = name || "pearmedia-image.png";
  a.click();
}

/* ─── Step Progress Bar ─── */
function StepProgress({ steps, current }) {
  return (
    <div className="step-progress">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={label} className={`step-item ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}>
            <div className="step-num">
              {isDone ? "✓" : i + 1}
            </div>
            <span className="step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Analysis Display ─── */
const ANALYSIS_FIELDS = [
  { key: "caption",       label: "Caption",       type: "text" },
  { key: "style",         label: "Style",         type: "text" },
  { key: "mood",          label: "Mood",          type: "text" },
  { key: "lighting",     label: "Lighting",      type: "text" },
  { key: "color_palette",label: "Palette",       type: "text" },
  { key: "composition",  label: "Composition",   type: "text" },
  { key: "objects",      label: "Objects",       type: "tags" },
];

function AnalysisDisplay({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="analysis-result" style={{ marginTop: 16 }}>
      {ANALYSIS_FIELDS.map(({ key, label, type }) => {
        const value = analysis[key];
        const hasValue = type === "tags"
          ? Array.isArray(value) && value.length > 0
          : value && typeof value === "string" && value.trim();
        if (!hasValue) return null;
        return (
          <div className="analysis-field" key={key}>
            <span className="analysis-field-label">{label}</span>
            {type === "tags" ? (
              <div className="tag-list">
                {value.map((obj, i) => (
                  <span className="tag" key={i}>{obj}</span>
                ))}
              </div>
            ) : (
              <span className="analysis-field-value">{value}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Image Grid ─── */
function ImageGrid({ images, prompts, label }) {
  return (
    <div className="images-grid">
      {images.map((src, i) => (
        <div className="image-card" key={i}>
          <img src={src} alt={`${label || "Generated"} ${i + 1}`} />
          <div className="image-card-footer">
            <span className="image-card-label">{label || "Image"} {i + 1}</span>
            <button className="btn-download" onClick={() => downloadImage(src, `pearmedia-${label || "image"}-${i + 1}.png`)}>
              ↓ Save
            </button>
          </div>
          {prompts && prompts[i] && (
            <div className="variation-prompt-chip">
              <strong style={{ color: "#a5b4fc", fontStyle: "normal" }}>Prompt:</strong>{" "}
              {prompts[i].length > 120 ? prompts[i].slice(0, 120) + "…" : prompts[i]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TEXT WORKFLOW TAB
   ═══════════════════════════════════════════ */
function TextWorkflow({ setGlobalStatus, setGlobalError }) {
  const [prompt, setPrompt] = useState("");
  const [enhancedText, setEnhancedText] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [loadingEnhance, setLoadingEnhance] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  /* Step index: 0=Write, 1=Enhanced, 2=Approved, 3=Generated */
  const currentStep = generatedImages.length > 0 ? 3 : isApproved ? 2 : enhancedText ? 1 : 0;

  async function handleEnhance() {
    if (!prompt.trim()) { setGlobalError("Please enter a prompt first."); return; }
    setGlobalError(""); setLoadingEnhance(true);
    setGlobalStatus("Enhancing your prompt with AI…");
    try {
      const res = await fetch("/api/enhance-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to enhance.");
      setEnhancedText(data.improvedPrompt || "");
      setIsApproved(false);
      setGeneratedImages([]);
      setGlobalStatus("Prompt enhanced — review and approve to continue.");
    } catch (err) {
      setGlobalError(err.message);
      setGlobalStatus("Idle");
    } finally { setLoadingEnhance(false); }
  }

  function handleApprove() {
    if (!enhancedText.trim()) { setGlobalError("Nothing to approve yet."); return; }
    setIsApproved(true);
    setGlobalStatus("Prompt approved — ready to generate image.");
  }

  async function handleGenerateImage() {
    if (!isApproved) { setGlobalError("Please approve the enhanced prompt first."); return; }
    setGlobalError(""); setLoadingImage(true);
    setGlobalStatus("Generating image with Stable Diffusion…");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enhancedText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate image.");
      setGeneratedImages(data.images || []);
      setGlobalStatus("Image generated successfully! ✨");
    } catch (err) {
      setGlobalError(err.message);
      setGlobalStatus("Idle");
    } finally { setLoadingImage(false); }
  }

  /* Regenerate: same prompt, new image */
  async function handleRegenerateImage() {
    setGlobalError(""); setLoadingImage(true);
    setGlobalStatus("Regenerating a new image…");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enhancedText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate.");
      setGeneratedImages(data.images || []);
      setGlobalStatus("Image regenerated! ✨");
    } catch (err) {
      setGlobalError(err.message);
      setGlobalStatus("Idle");
    } finally { setLoadingImage(false); }
  }

  return (
    <>
      <StepProgress
        steps={["Write Prompt", "Enhance", "Approve", "Generate"]}
        current={currentStep}
      />

      <div className="card">
        <div className="card-header">
          <div className="card-icon purple">✍️</div>
          <div>
            <h2>Text Prompt</h2>
            <p>Describe what you want to generate</p>
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="promptInput">Your Idea</label>
          <textarea
            id="promptInput"
            rows={4}
            value={prompt}
            onChange={e => { setPrompt(e.target.value); setIsApproved(false); }}
            placeholder="e.g. A futuristic city floating in the clouds at golden hour…"
          />
        </div>

        <div className="btn-row">
          <button className="btn-primary" onClick={handleEnhance} disabled={loadingEnhance || !prompt.trim()} id="btn-enhance">
            {loadingEnhance ? <><span className="spinner" /> Enhancing…</> : <><Icon>✨</Icon> Enhance with AI</>}
          </button>
        </div>
      </div>

      {enhancedText && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon teal">🎯</div>
            <div>
              <h2>Enhanced Prompt</h2>
              <p>AI-improved version — review before approving</p>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="enhancedOutput">Improved Prompt</label>
            <textarea
              id="enhancedOutput"
              rows={5}
              value={enhancedText}
              onChange={e => { setEnhancedText(e.target.value); setIsApproved(false); }}
              placeholder="Enhanced prompt appears here…"
            />
            <p className="helper-text">You can edit this before approving.</p>
          </div>

          <div className="btn-row">
            <button
              className={isApproved ? "btn-approved" : "btn-green"}
              onClick={handleApprove}
              disabled={isApproved}
              id="btn-approve"
            >
              {isApproved ? <><Icon>✅</Icon> Approved</> : <><Icon>✔️</Icon> Approve Prompt</>}
            </button>
            <button className="btn-ghost" onClick={handleEnhance} disabled={loadingEnhance} id="btn-re-enhance">
              {loadingEnhance ? <><span className="spinner" /> …</> : <><Icon>🔄</Icon> Re-Enhance</>}
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon pink">🖼️</div>
            <div>
              <h2>Image Generation</h2>
              <p>Generate images using Stable Diffusion XL</p>
            </div>
          </div>

          <div className="btn-row">
            <button
              className="btn-primary"
              onClick={handleGenerateImage}
              disabled={loadingImage}
              id="btn-generate"
            >
              {loadingImage ? <><span className="spinner" /> Generating…</> : <><Icon>🚀</Icon> Generate Image</>}
            </button>
            {generatedImages.length > 0 && (
              <button
                className="btn-amber"
                onClick={handleRegenerateImage}
                disabled={loadingImage}
                id="btn-regenerate-text"
              >
                {loadingImage ? <><span className="spinner" /> Regenerating…</> : <><Icon>🎲</Icon> Regenerate</>}
              </button>
            )}
          </div>

          {generatedImages.length > 0 && (
            <div className="images-section" style={{ marginTop: 24 }}>
              <div className="images-header">
                <h3>Generated Images <span className="images-count">{generatedImages.length}</span></h3>
              </div>
              <ImageGrid images={generatedImages} label="Generated" />
            </div>
          )}

          {loadingImage && generatedImages.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">⏳</span>
              <p>This may take 20–60 seconds. Please wait…</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   IMAGE WORKFLOW TAB
   ═══════════════════════════════════════════ */
function ImageWorkflow({ setGlobalStatus, setGlobalError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [variations, setVariations] = useState([]);
  const [variationPrompts, setVariationPrompts] = useState([]);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /* Step: 0=Upload, 1=Analyzed, 2=Variations */
  const currentStep = variations.length > 0 ? 2 : analysis ? 1 : 0;

  function handleFileChange(file) {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysis(null);
    setVariations([]);
    setVariationPrompts([]);
  }

  async function handleAnalyze() {
    if (!selectedFile) { setGlobalError("Please upload an image first."); return; }
    setGlobalError(""); setLoadingAnalyze(true);
    setGlobalStatus("Analyzing image with GPT-4o Vision…");
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      const res = await fetch("/api/analyze-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze.");
      setAnalysis(data.analysis || {});
      setVariations([]);
      setVariationPrompts([]);
      setGlobalStatus("Image analyzed — you can now generate variations.");
    } catch (err) {
      setGlobalError(err.message);
      setGlobalStatus("Idle");
    } finally { setLoadingAnalyze(false); }
  }

  async function handleGenerateVariations() {
    if (!analysis) { setGlobalError("Analyze the image first."); return; }
    setGlobalError(""); setLoadingVariations(true);
    setGlobalStatus("Generating 3 variations with Stable Diffusion…");
    try {
      const res = await fetch("/api/generate-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate variations.");
      setVariations(data.images || []);
      setVariationPrompts(data.prompts || []);
      setGlobalStatus("3 variations generated! ✨");
    } catch (err) {
      setGlobalError(err.message);
      setGlobalStatus("Idle");
    } finally { setLoadingVariations(false); }
  }

  /* Regenerate variations */
  async function handleRegenerateVariations() {
    setGlobalError(""); setLoadingVariations(true);
    setGlobalStatus("Regenerating variations…");
    try {
      const res = await fetch("/api/generate-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate.");
      setVariations(data.images || []);
      setVariationPrompts(data.prompts || []);
      setGlobalStatus("New variations generated! ✨");
    } catch (err) {
      setGlobalError(err.message);
      setGlobalStatus("Idle");
    } finally { setLoadingVariations(false); }
  }

  return (
    <>
      <StepProgress
        steps={["Upload Image", "Analyze", "Generate Variations"]}
        current={currentStep}
      />

      <div className="card">
        <div className="card-header">
          <div className="card-icon teal">📤</div>
          <div>
            <h2>Upload Image</h2>
            <p>Upload any image for AI analysis and variation generation</p>
          </div>
        </div>

        <div
          className={`file-upload-zone ${selectedFile ? "has-file" : ""} ${isDragging ? "dragging" : ""}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files?.[0]); }}
        >
          <input
            id="imageInput"
            type="file"
            accept="image/*"
            onChange={e => handleFileChange(e.target.files?.[0])}
          />
          <span className="upload-icon">{selectedFile ? "🖼️" : "☁️"}</span>
          <div className="upload-text-main">
            {selectedFile ? "Image selected!" : "Drag & drop or click to upload"}
          </div>
          <div className="upload-text-sub">
            {selectedFile ? "" : "PNG, JPG, WEBP — up to 10 MB"}
          </div>
          {selectedFile && (
            <div className="file-name-chip">
              ✓ {selectedFile.name}
            </div>
          )}
        </div>

        {previewUrl && (
          <div className="preview-container" style={{ marginTop: 16 }}>
            <img src={previewUrl} alt="Preview" />
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={!selectedFile || loadingAnalyze}
            id="btn-analyze"
          >
            {loadingAnalyze ? <><span className="spinner" /> Analyzing…</> : <><Icon>🔍</Icon> Analyze Image</>}
          </button>
          {selectedFile && (
            <button
              className="btn-ghost"
              onClick={() => { setSelectedFile(null); setPreviewUrl(""); setAnalysis(null); setVariations([]); }}
              id="btn-clear-image"
            >
              <Icon>✕</Icon> Clear
            </button>
          )}
        </div>
      </div>

      {analysis && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon purple">🧠</div>
            <div>
              <h2>Analysis Results</h2>
              <p>Objects, style, and caption extracted by GPT-4o Vision</p>
            </div>
          </div>

          <AnalysisDisplay analysis={analysis} />

          <div className="divider" />

          <div className="btn-row">
            <button
              className="btn-teal"
              onClick={handleGenerateVariations}
              disabled={loadingVariations}
              id="btn-generate-variations"
            >
              {loadingVariations ? <><span className="spinner" /> Generating…</> : <><Icon>🎨</Icon> Generate Variations</>}
            </button>
            {variations.length > 0 && (
              <button
                className="btn-amber"
                onClick={handleRegenerateVariations}
                disabled={loadingVariations}
                id="btn-regenerate-variations"
              >
                {loadingVariations ? <><span className="spinner" /> Regenerating…</> : <><Icon>🎲</Icon> Regenerate New</>}
              </button>
            )}
          </div>
        </div>
      )}

      {variations.length > 0 && (
        <div className="card images-section">
          <div className="variations-header">
            <div className="card-header" style={{ margin: 0, padding: 0, border: "none", width: "100%" }}>
              <div className="card-icon pink">🖼️</div>
              <div>
                <h2>Image Variations</h2>
                <p>{variations.length} variations generated from your image analysis</p>
              </div>
            </div>
          </div>

          {variationPrompts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {variationPrompts.map((p, i) => (
                <div className="variation-prompt-chip" key={i}>
                  <strong>#{i + 1}:</strong> {p.length > 100 ? p.slice(0, 100) + "…" : p}
                </div>
              ))}
            </div>
          )}

          <ImageGrid images={variations} label="Variation" />
        </div>
      )}

      {loadingVariations && variations.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">⏳</span>
            <p>Generating 3 variations — this may take 1–2 minutes…</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   ROOT APP
   ═══════════════════════════════════════════ */
function App() {
  const [activeTab, setActiveTab] = useState("text");
  const [globalStatus, setGlobalStatus] = useState("Idle");
  const [globalError, setGlobalError] = useState("");

  const isLoading = globalStatus !== "Idle" && !globalStatus.startsWith("Image generated") &&
    !globalStatus.startsWith("Prompt approved") && !globalStatus.startsWith("Idle") &&
    !globalStatus.startsWith("Image analyzed") && !globalStatus.startsWith("3 variations") &&
    !globalStatus.startsWith("New variations") && !globalStatus.startsWith("Image regenerated") &&
    !globalStatus.startsWith("New variations");

  const statusClass = globalError ? "error-state" : isLoading ? "loading" : "success";

  return (
    <div className="app-wrapper">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-badge">
          <span className="dot" />
          AI Studio · Powered by OpenAI & Stable Diffusion
        </div>
        <h1>Pear Media Studio Aryan Mishra</h1>
        <p className="subtitle">
          Transform prompts into stunning visuals, or upload images and generate AI-powered variations.
        </p>
      </header>

      {/* ── Status Bar ── */}
      <div className={`status-bar ${statusClass}`} style={{ margin: "0 auto 28px" }}>
        <span className="status-dot" />
        {globalStatus}
      </div>

      {/* ── Error Banner ── */}
      {globalError && (
        <div className="error-banner">
          {globalError}
          <button
            onClick={() => setGlobalError("")}
            style={{ marginLeft: "auto", background: "transparent", color: "#fca5a5", padding: "2px 8px", fontSize: 13, border: "none", cursor: "pointer", borderRadius: 6 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Tab Switcher ── */}
      <div className="section-tabs">
        <button
          className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
          onClick={() => { setActiveTab("text"); setGlobalError(""); }}
          id="tab-text"
        >
          <span className="tab-icon">✍️</span>
          Text → Image
        </button>
        <button
          className={`tab-btn ${activeTab === "image" ? "active" : ""}`}
          onClick={() => { setActiveTab("image"); setGlobalError(""); }}
          id="tab-image"
        >
          <span className="tab-icon">🖼️</span>
          Image → Variations
        </button>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "text" && (
        <TextWorkflow
          setGlobalStatus={setGlobalStatus}
          setGlobalError={setGlobalError}
        />
      )}
      {activeTab === "image" && (
        <ImageWorkflow
          setGlobalStatus={setGlobalStatus}
          setGlobalError={setGlobalError}
        />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
