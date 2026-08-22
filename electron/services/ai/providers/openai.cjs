"use strict";

const fs = require("fs");
const { getAiCredential } = require("../aiCredentials.cjs");

async function checkAvailability() {
  const apiKey = getAiCredential("openaiApiKey");
  if (!apiKey) {
    return {
      available: false,
      provider: "openai",
      error: "API key is not configured"
    };
  }

  // Quick connectivity check (retrieve models)
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (!res.ok) {
      const errorMsg = await res.text();
      throw new Error(`Unauthorized or rate limited: ${errorMsg}`);
    }
    const data = await res.json();
    return {
      available: true,
      provider: "openai",
      model: "gpt-4o-mini", // Default lightweight model
      capabilities: ["text", "json", "vision", "embeddings"]
    };
  } catch (e) {
    return {
      available: false,
      provider: "openai",
      error: e.message
    };
  }
}

async function generateText(prompt, systemInstruction = "") {
  const apiKey = getAiCredential("openaiApiKey");
  if (!apiKey) throw new Error("OpenAI API key is missing");

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI Chat completion failed: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function generateJSON(prompt, schema) {
  const apiKey = getAiCredential("openaiApiKey");
  if (!apiKey) throw new Error("OpenAI API key is missing");

  const messages = [
    { role: "system", content: "You are a JSON assistant. Output your response as a valid raw JSON object matching the requested schema. Do not enclose in markdown blocks." },
    { role: "user", content: prompt }
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI JSON chat failed: ${errText}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function generateImageUnderstanding(imagePath, prompt) {
  const apiKey = getAiCredential("openaiApiKey");
  if (!apiKey) throw new Error("OpenAI API key is missing");

  let base64Data = "";
  try {
    base64Data = fs.readFileSync(imagePath).toString("base64");
  } catch (e) {
    throw new Error(`Failed to read image for vision: ${e.message}`);
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            }
          ]
        }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI vision call failed: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  return {
    description: content,
    objects: [],
    scene: "Analyzed via GPT-4o-mini",
    concepts: [],
    confidence: 0.9
  };
}

async function generateEmbeddings(text) {
  const apiKey = getAiCredential("openaiApiKey");
  if (!apiKey) throw new Error("OpenAI API key is missing");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI embeddings call failed: ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

module.exports = {
  checkAvailability,
  generateText,
  generateJSON,
  generateImageUnderstanding,
  generateEmbeddings
};
