"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { spawn, execFile, exec } = require("child_process");
const os = require("os");

// Persistent Logs Path
const securityDir = path.join(os.homedir(), ".gemini", "antigravity");
const logsPath = path.join(securityDir, "security_logs.json");

// Active Unlocked Vaults in Memory (Map: vaultPath -> { password, files: [{ name, buffer }], lastActiveTime })
const activeVaults = new Map();
const vaultTimeouts = new Map();

// Helper to ensure dir
async function ensureSecurityDirectory() {
  try {
    await fsp.mkdir(securityDir, { recursive: true });
  } catch (e) {}
}

// ============================================================
// 1. Logging Service
// ============================================================
async function logSecurityAction(operation, filePath, result, error = "") {
  await ensureSecurityDirectory();
  try {
    let logs = [];
    if (fs.existsSync(logsPath)) {
      const data = await fsp.readFile(logsPath, "utf8");
      logs = JSON.parse(data || "[]");
    }

    logs.push({
      timestamp: new Date().toISOString(),
      operation,
      path: filePath || "N/A",
      result,
      error: error || "",
      user: os.userInfo().username || process.env.USERNAME || "Unknown"
    });

    // Limit to last 500 logs to prevent massive size
    if (logs.length > 500) {
      logs = logs.slice(-500);
    }

    await fsp.writeFile(logsPath, JSON.stringify(logs, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}

async function getSecurityLogs() {
  await ensureSecurityDirectory();
  try {
    if (!fs.existsSync(logsPath)) {
      return { success: true, logs: [] };
    }
    const data = await fsp.readFile(logsPath, "utf8");
    const logs = JSON.parse(data || "[]");
    return { success: true, logs: logs.reverse() }; // return newest first
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 2. Windows Permissions & Ownership
// ============================================================
function getWindowsPermissions(filePath) {
  return new Promise((resolve) => {
    // Format command to output JSON containing permissions details
    const cmd = `Get-Acl -LiteralPath '${filePath}' | Select-Object -ExpandProperty Access | ForEach-Object { [PSCustomObject]@{ Identity = $_.IdentityReference.ToString(); Type = $_.AccessControlType.ToString(); Rights = $_.FileSystemRights.ToString(); Inherited = $_.IsInherited } } | ConvertTo-Json`;
    
    exec(`powershell.exe -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`, (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, error: stderr?.trim() || err.message });
      }

      let parsed = [];
      try {
        const json = stdout.trim();
        if (json) {
          const raw = JSON.parse(json);
          parsed = Array.isArray(raw) ? raw : [raw];
        }
      } catch (e) {
        // Handle parsing failures or fallback
      }

      resolve({ success: true, permissions: parsed });
    });
  });
}

function getWindowsOwner(filePath) {
  return new Promise((resolve) => {
    const cmd = `(Get-Acl -LiteralPath '${filePath}').Owner`;
    exec(`powershell.exe -NoProfile -Command "${cmd}"`, (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, error: stderr?.trim() || err.message });
      }
      resolve({ success: true, owner: stdout.trim() });
    });
  });
}

function setWindowsOwner(filePath, ownerName) {
  return new Promise((resolve) => {
    // takeown /f "path" /a to give ownership to Administrators, or use icacls /setowner
    // Standard Windows takeown to give current user ownership:
    execFile("takeown.exe", ["/f", filePath], async (err, stdout, stderr) => {
      if (err) {
        await logSecurityAction("change-ownership", filePath, "Failed", stderr?.trim() || err.message);
        return resolve({ success: false, error: stderr?.trim() || err.message });
      }

      // If specific ownerName requested, set it via icacls
      if (ownerName && ownerName !== "current-user") {
        execFile("icacls.exe", [filePath, "/setowner", ownerName], async (err2, stdout2, stderr2) => {
          if (err2) {
            await logSecurityAction("change-ownership", filePath, "Partial (Takeown succeeded, icacls owner set failed)", stderr2?.trim() || err2.message);
            return resolve({ success: false, error: `Takeown succeeded but setowner failed: ${stderr2?.trim() || err2.message}` });
          }
          await logSecurityAction("change-ownership", filePath, `Success (Owner: ${ownerName})`);
          resolve({ success: true, message: `Successfully changed owner to ${ownerName}.` });
        });
      } else {
        await logSecurityAction("change-ownership", filePath, "Success (Took ownership for current user)");
        resolve({ success: true, message: "Successfully took ownership." });
      }
    });
  });
}

function setWindowsPermissions(filePath, username, right, type) {
  return new Promise((resolve) => {
    // type: "grant" or "deny"
    const icaclsType = type === "deny" ? "/deny" : "/grant:r";
    // right maps: read -> R, write -> W, execute -> X, full -> F
    let icaclsRight = "R";
    if (right === "write") icaclsRight = "W";
    else if (right === "execute") icaclsRight = "RX";
    else if (right === "full") icaclsRight = "F";

    const userArg = `${username}:${icaclsRight}`;

    execFile("icacls.exe", [filePath, icaclsType, userArg], async (err, stdout, stderr) => {
      if (err) {
        await logSecurityAction("change-permissions", filePath, "Failed", stderr?.trim() || err.message);
        return resolve({ success: false, error: stderr?.trim() || err.message });
      }
      await logSecurityAction("change-permissions", filePath, `Success (Granted ${right} to ${username})`);
      resolve({ success: true, message: `Successfully set permissions for ${username}.` });
    });
  });
}

// ============================================================
// 3. Protection Attributes
// ============================================================
function getProtectionAttributes(filePath) {
  return new Promise((resolve) => {
    // attrib outputs a string like "A   H   I   C:\path"
    execFile("attrib.exe", [filePath], (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, error: stderr?.trim() || err.message });
      }
      
      const attrStr = stdout.slice(0, 12); // attributes are in the first 12 chars
      resolve({
        success: true,
        readonly: attrStr.includes("R"),
        hidden: attrStr.includes("H"),
        system: attrStr.includes("S")
      });
    });
  });
}

function setProtectionAttributes(filePath, attrs) {
  return new Promise((resolve) => {
    const args = [];
    if (attrs.readonly !== undefined) args.push(attrs.readonly ? "+r" : "-r");
    if (attrs.hidden !== undefined) args.push(attrs.hidden ? "+h" : "-h");
    if (attrs.system !== undefined) args.push(attrs.system ? "+s" : "-s");
    args.push(filePath);

    execFile("attrib.exe", args, async (err, stdout, stderr) => {
      if (err) {
        await logSecurityAction("set-attributes", filePath, "Failed", stderr?.trim() || err.message);
        return resolve({ success: false, error: stderr?.trim() || err.message });
      }
      await logSecurityAction("set-attributes", filePath, `Success (attrs: ${JSON.stringify(attrs)})`);
      resolve({ success: true, message: "Attributes set successfully." });
    });
  });
}

// ============================================================
// 4. Secure Delete (Overwriting)
// ============================================================
async function secureDeleteFile(filePath) {
  const stat = await fsp.stat(filePath);
  const size = stat.size;
  const fd = fs.openSync(filePath, "r+");

  const chunkSize = 64 * 1024; // 64 KB chunks
  const buffer = Buffer.alloc(chunkSize, 0); // null bytes overwrite
  
  let bytesWritten = 0;
  while (bytesWritten < size) {
    const toWrite = Math.min(chunkSize, size - bytesWritten);
    fs.writeSync(fd, buffer, 0, toWrite, bytesWritten);
    bytesWritten += toWrite;
  }

  fs.fsyncSync(fd);
  fs.closeSync(fd);

  // Rename to random string to wipe filename traces
  const dir = path.dirname(filePath);
  const randomName = crypto.randomBytes(12).toString("hex") + ".tmp";
  const tempPath = path.join(dir, randomName);
  await fsp.rename(filePath, tempPath);

  // Unlink
  await fsp.unlink(tempPath);
}

async function secureDeleteRecursive(targetPath, eventSender = null, state = { deleted: 0, total: 0 }) {
  const stat = await fsp.stat(targetPath);
  if (stat.isDirectory()) {
    const entries = await fsp.readdir(targetPath);
    for (const entry of entries) {
      await secureDeleteRecursive(path.join(targetPath, entry), eventSender, state);
    }
    // Remove the directory
    await fsp.rmdir(targetPath);
  } else {
    state.total++;
    await secureDeleteFile(targetPath);
    state.deleted++;

    if (eventSender) {
      eventSender.send("security:delete-progress", {
        progress: Math.round((state.deleted / (state.total || 1)) * 100),
        currentFile: path.basename(targetPath),
        deleted: state.deleted,
        total: state.total
      });
    }
  }
}

async function secureDeleteEntry(targetPath, eventSender = null) {
  try {
    if (!fs.existsSync(targetPath)) {
      return { success: false, error: "File or directory path not found." };
    }

    const state = { deleted: 0, total: 0 };
    await secureDeleteRecursive(targetPath, eventSender, state);
    
    await logSecurityAction("secure-delete", targetPath, "Success");
    return { success: true, message: "Item securely deleted." };
  } catch (err) {
    await logSecurityAction("secure-delete", targetPath, "Failed", err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 5. File Encryption / Decryption (AES-256-GCM)
// ============================================================
const ENCRYPT_MAGIC = "ENC";
const ENCRYPT_VERSION = 1;

async function encryptFile(filePath, password) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File not found." };
    }

    const plaintext = await fsp.readFile(filePath);
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    // KDF derivation (PBKDF2)
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Versioned Encrypted File Format
    const magicBuf = Buffer.from(ENCRYPT_MAGIC, "utf8");
    const verBuf = Buffer.from([ENCRYPT_VERSION]);
    
    const outputBuffer = Buffer.concat([
      magicBuf,        // 3 bytes
      verBuf,          // 1 byte
      salt,            // 16 bytes
      iv,              // 12 bytes
      tag,             // 16 bytes
      ciphertext       // remainder
    ]);

    const encFilePath = filePath + ".enc";
    await fsp.writeFile(encFilePath, outputBuffer);

    // Securely delete the original file
    await secureDeleteFile(filePath);

    await logSecurityAction("file-encryption", encFilePath, "Success");
    return { success: true, encPath: encFilePath };
  } catch (err) {
    await logSecurityAction("file-encryption", filePath, "Failed", err.message);
    return { success: false, error: err.message };
  }
}

async function decryptFile(encFilePath, password) {
  try {
    if (!fs.existsSync(encFilePath)) {
      return { success: false, error: "Encrypted file not found." };
    }

    const fileContent = await fsp.readFile(encFilePath);
    if (fileContent.length < 48) {
      return { success: false, error: "Invalid encrypted file size or structure." };
    }

    // Verify magic bytes
    const magic = fileContent.toString("utf8", 0, 3);
    if (magic !== ENCRYPT_MAGIC) {
      return { success: false, error: "Not a valid encrypted file format." };
    }

    const salt = fileContent.slice(4, 20);
    const iv = fileContent.slice(20, 32);
    const tag = fileContent.slice(32, 48);
    const ciphertext = fileContent.slice(48);

    // KDF derivation
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");

    let decrypted;
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (e) {
      return { success: false, error: "Incorrect password or corrupted file (auth tag mismatch)." };
    }

    // Write original file back
    let origPath = encFilePath;
    if (encFilePath.endsWith(".enc")) {
      origPath = encFilePath.slice(0, -4);
    } else {
      origPath = encFilePath + ".dec";
    }

    await fsp.writeFile(origPath, decrypted);

    // Securely delete the encrypted file
    await secureDeleteFile(encFilePath);

    await logSecurityAction("file-decryption", origPath, "Success");
    return { success: true, decPath: origPath };
  } catch (err) {
    await logSecurityAction("file-decryption", encFilePath, "Failed", err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 6. In-Memory Vault (Zero-extract container)
// ============================================================

// Custom Archive Pack: Count [4 bytes] + NameLen [4 bytes] + Name + DataLen [4 bytes] + Data
function packVaultBuffer(filesList) {
  const parts = [];
  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32BE(filesList.length, 0);
  parts.push(countBuf);
  
  for (const file of filesList) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const nameLenBuf = Buffer.alloc(4);
    nameLenBuf.writeUInt32BE(nameBuf.length, 0);
    
    const contentLenBuf = Buffer.alloc(4);
    contentLenBuf.writeUInt32BE(file.buffer.length, 0);
    
    parts.push(nameLenBuf, nameBuf, contentLenBuf, file.buffer);
  }
  return Buffer.concat(parts);
}

function unpackVaultBuffer(packedBuffer) {
  const files = [];
  let offset = 0;
  if (packedBuffer.length < 4) return files;
  
  const count = packedBuffer.readUInt32BE(offset);
  offset += 4;
  
  for (let i = 0; i < count; i++) {
    if (offset + 4 > packedBuffer.length) break;
    const nameLen = packedBuffer.readUInt32BE(offset);
    offset += 4;
    
    if (offset + nameLen > packedBuffer.length) break;
    const name = packedBuffer.toString("utf8", offset, offset + nameLen);
    offset += nameLen;
    
    if (offset + 4 > packedBuffer.length) break;
    const contentLen = packedBuffer.readUInt32BE(offset);
    offset += 4;
    
    if (offset + contentLen > packedBuffer.length) break;
    const buffer = packedBuffer.slice(offset, offset + contentLen);
    offset += contentLen;
    
    files.push({ name, buffer });
  }
  return files;
}

// Write/Sync memory vault state back to .vault file
async function syncVaultToDisk(vaultPath, password, filesList) {
  const packed = packVaultBuffer(filesList);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);

  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(packed), cipher.final()]);
  const tag = cipher.getAuthTag();

  const container = Buffer.concat([
    Buffer.from(ENCRYPT_MAGIC, "utf8"),
    Buffer.from([ENCRYPT_VERSION]),
    salt,
    iv,
    tag,
    ciphertext
  ]);

  await fsp.writeFile(vaultPath, container);
}

async function createVault(vaultPath, password) {
  try {
    // Create empty vault
    await syncVaultToDisk(vaultPath, password, []);
    await logSecurityAction("vault-create", vaultPath, "Success");
    return { success: true };
  } catch (err) {
    await logSecurityAction("vault-create", vaultPath, "Failed", err.message);
    return { success: false, error: err.message };
  }
}

async function unlockVault(vaultPath, password) {
  try {
    if (!fs.existsSync(vaultPath)) {
      return { success: false, error: "Vault container not found." };
    }

    const container = await fsp.readFile(vaultPath);
    if (container.length < 48) {
      return { success: false, error: "Invalid vault file size." };
    }

    const salt = container.slice(4, 20);
    const iv = container.slice(20, 32);
    const tag = container.slice(32, 48);
    const ciphertext = container.slice(48);

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
    
    let decrypted;
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (e) {
      return { success: false, error: "Vault password incorrect or container file corrupted." };
    }

    const files = unpackVaultBuffer(decrypted);
    activeVaults.set(vaultPath, {
      password,
      files,
      lastActiveTime: Date.now()
    });

    // Start auto-lock timeout (5 minutes)
    resetVaultTimeout(vaultPath);

    await logSecurityAction("vault-unlock", vaultPath, "Success");
    return {
      success: true,
      files: files.map(f => ({ name: f.name, size: f.buffer.length }))
    };
  } catch (err) {
    await logSecurityAction("vault-unlock", vaultPath, "Failed", err.message);
    return { success: false, error: err.message };
  }
}

function lockVault(vaultPath) {
  // Clear timeout
  if (vaultTimeouts.has(vaultPath)) {
    clearTimeout(vaultTimeouts.get(vaultPath));
    vaultTimeouts.delete(vaultPath);
  }

  if (activeVaults.has(vaultPath)) {
    activeVaults.delete(vaultPath);
    logSecurityAction("vault-lock", vaultPath, "Success");
  }
  return { success: true };
}

function resetVaultTimeout(vaultPath) {
  if (vaultTimeouts.has(vaultPath)) {
    clearTimeout(vaultTimeouts.get(vaultPath));
  }

  const timeoutId = setTimeout(() => {
    lockVault(vaultPath);
  }, 5 * 60 * 1000); // 5 minutes idle lock

  vaultTimeouts.set(vaultPath, timeoutId);
}

async function addFileToVault(vaultPath, localFilePath) {
  const vState = activeVaults.get(vaultPath);
  if (!vState) return { success: false, error: "Vault is locked or invalid session." };

  resetVaultTimeout(vaultPath);

  try {
    if (!fs.existsSync(localFilePath)) {
      return { success: false, error: "Source file not found." };
    }

    const buffer = await fsp.readFile(localFilePath);
    const name = path.basename(localFilePath);

    // Remove if duplicate name already exists
    vState.files = vState.files.filter(f => f.name !== name);
    vState.files.push({ name, buffer });

    // Sync to disk
    await syncVaultToDisk(vaultPath, vState.password, vState.files);
    
    // Secure delete original local file
    await secureDeleteFile(localFilePath);

    await logSecurityAction("vault-add-file", vaultPath, `Success (File: ${name})`);
    return {
      success: true,
      files: vState.files.map(f => ({ name: f.name, size: f.buffer.length }))
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function extractFileFromVault(vaultPath, fileName, destFolder) {
  const vState = activeVaults.get(vaultPath);
  if (!vState) return { success: false, error: "Vault is locked or invalid session." };

  resetVaultTimeout(vaultPath);

  try {
    const file = vState.files.find(f => f.name === fileName);
    if (!file) {
      return { success: false, error: `File '${fileName}' not found in vault.` };
    }

    const destPath = path.join(destFolder, fileName);
    await fsp.writeFile(destPath, file.buffer);

    await logSecurityAction("vault-extract-file", vaultPath, `Success (File: ${fileName})`);
    return { success: true, destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 7. Threat Protection (Risk Analysis & Defender Scanner)
// ============================================================
function checkWindowsDefenderAvailability() {
  const paths = [
    "C:\\Program Files\\Windows Defender\\MpCmdRun.exe",
    "C:\\Program Files (x86)\\Windows Defender\\MpCmdRun.exe"
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function scanFileWithDefender(filePath) {
  return new Promise((resolve) => {
    const defPath = checkWindowsDefenderAvailability();
    if (!defPath) {
      return resolve({ available: false, result: "Scan unavailable" });
    }

    // MpCmdRun -Scan -ScanType 3 -File "filePath"
    const args = ["-Scan", "-ScanType", "3", "-File", filePath];
    execFile(defPath, args, (err, stdout, stderr) => {
      // Defender exits with 0 if clean, 2 if threats found, or other codes on config failures
      const code = err ? err.code : 0;
      if (code === 0) {
        resolve({ available: true, result: "Safe", logs: stdout });
      } else if (code === 2) {
        resolve({ available: true, result: "Suspicious", logs: stdout || stderr });
      } else {
        resolve({ available: true, result: "Unknown", logs: stderr || `Defender exit code ${code}` });
      }
    });
  });
}

async function analyzeFileRisk(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Suspicious double extension: check if there is another extension inside name
  const parts = filename.split(".");
  const isDoubleExt = parts.length > 2;

  // Suspicious script / exec types list
  const dangerousExts = [
    ".exe", ".msi", ".bat", ".cmd", ".vbs", ".ps1", ".scr", ".pif", 
    ".reg", ".wsf", ".js", ".jse", ".lnk", ".hta"
  ];
  const isDangerousType = dangerousExts.includes(ext);

  // Suspicious keywords in filename
  const lowerName = filename.toLowerCase();
  const containsSuspiciousWords = lowerName.includes("invoice") && isDangerousType;

  let riskScore = 0;
  const reasons = [];

  if (isDoubleExt) {
    riskScore += 40;
    reasons.push("File has multiple extensions (double extension attempt)");
  }
  if (isDangerousType) {
    riskScore += 30;
    reasons.push(`Executable or script file type detected (${ext.toUpperCase()})`);
  }
  if (containsSuspiciousWords) {
    riskScore += 30;
    reasons.push("Potential phishing naming pattern matched");
  }

  // Windows Defender Scan Hook
  const defScan = await scanFileWithDefender(filePath);
  
  let defenderStatus = "Scan unavailable";
  if (defScan.available) {
    defenderStatus = defScan.result;
    if (defScan.result === "Suspicious") {
      riskScore += 80;
      reasons.push("Windows Defender signature database flagged this file");
    }
  }

  let finalStatus = "Safe";
  if (riskScore >= 70) {
    finalStatus = "Suspicious";
  } else if (riskScore > 0) {
    finalStatus = "Unknown";
  }

  return {
    success: true,
    fileName: filename,
    filePath,
    status: finalStatus,
    riskScore,
    reasons,
    defenderStatus
  };
}

function getCurrentUser() {
  let admin = false;
  try {
    require("child_process").execSync("net session", { stdio: "ignore" });
    admin = true;
  } catch (e) {}

  return {
    success: true,
    username: os.userInfo().username || process.env.USERNAME || "Unknown",
    isAdmin: admin
  };
}

async function clearSecurityLogs() {
  await ensureSecurityDirectory();
  try {
    await fsp.writeFile(logsPath, JSON.stringify([], null, 2), "utf8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  getWindowsPermissions,
  getWindowsOwner,
  setWindowsOwner,
  setWindowsPermissions,
  getProtectionAttributes,
  setProtectionAttributes,
  secureDeleteEntry,
  encryptFile,
  decryptFile,
  createVault,
  unlockVault,
  lockVault,
  addFileToVault,
  extractFileFromVault,
  getSecurityLogs,
  clearSecurityLogs,
  getCurrentUser,
  analyzeFileRisk
};
