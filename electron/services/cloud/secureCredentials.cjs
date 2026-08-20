"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const appDataDir = "C:\\Users\\suryw\\.gemini\\antigravity";
const credDirectory = path.join(appDataDir, "credentials");
const credFile = path.join(credDirectory, "cloud_credentials.json");

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

let cachedCredentials = null;
let initPromise = null;

// Async initialization of credentials (decrypt all in a single PowerShell spawn)
function initCredentials() {
  if (initPromise) return initPromise;

  const start = Date.now();
  console.log("[Cloud] [secureCredentials] providers request started (initCredentials)");

  initPromise = new Promise((resolve) => {
    try {
      if (!fs.existsSync(credFile)) {
        cachedCredentials = {};
        console.log(`[Cloud] [secureCredentials] providers request completed (initCredentials: no file) took ${Date.now() - start}ms`);
        return resolve(cachedCredentials);
      }
      const raw = fs.readFileSync(credFile, "utf8");
      const db = JSON.parse(raw);
      
      const keys = Object.keys(db);
      if (keys.length === 0) {
        cachedCredentials = {};
        console.log(`[Cloud] [secureCredentials] providers request completed (initCredentials: empty file) took ${Date.now() - start}ms`);
        return resolve(cachedCredentials);
      }

      // Pack all encrypted strings as a JSON base64 string
      const encValues = keys.map(k => db[k]);
      const base64List = Buffer.from(JSON.stringify(encValues), "utf8").toString("base64");

      const script = `
        $bytes = [System.Convert]::FromBase64String("${base64List}");
        $json = [System.Text.Encoding]::UTF8.GetString($bytes);
        $list = ConvertFrom-Json $json;
        $results = @();
        foreach ($enc in $list) {
            if (-not $enc) {
                $results += "";
                continue;
            }
            try {
                $sec = ConvertTo-SecureString $enc;
                $dec = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec));
                $results += $dec;
            } catch {
                $results += "";
            }
        }
        $resBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $results -Compress));
        [System.Convert]::ToBase64String($resBytes)
      `.replace(/\r?\n/g, " ");

      const { execFile } = require("child_process");
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true,
        maxBuffer: 1024 * 1024
      }, (err, stdout, stderr) => {
        if (err) {
          console.error("[Cloud] Async DPAPI decryption failed, falling back to sync:", err, stderr);
          cachedCredentials = loadCredentialsSync();
          console.log(`[Cloud] [secureCredentials] providers request completed (initCredentials: sync fallback) took ${Date.now() - start}ms`);
          return resolve(cachedCredentials);
        }
        try {
          const decJson = Buffer.from(stdout.trim(), "base64").toString("utf8");
          const decValues = JSON.parse(decJson);
          cachedCredentials = {};
          keys.forEach((key, idx) => {
            cachedCredentials[key] = decValues[idx];
          });
          console.log(`[Cloud] [secureCredentials] providers request completed (initCredentials: async success) took ${Date.now() - start}ms`);
          resolve(cachedCredentials);
        } catch (e) {
          console.error("[Cloud] Failed to parse decrypted values, falling back to sync:", e);
          cachedCredentials = loadCredentialsSync();
          console.log(`[Cloud] [secureCredentials] providers request completed (initCredentials: sync fallback parse error) took ${Date.now() - start}ms`);
          resolve(cachedCredentials);
        }
      });
    } catch (e) {
      console.error("[Cloud] initCredentials error:", e);
      cachedCredentials = {};
      resolve(cachedCredentials);
    }
  });

  return initPromise;
}

// Kick off initialization immediately at startup
initCredentials();

// Load all credentials synchronously
function loadCredentialsSync() {
  const start = Date.now();
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
    console.log(`[Cloud] [secureCredentials] loadCredentialsSync took ${Date.now() - start}ms`);
    return decrypted;
  } catch (e) {
    console.error("[Cloud] Failed to load credentials:", e);
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
    console.error("[Cloud] Failed to save credentials:", e);
    return false;
  }
}

function getCredential(key) {
  if (cachedCredentials) {
    return cachedCredentials[key] || null;
  }
  const creds = loadCredentialsSync();
  return creds[key] || null;
}

function setCredential(key, value) {
  const creds = cachedCredentials || loadCredentialsSync();
  if (value) {
    creds[key] = value;
  } else {
    delete creds[key];
  }
  cachedCredentials = creds;
  saveCredentials(creds);
}

function deleteCredential(key) {
  setCredential(key, null);
}

module.exports = {
  getCredential,
  setCredential,
  deleteCredential,
  loadCredentials: loadCredentialsSync,
  saveCredentials,
  initCredentials
};
