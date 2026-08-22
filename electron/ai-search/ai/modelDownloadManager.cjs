"use strict";

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");

class ModelDownloadManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.modelsDir = options.modelsDir || null;
    this.activeDownloads = new Map(); // modelId -> { cancel: Function, promise: Promise }
    this.isPaused = false;
  }

  setModelsDir(dir) {
    this.modelsDir = dir;
  }

  /**
   * Helper to download a single file with redirect resolution and progress stream
   */
  _downloadFile(url, destPath, onProgress, cancelToken) {
    return new Promise((resolve, reject) => {
      if (cancelToken.isCancelled) {
        return reject(new Error("Download cancelled"));
      }

      // Ensure directory exists
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tempPath = `${destPath}.tmp_${Date.now()}`;
      const fileStream = fs.createWriteStream(tempPath);

      const requestWithRedirects = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 6) {
          fileStream.close();
          try { fs.unlinkSync(tempPath); } catch {}
          return reject(new Error("Too many redirects"));
        }

        if (cancelToken.isCancelled) {
          fileStream.close();
          try { fs.unlinkSync(tempPath); } catch {}
          return reject(new Error("Download cancelled"));
        }

        const parsedUrl = new URL(currentUrl);
        const client = parsedUrl.protocol === "https:" ? https : http;

        const req = client.get(currentUrl, {
          headers: {
            "User-Agent": "Nexora-Explorer/1.0.0 (AI Model Provisioner)",
          },
        }, (res) => {
          // Handle 3xx Redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let nextUrl = res.headers.location;
            if (!nextUrl.startsWith("http")) {
              nextUrl = new URL(nextUrl, currentUrl).href;
            }
            res.resume();
            return requestWithRedirects(nextUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            fileStream.close();
            try { fs.unlinkSync(tempPath); } catch {}
            return reject(new Error(`HTTP error ${res.statusCode} fetching ${currentUrl}`));
          }

          const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
          let receivedBytes = 0;
          let lastTime = Date.now();
          let bytesSinceLast = 0;

          res.on("data", (chunk) => {
            if (cancelToken.isCancelled) {
              req.destroy();
              fileStream.close();
              try { fs.unlinkSync(tempPath); } catch {}
              return reject(new Error("Download cancelled"));
            }

            receivedBytes += chunk.length;
            bytesSinceLast += chunk.length;
            const now = Date.now();

            if (now - lastTime >= 200 || receivedBytes === totalBytes) {
              const speed = Math.round((bytesSinceLast / ((now - lastTime) / 1000)));
              if (onProgress) {
                onProgress({
                  receivedBytes,
                  totalBytes,
                  speed,
                  percent: totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0,
                });
              }
              lastTime = now;
              bytesSinceLast = 0;
            }
          });

          res.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close(() => {
              try {
                if (fs.existsSync(destPath)) {
                  fs.unlinkSync(destPath);
                }
                fs.renameSync(tempPath, destPath);
                resolve({ success: true, path: destPath, size: receivedBytes });
              } catch (err) {
                reject(err);
              }
            });
          });

          fileStream.on("error", (err) => {
            try { fs.unlinkSync(tempPath); } catch {}
            reject(err);
          });
        });

        cancelToken.cancel = () => {
          cancelToken.isCancelled = true;
          req.destroy();
          fileStream.close();
          try { fs.unlinkSync(tempPath); } catch {}
          reject(new Error("Download cancelled"));
        };

        req.on("error", (err) => {
          fileStream.close();
          try { fs.unlinkSync(tempPath); } catch {}
          reject(err);
        });
      };

      requestWithRedirects(url);
    });
  }

  /**
   * Downloads a full model package from Hugging Face
   */
  async downloadModel(modelProfile, onProgressCallback = null) {
    if (!modelProfile || !modelProfile.id) {
      throw new Error("Invalid model profile");
    }

    const modelId = modelProfile.id;
    const hfRepo = modelProfile.hfRepo || `Xenova/${modelId}`;
    const requiredFiles = modelProfile.requiredFiles || [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "onnx/model_quantized.onnx",
    ];

    const targetDir = path.join(this.modelsDir, "installed", modelId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const cancelToken = { isCancelled: false, cancel: () => {} };
    this.activeDownloads.set(modelId, cancelToken);

    const totalFiles = requiredFiles.length;
    let completedFiles = 0;
    const fileProgressMap = new Map();

    const notifyOverall = () => {
      let totalReceived = 0;
      let totalExpected = modelProfile.sizeBytes || 0;
      for (const p of fileProgressMap.values()) {
        totalReceived += p.receivedBytes || 0;
      }
      const overallPercent = totalExpected > 0
        ? Math.min(99, Math.round((totalReceived / totalExpected) * 100))
        : Math.round((completedFiles / totalFiles) * 100);

      const eventData = {
        modelId,
        modelName: modelProfile.name,
        task: modelProfile.task,
        progress: overallPercent,
        completedFiles,
        totalFiles,
        receivedBytes: totalReceived,
        totalBytes: totalExpected,
        stage: "downloading",
      };

      this.emit("progress", eventData);
      if (onProgressCallback) onProgressCallback(eventData);
    };

    try {
      this.emit("progress", {
        modelId,
        modelName: modelProfile.name,
        progress: 0,
        stage: "starting",
      });

      for (let i = 0; i < requiredFiles.length; i++) {
        if (cancelToken.isCancelled) throw new Error("Download cancelled");

        const relFile = requiredFiles[i];
        const destFile = path.join(targetDir, relFile);

        // Skip if already completely downloaded and not corrupted
        if (fs.existsSync(destFile) && fs.statSync(destFile).size > 0) {
          completedFiles++;
          fileProgressMap.set(relFile, { receivedBytes: fs.statSync(destFile).size });
          notifyOverall();
          continue;
        }

        const fileUrl = `https://huggingface.co/${hfRepo}/resolve/main/${relFile}`;
        
        await this._downloadFile(
          fileUrl,
          destFile,
          (fileProg) => {
            fileProgressMap.set(relFile, fileProg);
            notifyOverall();
          },
          cancelToken
        );

        completedFiles++;
        notifyOverall();
      }

      // Write package manifest
      const manifest = {
        id: modelId,
        name: modelProfile.name,
        hfRepo,
        installedAt: new Date().toISOString(),
        files: requiredFiles,
        verified: false,
      };
      fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify(manifest, null, 2), "utf-8");

      this.emit("progress", {
        modelId,
        modelName: modelProfile.name,
        progress: 100,
        stage: "completed",
      });

      return { success: true, targetDir };
    } catch (err) {
      this.emit("progress", {
        modelId,
        modelName: modelProfile.name,
        progress: 0,
        stage: "error",
        error: err.message,
      });
      throw err;
    } finally {
      this.activeDownloads.delete(modelId);
    }
  }

  cancelDownload(modelId) {
    if (this.activeDownloads.has(modelId)) {
      const token = this.activeDownloads.get(modelId);
      if (token && typeof token.cancel === "function") {
        token.cancel();
      }
      this.activeDownloads.delete(modelId);
      return true;
    }
    return false;
  }

  cancelAll() {
    for (const [modelId, token] of this.activeDownloads.entries()) {
      if (token && typeof token.cancel === "function") {
        token.cancel();
      }
    }
    this.activeDownloads.clear();
  }

  isDownloading(modelId) {
    return this.activeDownloads.has(modelId);
  }
}

module.exports = {
  ModelDownloadManager,
};
