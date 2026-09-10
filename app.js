/* ================================================================
   MediGuide AI — Application Logic
   Anthropic Claude API Integration
================================================================ */

'use strict';

const STORAGE_KEY_HISTORY = 'mediguide_history';
const STORAGE_KEY_THEME   = 'mediguide_theme';
const MAX_HISTORY         = 10;

const QUICK_CHIPS = [
  { name: "Fever", icon: "🤒", symptom: "fever and headache" },
  { name: "Cold", icon: "🤧", symptom: "runny nose, coughing and sneezing" },
  { name: "Cough", icon: "😷", symptom: "sore throat and persistent cough" },
  { name: "Stomach Pain", icon: "🤢", symptom: "nausea and stomach ache" },
  { name: "Back Pain", icon: "🦴", symptom: "lower back pain and stiffness" },
  { name: "Skin Rash", icon: "🔴", symptom: "red rash and itching" },
  { name: "Dizziness", icon: "😵‍💫", symptom: "dizziness and feeling faint" },
  { name: "Headache", icon: "🤕", symptom: "severe headache and pressure" },
  { name: "Chest Pain", icon: "🫀", symptom: "chest tightness and pain" },
  { name: "Diarrhea", icon: "🚽", symptom: "loose motions and dehydration" },
  { name: "Joint Pain", icon: "🦵", symptom: "joint swelling and pain" },
  { name: "Earache", icon: "👂", symptom: "ear pain and fluid discharge" },
  { name: "Vomiting", icon: "🤮", symptom: "persistent vomiting and acidity" },
  { name: "Asthma", icon: "🫁", symptom: "shortness of breath and wheezing" },
  { name: "Toothache", icon: "🦷", symptom: "tooth pain and gum swelling" }
];

const COMMON_SYMPTOMS = [
  "Abdominal pain", "Back pain", "Body ache", "Chest pain", "Chills", "Cold", "Constipation", 
  "Cough", "Diarrhea", "Dizziness", "Earache", "Eye irritation", "Fatigue", "Fever", 
  "Headache", "Heartburn", "High blood pressure", "Indigestion", "Itching", "Joint pain", 
  "Loss of appetite", "Lower back pain", "Muscle cramps", "Nausea", "Nasal congestion", 
  "Neck pain", "Rash", "Runny nose", "Shortness of breath", "Skin rash", "Sneezing", 
  "Sore throat", "Stomach ache", "Stuffy nose", "Sweating", "Swelling", "Toothache", 
  "Urinary frequency", "Vomiting", "Weakness", "Wheezing"
];

// ── DOM refs ─────────────────────────────────────────────────────
const symptomsInput    = document.getElementById('symptomsInput');
const charCount        = document.getElementById('charCount');
const submitBtn        = document.getElementById('submitBtn');
const quickChipsList   = document.getElementById('quickSymptomsList');

const inputSection     = document.getElementById('inputSection');
const loadingSection   = document.getElementById('loadingSection');
const resultsSection   = document.getElementById('resultsSection');

const conditionName    = document.getElementById('conditionName');
const conditionDesc    = document.getElementById('conditionDescription');
const conditionMeta    = document.getElementById('conditionMeta');
const medicinesGrid    = document.getElementById('medicinesGrid');
const substitutionNote = document.getElementById('substitutionNote');
const substitutionText = document.getElementById('substitutionText');

const copyBtn          = document.getElementById('copyBtn');
const printBtn         = document.getElementById('printBtn');
const newSearchBtn     = document.getElementById('newSearchBtn');
const retryBtn         = document.getElementById('retryBtn');
const errorCard        = document.getElementById('errorCard');
const errorMessage     = document.getElementById('errorMessage');

const recentSearches   = document.getElementById('recentSearches');
const recentList       = document.getElementById('recentList');
const clearHistory     = document.getElementById('clearHistory');

const progressBar      = document.getElementById('progressBar');
const step1            = document.getElementById('step1');
const step2            = document.getElementById('step2');
const step3            = document.getElementById('step3');

const disclaimerClose  = document.getElementById('disclaimerClose');
const disclaimerBanner = document.getElementById('disclaimerBanner');

const themeToggle      = document.getElementById('themeToggle');
const settingsToggle   = document.getElementById('settingsToggle');
const settingsModal    = document.getElementById('settingsModal');
const closeSettings    = document.getElementById('closeSettings');
const clearAllData     = document.getElementById('clearAllData');
const openSettingsWarn = document.getElementById('openSettingsWarning');

const pharmacyBtn      = document.getElementById('pharmacyBtn');
const suggestionsEl    = document.getElementById('autocompleteSuggestions');

// ── State ─────────────────────────────────────────────────────────
let lastResult   = null;

// ── Init ──────────────────────────────────────────────────────────
(function init() {
  initTheme();
  renderHistory();
  renderQuickChips();
  setupEventListeners();
})();

// ── Event Listeners ───────────────────────────────────────────────
function setupEventListeners() {
  // Disclaimer close
  if (disclaimerClose) {
    disclaimerClose.addEventListener('click', () => {
      disclaimerBanner.style.display = 'none';
    });
  }

  // Theme
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Settings
  if (settingsToggle) {
    settingsToggle.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
    });
  }

  if (closeSettings) {
    closeSettings.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }

  if (clearAllData) {
    clearAllData.addEventListener('click', () => {
      if (confirm('🚨 Are you absolutely sure? This will delete all history, themes, and preferences forever.')) {
        localStorage.clear();
        window.location.reload();
      }
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
  });

  if (openSettingsWarn) {
    openSettingsWarn.addEventListener('click', (e) => {
      e.preventDefault();
      settingsModal.style.display = 'flex';
    });
  }

  // Autocomplete & Symptom input
  if (symptomsInput) {
    symptomsInput.addEventListener('input', handleAutocomplete);
    symptomsInput.addEventListener('input', () => {
      if (symptomsInput.value.trim() === '') {
        resetChips();
      }
      charCount.textContent = symptomsInput.value.length;
    });

    symptomsInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) handleSearch();
    });
  }

  // Submit
  if (submitBtn) submitBtn.addEventListener('click', handleSearch);

  // Results toolbar
  if (copyBtn) copyBtn.addEventListener('click', copyResults);
  if (printBtn) printBtn.addEventListener('click', () => window.print());
  if (newSearchBtn) newSearchBtn.addEventListener('click', showInputView);
  if (retryBtn) retryBtn.addEventListener('click', showInputView);

  // Pharmacy Locator
  if (pharmacyBtn) pharmacyBtn.addEventListener('click', findNearestPharmacy);

  // History
  if (clearHistory) {
    clearHistory.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      renderHistory();
    });
  }
}

function renderQuickChips() {
  if (!quickChipsList) return;
  quickChipsList.innerHTML = '';
  QUICK_CHIPS.forEach(chip => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.symptom = chip.symptom;
    btn.innerHTML = `${chip.icon} ${chip.name}`;
    
    btn.addEventListener('click', () => {
      if (btn.classList.contains('selected')) return;

      const existing = symptomsInput.value.trim();
      const toAdd    = chip.symptom;
      
      symptomsInput.value = existing
        ? existing.replace(/,?\s*$/, '') + ', ' + toAdd
        : toAdd;
      
      btn.classList.add('selected');
      charCount.textContent = symptomsInput.value.length;
      symptomsInput.focus();
    });
    
    quickChipsList.appendChild(btn);
  });
}

function resetChips() {
  if (!quickChipsList) return;
  const chips = quickChipsList.querySelectorAll('.chip');
  chips.forEach(c => c.classList.remove('selected'));
}

// ── Main handler ──────────────────────────────────────────────────
async function handleSearch() {
  const symptoms = symptomsInput.value.trim();

  if (!symptoms) {
    showToast('⚠️ Please describe your symptoms first.', 'warn');
    symptomsInput.focus();
    return;
  }

  if (symptoms.length < 5) {
    showToast('⚠️ Please provide more detail about your symptoms.', 'warn');
    return;
  }

  saveToHistory(symptoms);
  showLoadingView();

  try {
    const result = await getAIRecommendation(symptoms);
    lastResult = result;
    renderResults(result);
    showResultsView();
  } catch (err) {
    console.error('MediGuide AI Detail Error:', err);
    showErrorView(err.message);
  }
}

// ── API Call ──────────────────────────────────────────────────────
async function getAIRecommendation(symptoms) {
  try {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    console.error('Fetch Error:', err);
    throw err;
  }
}

// ── Render Results ────────────────────────────────────────────────
function renderResults(data) {
  // Condition card
  conditionName.textContent = data.condition || 'Unknown Condition';
  conditionDesc.textContent = data.description || '';

  conditionMeta.innerHTML = '';
  if (data.severity) {
    let sevColor = 'var(--neon-emerald)';
    let sevShadow = 'rgba(52, 211, 153, 0.2)';
    
    if (data.severity === 'Moderate') {
      sevColor = 'var(--neon-amber)';
      sevShadow = 'rgba(251, 191, 36, 0.2)';
    } else if (data.severity === 'Severe') {
      sevColor = 'var(--neon-rose)';
      sevShadow = 'rgba(251, 113, 133, 0.2)';
    }

    conditionMeta.innerHTML += `
      <span class="condition-badge" style="background:${sevShadow}; color:${sevColor}; border-color:${sevColor}">
        ⚡ ${data.severity}
      </span>`;
  }
  
  if (data.category) {
    conditionMeta.innerHTML += `
      <span class="badge badge-ai" style="padding: 6px 16px; font-weight:700">
        🏷️ ${data.category}
      </span>`;
  }

  // Substitution note
  if (data.substitution_note) {
    substitutionText.textContent = data.substitution_note;
    substitutionNote.style.display = 'flex';
    substitutionNote.style.background = 'rgba(34, 211, 238, 0.05)';
    substitutionNote.style.borderColor = 'rgba(34, 211, 238, 0.2)';
    substitutionNote.style.color = 'var(--neon-cyan)';
  } else {
    substitutionNote.style.display = 'none';
  }

  // Medicine cards
  medicinesGrid.innerHTML = '';
  const medicines = Array.isArray(data.medicines) ? data.medicines : [];

  medicines.forEach((med, idx) => {
    const card = createMedicineCard(med, idx + 1);
    medicinesGrid.appendChild(card);
  });

  errorCard.style.display = 'none';
}

function createMedicineCard(med, num) {
  const card = document.createElement('div');
  card.className = 'medicine-card';

  const availClass = getAvailClass(med.availability);

  card.innerHTML = `
    <div class="card-number">${num}</div>
    <p class="medicine-name">${escHtml(med.generic_name || 'Unknown')}</p>
    <p class="medicine-brand">🏷️ ${escHtml(med.brand_name || '')}</p>
    <p class="medicine-action">${escHtml(med.action || '')}</p>
    <div class="medicine-details">
      <div class="detail-row">
        <div class="detail-icon" style="color:var(--neon-violet); border-color:rgba(139, 92, 246, 0.3)">💊</div>
        <div class="detail-content">
          <div class="detail-label">Dosage</div>
          <div class="detail-value">${escHtml(med.dosage || '—')}</div>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-icon" style="color:var(--neon-cyan); border-color:rgba(34, 211, 238, 0.3)">🔁</div>
        <div class="detail-content">
          <div class="detail-label">Frequency</div>
          <div class="detail-value">${escHtml(med.frequency || '—')}</div>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-icon" style="color:var(--neon-amber); border-color:rgba(251, 191, 36, 0.3)">🕐</div>
        <div class="detail-content">
          <div class="detail-label">Timing</div>
          <div class="detail-value">${escHtml(med.timing || '—')}</div>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-icon" style="color:var(--neon-emerald); border-color:rgba(52, 211, 153, 0.3)">💰</div>
        <div class="detail-content">
          <div class="detail-label">Price (approx.)</div>
          <div class="detail-value price-value">${escHtml(med.price_inr || '—')}</div>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-icon" style="color:var(--neon-cyan); border-color:rgba(34, 211, 238, 0.3)">🏪</div>
        <div class="detail-content">
          <div class="detail-label">Availability</div>
          <div class="detail-value">
            <span class="availability-badge ${availClass}">${escHtml(med.availability || '—')}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return card;
}

function getAvailClass(avail) {
  if (!avail) return '';
  const lower = avail.toLowerCase();
  if (lower === 'common')               return 'avail-common';
  if (lower === 'rare')                 return 'avail-rare';
  if (lower.includes('prescription'))   return 'avail-prescription';
  return 'avail-common';
}

// ── View transitions ──────────────────────────────────────────────
function showLoadingView() {
  submitBtn.disabled = true;
  inputSection.style.display = 'none';
  loadingSection.style.display = 'block';
  resultsSection.style.display = 'none';

  // Animated progress
  progressBar.style.width = '0%';
  step1.className = 'step';
  step2.className = 'step';
  step3.className = 'step';

  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 8, 90);
    progressBar.style.width = progress + '%';

    if (progress > 15)  { step1.className = 'step done'; }
    if (progress > 45)  { step2.className = 'step active'; }
    if (progress > 70)  { step2.className = 'step done'; step3.className = 'step active'; }
  }, 350);

  window._loadingInterval = interval;
}

function finishLoadingProgress() {
  clearInterval(window._loadingInterval);
  progressBar.style.width = '100%';
  step1.className = 'step done';
  step2.className = 'step done';
  step3.className = 'step done';
}

function showResultsView() {
  finishLoadingProgress();
  setTimeout(() => {
    submitBtn.disabled = false;
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    errorCard.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 500);
}

function showErrorView(msg) {
  clearInterval(window._loadingInterval);
  submitBtn.disabled = false;
  loadingSection.style.display = 'none';
  inputSection.style.display = 'block';
  resultsSection.style.display = 'block';
  errorCard.style.display = 'block';
  medicinesGrid.innerHTML = '';
  substitutionNote.style.display = 'none';
  conditionName.textContent = '';
  conditionDesc.textContent = '';
  errorMessage.textContent = msg || 'Something went wrong. Please try again.';
}

function showInputView() {
  submitBtn.disabled = false;
  loadingSection.style.display = 'none';
  resultsSection.style.display = 'none';
  inputSection.style.display = 'block';
  resetChips();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Theme Switching ──────────────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEY_THEME, newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  if (!themeToggle) return;
  const icon = themeToggle.querySelector('.theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ── Autocomplete ──────────────────────────────────────────────────
function handleAutocomplete() {
  const query = symptomsInput.value.toLowerCase().split(/,\s*/).pop();
  
  if (!query || query.length < 2) {
    if (suggestionsEl) suggestionsEl.style.display = 'none';
    return;
  }

  const matches = COMMON_SYMPTOMS.filter(s => s.toLowerCase().startsWith(query))
    .slice(0, 5);

  if (matches.length === 0) {
    if (suggestionsEl) suggestionsEl.style.display = 'none';
    return;
  }

  suggestionsEl.innerHTML = matches.map(m => `
    <div class="suggestion-item" data-val="${m}">${m}</div>
  `).join('');
  
  suggestionsEl.style.display = 'block';

  suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const currentVal = symptomsInput.value;
      const parts = currentVal.split(/,\s*/);
      parts.pop();
      parts.push(item.dataset.val);
      
      symptomsInput.value = parts.join(', ') + ', ';
      suggestionsEl.style.display = 'none';
      symptomsInput.focus();
      charCount.textContent = symptomsInput.value.length;
    });
  });
}

// ── Pharmacy Locator ──────────────────────────────────────────────
async function findNearestPharmacy() {
  if (!navigator.geolocation) {
    showToast('⚠️ Geolocation is not supported by your browser.', 'warn');
    return;
  }

  showToast('📍 Getting your location...', 'success');

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      const url = `https://www.google.com/maps/search/medical+store+near+me/@${latitude},${longitude},15z`;
      window.open(url, '_blank');
    },
    error => {
      console.error('Location Error:', error);
      const url = `https://www.google.com/maps/search/medical+store+near+me/`;
      window.open(url, '_blank');
      showToast('⚠️ Could not get accurate location. Opening general search.', 'warn');
    }
  );
}

// ── Copy Results ──────────────────────────────────────────────────
function copyResults() {
  if (!lastResult) return;

  let text = `🏥 MediGuide AI — Medical Guide\n`;
  text += `Generated on: ${new Date().toLocaleString('en-IN')}\n`;
  text += `Symptoms: ${symptomsInput.value}\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Detected Condition: ${lastResult.condition}\n`;
  text += `${lastResult.description}\n\n`;

  if (Array.isArray(lastResult.medicines)) {
    lastResult.medicines.forEach((med, i) => {
      text += `━━ Medicine ${i + 1} ━━━━━━━━━━━━━━━━━━━━\n`;
      text += `Name: ${med.generic_name} (${med.brand_name})\n`;
      text += `Action: ${med.action}\n`;
      text += `Dosage: ${med.dosage} | ${med.frequency}\n`;
      text += `Timing: ${med.timing}\n`;
      text += `Price: ${med.price_inr}\n`;
      text += `Availability: ${med.availability}\n\n`;
    });
  }

  if (lastResult.substitution_note) {
    text += `💡 ${lastResult.substitution_note}\n\n`;
  }

  text += `⚠️ DISCLAIMER: This is AI-generated advice. Always consult a real doctor.\n`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('✅ Medicine guide copied to clipboard!');
  }).catch(() => {
    showToast('❌ Could not copy — try manually selecting the text.');
  });
}

// ── History ───────────────────────────────────────────────────────
function saveToHistory(symptoms) {
  let history = getHistory();
  history = history.filter(h => h.toLowerCase() !== symptoms.toLowerCase());
  history.unshift(symptoms);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
  } catch {
    return [];
  }
}

function renderHistory() {
  if (!recentSearches || !recentList) return;
  const history = getHistory();
  if (history.length === 0) {
    recentSearches.style.display = 'none';
    return;
  }

  recentSearches.style.display = 'block';
  recentList.innerHTML = history.map((item) =>
    `<button class="recent-item" data-symptoms="${escHtml(item)}" tabindex="0" title="${escHtml(item)}">${escHtml(truncate(item, 50))}</button>`
  ).join('');

  recentList.querySelectorAll('.recent-item').forEach(btn => {
    btn.addEventListener('click', () => {
      symptomsInput.value = btn.dataset.symptoms;
      charCount.textContent = symptomsInput.value.length;
      symptomsInput.focus();
      symptomsInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  if (type === 'warn') {
    toast.style.background = '#d97706';
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Utilities ─────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}
