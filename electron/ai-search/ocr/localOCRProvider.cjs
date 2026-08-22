"use strict";

const fs = require("fs");
const { BaseOCRProvider } = require("./ocrProvider.cjs");
const { createOCRResult } = require("./ocrResult.cjs");
const { OCRLanguage } = require("./ocrLanguage.cjs");
const { OCRErrorCode, OCRError } = require("./ocrErrors.cjs");

class LocalOCRProvider extends BaseOCRProvider {
  constructor(options = {}) {
    super("local_ocr", "Local Transformer TrOCR Optical Character Recognition", "1.0.0");
    this.modelRepo = options.modelRepo || "Xenova/trocr-small-printed";
    this.cacheDir = options.cacheDir || null;
    this._pipeline = null;
    this._transformersModule = null;
    this.isLoaded = false;
    this._loadingPromise = null;
  }

  async _getTransformers() {
    if (!this._transformersModule) {
      try {
        const mod = await import("@xenova/transformers");
        this._transformersModule = mod;
        if (this.cacheDir && mod.env) {
          mod.env.cacheDir = this.cacheDir;
        }
        if (mod.env) {
          mod.env.allowLocalModels = true;
        }
      } catch (err) {
        throw new OCRError(
          OCRErrorCode.OCR_ENGINE_UNAVAILABLE,
          `Failed to load @xenova/transformers: ${err.message}`
        );
      }
    }
    return this._transformersModule;
  }

  async load() {
    if (this.isLoaded && this._pipeline) {
      return { success: true };
    }

    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    this._loadingPromise = (async () => {
      try {
        const { pipeline } = await this._getTransformers();
        this._pipeline = await pipeline("image-to-text", this.modelRepo, {
          quantized: true,
        });
        this.isLoaded = true;
        return { success: true };
      } catch (err) {
        throw new OCRError(
          OCRErrorCode.OCR_MODEL_LOAD_FAILED,
          `Failed to load OCR model ${this.modelRepo}: ${err.message}`
        );
      } finally {
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
  }

  isReady() {
    return this.isLoaded && Boolean(this._pipeline);
  }

  canProcess(fileRecord) {
    if (!fileRecord || !fileRecord.extension) return false;
    const ext = fileRecord.extension.toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff", ".pdf"].includes(ext);
  }

  /**
   * Prepares a RawImage from file path, buffer, or RawImage instance
   */
  async _prepareRawImage(input) {
    const { RawImage } = await this._getTransformers();

    if (input instanceof RawImage) {
      return input;
    }

    let buffer = null;
    if (typeof input === "string") {
      if (!fs.existsSync(input)) {
        throw new OCRError(OCRErrorCode.OCR_INVALID_INPUT, `Image file not found: ${input}`);
      }
      try {
        return await RawImage.read(input);
      } catch {
        buffer = fs.readFileSync(input);
      }
    } else if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
      buffer = Buffer.from(input);
    }

    if (buffer) {
      // Check for BMP format: starts with "BM"
      if (buffer.length >= 54 && buffer.toString("utf8", 0, 2) === "BM") {
        try {
          const width = buffer.readInt32LE(18);
          const height = Math.abs(buffer.readInt32LE(22));
          const offset = buffer.readUInt32LE(10);
          const rowSize = Math.floor((24 * width + 31) / 32) * 4;
          const rgba = new Uint8ClampedArray(width * height * 4);

          let destIdx = 0;
          for (let y = 0; y < height; y++) {
            const rowStart = offset + (height - 1 - y) * rowSize;
            for (let x = 0; x < width; x++) {
              const srcIdx = rowStart + x * 3;
              const b = buffer[srcIdx];
              const g = buffer[srcIdx + 1];
              const r = buffer[srcIdx + 2];
              rgba[destIdx++] = r;
              rgba[destIdx++] = g;
              rgba[destIdx++] = b;
              rgba[destIdx++] = 255;
            }
          }
          return new RawImage(rgba, width, height, 4);
        } catch {}
      }

      try {
        const blob = new Blob([buffer]);
        return await RawImage.fromBlob(blob);
      } catch {}
    }

    throw new OCRError(OCRErrorCode.OCR_INVALID_INPUT, "Invalid image buffer or unsupported format");
  }

  /**
   * Normalizes raw OCR extracted text
   */
  _normalizeText(rawText) {
    if (!rawText) return "";
    return rawText
      .replace(/[\r\t]+/g, " ")
      .replace(/ +/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();
  }

  /**
   * Executes OCR on an image file or buffer
   */
  async analyze(filePathOrBuffer, options = {}) {
    if (!this.isReady()) {
      await this.load();
    }

    try {
      const rawImage = await this._prepareRawImage(filePathOrBuffer);
      const res = await this._pipeline(rawImage);

      let text = "";
      if (Array.isArray(res)) {
        text = res.map((r) => r.generated_text || "").join("\n");
      } else if (res && typeof res === "object") {
        text = res.generated_text || "";
      }

      const normalized = this._normalizeText(text);
      const language = OCRLanguage.detectLanguage(normalized);
      const lines = normalized ? normalized.split("\n").filter(Boolean) : [];
      const words = normalized ? normalized.split(/\s+/).filter(Boolean) : [];

      const confidence = normalized.length > 0 ? 0.95 : 1.0;

      return createOCRResult({
        success: true,
        text: normalized,
        language,
        confidence,
        lines,
        words,
        engineId: this.id,
        engineVersion: this.version,
      });
    } catch (err) {
      if (err instanceof OCRError) throw err;
      throw new OCRError(
        OCRErrorCode.OCR_INFERENCE_FAILED,
        `OCR inference failed: ${err.message}`,
        err
      );
    }
  }

  getLanguages() {
    return ["en", "hi", "mr"];
  }

  async shutdown() {
    this._pipeline = null;
    this.isLoaded = false;
  }
}

module.exports = {
  LocalOCRProvider,
};
