"use strict";

const fs = require("fs");
const path = require("path");
const { getAiCredential, setAiCredential } = require("./aiCredentials.cjs");

const os = require("os");
const appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
const configFile = path.join(appDataDir, "ai_config.json");

const providers = {
  local: require("./providers/local.cjs"),
  ollama: require("./providers/ollama.cjs"),
  openai: require("./providers/openai.cjs"),
  gemini: require("./providers/gemini.cjs")
};

function ensureConfigDir() {
  try {
    fs.mkdirSync(appDataDir, { recursive: true });
  } catch (e) {}
}

function getConfig() {
  ensureConfigDir();
  try {
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, "utf8"));
    }
  } catch (e) {}
  return {
    provider: "local",
    model: "local-rules",
    ollamaUrl: "http://127.0.0.1:11434"
  };
}

function saveConfig(config) {
  ensureConfigDir();
  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Failed to save AI config:", e);
    return false;
  }
}

async function getProviders() {
  const list = [];
  for (const name in providers) {
    const status = await providers[name].checkAvailability();
    list.push({
      name,
      ...status
    });
  }
  return list;
}

async function getActiveProvider() {
  const config = getConfig();
  const name = config.provider || "local";
  const provider = providers[name] || providers.local;
  const status = await provider.checkAvailability();
  
  return {
    name,
    instance: provider,
    status
  };
}

async function setProviderConfig(providerName, modelName, url, key) {
  const config = getConfig();
  config.provider = providerName;
  if (modelName) config.model = modelName;
  if (url) config.ollamaUrl = url;
  
  if (providerName === "openai" && key) {
    setAiCredential("openaiApiKey", key);
  } else if (providerName === "gemini" && key) {
    setAiCredential("geminiApiKey", key);
  }
  
  saveConfig(config);
  return { success: true };
}

async function generateText(prompt, systemInstruction = "") {
  const active = await getActiveProvider();
  if (!active.status.available) {
    // Fallback to local offline mode
    return await providers.local.generateText(prompt, systemInstruction);
  }
  return await active.instance.generateText(prompt, systemInstruction);
}

async function generateJSON(prompt, schema) {
  const active = await getActiveProvider();
  if (!active.status.available) {
    // Fallback to local offline mode
    return await providers.local.generateJSON(prompt, schema);
  }
  return await active.instance.generateJSON(prompt, schema);
}

async function generateImageUnderstanding(imagePath, prompt) {
  const active = await getActiveProvider();
  if (!active.status.available) {
    return await providers.local.generateImageUnderstanding(imagePath, prompt);
  }
  return await active.instance.generateImageUnderstanding(imagePath, prompt);
}

async function generateEmbeddings(text) {
  const active = await getActiveProvider();
  if (!active.status.available) {
    return providers.local.generateEmbeddings(text);
  }
  return await active.instance.generateEmbeddings(text);
}

module.exports = {
  getProviders,
  getActiveProvider,
  setProviderConfig,
  generateText,
  generateJSON,
  generateImageUnderstanding,
  generateEmbeddings,
  getConfig
};
