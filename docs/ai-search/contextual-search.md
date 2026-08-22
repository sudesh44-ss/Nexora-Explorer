# Nexora AI Search — Contextual Search & Query Refinement

> **Phase**: Part 23 — Contextual Search & Query Refinement  
> **Status**: Completed & Verified  

---

## 1. Contextual Search Architecture

The **Contextual Search & Query Refinement Subsystem** enables natural, multi-turn search conversations where users can add keywords, restrict modalities, apply duration/date/size filters, or remove constraints incrementally across queries.

```text
                                INCOMING USER QUERY
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │  ContextNormalizer  │
                             │  (Action Detection) │
                             └──────────┬──────────┘
                                        │
                                        ▼
    ACTIVE SEARCH CONTEXT ──► ┌─────────────────────┐
      (Previous State)        │   ContextResolver   │
                              └──────────┬──────────┘
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │    QueryRefiner     │
                             │  (Merge & Validate) │
                             └──────────┬──────────┘
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │ContextResultAdapter │
                             └──────────┬──────────┘
                                        │
                                        ▼
                             REFINED STRUCTURED QUERY
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
              PART 18                PART 15                PART 22
          Filters/Operators    Candidate Retrieval     Multimodal Fusion
                 │                      │                      │
                 └──────────────────────┼──────────────────────┘
                                        ▼
                                     PART 17
                                  Ranking Engine
```

---

## 2. Refinement Actions & Behaviors

1. **Additive Refinement**:
   - Sequential additions (`cybersecurity` ➔ `type:video` ➔ `from 2025` ➔ `firewall`) preserve and blend query state.
2. **Modality Replacement**:
   - Querying `same but audio` replaces `video` with `audio` while retaining core subject terms.
3. **Constraint Removal**:
   - Explicit commands like `remove videos` or `remove size` purge targeted filters while keeping the rest of the query intact.
4. **Contradiction Detection**:
   - Mutually exclusive filters (e.g. `duration:>1hour` followed by `duration:<10min`) are flagged safely without engine crashes.
5. **Session History & Back Navigation (`SearchContext`)**:
   - Maintains an in-memory history stack for `popQuery()` and session resets via `clear()`.
