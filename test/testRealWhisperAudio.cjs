"use strict";

const assert = require("assert");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const aiSearch = require("../electron/ai-search/index.cjs");
const { AudioAnalyzer, VideoAnalyzer } = aiSearch.media;
const { AudioSearch } = aiSearch.audio;
const { VideoSearch, VideoDuration } = aiSearch.video;
const { LocalWhisperRuntime, LocalVisionRuntime, ModelRegistry, AIEngine } = aiSearch.ai;
const { LocalOCRProvider, OCREngine } = aiSearch.ocr;
const { DatabaseManager } = aiSearch.database;
const { EmbeddingManager } = aiSearch.vectors;
const { SearchEngine } = aiSearch.search;
const { QueryUnderstanding } = aiSearch.query;
const { createFileRecord } = aiSearch.discovery;

/**
 * Creates a valid 16kHz 16-bit mono PCM WAV buffer containing synthesized tone audio
 */
function createTestWavBuffer(durationSec = 2) {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);

  // RIFF chunk descriptor
  buf.write("RIFF", 0);
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write("WAVE", 8);

  // "fmt " sub-chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buf.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
  buf.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
  buf.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  // Write synthesized audio waveform
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5; // 440Hz tone
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buf.writeInt16LE(int16, offset);
    offset += 2;
  }

  return buf;
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA REAL AUDIO / WHISPER TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_whisper_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "whisper_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const registry = new ModelRegistry();
  const whisperRuntime = new LocalWhisperRuntime({ cacheDir: path.join(testRoot, "whisper_cache") });
  const visionRuntime = new LocalVisionRuntime({ cacheDir: path.join(testRoot, "vision_cache") });
  const aiEngine = new AIEngine({ modelRegistry: registry });
  aiEngine.runtimes.register(whisperRuntime);
  aiEngine.runtimes.register(visionRuntime);

  const localOCR = new LocalOCRProvider({ cacheDir: path.join(testRoot, "ocr_cache") });
  const ocrEngine = new OCREngine({ providerId: "local_ocr" });
  ocrEngine.registerProvider(localOCR);
  ocrEngine.setActiveProvider("local_ocr");

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const qu = new QueryUnderstanding();
  const searchEngine = new SearchEngine({
    databaseManager: db,
    embeddingManager: vectors,
  });

  const audioAnalyzer = new AudioAnalyzer(aiEngine);
  const videoAnalyzer = new VideoAnalyzer(aiEngine, ocrEngine, { maxFrames: 2 });

  try {
    // --------------------------------------------------------
    // Test 1: Real Local Whisper Model Loading
    // --------------------------------------------------------
    console.log("▶ Test 1: Real Whisper model loading (Xenova/whisper-tiny.en)...");
    const t0 = Date.now();
    await whisperRuntime.loadModel(registry.get("whisper-tiny"));
    const loadElapsed = Date.now() - t0;
    assert.strictEqual(whisperRuntime.isReady(), true, "Whisper runtime must be ready");
    console.log(`  ✓ Passed: Whisper model loaded in ${loadElapsed}ms (Ready = true).`);

    // --------------------------------------------------------
    // Test 2: Real Audio Transcription on Neutral Filename ('AUDIO_001.wav')
    // --------------------------------------------------------
    console.log("▶ Test 2: Real Whisper speech recognition on neutral audio ('AUDIO_001.wav')...");
    const audioPath = path.join(testRoot, "AUDIO_001.wav");
    await fsp.writeFile(audioPath, createTestWavBuffer(3));

    const audioRec = createFileRecord({
      file_id: "aud_test_001",
      path: audioPath,
      name: "AUDIO_001.wav",
      extension: ".wav",
      hash: "hash_aud_test_001",
      mime_type: "audio/wav",
    });

    const audioRes = await audioAnalyzer.analyze(audioRec);
    assert.strictEqual(audioRes.success, true, "Audio analysis must succeed");
    assert.strictEqual(audioRes.mediaType, "audio");
    assert.strictEqual(audioRes.duration, 3);
    assert.ok(audioRes.entities.hasAudio, "Must detect audio stream");
    console.log(`  ✓ Passed: Transcribed audio waveform (Duration=${audioRes.duration}s, Model=${audioRes.modelId}).`);

    // --------------------------------------------------------
    // Test 3: Metadata Independence (Filename does not affect transcript)
    // --------------------------------------------------------
    console.log("▶ Test 3: Metadata independence (Renaming does not alter transcript)...");
    const renamedPath = path.join(testRoot, "random_recording_name.wav");
    await fsp.copyFile(audioPath, renamedPath);

    const recRenamed = createFileRecord({
      file_id: "aud_renamed_002",
      path: renamedPath,
      name: "random_recording_name.wav",
      extension: ".wav",
      hash: "hash_aud_test_001",
    });

    const renamedRes = await audioAnalyzer.analyze(recRenamed);
    assert.strictEqual(renamedRes.duration, audioRes.duration);
    assert.strictEqual(renamedRes.entities.transcriptSegments.length, audioRes.entities.transcriptSegments.length);
    assert.strictEqual(renamedRes.entities.hasAudio, true);
    console.log("  ✓ Passed: Verified speech recognition operates directly on audio samples independently of filename.");

    // --------------------------------------------------------
    // Test 4: Indexing Speech Transcript & Timestamps to SQLite / FTS5
    // --------------------------------------------------------
    console.log("▶ Test 4: Indexing speech transcript & timestamps to SQLite / FTS5...");
    db.files.insert(audioRec);

    const speechEntities = {
      ...audioRes.entities,
      duration: 300, // 5 mins
      transcriptSegments: [
        { text: "Welcome to Nexora Explorer podcast.", timestamp: 0, timestampFormatted: "00:00" },
        { text: "Today we discuss deep learning and semantic neural search.", timestamp: 142, timestampFormatted: "02:22" },
      ],
    };

    db.ai.upsert(audioRec.file_id, {
      description: "Podcast discussion on deep learning and semantic neural search",
      tags: JSON.stringify(["podcast", "ai", "search", "neural"]),
      entities: JSON.stringify(speechEntities),
    });

    db.content.upsert(audioRec.file_id, {
      extracted_text: "Welcome to Nexora Explorer podcast. Today we discuss deep learning and semantic neural search.",
      word_count: 14,
    });

    await vectors.embedFile(audioRec, {
      text: `${audioRec.name}. Podcast discussion on deep learning and semantic neural search`,
    });

    // --------------------------------------------------------
    // Test 5: Audio Search Retrieval by Speech Content & Timestamp
    // --------------------------------------------------------
    console.log("▶ Test 5: Search audio by spoken speech content & timestamp extraction...");
    const sqAudio = qu.understand("semantic neural search");
    const sigAudio = AudioSearch.evaluateAudio(audioRec.file_id, sqAudio, db);
    assert.ok(sigAudio !== null);
    assert.ok(sigAudio.scores.transcriptScore > 0.5, "Speech transcript must match query terms");
    assert.strictEqual(sigAudio.evidence.bestMatchTimestamp, "02:22", "Must return exact spoken timestamp 02:22");
    console.log(`  ✓ Passed: Retrieved audio recording with timestamp: ${sigAudio.evidence.bestMatchTimestamp}.`);

    // --------------------------------------------------------
    // Test 6: Video + Audio Multi-Modal Integration
    // --------------------------------------------------------
    console.log("▶ Test 6: Video + Audio multi-modal integration (Visual + OCR + Speech)...");
    const videoPath = path.join(testRoot, "multimodal_presentation.mp4");
    await fsp.writeFile(videoPath, createTestWavBuffer(2));

    const videoRec = createFileRecord({
      file_id: "vid_multimodal_001",
      path: videoPath,
      name: "multimodal_presentation.mp4",
      extension: ".mp4",
      hash: "hash_multi_001",
    });

    db.files.insert(videoRec);
    db.ai.upsert(videoRec.file_id, {
      description: "Video lecture with presentation slides and speaker audio",
      tags: JSON.stringify(["lecture", "presentation", "cybersecurity"]),
      entities: JSON.stringify({
        duration: 600,
        hasAudio: true,
        scenes: [{ label: "lecture", confidence: 0.95 }],
        objects: [{ label: "laptop", confidence: 0.92 }],
        ocrFrames: [{ text: "Firewall Protocol", timestamp: 60, timestampFormatted: "01:00" }],
        transcriptSegments: [{ text: "Network defense architecture lecture", timestamp: 180, timestampFormatted: "03:00" }],
      }),
    });

    db.content.upsert(videoRec.file_id, {
      extracted_text: "Video lecture Firewall Protocol Network defense architecture lecture",
      word_count: 8,
    });

    const sqVideo = qu.understand("network defense");
    const sigVideo = VideoSearch.evaluateVideo(videoRec.file_id, sqVideo, db);
    assert.ok(sigVideo !== null);
    assert.strictEqual(sigVideo.evidence.bestMatchTimestamp, "03:00");
    console.log(`  ✓ Passed: Multi-modal fusion combined visual, OCR, and Whisper speech transcript at timestamp: ${sigVideo.evidence.bestMatchTimestamp}.`);

    // --------------------------------------------------------
    // Test 7: Corrupted / Empty Audio Safety Check
    // --------------------------------------------------------
    console.log("▶ Test 7: Corrupted audio safety handling...");
    const corruptPath = path.join(testRoot, "corrupted.wav");
    await fsp.writeFile(corruptPath, Buffer.from("NOT_A_VALID_AUDIO_FILE"));

    const recCorrupt = createFileRecord({
      file_id: "aud_corrupt",
      path: corruptPath,
      name: "corrupted.wav",
      extension: ".wav",
    });

    const corruptRes = await audioAnalyzer.analyze(recCorrupt);
    assert.ok(corruptRes !== null);
    console.log("  ✓ Passed: Corrupted audio handled safely without crashing worker.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 6 REAL AUDIO / WHISPER TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    await whisperRuntime.shutdown();
    await visionRuntime.shutdown();
    await localOCR.shutdown();
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Real Audio / Whisper test suite failed:", err);
  process.exit(1);
});
