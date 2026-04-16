import "./style.css";
import { generateCoverLetter } from "./api.js";
import { exportToDocx } from "./docx-export.js";

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
  <header class="border-b border-gray-200 bg-white">
    <div class="max-w-7xl mx-auto px-6 py-5 flex items-center gap-3">
      <img src="/logo.jpg" alt="Logo" class="w-8 h-8 rounded object-cover" />
      <h1 class="text-xl font-semibold text-gray-900">AI Cover Letter Generator</h1>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      <!-- LEFT: Form -->
      <div class="space-y-6">

        <!-- Profiles -->
        <section class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Profiles</h2>
            <button id="add-profile-btn" class="btn-secondary flex items-center gap-1.5 text-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Profile
            </button>
            <input type="file" id="file-input" multiple accept=".json" class="hidden" />
          </div>

          <div id="drop-zone" class="drop-zone hidden">
            <svg class="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p class="text-gray-600 font-medium">Drop JSON resume files here</p>
            <p class="text-sm text-gray-400 mt-1">or click to browse</p>
          </div>

          <div id="profiles-empty" class="text-center py-8 text-gray-400 text-sm hidden">
            <svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            No profiles yet. Upload a JSON resume to get started.
          </div>

          <ul id="profile-list" class="space-y-2 hidden"></ul>
        </section>

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
        <section class="card grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <button id="generate-btn" class="h-11 btn-primary flex items-center gap-2 justify-center text-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            <span id="generate-text">Generate</span>
            <svg id="spinner" class="hidden w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </button>
          <button id="clear-btn" class="h-11 btn-secondary flex items-center gap-2 justify-center text-sm text-red-500 hover:text-red-700 hover:border-red-200">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Clear
          </button>
        </section>

        <!-- Error -->
        <div id="error-banner" class="hidden rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"></div>

      </div>

      <!-- RIGHT: Output -->
      <div class="lg:sticky lg:top-8">
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
      </div>

    </div>
  </main>

  <footer class="border-t border-gray-100 mt-12">
    <div class="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-gray-400">
      AI Cover Letter Generator &mdash; Your data stays in your browser
    </div>
  </footer>
</div>
`;

// ── DOM refs ──
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const addProfileBtn = document.getElementById("add-profile-btn");
const profileList = document.getElementById("profile-list");
const profilesEmpty = document.getElementById("profiles-empty");
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
const clearBtn = document.getElementById("clear-btn");
const outputPlaceholder = document.getElementById("output-placeholder");

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

// Show drop zone on page-level drag
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.remove("hidden");
  dropZone.classList.add("dragover");
});
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
    if (profiles.length > 0) dropZone.classList.add("hidden");
    dropZone.classList.remove("dragover");
  }
});
document.addEventListener("drop", () => {
  if (profiles.length > 0) dropZone.classList.add("hidden");
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

function renderProfiles() {
  if (profiles.length === 0) {
    profileList.classList.add("hidden");
    profilesEmpty.classList.remove("hidden");
    dropZone.classList.remove("hidden");
    return;
  }

  profilesEmpty.classList.add("hidden");
  dropZone.classList.add("hidden");
  profileList.classList.remove("hidden");

  profileList.innerHTML = profiles
    .map(
      (p) => `
    <li class="flex items-center gap-3 rounded-lg px-4 py-3 text-sm cursor-pointer transition-colors
               ${p.id === selectedProfileId ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50 border border-transparent hover:bg-gray-100"}"
        data-select="${p.id}">
      <input type="radio" name="profile" value="${p.id}" ${p.id === selectedProfileId ? "checked" : ""}
             class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer" />
      <div class="flex-1 min-w-0">
        <div class="font-medium text-gray-900">${escapeHtml(getProfileName(p.data))}</div>
      </div>
      <button data-remove="${p.id}" class="text-gray-400 hover:text-red-500 transition-colors p-1" title="Remove profile">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </li>`,
    )
    .join("");

  // Select profile on row click
  profileList.querySelectorAll("[data-select]").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.closest("[data-remove]")) return;
      selectedProfileId = li.dataset.select;
      renderProfiles();
    });
  });

  // Remove profile
  profileList.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.remove;
      profiles = profiles.filter((p) => p.id !== id);
      saveProfiles();
      if (selectedProfileId === id) {
        selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
      }
      renderProfiles();
    });
  });
}

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
  generateText.textContent = loading ? "Generating..." : "Generate";
  spinner.classList.toggle("hidden", !loading);
}

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

// ── Clear All ──
clearBtn.addEventListener("click", () => {
  jobDesc.value = "";
  langSelect.value = "English";
  toneSelect.value = "professional";
  outputText.value = "";
  providerTag.textContent = "";
  outputSection.classList.add("hidden");
  outputPlaceholder.classList.remove("hidden");
  hideError();
});

// ── Init ──
renderProfiles();
