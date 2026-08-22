"use strict";

/**
 * ============================================================
 * Nexora AI Search Subsystem
 * Isolated Backend Module Entry Point
 * ============================================================
 */

const { AISearchCore, CoreState } = require("./core/aiSearchCore.cjs");
const { AISearchConfigManager, getDefaultConfig, AIQualityMode, IndexingPriority } = require("./config/aiSearchConfig.cjs");
const { HardwareInterface, HardwareTier } = require("./hardware/hardwareInterface.cjs");
const { BaseAIProvider, AIProviderRegistry, AIProviderType } = require("./providers/providerInterface.cjs");
const { AISearchLogger, LogLevel, logger } = require("./diagnostics/aiSearchLogger.cjs");
const { AISearchError, AISearchErrorCodes } = require("./diagnostics/aiSearchErrors.cjs");

// Discovery Subsystem (Part 2)
const { FileScanner, ConcurrencyLimiter } = require("./discovery/fileScanner.cjs");
const { readMetadata } = require("./discovery/metadataReader.cjs");
const { generateFileId, generateContentSignature } = require("./discovery/fileId.cjs");
const { computeStreamHash, computeSampleHash, computeFileHash } = require("./discovery/fileHash.cjs");
const { detectMimeType, EXT_TO_MIME } = require("./discovery/mimeDetector.cjs");
const { HashStrategy, ScanStatus, getDefaultScanOptions, createFileRecord, createFolderRecord } = require("./discovery/scanTypes.cjs");
const { ScanErrorCode, classifyNodeError } = require("./discovery/scanErrors.cjs");

// Database Subsystem (Part 3)
const { DatabaseManager } = require("./database/databaseManager.cjs");
const { getDatabaseConfig, resolveDatabaseDirectory } = require("./database/databaseConfig.cjs");
const { DatabaseSchema, MIGRATIONS } = require("./database/databaseSchema.cjs");
const { TransactionManager } = require("./database/transactions/transactionManager.cjs");
const { FTSManager } = require("./database/fts/ftsManager.cjs");
const { FileRepository } = require("./database/repositories/fileRepository.cjs");
const { ContentRepository } = require("./database/repositories/contentRepository.cjs");
const { AIRepository } = require("./database/repositories/aiRepository.cjs");
const { ScannerDatabaseAdapter } = require("./database/adapters/scannerDatabaseAdapter.cjs");
const { DatabaseError, DatabaseErrorCode } = require("./database/databaseErrors.cjs");

// Resource Manager Subsystem (Part 5)
const { ResourceManager } = require("./resources/resourceManager.cjs");
const { CpuMonitor } = require("./resources/cpuMonitor.cjs");
const { MemoryMonitor } = require("./resources/memoryMonitor.cjs");
const { DiskMonitor } = require("./resources/diskMonitor.cjs");
const { getResourcePolicy } = require("./resources/resourcePolicy.cjs");
const { ResourceState, ResourceAction, PauseReason, ImpactLevel } = require("./resources/resourceState.cjs");
const { ResourceErrorCode, ResourceError } = require("./resources/resourceErrors.cjs");

// Content Extraction Subsystem (Part 6)
const { ExtractionManager } = require("./extraction/extractionManager.cjs");
const { ExtractionRegistry } = require("./extraction/extractionRegistry.cjs");
const { BaseExtractor } = require("./extraction/extractors/baseExtractor.cjs");
const { PlainTextExtractor, TEXT_EXTENSIONS } = require("./extraction/text/plainTextExtractor.cjs");
const { JsonExtractor, JSON_EXTENSIONS } = require("./extraction/structured/jsonExtractor.cjs");
const { CsvExtractor, CSV_EXTENSIONS } = require("./extraction/structured/csvExtractor.cjs");
const { CodeExtractor, CODE_EXTENSIONS } = require("./extraction/code/codeExtractor.cjs");
const { PdfExtractor } = require("./extraction/pdf/pdfExtractor.cjs");
const { DocxExtractor } = require("./extraction/office/docxExtractor.cjs");
const { createExtractionResult, normalizeDocumentText, normalizeCodeText, countWords } = require("./extraction/extractionResult.cjs");
const { ExtractionErrorCode, ExtractionError } = require("./extraction/extractionErrors.cjs");

// AI Infrastructure Subsystem (Part 7)
const { AIEngine } = require("./ai/aiEngine.cjs");
const { ModelRegistry, DEFAULT_MODEL_PROFILES } = require("./ai/modelRegistry.cjs");
const { ModelSelector } = require("./ai/modelSelector.cjs");
const { ModelManager, resolveModelsDirectory } = require("./ai/modelManager.cjs");
const { BaseAIRuntime, MockAIRuntime, LocalEmbeddingRuntime, LocalVisionRuntime, LocalWhisperRuntime, RuntimeRegistry } = require("./ai/runtimeRegistry.cjs");
const { AITaskType, AIModality, ModelStatus, QualityMode, createModelProfile } = require("./ai/modelProfile.cjs");
const { createAITask } = require("./ai/aiTask.cjs");
const { createAIResult } = require("./ai/aiResult.cjs");
const { AIErrorCode, AIError } = require("./ai/aiErrors.cjs");

// Vector Subsystem (Part 8)
const { EmbeddingManager } = require("./vectors/embeddingManager.cjs");
const { EmbeddingGenerator } = require("./vectors/embeddingGenerator.cjs");
const { VectorStore } = require("./vectors/vectorStore.cjs");
const { VectorSearch } = require("./vectors/vectorSearch.cjs");
const { createEmbeddingDocument } = require("./vectors/embeddingDocument.cjs");
const { createEmbeddingResult } = require("./vectors/embeddingResult.cjs");
const { validateVector, l2Normalize, cosineSimilarity } = require("./vectors/similarity.cjs");
const { getVectorConfig } = require("./vectors/vectorConfig.cjs");
const { createVectorIndexMetadata } = require("./vectors/vectorMetadata.cjs");
const { VectorErrorCode, VectorError } = require("./vectors/vectorErrors.cjs");

// Hybrid Search Subsystem (Part 9)
const { SearchEngine } = require("./search/searchEngine.cjs");
const { QueryProcessor } = require("./search/queryProcessor.cjs");
const { QueryParser, FILE_TYPE_MAP, STOP_WORDS } = require("./search/queryParser.cjs");
const { CandidateRetriever: HybridCandidateRetriever } = require("./search/candidateRetriever.cjs");
const { CandidateMerger } = require("./search/candidateMerger.cjs");
const { RankingEngine } = require("./search/rankingEngine.cjs");
const { RankingSignals, EXTENSION_CATEGORIES } = require("./search/rankingSignals.cjs");
const { ScoreNormalizer } = require("./search/scoreNormalizer.cjs");
const { FileResolver } = require("./search/fileResolver.cjs");
const { createSearchResult } = require("./search/searchResult.cjs");
const { getSearchConfig } = require("./search/searchConfig.cjs");
const { SearchErrorCode, SearchError } = require("./search/searchErrors.cjs");

// Query Understanding Subsystem (Part 10)
const { QueryUnderstanding } = require("./query/queryUnderstanding.cjs");
const { QueryNormalizer } = require("./query/queryNormalizer.cjs");
const { QueryLanguage, QueryLanguageDetector } = require("./query/queryLanguage.cjs");
const { QueryParser: AdvancedQueryParser } = require("./query/queryParser.cjs");
const { QuerySizeParser } = require("./query/querySizeParser.cjs");
const { QueryDateParser } = require("./query/queryDateParser.cjs");
const { QueryEntitiesExtractor } = require("./query/queryEntities.cjs");
const { QueryFallback, MAX_QUERY_LENGTH } = require("./query/queryFallback.cjs");
const { IntentDetector } = require("./query/intentDetector.cjs");
const { FileTypeDetector } = require("./query/fileTypeDetector.cjs");
const { ConceptExtractor, QUERY_STOP_WORDS } = require("./query/conceptExtractor.cjs");
const { DateResolver } = require("./query/dateResolver.cjs");
const { FolderHintDetector } = require("./query/folderHintDetector.cjs");
const { SemanticQueryBuilder } = require("./query/semanticQueryBuilder.cjs");
const { QueryValidator } = require("./query/queryValidator.cjs");
const { QueryIntent, createStructuredQuery } = require("./query/querySchema.cjs");
const { LLMQueryAdapter } = require("./query/llmQueryAdapter.cjs");
const { QueryErrorCode, QueryError } = require("./query/queryErrors.cjs");

// Media Intelligence Subsystem (Part 11)
const { ContentAnalyzer } = require("./media/contentAnalyzer.cjs");
const { ImageAnalyzer } = require("./media/imageAnalyzer.cjs");
const { AudioAnalyzer } = require("./media/audioAnalyzer.cjs");
const { VideoAnalyzer } = require("./media/videoAnalyzer.cjs");
const { VideoMetadataParser } = require("./media/videoMetadataParser.cjs");
const { VideoFrameExtractor } = require("./media/videoFrameExtractor.cjs");
const { ImagePreprocessor } = require("./media/imagePreprocessor.cjs");
const { MediaIndexer } = require("./media/mediaIndexer.cjs");
const { MediaQueue } = require("./media/mediaQueue.cjs");
const { createMediaResult } = require("./media/mediaResult.cjs");
const { MediaAnalysisStatus } = require("./media/mediaMetadata.cjs");
const {
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  isImageFile,
  isAudioFile,
  isVideoFile,
  getMediaType,
} = require("./media/mediaCapabilities.cjs");
const { MediaErrorCode, MediaError } = require("./media/mediaErrors.cjs");

// OCR Subsystem (Part 14)
const { OCREngine } = require("./ocr/ocrEngine.cjs");
const { BaseOCRProvider, MockOCRProvider } = require("./ocr/ocrProvider.cjs");
const { LocalOCRProvider } = require("./ocr/localOCRProvider.cjs");
const { createOCRResult } = require("./ocr/ocrResult.cjs");
const { OCRDetector, TextStatus } = require("./ocr/ocrDetector.cjs");
const { OCRPreprocessor } = require("./ocr/ocrPreprocessor.cjs");
const { OCRLanguage, SUPPORTED_LANGUAGES } = require("./ocr/ocrLanguage.cjs");
const { OCRIndexer } = require("./ocr/ocrIndexer.cjs");
const { getOCRConfig, DEFAULT_OCR_CONFIG } = require("./ocr/ocrConfig.cjs");
const { OCRErrorCode, OCRError } = require("./ocr/ocrErrors.cjs");

// Document Intelligence Subsystem (Part 14)
const { DocumentAnalyzer } = require("./document/documentAnalyzer.cjs");
const { DocumentClassifier } = require("./document/documentClassifier.cjs");
const { EntityExtractor } = require("./document/entityExtractor.cjs");
const { createDocumentResult } = require("./document/documentResult.cjs");
const { DocumentType, EntityType } = require("./document/documentMetadata.cjs");
const { DocumentErrorCode, DocumentError } = require("./document/documentErrors.cjs");

// Unified Content Subsystem (Part 15)
const { ContentSources, ProcessingStatus } = require("./content/contentSources.cjs");
const { CONTENT_SCHEMA_VERSION } = require("./content/contentVersion.cjs");
const { ContentValidator } = require("./content/contentValidator.cjs");
const { ContentNormalizer } = require("./content/contentNormalizer.cjs");
const { createUnifiedContent } = require("./content/unifiedContent.cjs");
const { ContentBuilder } = require("./content/contentBuilder.cjs");
const { ContentStore } = require("./content/contentStore.cjs");

// Unified Search Subsystem (Part 15)
const { UnifiedSearch } = require("./unified/unifiedSearch.cjs");
const { CandidateRetriever } = require("./unified/candidateRetriever.cjs");
const { SearchQueryBuilder } = require("./unified/searchQueryBuilder.cjs");
const { SearchResultNormalizer } = require("./unified/searchResultNormalizer.cjs");
const { SignalSource, createSearchSignal } = require("./unified/searchSignals.cjs");

// Advanced Ranking Subsystem (Part 17)
const { RankingEngine: AdvancedRankingEngine } = require("./ranking/rankingEngine.cjs");
const { RankingWeights, RANKING_WEIGHT_PROFILES } = require("./ranking/rankingWeights.cjs");
const { RankingSignals: AdvancedRankingSignals } = require("./ranking/rankingSignals.cjs");
const { RankingNormalizer } = require("./ranking/rankingNormalizer.cjs");
const { RankingScore } = require("./ranking/rankingScore.cjs");
const { RankingExplanation } = require("./ranking/rankingExplanation.cjs");
const { getRankingConfig, DEFAULT_RANKING_CONFIG } = require("./ranking/rankingConfig.cjs");
const { RankingValidator } = require("./ranking/rankingValidator.cjs");

// Advanced Search Operators & Filters Subsystem (Part 18)
const { FilterEngine } = require("./filters/filterEngine.cjs");
const { FilterParser } = require("./filters/filterParser.cjs");
const { FilterOperators, SUPPORTED_OPERATORS } = require("./filters/filterOperators.cjs");
const { FilterTypes, SUPPORTED_FILTER_TYPES, TYPE_EXTENSIONS } = require("./filters/filterTypes.cjs");
const { FilterSize, SIZE_UNITS } = require("./filters/filterSize.cjs");
const { FilterDate } = require("./filters/filterDate.cjs");
const { FilterPath } = require("./filters/filterPath.cjs");
const { FilterValidator } = require("./filters/filterValidator.cjs");
const { FilterErrorCode, FilterError } = require("./filters/filterErrors.cjs");

// Advanced Image Intelligence Subsystem (Part 19)
const { ImageSearch } = require("./image/imageSearch.cjs");
const { ImageSignals } = require("./image/imageSignals.cjs");
const { ImageObjects } = require("./image/imageObjects.cjs");
const { ImageScenes } = require("./image/imageScenes.cjs");
const { ImageConcepts } = require("./image/imageConcepts.cjs");
const { ImageOcr } = require("./image/imageOcr.cjs");
const { ImageMetadata } = require("./image/imageMetadata.cjs");
const { ImageQueryMatcher } = require("./image/imageQueryMatcher.cjs");
const { ImageResultAdapter } = require("./image/imageResultAdapter.cjs");
const { ImageValidator } = require("./image/imageValidator.cjs");

// Advanced Video Intelligence Subsystem (Part 20)
const { VideoSearch } = require("./video/videoSearch.cjs");
const { VideoSignals } = require("./video/videoSignals.cjs");
const { VideoMetadata } = require("./video/videoMetadata.cjs");
const { VideoTranscript } = require("./video/videoTranscript.cjs");
const { VideoOcr } = require("./video/videoOcr.cjs");
const { VideoScenes } = require("./video/videoScenes.cjs");
const { VideoObjects } = require("./video/videoObjects.cjs");
const { VideoConcepts } = require("./video/videoConcepts.cjs");
const { VideoDuration, DURATION_MULTIPLIERS } = require("./video/videoDuration.cjs");
const { VideoQueryMatcher } = require("./video/videoQueryMatcher.cjs");
const { VideoResultAdapter } = require("./video/videoResultAdapter.cjs");
const { VideoValidator } = require("./video/videoValidator.cjs");

// Advanced Audio Intelligence Subsystem (Part 21)
const { AudioSearch } = require("./audio/audioSearch.cjs");
const { AudioSignals } = require("./audio/audioSignals.cjs");
const { AudioMetadata } = require("./audio/audioMetadata.cjs");
const { AudioTranscript } = require("./audio/audioTranscript.cjs");
const { AudioSpeaker } = require("./audio/audioSpeaker.cjs");
const { AudioConcepts } = require("./audio/audioConcepts.cjs");
const { AudioTags } = require("./audio/audioTags.cjs");
const { AudioDuration } = require("./audio/audioDuration.cjs");
const { AudioQueryMatcher } = require("./audio/audioQueryMatcher.cjs");
const { AudioResultAdapter } = require("./audio/audioResultAdapter.cjs");
const { AudioValidator } = require("./audio/audioValidator.cjs");

// Unified Multimodal Search Fusion Subsystem (Part 22)
const { MultimodalFusion } = require("./fusion/multimodalFusion.cjs");
const { SignalNormalizer } = require("./fusion/signalNormalizer.cjs");
const { ModalityResolver } = require("./fusion/modalityResolver.cjs");
const { CandidateMerger: MultimodalCandidateMerger } = require("./fusion/candidateMerger.cjs");
const { ModalityEvidence } = require("./fusion/modalityEvidence.cjs");
const { FusionValidator } = require("./fusion/fusionValidator.cjs");
const { FusionDiagnostics } = require("./fusion/fusionDiagnostics.cjs");
const { FusionResultAdapter } = require("./fusion/fusionResultAdapter.cjs");

// Contextual Search & Query Refinement Subsystem (Part 23)
const { SearchContext } = require("./context/searchContext.cjs");
const { ContextResolver } = require("./context/contextResolver.cjs");
const { QueryRefiner } = require("./context/queryRefiner.cjs");
const { QueryState } = require("./context/queryState.cjs");
const { ContextValidator } = require("./context/contextValidator.cjs");
const { ContextNormalizer } = require("./context/contextNormalizer.cjs");
const { ContextDiagnostics } = require("./context/contextDiagnostics.cjs");
const { ContextResultAdapter } = require("./context/contextResultAdapter.cjs");

// Advanced Search Suggestions & Autocomplete Subsystem (Part 24)
const { SuggestionEngine } = require("./suggestions/suggestionEngine.cjs");
const { SuggestionResolver } = require("./suggestions/suggestionResolver.cjs");
const { SuggestionSources, OPERATORS: SUGGESTION_OPERATORS } = require("./suggestions/suggestionSources.cjs");
const { SuggestionRanker } = require("./suggestions/suggestionRanker.cjs");
const { SuggestionNormalizer } = require("./suggestions/suggestionNormalizer.cjs");
const { SuggestionValidator } = require("./suggestions/suggestionValidator.cjs");
const { SuggestionCache } = require("./suggestions/suggestionCache.cjs");
const { SuggestionDiagnostics } = require("./suggestions/suggestionDiagnostics.cjs");
const { SuggestionResultAdapter } = require("./suggestions/suggestionResultAdapter.cjs");

// Search Explainability & Result Intelligence Subsystem (Part 25)
const { SearchExplanation } = require("./explainability/searchExplanation.cjs");
const { EvidenceCollector } = require("./explainability/evidenceCollector.cjs");
const { ExplanationBuilder } = require("./explainability/explanationBuilder.cjs");
const { SignalExplanation } = require("./explainability/signalExplanation.cjs");
const { RankingTrace } = require("./explainability/rankingTrace.cjs");
const { ExplanationNormalizer } = require("./explainability/explanationNormalizer.cjs");
const { ExplanationValidator } = require("./explainability/explanationValidator.cjs");
const { ExplanationDiagnostics } = require("./explainability/explanationDiagnostics.cjs");
const { ExplanationResultAdapter } = require("./explainability/explanationResultAdapter.cjs");

// Search Performance, Caching & Scalability Subsystem (Part 26)
const { PerformanceAdapter } = require("./performance/performanceAdapter.cjs");
const { SearchCache } = require("./performance/searchCache.cjs");
const { CacheKey } = require("./performance/cacheKey.cjs");
const { CacheManager } = require("./performance/cacheManager.cjs");
const { CandidateLimiter, QUALITY_MODES } = require("./performance/candidateLimiter.cjs");
const { ConcurrencyManager } = require("./performance/concurrencyManager.cjs");
const { RequestController } = require("./performance/requestController.cjs");
const { MemoryGuard } = require("./performance/memoryGuard.cjs");
const { SearchScheduler } = require("./performance/searchScheduler.cjs");
const { PerformanceDiagnostics } = require("./performance/performanceDiagnostics.cjs");

// Search Evaluation, Benchmark Harness & Quality Telemetry Subsystem (Part 27)
const { BenchmarkRunner } = require("./evaluation/benchmarkRunner.cjs");
const { BENCHMARK_DATASET } = require("./evaluation/benchmarkDataset.cjs");
const { BenchmarkMetrics } = require("./evaluation/benchmarkMetrics.cjs");
const { BenchmarkLatency } = require("./evaluation/benchmarkLatency.cjs");
const { BenchmarkTelemetry } = require("./evaluation/benchmarkTelemetry.cjs");
const { BenchmarkResourceUsage } = require("./evaluation/benchmarkResourceUsage.cjs");
const { BenchmarkReporter } = require("./evaluation/benchmarkReporter.cjs");
const { BenchmarkSchema, BENCHMARK_CATEGORIES, RELEVANCE_LEVELS } = require("./evaluation/benchmarkSchema.cjs");
const { BenchmarkDiagnostics } = require("./evaluation/benchmarkDiagnostics.cjs");

// Search Engine Hardening, Security & Sandbox Subsystem (Part 28)
const {
  HardeningAdapter,
  InputValidator,
  QuerySanitizer,
  FtsGuard,
  PathGuard,
  SymlinkGuard,
  FilesystemGuard,
  IpcGuard,
  ErrorBoundary,
  ERROR_CATEGORIES,
  WorkerGuard,
  CacheIntegrityGuard,
  DatabaseRecovery,
  SecurityDiagnostics,
} = require("./security/hardeningAdapter.cjs");

// Background AI Indexing Queue Subsystem (Part 12)
const { IndexCoordinator } = require("./indexing/indexCoordinator.cjs");
const { IndexQueue } = require("./indexing/indexQueue.cjs");
const { PriorityScheduler } = require("./indexing/priorityScheduler.cjs");
const { BackgroundWorker } = require("./indexing/backgroundWorker.cjs");
const { WorkerPool } = require("./indexing/workerPool.cjs");
const { QueuePersistence } = require("./indexing/queuePersistence.cjs");
const { RetryManager } = require("./indexing/retryManager.cjs");
const { WorkloadEstimator } = require("./indexing/workloadEstimator.cjs");
const { BackpressureController } = require("./indexing/backpressure.cjs");
const { createIndexTask } = require("./indexing/taskRegistry.cjs");
const { TaskType, TaskPriority, TaskState, ErrorClassification } = require("./indexing/taskState.cjs");
const { IndexEvents } = require("./indexing/indexEvents.cjs");
const { getIndexConfig, DEFAULT_INDEX_CONFIG } = require("./indexing/indexConfig.cjs");
const { IndexQueueErrorCode, IndexQueueError } = require("./indexing/indexErrors.cjs");

// Incremental Changes Subsystem (Part 13)
const { ChangeCoordinator } = require("./changes/changeCoordinator.cjs");
const { ChangeClassifier } = require("./changes/changeClassifier.cjs");
const { ChangeCoalescer } = require("./changes/changeCoalescer.cjs");
const { IndexInvalidator } = require("./changes/indexInvalidator.cjs");
const { ReconciliationManager } = require("./changes/reconciliationManager.cjs");
const { FileChangeAdapter } = require("./changes/fileChangeAdapter.cjs");
const { ChangeType, EventSource, createChangeEvent } = require("./changes/changeEvents.cjs");
const { getChangeConfig, DEFAULT_CHANGE_CONFIG } = require("./changes/changeConfig.cjs");
const { ChangeErrorCode, ChangeError } = require("./changes/changeErrors.cjs");

// Indexer Subsystem (Part 4)
const { IndexManager } = require("./indexer/indexManager.cjs");
const { IndexSession } = require("./indexer/indexSession.cjs");
const { IndexWorker } = require("./indexer/indexWorker.cjs");
const { IndexComparator } = require("./indexer/indexComparator.cjs");
const { FileIndexStatus, IndexOperation, SessionStatus } = require("./indexer/indexState.cjs");
const { IndexErrorCode, IndexerError } = require("./indexer/indexErrors.cjs");

// Default singleton instances
const defaultCore = new AISearchCore();
const defaultDb = new DatabaseManager();
const defaultResources = new ResourceManager();
const defaultExtraction = new ExtractionManager();
const defaultAIEngine = new AIEngine({ resourceManager: defaultResources });
const defaultVectors = new EmbeddingManager(defaultAIEngine, defaultDb);
const defaultQueryUnderstanding = new QueryUnderstanding();
const defaultOCREngine = new OCREngine();
const defaultContentAnalyzer = new ContentAnalyzer({
  aiEngine: defaultAIEngine,
  extractionManager: defaultExtraction,
});
const defaultMediaIndexer = new MediaIndexer({
  databaseManager: defaultDb,
  embeddingManager: defaultVectors,
  aiEngine: defaultAIEngine,
  extractionManager: defaultExtraction,
});
const defaultMediaQueue = new MediaQueue(defaultMediaIndexer, {
  resourceManager: defaultResources,
  concurrency: 1,
});
const defaultIndexCoordinator = new IndexCoordinator({
  databaseManager: defaultDb,
  resourceManager: defaultResources,
  extractionManager: defaultExtraction,
  embeddingManager: defaultVectors,
  mediaIndexer: defaultMediaIndexer,
  ocrEngine: defaultOCREngine,
  ocrIndexer: OCRIndexer,
});
const defaultChangeCoordinator = new ChangeCoordinator({
  databaseManager: defaultDb,
  embeddingManager: defaultVectors,
  indexCoordinator: defaultIndexCoordinator,
});
const defaultSearch = new SearchEngine({
  databaseManager: defaultDb,
  embeddingManager: defaultVectors,
});
const defaultUnifiedSearch = new UnifiedSearch({
  databaseManager: defaultDb,
  embeddingManager: defaultVectors,
  queryUnderstanding: defaultQueryUnderstanding,
});
const defaultContentStore = new ContentStore(defaultDb, defaultVectors);
const defaultIndexer = new IndexManager(defaultDb, {
  resourceManager: defaultResources,
  extractionManager: defaultExtraction,
});

module.exports = {
  // Core
  core: defaultCore,
  AISearchCore,
  CoreState,

  // Configuration
  AISearchConfigManager,
  getDefaultConfig,
  AIQualityMode,
  IndexingPriority,

  // Hardware
  HardwareInterface,
  HardwareTier,

  // Providers
  BaseAIProvider,
  AIProviderRegistry,
  AIProviderType,

  // Diagnostics & Logging
  AISearchLogger,
  LogLevel,
  logger,
  AISearchError,
  AISearchErrorCodes,

  // Discovery & Scanner (Part 2)
  discovery: {
    FileScanner,
    ConcurrencyLimiter,
    readMetadata,
    generateFileId,
    generateContentSignature,
    computeStreamHash,
    computeSampleHash,
    computeFileHash,
    detectMimeType,
    EXT_TO_MIME,
    HashStrategy,
    ScanStatus,
    getDefaultScanOptions,
    createFileRecord,
    createFolderRecord,
    ScanErrorCode,
    classifyNodeError,
  },

  // Database Subsystem (Part 3)
  database: {
    db: defaultDb,
    DatabaseManager,
    getDatabaseConfig,
    resolveDatabaseDirectory,
    DatabaseSchema,
    MIGRATIONS,
    TransactionManager,
    FTSManager,
    FileRepository,
    ContentRepository,
    AIRepository,
    ScannerDatabaseAdapter,
    DatabaseError,
    DatabaseErrorCode,
  },

  // Resources Subsystem (Part 5)
  resources: {
    resourceManager: defaultResources,
    ResourceManager,
    CpuMonitor,
    MemoryMonitor,
    DiskMonitor,
    getResourcePolicy,
    ResourceState,
    ResourceAction,
    PauseReason,
    ImpactLevel,
    ResourceErrorCode,
    ResourceError,
  },

  // Extraction Subsystem (Part 6)
  extraction: {
    extractionManager: defaultExtraction,
    ExtractionManager,
    ExtractionRegistry,
    BaseExtractor,
    PlainTextExtractor,
    TEXT_EXTENSIONS,
    JsonExtractor,
    JSON_EXTENSIONS,
    CsvExtractor,
    CSV_EXTENSIONS,
    CodeExtractor,
    CODE_EXTENSIONS,
    PdfExtractor,
    DocxExtractor,
    createExtractionResult,
    normalizeDocumentText,
    normalizeCodeText,
    countWords,
    ExtractionErrorCode,
    ExtractionError,
  },

  // AI Infrastructure Subsystem (Part 7)
  ai: {
    aiEngine: defaultAIEngine,
    AIEngine,
    ModelRegistry,
    DEFAULT_MODEL_PROFILES,
    ModelSelector,
    ModelManager,
    resolveModelsDirectory,
    BaseAIRuntime,
    MockAIRuntime,
    LocalEmbeddingRuntime,
    LocalVisionRuntime,
    LocalWhisperRuntime,
    RuntimeRegistry,
    AITaskType,
    AIModality,
    ModelStatus,
    QualityMode,
    createModelProfile,
    createAITask,
    createAIResult,
    AIErrorCode,
    AIError,
  },

  // Vectors Subsystem (Part 8)
  vectors: {
    vectors: defaultVectors,
    EmbeddingManager,
    EmbeddingGenerator,
    VectorStore,
    VectorSearch,
    createEmbeddingDocument,
    createEmbeddingResult,
    validateVector,
    l2Normalize,
    cosineSimilarity,
    getVectorConfig,
    createVectorIndexMetadata,
    VectorErrorCode,
    VectorError,
  },

  // Hybrid Search Subsystem (Part 9)
  search: {
    search: defaultSearch,
    SearchEngine,
    QueryProcessor,
    QueryParser,
    FILE_TYPE_MAP,
    STOP_WORDS,
    CandidateRetriever: HybridCandidateRetriever,
    CandidateMerger,
    RankingEngine,
    RankingSignals,
    EXTENSION_CATEGORIES,
    ScoreNormalizer,
    FileResolver,
    createSearchResult,
    getSearchConfig,
    SearchErrorCode,
    SearchError,
  },

  // Query Understanding Subsystem (Part 10)
  query: {
    queryUnderstanding: defaultQueryUnderstanding,
    QueryUnderstanding,
    QueryNormalizer,
    QueryLanguage,
    QueryLanguageDetector,
    QueryParser: AdvancedQueryParser,
    QuerySizeParser,
    QueryDateParser,
    QueryEntitiesExtractor,
    QueryFallback,
    MAX_QUERY_LENGTH,
    IntentDetector,
    FileTypeDetector,
    ConceptExtractor,
    QUERY_STOP_WORDS,
    DateResolver,
    FolderHintDetector,
    SemanticQueryBuilder,
    QueryValidator,
    QueryIntent,
    createStructuredQuery,
    LLMQueryAdapter,
    QueryErrorCode,
    QueryError,
  },

  // Media Intelligence Subsystem (Part 11)
  media: {
    contentAnalyzer: defaultContentAnalyzer,
    mediaIndexer: defaultMediaIndexer,
    mediaQueue: defaultMediaQueue,
    ContentAnalyzer,
    ImageAnalyzer,
    AudioAnalyzer,
    VideoAnalyzer,
    VideoMetadataParser,
    VideoFrameExtractor,
    ImagePreprocessor,
    MediaIndexer,
    MediaQueue,
    createMediaResult,
    MediaAnalysisStatus,
    IMAGE_EXTENSIONS,
    AUDIO_EXTENSIONS,
    VIDEO_EXTENSIONS,
    isImageFile,
    isAudioFile,
    isVideoFile,
    getMediaType,
    MediaErrorCode,
    MediaError,
  },

  // OCR Subsystem (Part 14)
  ocr: {
    ocrEngine: defaultOCREngine,
    ocrIndexer: OCRIndexer,
    OCREngine,
    BaseOCRProvider,
    MockOCRProvider,
    LocalOCRProvider,
    createOCRResult,
    OCRDetector,
    TextStatus,
    OCRPreprocessor,
    OCRLanguage,
    SUPPORTED_LANGUAGES,
    OCRIndexer,
    getOCRConfig,
    DEFAULT_OCR_CONFIG,
    OCRErrorCode,
    OCRError,
  },

  // Document Intelligence Subsystem (Part 14)
  document: {
    analyzer: DocumentAnalyzer,
    DocumentAnalyzer,
    DocumentClassifier,
    EntityExtractor,
    createDocumentResult,
    DocumentType,
    EntityType,
    DocumentErrorCode,
    DocumentError,
  },

  // Unified Content Subsystem (Part 15)
  content: {
    store: defaultContentStore,
    ContentBuilder,
    ContentStore,
    ContentValidator,
    ContentNormalizer,
    createUnifiedContent,
    ContentSources,
    ProcessingStatus,
    CONTENT_SCHEMA_VERSION,
  },

  // Unified Search Subsystem (Part 15)
  unified: {
    unifiedSearch: defaultUnifiedSearch,
    UnifiedSearch,
    CandidateRetriever,
    SearchQueryBuilder,
    SearchResultNormalizer,
    SignalSource,
    createSearchSignal,
  },

  // Advanced Ranking Subsystem (Part 17)
  ranking: {
    RankingEngine: AdvancedRankingEngine,
    RankingWeights,
    RANKING_WEIGHT_PROFILES,
    RankingSignals: AdvancedRankingSignals,
    RankingNormalizer,
    RankingScore,
    RankingExplanation,
    getRankingConfig,
    DEFAULT_RANKING_CONFIG,
    RankingValidator,
  },

  // Advanced Search Operators & Filters Subsystem (Part 18)
  filters: {
    FilterEngine,
    FilterParser,
    FilterOperators,
    SUPPORTED_OPERATORS,
    FilterTypes,
    SUPPORTED_FILTER_TYPES,
    TYPE_EXTENSIONS,
    FilterSize,
    SIZE_UNITS,
    FilterDate,
    FilterPath,
    FilterValidator,
    FilterErrorCode,
    FilterError,
  },

  // Advanced Image Intelligence Subsystem (Part 19)
  image: {
    ImageSearch,
    ImageSignals,
    ImageObjects,
    ImageScenes,
    ImageConcepts,
    ImageOcr,
    ImageMetadata,
    ImageQueryMatcher,
    ImageResultAdapter,
    ImageValidator,
  },

  // Advanced Video Intelligence Subsystem (Part 20)
  video: {
    VideoSearch,
    VideoSignals,
    VideoMetadata,
    VideoTranscript,
    VideoOcr,
    VideoScenes,
    VideoObjects,
    VideoConcepts,
    VideoDuration,
    DURATION_MULTIPLIERS,
    VideoQueryMatcher,
    VideoResultAdapter,
    VideoValidator,
  },

  // Advanced Audio Intelligence Subsystem (Part 21)
  audio: {
    AudioSearch,
    AudioSignals,
    AudioMetadata,
    AudioTranscript,
    AudioSpeaker,
    AudioConcepts,
    AudioTags,
    AudioDuration,
    AudioQueryMatcher,
    AudioResultAdapter,
    AudioValidator,
  },

  // Unified Multimodal Search Fusion Subsystem (Part 22)
  fusion: {
    MultimodalFusion,
    SignalNormalizer,
    ModalityResolver,
    CandidateMerger: MultimodalCandidateMerger,
    ModalityEvidence,
    FusionValidator,
    FusionDiagnostics,
    FusionResultAdapter,
  },

  // Contextual Search & Query Refinement Subsystem (Part 23)
  context: {
    SearchContext,
    ContextResolver,
    QueryRefiner,
    QueryState,
    ContextValidator,
    ContextNormalizer,
    ContextDiagnostics,
    ContextResultAdapter,
  },

  // Advanced Search Suggestions & Autocomplete Subsystem (Part 24)
  suggestions: {
    SuggestionEngine,
    SuggestionResolver,
    SuggestionSources,
    SUGGESTION_OPERATORS,
    SuggestionRanker,
    SuggestionNormalizer,
    SuggestionValidator,
    SuggestionCache,
    SuggestionDiagnostics,
    SuggestionResultAdapter,
  },

  // Search Explainability & Result Intelligence Subsystem (Part 25)
  explainability: {
    SearchExplanation,
    EvidenceCollector,
    ExplanationBuilder,
    SignalExplanation,
    RankingTrace,
    ExplanationNormalizer,
    ExplanationValidator,
    ExplanationDiagnostics,
    ExplanationResultAdapter,
  },

  // Search Performance, Caching & Scalability Subsystem (Part 26)
  performance: {
    PerformanceAdapter,
    SearchCache,
    CacheKey,
    CacheManager,
    CandidateLimiter,
    QUALITY_MODES,
    ConcurrencyManager,
    RequestController,
    MemoryGuard,
    SearchScheduler,
    PerformanceDiagnostics,
  },

  // Search Evaluation, Benchmark Harness & Quality Telemetry Subsystem (Part 27)
  evaluation: {
    BenchmarkRunner,
    BENCHMARK_DATASET,
    BenchmarkMetrics,
    BenchmarkLatency,
    BenchmarkTelemetry,
    BenchmarkResourceUsage,
    BenchmarkReporter,
    BenchmarkSchema,
    BENCHMARK_CATEGORIES,
    RELEVANCE_LEVELS,
    BenchmarkDiagnostics,
  },

  // Search Engine Hardening, Security & Sandbox Subsystem (Part 28)
  security: {
    HardeningAdapter,
    InputValidator,
    QuerySanitizer,
    FtsGuard,
    PathGuard,
    SymlinkGuard,
    FilesystemGuard,
    IpcGuard,
    ErrorBoundary,
    ERROR_CATEGORIES,
    WorkerGuard,
    CacheIntegrityGuard,
    DatabaseRecovery,
    SecurityDiagnostics,
  },

  // Background AI Indexing Queue Subsystem (Part 12)
  indexing: {
    coordinator: defaultIndexCoordinator,
    IndexCoordinator,
    IndexQueue,
    PriorityScheduler,
    BackgroundWorker,
    WorkerPool,
    QueuePersistence,
    RetryManager,
    WorkloadEstimator,
    BackpressureController,
    createIndexTask,
    TaskType,
    TaskPriority,
    TaskState,
    ErrorClassification,
    IndexEvents,
    getIndexConfig,
    DEFAULT_INDEX_CONFIG,
    IndexQueueErrorCode,
    IndexQueueError,
  },

  // Incremental Changes Subsystem (Part 13)
  changes: {
    coordinator: defaultChangeCoordinator,
    ChangeCoordinator,
    ChangeClassifier,
    ChangeCoalescer,
    IndexInvalidator,
    ReconciliationManager,
    FileChangeAdapter,
    ChangeType,
    EventSource,
    createChangeEvent,
    getChangeConfig,
    DEFAULT_CHANGE_CONFIG,
    ChangeErrorCode,
    ChangeError,
  },

  // Indexer Subsystem (Part 4)
  indexer: {
    indexer: defaultIndexer,
    IndexManager,
    IndexSession,
    IndexWorker,
    IndexComparator,
    FileIndexStatus,
    IndexOperation,
    SessionStatus,
    IndexErrorCode,
    IndexerError,
  },
};
