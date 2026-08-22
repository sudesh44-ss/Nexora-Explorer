"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const os = require("os");
const appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
const credDirectory = path.join(appDataDir, "credentials");
const credFile = path.join(credDirectory, "ai_credentials.json");

// Helper to encrypt a string using Windows DPAPI via PowerShell
function encryptString(plainText) {
  if (!plainText) return "";
  try {
    const base64Text = Buffer.from(plainText, "utf8").toString("base64");
    const script = `$bytes = [System.Convert]::FromBase64String("${base64Text}"); $text = [System.Text.Encoding]::UTF8.GetString($bytes); $sec = ConvertTo-SecureString $text -AsPlainText -Force; ConvertFrom-SecureString $sec`;
    
    const stdout = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true
    });
    return stdout.trim();
  } catch (e) {
    console.error("DPAPI encryption failed:", e);
    return "";
  }
}

// Helper to decrypt a string using Windows DPAPI via PowerShell
function decryptString(encryptedText) {
  if (!encryptedText) return "";
  try {
    const script = `$sec = ConvertTo-SecureString "${encryptedText}"; $dec = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)); $bytes = [System.Text.Encoding]::UTF8.GetBytes($dec); [System.Convert]::ToBase64String($bytes)`;
    
    const stdout = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true
    });
    return Buffer.from(stdout.trim(), "base64").toString("utf8");
  } catch (e) {
    console.error("DPAPI decryption failed:", e);
    return "";
  }
}

// Load all credentials
function loadCredentials() {
  try {
    if (!fs.existsSync(credFile)) {
      return {};
    }
    const raw = fs.readFileSync(credFile, "utf8");
    const db = JSON.parse(raw);
    
    const decrypted = {};
    for (const key in db) {
      decrypted[key] = decryptString(db[key]);
    }
    return decrypted;
  } catch (e) {
    console.error("Failed to load AI credentials:", e);
    return {};
  }
}

// Save all credentials
function saveCredentials(credentials) {
  try {
    fs.mkdirSync(credDirectory, { recursive: true });
    
    const db = {};
    for (const key in credentials) {
      if (credentials[key]) {
        db[key] = encryptString(credentials[key]);
      }
    }
    fs.writeFileSync(credFile, JSON.stringify(db, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Failed to save AI credentials:", e);
    return false;
  }
}

function getAiCredential(key) {
  const creds = loadCredentials();
  return creds[key] || null;
}

function setAiCredential(key, value) {
  const creds = loadCredentials();
  if (value) {
    creds[key] = value;
  } else {
    delete creds[key];
  }
  saveCredentials(creds);
}

module.exports = {
  getAiCredential,
  setAiCredential
};
