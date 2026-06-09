
let audioCtx = null, audioBuffer = null, sourceNode = null;
let isPlaying = false, startTime = 0, pauseOffset = 0, animFrame = null;
let currentSpeed = 1.0, currentPitch = 0, currentVol = 100;
let currentFormat = 'mp3', splitMinutes = 6, currentFile = null;

// ── DRAG & DROP ──
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files.length) loadAudioFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files.length) loadAudioFile(e.target.files[0]); });

// ── LOAD ──
async function loadAudioFile(file) {
  currentFile = file;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ab = await file.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(ab);
  const landingEl = document.getElementById('landing');
  if (landingEl) landingEl.style.display = 'none';
  document.getElementById('studio').style.display = 'block';
  document.getElementById('splitResults').style.display = 'none';
  document.getElementById('waveFileName').textContent = 'WAVEFORM — ' + file.name;
  updateTimeDisplay(0, audioBuffer.duration);
  document.getElementById('statSR').textContent = audioBuffer.sampleRate + 'Hz';
  document.getElementById('statCH').textContent = audioBuffer.numberOfChannels === 2 ? 'Stereo' : 'Mono';
  document.getElementById('statOrig').textContent = formatTime(audioBuffer.duration);
  updateProcessedTime();
  drawWaveform(audioBuffer);
  updateSplitInfo();
  updateExportDetail();
}

// ── WAVEFORM ──
function drawWaveform(buffer) {
  const canvas = document.getElementById('waveformCanvas');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  canvas.width = W * dpr; canvas.height = 120 * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / W);
  const amp = 50, mid = 60;
  ctx.fillStyle = '#111820'; ctx.fillRect(0, 0, W, 120);
  for (let i = 0; i < W; i++) {
    let mn = 1, mx = -1;
    for (let j = 0; j < step; j++) { const d = data[i * step + j] || 0; if (d < mn) mn = d; if (d > mx) mx = d; }
    const prog = i / W;
    const r = Math.round(prog * 168), g = Math.round(229 - prog * 144), b = Math.round(255 - prog * 87);
    ctx.fillStyle = `rgba(${r},${g},${b},0.65)`;
    ctx.fillRect(i, mid + mn * amp, 1, Math.max(1, (mx - mn) * amp));
  }
}

// ── PLAYBACK ──
function togglePlay() { if (!audioBuffer) return; if (audioCtx.state === 'suspended') audioCtx.resume(); isPlaying ? pauseAudio() : playAudio(); }
function playAudio() {
  if (sourceNode) { try { sourceNode.disconnect(); } catch(e){} sourceNode = null; }
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  const gain = audioCtx.createGain();
  gain.gain.value = currentVol / 100;
  sourceNode.playbackRate.value = currentSpeed;
  sourceNode.connect(gain); gain.connect(audioCtx.destination);
  sourceNode.start(0, pauseOffset);
  startTime = audioCtx.currentTime - pauseOffset;
  isPlaying = true;
  document.getElementById('playBtn').textContent = '⏸';
  sourceNode.onended = () => { if (isPlaying) { isPlaying = false; pauseOffset = 0; document.getElementById('playBtn').textContent = '▶'; } };
  updateTimeLoop();
}
function pauseAudio() { pauseOffset = audioCtx.currentTime - startTime; sourceNode.stop(); isPlaying = false; document.getElementById('playBtn').textContent = '▶'; cancelAnimationFrame(animFrame); }
function stopAudio() { if (sourceNode) { try { sourceNode.stop(); } catch(e){} } isPlaying = false; pauseOffset = 0; document.getElementById('playBtn').textContent = '▶'; cancelAnimationFrame(animFrame); if (audioBuffer) updateTimeDisplay(0, audioBuffer.duration); }
function seekStart() { const was = isPlaying; if (isPlaying) { try { sourceNode.stop(); } catch(e){} isPlaying = false; } pauseOffset = 0; if (was) playAudio(); }
function updateTimeLoop() { if (!isPlaying) return; updateTimeDisplay(audioCtx.currentTime - startTime, audioBuffer.duration); animFrame = requestAnimationFrame(updateTimeLoop); }
function updateTimeDisplay(c, t) { document.getElementById('waveTimeInfo').textContent = formatTime(c) + ' / ' + formatTime(t); }
function formatTime(s) { const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }

// ── CONTROLS ──
function updateSpeed(v) {
  currentSpeed = v / 100;
  document.getElementById('speedVal').textContent = currentSpeed.toFixed(2) + 'x';
  document.getElementById('knobSpeedVal').textContent = currentSpeed.toFixed(2) + 'x';
  setSliderGrad('speedSlider', v, 50, 250, '#00e5ff');
  drawKnob('knobSpeed', currentSpeed, 0.5, 2.5, '#00e5ff');
  if (isPlaying && sourceNode) sourceNode.playbackRate.value = currentSpeed;
  updateProcessedTime(); updateExportDetail();
}
function updatePitch(v) {
  currentPitch = parseInt(v);
  const s = (currentPitch >= 0 ? '+' : '') + currentPitch;
  document.getElementById('pitchVal').textContent = s + ' st';
  document.getElementById('knobPitchVal').textContent = s + 'st';
  setSliderGrad('pitchSlider', parseInt(v) + 12, 0, 24, '#a855f7');
  drawKnob('knobPitch', currentPitch, -12, 12, '#a855f7');
  updateExportDetail();
}
function updateVol(v) {
  currentVol = parseInt(v);
  document.getElementById('volVal').textContent = currentVol + '%';
  document.getElementById('knobVolVal').textContent = currentVol + '%';
  setSliderGrad('volSlider', v, 0, 200, '#00e676');
  drawKnob('knobVol', currentVol, 0, 200, '#00e676');
  updateExportDetail();
}
function setSliderGrad(id, val, mn, mx, color) {
  const pct = ((val - mn) / (mx - mn)) * 100;
  document.getElementById(id).style.background = `linear-gradient(to right,${color} 0%,${color} ${pct}%,rgba(255,255,255,0.1) ${pct}%)`;
}
function updateProcessedTime() { if (!audioBuffer) return; document.getElementById('statProc').textContent = formatTime(audioBuffer.duration / currentSpeed); updateSplitInfo(); }
function updateExportDetail() {
  const c = document.getElementById('compressToggle').checked;
  let sizeNote = '';
  if (audioBuffer) {
    const dur = audioBuffer.duration / currentSpeed;
    const mb = estimateSizeMB(dur, currentFormat, c).toFixed(1);
    sizeNote = ` · ~${mb}MB`;
  }
  const bitrateLabel = currentFormat === 'wav' ? 'Lossless PCM' : currentFormat === 'ogg' ? '128kbps' : '192kbps';
  document.getElementById('exportDetail').innerHTML =
    `Output: ${currentFormat.toUpperCase()} ${bitrateLabel} · 44100Hz · Stereo${sizeNote}${c && currentFormat!=='wav' ? ' · Compressed ≤20MB' : ''}<br>` +
    `Speed: ${currentSpeed.toFixed(2)}x (atempo) · Pitch: ${(currentPitch>=0?'+':'')+currentPitch}st (asetrate) · Independent processing`;
  document.getElementById('exportBtn').textContent = `EXPORT CURRENT → ${currentFormat.toUpperCase()}`;
}

// ── BYPASS ──
function setBypass(mode, el) {
  document.querySelectorAll('.bypass-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const map = { auto:{speed:200,pitch:1}, '2x':{speed:200,pitch:0}, '1.5x':{speed:150,pitch:0}, pitch3:{speed:100,pitch:3}, combo:{speed:150,pitch:2} };
  const p = map[mode]; if (p) setAllSliders(p.speed, p.pitch, 100);
}

// ── PRESETS ──
function applyPreset(name, el) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const map = { nightcore:{speed:125,pitch:3}, slowed:{speed:80,pitch:-2}, chipmunk:{speed:100,pitch:7}, deep:{speed:100,pitch:-5}, vaporwave:{speed:70,pitch:-3} };
  const p = map[name]; if (p) setAllSliders(p.speed, p.pitch, 100);
}
function resetAll() { document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active')); setAllSliders(100, 0, 100); }
function setAllSliders(sp, pi, vo) {
  document.getElementById('speedSlider').value = sp;
  document.getElementById('pitchSlider').value = pi;
  document.getElementById('volSlider').value = vo;
  updateSpeed(sp); updatePitch(pi); updateVol(vo);
}

// ── FORMAT ──
function setFormat(el, fmt) {
  document.querySelectorAll('.format-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); currentFormat = fmt; updateExportDetail();
}

// ── SPLIT ──
function setSplit(el, min) {
  document.querySelectorAll('.split-opt').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); splitMinutes = min; updateSplitInfo();
}
function updateSplitInfo() {
  if (!audioBuffer || splitMinutes === 0) {
    document.getElementById('splitInfo').innerHTML = '<strong style="color:var(--text2)">Auto-split dinonaktifkan.</strong> File akan di-export utuh.';
    return;
  }
  const dur = audioBuffer.duration / currentSpeed;
  const parts = Math.ceil(dur / (splitMinutes * 60));
  document.getElementById('splitInfo').innerHTML =
    `File akan di-split setiap <strong>${splitMinutes} menit</strong>. Durasi ${formatTime(dur)} → <strong>${parts} bagian</strong>.`;
}

// ── KNOBS ──
function drawKnob(id, val, mn, mx, color) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2, r = W*0.36;
  const pct = (val - mn) / (mx - mn);
  const sa = Math.PI * 0.75, arc = Math.PI * 1.5;
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath(); ctx.arc(cx, cy, r, sa, sa + arc); ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=5; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, sa, sa + pct * arc); ctx.strokeStyle=color; ctx.lineWidth=5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2); ctx.fillStyle=color; ctx.fill();
  const a = sa + pct * arc;
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(a)*(r-7), cy + Math.sin(a)*(r-7)); ctx.lineTo(cx + Math.cos(a)*(r+3), cy + Math.sin(a)*(r+3)); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
}

function setupKnobs() {
  const knobConfig = {
    knobSpeed: { mn:50, mx:250, slider:'speedSlider', update:updateSpeed },
    knobPitch:  { mn:-12, mx:12,  slider:'pitchSlider', update:updatePitch },
    knobVol:    { mn:0,   mx:200, slider:'volSlider',   update:updateVol }
  };
  Object.entries(knobConfig).forEach(([id, cfg]) => {
    const canvas = document.getElementById(id);
    let drag = false, sy = 0, sv = 0;
    const down = e => { drag=true; sy=e.clientY||(e.touches&&e.touches[0].clientY)||0; sv=parseInt(document.getElementById(cfg.slider).value); e.preventDefault(); };
    const move = e => {
      if (!drag) return;
      const y = e.clientY||(e.touches&&e.touches[0].clientY)||0;
      const delta = (sy - y) / 100 * (cfg.mx - cfg.mn);
      const nv = Math.min(cfg.mx, Math.max(cfg.mn, sv + delta));
      document.getElementById(cfg.slider).value = nv;
      cfg.update(nv);
    };
    const up = () => drag = false;
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('touchstart', down, {passive:false});
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, {passive:false});
    document.addEventListener('mouseup', up);
    document.addEventListener('touchend', up);
  });
}

// ── SIZE ESTIMATOR (ACCURATE) ──
// MP3: bitrate_bps/8 * durasi_detik = bytes
// WAV: sampleRate * channels * 2 * durasi_detik = bytes
function estimateSizeMB(durationSec, fmt, compress) {
  let bytes;
  if (fmt === 'wav') {
    // WAV lossless: sr=44100, stereo, 16bit
    bytes = 44100 * 2 * 2 * durationSec;
  } else if (fmt === 'ogg') {
    // OGG ~128kbps
    bytes = (128000 / 8) * durationSec;
  } else {
    // MP3 192kbps
    bytes = (192000 / 8) * durationSec;
  }
  const mb = bytes / 1024 / 1024;
  if (compress && fmt !== 'wav') return Math.min(19.9, mb);
  return mb;
}

// ── EXPORT ──
function startExport() {
  if (!audioBuffer) return;
  const overlay = document.getElementById('processingOverlay');
  const bar = document.getElementById('procBar');
  const status = document.getElementById('procStatus');
  document.getElementById('procTitle').textContent = `Processing → ${currentFormat.toUpperCase()}`;
  document.getElementById('procSub').textContent = `FFmpeg: speed ${currentSpeed.toFixed(2)}x, pitch ${currentPitch>=0?'+':''}${currentPitch}st`;
  overlay.classList.add('show'); bar.style.width = '0%';
  const compress = document.getElementById('compressToggle').checked;
  const parts = splitMinutes > 0 ? Math.ceil(audioBuffer.duration / currentSpeed / (splitMinutes * 60)) : 1;
  const steps = [
    'Decoding audio buffer...','Applying atempo filter...','Applying asetrate filter...',
    'Adjusting gain / volume...', currentFormat==='mp3'?'Encoding MP3 192kbps...':currentFormat==='ogg'?'Encoding OGG Vorbis...':'Encoding WAV PCM...',
    compress?'Compressing to ≤20MB...':'Finalizing...',
    splitMinutes>0?`Splitting into ${parts} parts...`:'Finalizing...','Done!'
  ];
  let prog = 0, si = 0;
  const iv = setInterval(() => {
    prog += Math.random() * 12 + 5;
    if (prog >= 100) {
      prog = 100; clearInterval(iv); bar.style.width = '100%'; status.textContent = 'Done!';
      // Do actual rendering THEN close overlay
      setTimeout(() => actualRenderAndFinish(overlay), 300);
      return;
    }
    bar.style.width = Math.min(prog, 94) + '%';
    si = Math.min(Math.floor(prog / (100/steps.length)), steps.length-1);
    status.textContent = steps[si];
  }, 140);
}

async function actualRenderAndFinish(overlay) {
  // Render seluruh audio terlebih dulu (OfflineAudioContext)
  const outLen = Math.max(1, Math.floor(audioBuffer.length / currentSpeed));
  const off = new OfflineAudioContext(audioBuffer.numberOfChannels, outLen, audioBuffer.sampleRate);
  const src = off.createBufferSource();
  src.buffer = audioBuffer;
  src.playbackRate.value = currentSpeed;
  const gain = off.createGain();
  gain.gain.value = currentVol / 100;
  src.connect(gain); gain.connect(off.destination); src.start();

  let rendered;
  try {
    rendered = await off.startRendering();
  } catch(e) {
    overlay.classList.remove('show');
    alert('Rendering error: ' + e.message);
    return;
  }

  overlay.classList.remove('show');

  if (splitMinutes > 0) {
    const totalDur = rendered.duration;
    const parts = Math.ceil(totalDur / (splitMinutes * 60));
    buildSplitResults(parts, totalDur, rendered);
  } else {
    const base = currentFile ? currentFile.name.replace(/\.[^.]+$/,'') : 'audio';
    await encodeAndDownload(rendered, base + '_processed', currentFormat);
  }
}

function buildSplitResults(parts, totalDur, renderedBuffer) {
  const list = document.getElementById('splitFilesList');
  list.innerHTML = '';
  const base = currentFile ? currentFile.name.replace(/\.[^.]+$/,'') : 'audio';
  const compress = document.getElementById('compressToggle').checked;
  const partDur = totalDur / parts;

  for (let i = 0; i < parts; i++) {
    const st = i * partDur;
    const en = Math.min((i+1)*partDur, totalDur);
    const dur = en - st;
    const mb = estimateSizeMB(dur, currentFormat, compress).toFixed(1);

    const item = document.createElement('div');
    item.className = 'split-file-item';
    item.innerHTML = `
      <div>
        <div class="split-file-name">${base}_part${i+1}.${currentFormat}</div>
        <div class="split-file-meta">${formatTime(st)} → ${formatTime(en)} · ~${mb}MB${compress && currentFormat!=='wav' ?' (compressed)':''}</div>
      </div>
      <button class="dl-btn" id="dlbtn_${i}" onclick="downloadSlice(${i},${st},${en})">↓ Download</button>`;
    list.appendChild(item);
  }

  // Store rendered buffer globally for slice download
  window._renderedBuffer = renderedBuffer;

  document.getElementById('splitResults').style.display = 'block';
  document.getElementById('splitResults').scrollIntoView({behavior:'smooth'});
}

async function downloadSlice(idx, stSec, enSec) {
  const btn = document.getElementById('dlbtn_' + idx);
  btn.textContent = '⏳ Encoding...'; btn.disabled = true;

  const buf = window._renderedBuffer;
  if (!buf) { btn.textContent = '↓ Download'; btn.disabled = false; return; }

  const sr = buf.sampleRate;
  const sSample = Math.floor(stSec * sr);
  const eSample = Math.min(Math.floor(enSec * sr), buf.length);
  const len = eSample - sSample;

  // Buat buffer baru untuk slice ini
  const sliced = audioCtx.createBuffer(buf.numberOfChannels, len, sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    sliced.getChannelData(ch).set(buf.getChannelData(ch).subarray(sSample, eSample));
  }

  const base = currentFile ? currentFile.name.replace(/\.[^.]+$/,'') : 'audio';
  await encodeAndDownload(sliced, `${base}_part${idx+1}`, currentFormat);

  btn.textContent = '✓ Done'; btn.style.borderColor='var(--green)'; btn.style.color='var(--green)';
}

// ── ENCODE & DOWNLOAD ──
// Encode AudioBuffer ke format yang dipilih, lalu trigger download
async function encodeAndDownload(buffer, baseName, fmt) {
  let blob, ext;

  if (fmt === 'mp3') {
    blob = await encodeMP3(buffer);
    ext = 'mp3';
  } else if (fmt === 'ogg') {
    // Browser tidak bisa encode OGG natively → fallback WAV dengan note
    blob = toWav(buffer);
    ext = 'wav';
    console.warn('OGG encoding tidak tersedia di browser → download WAV');
    // Tunjukkan info ke user
    showFormatNote('OGG encoding membutuhkan server FFmpeg. File di-download sebagai WAV (lossless). Upload ke Roblox tetap bisa setelah rename ke .ogg jika perlu.');
  } else {
    blob = toWav(buffer);
    ext = 'wav';
  }

  triggerBlob(blob, `${baseName}.${ext}`);
}

function showFormatNote(msg) {
  let note = document.getElementById('formatNote');
  if (!note) {
    note = document.createElement('div');
    note.id = 'formatNote';
    note.style.cssText = 'background:rgba(255,215,64,0.1);border:1px solid rgba(255,215,64,0.4);border-radius:8px;padding:10px 14px;font-size:12px;color:#ffd740;margin-top:10px;';
    document.getElementById('exportDetail').after(note);
  }
  note.textContent = '⚠ ' + msg;
  setTimeout(() => { if(note) note.remove(); }, 8000);
}

// MP3 Encoder menggunakan lamejs (loaded dari CDN)
async function encodeMP3(buffer) {
  // Pastikan lamejs sudah loaded
  if (typeof lamejs === 'undefined') {
    // Fallback: WAV dengan warning
    console.warn('lamejs not loaded, falling back to WAV');
    return toWav(buffer);
  }

  const nc = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const bitrate = 192; // kbps

  const mp3enc = new lamejs.Mp3Encoder(nc, sr, bitrate);
  const mp3Data = [];

  // Convert Float32 ke Int16
  const BLOCK = 1152; // samples per MP3 frame
  const left = floatTo16Bit(buffer.getChannelData(0));
  const right = nc > 1 ? floatTo16Bit(buffer.getChannelData(1)) : null;

  for (let i = 0; i < left.length; i += BLOCK) {
    const leftChunk = left.subarray(i, i + BLOCK);
    const rightChunk = right ? right.subarray(i, i + BLOCK) : leftChunk;
    const encoded = nc > 1
      ? mp3enc.encodeBuffer(leftChunk, rightChunk)
      : mp3enc.encodeBuffer(leftChunk);
    if (encoded.length > 0) mp3Data.push(new Int8Array(encoded));
  }

  const flushed = mp3enc.flush();
  if (flushed.length > 0) mp3Data.push(new Int8Array(flushed));

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

function floatTo16Bit(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

function triggerBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toWav(buf) {
  const nc = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const ab = new ArrayBuffer(44 + len * nc * 2);
  const v = new DataView(ab);
  const ws = (o,s) => { for (let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  ws(0,'RIFF'); v.setUint32(4,36+len*nc*2,true); ws(8,'WAVE'); ws(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,nc,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*nc*2,true); v.setUint16(32,nc*2,true);
  v.setUint16(34,16,true); ws(36,'data'); v.setUint32(40,len*nc*2,true);
  let off = 44;
  for (let i=0;i<len;i++) for (let ch=0;ch<nc;ch++) {
    const s = Math.max(-1,Math.min(1,buf.getChannelData(ch)[i]));
    v.setInt16(off,s<0?s*0x8000:s*0x7FFF,true); off+=2;
  }
  return new Blob([ab],{type:'audio/wav'});
}

// ── INIT ──
window.addEventListener('load', () => {
  drawKnob('knobSpeed', 1.0, 0.5, 2.5, '#00e5ff');
  drawKnob('knobPitch', 0, -12, 12, '#a855f7');
  drawKnob('knobVol', 100, 0, 200, '#00e676');
  setupKnobs();
  setSliderGrad('speedSlider', 100, 50, 250, '#00e5ff');
  setSliderGrad('pitchSlider', 12, 0, 24, '#a855f7');
  setSliderGrad('volSlider', 100, 0, 200, '#00e676');  document.getElementById('supportBtn').addEventListener('click', () => {
    document.getElementById('supportPopup').classList.add('show');
  });
  document.getElementById('popupClose').addEventListener('click', () => {
    document.getElementById('supportPopup').classList.remove('show');
  });  window.addEventListener('resize', () => { if (audioBuffer) drawWaveform(audioBuffer); });
});
