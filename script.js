// ============================================
//  ITS OKE COMMUNITY — Roblox Music Tool
//  FFmpeg.wasm powered audio processor
// ============================================

// ─── TAB SWITCHING ───
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + target).classList.add('active');
  });
});

// ─── STATE ───
let files = [];          // { id, file, name, sizeMB, durationSec, url, processedBlob, processedUrl }
let ffmpegLoaded = false;
let ffmpegInstance = null;

// ─── FFMPEG LOADER ───
async function loadFFmpeg() {
  if (ffmpegLoaded) return true;
  showLoader('Memuat FFmpeg... (pertama kali agak lama ~15 detik)');
  try {
    const { createFFmpeg, fetchFile } = FFmpeg;
    ffmpegInstance = createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    });
    await ffmpegInstance.load();
    ffmpegLoaded = true;
    hideLoader();
    return true;
  } catch (e) {
    hideLoader();
    let message = 'Gagal memuat FFmpeg. Pastikan halaman dijalankan lewat server HTTPS dan mendukung SharedArrayBuffer.';
    if (e.message && e.message.includes('SharedArrayBuffer')) {
      message += '\nGunakan hosting dengan header Cross-Origin-Opener-Policy dan Cross-Origin-Embedder-Policy, misalnya Vercel.';
    }
    message += '\n\n' + e.message;
    alert(message);
    return false;
  }
}

// ─── LOADER UI ───
function showLoader(msg) {
  document.getElementById('loaderOverlay').style.display = 'flex';
  document.getElementById('loaderText').textContent = msg || 'Memproses...';
}

function hideLoader() {
  document.getElementById('loaderOverlay').style.display = 'none';
}

// ─── FILE INPUT & DROP ───
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', (e) => {
  if (e.target.tagName !== 'LABEL') fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles([...e.dataTransfer.files]);
});

fileInput.addEventListener('change', () => {
  handleFiles([...fileInput.files]);
  fileInput.value = '';
});

// ─── HANDLE FILES ───
function handleFiles(newFiles) {
  const audio = newFiles.filter(f => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|flac|aac|m4a)$/i.test(f.name));
  if (!audio.length) return alert('File yang dipilih bukan audio!');

  audio.forEach(file => {
    const id  = Date.now() + Math.random();
    const url = URL.createObjectURL(file);
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);

    const entry = { id, file, name: file.name, sizeMB, durationSec: null, url, processedBlob: null, processedUrl: null };
    files.push(entry);

    // Get duration via Audio element
    const tmpAudio = new Audio(url);
    tmpAudio.addEventListener('loadedmetadata', () => {
      entry.durationSec = tmpAudio.duration;
      renderFileList();
    });
  });

  renderFileList();
  document.getElementById('controlsSection').style.display = 'block';
  document.getElementById('previewSection').style.display = 'block';
  renderPreviewList();
}

// ─── FORMAT HELPERS ───
function fmtDur(sec) {
  if (!sec) return '...';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function getStatus(entry) {
  if (!entry.durationSec) return { cls: 'ok', txt: 'OK' };
  if (parseFloat(entry.sizeMB) > 20) return { cls: 'warn', txt: '> 20MB (akan dikompres)' };
  if (entry.durationSec > 7 * 60) return { cls: 'warn', txt: '> 7 menit (warning)' };
  return { cls: 'ok', txt: 'OK' };
}

// ─── RENDER FILE LIST ───
function renderFileList() {
  const el = document.getElementById('fileList');
  if (!files.length) { el.innerHTML = ''; return; }

  el.innerHTML = files.map(entry => {
    const status = getStatus(entry);
    return `
    <div class="file-item" data-id="${entry.id}">
      <div class="file-icon">🎵</div>
      <div class="file-info">
        <div class="file-name">${entry.name}</div>
        <div class="file-meta">${entry.sizeMB} MB · ${fmtDur(entry.durationSec)}</div>
      </div>
      <span class="file-status ${status.cls}">${status.txt}</span>
      <button class="file-remove" onclick="removeFile('${entry.id}')">✕</button>
    </div>`;
  }).join('');
}

function removeFile(id) {
  files = files.filter(f => String(f.id) !== String(id));
  renderFileList();
  renderPreviewList();
  if (!files.length) {
    document.getElementById('controlsSection').style.display = 'none';
    document.getElementById('previewSection').style.display = 'none';
  }
}

// ─── CONTROLS ───
const sliders = {
  speed:  { el: document.getElementById('speed'),  val: document.getElementById('speedVal'),  fmt: v => `${parseFloat(v).toFixed(2)}x` },
  pitch:  { el: document.getElementById('pitch'),  val: document.getElementById('pitchVal'),  fmt: v => `${parseFloat(v) >= 0 ? '+' : ''}${parseFloat(v).toFixed(1)} semitones` },
  bass:   { el: document.getElementById('bass'),   val: document.getElementById('bassVal'),   fmt: v => `${parseFloat(v) >= 0 ? '+' : ''}${v} dB` },
  treble: { el: document.getElementById('treble'), val: document.getElementById('trebleVal'), fmt: v => `${parseFloat(v) >= 0 ? '+' : ''}${v} dB` },
  reverb: { el: document.getElementById('reverb'), val: document.getElementById('reverbVal'), fmt: v => `${v}%` },
  volume: { el: document.getElementById('volume'), val: document.getElementById('volumeVal'), fmt: v => `${v}%` },
};

Object.entries(sliders).forEach(([key, s]) => {
  s.el.addEventListener('input', () => {
    s.val.textContent = s.fmt(s.el.value);
  });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  sliders.speed.el.value  = 1;   sliders.speed.val.textContent  = '1.00x';
  sliders.pitch.el.value  = 0;   sliders.pitch.val.textContent  = '+0.0 semitones';
  sliders.bass.el.value   = 0;   sliders.bass.val.textContent   = '+0 dB';
  sliders.treble.el.value = 0;   sliders.treble.val.textContent = '+0 dB';
  sliders.reverb.el.value = 0;   sliders.reverb.val.textContent = '0%';
  sliders.volume.el.value = 100; sliders.volume.val.textContent = '100%';
});

document.getElementById('applyBtn').addEventListener('click', async () => {
  if (!files.length) return alert('Upload dulu musik bro!');
  const ok = await loadFFmpeg();
  if (!ok) return;
  await processAll();
});

// ─── GET CONTROLS VALUES ───
function getControls() {
  return {
    speed:  parseFloat(sliders.speed.el.value),
    pitch:  parseFloat(sliders.pitch.el.value),
    bass:   parseInt(sliders.bass.el.value),
    treble: parseInt(sliders.treble.el.value),
    reverb: parseInt(sliders.reverb.el.value),
    volume: parseInt(sliders.volume.el.value),
  };
}

// ─── BUILD FFMPEG FILTER STRING ───
function buildFilter(ctrl) {
  const filters = [];

  // Volume
  if (ctrl.volume !== 100) {
    filters.push(`volume=${ctrl.volume / 100}`);
  }

  // Bass (low shelf EQ)
  if (ctrl.bass !== 0) {
    filters.push(`equalizer=f=100:t=o:w=200:g=${ctrl.bass}`);
  }

  // Treble (high shelf EQ)
  if (ctrl.treble !== 0) {
    filters.push(`equalizer=f=8000:t=o:w=4000:g=${ctrl.treble}`);
  }

  // Reverb (aecho)
  if (ctrl.reverb > 0) {
    const wet = (ctrl.reverb / 100).toFixed(2);
    const dry = (1 - ctrl.reverb / 200).toFixed(2);
    filters.push(`aecho=${dry}:${wet}:60:0.4`);
  }

  // Pitch shift (atempo + asetrate trick)
  const pitchFactor = Math.pow(2, ctrl.pitch / 12);
  if (Math.abs(pitchFactor - 1) > 0.01) {
    filters.push(`asetrate=44100*${pitchFactor.toFixed(4)},aresample=44100`);
  }

  // Speed (atempo, supports 0.5-2.0)
  if (Math.abs(ctrl.speed - 1) > 0.01) {
    let speed = ctrl.speed;
    // atempo only allows 0.5-2.0, chain if needed
    if (speed > 2) {
      filters.push(`atempo=2.0,atempo=${(speed / 2).toFixed(3)}`);
    } else if (speed < 0.5) {
      filters.push(`atempo=0.5,atempo=${(speed / 0.5).toFixed(3)}`);
    } else {
      filters.push(`atempo=${speed.toFixed(3)}`);
    }
  }

  return filters.length ? filters.join(',') : null;
}

// ─── PROCESS ALL FILES ───
async function processAll() {
  const ctrl = getControls();

  for (let i = 0; i < files.length; i++) {
    const entry = files[i];
    showLoader(`Memproses ${i + 1}/${files.length}: ${entry.name}`);
    try {
      entry.processedBlob = await processFile(entry, ctrl);
      if (entry.processedUrl) URL.revokeObjectURL(entry.processedUrl);
      entry.processedUrl = URL.createObjectURL(entry.processedBlob);
    } catch (e) {
      console.error('Error processing', entry.name, e);
    }
  }

  hideLoader();
  renderPreviewList();
}

// ─── PROCESS SINGLE FILE with FFmpeg ───
async function processFile(entry, ctrl) {
  const { fetchFile } = FFmpeg;
  const ff = ffmpegInstance;

  const inputExt  = entry.name.split('.').pop().toLowerCase();
  const inputName = `input_${entry.id}.${inputExt}`;
  const outputName = `output_${entry.id}.wav`; // process as WAV first

  ff.FS('writeFile', inputName, await fetchFile(entry.file));

  const filterStr = buildFilter(ctrl);
  const ffArgs = ['-i', inputName];

  if (filterStr) {
    ffArgs.push('-af', filterStr);
  }

  // Trim to 7 minutes if over
  if (entry.durationSec && entry.durationSec > 7 * 60) {
    ffArgs.push('-t', '420');
  }

  ffArgs.push('-ar', '44100', '-ac', '2', outputName);

  await ff.run(...ffArgs);
  const data = ff.FS('readFile', outputName);

  // Cleanup
  try { ff.FS('unlink', inputName); } catch(e) {}
  try { ff.FS('unlink', outputName); } catch(e) {}

  return new Blob([data.buffer], { type: 'audio/wav' });
}

// ─── CONVERT TO OGG or MP3 (final format) ───
async function convertFinal(blob, id, targetFmt) {
  const ff = ffmpegInstance;
  const { fetchFile } = FFmpeg;

  const inputName  = `final_in_${id}.wav`;
  const outputName = `final_out_${id}.${targetFmt}`;
  const mimeType   = targetFmt === 'ogg' ? 'audio/ogg' : 'audio/mpeg';

  ff.FS('writeFile', inputName, await fetchFile(blob));

  const args = ['-i', inputName];

  if (targetFmt === 'ogg') {
    // Target ~128kbps OGG, max 20MB
    args.push('-c:a', 'libvorbis', '-q:a', '4');
  } else {
    // MP3 128kbps
    args.push('-c:a', 'libmp3lame', '-b:a', '128k');
  }

  args.push(outputName);
  await ff.run(...args);

  const data = ff.FS('readFile', outputName);

  try { ff.FS('unlink', inputName); } catch(e) {}
  try { ff.FS('unlink', outputName); } catch(e) {}

  let resultBlob = new Blob([data.buffer], { type: mimeType });

  // If still > 20MB, re-encode at lower bitrate
  if (resultBlob.size > 20 * 1024 * 1024) {
    resultBlob = await compressBlob(resultBlob, id, targetFmt);
  }

  return resultBlob;
}

async function compressBlob(blob, id, fmt) {
  const ff = ffmpegInstance;
  const { fetchFile } = FFmpeg;
  const inputName  = `comp_in_${id}.${fmt}`;
  const outputName = `comp_out_${id}.${fmt}`;
  const mimeType   = fmt === 'ogg' ? 'audio/ogg' : 'audio/mpeg';

  ff.FS('writeFile', inputName, await fetchFile(blob));

  const args = ['-i', inputName];
  if (fmt === 'ogg') {
    args.push('-c:a', 'libvorbis', '-q:a', '1'); // lower quality = smaller
  } else {
    args.push('-c:a', 'libmp3lame', '-b:a', '64k');
  }
  args.push(outputName);
  await ff.run(...args);

  const data = ff.FS('readFile', outputName);
  try { ff.FS('unlink', inputName); } catch(e) {}
  try { ff.FS('unlink', outputName); } catch(e) {}

  return new Blob([data.buffer], { type: mimeType });
}

// ─── RENDER PREVIEW LIST ───
function renderPreviewList() {
  const el = document.getElementById('previewList');
  if (!files.length) {
    el.innerHTML = `<div class="preview-empty">Upload musik di atas untuk melihat preview, memproses file, dan menyiapkan download audio.</div>`;
    return;
  }

  el.innerHTML = files.map(entry => {
    const hasProcessed = !!entry.processedUrl;
    return `
    <div class="preview-item" id="preview-${entry.id}">
      <div class="preview-item-name">🎵 ${entry.name}</div>
      <div class="preview-row">
        <div class="preview-col">
          <div class="preview-col-label">🔊 Original (Before)</div>
          <audio controls src="${entry.url}"></audio>
        </div>
        <div class="preview-col">
          <div class="preview-col-label">✨ Processed (After)</div>
          ${hasProcessed
            ? `<audio controls src="${entry.processedUrl}"></audio>`
            : `<button class="preview-process-btn" onclick="processSingle('${entry.id}')">▶ Proses & Preview File Ini</button>`
          }
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── PROCESS SINGLE (from preview button) ───
async function processSingle(id) {
  const entry = files.find(f => String(f.id) === String(id));
  if (!entry) return;

  const ok = await loadFFmpeg();
  if (!ok) return;

  const ctrl = getControls();
  showLoader(`Memproses: ${entry.name}`);

  try {
    entry.processedBlob = await processFile(entry, ctrl);
    if (entry.processedUrl) URL.revokeObjectURL(entry.processedUrl);
    entry.processedUrl = URL.createObjectURL(entry.processedBlob);
  } catch (e) {
    alert('Gagal proses file: ' + e.message);
  }

  hideLoader();
  renderPreviewList();
}

// ─── DOWNLOAD ALL ───
document.getElementById('downloadAllBtn').addEventListener('click', async () => {
  const fmt = document.querySelector('input[name="fmt"]:checked').value;

  const toDownload = files.filter(f => f.processedBlob);
  const toProcess  = files.filter(f => !f.processedBlob);

  if (!toDownload.length && !toProcess.length) {
    return alert('Tidak ada file yang bisa didownload. Upload dan proses dulu!');
  }

  const ok = await loadFFmpeg();
  if (!ok) return;

  // Process unprocessed files first
  if (toProcess.length) {
    const ctrl = getControls();
    for (let i = 0; i < toProcess.length; i++) {
      const entry = toProcess[i];
      showLoader(`Memproses ${i + 1}/${toProcess.length}: ${entry.name}`);
      try {
        entry.processedBlob = await processFile(entry, ctrl);
        if (entry.processedUrl) URL.revokeObjectURL(entry.processedUrl);
        entry.processedUrl = URL.createObjectURL(entry.processedBlob);
      } catch(e) {
        console.error(e);
      }
    }
    renderPreviewList();
  }

  // Now convert & download all
  for (let i = 0; i < files.length; i++) {
    const entry = files[i];
    if (!entry.processedBlob) continue;

    showLoader(`Mengkonversi ke ${fmt.toUpperCase()}: ${entry.name} (${i+1}/${files.length})`);

    try {
      const finalBlob = await convertFinal(entry.processedBlob, entry.id, fmt);
      const baseName  = entry.name.replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(finalBlob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${baseName}_oke.${fmt}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch(e) {
      console.error('Download error:', e);
    }
  }

  hideLoader();
});

// ─── EXPOSE GLOBALS ───
window.removeFile   = removeFile;
window.processSingle = processSingle;
window.openQrModal = openQrModal;
window.closeQrModal = closeQrModal;

function openQrModal() {
  const modal = document.getElementById('qrModal');
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeQrModal() {
  const modal = document.getElementById('qrModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

document.addEventListener('click', (event) => {
  const modal = document.getElementById('qrModal');
  if (!modal || !modal.classList.contains('active')) return;

  if (event.target === modal || event.target.closest('#qrModalClose')) {
    closeQrModal();
  }
});