"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { AITaskType, AIModality, ModelStatus, QualityMode, createModelProfile } = require("./modelProfile.cjs");

class CustomModelImporter {
  constructor(options = {}) {
    this.modelsDir = options.modelsDir || null;
    this.registry = options.modelRegistry || null;
  }

  setModelsDir(dir) {
    this.modelsDir = dir;
  }

  setModelRegistry(reg) {
    this.registry = reg;
  }

  /**
   * Helper to check file magic bytes for ONNX / GGUF
   */
  _detectFormat(filePath) {
    try {
      const fd = fs.openSync(filePath, "r");
      const buffer = Buffer.alloc(16);
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      // Check GGUF magic bytes: 'GGUF' (0x47 0x47 0x55 0x46)
      if (buffer[0] === 0x47 && buffer[1] === 0x47 && buffer[2] === 0x55 && buffer[3] === 0x46) {
        return "GGUF";
      }

      // Check ONNX protobuf magic byte: field 1, wire type 2 (0x08)
      if (buffer[0] === 0x08) {
        return "ONNX";
      }

      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".onnx") return "ONNX";
      if (ext === ".gguf") return "GGUF";
      if (ext === ".safetensors") return "SafeTensors";
      if (ext === ".bin" || ext === ".pt") return "PyTorch";
      return "UNKNOWN";
    } catch {
      return "UNKNOWN";
    }
  }

  /**
   * Validates a model path (directory or single file) before import
   */
  validateSource(sourcePath) {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return {
        valid: false,
        compatible: false,
        error: "Specified file or directory does not exist on disk.",
      };
    }

    const stat = fs.statSync(sourcePath);
    let isDirectory = stat.isDirectory();
    let onnxFiles = [];
    let configJson = null;
    let tokenizerJson = null;
    let format = "UNKNOWN";
    let totalSize = stat.size;

    if (isDirectory) {
      const entries = fs.readdirSync(sourcePath);
      for (const e of entries) {
        const full = path.join(sourcePath, e);
        try {
          const st = fs.statSync(full);
          if (st.isFile()) {
            if (e.endsWith(".onnx")) onnxFiles.push(e);
            if (e === "config.json") {
              try { configJson = JSON.parse(fs.readFileSync(full, "utf-8")); } catch {}
            }
            if (e === "tokenizer.json") {
              try { tokenizerJson = JSON.parse(fs.readFileSync(full, "utf-8")); } catch {}
            }
          }
        } catch {}
      }

      // Look in subdirectories (like onnx/)
      const onnxSubdir = path.join(sourcePath, "onnx");
      if (fs.existsSync(onnxSubdir) && fs.statSync(onnxSubdir).isDirectory()) {
        try {
          const subEntries = fs.readdirSync(onnxSubdir);
          for (const se of subEntries) {
            if (se.endsWith(".onnx")) onnxFiles.push(path.join("onnx", se));
          }
        } catch {}
      }

      if (onnxFiles.length > 0) {
        format = "ONNX";
      }
    } else {
      format = this._detectFormat(sourcePath);
      if (format === "ONNX") {
        onnxFiles.push(path.basename(sourcePath));
      }
    }

    // Check runtime compatibility
    if (format === "GGUF") {
      return {
        valid: true,
        compatible: false,
        format: "GGUF",
        name: path.basename(sourcePath, path.extname(sourcePath)),
        sourcePath,
        error: "This model requires a GGUF runtime, but no compatible GGUF runtime is currently installed. Nexora requires ONNX model packages.",
      };
    }

    if (format === "SafeTensors" || format === "PyTorch") {
      return {
        valid: true,
        compatible: false,
        format,
        name: path.basename(sourcePath, path.extname(sourcePath)),
        sourcePath,
        error: `This model format (${format}) cannot be directly executed by the local ONNX runtime. Please convert to ONNX format first.`,
      };
    }

    if (format !== "ONNX" || onnxFiles.length === 0) {
      return {
        valid: false,
        compatible: false,
        format: "Unsupported",
        sourcePath,
        error: "No valid ONNX model weights found in the selected location. Valid Nexora models must contain .onnx files or a Transformers ONNX package.",
      };
    }

    // Infer task & dimensions
    let task = AITaskType.TEXT_EMBEDDING;
    let modality = AIModality.TEXT;
    let runtime = "local-runtime";
    let dimensions = 384;
    const nameCandidate = path.basename(sourcePath, isDirectory ? "" : path.extname(sourcePath));
    const lowerName = nameCandidate.toLowerCase();

    if (configJson) {
      if (configJson.hidden_size) dimensions = configJson.hidden_size;
      else if (configJson.dim) dimensions = configJson.dim;
      else if (configJson.d_model) dimensions = configJson.d_model;

      const arch = (configJson.architectures?.[0] || configJson.model_type || "").toLowerCase();
      if (arch.includes("clip") || arch.includes("vision")) {
        task = AITaskType.IMAGE_UNDERSTANDING;
        modality = AIModality.IMAGE;
        runtime = "vision-runtime";
        dimensions = 512;
      } else if (arch.includes("trocr") || arch.includes("ocr")) {
        task = AITaskType.OCR;
        modality = AIModality.DOCUMENT;
        runtime = "local_ocr";
      } else if (arch.includes("whisper") || arch.includes("speech")) {
        task = AITaskType.AUDIO_TRANSCRIPTION;
        modality = AIModality.AUDIO;
        runtime = "whisper-runtime";
      }
    } else {
      if (lowerName.includes("clip") || lowerName.includes("vision")) {
        task = AITaskType.IMAGE_UNDERSTANDING;
        modality = AIModality.IMAGE;
        runtime = "vision-runtime";
        dimensions = 512;
      } else if (lowerName.includes("trocr") || lowerName.includes("ocr")) {
        task = AITaskType.OCR;
        modality = AIModality.DOCUMENT;
        runtime = "local_ocr";
      } else if (lowerName.includes("whisper") || lowerName.includes("speech")) {
        task = AITaskType.AUDIO_TRANSCRIPTION;
        modality = AIModality.AUDIO;
        runtime = "whisper-runtime";
      }
    }

    return {
      valid: true,
      compatible: true,
      format: "ONNX",
      name: nameCandidate,
      sourcePath,
      isDirectory,
      totalSize,
      task,
      modality,
      runtime,
      dimensions,
      onnxFiles,
      hasConfig: Boolean(configJson),
      hasTokenizer: Boolean(tokenizerJson),
    };
  }

  /**
   * Imports and installs a custom local model
   */
  async importModel(validationResult, userOverrides = {}) {
    if (!validationResult || !validationResult.compatible) {
      throw new Error(validationResult?.error || "Incompatible model cannot be imported");
    }

    const customDir = path.join(this.modelsDir, "custom");
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }

    const cleanName = (userOverrides.name || validationResult.name || "custom-model")
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-");
    const modelId = `custom-${cleanName}-${Date.now().toString(36)}`;
    const targetModelDir = path.join(customDir, modelId);
    fs.mkdirSync(targetModelDir, { recursive: true });

    // Copy files
    if (validationResult.isDirectory) {
      const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const items = fs.readdirSync(src);
        for (const item of items) {
          const srcPath = path.join(src, item);
          const destPath = path.join(dest, item);
          if (fs.statSync(srcPath).isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyRecursive(validationResult.sourcePath, targetModelDir);
    } else {
      const fileName = path.basename(validationResult.sourcePath);
      fs.copyFileSync(validationResult.sourcePath, path.join(targetModelDir, fileName));
    }

    // Create Profile
    const task = userOverrides.task || validationResult.task;
    let modality = AIModality.TEXT;
    let runtime = "local-runtime";
    if (task === AITaskType.IMAGE_UNDERSTANDING) {
      modality = AIModality.IMAGE;
      runtime = "vision-runtime";
    } else if (task === AITaskType.OCR) {
      modality = AIModality.DOCUMENT;
      runtime = "local_ocr";
    } else if (task === AITaskType.AUDIO_TRANSCRIPTION) {
      modality = AIModality.AUDIO;
      runtime = "whisper-runtime";
    }

    const profile = createModelProfile({
      id: modelId,
      name: userOverrides.name || validationResult.name,
      provider: "Custom Local Import",
      version: "1.0.0",
      task,
      modality,
      qualityTier: QualityMode.BALANCED,
      sizeBytes: validationResult.totalSize || 0,
      ramRequirementBytes: 512 * 1024 * 1024,
      gpuRequirement: false,
      quantization: "onnx",
      dimensions: userOverrides.dimensions || validationResult.dimensions || 384,
      runtime,
      source: "local-file",
      downloadUrl: targetModelDir,
      status: ModelStatus.VERIFIED,
      isCustom: true,
      customPath: targetModelDir,
      capabilities: { localImport: true },
    });

    // Write metadata manifest
    fs.writeFileSync(
      path.join(targetModelDir, "custom_manifest.json"),
      JSON.stringify(profile, null, 2),
      "utf-8"
    );

    if (this.registry) {
      this.registry.register(profile);
    }

    return {
      success: true,
      model: profile,
      modelId: profile.id,
      targetDir: targetModelDir,
    };
  }
}

module.exports = {
  CustomModelImporter,
};
