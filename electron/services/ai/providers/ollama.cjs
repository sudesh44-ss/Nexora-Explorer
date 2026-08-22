const os = require("os");
const path = require("path");

async function getOllamaUrl() {
  const appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
  const configFile = path.join(appDataDir, "ai_config.json");
  try {
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
      return config.ollamaUrl || "http://127.0.0.1:11434";
    }
  } catch (e) {}
  return "http://127.0.0.1:11434";
}

async function getActiveModel() {
  const appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
  const configFile = path.join(appDataDir, "ai_config.json");
  try {
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
      return config.model || "llama3";
    }
  } catch (e) {}
  return "llama3";
}

async function checkAvailability() {
  const url = await getOllamaUrl();
  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) throw new Error("Failed to reach Ollama tags");
    const data = await res.json();
    const model = await getActiveModel();
    const hasModel = data.models && data.models.some(m => m.name.startsWith(model));
    return {
      available: true,
      provider: "ollama",
      model: model,
      capabilities: ["text", "json", "embeddings"],
      models: data.models.map(m => m.name)
    };
  } catch (e) {
    return {
      available: false,
      provider: "ollama",
      error: e.message
    };
  }
}

async function generateText(prompt, systemInstruction = "") {
  const url = await getOllamaUrl();
  const model = await getActiveModel();
  
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama generation failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.message.content;
}

async function generateJSON(prompt, schema) {
  const url = await getOllamaUrl();
  const model = await getActiveModel();
  
  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      format: "json",
      stream: false
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama JSON generation failed: ${res.statusText}`);
  }

  const data = await res.json();
  return JSON.parse(data.message.content);
}

async function generateImageUnderstanding(imagePath, prompt) {
  const url = await getOllamaUrl();
  const model = await getActiveModel();
  
  let base64Data = "";
  try {
    base64Data = fs.readFileSync(imagePath).toString("base64");
  } catch (e) {
    throw new Error(`Failed to read image for vision: ${e.message}`);
  }

  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: prompt,
        images: [base64Data]
      }],
      stream: false
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama vision failed: ${res.statusText}`);
  }

  const data = await res.json();
  const content = data.message.content;
  
  return {
    description: content,
    objects: [],
    scene: "Detected via vision model",
    concepts: [],
    confidence: 0.8
  };
}

async function generateEmbeddings(text) {
  const url = await getOllamaUrl();
  const model = await getActiveModel();
  
  const res = await fetch(`${url}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: text
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama embeddings failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.embedding;
}

module.exports = {
  checkAvailability,
  generateText,
  generateJSON,
  generateImageUnderstanding,
  generateEmbeddings
};
