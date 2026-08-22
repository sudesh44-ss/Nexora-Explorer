"use strict";

const { BENCHMARK_CATEGORIES, RELEVANCE_LEVELS } = require("./benchmarkSchema.cjs");

const BENCHMARK_DATASET = [
  {
    id: "bench_lexical_01",
    query: "cybersecurity",
    category: BENCHMARK_CATEGORIES.LEXICAL,
    difficulty: "easy",
    expected: [
      { fileId: "doc_cyber_1", relevance: RELEVANCE_LEVELS.HIGHLY_RELEVANT },
      { fileId: "doc_cyber_2", relevance: RELEVANCE_LEVELS.RELEVANT },
    ],
  },
  {
    id: "bench_phrase_01",
    query: '"network security"',
    category: BENCHMARK_CATEGORIES.PHRASE,
    difficulty: "medium",
    expected: [
      { fileId: "doc_net_sec", relevance: RELEVANCE_LEVELS.HIGHLY_RELEVANT },
    ],
  },
  {
    id: "bench_semantic_01",
    query: "packet filtering and firewall setup",
    category: BENCHMARK_CATEGORIES.SEMANTIC,
    difficulty: "medium",
    expected: [
      { fileId: "doc_firewall", relevance: RELEVANCE_LEVELS.HIGHLY_RELEVANT },
      { fileId: "vid_firewall_lecture", relevance: RELEVANCE_LEVELS.RELEVANT },
    ],
  },
  {
    id: "bench_hinglish_01",
    query: "birthday wali photos jisme cake hai",
    category: BENCHMARK_CATEGORIES.HINGLISH,
    difficulty: "hard",
    expected: [
      { fileId: "img_birthday_cake", relevance: RELEVANCE_LEVELS.HIGHLY_RELEVANT },
    ],
  },
  {
    id: "bench_filter_01",
    query: "type:video duration:>30min lecture",
    category: BENCHMARK_CATEGORIES.FILTER,
    difficulty: "medium",
    expected: [
      { fileId: "vid_long_lecture", relevance: RELEVANCE_LEVELS.HIGHLY_RELEVANT },
    ],
  },
  {
    id: "bench_multimodal_01",
    query: "server room diagram",
    category: BENCHMARK_CATEGORIES.MULTIMODAL,
    difficulty: "medium",
    expected: [
      { fileId: "img_server_diagram", relevance: RELEVANCE_LEVELS.HIGHLY_RELEVANT },
    ],
  },
  {
    id: "bench_context_01",
    query: "only short ones",
    category: BENCHMARK_CATEGORIES.CONTEXTUAL,
    difficulty: "hard",
    context: { rawQuery: "cybersecurity videos" },
    expected: [
      { fileId: "vid_cyber_short", relevance: RELEVANCE_LEVELS.HIGHLY_RELEVANT },
    ],
  },
  {
    id: "bench_typo_01",
    query: "cybersecurty",
    category: BENCHMARK_CATEGORIES.TYPO,
    difficulty: "easy",
    expected: [
      { fileId: "doc_cyber_1", relevance: RELEVANCE_LEVELS.RELEVANT },
    ],
  },
  {
    id: "bench_zero_01",
    query: "type:video duration:>100hours non_existent_file_xyz_99",
    category: BENCHMARK_CATEGORIES.ZERO_RESULT,
    difficulty: "easy",
    expected: [],
  },
];

module.exports = {
  BENCHMARK_DATASET,
};
