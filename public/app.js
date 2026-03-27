// Step 1: grab UI elements once.
const textTabBtn = document.getElementById("textTabBtn");
const imageTabBtn = document.getElementById("imageTabBtn");
const textWorkflow = document.getElementById("textWorkflow");
const imageWorkflow = document.getElementById("imageWorkflow");
const rawPromptEl = document.getElementById("rawPrompt");
const enhanceBtn = document.getElementById("enhanceBtn");
const enhancedBlock = document.getElementById("enhancedBlock");
const enhancedPromptEl = document.getElementById("enhancedPrompt");
const approveBtn = document.getElementById("approveBtn");
const imageInput = document.getElementById("imageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const variationBtn = document.getElementById("variationBtn");
const analysisBlock = document.getElementById("analysisBlock");
const analysisOutput = document.getElementById("analysisOutput");
const statusText = document.getElementById("statusText");
const imageResults = document.getElementById("imageResults");

let latestAnalysis = null;

function setStatus(message) {
  statusText.textContent = message;
}

function clearImages() {
  imageResults.innerHTML = "";
}

function renderImages(images) {
  clearImages();
  images.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Generated result ${index + 1}`;
    imageResults.appendChild(img);
  });
}

// Step 2: tab switching logic.
textTabBtn.addEventListener("click", () => {
  textTabBtn.classList.add("active");
  imageTabBtn.classList.remove("active");
  textWorkflow.classList.remove("hidden");
  imageWorkflow.classList.add("hidden");
});

imageTabBtn.addEventListener("click", () => {
  imageTabBtn.classList.add("active");
  textTabBtn.classList.remove("active");
  imageWorkflow.classList.remove("hidden");
  textWorkflow.classList.add("hidden");
});

// Step 3: call backend to enhance prompt.
enhanceBtn.addEventListener("click", async () => {
  try {
    const prompt = rawPromptEl.value.trim();
    if (!prompt) {
      setStatus("Please enter a prompt first.");
      return;
    }

    setStatus("Enhancing prompt...");
    const res = await fetch("/api/enhance-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Enhancement failed.");

    enhancedPromptEl.value = data.improvedPrompt;
    enhancedBlock.classList.remove("hidden");
    setStatus("Prompt enhanced. Approve to generate image.");
  } catch (error) {
    setStatus(error.message);
  }
});

// Step 4: approve enhanced prompt and generate image.
approveBtn.addEventListener("click", async () => {
  try {
    const prompt = enhancedPromptEl.value.trim();
    if (!prompt) {
      setStatus("No enhanced prompt available.");
      return;
    }

    setStatus("Generating image...");
    const res = await fetch("/api/generate-from-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image generation failed.");

    renderImages(data.images || []);
    setStatus("Image generated successfully.");
  } catch (error) {
    setStatus(error.message);
  }
});

// Step 5: analyze uploaded image.
analyzeBtn.addEventListener("click", async () => {
  try {
    const file = imageInput.files?.[0];
    if (!file) {
      setStatus("Please upload an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    setStatus("Analyzing image...");
    const res = await fetch("/api/analyze-image", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image analysis failed.");

    latestAnalysis = data.analysis;
    analysisOutput.textContent = JSON.stringify(latestAnalysis, null, 2);
    analysisBlock.classList.remove("hidden");
    variationBtn.disabled = false;
    setStatus("Image analyzed. Generate variations next.");
  } catch (error) {
    setStatus(error.message);
  }
});

// Step 6: generate similar images from analysis result.
variationBtn.addEventListener("click", async () => {
  try {
    if (!latestAnalysis) {
      setStatus("Analyze an image first.");
      return;
    }

    setStatus("Generating similar image variations...");
    const res = await fetch("/api/generate-variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis: latestAnalysis }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Variation generation failed.");

    renderImages(data.images || []);
    setStatus("Variation images generated.");
  } catch (error) {
    setStatus(error.message);
  }
});
