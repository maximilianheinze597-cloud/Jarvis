'use strict';

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const formEl = document.getElementById('inputForm');
const listenBtn = document.getElementById('listenBtn');
const speakToggle = document.getElementById('speakToggle');
const clearBtn = document.getElementById('clearBtn');
const micStatus = document.getElementById('micStatus');
const connStatus = document.getElementById('connStatus');
const netState = document.getElementById('netState');
const voiceSelect = document.getElementById('voiceSelect');
const rateEl = document.getElementById('rate');
const pitchEl = document.getElementById('pitch');

const messages = [];
let voiceEnabled = true;
let listening = false;
let recognition = null;
let selectedVoice = null;
let useElevenLabs = false;
let currentAudio = null;
let finalTranscript = '';

// ---------- Chat UI ----------
function addMsg(role, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'user' : 'jarvis');
  div.innerHTML = `<div class="who">${role === 'user' ? 'YOU' : 'JARVIS'}</div>${escapeHtml(text)}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Suit visualizer ----------
const helmetEl = document.getElementById('helmet');
const faceplateEl = document.getElementById('faceplate');
const eyesEl = document.getElementById('eyes');

function suitAction(action) {
  if (!helmetEl) return;
  if (action === 'zoom') {
    helmetEl.classList.add('zoomed');
  } else if (action === 'open') {
    faceplateEl.classList.add('open');
  } else if (action === 'close') {
    faceplateEl.classList.remove('open');
  } else if (action === 'light') {
    eyesEl.classList.add('lit');
    setTimeout(() => eyesEl.classList.remove('lit'), 4000);
  } else if (action === 'reset') {
    helmetEl.classList.remove('zoomed');
    faceplateEl.classList.remove('open');
    eyesEl.classList.remove('lit');
  }
}

function detectSuitCommand(text) {
  const q = text.toLowerCase();
  let handled = false;
  if (q.includes('zoom') || q.includes('reinzoom') || q.includes('helm')) { suitAction('zoom'); handled = true; }
  if (q.includes('klappe') && (q.includes('öff') || q.includes('open'))) { suitAction('open'); handled = true; }
  if (q.includes('schließen') || q.includes('close')) { suitAction('close'); handled = true; }
  if (q.includes('beleucht') || q.includes('light') || q.includes('licht') || q.includes('illum')) { suitAction('light'); handled = true; }
  if (q.includes('reset') || q.includes('zurücksetzen')) { suitAction('reset'); handled = true; }
  return handled;
}

async function sendToJarvis(text) {
  if (!text.trim()) return;
  detectSuitCommand(text);
  addMsg('user', text);
  messages.push({ role: 'user', content: text });
  const typing = document.createElement('div');
  typing.className = 'msg jarvis';
  typing.innerHTML = '<div class="who">JARVIS</div>...';
  chatEl.appendChild(typing);
  chatEl.scrollTop = chatEl.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await res.json();
    typing.remove();
    const reply = data.reply || data.error || 'No response.';
    addMsg('jarvis', reply);
    messages.push({ role: 'assistant', content: reply });
    if (voiceEnabled) speak(reply);
  } catch (e) {
    typing.remove();
    addMsg('jarvis', 'Connection error, Sir. ' + e.message);
  }
}

// ---------- TTS ----------
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  voices.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    voiceSelect.appendChild(opt);
  });
  const preferred = voices.findIndex(v => /en/i.test(v.lang) && /daniel|alex|google uk english male|male/i.test(v.name));
  const idx = preferred >= 0 ? preferred : 0;
  voiceSelect.value = idx;
  selectedVoice = voices[idx];
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

voiceSelect.addEventListener('change', () => {
  const voices = speechSynthesis.getVoices();
  selectedVoice = voices[parseInt(voiceSelect.value, 10)];
});

async function speak(text) {
  // Try ElevenLabs first if configured
  if (useElevenLabs) {
    try {
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      console.warn('ElevenLabs TTS failed, falling back to browser TTS', e);
    }
  }
  // Browser TTS fallback
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (selectedVoice) u.voice = selectedVoice;
  u.rate = parseFloat(rateEl.value);
  u.pitch = parseFloat(pitchEl.value);
  u.lang = selectedVoice ? selectedVoice.lang : 'en-US';
  speechSynthesis.speak(u);
}

// ---------- STT ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function initRecognition() {
  if (!SpeechRecognition) {
    micStatus.textContent = 'MIC: UNSUPPORTED';
    return null;
  }
  const r = new SpeechRecognition();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';

  r.onstart = () => {
    listening = true;
    listenBtn.classList.add('listening');
    micStatus.textContent = 'MIC: LISTENING';
    micStatus.classList.add('listening');
  };
  r.onend = () => {
    listening = false;
    listenBtn.classList.remove('listening');
    micStatus.textContent = 'MIC: IDLE';
    micStatus.classList.remove('listening');
    if (listenBtn.dataset.active === '1') {
      try { r.start(); } catch (e) {}
    }
  };
  r.onerror = (e) => {
    console.warn('Speech error', e.error);
    if (e.error === 'not-allowed') {
      alert('Microphone permission denied. Please allow mic access.');
      listenBtn.dataset.active = '0';
    }
  };
  r.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += t + ' ';
      else interim += t;
    }
    const combined = (finalTranscript + interim).toLowerCase();
    if (combined.includes('jarvis')) {
      const idx = combined.indexOf('jarvis');
      const after = combined.slice(idx + 'jarvis'.length).trim().replace(/^[,.\s]+/, '');
      if (finalTranscript.toLowerCase().includes('jarvis') && after.length > 2) {
        finalTranscript = '';
        sendToJarvis(after);
      }
    }
  };
  return r;
}

listenBtn.addEventListener('click', () => {
  if (!recognition) recognition = initRecognition();
  if (!recognition) return;
  if (listening) {
    listenBtn.dataset.active = '0';
    recognition.stop();
  } else {
    listenBtn.dataset.active = '1';
    finalTranscript = '';
    try { recognition.start(); } catch (e) {}
  }
});

// Space push-to-talk
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== inputEl) {
    e.preventDefault();
    if (!listening) listenBtn.click();
  }
});

// ---------- Form ----------
formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = inputEl.value.trim();
  if (!v) return;
  inputEl.value = '';
  sendToJarvis(v);
});

clearBtn.addEventListener('click', () => {
  chatEl.innerHTML = '';
  messages.length = 0;
});

speakToggle.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  speakToggle.textContent = voiceEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF';
});

// Quick commands
document.querySelectorAll('.quick button').forEach(b => {
  b.addEventListener('click', () => sendToJarvis(b.dataset.cmd));
});
document.querySelectorAll('[data-suit]').forEach(b => {
  b.addEventListener('click', () => {
    suitAction(b.dataset.suit);
    const labels = { zoom:'Zooming into helmet, Sir.', open:'Opening faceplate, Sir.', light:'Illuminating, Sir.', reset:'Resetting view, Sir.' };
    sendToJarvis(labels[b.dataset.suit] || 'Suit command.');
  });
});

// ---------- Health check ----------
fetch('/api/health').then(r => r.json()).then(d => {
  netState.textContent = 'ONLINE';
  if (d.hasOpenAIKey) {
    connStatus.textContent = 'AI: ONLINE';
    connStatus.style.color = '#5cffb0';
  } else {
    connStatus.textContent = 'OFFLINE MODE';
    connStatus.style.color = '#ff8a3d';
  }
  if (d.hasElevenLabsKey) {
    useElevenLabs = true;
    const v = document.getElementById('voiceState');
    if (v) v.textContent = 'ELEVENLABS';
  }
}).catch(() => { netState.textContent = 'OFFLINE'; });

// Greeting
setTimeout(() => {
  const g = 'Good day, Sir. JARVIS is online and ready. How may I assist you?';
  addMsg('jarvis', g);
  if (voiceEnabled) speak(g);
}, 600);
