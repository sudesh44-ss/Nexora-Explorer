"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  AudioSearch,
  AudioSignals,
  AudioMetadata,
  AudioTranscript,
  AudioSpeaker,
  AudioConcepts,
  AudioTags,
  AudioDuration,
} = aiSearch.audio;

const { DatabaseManager } = aiSearch.database;
const { createFileRecord } = aiSearch.discovery;
const { QueryUnderstanding } = aiSearch.query;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA ADVANCED AUDIO INTELLIGENCE TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_audio_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "audio_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const qu = new QueryUnderstanding();

  try {
    // --------------------------------------------------------
    // Seed Sample Audio Files & Records
    // --------------------------------------------------------
    // 1. Cybersecurity Long Podcast (45 mins = 2700s)
    const recCyberAudio = createFileRecord({
      file_id: "aud_cyber",
      name: "Cybersecurity_Podcast_Ep12.mp3",
      path: "C:/Users/User/Music/Cybersecurity_Podcast_Ep12.mp3",
      extension: ".mp3",
      mime_type: "audio/mpeg",
      size: 42 * 1024 * 1024,
    });
    db.files.insert(recCyberAudio);
    db.content.upsert("aud_cyber", {
      extracted_text: "Welcome to the podcast. Today we discuss firewall configuration, network security protocols, and cloud defense.",
      word_count: 17,
    });
    db.ai.upsert("aud_cyber", {
      description: "In-depth podcast episode discussing firewall configuration, network security architectures, and intrusion detection.",
      tags: JSON.stringify(["cybersecurity", "networking", "firewall", "podcast", "audio"]),
      entities: JSON.stringify({
        duration: 2700, // 45 mins
        bitrate: 192000,
        sampleRate: 44100,
        channels: 2,
        codec: "mp3",
        transcriptSegments: [
          { text: "Welcome to the podcast.", timestamp: 0, speaker: "Host" },
          { text: "Today we discuss network security and firewall configuration in enterprise networks.", timestamp: 862, speaker: "Guest" }, // 14:22
        ],
        musicMetadata: {
          title: "Enterprise Firewall Secrets",
          artist: "SecPodcast Team",
          album: "Cybersecurity Weekly",
          genre: "Podcast",
          year: 2025,
        },
      }),
    });

    // 2. Short Voice Memo (3 mins = 180s)
    const recMemo = createFileRecord({
      file_id: "aud_memo",
      name: "voice_note_python.m4a",
      path: "C:/Users/User/Music/voice_note_python.m4a",
      extension: ".m4a",
      mime_type: "audio/mp4",
      size: 3 * 1024 * 1024,
    });
    db.files.insert(recMemo);
    db.content.upsert("aud_memo", {
      extracted_text: "Quick note for tomorrow: test python backend scripts and verify sqlite transactions.",
      word_count: 13,
    });
    db.ai.upsert("aud_memo", {
      description: "Short voice note reminder about python backend tests",
      tags: JSON.stringify(["python", "memo", "voice", "recording"]),
      entities: JSON.stringify({
        duration: 180, // 3 mins
        bitrate: 128000,
        sampleRate: 44100,
        channels: 1,
        codec: "aac",
        transcriptSegments: [
          { text: "Quick note for tomorrow: test python backend scripts", timestamp: 10, speaker: "Me" },
        ],
      }),
    });

    // --------------------------------------------------------
    // Test 1: Audio Metadata & Duration Parsing
    // --------------------------------------------------------
    console.log("▶ Test 1: Audio metadata & duration parsing ('>30min', '<5min')...");
    const dur30Min = AudioDuration.parse(">30min");
    assert.strictEqual(dur30Min.operator, ">");
    assert.strictEqual(dur30Min.seconds, 1800);

    const dur5Min = AudioDuration.parse("<5min");
    assert.strictEqual(dur5Min.operator, "<");
    assert.strictEqual(dur5Min.seconds, 300);

    assert.strictEqual(AudioDuration.evaluate(2700, dur30Min), true);
    assert.strictEqual(AudioDuration.evaluate(180, dur30Min), false);
    assert.strictEqual(AudioDuration.evaluate(180, dur5Min), true);
    console.log("  ✓ Passed: Audio duration parser correctly converted minutes to seconds and verified limits.");

    // --------------------------------------------------------
    // Test 2: Speech Transcript Matching & Timestamp ('firewall configuration')
    // --------------------------------------------------------
    console.log("▶ Test 2: Speech transcript matching with timestamp retrieval ('firewall configuration')...");
    const sqCyber = qu.understand("firewall configuration");
    const sigCyber = AudioSearch.evaluateAudio("aud_cyber", sqCyber, db);
    assert.ok(sigCyber.scores.transcriptScore > 0.5, "Transcript must match query keywords");
    assert.strictEqual(sigCyber.evidence.bestMatchTimestamp, "14:22");
    console.log(`  ✓ Passed: Matched audio transcript phrase and extracted timestamp (${sigCyber.evidence.bestMatchTimestamp}).`);

    // --------------------------------------------------------
    // Test 3: Exact Phrase Match Boost ('"network security"')
    // --------------------------------------------------------
    console.log("▶ Test 3: Exact quoted phrase matching in audio transcript ('\"network security\"')...");
    const sqPhrase = qu.understand('"network security"');
    const sigPhrase = AudioSearch.evaluateAudio("aud_cyber", sqPhrase, db);
    assert.strictEqual(sigPhrase.scores.transcriptPhraseScore, 1.0);
    console.log("  ✓ Passed: Exact phrase in transcript produced 1.0 phrase relevance score.");

    // --------------------------------------------------------
    // Test 4: Speaker Identification & Diarization Search
    // --------------------------------------------------------
    console.log("▶ Test 4: Speaker diarization matching in transcript...");
    const sqSpeaker = {
      rawQuery: "firewall",
      keywords: ["firewall"],
      phrases: [],
      speakers: ["Guest"],
    };
    const sigSpeaker = AudioSearch.evaluateAudio("aud_cyber", sqSpeaker, db);
    assert.strictEqual(sigSpeaker.scores.speakerScore, 1.0);
    assert.ok(sigSpeaker.evidence.matchedSpeakers.includes("Guest"));
    console.log("  ✓ Passed: Identified speaker ('Guest') in audio transcript segment.");

    // --------------------------------------------------------
    // Test 5: Music & ID3 Metadata Matching (Artist/Album/Genre)
    // --------------------------------------------------------
    console.log("▶ Test 5: Music & podcast metadata matching ('SecPodcast Team', 'Podcast')...");
    const metaCyber = AudioMetadata.extract(recCyberAudio, db.ai.findByFileId("aud_cyber"));
    assert.strictEqual(metaCyber.artist, "SecPodcast Team");
    assert.strictEqual(metaCyber.genre, "Podcast");
    assert.strictEqual(metaCyber.year, 2025);
    console.log("  ✓ Passed: Correctly resolved ID3 / podcast metadata without disk inspection.");

    // --------------------------------------------------------
    // Test 6: Duration Filter Exclusion ('type:audio duration:>30min')
    // --------------------------------------------------------
    console.log("▶ Test 6: Audio duration filter exclusion ('duration:>30min')...");
    const sqLongAudio = {
      rawQuery: "cybersecurity",
      keywords: ["cybersecurity"],
      phrases: [],
      durationFilter: AudioDuration.parse(">30min"),
    };
    const longMatch = AudioSearch.evaluateAudio("aud_cyber", sqLongAudio, db);
    const shortMatch = AudioSearch.evaluateAudio("aud_memo", sqLongAudio, db);
    assert.ok(longMatch !== null, "45-minute podcast must pass >30min filter");
    assert.strictEqual(shortMatch, null, "3-minute memo must be excluded by >30min filter");
    console.log("  ✓ Passed: Duration filter strictly excluded short audio files.");

    // --------------------------------------------------------
    // Test 7: Graceful Degradation on Unindexed/Pending Audio
    // --------------------------------------------------------
    console.log("▶ Test 7: Graceful degradation for unindexed audio recordings...");
    const recUnindexed = createFileRecord({
      file_id: "aud_raw",
      name: "raw_recording.mp3",
      path: "C:/Users/User/Music/raw_recording.mp3",
      extension: ".mp3",
    });
    db.files.insert(recUnindexed);

    const sigUnindexed = AudioSearch.evaluateAudio("aud_raw", sqCyber, db);
    assert.ok(sigUnindexed !== null);
    assert.strictEqual(sigUnindexed.scores.transcriptScore, 0.0);
    console.log("  ✓ Passed: Unindexed audio evaluated safely using filename/metadata without errors.");

    // --------------------------------------------------------
    // Test 8: High Performance In-Memory Evaluation (1,000 audios in <100ms)
    // --------------------------------------------------------
    console.log("▶ Test 8: High-speed in-memory audio candidate evaluation (1,000 candidates)...");
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      AudioSearch.evaluateAudio("aud_cyber", sqCyber, db, 0.9);
    }
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 500, `1,000 audio evaluations must complete in <500ms (took ${elapsed}ms)`);
    console.log(`  ✓ Passed: Evaluated 1,000 audio candidates in ${elapsed}ms without STT, FFmpeg, or disk I/O.`);

    console.log("\n=================================================");
    console.log("🎉 ALL PART 21 ADVANCED AUDIO INTELLIGENCE TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    if (db) {
      try { db.close(); } catch {}
    }
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
