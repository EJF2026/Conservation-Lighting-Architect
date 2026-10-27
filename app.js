const BWS_LIMITS = {
  1: { high: 40000, normal: 80000, low: 200000 },
  1.5: { high: 120000, normal: 240000, low: 600000 },
  2: { high: 200000, normal: 400000, low: 1000000 },
  2.5: { high: 360000, normal: 720000, low: 1800000 },
  3: { high: 600000, normal: 1200000, low: 3000000 },
  3.5: { high: 1100000, normal: 2200000, low: 5500000 },
  4: { high: 2000000, normal: 4000000, low: 10000000 },
  7: { high: 60000000, normal: 120000000, low: 300000000 }
};

const WEEKS_PER_YEAR = 52;
const SLIDE_FONT = '"Segoe UI", Arial, Helvetica, sans-serif';

const state = {
  mode: 'continuous'
};

const $ = (id) => document.getElementById(id);
const fmtNumber = (value) => new Intl.NumberFormat('en-NZ').format(value);
const fmtPercent = (value) => `${new Intl.NumberFormat('en-NZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
const fmtLuxHours = (value) => `${fmtNumber(Math.round(value))} lux-hours`;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Reads a number field, keeping it inside its allowed range.
function readNumber(id, min, max) {
  return clamp(Number($(id).value) || 0, min, max);
}

function getSelectedSignificance() {
  const selected = document.querySelector('input[name="significance"]:checked');
  return selected ? selected.value : 'normal';
}

function getSelectedBws() {
  const value = Number($('bwsRating').value);
  return Number.isFinite(value) ? value : 1.5;
}

function getDisplayYears(mode) {
  const value = Number($(`${mode}DisplayLength`).value);
  return Number.isFinite(value) ? value : 10;
}

function getDisplayLengthLabel(mode) {
  const select = $(`${mode}DisplayLength`);
  return select.options[select.selectedIndex].text;
}

// Hours left in the day once exhibition and cleaning lighting are taken out.
function getOutOfHours(mode) {
  const exhibitionHours = readNumber(`${mode}ExhibitionHours`, 0, 24);
  const cleaningHours = readNumber(`${mode}CleaningHours`, 0, 24);
  return Math.max(0, 24 - (exhibitionHours + cleaningHours));
}

function hoursOverLimit(mode) {
  return readNumber(`${mode}ExhibitionHours`, 0, 24) + readNumber(`${mode}CleaningHours`, 0, 24) > 24;
}

// Total exposure over the display period. Days the exhibition is closed
// still receive out-of-hours lighting for all 24 hours.
function totalFromDaily(openDayLuxHours, outOfHoursLux, daysOpen, displayYears) {
  const closedDays = 7 - daysOpen;
  const weeklyLuxHours = (openDayLuxHours * daysOpen) + (24 * outOfHoursLux * closedDays);
  return weeklyLuxHours * WEEKS_PER_YEAR * displayYears;
}

function getContinuousExposure() {
  const daysOpen = readNumber('continuousDaysOpen', 1, 7);
  const exhibitionHours = readNumber('continuousExhibitionHours', 0, 24);
  const exhibitionLux = readNumber('continuousExhibitionLux', 0, 4000);
  const cleaningHours = readNumber('continuousCleaningHours', 0, 24);
  const cleaningLux = readNumber('continuousCleaningLux', 0, 4000);
  const outOfHoursLux = readNumber('continuousOutHoursLux', 0, 4000);

  const openDayLuxHours = (exhibitionHours * exhibitionLux)
    + (cleaningHours * cleaningLux)
    + (getOutOfHours('continuous') * outOfHoursLux);

  return totalFromDaily(openDayLuxHours, outOfHoursLux, daysOpen, getDisplayYears('continuous'));
}

function getInteractiveExposure() {
  const daysOpen = readNumber('interactiveDaysOpen', 1, 7);
  const exhibitionHours = readNumber('interactiveExhibitionHours', 0, 24);
  const cleaningHours = readNumber('interactiveCleaningHours', 0, 24);
  const cleaningLux = readNumber('interactiveCleaningLux', 0, 4000);
  const ambientLux = readNumber('ambientLux', 0, 4000);
  const activeLux = readNumber('activeLux', 0, 4000);
  const activeMinutes = readNumber('interactiveOnMinutes', 0, 1440);
  const ambientMinutes = readNumber('interactiveOffMinutes', 0, 1440);
  const outOfHoursLux = readNumber('interactiveOutHoursLux', 0, 4000);

  // Average lux during exhibition hours, weighted by how long the light is
  // active versus ambient in each cycle. With no cycle entered, ambient is used.
  const cycleMinutes = activeMinutes + ambientMinutes;
  const averageExhibitionLux = cycleMinutes > 0
    ? ((activeLux * activeMinutes) + (ambientLux * ambientMinutes)) / cycleMinutes
    : ambientLux;

  const openDayLuxHours = (exhibitionHours * averageExhibitionLux)
    + (cleaningHours * cleaningLux)
    + (getOutOfHours('interactive') * outOfHoursLux);

  return totalFromDaily(openDayLuxHours, outOfHoursLux, daysOpen, getDisplayYears('interactive'));
}

function getExposureTotal() {
  return state.mode === 'interactive' ? getInteractiveExposure() : getContinuousExposure();
}

function getLimitForSelectedBws() {
  const details = BWS_LIMITS[getSelectedBws()];
  return details ? details[getSelectedSignificance()] : 0;
}

function getStatus(percentage) {
  if (percentage > 100) {
    return {
      level: 'red',
      title: 'Swapover required, not suitable for this length of display',
      summary: 'This display exceeds the selected 10-year dose allocation for the chosen significance level.'
    };
  }
  if (percentage > 80) {
    return {
      level: 'amber',
      title: 'Approaching limit',
      summary: 'This display is close to the 10-year dose allocation and should be reviewed before final approval.'
    };
  }
  return {
    level: 'green',
    title: 'Within allocation',
    summary: 'This display remains within the selected 10-year dose allocation for the chosen significance level.'
  };
}

function getResults() {
  const exposureTotal = getExposureTotal();
  const limit = getLimitForSelectedBws();
  const percentage = limit > 0 ? (exposureTotal / limit) * 100 : 0;
  return { exposureTotal, limit, percentage, status: getStatus(percentage) };
}

function updateOutOfHoursDisplays() {
  ['continuous', 'interactive'].forEach((mode) => {
    $(`${mode}OutHoursDisplay`).value = `${getOutOfHours(mode).toFixed(1)} hours`;
  });
  $('hoursWarning').hidden = !hoursOverLimit(state.mode);
}

function updateResults() {
  updateOutOfHoursDisplays();
  const { exposureTotal, limit, percentage, status } = getResults();

  const statusBox = $('statusBox');
  statusBox.className = `status-box ${status.level}`;
  statusBox.textContent = status.title;
  $('summaryText').textContent = status.summary;

  $('percentValue').textContent = fmtPercent(percentage);
  $('limitValue').textContent = fmtLuxHours(limit);
  $('exposureValue').textContent = fmtLuxHours(exposureTotal);
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  $('continuousPanel').classList.toggle('active', mode === 'continuous');
  $('interactivePanel').classList.toggle('active', mode === 'interactive');
  updateResults();
}

/* ---------- Image upload ---------- */

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function showImageError(message) {
  const error = $('imageError');
  error.textContent = message;
  error.hidden = !message;
}

function clearImagePreview() {
  const preview = $('itemPreview');
  preview.removeAttribute('src');
  preview.parentElement.classList.remove('has-image');
}

function handleFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  showImageError('');
  if (!file) {
    return;
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    clearImagePreview();
    event.target.value = '';
    showImageError('Please choose a JPEG, PNG, GIF or WebP image. iPhone HEIC photos need converting to JPEG first.');
    return;
  }

  if (file.size > MAX_IMAGE_BYTES) {
    clearImagePreview();
    event.target.value = '';
    showImageError('That image is larger than 25 MB. Please use a smaller copy.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    // Check the file really decodes as an image before accepting it.
    const test = new Image();
    test.onload = () => {
      const preview = $('itemPreview');
      preview.src = loadEvent.target.result;
      preview.parentElement.classList.add('has-image');
    };
    test.onerror = () => {
      clearImagePreview();
      event.target.value = '';
      showImageError('That image could not be read. It may be damaged. Please try another file.');
    };
    test.src = loadEvent.target.result;
  };
  reader.onerror = () => {
    clearImagePreview();
    showImageError('That image could not be read. Please try another file.');
  };
  reader.readAsDataURL(file);
}

/* ---------- Slide export ---------- */

function showExportMessage(message, isError = false) {
  const el = $('exportMessage');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = !message;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Splits text into lines that fit maxWidth.
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) {
    lines.push(line);
  }
  return lines;
}

// Draws wrapped text, shortening with an ellipsis past maxLines. Returns the next y.
function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrapLines(ctx, text, maxWidth);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = shown[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    shown[maxLines - 1] = `${last.trimEnd()}…`;
  }
  shown.forEach((line, i) => ctx.fillText(line, x, y + (i * lineHeight)));
  return y + (shown.length * lineHeight);
}

function getLightingLines(mode) {
  const v = (id) => $(id).value;
  const display = `Display: ${getDisplayLengthLabel(mode)}, ${v(`${mode}DaysOpen`)} days/week`;
  const outHours = getOutOfHours(mode).toFixed(1).replace('.0', '');

  if (mode === 'continuous') {
    return [
      display,
      `Exhibition: ${v('continuousExhibitionHours')} h/day at ${v('continuousExhibitionLux')} lux`,
      `Cleaning: ${v('continuousCleaningHours')} h/day at ${v('continuousCleaningLux')} lux`,
      `Out of hours: ${outHours} h/day at ${v('continuousOutHoursLux')} lux`
    ];
  }
  return [
    display,
    `Exhibition: ${v('interactiveExhibitionHours')} h/day, cycling`,
    `   Ambient ${v('ambientLux')} lux for ${v('interactiveOffMinutes')} min / Active ${v('activeLux')} lux for ${v('interactiveOnMinutes')} min`,
    `Cleaning: ${v('interactiveCleaningHours')} h/day at ${v('interactiveCleaningLux')} lux`,
    `Out of hours: ${outHours} h/day at ${v('interactiveOutHoursLux')} lux`
  ];
}

function makeFileName(itemName) {
  const slug = itemName
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'collection-item'}-light-exposure.jpg`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createSlide() {
  const button = $('exportButton');
  button.disabled = true;
  showExportMessage('Creating slide…');

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');

    const colours = {
      bg: '#f5f6f3', softGrey: '#e7ece8', panel: '#ffffff', text: '#1f2933',
      muted: '#5b6770', accent: '#1d5372', border: '#dfe8df', header: '#123b52',
      red: '#a1292a', amber: '#b97300', green: '#237a4f'
    };

    const mode = state.mode;
    const itemName = $('itemName').value.trim() || 'Collection Item';
    const significance = getSelectedSignificance();
    const bws = getSelectedBws();
    const { exposureTotal, limit, percentage, status } = getResults();
    const statusColour = colours[status.level];

    // Background and header
    ctx.fillStyle = colours.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colours.header;
    ctx.fillRect(0, 0, canvas.width, 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 38px ${SLIDE_FONT}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Canterbury Museum Collection Item Light Exposure Calculator', 60, 68);

    // Image panel
    ctx.fillStyle = colours.panel;
    ctx.fillRect(60, 140, 640, 700);
    ctx.strokeStyle = colours.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 140, 640, 700);

    const img = await loadImage($('itemPreview').getAttribute('src'));
    const box = { x: 85, y: 165, w: 590, h: 650 };
    if (img) {
      const ratio = Math.min(box.w / img.width, box.h / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    } else {
      ctx.fillStyle = colours.softGrey;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = '#6b7b7f';
      ctx.font = `600 28px ${SLIDE_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('No item image uploaded', box.x + box.w / 2, box.y + box.h / 2);
      ctx.textAlign = 'left';
    }

    // Details panel
    const px = 730;
    const pw = 810;
    const tx = px + 35;
    const tw = pw - 70;
    ctx.fillStyle = colours.panel;
    ctx.fillRect(px, 140, pw, 700);
    ctx.strokeRect(px, 140, pw, 700);

    ctx.fillStyle = colours.text;
    ctx.font = `700 38px ${SLIDE_FONT}`;
    let y = drawWrapped(ctx, itemName, tx, 195, tw, 44, 2);

    y += 12;
    ctx.fillStyle = colours.accent;
    ctx.font = `700 20px ${SLIDE_FONT}`;
    ctx.fillText('BWS RATING', tx, y);
    ctx.fillText('SIGNIFICANCE', tx + 260, y);
    ctx.fillText('LIGHTING MODE', tx + 520, y);
    ctx.fillStyle = colours.text;
    ctx.font = `700 30px ${SLIDE_FONT}`;
    ctx.fillText(bws === 4 ? 'BWS 4+' : bws === 7 ? 'BWS 7+' : `BWS ${bws}`, tx, y + 40);
    ctx.fillText(significance.charAt(0).toUpperCase() + significance.slice(1), tx + 260, y + 40);
    ctx.fillText(mode === 'continuous' ? 'Continuous' : 'Interactive', tx + 520, y + 40);

    y += 90;
    ctx.fillStyle = colours.accent;
    ctx.font = `700 20px ${SLIDE_FONT}`;
    ctx.fillText('LIGHTING DETAILS', tx, y);
    ctx.fillStyle = colours.text;
    ctx.font = `500 22px ${SLIDE_FONT}`;
    y += 34;
    getLightingLines(mode).forEach((line) => {
      y = drawWrapped(ctx, line, tx, y, tw, 30, 1);
    });

    // Results figures
    y += 18;
    const cols = [
      { label: '10-YEAR DOSE USED', value: fmtPercent(percentage) },
      { label: 'TOTAL EXPOSURE', value: fmtLuxHours(exposureTotal) },
      { label: 'ALLOCATED DOSE', value: fmtLuxHours(limit) }
    ];
    const colW = tw / 3;
    cols.forEach((col, i) => {
      const cx = tx + i * colW;
      ctx.fillStyle = colours.accent;
      ctx.font = `700 18px ${SLIDE_FONT}`;
      ctx.fillText(col.label, cx, y);
      ctx.fillStyle = i === 0 ? statusColour : colours.text;
      ctx.font = i === 0 ? `800 40px ${SLIDE_FONT}` : `700 22px ${SLIDE_FONT}`;
      drawWrapped(ctx, col.value, cx, y + (i === 0 ? 44 : 36), colW - 16, 26, 2);
    });

    // Status band, wraps so the full message is shown
    ctx.font = `700 24px ${SLIDE_FONT}`;
    const statusLines = wrapLines(ctx, status.title, tw - 50).slice(0, 2);
    const bandH = 30 + statusLines.length * 32;
    const bandY = 815 - bandH;
    ctx.fillStyle = statusColour;
    ctx.fillRect(tx, bandY, tw, bandH);
    ctx.fillStyle = '#ffffff';
    statusLines.forEach((line, i) => ctx.fillText(line, tx + 25, bandY + 40 + i * 32));

    // Footer note
    ctx.fillStyle = colours.muted;
    ctx.font = `500 16px ${SLIDE_FONT}`;
    ctx.fillText(
      `No UV present. Dose limited to a 10-year allocation. Created ${new Date().toLocaleDateString('en-NZ')}.`,
      60, 875
    );

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      throw new Error('The browser could not create the JPEG.');
    }
    const fileName = makeFileName(itemName);
    downloadBlob(blob, fileName);
    showExportMessage(`Slide saved as ${fileName}`);
  } catch (error) {
    console.error(error);
    showExportMessage('Sorry, the slide could not be created. Try a different image or another browser.', true);
  } finally {
    button.disabled = false;
  }
}

/* ---------- Wiring ---------- */

document.querySelectorAll('.mode-button').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

// Any change to a lighting or item field recalculates the results.
document.querySelectorAll('#continuousPanel input, #continuousPanel select, #interactivePanel input, #interactivePanel select, #bwsRating')
  .forEach((el) => {
    el.addEventListener('input', updateResults);
    el.addEventListener('change', updateResults);
  });

const significanceCards = document.querySelectorAll('.choice-card');
document.querySelectorAll('input[name="significance"]').forEach((input) => {
  input.addEventListener('change', () => {
    significanceCards.forEach((card) => card.classList.toggle('selected', card.querySelector('input').checked));
    updateResults();
  });
});

$('itemImage').addEventListener('change', handleFileUpload);
$('exportButton').addEventListener('click', () => createSlide());

updateResults();
