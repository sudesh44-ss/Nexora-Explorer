"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, execSync, execFile } = require("child_process");

// Check PROCESS architecture
const isWindows = process.platform === "win32";

// Helper to resolve executable path
function findToolPath(exeName, defaultLocations = []) {
  if (!isWindows) return null;
  
  // 1. Check default locations
  for (const loc of defaultLocations) {
    if (fs.existsSync(loc)) return loc;
  }
  
  // 2. Check system PATH via where.exe
  try {
    const stdout = execSync(`where.exe ${exeName}`, { stdio: "pipe" });
    const paths = stdout.toString().split(/\r?\n/);
    if (paths[0] && fs.existsSync(paths[0])) {
      return paths[0];
    }
  } catch (e) {}
  
  return null;
}

const get7zPath = () => findToolPath("7z.exe", [
  "C:\\Program Files\\7-Zip\\7z.exe",
  "C:\\Program Files (x86)\\7-Zip\\7z.exe"
]);

const getRarPath = () => findToolPath("rar.exe", [
  "C:\\Program Files\\WinRAR\\rar.exe"
]);

const getTarPath = () => findToolPath("tar.exe", [
  "C:\\Windows\\System32\\tar.exe"
]);

function getSupportedFormats() {
  const has7z = !!get7zPath();
  const hasRar = !!getRarPath();
  const hasTar = !!getTarPath();

  return {
    success: true,
    formats: {
      ZIP: { create: true, extract: true, encrypt: has7z },
      "7Z": { create: has7z, extract: has7z, encrypt: has7z },
      TAR: { create: hasTar, extract: hasTar, encrypt: false },
      GZ: { create: hasTar, extract: hasTar, encrypt: false },
      "TAR.GZ": { create: hasTar, extract: hasTar, encrypt: false },
      RAR: { create: hasRar, extract: has7z || hasRar, encrypt: hasRar }
    }
  };
}

const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;

// ----------------------------------------------------------
// Create Archive
// ----------------------------------------------------------
async function createArchive(sourcePaths, destinationPath, format, options = {}, eventSender = null) {
  try {
    const { password, compressionLevel } = options;
    const sources = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];

    // Ensure parents exist
    const destDir = path.dirname(destinationPath);
    await fs.promises.mkdir(destDir, { recursive: true });

    // 1. ZIP with Password -> Use 7z if available
    if (format === "ZIP" && password) {
      const toolPath = get7zPath();
      if (!toolPath) {
        return { success: false, error: "ZIP encryption requires 7-Zip (7z.exe) to be installed." };
      }
      
      const args = ["a", "-p" + password, destinationPath, ...sources];
      return runSpawnTool(toolPath, args, eventSender);
    }

    // 2. Standard ZIP -> PowerShell Compress-Archive
    if (format === "ZIP") {
      const psPaths = sources.map(psQuote).join(",");
      // Compress-Archive level option can be -CompressionLevel Optimal / Fastest / NoCompression
      let compLevel = "Optimal";
      if (compressionLevel === "Store / No Compression") compLevel = "NoCompression";
      else if (compressionLevel === "Fast") compLevel = "Fastest";

      const command = `Compress-Archive -LiteralPath ${psPaths} -DestinationPath ${psQuote(destinationPath)} -CompressionLevel ${compLevel} -Force`;
      const result = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true });
      
      const code = await new Promise((resolve) => result.on("close", resolve));
      if (code !== 0) {
        return { success: false, error: "Failed to create ZIP archive." };
      }
      return { success: true, path: destinationPath };
    }

    // 3. TAR / TAR.GZ / GZ -> tar.exe
    if (format === "TAR" || format === "TAR.GZ" || format === "GZ") {
      const toolPath = getTarPath();
      if (!toolPath) {
        return { success: false, error: "TAR compression tools (tar.exe) not found." };
      }

      // tar.exe -acf (auto-detect compression based on destination name)
      const args = ["-acf", destinationPath, ...sources];
      return runSpawnTool(toolPath, args, eventSender);
    }

    // 4. 7Z -> 7z.exe
    if (format === "7Z") {
      const toolPath = get7zPath();
      if (!toolPath) {
        return { success: false, error: "7-Zip (7z.exe) is not installed." };
      }

      const args = ["a"];
      if (password) {
        args.push("-p" + password);
        args.push("-mhe=on"); // Encrypt headers
      }

      // Compression map
      // Store: 0, Fast: 1, Normal: 5, High: 7, Max: 9
      let mx = "5";
      if (compressionLevel === "Store / No Compression") mx = "0";
      else if (compressionLevel === "Fast") mx = "1";
      else if (compressionLevel === "High") mx = "7";
      else if (compressionLevel === "Maximum") mx = "9";
      
      args.push(`-mx=${mx}`);
      args.push("-bsp1"); // Redirect progress to stdout
      args.push(destinationPath);
      args.push(...sources);

      return runSpawnTool(toolPath, args, eventSender);
    }

    // 5. RAR -> WinRAR rar.exe
    if (format === "RAR") {
      const toolPath = getRarPath();
      if (!toolPath) {
        return { success: false, error: "WinRAR (rar.exe) is not installed. RAR creation is proprietary." };
      }

      const args = ["a"];
      if (password) {
        args.push("-p" + password);
      }
      args.push(destinationPath);
      args.push(...sources);

      return runSpawnTool(toolPath, args, eventSender);
    }

    return { success: false, error: `Unsupported archive format: ${format}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ----------------------------------------------------------
// Extract Archive
// ----------------------------------------------------------
async function extractArchive(archivePath, destinationFolder, options = {}, eventSender = null) {
  try {
    const { password } = options;
    const ext = path.extname(archivePath).toLowerCase();
    const isTarGz = archivePath.toLowerCase().endsWith(".tar.gz");

    await fs.promises.mkdir(destinationFolder, { recursive: true });

    // 1. Password ZIP / 7z extraction -> Use 7z if available
    if (ext === ".zip" && password) {
      const toolPath = get7zPath();
      if (!toolPath) {
        return { success: false, error: "ZIP decryption requires 7-Zip (7z.exe) to be installed." };
      }
      const args = ["x", "-p" + password, "-o" + destinationFolder, archivePath, "-y"];
      return runSpawnTool(toolPath, args, eventSender);
    }

    // 2. Standard ZIP -> PowerShell Expand-Archive
    if (ext === ".zip") {
      const command = `Expand-Archive -LiteralPath ${psQuote(archivePath)} -DestinationPath ${psQuote(destinationFolder)} -Force`;
      const result = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true });
      const code = await new Promise((resolve) => result.on("close", resolve));
      if (code !== 0) {
        return { success: false, error: "Failed to extract ZIP archive." };
      }
      return { success: true, path: destinationFolder };
    }

    // 3. TAR / TAR.GZ / GZ -> tar.exe
    if (ext === ".tar" || isTarGz || ext === ".gz") {
      const toolPath = getTarPath();
      if (!toolPath) {
        return { success: false, error: "TAR extraction tool (tar.exe) not found." };
      }
      const args = ["-xf", archivePath, "-C", destinationFolder];
      return runSpawnTool(toolPath, args, eventSender);
    }

    // 4. 7Z -> 7z.exe
    if (ext === ".7z") {
      const toolPath = get7zPath();
      if (!toolPath) {
        return { success: false, error: "7-Zip (7z.exe) not found." };
      }
      const args = ["x", "-o" + destinationFolder, archivePath, "-y"];
      if (password) args.push("-p" + password);
      args.push("-bsp1");
      return runSpawnTool(toolPath, args, eventSender);
    }

    // 5. RAR -> WinRAR / 7-Zip
    if (ext === ".rar") {
      const toolPath = get7zPath() || getRarPath();
      if (!toolPath) {
        return { success: false, error: "No tool found to extract RAR. Install 7-Zip or WinRAR." };
      }

      const args = [];
      if (toolPath.toLowerCase().includes("7z")) {
        args.push("x", "-o" + destinationFolder, archivePath, "-y");
        if (password) args.push("-p" + password);
        args.push("-bsp1");
      } else {
        // rar.exe
        args.push("x");
        if (password) args.push("-p" + password);
        args.push(archivePath, destinationFolder + "\\");
      }

      return runSpawnTool(toolPath, args, eventSender);
    }

    return { success: false, error: `Unsupported archive file type: ${ext}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ----------------------------------------------------------
// List Archive Contents
// ----------------------------------------------------------
function listArchiveContents(archivePath, password = "") {
  return new Promise((resolve) => {
    if (!fs.existsSync(archivePath)) {
      return resolve({ success: false, error: "Archive file does not exist." });
    }
    const ext = path.extname(archivePath).toLowerCase();
    const isTarGz = archivePath.toLowerCase().endsWith(".tar.gz");

    // 1. ZIP -> Direct PowerShell assembly load
    if (ext === ".zip") {
      const psScript = `[System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null; $zip = [System.IO.Compression.ZipFile]::OpenRead('${archivePath.replace(/'/g, "''")}'); $zip.Entries | ForEach-Object { [PSCustomObject]@{ Name = $_.Name; Path = $_.FullName; Size = $_.Length; CompressedSize = $_.CompressedLength } } | ConvertTo-Json`;
      
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], (err, stdout) => {
        if (err) {
          // If password zip fails, check if we can fall back to 7z
          const toolPath = get7zPath();
          if (toolPath) {
            return listWith7z(toolPath, archivePath, password, resolve);
          }
          return resolve({ success: false, error: "Failed to list ZIP contents (might be password-protected)." });
        }

        try {
          const raw = JSON.parse(stdout.trim() || "[]");
          const parsed = Array.isArray(raw) ? raw : [raw];
          const files = parsed.map(f => ({
            name: f.Name,
            path: f.Path,
            size: f.Size,
            compressedSize: f.CompressedSize,
            type: f.Path.endsWith("/") || f.Path.endsWith("\\") || !f.Name ? "Folder" : "File"
          }));
          resolve({ success: true, files });
        } catch (e) {
          resolve({ success: false, error: "Failed to parse ZIP contents." });
        }
      });
      return;
    }

    // 2. TAR / TAR.GZ / GZ -> tar.exe -tvf
    if (ext === ".tar" || isTarGz || ext === ".gz") {
      const toolPath = getTarPath();
      if (!toolPath) {
        return resolve({ success: false, error: "TAR extraction tool not found." });
      }

      execFile(toolPath, ["-tvf", archivePath], (err, stdout) => {
        if (err) {
          return resolve({ success: false, error: err.message });
        }

        const lines = stdout.split(/\r?\n/);
        const files = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          
          // Parse: permissions owner group size date time path
          const match = line.match(/^([drwxtsS-]{10})\s+.*?(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/) ||
                        line.match(/^([drwxtsS-]{10})\s+.*?(\d+)\s+[A-Za-z]{3}\s+\d{1,2}\s+[\d:]+\s+(.+)$/);
          if (match) {
            const isDir = match[1].startsWith("d");
            const size = parseInt(match[2], 10);
            const relativePath = match[3].trim();
            files.push({
              name: path.basename(relativePath),
              path: relativePath,
              size,
              compressedSize: 0,
              type: isDir ? "Folder" : "File"
            });
          } else {
            const relativePath = line.trim();
            files.push({
              name: path.basename(relativePath),
              path: relativePath,
              size: 0,
              compressedSize: 0,
              type: relativePath.endsWith("/") || relativePath.endsWith("\\") ? "Folder" : "File"
            });
          }
        }
        resolve({ success: true, files });
      });
      return;
    }

    // 3. 7Z / RAR -> 7z.exe
    if (ext === ".7z" || ext === ".rar") {
      const toolPath = get7zPath();
      if (!toolPath) {
        return resolve({ success: false, error: "7-Zip is required to list this archive." });
      }
      return listWith7z(toolPath, archivePath, password, resolve);
    }

    resolve({ success: false, error: `Unsupported archive type for listing: ${ext}` });
  });
}

function listWith7z(toolPath, archivePath, password, resolve) {
  const args = ["l"];
  if (password) args.push("-p" + password);
  else args.push("-p-"); // do not prompt, just fail if encrypted and no password
  args.push(archivePath);

  execFile(toolPath, args, (err, stdout) => {
    if (err) {
      if (err.message.includes("Password")) {
        return resolve({ success: false, error: "Password Required", passwordProtected: true });
      }
      return resolve({ success: false, error: err.message });
    }

    const files = [];
    const parts = stdout.split(/----------------------------------------+/);
    if (parts.length >= 3) {
      const fileLines = parts[1].split(/\r?\n/);
      for (const line of fileLines) {
        if (!line.trim()) continue;
        
        // 7z format: Date Time Attr Size Compressed Name
        // col slices: date: 0-19, attr: 20-25, size: 26-38, compressed: 39-52, name: 53+
        const attrPart = line.slice(20, 25).trim();
        const isDir = attrPart.includes("D");
        const sizePart = line.slice(26, 38).trim();
        const compPart = line.slice(39, 52).trim();
        const namePart = line.slice(53).trim();
        
        if (namePart) {
          files.push({
            name: path.basename(namePart),
            path: namePart,
            size: parseInt(sizePart, 10) || 0,
            compressedSize: parseInt(compPart, 10) || 0,
            type: isDir ? "Folder" : "File"
          });
        }
      }
      resolve({ success: true, files });
    } else {
      resolve({ success: false, error: "Failed to parse 7-Zip directory layout." });
    }
  });
}

// ----------------------------------------------------------
// Test Archive Integrity
// ----------------------------------------------------------
function testArchiveIntegrity(archivePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(archivePath)) {
      return resolve({ valid: false, error: "Archive file does not exist." });
    }
    const ext = path.extname(archivePath).toLowerCase();
    const isTarGz = archivePath.toLowerCase().endsWith(".tar.gz");

    if (ext === ".tar" || isTarGz || ext === ".gz") {
      const toolPath = getTarPath();
      if (!toolPath) return resolve({ valid: false, error: "tar.exe not found." });
      
      execFile(toolPath, ["-tf", archivePath], (err) => {
        if (err) return resolve({ valid: false, error: "Corrupted archive or invalid format." });
        resolve({ valid: true });
      });
      return;
    }

    // Default to 7z testing
    const toolPath = get7zPath();
    if (!toolPath) {
      if (ext === ".zip") {
        // Zip testing fallback via PowerShell
        const command = `Expand-Archive -LiteralPath ${psQuote(archivePath)} -DestinationPath $env:TEMP\\test_zip -Force; Remove-Item $env:TEMP\\test_zip -Recurse -Force`;
        execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], (err) => {
          if (err) return resolve({ valid: false, error: "ZIP file integrity test failed." });
          resolve({ valid: true });
        });
        return;
      }
      return resolve({ valid: false, error: "7-Zip not installed (required to test 7Z/RAR)." });
    }

    execFile(toolPath, ["t", archivePath, "-p-"], (err) => {
      if (err) {
        if (err.message.includes("Password")) {
          return resolve({ valid: false, error: "Encrypted Archive (Integrity test requires password)." });
        }
        return resolve({ valid: false, error: "Archive integrity test failed (corrupted file)." });
      }
      resolve({ valid: true });
    });
  });
}

// Helper to spawn process and capture progress updates
function runSpawnTool(toolPath, args, eventSender) {
  return new Promise((resolve) => {
    const child = spawn(toolPath, args, { windowsHide: true });
    let stderrData = "";

    child.stdout.on("data", (data) => {
      const line = data.toString();
      // Match percentage " 34%"
      const match = line.match(/(\d+)%/);
      if (match && eventSender) {
        eventSender.send("archive:progress", { progress: parseInt(match[1], 10) });
      }
    });

    child.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderrData.trim() || `Process exited with error code ${code}` });
      } else {
        resolve({ success: true });
      }
    });
  });
}

module.exports = {
  getSupportedFormats,
  createArchive,
  extractArchive,
  listArchiveContents,
  testArchiveIntegrity
};
