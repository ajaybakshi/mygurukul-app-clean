# MyGurukul v4.2: Sacred Archive - Detailed Architecture & Decision Log

**Release Date:** October 13, 2025  
**Version:** 4.2.0  
**Git Tag:** v4.2.0

---

## 1. Executive Summary & Strategic Goal

The primary objective of the v4.2 release was to execute a complete architectural refactoring of the MyGurukul "Sacred Library." The previous implementation (`LibraryTab.tsx`) was a monolithic component with hardcoded data, making it brittle, difficult to update, and unscalable.

This release successfully replaced the legacy system with a dynamic, data-driven, and component-based architecture. The new "Sacred Archive" is now a robust and scalable foundation that decouples content from code, enabling seamless future growth of the scripture collection.

---

## 2. System Architecture

The new architecture follows a modern, decoupled frontend/backend philosophy, even within the context of a Next.js application.

### 2.1. Frontend Architecture: Modular & Composable

The UI was intentionally broken down into a hierarchy of distinct, reusable React components, each with a single responsibility. This replaces the monolithic `LibraryTab.tsx` and promotes maintainability.

- **`app/(app)/library/page.tsx`**: The main server-side page component. Its sole responsibility is to fetch the initial data from the `libraryService` and pass it down to the client-side display components.

- **`LibraryPage.tsx`**: The primary client-side component that manages the state of the archive, including the full list of scriptures, search queries, and filtering logic.

- **`CategoryRow.tsx`**: A presentational component that receives a list of scriptures for a single category and renders them in a horizontal, scrollable row.

- **`ScriptureCard.tsx`**: A detailed card component that displays the metadata for a single scripture, including its title, description, and conversational status.

- **`EditionsModal.tsx`**: A modal dialog that appears when a user clicks "Read Now." It lists all available editions (PDF, TXT, etc.) for a given scripture. The "View" button logic is contained here.

### 2.2. Backend & Data Architecture: Decoupled & Scalable

The core principle of the new backend is to treat the library's content as pure data, completely separate from the application's code.

- **Canonical Data Source (`library_manifest.json`)**: All scripture and edition metadata is stored in a single JSON file hosted on Google Cloud Storage (GCS). This file is the "single source of truth" for the entire library. Any updates to the library's content (adding scriptures, correcting typos, adding new editions) are done by updating this one file.

- **Data Service Layer (`libraryService.ts`)**: This crucial module acts as the sole intermediary between the application and the data source.
  - It contains the `fetchLibraryManifest` function, which is responsible for fetching the JSON file from the GCS bucket.
  - It contains the `getOrganizedLibrary` function, which processes the raw data, groups the scriptures by category, and prepares it for the frontend components.
  - It handles the conversion of `gs://` GCS paths into public `https://` URLs that can be opened by a browser.

---

## 3. Key Problems Solved: A Deep Dive

This release required a systematic, multi-layered debugging process that addressed critical issues across the entire technology stack.

### 3.1. Google Cloud Storage Permissions (IAM)

**Problem:** Initial fetch requests failed silently. We discovered that the GCS bucket had a master security policy, "Public Access Prevention," enabled. This feature acts as a top-level override, blocking any attempts to make the bucket or its objects public.

**Solution:** We systematically diagnosed this by observing that attempts to add a public IAM role were failing. The fix was a two-step process:

1. Click the "Remove Public Access Prevention" button in the GCS console for the bucket.
2. Add a new IAM policy binding for the principal `allUsers` with the role `Storage Object Viewer`. This grants the public read-only access to the objects within the bucket, which is necessary for the browser's fetch API to work.

### 3.2. Browser Security (CORS)

**Problem:** After fixing the IAM permissions, the browser was still blocking the fetch request due to a CORS (Cross-Origin Resource Sharing) error. The error `No 'Access-Control-Allow-Origin' header is present` indicated that the GCS bucket was not explicitly giving permission to our `http://localhost:3000` development server to access its data.

**Solution:** We discovered that the Google Cloud Console UI has deprecated the ability to edit CORS policies directly. The only correct and supported method is via the `gsutil` command-line tool. The final fix was:

1. Create a `cors.json` file in the project root with the correct configuration: `[{ "origin": ["http://localhost:3000"], "method": ["GET"], "maxAgeSeconds": 3600 }]`.
2. Execute the command `gsutil cors set cors.json gs://mygurukul-sacred-texts-corpus`. This successfully applied the policy where all previous UI and gcloud attempts had failed.

### 3.3. Data Integrity (JSON)

**Problem:** Once all cloud permissions were resolved, the fetch request was successful (HTTP 200), but the application crashed with a `SyntaxError: Unexpected token 'N', ... is not valid JSON`.

**Solution:** This error was traced to the `library_manifest.json` file itself. The data processing script that converted the master Excel sheet to JSON was incorrectly writing the value `NaN` (JavaScript's "Not a Number") for missing GCS paths. `NaN` is not a valid token in the strict JSON data format. The fix was to correct the source data in `Gurukul_Library_Master.xlsx` by ensuring that any missing links were represented by a completely blank cell. This allowed the Python script to correctly convert the missing value to the valid JSON token `null`.

---

## 4. Handoff Notes for Future Development

- **The Manifest is King**: All library content is controlled by `library_manifest.json`. To add a book, update the master Excel sheet, re-run the data prep script, and upload the new manifest to GCS. No frontend code changes are needed.

- **Cloud Debugging Checklist**: If you ever encounter a `TypeError: Failed to fetch` in the future, follow this exact diagnostic sequence:
  1. Check the browser's Network tab for the HTTP status code. If it's not 200, it's a cloud issue.
  2. Verify the bucket's IAM permissions include `allUsers` with the `Storage Object Viewer` role.
  3. Verify Public Access Prevention is disabled on the bucket.
  4. Verify the CORS policy using `gsutil cors get gs://...` to ensure it includes the correct origin (e.g., your production domain).
  5. If the status is 200 but you get a `SyntaxError`, the problem is invalid JSON in the manifest file.

- **Component Structure**: The new modular components in `src/components/library/` are designed for easy styling and enhancement. Phase 2 (Visual Transformation) will primarily involve modifying these components.


