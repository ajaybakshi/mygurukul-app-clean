# Manual File Search Store Setup Guide

**For Non-Coders: Simple Step-by-Step Instructions**

This guide will help you create 3 File Search stores (Vedas, Upanishads, Darshanas) using Google AI Studio. You only need to do this **once**.

---

## What You'll Create

You'll create 3 "stores" (think of them as folders) where you can upload PDF documents:
1. **Vedas Store** - For Vedic texts (Rig Veda, Sama Veda, etc.)
2. **Upanishads Store** - For Upanishadic texts (Katha, Isha, Brihadaranyaka, etc.)
3. **Darshanas Store** - For philosophical texts (Yoga Sutras, Nyaya, etc.)

Each store can hold **many PDF documents**. Later, you'll upload individual scripture PDFs to the appropriate store.

---

## Prerequisites

✅ You have your Google API Key (from `.env.local` file as `GOOGLE_GENAI_API_KEY`)
✅ Your browser is open and you're logged into your Google account

---

## Step-by-Step Instructions

### Step 1: Open Google AI Studio

1. Open your web browser
2. Go to: **https://aistudio.google.com**
3. Log in with the same Google account you used to create your API key
4. You should see the main dashboard

### Step 2: Navigate to File Search Stores

**Option A - Using the Python/REST API (Recommended):**

Since File Search stores might not be directly accessible in the UI yet, we'll use a simple curl command in your terminal:

#### For Store 1: Vedas

1. Open your terminal (the one where you run `npm run dev`)
2. Copy and paste this command (replace `YOUR_API_KEY` with your actual API key from `.env.local`):

```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=AIzaSyA3tdCC2ancoCSKQYlTEPY0DVmqoU_FME8" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Vedas - MyGurukul Sacred Library"
  }'
```

3. Press Enter
4. You should see a response like:
```json
{
  "name": "fileSearchStores/abc123xyz",
  "displayName": "Vedas - MyGurukul Sacred Library",
  "createTime": "2024-11-13T..."
}
```

5. **IMPORTANT:** Copy the `name` field value (e.g., `fileSearchStores/abc123xyz`)
   - This is your **Vedas Store ID**
   - Save it in a text file for now

#### For Store 2: Upanishads

Run this command (replace `YOUR_API_KEY`):

```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Upanishads - MyGurukul Sacred Library"
  }'
```

- Copy the `name` field value
- Save it as your **Upanishads Store ID**

#### For Store 3: Darshanas

Run this command (replace `YOUR_API_KEY`):

```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Darshanas - MyGurukul Sacred Library"
  }'
```

- Copy the `name` field value
- Save it as your **Darshanas Store ID**

---

### Step 3: Verify Your Stores Were Created

Run this command to list all your stores:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=YOUR_API_KEY"
```

You should see all 3 stores listed with their details.

---

### Step 4: Add Store IDs to Your App (Optional but Recommended)

You can add the store IDs to your `.env.local` file so the app knows exactly which stores to use:

1. Open your `.env.local` file
2. Add these lines at the end (replace with your actual store names):

```bash
# File Search Store IDs (optional - for faster lookups)
FILE_SEARCH_VEDAS_STORE=fileSearchStores/your-vedas-id
FILE_SEARCH_UPANISHADS_STORE=fileSearchStores/your-upanishads-id
FILE_SEARCH_DARSHANAS_STORE=fileSearchStores/your-darshanas-id
```

3. Save the file
4. Restart your dev server (`Ctrl+C` then `npm run dev`)

**Note:** This step is optional. The app will automatically discover your stores by their display names if you don't add these IDs.

---

## What's Next?

✅ **Done!** Your 3 stores are now created.

**Next steps:**
1. Go to: `http://localhost:3000/admin/file-search-upload`
2. You should see your 3 stores listed
3. Start uploading PDF documents to each store
4. You can upload multiple PDFs to the same store (e.g., all 11 Upanishads go into the "Upanishads" store)

---

## Troubleshooting

### "Permission denied" or "API key not valid"
- Check that you copied your API key correctly from `.env.local`
- Make sure the API key has File Search enabled in your Google Cloud project

### "Store already exists"
- If you see an error that the store already exists, that's fine!
- Just list your stores (Step 3) to get the store IDs
- Skip creating that particular store

### "Command not found: curl"
- On Windows, you might need to use PowerShell or install curl
- Alternatively, wait for the app's automatic store creation feature to be fixed

### Still having issues?
1. Check the terminal logs for detailed error messages
2. Verify your `GOOGLE_GENAI_API_KEY` is set correctly in `.env.local`
3. Try visiting Google AI Studio directly to check if File Search is available in your region

---

## For Future Reference

**You only need to create stores ONCE.** After this:
- Upload as many PDFs as you want to each store
- The app will search across all documents in all stores automatically
- Each PDF becomes a searchable scripture in your knowledge base

**Remember:**
- One PDF = One scripture (e.g., `Katha_Upanishad.pdf`)
- Multiple PDFs can go in the same store (all Upanishads in "Upanishads" store)
- When users ask questions, the app searches ALL documents across ALL stores



