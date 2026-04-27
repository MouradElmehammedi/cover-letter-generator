import "./style.css";
import { generateCoverLetter, generateEmail, generateAnalysis } from "./api.js";
import { exportToDocx } from "./docx-export.js";
import { exportToPdf } from "./pdf-export.js";

// ── Storage ──
const STORAGE_KEY = "clg_profiles";

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveProfiles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function getProfileName(data) {
  // Show the headline/title only (e.g. "Frontend Developer — React/Next.js")
  const headline = data.basics?.label || data.basics?.headline || data.headline || data.title || data.personalInfo?.headline || "";
  return headline || "Unnamed Profile";
}

// ── State ──
let profiles = loadProfiles();
let selectedProfileId = profiles.length > 0 ? profiles[0].id : null;

// ── Render ──
document.querySelector("#app").innerHTML = `
<div class="min-h-screen">
  <!-- Header -->
  <header class="border-b border-gray-200 bg-white sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-6 min-w-0">
        <div class="flex items-center gap-3 shrink-0">
          <img src="/logo.jpg" alt="Logo" class="w-8 h-8 rounded object-cover" />
          <h1 class="text-lg font-semibold text-gray-900 whitespace-nowrap">AI Job Assistant</h1>
        </div>
        <nav class="tab-nav shrink-0">
          <button id="tab-generator" class="tab-btn tab-active" onclick="switchToGeneratorTab()">Generator</button>
          <button id="tab-jobs" class="tab-btn" onclick="switchToJobsTab()">Find Jobs</button>
        </nav>
      </div>

      <div class="flex items-center gap-2 min-w-0">
        <div id="profile-selector" class="profile-selector shrink-0">
          <button id="profile-trigger" type="button" class="profile-trigger profile-trigger-compact" data-selected-id="" aria-haspopup="listbox" aria-expanded="false">
            <div class="profile-avatar profile-avatar-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <span id="profile-selected-name" class="text-sm font-medium text-gray-900 truncate max-w-[200px]">No profile yet</span>
            <svg class="profile-chevron w-4 h-4 text-gray-400 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <div id="profile-menu" class="profile-menu hidden" role="listbox"></div>
        </div>

        <button id="add-profile-btn" class="btn-secondary flex items-center gap-1.5 text-sm shrink-0" title="Upload JSON resume">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <input type="file" id="file-input" multiple accept=".json" class="hidden" />
      </div>
    </div>
  </header>

  <!-- Drop zone overlay (appears on page-level drag) -->
  <div id="drop-zone" class="drop-zone-overlay hidden">
    <div class="drop-zone-inner">
      <svg class="w-12 h-12 mx-auto text-indigo-400 mb-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
      </svg>
      <p class="text-lg font-semibold text-gray-800">Drop JSON resume files here</p>
      <p class="text-sm text-gray-500 mt-1">They'll be added to your profiles</p>
    </div>
  </div>

  <main id="generator-view" class="max-w-7xl mx-auto px-6 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      <!-- LEFT: Form -->
      <div class="space-y-6">


        <!-- Job Description -->
        <section class="card">
          <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Job Description</h2>
          <textarea
            id="job-description"
            rows="8"
            placeholder="Paste the job description here..."
            class="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400
                   focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none resize-y"
          ></textarea>
        </section>

        <!-- Actions -->
        <section class="card space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <select id="language" class="h-11 rounded-lg border border-gray-200 px-4 text-sm text-gray-800
                                          focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none bg-white">
              <option value="English">English</option>
              <option value="French">French</option>
              <option value="Arabic">Arabic</option>
              <option value="Spanish">Spanish</option>
              <option value="German">German</option>
            </select>
            <select id="tone" class="h-11 rounded-lg border border-gray-200 px-4 text-sm text-gray-800
                                      focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none bg-white">
              <option value="professional">Professional</option>
              <option value="formal">Formal</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </div>
          <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-3">
            <button id="generate-btn" class="h-11 btn-primary flex items-center gap-2 justify-center text-sm whitespace-nowrap">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              <span id="generate-text">Cover Letter</span>
              <svg id="spinner" class="hidden w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </button>
            <button id="generate-email-btn" class="h-11 btn-primary flex items-center gap-2 justify-center text-sm whitespace-nowrap">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span id="generate-email-text">Email</span>
              <svg id="email-spinner" class="hidden w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </button>
            <button id="generate-analyze-btn" class="h-11 btn-primary flex items-center gap-2 justify-center text-sm whitespace-nowrap">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
              <span id="generate-analyze-text">Analyze</span>
              <svg id="analyze-spinner" class="hidden w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </button>
            <button id="clear-btn" class="h-11 w-11 btn-secondary flex items-center justify-center text-red-500 hover:text-red-700 hover:border-red-200 px-0!" title="Clear all">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </section>

        <!-- Error -->
        <div id="error-banner" class="hidden rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"></div>

      </div>

      <!-- RIGHT: Output -->
      <div class="space-y-6">
        <section id="output-section" class="card hidden">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Generated Cover Letter</h2>
            <div class="flex gap-2">
              <button id="copy-btn" class="btn-secondary flex items-center gap-1.5 text-sm" title="Copy to clipboard">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                Copy
              </button>
              <button id="export-btn" class="btn-secondary flex items-center gap-1.5 text-sm" title="Export as DOCX">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export DOCX
              </button>
              <button id="export-pdf-btn" class="btn-secondary flex items-center gap-1.5 text-sm" title="Export as PDF">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export PDF
              </button>
            </div>
          </div>
          <textarea
            id="output-text"
            rows="24"
            class="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800
                   focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none resize-y"
          ></textarea>
          <p id="provider-tag" class="mt-2 text-xs text-gray-400"></p>
        </section>

        <div id="output-placeholder" class="card flex flex-col items-center justify-center py-16 text-gray-300">
          <svg class="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p class="text-sm font-medium">Your cover letter will appear here</p>
          <p class="text-xs mt-1">Select a profile, paste a job description, and generate</p>
        </div>

        <!-- Email output -->
        <section id="email-section" class="card hidden">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Application Email</h2>
            <div class="flex gap-2">
              <button id="email-copy-btn" class="btn-secondary flex items-center gap-1.5 text-sm" title="Copy to clipboard">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                Copy
              </button>
              <button id="email-export-btn" class="btn-secondary flex items-center gap-1.5 text-sm" title="Export as DOCX">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export DOCX
              </button>
              <button id="email-export-pdf-btn" class="btn-secondary flex items-center gap-1.5 text-sm" title="Export as PDF">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export PDF
              </button>
            </div>
          </div>
          <textarea
            id="email-text"
            rows="14"
            class="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800
                   focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none resize-y"
          ></textarea>
          <p id="email-provider-tag" class="mt-2 text-xs text-gray-400"></p>
        </section>

        <div id="email-placeholder" class="card flex flex-col items-center justify-center py-12 text-gray-300">
          <svg class="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <p class="text-sm font-medium">Your application email will appear here</p>
          <p class="text-xs mt-1">Click "Email" to generate a short HR-friendly email</p>
        </div>

        <!-- Analysis output -->
        <section id="analyze-section" class="card hidden">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Profile / Job Fit Analysis</h2>
            <p id="analyze-provider-tag" class="text-xs text-gray-400"></p>
          </div>
          <div id="analyze-content"></div>
        </section>

        <div id="analyze-placeholder" class="card flex flex-col items-center justify-center py-12 text-gray-300">
          <svg class="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
          <p class="text-sm font-medium">Profile / job fit analysis will appear here</p>
          <p class="text-xs mt-1">Click "Analyze" for an honest match breakdown</p>
        </div>
      </div>

    </div>
  </main>

  <footer class="border-t border-gray-100 mt-12">
    <div class="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-gray-400">
      AI Job Assistant &mdash; Your data stays in your browser
    </div>
  </footer>
</div>
`;

// ── DOM refs ──
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const addProfileBtn = document.getElementById("add-profile-btn");
const profileSelector = document.getElementById("profile-selector");
const profileTrigger = document.getElementById("profile-trigger");
const profileSelectedName = document.getElementById("profile-selected-name");
const profileMenu = document.getElementById("profile-menu");
const jobDesc = document.getElementById("job-description");
const langSelect = document.getElementById("language");
const toneSelect = document.getElementById("tone");
const generateBtn = document.getElementById("generate-btn");
const generateText = document.getElementById("generate-text");
const spinner = document.getElementById("spinner");
const errorBanner = document.getElementById("error-banner");
const outputSection = document.getElementById("output-section");
const outputText = document.getElementById("output-text");
const providerTag = document.getElementById("provider-tag");
const copyBtn = document.getElementById("copy-btn");
const exportBtn = document.getElementById("export-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const clearBtn = document.getElementById("clear-btn");
const outputPlaceholder = document.getElementById("output-placeholder");
const generateEmailBtn = document.getElementById("generate-email-btn");
const generateEmailText = document.getElementById("generate-email-text");
const emailSpinner = document.getElementById("email-spinner");
const emailSection = document.getElementById("email-section");
const emailText = document.getElementById("email-text");
const emailProviderTag = document.getElementById("email-provider-tag");
const emailCopyBtn = document.getElementById("email-copy-btn");
const emailExportBtn = document.getElementById("email-export-btn");
const emailExportPdfBtn = document.getElementById("email-export-pdf-btn");
const emailPlaceholder = document.getElementById("email-placeholder");
const generateAnalyzeBtn = document.getElementById("generate-analyze-btn");
const generateAnalyzeText = document.getElementById("generate-analyze-text");
const analyzeSpinner = document.getElementById("analyze-spinner");
const analyzeSection = document.getElementById("analyze-section");
const analyzeContent = document.getElementById("analyze-content");
const analyzeProviderTag = document.getElementById("analyze-provider-tag");
const analyzePlaceholder = document.getElementById("analyze-placeholder");

// ── File upload ──
addProfileBtn.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});

// Show drop zone overlay on page-level drag
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.remove("hidden");
  dropZone.classList.add("dragover");
});
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
    dropZone.classList.add("hidden");
    dropZone.classList.remove("dragover");
  }
});
document.addEventListener("drop", () => {
  dropZone.classList.add("hidden");
  dropZone.classList.remove("dragover");
});

function handleFiles(files) {
  for (const file of files) {
    if (!file.name.endsWith(".json")) {
      showError(`"${file.name}" is not a JSON file.`);
      continue;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const id = crypto.randomUUID();
        const displayName = getProfileName(data);
        profiles.push({ id, displayName, data });
        saveProfiles();
        if (profiles.length === 1) selectedProfileId = id;
        renderProfiles();
        hideError();
      } catch {
        showError(`"${file.name}" contains invalid JSON.`);
      }
    };
    reader.readAsText(file);
  }
}

function closeProfileMenu() {
  profileMenu.classList.add("hidden");
  profileTrigger.setAttribute("aria-expanded", "false");
}

function openProfileMenu() {
  profileMenu.classList.remove("hidden");
  profileTrigger.setAttribute("aria-expanded", "true");
}

function renderProfiles() {
  if (profiles.length === 0) {
    closeProfileMenu();
    profileTrigger.dataset.selectedId = "";
    profileTrigger.classList.add("profile-trigger-empty");
    profileSelectedName.textContent = "No profile yet";
    profileMenu.innerHTML = "";
    return;
  }

  profileTrigger.classList.remove("profile-trigger-empty");

  // Ensure the selected profile still exists
  if (!profiles.find((p) => p.id === selectedProfileId)) {
    selectedProfileId = profiles[0].id;
  }
  const active = profiles.find((p) => p.id === selectedProfileId);
  profileTrigger.dataset.selectedId = active.id;
  profileSelectedName.textContent = getProfileName(active.data);

  profileMenu.innerHTML = profiles
    .map((p) => {
      const isSelected = p.id === selectedProfileId;
      return `
      <div class="profile-menu-item ${isSelected ? "profile-menu-item-selected" : ""}" role="option" aria-selected="${isSelected}" data-select="${p.id}" tabindex="0">
        <div class="profile-avatar profile-avatar-sm">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <span class="flex-1 text-sm font-medium text-gray-900 truncate">${escapeHtml(getProfileName(p.data))}</span>
        ${isSelected ? `
          <svg class="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>` : ""}
        <button type="button" class="profile-remove" data-remove="${p.id}" title="Remove profile" aria-label="Remove profile">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>`;
    })
    .join("");
}

// Toggle menu
profileTrigger.addEventListener("click", () => {
  if (profileMenu.classList.contains("hidden")) openProfileMenu();
  else closeProfileMenu();
});

// Close on outside click
document.addEventListener("click", (e) => {
  if (!profileSelector.contains(e.target)) closeProfileMenu();
});

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeProfileMenu();
});

// Delegate menu item actions
profileMenu.addEventListener("click", (e) => {
  const removeBtn = e.target.closest("[data-remove]");
  if (removeBtn) {
    e.stopPropagation();
    const id = removeBtn.dataset.remove;
    profiles = profiles.filter((p) => p.id !== id);
    saveProfiles();
    if (selectedProfileId === id) {
      selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
    }
    renderProfiles();
    return;
  }

  const item = e.target.closest("[data-select]");
  if (item) {
    selectedProfileId = item.dataset.select;
    renderProfiles();
    closeProfileMenu();
  }
});

// Keyboard selection on menu items
profileMenu.addEventListener("keydown", (e) => {
  const item = e.target.closest("[data-select]");
  if (item && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    selectedProfileId = item.dataset.select;
    renderProfiles();
    closeProfileMenu();
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Error display ──
function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove("hidden");
}
function hideError() {
  errorBanner.classList.add("hidden");
}

// ── Generate ──
generateBtn.addEventListener("click", async () => {
  hideError();

  const selected = profiles.find((p) => p.id === selectedProfileId);
  if (!selected) {
    showError("Please select a profile.");
    return;
  }
  if (!jobDesc.value.trim()) {
    showError("Please paste a job description.");
    return;
  }

  // Reset previous output
  outputText.value = "";
  providerTag.textContent = "";
  outputSection.classList.add("hidden");
  outputPlaceholder.classList.remove("hidden");

  setLoading(true);

  try {
    const result = await generateCoverLetter({
      resumes: [selected.data],
      jobDescription: jobDesc.value.trim(),
      language: langSelect.value,
      tone: toneSelect.value,
    });

    outputText.value = result.text;
    providerTag.textContent = `Generated via ${result.provider}`;
    outputSection.classList.remove("hidden");
    outputPlaceholder.classList.add("hidden");
  } catch (err) {
    showError(err.message || "Generation failed. Please try again.");
  } finally {
    setLoading(false);
  }
});

function setLoading(loading) {
  generateBtn.disabled = loading;
  generateText.textContent = loading ? "Generating..." : "Cover Letter";
  spinner.classList.toggle("hidden", !loading);
}

function setEmailLoading(loading) {
  generateEmailBtn.disabled = loading;
  generateEmailText.textContent = loading ? "Generating..." : "Email";
  emailSpinner.classList.toggle("hidden", !loading);
}

// ── Generate Email ──
generateEmailBtn.addEventListener("click", async () => {
  hideError();

  const selected = profiles.find((p) => p.id === selectedProfileId);
  if (!selected) {
    showError("Please select a profile.");
    return;
  }
  if (!jobDesc.value.trim()) {
    showError("Please paste a job description.");
    return;
  }

  emailText.value = "";
  emailProviderTag.textContent = "";
  emailSection.classList.add("hidden");
  emailPlaceholder.classList.remove("hidden");

  setEmailLoading(true);

  try {
    const result = await generateEmail({
      resumes: [selected.data],
      jobDescription: jobDesc.value.trim(),
      language: langSelect.value,
      tone: toneSelect.value,
    });

    emailText.value = result.text;
    emailProviderTag.textContent = `Generated via ${result.provider}`;
    emailSection.classList.remove("hidden");
    emailPlaceholder.classList.add("hidden");
  } catch (err) {
    showError(err.message || "Email generation failed. Please try again.");
  } finally {
    setEmailLoading(false);
  }
});

// ── Email Copy ──
emailCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(emailText.value);
    const orig = emailCopyBtn.innerHTML;
    emailCopyBtn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> Copied!`;
    setTimeout(() => (emailCopyBtn.innerHTML = orig), 2000);
  } catch {
    showError("Failed to copy to clipboard.");
  }
});

// ── Email Export DOCX ──
emailExportBtn.addEventListener("click", () => {
  exportToDocx(emailText.value);
});

// ── Email Export PDF ──
emailExportPdfBtn.addEventListener("click", () => {
  exportToPdf(emailText.value);
});

// ── Analysis JSON parser (tolerant of stray text around the JSON) ──
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response.");
  return JSON.parse(text.slice(start, end + 1));
}

// ── Analysis dashboard renderer ──
function escapeHtmlText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function scoreColor(score) {
  if (score >= 75) return { ring: "#10b981", text: "text-emerald-600" }; // green
  if (score >= 50) return { ring: "#f59e0b", text: "text-amber-600" }; // amber
  return { ring: "#ef4444", text: "text-red-600" }; // red
}

function ringSvg(score, label) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = 32;
  const c = 2 * Math.PI * r;
  const dash = (s / 100) * c;
  const { ring, text } = scoreColor(s);
  return `
    <div class="flex flex-col items-center">
      <div class="relative w-20 h-20">
        <svg viewBox="0 0 80 80" class="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r="${r}" stroke="#f3f4f6" stroke-width="6" fill="none" />
          <circle cx="40" cy="40" r="${r}" stroke="${ring}" stroke-width="6" fill="none"
                  stroke-dasharray="${dash} ${c}" stroke-linecap="round" />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-lg font-semibold ${text}">${s}</span>
          <span class="text-[10px] text-gray-400 -mt-0.5">/ 100</span>
        </div>
      </div>
      <span class="mt-2 text-xs text-gray-500">${escapeHtmlText(label)}</span>
    </div>
  `;
}

function chip(text, variant) {
  const styles = {
    matched: "bg-emerald-50 text-emerald-700 border-emerald-200",
    missing: "bg-red-50 text-red-700 border-red-200",
    bonus: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return `<span class="inline-flex items-center px-2.5 py-1 text-xs rounded-md border ${styles[variant]}">${escapeHtmlText(text)}</span>`;
}

function reqChip(name, matched) {
  const cls = matched
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-red-50 text-red-700 border-red-200";
  const icon = matched ? "✓" : "✗";
  return `<span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border ${cls}">
    <span class="font-bold">${icon}</span> ${escapeHtmlText(name)}
  </span>`;
}

function renderAnalysis(data) {
  const matched = (data.matchedSkills || []).slice(0, 6);
  const missing = (data.missingSkills || []).slice(0, 6);
  const bonus = (data.bonusSkills || []).slice(0, 6);
  const required = data.requiredSkills || [];

  const summary = escapeHtmlText(data.summary || "");

  return `
    <!-- Scores + Summary -->
    <div class="flex flex-col sm:flex-row items-start gap-6">
      <div class="flex gap-4">
        ${ringSvg(data.overallScore ?? 0, "Overall")}
        ${ringSvg(data.skillMatch ?? 0, "Skill Match")}
        ${ringSvg(data.experienceFit ?? 0, "Experience")}
      </div>
      <p class="text-sm text-gray-700 leading-relaxed flex-1">${summary}</p>
    </div>

    <!-- Skill columns -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-semibold text-emerald-700">Matched</h3>
          <span class="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">${matched.length}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${matched.length ? matched.map((s) => chip(s, "matched")).join("") : '<span class="text-xs text-gray-400">—</span>'}
        </div>
      </div>
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-semibold text-red-700">Missing</h3>
          <span class="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700">${missing.length}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${missing.length ? missing.map((s) => chip(s, "missing")).join("") : '<span class="text-xs text-gray-400">—</span>'}
        </div>
      </div>
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-semibold text-blue-700">Bonus</h3>
          <span class="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">${bonus.length}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${bonus.length ? bonus.map((s) => chip(s, "bonus")).join("") : '<span class="text-xs text-gray-400">—</span>'}
        </div>
      </div>
    </div>

    ${
      required.length
        ? `
    <!-- Job requirements -->
    <div class="mt-6 pt-6 border-t border-gray-100">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Job Requirements</h3>
      <div class="flex flex-wrap gap-1.5">
        ${required.map((r) => reqChip(r.name, !!r.matched)).join("")}
      </div>
    </div>`
        : ""
    }
  `;
}

// ── Generate Analysis ──
function setAnalyzeLoading(loading) {
  generateAnalyzeBtn.disabled = loading;
  generateAnalyzeText.textContent = loading ? "Analyzing..." : "Analyze";
  analyzeSpinner.classList.toggle("hidden", !loading);
}

generateAnalyzeBtn.addEventListener("click", async () => {
  hideError();

  const selected = profiles.find((p) => p.id === selectedProfileId);
  if (!selected) {
    showError("Please select a profile.");
    return;
  }
  if (!jobDesc.value.trim()) {
    showError("Please paste a job description.");
    return;
  }

  analyzeContent.innerHTML = "";
  analyzeProviderTag.textContent = "";
  analyzeSection.classList.add("hidden");
  analyzePlaceholder.classList.remove("hidden");

  setAnalyzeLoading(true);

  try {
    const result = await generateAnalysis({
      resumes: [selected.data],
      jobDescription: jobDesc.value.trim(),
      language: langSelect.value,
    });

    let data;
    try {
      data = extractJson(result.text);
    } catch (err) {
      throw new Error("AI returned invalid JSON. Please try again.");
    }

    analyzeContent.innerHTML = renderAnalysis(data);
    analyzeProviderTag.textContent = `via ${result.provider}`;
    analyzeSection.classList.remove("hidden");
    analyzePlaceholder.classList.add("hidden");
  } catch (err) {
    showError(err.message || "Analysis failed. Please try again.");
  } finally {
    setAnalyzeLoading(false);
  }
});

// ── Copy ──
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputText.value);
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> Copied!`;
    setTimeout(() => (copyBtn.innerHTML = orig), 2000);
  } catch {
    showError("Failed to copy to clipboard.");
  }
});

// ── Export DOCX ──
exportBtn.addEventListener("click", () => {
  exportToDocx(outputText.value);
});

// ── Export PDF ──
exportPdfBtn.addEventListener("click", () => {
  exportToPdf(outputText.value);
});

// ── Clear All ──
clearBtn.addEventListener("click", () => {
  jobDesc.value = "";
  langSelect.value = "English";
  toneSelect.value = "professional";
  outputText.value = "";
  providerTag.textContent = "";
  outputSection.classList.add("hidden");
  outputPlaceholder.classList.remove("hidden");
  emailText.value = "";
  emailProviderTag.textContent = "";
  emailSection.classList.add("hidden");
  emailPlaceholder.classList.remove("hidden");
  analyzeContent.innerHTML = "";
  analyzeProviderTag.textContent = "";
  analyzeSection.classList.add("hidden");
  analyzePlaceholder.classList.remove("hidden");
  hideError();
});

// ── Init ──
renderProfiles();

// --- Tab switching (Job Search Module) ---

window.switchToGeneratorTab = function () {
  document.getElementById('generator-view')?.classList.remove('hidden')
  document.getElementById('jobs-view')?.classList.add('hidden')
  document.getElementById('tab-generator')?.classList.add('tab-active')
  document.getElementById('tab-jobs')?.classList.remove('tab-active')
}

window.switchToJobsTab = function () {
  document.getElementById('generator-view')?.classList.add('hidden')
  document.getElementById('jobs-view')?.classList.remove('hidden')
  document.getElementById('tab-generator')?.classList.remove('tab-active')
  document.getElementById('tab-jobs')?.classList.add('tab-active')
}

window.getActiveProfile = function () {
  const allProfiles = JSON.parse(localStorage.getItem('clg_profiles') || '[]')
  const selectedId = document.getElementById('profile-trigger')?.dataset.selectedId
  return allProfiles.find(p => p.id === selectedId) ?? null
}

window.triggerGeneration = function (type) {
  const btn = type === 'cover-letter'
    ? document.getElementById('generate-btn')
    : type === 'email'
    ? document.getElementById('generate-email-btn')
    : null
  btn?.click()
}
