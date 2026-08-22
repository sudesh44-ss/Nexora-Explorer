# Nexora AI Search — Advanced Search Suggestions & Query Intelligence UI

> **Phase**: Part 24 — Advanced Search Suggestions & Autocomplete  
> **Status**: Completed & Verified  

---

## 1. Search Suggestions Architecture

The **Search Suggestions & Autocomplete Subsystem** provides real-time, low-latency keystroke completions across indexed vocabulary, operators & filters, active conversation context refinements, search history, and fuzzy typo corrections.

```text
                                SEARCH INPUT KEYSTROKE
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │   SuggestionEngine   │
                               └──────────┬───────────┘
                                          │
       ┌──────────────┬───────────────────┼───────────────────┬──────────────┐
       ▼              ▼                   ▼                   ▼              ▼
   Operators       Context             History            Vocabulary     Corrections
 (type:, dur:)  (Part 23 active)   (Recent searches)   (Indexed terms)  (Did you mean)
       │              │                   │                   │              │
       └──────────────┴───────────────────┼───────────────────┴──────────────┘
                                          ▼
                               ┌──────────────────────┐
                               │ SuggestionNormalizer │
                               │    (Deduplication)   │
                               └──────────┬───────────┘
                                          ▼
                               ┌──────────────────────┐
                               │   SuggestionRanker   │
                               │  (Prefix/Exact Score)│
                               └──────────┬───────────┘
                                          ▼
                               ┌──────────────────────┐
                               │SuggestionResultAdapter│
                               └──────────┬───────────┘
                                          ▼
                                UI SUGGESTION DROPDOWN
```

---

## 2. Suggestion Sources

1. **Operator & Filter Completion (`SuggestionSources.getOperatorSuggestions`)**:
   - Matches operator prefixes (`dur` ➔ `duration:`, `typ` ➔ `type:`) and values (`type:image`, `type:video`, `type:audio`, `duration:>30min`, `size:>100MB`).
2. **Context-Aware Refinements (`SuggestionSources.getContextSuggestions`)**:
   - Suggests conversation continuations when in active search session (`only short ones`, `only recent ones`, `also show PDFs`).
3. **Recent Search History (`SuggestionSources.getHistorySuggestions`)**:
   - Matches recent local search queries without cloud transmission.
4. **Typo / Fuzzy Corrections (`SuggestionSources.getTypoCorrections`)**:
   - Offers "Did you mean?" suggestions using Levenshtein distance (`cybersecurty` ➔ `cybersecurity`).
5. **Debouncing & Cancellation (`SuggestionEngine`)**:
   - Superseded keystroke requests are discarded safely to prevent stale suggestions from rendering.
