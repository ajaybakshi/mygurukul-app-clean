# File Search MVP Integration Checklist

## Phase 1: Environment Setup ✅

### Your Action Items:

- [ ] **Get Google AI API Key**
  - Visit: https://aistudio.google.com/app/apikey
  - Click "Create API Key"
  - Copy the key (starts with `AIza...`)

- [ ] **Update `.env.local`**
  ```bash
  # Add these two lines:
  GOOGLE_GENAI_API_KEY=your-api-key-here
  FILE_SEARCH_ENABLED=true
  ```

- [ ] **Restart Dev Server**
  ```bash
  # Stop current server (Ctrl+C)
  npm run dev
  ```

- [ ] **Verify Configuration**
  - Open: http://localhost:3000/api/file-search/config/test
  - Should see: `"configured": true, "enabled": true`

---

## Phase 2: Store Setup ✅

### Your Action Items:

- [ ] **Access Upload Interface**
  - Open: http://localhost:3000/admin/file-search-upload

- [ ] **Create File Search Stores**
  - Click "Create Stores" button
  - Wait for confirmation (~10 seconds)
  - Should see: "✓ Stores Created"

- [ ] **Verify Stores Created**
  - Open: http://localhost:3000/api/file-search/stores/list
  - Should see 3 stores listed

---

## Phase 3: Document Upload 📚

### Your Action Items:

- [ ] **Prepare Documents**
  - Gather 5-10 English PDFs of sacred texts
  - Organize by category:
    - **Vedas**: Rig Veda, Sama Veda, etc.
    - **Upanishads**: Isha, Kena, Katha, etc.
    - **Darshanas**: Yoga Sutras, Brahma Sutras, etc.
  - Ensure files are < 100MB each

- [ ] **Upload to Vedas Store**
  - Go to: http://localhost:3000/admin/file-search-upload
  - Select "Vedas" store
  - Upload 2-3 Veda PDFs
  - Wait for each upload to complete

- [ ] **Upload to Upanishads Store**
  - Select "Upanishads" store
  - Upload 2-3 Upanishad PDFs
  - Wait for completion

- [ ] **Upload to Darshanas Store**
  - Select "Darshanas" store
  - Upload 2-3 Darshana PDFs
  - Wait for completion

**Total Upload Time**: 10-30 minutes (depending on file sizes)

---

## Phase 4: Testing 🧪

### Your Action Items:

- [ ] **Run System Tests**
  - Open: http://localhost:3000/admin/file-search-test
  - Click "▶ Run All Tests"
  - Verify all tests pass (green checkmarks)

- [ ] **Test Sample Query**
  - Stay on test page
  - Try query: "What is dharma?"
  - Click "🔍 Test Query"
  - Verify you get a response with citations

- [ ] **Test Different Categories**
  - Modify test query to ask about specific texts
  - Examples:
    - "What do the Upanishads say about the self?"
    - "What are the yoga sutras about?"
    - "Explain the Vedic concept of rita"

---

## Phase 5: Frontend Integration (Optional) 🎨

### Your Action Items (if integrating with Spiritual Guidance tab):

- [ ] **Locate Current Wisdom API Call**
  - Find where your frontend calls `/api/multi-agent/wisdom`
  - Typically in `src/components/` or `src/app/` somewhere

- [ ] **Add Feature Flag** (Recommended)
  ```typescript
  // In your wisdom component
  const USE_FILE_SEARCH = true; // or use env variable

  const endpoint = USE_FILE_SEARCH 
    ? '/api/wisdom/file-search'
    : '/api/multi-agent/wisdom';
  ```

- [ ] **Test in Browser**
  - Open Spiritual Guidance tab
  - Ask a question
  - Verify response comes from File Search
  - Check citations appear correctly

- [ ] **Add Category Selector** (Optional Enhancement)
  ```typescript
  // Allow users to select category
  const [category, setCategory] = useState('all');
  
  // In API call:
  body: JSON.stringify({
    question,
    category // 'all', 'vedas', 'upanishads', or 'darshanas'
  })
  ```

---

## Validation Checklist ✅

After completing all phases, verify:

- [ ] Configuration test passes
- [ ] All 3 stores exist and have documents
- [ ] System tests all pass
- [ ] Sample queries return relevant answers
- [ ] Citations include correct source names
- [ ] Response time is < 5 seconds
- [ ] No error messages in browser console
- [ ] No error messages in terminal/server logs

---

## Cost Tracking 💰

Track your actual costs:

- **Setup Phase**:
  - [ ] Note number of documents uploaded: _____
  - [ ] Estimated indexing cost: $______

- **Testing Phase**:
  - [ ] Number of test queries: _____
  - [ ] Estimated query cost: $______

- **Expected Monthly** (estimate):
  - Expected queries per month: _____
  - Estimated monthly cost: $______

**Goal**: Stay under $15/month for MVP phase

---

## Troubleshooting Reference

### If Configuration Test Fails:
1. Check `.env.local` has correct API key
2. Verify `FILE_SEARCH_ENABLED=true`
3. Restart dev server
4. Try visiting the endpoint directly in browser

### If Store Creation Fails:
1. Check API key has correct permissions
2. Verify Google AI Studio project is active
3. Check server console for error details
4. Try creating stores one at a time via POST endpoint

### If Upload Times Out:
1. Try smaller files first (< 10MB)
2. Check file is valid PDF
3. Operation may still complete in background
4. Refresh stores list to verify

### If Queries Return No Results:
1. Verify documents are uploaded (check stores list)
2. Try simpler questions first
3. Specify exact category instead of 'all'
4. Check question is related to uploaded texts

---

## Success Metrics 🎯

You're ready to launch when:

- ✅ 10+ documents uploaded across 3 categories
- ✅ All system tests passing
- ✅ Query response time < 5 seconds
- ✅ Citations appearing correctly
- ✅ No errors in testing
- ✅ Cost < $10 for setup

---

## Next Steps After Validation

Once everything works:

1. **Gather More Documents**
   - Expand to 20-30 PDFs
   - Cover more texts in each category

2. **User Testing**
   - Share with 5-10 beta testers
   - Gather feedback on response quality

3. **Monitor Costs**
   - Track actual monthly expenses
   - Optimize if exceeding budget

4. **Plan Phase 2**
   - Consider adding Sanskrit precision later
   - Based on user demand and revenue

---

## Timeline Estimate

- **Phase 1 (Setup)**: 10 minutes
- **Phase 2 (Stores)**: 5 minutes  
- **Phase 3 (Upload)**: 20-30 minutes
- **Phase 4 (Testing)**: 10 minutes
- **Phase 5 (Integration)**: 15 minutes (optional)

**Total**: 60-70 minutes to production-ready MVP! 🚀

---

## Support Contacts

**Technical Issues**:
- Check: `/admin/file-search-test`
- Review: `FILE_SEARCH_API_DOCUMENTATION.md`

**Setup Questions**:
- Follow: `FILE_SEARCH_SETUP_GUIDE.md`

**API Reference**:
- See: `FILE_SEARCH_API_DOCUMENTATION.md`

---

**Ready to Start?** ✅

Begin with Phase 1: Environment Setup above!



