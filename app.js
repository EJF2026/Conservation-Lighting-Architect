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

const state = {
  mode: 'continuous'
};

const fmtNumber = (value) => new Intl.NumberFormat('en-NZ').format(value);
const fmtLuxHours = (value) => `${fmtNumber(Math.round(value))} lux-hours`;

function getSelectedSignificance() {
  const selected = document.querySelector('input[name="significance"]:checked');
  return selected ? selected.value : 'normal';
}

function getSelectedBws() {
  const value = Number(document.getElementById('bwsRating').value);
  return Number.isFinite(value) ? value : 1.5;
}

function getDisplayYears(mode) {
  const panelName = mode === 'interactive' ? 'interactiveDisplayLength' : 'continuousDisplayLength';
  const value = Number(document.getElementById(panelName).value);
  return Number.isFinite(value) ? value : 10;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getContinuousExposure() {
  const daysOpen = clamp(Number(document.getElementById('continuousDaysOpen').value) || 0, 1, 7);
  const exhibitionHours = clamp(Number(document.getElementById('continuousExhibitionHours').value) || 0, 0, 24);
  const exhibitionLux = clamp(Number(document.getElementById('continuousExhibitionLux').value) || 0, 0, 4000);
  const cleaningHours = clamp(Number(document.getElementById('continuousCleaningHours').value) || 0, 0, 24);
  const cleaningLux = clamp(Number(document.getElementById('continuousCleaningLux').value) || 0, 0, 4000);
  const outOfHoursLux = clamp(Number(document.getElementById('continuousOutHoursLux').value) || 0, 0, 4000);
  const displayYears = getDisplayYears('continuous');

  const totalDailyLightingHours = exhibitionHours + cleaningHours;
  const outOfHours = Math.max(0, 24 - totalDailyLightingHours);
  const dailyLuxHours = (exhibitionHours * exhibitionLux) + (cleaningHours * cleaningLux) + (outOfHours * outOfHoursLux);

  const annualExposure = dailyLuxHours * daysOpen * 52;
  return annualExposure * displayYears;
}

function getInteractiveExposure() {
  const daysOpen = clamp(Number(document.getElementById('interactiveDaysOpen').value) || 0, 1, 7);
  const displayYears = getDisplayYears('interactive');
  const exhibitionHours = clamp(Number(document.getElementById('interactiveExhibitionHours').value) || 0, 0, 24);
  const exhibitionLux = clamp(Number(document.getElementById('interactiveExhibitionLux').value) || 0, 0, 4000);
  const cleaningHours = clamp(Number(document.getElementById('interactiveCleaningHours').value) || 0, 0, 24);
  const cleaningLux = clamp(Number(document.getElementById('interactiveCleaningLux').value) || 0, 0, 4000);
  const ambientLux = clamp(Number(document.getElementById('ambientLux').value) || 0, 0, 4000);
  const activeLux = clamp(Number(document.getElementById('activeLux').value) || 0, 0, 4000);
  const onMinutes = clamp(Number(document.getElementById('interactiveOnMinutes').value) || 0, 0, 1440);
  const offMinutes = clamp(Number(document.getElementById('interactiveOffMinutes').value) || 0, 0, 1440);

  const cycleMinutes = onMinutes + offMinutes;
  const openMinutes = exhibitionHours * 60;
  const fullCyclesPerDay = cycleMinutes > 0 ? Math.floor(openMinutes / cycleMinutes) : 0;

  const cycleLuxHours = (activeLux * (onMinutes / 60)) + (ambientLux * (offMinutes / 60));
  const dailyInteractiveLuxHours = fullCyclesPerDay * cycleLuxHours;
  const dailyBaseLuxHours = (exhibitionHours * exhibitionLux) + (cleaningHours * cleaningLux);

  const annualExposure = (dailyBaseLuxHours + dailyInteractiveLuxHours) * daysOpen * 52;
  return annualExposure * displayYears;
}

function updateOutOfHoursDisplay() {
  const exhibitionHours = clamp(Number(document.getElementById('continuousExhibitionHours').value) || 0, 0, 24);
  const cleaningHours = clamp(Number(document.getElementById('continuousCleaningHours').value) || 0, 0, 24);
  const outHours = Math.max(0, 24 - (exhibitionHours + cleaningHours));
  document.getElementById('continuousOutHoursDisplay').value = `${outHours.toFixed(1)} hours`;
}

function updateRangeLabels() {
  document.getElementById('ambientLuxValue').textContent = Number(document.getElementById('ambientLux').value).toFixed(0);
  document.getElementById('activeLuxValue').textContent = Number(document.getElementById('activeLux').value).toFixed(0);
}

function setMode(mode) {
  state.mode = mode;
  const buttons = document.querySelectorAll('.mode-button');
  buttons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
  });

  document.getElementById('continuousPanel').classList.toggle('active', mode === 'continuous');
  document.getElementById('interactivePanel').classList.toggle('active', mode === 'interactive');
  updateResults();
}

function getExposureTotal() {
  if (state.mode === 'interactive') {
    return getInteractiveExposure();
  }
  return getContinuousExposure();
}

function getLimitForSelectedBws() {
  const significance = getSelectedSignificance();
  const bws = getSelectedBws();
  const details = BWS_LIMITS[bws];
  return details ? details[significance] : 0;
}

function updateResults() {
  const exposureTotal = getExposureTotal();
  const limit = getLimitForSelectedBws();
  const percentage = limit > 0 ? (exposureTotal / limit) * 100 : 0;

  const statusBox = document.getElementById('statusBox');
  const summaryText = document.getElementById('summaryText');

  if (percentage > 100) {
    statusBox.className = 'status-box red';
    statusBox.textContent = 'Swapover required, not suitable for this length of display';
    summaryText.textContent = 'This display exceeds the selected 10-year dose allocation for the chosen significance level.';
  } else if (percentage > 80) {
    statusBox.className = 'status-box amber';
    statusBox.textContent = 'Approaching limit';
    summaryText.textContent = 'This display is close to the 10-year dose allocation and should be reviewed before final approval.';
  } else {
    statusBox.className = 'status-box green';
    statusBox.textContent = 'Within allocation';
    summaryText.textContent = 'This display remains within the selected 10-year dose allocation for the chosen significance level.';
  }

  document.getElementById('percentValue').textContent = `${percentage.toFixed(1)}%`;
  document.getElementById('limitValue').textContent = fmtLuxHours(limit);
  document.getElementById('exposureValue').textContent = fmtLuxHours(exposureTotal);
}

function handleFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const preview = document.getElementById('itemPreview');
    preview.dataset.image = loadEvent.target.result;
    preview.src = loadEvent.target.result;
    preview.parentElement.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

function drawSlide(exportName = 'collection-light-exposure-slide.jpg') {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');

  const bg = '#f5f6f3';
  const softGrey = '#e7ece8';
  const panel = '#ffffff';
  const text = '#1f2933';
  const accent = '#1d5372';
  const border = '#dfe8df';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#123b52';
  ctx.fillRect(0, 0, canvas.width, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 42px Segoe UI';
  ctx.fillText('Canterbury Museum Collection Item Light Exposure Calculator', 60, 72);

  const status = document.getElementById('statusBox');
  const statusColor = status.classList.contains('red')
    ? '#a1292a'
    : status.classList.contains('amber')
      ? '#b97300'
      : '#237a4f';

  const image = document.getElementById('itemPreview');
  const itemName = document.getElementById('itemName').value || 'Collection Item';
  const significance = getSelectedSignificance();
  const bws = getSelectedBws();
  const exposureTotal = getExposureTotal();
  const limit = getLimitForSelectedBws();
  const percent = limit > 0 ? (exposureTotal / limit) * 100 : 0;

  ctx.fillStyle = panel;
  ctx.fillRect(60, 160, 670, 590);
  ctx.strokeStyle = border;
  ctx.strokeRect(60, 160, 670, 590);

  const imageDataUrl = image && image.dataset.image ? image.dataset.image : '';

  if (imageDataUrl) {
    const img = new Image();
    img.onload = () => {
      const x = 90;
      const y = 200;
      const w = 610;
      const h = 420;
      const ratio = Math.min(w / img.width, h / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      completeSlide();
    };
    img.onerror = () => {
      ctx.fillStyle = softGrey;
      ctx.fillRect(90, 200, 610, 420);
      ctx.fillStyle = '#6b7b7f';
      ctx.font = '600 30px Segoe UI';
      ctx.fillText('No valid item image uploaded', 250, 410);
      completeSlide();
    };
    img.src = imageDataUrl;
  } else {
    ctx.fillStyle = softGrey;
    ctx.fillRect(90, 200, 610, 420);
    ctx.fillStyle = '#6b7b7f';
    ctx.font = '600 30px Segoe UI';
    ctx.fillText('No item image uploaded', 270, 410);
    completeSlide();
  }

  function completeSlide() {
    ctx.fillStyle = panel;
    ctx.fillRect(770, 160, 770, 590);
    ctx.strokeStyle = border;
    ctx.strokeRect(770, 160, 770, 590);

    ctx.fillStyle = text;
    ctx.font = '700 44px Segoe UI';
    ctx.fillText(itemName, 810, 230);

    ctx.fillStyle = accent;
    ctx.font = '700 24px Segoe UI';
    ctx.fillText('BWS Rating', 810, 290);
    ctx.fillStyle = text;
    ctx.font = '700 40px Segoe UI';
    ctx.fillText(`BWS ${String(bws).replace('.0', '')}`, 810, 335);

    ctx.fillStyle = accent;
    ctx.font = '700 24px Segoe UI';
    ctx.fillText('Significance', 810, 390);
    ctx.fillStyle = text;
    ctx.font = '700 34px Segoe UI';
    ctx.fillText(significance.charAt(0).toUpperCase() + significance.slice(1), 810, 435);

    ctx.fillStyle = accent;
    ctx.font = '700 24px Segoe UI';
    ctx.fillText('Lighting details', 810, 495);
    ctx.fillStyle = text;
    ctx.font = '600 24px Segoe UI';

    const mode = state.mode;
    const detailLines = mode === 'continuous'
      ? [
          `Open: ${document.getElementById('continuousDaysOpen').value} days/week`,
          `Hours: ${document.getElementById('continuousExhibitionHours').value} exhibition / ${document.getElementById('continuousCleaningHours').value} cleaning`,
          `Lux: ${document.getElementById('continuousExhibitionLux').value} exhibition / ${document.getElementById('continuousCleaningLux').value} cleaning`,
          `Display: ${document.getElementById('continuousDisplayLength').value} years`
        ]
      : [
          `Open: ${document.getElementById('interactiveDaysOpen').value} days/week`,
          `Exhibition: ${document.getElementById('interactiveExhibitionHours').value}h @ ${document.getElementById('interactiveExhibitionLux').value} lux`,
          `Ambient / Active: ${document.getElementById('ambientLux').value} / ${document.getElementById('activeLux').value} lux`,
          `Cycle: ${document.getElementById('interactiveOnMinutes').value} on / ${document.getElementById('interactiveOffMinutes').value} off mins`
        ];

    detailLines.forEach((line, index) => {
      ctx.fillText(line, 810, 542 + (index * 38));
    });

    ctx.fillStyle = statusColor;
    ctx.fillRect(810, 670, 680, 55);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px Segoe UI';
    ctx.fillText(statusBoxText(), 835, 706);

    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Slide export failed. Please try again.');
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = exportName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }, 'image/jpeg', 0.92);
  }
}

function statusBoxText() {
  const status = document.getElementById('statusBox').textContent.trim();
  return status.length > 35 ? status.substring(0, 34) + '…' : status;
}

const modeButtons = document.querySelectorAll('.mode-button');
modeButtons.forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

document.getElementById('bwsRating').addEventListener('change', updateResults);
document.getElementById('itemName').addEventListener('input', updateResults);
document.querySelectorAll('input[name="significance"]').forEach((input) => {
  input.addEventListener('change', updateResults);
});

document.getElementById('continuousDaysOpen').addEventListener('input', updateResults);
document.getElementById('continuousDisplayLength').addEventListener('change', updateResults);
document.getElementById('continuousExhibitionHours').addEventListener('input', () => {
  updateOutOfHoursDisplay();
  updateResults();
});
document.getElementById('continuousExhibitionLux').addEventListener('input', updateResults);
document.getElementById('continuousCleaningHours').addEventListener('input', () => {
  updateOutOfHoursDisplay();
  updateResults();
});
document.getElementById('continuousCleaningLux').addEventListener('input', updateResults);
document.getElementById('continuousOutHoursLux').addEventListener('input', updateResults);

document.getElementById('interactiveDaysOpen').addEventListener('input', updateResults);
document.getElementById('interactiveDisplayLength').addEventListener('change', updateResults);
document.getElementById('interactiveExhibitionHours').addEventListener('input', updateResults);
document.getElementById('interactiveExhibitionLux').addEventListener('input', updateResults);
document.getElementById('interactiveCleaningHours').addEventListener('input', updateResults);
document.getElementById('interactiveCleaningLux').addEventListener('input', updateResults);
document.getElementById('ambientLux').addEventListener('input', () => {
  updateRangeLabels();
  updateResults();
});
document.getElementById('activeLux').addEventListener('input', () => {
  updateRangeLabels();
  updateResults();
});
document.getElementById('interactiveOnMinutes').addEventListener('input', updateResults);
document.getElementById('interactiveOffMinutes').addEventListener('input', updateResults);

document.getElementById('itemImage').addEventListener('change', handleFileUpload);

document.getElementById('exportButton').addEventListener('click', drawSlide);

updateRangeLabels();
updateOutOfHoursDisplay();
updateResults();

const significanceCards = document.querySelectorAll('.choice-card');
significanceCards.forEach((card) => {
  const input = card.querySelector('input');
  input.addEventListener('change', () => {
    significanceCards.forEach((item) => item.classList.toggle('selected', item.querySelector('input').checked));
  });
});
