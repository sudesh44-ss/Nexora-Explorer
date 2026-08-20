"use strict";

const fs = require("fs");
const { getAiCredential } = require("../aiCredentials.cjs");

async function checkAvailability() {
  const apiKey = getAiCredential("geminiApiKey");
  if (!apiKey) {
    return {
      available: false,
      provider: "gemini",
      error: "API key is not configured"
    };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash?key=${apiKey}`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Unauthorized or connection failed: ${errText}`);
    }
    return {
      available: true,
      provider: "gemini",
      model: "gemini-1.5-flash",
      capabilities: ["text", "json", "vision", "embeddings"]
    };
  } catch (e) {
    return {
      available: false,
      provider: "gemini",
      error: e.message
    };
  }
}

async function generateText(prompt, systemInstruction = "") {
  const apiKey = getAiCredential("geminiApiKey");
  if (!apiKey) throw new Error("Gemini API key is missing");

  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Text generation failed: ${errText}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function generateJSON(prompt, schema) {
  const apiKey = getAiCredential("geminiApiKey");
  if (!apiKey) throw new Error("Gemini API key is missing");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${prompt}\nRespond with a single valid raw JSON object matching the output format requirements.` }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini JSON generation failed: ${errText}`);
  }

  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

async function generateImageUnderstanding(imagePath, prompt) {
  const apiKey = getAiCredential("geminiApiKey");
  if (!apiKey) throw new Error("Gemini API key is missing");

  let base64Data = "";
  try {
    base64Data = fs.readFileSync(imagePath).toString("base64");
  } catch (e) {
    throw new Error(`Failed to read image for vision: ${e.message}`);
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }]
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini vision failed: ${errText}`);
  }

  const data = await res.json();
  const content = data.candidates[0].content.parts[0].text;

  return {
    description: content,
    objects: [],
    scene: "Analyzed via Gemini 1.5 Flash",
    concepts: [],
    confidence: 0.9
  };
}

async function generateEmbeddings(text) {
  const apiKey = getAiCredential("geminiApiKey");
  if (!apiKey) throw new Error("Gemini API key is missing");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text }]
        }
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini embedding failed: ${errText}`);
  }

  const data = await res.json();
  return data.embedding.values;
}

module.exports = {
  checkAvailability,
  generateText,
  generateJSON,
  generateImageUnderstanding,
  generateEmbeddings
};
