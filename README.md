# Gemini CV & Conversation Assistant

A web application that leverages the Gemini API to help you tailor your CV for specific job applications and practice your interview skills with a real-time voice assistant.

## Features

-   **Profile Builder**: Upload multiple documents (old CVs, project notes, LinkedIn exports) to create a comprehensive "Master Career Profile". This serves as a centralized database of your skills and experience for more accurate tailoring.
-   **CV Tailoring**: Automatically rewrites your CV to highlight the most relevant skills and experience for a given job posting. Includes strict date handling to preserve your history.
-   **Interactive Editing**: The tailored CV output is fully editable, allowing you to make manual tweaks before saving or analyzing.
-   **Cover Letter Generation**: Creates a professional and compelling cover letter based on your CV and the job description.
-   **Job Insights**: Ask Gemini free-form questions about your fit for the role, potential weak points, likely interview questions, or salary expectations.
-   **Application Q&A Helper**: A dedicated tool to generate short, natural, first-person answers for specific job application form questions (e.g., "Why do you want to work here?").
-   **CV Refinement**: Allows you to provide natural language feedback (e.g., "make the summary more concise") to iteratively improve your tailored CV.
-   **ATS Friendliness Analysis**: Scans your tailored CV against the job posting to provide a detailed Applicant Tracking System (ATS) compliance report, including keyword matching and structural feedback.
-   **Job Data Export**: Extracts key details (Position, Company, Salary, etc.) into **CSV** or **JSON** formats, or download a **ZIP** archive containing both. Designed for easy import into tools like Notion.
-   **Live Conversation**: Engage in a real-time, voice-based conversation with Gemini. Perfect for interview practice or general queries.

## How to Run/Build

To run this project locally, you'll need to have Node.js and a package manager like npm installed.

1.  **Clone the repository** (if you have access to it).

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your API Key:**
    The application requires a Gemini API key. You will need to set it up as an environment variable named `API_KEY`. Create a `.env` file in the project's root directory and add the following line:
    ```
    API_KEY=YOUR_GEMINI_API_KEY
    ```
    You can obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:5173`.

5.  **Build for production:**
    ```bash
    npm run build
    ```
    This command will generate a `dist` folder with the production-ready files.


## How to Use

### Profile Builder

1.  Navigate to the **Profile Builder** tab.
2.  Upload relevant documents (old CVs, project summaries, etc.) using the upload button.
3.  Click **Generate Master Profile** to create a consolidated markdown profile.
4.  You can edit the profile manually, clear it, or save it as a `.md` or `.json` file.
5.  This profile is automatically saved to local storage and can be quickly loaded in the CV Tailor tab.

### CV Tailor

1.  Navigate to the **CV Tailor** tab.
2.  **Input CV**: Paste your current CV, upload a file (`.pdf`, `.docx`, `.txt`), or click **Load Master** to use your Master Profile.
3.  **Input Job**: Paste a URL and click "Fetch", or paste the job description text directly.
4.  Select your desired output language.
5.  Click **Tailor My CV**. The result is editable—feel free to tweak the text directly in the box.
6.  **Job Insights**: Click the **Job Insights** button to ask questions about your fit for the role.
7.  **App Q&A**: Click **App Q&A** to generate answers for specific application form questions.
8.  **Cover Letter**: Click **Generate Cover Letter**.
9.  **ATS Check**: Click **Analyze ATS Friendliness** for a compliance report.
10. **Export**: Click **Export Job Data** to download details in CSV, JSON, or ZIP format.
11. **Save**: Use the **Save As...** dropdowns to download your CV and Cover Letter as Text or PDF.

### Live Chat

1.  Navigate to the **Live Chat** tab.
2.  Click the microphone icon to start the conversation. You will need to grant microphone permissions.
3.  Start speaking. The conversation will be transcribed in real-time.
4.  Click the stop icon to end the session.
