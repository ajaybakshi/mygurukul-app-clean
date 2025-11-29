# 🎯 START HERE - Quick Setup for Non-Coders

## ✅ Implementation Complete!

All backend code has been written for you. No coding needed from your side!

---

## 🚀 Your 5-Step Setup (60 minutes)

### Step 1: Get Your API Key (5 min)

1. Open this link: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Click **"Create API Key in new project"** (or select existing project)
5. **COPY the key** - it looks like: `AIzaSyD...` (save it somewhere safe!)

---

### Step 2: Add API Key to Your App (3 min)

1. Open your project folder in Cursor/VS Code
2. Find the file named `.env.local` (in the root folder)
3. Add these two lines at the end:
   ```
   GOOGLE_GENAI_API_KEY=AIzaSyD...your-actual-key-here
   FILE_SEARCH_ENABLED=true
   ```
   Replace `AIzaSyD...` with your actual key from Step 1

4. **Save the file**
5. Go to your terminal and **restart the server**:
   - Press `Ctrl+C` to stop
   - Type `npm run dev` and press Enter
   - Wait for "ready" message

---

### Step 3: Verify It Works (2 min)

1. Open your web browser
2. Go to: `http://localhost:3000/api/file-search/config/test`
3. You should see a page with:
   ```
   "configured": true
   "enabled": true
   "message": "✅ File Search is properly configured!"
   ```

If you see that, **you're all set!** ✅

If you see an error, double-check your API key in `.env.local` and restart the server.

---

### Step 4: Create Document Stores (3 min)

1. Go to: `http://localhost:3000/admin/file-search-upload`
2. Click the **"Create Stores"** button (big blue button on top)
3. Wait 10 seconds for confirmation
4. You should see: **"✓ Stores Created"**

**What did this do?** Created 3 categories for your documents:
- Vedas
- Upanishads  
- Darshanas (Philosophical Systems)

---

### Step 5: Upload Your Documents (30-40 min)

#### A. Prepare Your PDFs

Get English translations of sacred texts. Good sources:
- **Sacred-texts.com** (public domain translations)
- **Archive.org** (Bhagavad Gita, Upanishads, etc.)
- Your own PDF library

Start with **5-10 documents**:
- 2-3 Vedas (Rig Veda, Sama Veda)
- 2-3 Upanishads (Isha, Kena, Katha)
- 2-3 Darshanas (Yoga Sutras, Brahma Sutras)

#### B. Upload Process (Repeat for each PDF)

1. Stay on: `http://localhost:3000/admin/file-search-upload`
2. **Select the category**:
   - Click the circle next to "Vedas" (for Veda texts)
   - Or "Upanishads" (for Upanishad texts)
   - Or "Darshanas" (for philosophical texts)
3. **Select your PDF file**: Click "Choose File"
4. **Edit display name** (optional but recommended):
   - Change "Bhagavad_Gita_English" to "Bhagavad Gita - English Translation"
   - This name will show in citations
5. **Click "📤 Upload Document"**
6. **Wait** (~10-30 seconds) for green success message
7. **Repeat** for next document

**Tip**: Upload at least 2 documents before testing queries!

---

## 🧪 Test That It Works

### Option 1: Use the Test Page (Easiest)

1. Go to: `http://localhost:3000/admin/file-search-test`
2. Click **"▶ Run All Tests"**
3. Wait 30 seconds
4. You should see all green checkmarks ✅

Then try a live query:
1. Scroll down to "Live Query Test"
2. Type a question like: "What is dharma?"
3. Click **"🔍 Test Query"**
4. You should get wisdom with citations! 🎉

### Option 2: Test via API (For verification)

Open browser and go to:
```
http://localhost:3000/api/file-search/test
```

You should see test results with:
- Configuration: ✅ passed
- API Connection: ✅ passed
- Store Readiness: ✅ passed
- Sample Query: ✅ passed

---

## ✅ You're Done! What Now?

### Success Checklist

- [x] Got API key from Google AI Studio
- [x] Added key to `.env.local`
- [x] Restarted server
- [x] Configuration test passed
- [x] Created 3 stores
- [x] Uploaded 5+ documents
- [x] Test queries work with citations

### Next Steps

1. **Upload more documents** (aim for 15-20 total)
2. **Test different queries** to verify quality
3. **Integrate with your Spiritual Guidance tab** (see below)

---

## 🔌 Connecting to Your Frontend (Optional)

If you want to integrate this with your existing Spiritual Guidance tab:

### For Someone Technical (or Your Developer)

Tell them: "Replace `/api/multi-agent/wisdom` with `/api/wisdom/file-search`"

The response format is identical, so frontend code doesn't need to change!

### Simple Test Integration

If you want to test it yourself, look for the file that calls the wisdom API (probably in `src/components/` or `src/app/`).

Find a line that looks like:
```typescript
fetch('/api/multi-agent/wisdom', {
```

Change it to:
```typescript
fetch('/api/wisdom/file-search', {
```

Save and test in the Spiritual Guidance tab!

---

## 🆘 Troubleshooting

### "configured: false" error
- Check `.env.local` has `GOOGLE_GENAI_API_KEY=your-key`
- Make sure you saved the file
- Restart server (`Ctrl+C` then `npm run dev`)

### "Create Stores" button doesn't work
- Check browser console for errors (F12 → Console tab)
- Verify configuration test passes first
- Try refreshing the page

### Upload takes forever / times out
- File might be too large (max 100MB)
- Try smaller file first
- Check file is actually a PDF
- Look at terminal for error messages

### Queries return "No stores found"
- Make sure you clicked "Create Stores" in Step 4
- Visit: `http://localhost:3000/api/file-search/stores/list`
- Should see 3 stores listed

### Queries return empty/bad results
- Make sure you uploaded documents in Step 5
- Try simpler questions first: "What is dharma?"
- Upload more documents (need at least 2-3)

---

## 📞 Need More Help?

1. **Check the test page**: `/admin/file-search-test`
   - Shows exactly what's working/not working

2. **Review the detailed docs**:
   - Setup: `FILE_SEARCH_SETUP_GUIDE.md`
   - Checklist: `FILE_SEARCH_INTEGRATION_CHECKLIST.md`
   - API Details: `FILE_SEARCH_API_DOCUMENTATION.md`

3. **Check server logs**:
   - Look at your terminal where you ran `npm run dev`
   - Any red error messages? Share them for help

---

## 💡 Quick Tips

### Best PDFs to Start With
1. Bhagavad Gita (English) - Small, high value
2. Isha Upanishad (English) - Very short, great for testing
3. Yoga Sutras (English) - Popular, good citations

### Document Naming Tips
- Use clear names: "Bhagavad Gita - Swami Prabhavananda Translation"
- Include translator if known
- Avoid special characters or numbers

### Query Testing Tips
- Start simple: "What is dharma?"
- Then specific: "What does the Bhagavad Gita say about duty?"
- Test each category: Vedas, Upanishads, Darshanas

---

## 🎯 Your Goal

**Minimum Viable Product (MVP)**:
- 10 documents uploaded
- All tests passing
- 5 successful test queries
- Ready to show users!

**Time to achieve**: 60 minutes (you're almost there!)

---

## 🎉 Summary

**What You Did**:
1. ✅ Got Google AI API key
2. ✅ Added it to your app
3. ✅ Created document stores
4. ✅ Uploaded sacred texts
5. ✅ Tested queries

**What You Have**:
- A working wisdom AI system
- That costs $5-15/month (vs $200-400 before!)
- With English PDFs (easy to expand)
- Ready for users!

**What's Next**:
- Add more documents
- Test with users
- Integrate with frontend
- Launch! 🚀

---

**Ready to begin?** Start with Step 1 above! 👆

**Questions?** Check the troubleshooting section above or the detailed docs.

**You've got this!** 💪



