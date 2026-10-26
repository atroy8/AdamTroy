// ============================================================================
// Outbreak Investigation Game — classroom-ready edition
// Bella Vista Restaurant outbreak (Salmonella Enteritidis, point source,
// Caesar Salad vehicle). The scenario and correct answers are fixed; the
// 30-case dataset is generated from a seed so every class (or student) can
// work a different set of numbers.
//
// Seeds: ?seed=XXXX in the URL. If absent, a random seed is generated and
// shown on the intro screen. Same seed => identical dataset, always.
// Instructor mode: ?instructor=1 shows the answer key and a class-set
// generator. It is a convenience display, not access control: answers are
// computed client-side and never rendered into the student view.
// ============================================================================

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

// mulberry32: small, fast, deterministic PRNG.
function mulberry32(a) {
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a hash: turns any seed string into a 32-bit integer for mulberry32.
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function randomSeedString(length) {
  length = length || 6;
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SEED_ALPHABET.charAt(Math.floor(Math.random() * SEED_ALPHABET.length));
  }
  return out;
}

function getUrlParams() {
  try {
    return new URLSearchParams(window.location.search);
  } catch (e) {
    return new URLSearchParams('');
  }
}

function isInstructorMode() {
  return getUrlParams().get('instructor') === '1';
}

// Resolve the active seed: URL param wins; otherwise generate one and put it
// in the URL (replaceState, no reload) so the address bar matches the screen.
function resolveSeed() {
  const params = getUrlParams();
  let seed = params.get('seed');
  if (seed) return seed;
  seed = randomSeedString();
  try {
    const url = window.location.pathname + '?seed=' + seed +
      (isInstructorMode() ? '&instructor=1' : '');
    window.history.replaceState(null, '', url);
  } catch (e) { /* file:// or restricted contexts: seed still shows on screen */ }
  return seed;
}

const CURRENT_SEED = resolveSeed();

// ---------------------------------------------------------------------------
// Dataset generation (pure: same seed => same dataset, no DOM touches)
// ---------------------------------------------------------------------------

function round1(x) {
  return Math.round(x * 10) / 10;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

// "2023-06-19 7:00 PM" — the same format the original data used, so the
// existing date parsing/formatting code keeps working unchanged.
function formatDateTimeFromParts(dateObj) {
  const y = dateObj.getFullYear();
  const m = pad2(dateObj.getMonth() + 1);
  const d = pad2(dateObj.getDate());
  let h = dateObj.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = pad2(dateObj.getMinutes());
  return y + '-' + m + '-' + d + ' ' + h + ':' + mm + ' ' + ampm;
}

function isoDatePart(dateObj) {
  return dateObj.getFullYear() + '-' + pad2(dateObj.getMonth() + 1) + '-' + pad2(dateObj.getDate());
}

function medianOf(values) {
  const sorted = values.slice().sort(function(a, b) { return a - b; });
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[Math.floor(n / 2)];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

// Incubation hours: mostly clustered near 24h (the Salmonella signature),
// with an occasional long tail, matching the original dataset's shape.
function drawIncubationHours(rng) {
  let v;
  if (rng() < 0.85) {
    v = 24 + (rng() + rng() + rng() - 1.5) * 11; // triangular, ~12-40h
  } else {
    v = 36 + rng() * 24; // long tail, 36-60h
  }
  return Math.max(12, Math.min(60, Math.round(v)));
}

function drawSymptoms(rng) {
  const symptoms = ['diarrhea', 'cramps']; // every case in this outbreak
  if (rng() < 0.80) symptoms.push('nausea');
  if (rng() < 0.70) symptoms.push('fever');
  if (rng() < 0.35) symptoms.push('vomiting');
  return symptoms;
}

function drawExposures(rng, isIll) {
  return {
    caesar: rng() < (isIll ? 0.85 : 0.50),
    chicken: rng() < (isIll ? 0.90 : 0.78),
    tiramisu: rng() < (isIll ? 0.65 : 0.62)
  };
}

function computeCrossTabs(cases, well) {
  const out = {};
  ['caesar', 'chicken', 'tiramisu'].forEach(function(food) {
    const illAte = cases.filter(function(c) { return c.exposures[food]; }).length;
    const wellAte = well.filter(function(w) { return w.exposures[food]; }).length;
    const ateTotal = illAte + wellAte;
    out[food] = {
      illAte: illAte,
      illNot: cases.length - illAte,
      wellAte: wellAte,
      wellNot: well.length - wellAte,
      ateTotal: ateTotal,
      notTotal: (cases.length + well.length) - ateTotal,
      rate: ateTotal > 0 ? round1((illAte / ateTotal) * 100) : 0
    };
  });
  return out;
}

// The pedagogy requires Caesar Salad to be the clear answer: its attack rate
// must beat the other two foods by a margin. If a random draw comes out too
// close, nudge exposures deterministically (flip well patrons' answers) until
// the separation holds. Each flip moves a finite pool, so this terminates.
function repairSeparation(cases, well, rng) {
  let guard = 0;
  let ct = computeCrossTabs(cases, well);
  while (guard < 500) {
    guard++;
    ct = computeCrossTabs(cases, well);
    const okChicken = ct.caesar.rate >= ct.chicken.rate + 3;
    const okTiramisu = ct.caesar.rate >= ct.tiramisu.rate + 3;
    if (okChicken && okTiramisu) break;
    let flipped = false;
    if (!okChicken) {
      const idx = well.map(function(w, i) { return i; })
        .filter(function(i) { return !well[i].exposures.chicken; });
      if (idx.length > 0) {
        well[idx[Math.floor(rng() * idx.length)]].exposures.chicken = true;
        flipped = true;
      }
    }
    if (!flipped && !okTiramisu) {
      const idx = well.map(function(w, i) { return i; })
        .filter(function(i) { return !well[i].exposures.tiramisu; });
      if (idx.length > 0) {
        well[idx[Math.floor(rng() * idx.length)]].exposures.tiramisu = true;
        flipped = true;
      }
    }
    if (!flipped) {
      const idx = well.map(function(w, i) { return i; })
        .filter(function(i) { return well[i].exposures.caesar; });
      if (idx.length > 0) {
        well[idx[Math.floor(rng() * idx.length)]].exposures.caesar = false;
        flipped = true;
      }
    }
    if (!flipped) break; // nothing left to adjust; accept the draw
  }
  return computeCrossTabs(cases, well);
}

function buildDataset(seed, rng) {
  const cases = [];
  for (let id = 1; id <= 30; id++) {
    // Dining: June 18-26, 2023, evening service (6:00-8:30 PM, 30-min slots).
    const diningDay = 18 + Math.floor(rng() * 9);
    const diningMinutes = 18 * 60 + Math.floor(rng() * 6) * 30;
    const dining = new Date(2023, 5, diningDay, Math.floor(diningMinutes / 60), diningMinutes % 60);
    const incubation = drawIncubationHours(rng);
    const onset = new Date(dining.getTime() + incubation * 3600 * 1000);
    const symptoms = drawSymptoms(rng);
    let hospitalized = rng() < 0.13;
    if (hospitalized && symptoms.length < 3) symptoms.push('fever');
    cases.push({
      id: id,
      age: 18 + Math.floor(rng() * 53), // 18-70
      sex: rng() < 0.5 ? 'F' : 'M',
      dining_datetime: formatDateTimeFromParts(dining),
      onset_datetime: formatDateTimeFromParts(onset),
      symptoms: symptoms,
      hospitalized: hospitalized,
      incubation_hours: incubation,
      exposures: drawExposures(rng, true)
    });
  }

  // The 150 well patrons: exposure patterns only (no case rows).
  const well = [];
  for (let i = 0; i < 150; i++) {
    well.push({ exposures: drawExposures(rng, false) });
  }

  const crossTabs = repairSeparation(cases, well, rng);
  return { seed: seed, cases: cases, well: well, crossTabs: crossTabs };
}

function finalizeDataset(ds) {
  const cases = ds.cases;
  const totalExposed = cases.length + ds.well.length; // 180

  // Epidemic-curve axis: every onset date in the data, min to max.
  const onsetDates = cases.map(function(c) { return c.onset_datetime.split(' ')[0]; });
  const minDate = onsetDates.slice().sort()[0];
  const maxDate = onsetDates.slice().sort()[onsetDates.length - 1];
  const curveDates = [];
  const cursor = new Date(minDate + 'T12:00:00');
  const end = new Date(maxDate + 'T12:00:00');
  while (cursor <= end) {
    curveDates.push(isoDatePart(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  const datesToIndices = {};
  curveDates.forEach(function(d, i) { datesToIndices[d] = i; });

  // Peak onset window, for the report narrative.
  const perDay = {};
  cases.forEach(function(c) {
    const d = c.onset_datetime.split(' ')[0];
    perDay[d] = (perDay[d] || 0) + 1;
  });
  const maxPerDay = Math.max.apply(null, Object.keys(perDay).map(function(k) { return perDay[k]; }));
  const peakDates = Object.keys(perDay).filter(function(k) { return perDay[k] === maxPerDay; }).sort();
  const shortFmt = function(iso) {
    const dt = new Date(iso + 'T12:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[dt.getMonth()] + ' ' + dt.getDate();
  };
  let peakWindowText;
  if (peakDates.length === 1) {
    peakWindowText = 'around ' + shortFmt(peakDates[0]);
  } else {
    peakWindowText = 'peaking on ' + peakDates.map(shortFmt).join(' and ');
  }

  // Symptom prevalence, for the report narrative.
  const symptomStats = {};
  ['diarrhea', 'cramps', 'nausea', 'fever', 'vomiting'].forEach(function(s) {
    symptomStats[s] = round1((cases.filter(function(c) { return c.symptoms.indexOf(s) !== -1; }).length / cases.length) * 100);
  });
  const hospitalizationCount = cases.filter(function(c) { return c.hospitalized; }).length;

  const medianIncubation = medianOf(cases.map(function(c) { return c.incubation_hours; }));

  ds.curveDates = curveDates;
  ds.datesToIndices = datesToIndices;
  ds.maxPerDay = maxPerDay;
  ds.peakWindowText = peakWindowText;
  ds.symptomStats = symptomStats;
  ds.hospitalizationCount = hospitalizationCount;
  ds.medianIncubation = medianIncubation;
  ds.totalExposed = totalExposed;
  ds.correctAnswers = {
    disease: 'Salmonella Enteritidis',
    outbreakType: 'Point source outbreak',
    medianIncubation: medianIncubation,
    overallAttackRate: round1((cases.length / totalExposed) * 100),
    foodVector: 'Caesar Salad',
    foodRates: {
      caesar: ds.crossTabs.caesar.rate,
      chicken: ds.crossTabs.chicken.rate,
      tiramisu: ds.crossTabs.tiramisu.rate
    }
  };
  return ds;
}

// Generate the dataset for a seed. The median incubation must stay near 24h
// (the clue that points to Salmonella); if a draw drifts, retry with a
// derived attempt counter. The retry is deterministic: same seed, same data.
function generateDataset(seed) {
  let best = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = mulberry32(hashSeed(seed + '::' + attempt));
    const ds = finalizeDataset(buildDataset(seed, rng));
    if (ds.medianIncubation >= 22 && ds.medianIncubation <= 27) return ds;
    if (!best || Math.abs(ds.medianIncubation - 24) < Math.abs(best.medianIncubation - 24)) best = ds;
  }
  return best; // extremely unlikely fallback: closest median found
}

// The active case set for this page load.
const gameData = generateDataset(CURRENT_SEED);

// ---------------------------------------------------------------------------
// Game state management
// ---------------------------------------------------------------------------

const gameState = {
  currentScreen: 0,
  screens: ['intro-screen', 'data-screen', 'curve-screen', 'disease-screen', 'attack-screen', 'report-screen'],
  scores: {
    incubation: 0,
    curve: 0,
    disease: 0,
    outbreak: 0,
    attack: 0,
    total: 0
  },
  userAnswers: {
    selectedDisease: null,
    outbreakType: null,
    overallAttackRate: null,
    caesarRate: null,
    chickenRate: null,
    tiramisuRate: null,
    foodVector: null
  },
  calculatedIncubations: {},
  curveComplete: false,
  allCalculationsComplete: false,

  nextScreen() {
    console.log('Next screen called, current screen:', this.currentScreen);

    // Special validation for data screen
    if (this.currentScreen === 1 && !this.allCalculationsComplete) {
      alert('Please complete all 30 incubation period calculations before proceeding to the epidemic curve.');
      return;
    }

    if (this.currentScreen < this.screens.length - 1) {
      this.hideScreen(this.screens[this.currentScreen]);
      this.currentScreen++;
      this.showScreen(this.screens[this.currentScreen]);
      this.initializeScreen(this.screens[this.currentScreen]);
    }
  },

  prevScreen() {
    console.log('Previous screen called, current screen:', this.currentScreen);
    if (this.currentScreen > 0) {
      this.hideScreen(this.screens[this.currentScreen]);
      this.currentScreen--;
      this.showScreen(this.screens[this.currentScreen]);
    }
  },

  showScreen(screenId) {
    console.log('Showing screen:', screenId);
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
    } else {
      console.error('Screen not found:', screenId);
    }
  },

  hideScreen(screenId) {
    console.log('Hiding screen:', screenId);
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.remove('active');
    } else {
      console.error('Screen not found:', screenId);
    }
  },

  initializeScreen(screenId) {
    console.log('Initializing screen:', screenId);
    switch(screenId) {
      case 'data-screen':
        populateCaseTable();
        updateCalculationStatus();
        break;
      case 'curve-screen':
        initializeCurveBuilder();
        populateReferencePanel();
        break;
      case 'disease-screen':
        updateCalculatedMedianDisplay();
        break;
      case 'report-screen':
        calculateScores();
        generateReport();
        break;
    }
  }
};

// ---------------------------------------------------------------------------
// Seed UI (intro screen)
// ---------------------------------------------------------------------------

function seedPageUrl(seed, instructor) {
  let base = '';
  try {
    base = window.location.href.split('?')[0];
  } catch (e) {
    base = 'index.html';
  }
  return base + '?seed=' + seed + (instructor ? '&instructor=1' : '');
}

// Load a brand-new random case set (preserves instructor mode if active).
function newCaseSet() {
  window.location.href = seedPageUrl(randomSeedString(), isInstructorMode());
}

function copyTextToClipboard(text, doneMsg) {
  const done = function() {
    if (doneMsg) alert(doneMsg);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function() { fallbackCopy(text, done); });
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* clipboard unavailable */ }
  document.body.removeChild(ta);
  done();
}

function copySeedLink() {
  copyTextToClipboard(seedPageUrl(CURRENT_SEED, false), 'Link copied. Anyone opening it works this same case set.');
}

// ---------------------------------------------------------------------------
// Instructor mode (answer key + class-set generator)
// ---------------------------------------------------------------------------

function answerKeyLines(ds) {
  const ct = ds.crossTabs;
  const a = ds.correctAnswers;
  return [
    'Disease: ' + a.disease,
    'Outbreak type: ' + a.outbreakType,
    'Median incubation: ' + a.medianIncubation + ' hours',
    'Overall attack rate: ' + a.overallAttackRate + '% (30 ill / ' + ds.totalExposed + ' exposed)',
    'Caesar Salad attack rate: ' + ct.caesar.rate + '% (' + ct.caesar.illAte + '/' + ct.caesar.ateTotal + ' ate it)',
    'Chicken Parmesan attack rate: ' + ct.chicken.rate + '% (' + ct.chicken.illAte + '/' + ct.chicken.ateTotal + ' ate it)',
    'Tiramisu attack rate: ' + ct.tiramisu.rate + '% (' + ct.tiramisu.illAte + '/' + ct.tiramisu.ateTotal + ' ate it)',
    'Food vehicle: ' + a.foodVector
  ];
}

function classSetLine(ds) {
  const ct = ds.crossTabs;
  const a = ds.correctAnswers;
  return 'Seed ' + ds.seed +
    ' | Median ' + a.medianIncubation + 'h' +
    ' | Overall AR ' + a.overallAttackRate + '%' +
    ' | Caesar ' + ct.caesar.rate + '% (' + ct.caesar.illAte + '/' + ct.caesar.ateTotal + ')' +
    ' | Chicken ' + ct.chicken.rate + '% (' + ct.chicken.illAte + '/' + ct.chicken.ateTotal + ')' +
    ' | Tiramisu ' + ct.tiramisu.rate + '% (' + ct.tiramisu.illAte + '/' + ct.tiramisu.ateTotal + ')' +
    ' | Vehicle: ' + a.foodVector +
    ' | Disease: ' + a.disease +
    ' | Type: ' + a.outbreakType;
}

function renderInstructorPanel() {
  const panel = document.getElementById('instructor-panel');
  const content = document.getElementById('instructor-content');
  if (!panel || !content) return;

  const keyRows = answerKeyLines(gameData).map(function(line) {
    const parts = line.split(': ');
    return '<tr><th>' + parts[0] + '</th><td>' + parts.slice(1).join(': ') + '</td></tr>';
  }).join('');

  content.innerHTML = `
    <div class="instructor-badge">Instructor mode: answer key visible</div>
    <h3>Answer key &mdash; case set <code>${gameData.seed}</code></h3>
    <p class="instructor-note">This key matches the case set in the current URL. Give each student (or group) a different seed from the class-set generator below so answers cannot be copied across the room.</p>
    <table class="answer-key-table"><tbody>${keyRows}</tbody></table>
    <h3>Class-set generator</h3>
    <p class="instructor-note">Generate distinct seeds with their answer keys. Hand one seed per student or group; grade against that seed's line.</p>
    <div class="class-set-controls">
      <label class="form-label" for="class-set-count">Number of case sets</label>
      <input type="number" id="class-set-count" class="form-control class-set-count" value="30" min="1" max="100">
      <button class="btn btn--primary" onclick="generateClassSet()">Generate class set</button>
      <button class="btn btn--outline" onclick="copyClassSet()">Copy list</button>
    </div>
    <textarea id="class-set-output" class="form-control class-set-output" readonly rows="12" placeholder="Generated seeds and answer keys appear here."></textarea>
    <div class="instructor-actions">
      <button class="btn btn--secondary" onclick="exitInstructorMode()">Exit instructor mode</button>
    </div>
  `;
  panel.classList.remove('hidden');
}

function generateClassSet() {
  const countInput = document.getElementById('class-set-count');
  const output = document.getElementById('class-set-output');
  if (!output) return;
  let n = countInput ? parseInt(countInput.value, 10) : 30;
  if (isNaN(n) || n < 1) n = 1;
  if (n > 100) n = 100;
  const used = {};
  const lines = [];
  let guard = 0;
  while (lines.length < n && guard < n * 20) {
    guard++;
    const seed = randomSeedString();
    if (used[seed]) continue;
    used[seed] = true;
    lines.push(classSetLine(generateDataset(seed)));
  }
  output.value = lines.join('\n');
}

function copyClassSet() {
  const output = document.getElementById('class-set-output');
  if (!output || !output.value) {
    alert('Generate a class set first.');
    return;
  }
  copyTextToClipboard(output.value, 'Class set copied.');
}

function exitInstructorMode() {
  window.location.href = seedPageUrl(CURRENT_SEED, false);
}

function initInstructorMode() {
  const link = document.getElementById('instructor-link');
  if (link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = seedPageUrl(CURRENT_SEED, true);
    });
  }
  if (isInstructorMode()) {
    renderInstructorPanel();
  }
}

// ---------------------------------------------------------------------------
// Page boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing game... Seed:', CURRENT_SEED);
  gameState.showScreen(gameState.screens[0]);

  // Seed display on the intro screen
  const seedValue = document.getElementById('seed-value');
  if (seedValue) seedValue.textContent = CURRENT_SEED;

  // Attack-rate cross-tabulation tables are built from the generated data
  populateAttackTables();
  initInstructorMode();

  // Add event listeners to ensure buttons work
  const beginButton = document.querySelector('#intro-screen .btn--primary');
  if (beginButton) {
    beginButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Begin Investigation button clicked');
      gameState.nextScreen();
    });
  }
});

// Fill the attack-rate cross-tab tables from the generated cohort.
function populateAttackTables() {
  const specs = [
    { food: 'caesar', prefix: 'ct-caesar' },
    { food: 'chicken', prefix: 'ct-chicken' },
    { food: 'tiramisu', prefix: 'ct-tiramisu' }
  ];
  specs.forEach(function(spec) {
    const ct = gameData.crossTabs[spec.food];
    const set = function(suffix, value) {
      const el = document.getElementById(spec.prefix + '-' + suffix);
      if (el) el.textContent = value;
    };
    set('ill-ate', ct.illAte);
    set('ill-not', ct.illNot);
    set('well-ate', ct.wellAte);
    set('well-not', ct.wellNot);
    set('ate-total', ct.ateTotal);
    set('not-total', ct.notTotal);
  });
  // Rate-input hints show the actual fractions for this case set.
  const hints = [
    { id: 'caesar-rate', ct: gameData.crossTabs.caesar, label: 'Caesar' },
    { id: 'chicken-rate', ct: gameData.crossTabs.chicken, label: 'Chicken' },
    { id: 'tiramisu-rate', ct: gameData.crossTabs.tiramisu, label: 'Tiramisu' }
  ];
  hints.forEach(function(h) {
    const input = document.getElementById(h.id);
    if (input) input.placeholder = 'Calculate: ' + h.ct.illAte + '/' + h.ct.ateTotal + ' x 100';
  });
}

// Incubation period calculation functions
function validateIncubation(caseId) {
  console.log('Validating incubation for case:', caseId);
  const input = document.getElementById(`incubation-input-${caseId}`);
  const statusIcon = document.getElementById(`status-icon-${caseId}`);

  if (!input || !statusIcon) {
    console.error('Input or status icon not found for case:', caseId);
    return;
  }

  const userValue = parseInt(input.value);
  const correctValue = gameData.cases.find(c => c.id === caseId).incubation_hours;

  if (userValue === correctValue) {
    statusIcon.className = 'incubation-status correct';
    statusIcon.textContent = '✓';
    gameState.calculatedIncubations[caseId] = userValue;
    input.classList.add('correct');
    input.classList.remove('incorrect');
  } else if (input.value) {
    statusIcon.className = 'incubation-status incorrect';
    statusIcon.textContent = '✗';
    delete gameState.calculatedIncubations[caseId];
    input.classList.add('incorrect');
    input.classList.remove('correct');
  } else {
    statusIcon.className = 'incubation-status pending';
    statusIcon.textContent = '?';
    delete gameState.calculatedIncubations[caseId];
    input.classList.remove('correct', 'incorrect');
  }

  updateCalculationStatus();
}

function updateCalculationStatus() {
  const calculatedCount = Object.keys(gameState.calculatedIncubations).length;
  const totalCases = gameData.cases.length;

  const calculatedCountElement = document.getElementById('calculated-count');
  const medianIncubationElement = document.getElementById('median-incubation');

  if (calculatedCountElement) {
    calculatedCountElement.textContent = calculatedCount;
  }

  // Calculate median incubation period from correct calculations
  if (calculatedCount > 0 && medianIncubationElement) {
    const incubationValues = Object.values(gameState.calculatedIncubations).sort((a, b) => a - b);
    const median = incubationValues.length % 2 === 0
      ? (incubationValues[incubationValues.length / 2 - 1] + incubationValues[incubationValues.length / 2]) / 2
      : incubationValues[Math.floor(incubationValues.length / 2)];
    medianIncubationElement.textContent = median;
  } else if (medianIncubationElement) {
    medianIncubationElement.textContent = '--';
  }

  // Enable/disable button based on completion
  const proceedButton = document.getElementById('proceed-to-curve');

  if (proceedButton) {
    // Update game state and button based on completion
    gameState.allCalculationsComplete = (calculatedCount === totalCases);
    proceedButton.disabled = !gameState.allCalculationsComplete;

    if (gameState.allCalculationsComplete) {
      proceedButton.textContent = 'Proceed to Epi Curve';
      proceedButton.classList.remove('btn--secondary');
      proceedButton.classList.add('btn--primary');
    } else {
      proceedButton.textContent = `Calculations Needed: ${totalCases - calculatedCount} remaining`;
      proceedButton.classList.remove('btn--primary');
      proceedButton.classList.add('btn--secondary');
    }
  }
}

// Case data table functions
function populateCaseTable() {
  console.log('Populating case table...');
  const tbody = document.getElementById('case-table-body');
  if (!tbody) {
    console.error('Case table body not found');
    return;
  }

  tbody.innerHTML = '';

  gameData.cases.forEach(caseData => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${caseData.id}</td>
      <td>${caseData.age}</td>
      <td>${caseData.sex}</td>
      <td>${formatDateTime(caseData.dining_datetime)}</td>
      <td>${formatDateTime(caseData.onset_datetime)}</td>
      <td class="symptoms">${caseData.symptoms.join(', ')}</td>
      <td class="${caseData.hospitalized ? 'hospitalized-yes' : ''}">${caseData.hospitalized ? 'Yes' : 'No'}</td>
      <td class="incubation-input-cell">
        <div class="incubation-calculation">
          <input type="number"
                 id="incubation-input-${caseData.id}"
                 class="incubation-input"
                 placeholder="Hours"
                 min="1"
                 max="168"
                 onchange="validateIncubation(${caseData.id})">
          <span class="incubation-status pending" id="status-icon-${caseData.id}">?</span>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function sortCases(sortBy) {
  console.log('Sorting cases by:', sortBy);
  const sortedCases = [...gameData.cases].sort((a, b) => {
    if (sortBy === 'age') {
      return a.age - b.age;
    } else if (sortBy === 'dining_date' || sortBy === 'onset_date') {
      return new Date(a[sortBy.replace('_date', '_datetime')]) - new Date(b[sortBy.replace('_date', '_datetime')]);
    } else {
      return a[sortBy] - b[sortBy];
    }
  });

  const tbody = document.getElementById('case-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  sortedCases.forEach(caseData => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${caseData.id}</td>
      <td>${caseData.age}</td>
      <td>${caseData.sex}</td>
      <td>${formatDateTime(caseData.dining_datetime)}</td>
      <td>${formatDateTime(caseData.onset_datetime)}</td>
      <td class="symptoms">${caseData.symptoms.join(', ')}</td>
      <td class="${caseData.hospitalized ? 'hospitalized-yes' : ''}">${caseData.hospitalized ? 'Yes' : 'No'}</td>
      <td class="incubation-input-cell">
        <div class="incubation-calculation">
          <input type="number"
                 id="incubation-input-${caseData.id}"
                 class="incubation-input"
                 placeholder="Hours"
                 min="1"
                 max="168"
                 value="${gameState.calculatedIncubations[caseData.id] || ''}"
                 onchange="validateIncubation(${caseData.id})">
          <span class="incubation-status ${gameState.calculatedIncubations[caseData.id] ? 'correct' : 'pending'}"
                id="status-icon-${caseData.id}">
            ${gameState.calculatedIncubations[caseData.id] ? '✓' : '?'}
          </span>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Re-apply validation styling
  Object.keys(gameState.calculatedIncubations).forEach(caseId => {
    const input = document.getElementById(`incubation-input-${caseId}`);
    if (input) {
      input.classList.add('correct');
    }
  });
}

function formatDateTime(dateTimeString) {
  return new Date(dateTimeString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Reference panel functions
function populateReferencePanel() {
  sortReferencePanel('id');
}

function sortReferencePanel(sortBy) {
  const referenceList = document.getElementById('reference-list');
  if (!referenceList) return;

  referenceList.innerHTML = '';

  let sortedCases = [...gameData.cases];

  switch(sortBy) {
    case 'onset_date':
      sortedCases.sort((a, b) => new Date(a.onset_datetime) - new Date(b.onset_datetime));
      break;
    case 'incubation':
      sortedCases.sort((a, b) => a.incubation_hours - b.incubation_hours);
      break;
    default:
      sortedCases.sort((a, b) => a.id - b.id);
  }

  sortedCases.forEach(caseData => {
    const incubationClass = caseData.incubation_hours < 24 ? 'incubation-short' :
                          caseData.incubation_hours <= 48 ? 'incubation-medium' : 'incubation-long';

    const referenceItem = document.createElement('div');
    referenceItem.className = `reference-item ${incubationClass}`;
    referenceItem.innerHTML = `
      <div><span class="case-id">Case #${caseData.id}</span>: <span class="onset-date">${formatDateTime(caseData.onset_datetime)}</span></div>
      <div>Incubation: <span class="incubation-period">${caseData.incubation_hours} hours</span></div>
    `;
    referenceList.appendChild(referenceItem);
  });
}

function updateCalculatedMedianDisplay() {
  const calculatedCount = Object.keys(gameState.calculatedIncubations).length;
  const displayElement = document.getElementById('calculated-median-display');
  if (!displayElement) return;

  if (calculatedCount > 0) {
    const incubationValues = Object.values(gameState.calculatedIncubations).sort((a, b) => a - b);
    const median = incubationValues.length % 2 === 0
      ? (incubationValues[incubationValues.length / 2 - 1] + incubationValues[incubationValues.length / 2]) / 2
      : incubationValues[Math.floor(incubationValues.length / 2)];
    displayElement.textContent = median;
  } else {
    displayElement.textContent = '--';
  }
}

// Epi curve construction
let placedCases = {};
let selectedBlockId = null;

function initializeCurveBuilder() {
  createCaseBlocks();
  createChartColumns();
  renderCurveAxes();
  setupDragAndDrop();
}

function shortAxisLabel(isoDate) {
  const dt = new Date(isoDate + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[dt.getMonth()] + ' ' + dt.getDate();
}

// X-axis labels and Y-axis ticks come from the generated data: the axis
// spans the actual onset-date range, and the scale fits the busiest day.
function renderCurveAxes() {
  const xLabels = document.getElementById('x-axis-labels');
  if (xLabels) {
    xLabels.innerHTML = '';
    gameData.curveDates.forEach(function(d) {
      const span = document.createElement('span');
      span.textContent = shortAxisLabel(d);
      xLabels.appendChild(span);
    });
    xLabels.style.gridTemplateColumns = 'repeat(' + gameData.curveDates.length + ', 1fr)';
  }
  const yScale = document.getElementById('y-scale');
  if (yScale) {
    yScale.innerHTML = '';
    const max = gameData.maxPerDay;
    const step = max > 10 ? 2 : 1;
    const ticks = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    // column-reverse layout: first DOM child sits at the bottom, so emit
    // ticks ascending (0 at bottom, max at top).
    ticks.forEach(function(v) {
      const span = document.createElement('span');
      span.textContent = v;
      yScale.appendChild(span);
    });
  }
}

function createCaseBlocks() {
  const caseBlocksContainer = document.getElementById('case-blocks');
  if (!caseBlocksContainer) return;

  caseBlocksContainer.innerHTML = '';
  // Compact blocks when one day holds many cases, so stacks fit the chart.
  caseBlocksContainer.classList.toggle('compact', gameData.maxPerDay > 8);

  gameData.cases.forEach(caseData => {
    const block = document.createElement('div');
    block.className = 'case-block';
    block.textContent = caseData.id;
    block.draggable = true;
    block.dataset.caseId = caseData.id;
    block.dataset.onsetDate = caseData.onset_datetime.split(' ')[0]; // Extract date part
    block.setAttribute('aria-label', 'Case ' + caseData.id + ', onset ' + formatDate(caseData.onset_datetime.split(' ')[0]));
    block.setAttribute('tabindex', '0');
    block.addEventListener('click', handleBlockClick);
    block.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBlockClick(e); }
    });
    caseBlocksContainer.appendChild(block);
  });
}

function createChartColumns() {
  const chartColumnsContainer = document.getElementById('chart-columns');
  if (!chartColumnsContainer) return;

  chartColumnsContainer.innerHTML = '';

  for (let i = 0; i < gameData.curveDates.length; i++) {
    const column = document.createElement('div');
    column.className = 'chart-column';
    column.dataset.dateIndex = i;
    column.setAttribute('aria-label', 'Onset date ' + shortAxisLabel(gameData.curveDates[i]));
    column.addEventListener('click', handleColumnClick);
    chartColumnsContainer.appendChild(column);
  }
  chartColumnsContainer.style.gridTemplateColumns = 'repeat(' + gameData.curveDates.length + ', 1fr)';
}

function setupDragAndDrop() {
  const caseBlocks = document.querySelectorAll('.case-block');
  const chartColumns = document.querySelectorAll('.chart-column');

  caseBlocks.forEach(block => {
    block.addEventListener('dragstart', handleDragStart);
    block.addEventListener('dragend', handleDragEnd);
  });

  chartColumns.forEach(column => {
    column.addEventListener('dragover', handleDragOver);
    column.addEventListener('drop', handleDrop);
    column.addEventListener('dragenter', handleDragEnter);
    column.addEventListener('dragleave', handleDragLeave);
  });
}

function handleDragStart(e) {
  e.target.classList.add('dragging');
  e.dataTransfer.setData('text/plain', e.target.dataset.caseId);
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDragEnter(e) {
  e.target.classList.add('drop-zone');
}

function handleDragLeave(e) {
  if (!e.target.contains(e.relatedTarget)) {
    e.target.classList.remove('drop-zone');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const caseId = e.dataTransfer.getData('text/plain');
  const column = e.target.closest('.chart-column');
  if (column) {
    placeBlock(caseId, column);
    column.classList.remove('drop-zone');
  }
}

// Shared placement used by drag-and-drop and by click/tap (touch devices
// have no drag-and-drop): click a block to select it, then click a column.
function placeBlock(caseId, column) {
  const caseBlock = document.querySelector(`[data-case-id="${caseId}"]`);
  if (!column || !caseBlock) return;
  column.appendChild(caseBlock);
  caseBlock.classList.add('placed');
  caseBlock.classList.remove('selected-block');
  caseBlock.draggable = false;
  placedCases[caseId] = parseInt(column.dataset.dateIndex, 10);
  selectedBlockId = null;
}

function handleBlockClick(e) {
  const block = e.currentTarget;
  const caseId = block.dataset.caseId;
  // A placed block returns to the pool when clicked.
  if (block.classList.contains('placed')) {
    returnBlockToPool(caseId);
    return;
  }
  document.querySelectorAll('.case-block.selected-block').forEach(function(b) {
    b.classList.remove('selected-block');
  });
  if (selectedBlockId === caseId) {
    selectedBlockId = null;
  } else {
    selectedBlockId = caseId;
    block.classList.add('selected-block');
  }
}

function handleColumnClick(e) {
  if (!selectedBlockId) return;
  const column = e.target.closest('.chart-column');
  if (column) placeBlock(selectedBlockId, column);
}

function returnBlockToPool(caseId) {
  const caseBlock = document.querySelector(`[data-case-id="${caseId}"]`);
  const pool = document.getElementById('case-blocks');
  if (!caseBlock || !pool) return;
  caseBlock.classList.remove('placed', 'selected-block');
  caseBlock.draggable = true;
  pool.appendChild(caseBlock);
  delete placedCases[caseId];
  if (selectedBlockId === caseId) selectedBlockId = null;
}

function resetCurve() {
  const caseBlocksContainer = document.getElementById('case-blocks');
  const caseBlocks = document.querySelectorAll('.case-block');

  caseBlocks.forEach(block => {
    block.classList.remove('placed', 'selected-block');
    block.draggable = true;
    if (caseBlocksContainer) {
      caseBlocksContainer.appendChild(block);
    }
  });

  placedCases = {};
  selectedBlockId = null;
  const feedbackElement = document.getElementById('curve-feedback');
  if (feedbackElement) {
    feedbackElement.classList.add('hidden');
  }
  const nextButton = document.getElementById('curve-next-btn');
  if (nextButton) {
    nextButton.disabled = true;
  }
}

function checkCurve() {
  let correct = 0;
  let total = gameData.cases.length;

  gameData.cases.forEach(caseData => {
    const correctIndex = gameData.datesToIndices[caseData.onset_datetime.split(' ')[0]];
    const placedIndex = placedCases[caseData.id.toString()];

    if (placedIndex === correctIndex) {
      correct++;
    }
  });

  const accuracy = (correct / total) * 100;
  const feedback = document.getElementById('curve-feedback');

  if (feedback) {
    if (accuracy >= 80) {
      feedback.className = 'feedback success';
      feedback.textContent = `Excellent! You placed ${correct} out of ${total} cases correctly (${accuracy.toFixed(1)}% accuracy).`;
      gameState.scores.curve = Math.round((accuracy / 100) * 30);
      gameState.curveComplete = true;
      const nextButton = document.getElementById('curve-next-btn');
      if (nextButton) nextButton.disabled = false;
    } else if (accuracy >= 60) {
      feedback.className = 'feedback warning';
      feedback.textContent = `Good effort! You placed ${correct} out of ${total} cases correctly (${accuracy.toFixed(1)}% accuracy). Try to improve your accuracy.`;
      gameState.scores.curve = Math.round((accuracy / 100) * 30);
      gameState.curveComplete = true;
      const nextButton = document.getElementById('curve-next-btn');
      if (nextButton) nextButton.disabled = false;
    } else {
      feedback.className = 'feedback error';
      feedback.textContent = `You placed ${correct} out of ${total} cases correctly (${accuracy.toFixed(1)}% accuracy). Please review the case data and try again.`;
      gameState.scores.curve = Math.round((accuracy / 100) * 30);
    }

    feedback.classList.remove('hidden');
  }
}

// Disease identification functions
function selectDisease(diseaseName) {
  document.querySelectorAll('.disease-option').forEach(option => {
    option.classList.remove('selected');
  });

  event.target.closest('.disease-option').classList.add('selected');
  gameState.userAnswers.selectedDisease = diseaseName;

  const radioButton = event.target.closest('.disease-option').querySelector('input[type="radio"]');
  if (radioButton) radioButton.checked = true;
}

function selectOutbreakType(outbreakType) {
  document.querySelectorAll('.outbreak-option').forEach(option => {
    option.classList.remove('selected');
  });

  event.target.closest('.outbreak-option').classList.add('selected');
  gameState.userAnswers.outbreakType = outbreakType;

  const radioButton = event.target.closest('.outbreak-option').querySelector('input[type="radio"]');
  if (radioButton) radioButton.checked = true;
}

// Score calculation functions
function calculateScores() {
  // Calculate incubation period score (20 points)
  const totalCorrectIncubations = Object.keys(gameState.calculatedIncubations).length;
  gameState.scores.incubation = Math.round((totalCorrectIncubations / 30) * 20);

  // Get user answers
  const overallRateInput = document.getElementById('overall-attack-rate');
  const caesarRateInput = document.getElementById('caesar-rate');
  const chickenRateInput = document.getElementById('chicken-rate');
  const tiramisuRateInput = document.getElementById('tiramisu-rate');
  const foodVehicleSelect = document.getElementById('food-vehicle');

  gameState.userAnswers.overallAttackRate = overallRateInput ? parseFloat(overallRateInput.value) || 0 : 0;
  gameState.userAnswers.caesarRate = caesarRateInput ? parseFloat(caesarRateInput.value) || 0 : 0;
  gameState.userAnswers.chickenRate = chickenRateInput ? parseFloat(chickenRateInput.value) || 0 : 0;
  gameState.userAnswers.tiramisuRate = tiramisuRateInput ? parseFloat(tiramisuRateInput.value) || 0 : 0;
  gameState.userAnswers.foodVector = foodVehicleSelect ? foodVehicleSelect.value : '';

  // Disease identification scoring (20 points total)
  let diseaseScore = 0;
  if (gameState.userAnswers.selectedDisease === gameData.correctAnswers.disease) {
    diseaseScore = 20;
  }
  gameState.scores.disease = diseaseScore;

  // Outbreak type scoring (15 points)
  gameState.scores.outbreak = gameState.userAnswers.outbreakType === gameData.correctAnswers.outbreakType ? 15 : 0;

  // Attack rate scoring (15 points total), graded against this case set's
  // computed rates — not the old hardcoded cross-tabulation values.
  let attackScore = 0;

  // Overall attack rate (3 points)
  if (Math.abs(gameState.userAnswers.overallAttackRate - gameData.correctAnswers.overallAttackRate) <= 1) {
    attackScore += 3;
  }

  // Food-specific rates (9 points total)
  const correctCaesarRate = gameData.correctAnswers.foodRates.caesar;
  const correctChickenRate = gameData.correctAnswers.foodRates.chicken;
  const correctTiramisuRate = gameData.correctAnswers.foodRates.tiramisu;

  if (Math.abs(gameState.userAnswers.caesarRate - correctCaesarRate) <= 2) attackScore += 3;
  if (Math.abs(gameState.userAnswers.chickenRate - correctChickenRate) <= 2) attackScore += 3;
  if (Math.abs(gameState.userAnswers.tiramisuRate - correctTiramisuRate) <= 2) attackScore += 3;

  // Food vehicle identification (3 points)
  if (gameState.userAnswers.foodVector === gameData.correctAnswers.foodVector) {
    attackScore += 3;
  }

  gameState.scores.attack = attackScore;
  gameState.scores.total = gameState.scores.incubation + gameState.scores.curve + gameState.scores.disease + gameState.scores.outbreak + gameState.scores.attack;
}

function generateReport() {
  updateScoreDisplay();
  generateInvestigationReport();
  generateFeedback();
}

function updateScoreDisplay() {
  const elements = {
    totalScore: document.getElementById('total-score'),
    incubationScore: document.getElementById('incubation-score'),
    curveScore: document.getElementById('curve-score'),
    diseaseScore: document.getElementById('disease-score'),
    outbreakScore: document.getElementById('outbreak-score'),
    attackScore: document.getElementById('attack-score'),
    gradeElement: document.getElementById('score-grade')
  };

  if (elements.totalScore) elements.totalScore.textContent = gameState.scores.total;
  if (elements.incubationScore) elements.incubationScore.textContent = `${gameState.scores.incubation}/20`;
  if (elements.curveScore) elements.curveScore.textContent = `${gameState.scores.curve}/30`;
  if (elements.diseaseScore) elements.diseaseScore.textContent = `${gameState.scores.disease}/20`;
  if (elements.outbreakScore) elements.outbreakScore.textContent = `${gameState.scores.outbreak}/15`;
  if (elements.attackScore) elements.attackScore.textContent = `${gameState.scores.attack}/15`;

  if (elements.gradeElement) {
    if (gameState.scores.total >= 85) {
      elements.gradeElement.textContent = 'Excellent';
      elements.gradeElement.className = 'score-grade excellent';
    } else if (gameState.scores.total >= 70) {
      elements.gradeElement.textContent = 'Good';
      elements.gradeElement.className = 'score-grade good';
    } else {
      elements.gradeElement.textContent = 'Needs Improvement';
      elements.gradeElement.className = 'score-grade needs-improvement';
    }
  }
}

function generateInvestigationReport() {
  const calculatedMedian = Object.keys(gameState.calculatedIncubations).length > 0
    ? Object.values(gameState.calculatedIncubations).sort((a, b) => a - b)[Math.floor(Object.values(gameState.calculatedIncubations).length / 2)]
    : 24;

  const reportContent = document.getElementById('report-content');
  if (!reportContent) return;

  const ct = gameData.crossTabs;
  const ss = gameData.symptomStats;
  const hosp = gameData.hospitalizationCount;
  const hospText = hosp === 1
    ? 'One case required hospitalization.'
    : hosp + ' cases required hospitalization.';

  reportContent.innerHTML = `
    <div class="report-section">
      <h4>Outbreak Description</h4>
      <p>On June 19, 2023, the health department received reports of gastrointestinal illness among patrons of Bella Vista Restaurant. A total of 30 confirmed and probable cases were identified among individuals who dined at the establishment between June 18-26, 2023.</p>
    </div>

    <div class="report-section">
      <h4>Epidemiological Findings</h4>
      <p><strong>Attack Rate:</strong> 30 ill among ${gameData.totalExposed} total patrons (${gameData.correctAnswers.overallAttackRate}% overall attack rate)</p>
      <p><strong>Epidemic Curve:</strong> The outbreak exhibited a classic point-source pattern with a rapid rise to peak incidence ${gameData.peakWindowText}, followed by a gradual decline.</p>
      <p><strong>Incubation Period:</strong> Based on your calculations, the median incubation period was approximately ${calculatedMedian} hours, consistent with Salmonella enteritidis infection.</p>
      <p><strong>Symptoms:</strong> All cases reported diarrhea, with additional symptoms including abdominal cramps (${ss.cramps}%), nausea (${ss.nausea}%), fever (${ss.fever}%), and vomiting (${ss.vomiting}%). ${hospText}</p>
    </div>

    <div class="report-section">
      <h4>Food-Specific Attack Rates</h4>
      <ul>
        <li><strong>Caesar Salad:</strong> ${ct.caesar.rate}% attack rate among those who consumed it</li>
        <li><strong>Chicken Parmesan:</strong> ${ct.chicken.rate}% attack rate among those who consumed it</li>
        <li><strong>Tiramisu:</strong> ${ct.tiramisu.rate}% attack rate among those who consumed it</li>
      </ul>
      <p>Statistical analysis identified Caesar salad as the most likely vehicle of infection based on the highest attack rate differential between exposed and unexposed individuals.</p>
    </div>

    <div class="report-section">
      <h4>Laboratory Results</h4>
      <p>Stool specimens from 15 cases were submitted for laboratory testing. Salmonella Enteritidis was confirmed in 12 specimens. Environmental samples from the restaurant kitchen identified the same organism in egg-containing ingredients used in Caesar salad dressing preparation.</p>
    </div>

    <div class="report-section">
      <h4>Environmental Health Investigation</h4>
      <p>Inspection revealed improper storage temperatures for eggs used in Caesar dressing preparation, along with inadequate hand hygiene practices among food handlers. The restaurant voluntarily ceased Caesar salad service and implemented corrective measures.</p>
    </div>

    <div class="report-section">
      <h4>Control Measures</h4>
      <ul>
        <li>Immediate cessation of Caesar salad service</li>
        <li>Comprehensive sanitization of food preparation areas</li>
        <li>Staff retraining on food safety protocols</li>
        <li>Implementation of proper egg storage and handling procedures</li>
        <li>Enhanced surveillance for additional cases</li>
      </ul>
    </div>
  `;
}

function generateFeedback() {
  const feedbackContent = document.getElementById('feedback-content');
  if (!feedbackContent) return;

  const feedbackItems = [];

  // Incubation calculation feedback
  const calculatedCount = Object.keys(gameState.calculatedIncubations).length;
  if (calculatedCount === 30) {
    feedbackItems.push({
      type: 'correct',
      title: 'Incubation Period Calculations',
      message: 'Perfect! You correctly calculated all 30 incubation periods. This is crucial for identifying the causative agent.'
    });
  } else {
    feedbackItems.push({
      type: 'incorrect',
      title: 'Incubation Period Calculations',
      message: `You correctly calculated ${calculatedCount} out of 30 incubation periods. Remember: incubation period = time from exposure (dining) to illness onset.`
    });
  }

  // Curve construction feedback
  if (gameState.scores.curve >= 24) {
    feedbackItems.push({
      type: 'correct',
      title: 'Epi Curve Construction',
      message: 'Excellent work constructing the epidemic curve! You correctly identified the point-source pattern typical of foodborne outbreaks.'
    });
  } else {
    feedbackItems.push({
      type: 'incorrect',
      title: 'Epi Curve Construction',
      message: 'Review the relationship between exposure date and illness onset. In foodborne outbreaks, cases cluster around the same incubation period after exposure.'
    });
  }

  // Disease identification feedback
  if (gameState.userAnswers.selectedDisease === gameData.correctAnswers.disease) {
    feedbackItems.push({
      type: 'correct',
      title: 'Disease Identification',
      message: 'Correct! Salmonella Enteritidis was the causative agent. Your calculated median incubation period was a key clue.'
    });
  } else {
    feedbackItems.push({
      type: 'incorrect',
      title: 'Disease Identification',
      message: `You selected ${gameState.userAnswers.selectedDisease}. The correct answer was Salmonella Enteritidis, which has a typical incubation period of 12-72 hours (median 24 hours).`
    });
  }

  // Outbreak type feedback
  if (gameState.userAnswers.outbreakType === gameData.correctAnswers.outbreakType) {
    feedbackItems.push({
      type: 'correct',
      title: 'Outbreak Classification',
      message: 'Correct! This was a point source outbreak, characterized by rapid rise to peak and gradual decline over time.'
    });
  } else {
    feedbackItems.push({
      type: 'incorrect',
      title: 'Outbreak Classification',
      message: 'This was a point source outbreak. The epidemic curve shows rapid rise to peak incidence followed by gradual decline, typical when people are exposed to the same source over a brief period.'
    });
  }

  // Attack rate feedback
  if (gameState.scores.attack >= 12) {
    feedbackItems.push({
      type: 'correct',
      title: 'Attack Rate Analysis',
      message: 'Great job with the attack rate calculations! You correctly identified Caesar salad as the most likely vehicle based on the attack rate analysis.'
    });
  } else {
    feedbackItems.push({
      type: 'incorrect',
      title: 'Attack Rate Analysis',
      message: 'Remember: Attack rate = (number of cases exposed / total number exposed) × 100. Compare rates between those who ate specific foods versus those who did not.'
    });
  }

  feedbackContent.innerHTML = feedbackItems.map(item => `
    <div class="feedback-item ${item.type}">
      <h4>${item.title}</h4>
      <p>${item.message}</p>
    </div>
  `).join('');
}

function restartGame() {
  // Reset game state (same case set; pick "New random case set" on the
  // intro screen for fresh numbers)
  gameState.currentScreen = 0;
  gameState.scores = { incubation: 0, curve: 0, disease: 0, outbreak: 0, attack: 0, total: 0 };
  gameState.userAnswers = {
    selectedDisease: null,
    outbreakType: null,
    overallAttackRate: null,
    caesarRate: null,
    chickenRate: null,
    tiramisuRate: null,
    foodVector: null
  };
  gameState.calculatedIncubations = {};
  gameState.curveComplete = false;
  gameState.allCalculationsComplete = false;
  placedCases = {};
  selectedBlockId = null;

  // Hide all screens and show intro
  gameState.screens.forEach(screenId => {
    const el = document.getElementById(screenId);
    if (el) el.classList.remove('active');
  });
  gameState.showScreen(gameState.screens[0]);

  // Reset forms
  document.querySelectorAll('input, select').forEach(input => {
    input.value = '';
    if (input.type === 'radio') {
      input.checked = false;
    }
    input.classList.remove('correct', 'incorrect');
  });

  // Reset incubation status icons
  document.querySelectorAll('.incubation-status').forEach(function(icon) {
    icon.className = 'incubation-status pending';
    icon.textContent = '?';
  });

  // Reset selections
  document.querySelectorAll('.selected').forEach(element => {
    element.classList.remove('selected');
  });

  // Reset curve blocks to the pool and clear curve feedback
  resetCurve();

  // Reset buttons / status readouts
  const curveNextBtn = document.getElementById('curve-next-btn');
  if (curveNextBtn) curveNextBtn.disabled = true;

  const curveFeedback = document.getElementById('curve-feedback');
  if (curveFeedback) curveFeedback.classList.add('hidden');

  updateCalculationStatus();
}
