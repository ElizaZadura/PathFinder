
# Latest Changes

## 🚀 Update: Precision & Reliability

### Profile Builder: Strict Mode
- **No Hallucinations**: When fetching content from URLs (like GitHub repositories) for your Master Profile, the AI is now explicitly instructed to **only** list technologies found in the source text. It will no longer infer related frameworks (e.g., adding Redux just because React is present) unless they are explicitly mentioned.

### Settings & Configuration
- **Credential Sanitization**: The settings input fields now automatically strip invisible non-ASCII characters and whitespace from API keys and URLs. This fixes common "Invalid Header" errors caused by copy-pasting from certain sources.

### UI Improvements
- **Profile Cloud Sync**: The "Load from Cloud" button in the Profile Builder is now always accessible when Supabase is configured, making it easier to switch contexts or restore a profile even if a local one is currently loaded.

---

## Previous Update: Cloud Database & Smart Tools

### Supabase Cloud Integration
- **Cloud Sync**: Connect to a **Supabase** backend to sync your **Master Career Profile** across devices.
- **Application Database**: Added a "Save to Database" option in the Export menu. This logs specific job applications (Company, Position, Salary, Status, CV text, etc.) directly to a `job_applications` table.
- **Settings Panel**: New configuration modal (top-right gear icon) to manage API keys and database connections.

### Smart Job Fetching
- **Arbetsförmedlingen API**: Specific support for `arbetsformedlingen.se` URLs. The app now detects these links and queries their public API directly for clean, structured job descriptions, bypassing complex HTML scraping.
- **Enhanced Fallback**: Improved generic URL extraction for other job boards using Gemini 2.5 Pro.

### New AI Capabilities
- **Job Insights Panel**: Ask Gemini free-form questions about the role (e.g., "What are my weak points?", "Likely interview questions?").
- **App Q&A Helper**: Generate short, punchy answers for specific application form questions (e.g., "Describe a challenge you overcame").
- **Cover Letter Refinement**: Added the ability to refine generated cover letters with natural language commands, matching the CV refinement capability.

### UI & Quality of Life
- **Unified Export Menu**: Consolidated CSV, JSON, ZIP, and Database actions into a single dropdown.
- **Toast Notifications**: Added smooth feedback popups for actions like copying text or saving data.
