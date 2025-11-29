# Infinite Loop Fix - Search Score Calculation

## Problem Identified

The ChapterCard component had an infinite re-render loop caused by the `onScoreCalculated` callback in the useEffect dependencies.

### Root Cause

```typescript
// BEFORE (Problematic code)
useEffect(() => {
  if (searchActive && fullMetadata) {
    const score = calculateSearchScore(chapter, section, fullMetadata, searchQuery);
    setSearchScore(score);
    onScoreCalculated(score); // ← Triggers parent re-render
  } else {
    setSearchScore(0);
    onScoreCalculated(0);
  }
}, [searchActive, searchQuery, fullMetadata, chapter, section, onScoreCalculated]);
//                                                                ↑ Problem: This function is recreated on every parent render
```

**The Cycle:**
1. ChapterCard renders, useEffect runs
2. `onScoreCalculated(score)` is called
3. SectionAccordion updates its state (chapterScores Map)
4. SectionAccordion re-renders
5. ChapterCard receives new `onScoreCalculated` function reference
6. useEffect dependency changes, runs again
7. GOTO step 2 → **Infinite loop!**

## Solution Implemented

### Fix using useRef to track last reported score

```typescript
// AFTER (Fixed code)
const lastReportedScoreRef = useRef<number>(-1);

useEffect(() => {
  let newScore = 0;
  
  if (searchActive && fullMetadata) {
    newScore = calculateSearchScore(chapter, section, fullMetadata, searchQuery);
  }
  
  setSearchScore(newScore);
  
  // Only call onScoreCalculated if the score actually changed
  // Don't include onScoreCalculated in dependencies to avoid infinite loop
  if (lastReportedScoreRef.current !== newScore) {
    lastReportedScoreRef.current = newScore;
    onScoreCalculated(newScore);
  }
}, [searchActive, searchQuery, fullMetadata, chapter.chapterNumber, section.sectionId]);
//  ↑ Removed: onScoreCalculated, chapter (full object), section (full object)
//  ↑ Added: chapter.chapterNumber, section.sectionId (stable primitives)
```

### Key Changes

1. **Added `useRef` to track last reported score**
   ```typescript
   const lastReportedScoreRef = useRef<number>(-1);
   ```
   - Initialized to -1 (impossible score value)
   - Persists across re-renders without triggering them
   - Allows us to detect actual score changes

2. **Removed problematic dependencies**
   - ❌ Removed `onScoreCalculated` from dependency array
   - ❌ Removed `chapter` (full object - changes on every render)
   - ❌ Removed `section` (full object - changes on every render)

3. **Added stable primitive dependencies**
   - ✅ Added `chapter.chapterNumber` (primitive, won't change)
   - ✅ Added `section.sectionId` (primitive, won't change)

4. **Conditional callback invocation**
   ```typescript
   if (lastReportedScoreRef.current !== newScore) {
     lastReportedScoreRef.current = newScore;
     onScoreCalculated(newScore);
   }
   ```
   - Only calls callback when score actually changes
   - Prevents redundant parent state updates
   - Breaks the infinite loop cycle

## Why This Works

### useRef Benefits
- **Doesn't trigger re-renders** when updated
- **Persists across renders** unlike variables
- **Provides stable reference** for comparison
- **Perfect for tracking previous values**

### Primitive Dependencies
- `chapter.chapterNumber` is a number (primitive)
- `section.sectionId` is a string (primitive)
- Primitives have stable references
- Won't change unless the actual chapter/section changes
- More reliable than full object dependencies

### Conditional Callback
- Checks if score actually changed before calling parent
- Prevents unnecessary parent state updates
- Breaks the re-render cycle
- Maintains accurate score tracking

## Testing

### Verify the fix works:
1. ✅ Open chapter browser
2. ✅ Type in search box
3. ✅ Confirm no console errors
4. ✅ Confirm no browser freezing
5. ✅ Confirm search results appear correctly
6. ✅ Confirm star ratings update properly
7. ✅ Confirm result counts are accurate

### Expected Behavior:
- Search should be smooth and responsive
- No infinite re-renders
- Console should show normal fetch logs only
- Browser should not freeze or lag
- Scores should update correctly when query changes

## Alternative Solutions Considered

### Option 1: useCallback in Parent
```typescript
// In SectionAccordion
const onScoreCalculated = useCallback((score) => {
  setChapterScores((prev) => {
    const newMap = new Map(prev);
    newMap.set(chapter.chapterId, score);
    return newMap;
  });
}, [chapter.chapterId]); // Still requires careful dependency management
```
**Rejected because:** Requires changes in parent component and still fragile

### Option 2: Remove Callback Pattern Entirely
```typescript
// ChapterCard just stores score in state
// SectionAccordion reads from rendered cards
```
**Rejected because:** More complex refactoring, harder to maintain

### Option 3: Move All Score Calculation to Parent
```typescript
// SectionAccordion fetches all metadata and calculates scores
// ChapterCard just displays
```
**Rejected because:** Requires major refactoring, metadata already being fetched in ChapterCard

## Conclusion

The **useRef solution** is:
- ✅ Minimal code changes
- ✅ Easy to understand
- ✅ Proven pattern for preventing infinite loops
- ✅ Maintains existing architecture
- ✅ TypeScript safe
- ✅ No performance degradation

The infinite loop is now fixed and search functionality works smoothly! 🎉

