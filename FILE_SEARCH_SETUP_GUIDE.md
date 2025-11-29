# File Search MVP Setup Guide

## Step 1: Get Your Google AI API Key

Since you already have Google Cloud set up for Discovery Engine, you can use the Gemini API with the same project.

### Option A: Use Existing Google Cloud Project

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"**
4. Select your existing project (`gurukul-468712`) or create a new one
5. Click **"Create API Key"**
6. Copy the API key (starts with `AIza...`)

### Option B: Use AI Studio API Key (Recommended for MVP)

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy it immediately (you won't see it again)

## Step 2: Add Environment Variables

Open your `.env.local` file and add these lines:

```bash
# Google File Search Configuration
GOOGLE_GENAI_API_KEY=your-api-key-here
FILE_SEARCH_ENABLED=true

# Optional: Keep existing vars if you want to maintain old system
```

**Important**: Replace `your-api-key-here` with your actual API key from Step 1.

## Step 3: Verify Setup

After adding the environment variables:

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Test the configuration** by visiting:
   ```
   http://localhost:3000/api/file-search/config/test
   ```

   You should see:
   ```json
   {
     "configured": true,
     "enabled": true,
     "categories": ["vedas", "upanishads", "darshanas"]
   }
   ```

## Step 4: Prepare Your PDF Documents

Create a folder structure for your documents:

```
gurukul-documents/
├── vedas/
│   ├── Rig_Veda_English.pdf
│   ├── Sama_Veda_English.pdf
│   └── ...
├── upanishads/
│   ├── Isha_Upanishad_English.pdf
│   ├── Kena_Upanishad_English.pdf
│   └── ...
└── darshanas/
    ├── Yoga_Sutras_English.pdf
    ├── Samkhya_Karika_English.pdf
    └── ...
```

**Requirements**:
- Files must be in English (or have English translations)
- PDF format preferred (also supports .txt, .docx)
- Each file should be < 100MB
- File names should be descriptive (will be used for citations)

## Step 5: Next Steps

Once you've completed steps 1-4, we'll:
1. Create the File Search stores (automated via API)
2. Upload your documents (via web UI)
3. Test queries
4. Integrate with the Spiritual Guidance tab

## Troubleshooting

### "API Key not found"
- Make sure you added `GOOGLE_GENAI_API_KEY` to `.env.local`
- Check for typos
- Restart your dev server after adding

### "File Search not enabled"
- Add `FILE_SEARCH_ENABLED=true` to `.env.local`
- Restart dev server

### "Permission denied"
- Make sure your API key is for the correct project
- Enable "Generative Language API" in Google Cloud Console

## Cost Estimate

For initial testing with 10-15 PDFs:
- **Setup cost**: $5-10 (one-time indexing)
- **Monthly cost**: $5-15 (for ~1000 queries)
- **Free tier**: First 1GB storage is free

---

**Ready to continue?** Once you've added the environment variables and restarted the server, let me know and I'll proceed with creating the upload system!



