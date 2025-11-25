// static/js/audio_recorder.js
let mediaRecorder;
let audioChunks = [];
let recordedBlob;
let audioBuffer;
let previousBuffer = null;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const startOverBtn = document.getElementById('startOverBtn');
const downloadBtn = document.getElementById('downloadBtn');
const preview = document.getElementById('preview');

const applyClipBtn = document.getElementById('applyClipBtn');
const undoBtn = document.getElementById('undoBtn');

const waveformCanvas = document.getElementById('waveform');
const startHandle = document.getElementById('startHandle');
const endHandle = document.getElementById('endHandle');
const ctx = waveformCanvas.getContext('2d');

let audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Track current clip positions
let clipStart = 0;
let clipEnd = 0;

// ---------------------------
// Recording
// ---------------------------
startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();

    startBtn.disabled = true;
    stopBtn.disabled = false;
    startOverBtn.disabled = false;
};

stopBtn.onclick = async () => {
    stopBtn.disabled = true;

    recordedBlob = await new Promise(resolve => {
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = [];
            resolve(blob);
        };
        mediaRecorder.stop();
    });

    // Decode audio for waveform
    const arrayBuffer = await recordedBlob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Initialize clip positions
    clipStart = 0;
    clipEnd = audioBuffer.duration;

    // Enable clip buttons
    applyClipBtn.disabled = false;
    undoBtn.disabled = true;
    downloadBtn.disabled = false;

    // Render waveform and update handles
    renderWaveform();
    updateHandlesPositions();

    preview.src = URL.createObjectURL(recordedBlob);
    startBtn.disabled = false;
};

// ---------------------------
// Start Over
// ---------------------------
startOverBtn.onclick = () => {
    audioBuffer = null;
    previousBuffer = null;
    recordedBlob = null;

    clipStart = 0;
    clipEnd = 0;

    preview.src = '';
    applyClipBtn.disabled = true;
    undoBtn.disabled = true;
    downloadBtn.disabled = true;

    ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
};

// ---------------------------
// Apply Clip
// ---------------------------
applyClipBtn.onclick = () => {
    if (!audioBuffer || clipStart >= clipEnd) return;

    previousBuffer = audioBuffer;

    const length = Math.floor((clipEnd - clipStart) * audioBuffer.sampleRate);
    const newBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        length,
        audioBuffer.sampleRate
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch).slice(
            Math.floor(clipStart * audioBuffer.sampleRate),
            Math.floor(clipEnd * audioBuffer.sampleRate)
        );
        newBuffer.copyToChannel(channelData, ch, 0);
    }

    audioBuffer = newBuffer;
    clipStart = 0;
    clipEnd = audioBuffer.duration;

    const wavBlob = audioBufferToWavBlob(audioBuffer);
    preview.src = URL.createObjectURL(wavBlob);

    renderWaveform();
    updateHandlesPositions();

    undoBtn.disabled = false;
};

// ---------------------------
// Undo Clip
// ---------------------------
undoBtn.onclick = () => {
    if (!previousBuffer) return;

    audioBuffer = previousBuffer;
    previousBuffer = null;

    clipStart = 0;
    clipEnd = audioBuffer.duration;

    const wavBlob = audioBufferToWavBlob(audioBuffer);
    preview.src = URL.createObjectURL(wavBlob);

    renderWaveform();
    updateHandlesPositions();

    undoBtn.disabled = true;
};

// ---------------------------
// Download MP3 (dummy: sends WAV)
// ---------------------------
downloadBtn.onclick = async () => {
    if (!audioBuffer) return;

    const wavBlob = audioBufferToWavBlob(audioBuffer);
    const formData = new FormData();
    formData.append('audio', wavBlob, 'recording.wav');

    const response = await fetch('/audio/convert/', {
        method: 'POST',
        body: formData,
    });

    if (response.ok) {
        const mp3Blob = await response.blob();
        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recording.mp3';
        a.click();
    } else {
        alert('Error converting audio.');
    }
};

// ---------------------------
// Waveform Rendering
// ---------------------------
function renderWaveform() {
    if (!audioBuffer) return;

    waveformCanvas.width = waveformCanvas.clientWidth;
    waveformCanvas.height = waveformCanvas.clientHeight;
    ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / waveformCanvas.width);
    const amp = waveformCanvas.height / 2;

    ctx.fillStyle = '#4a90e2';
    for (let i = 0; i < waveformCanvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = channelData[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
}

// ---------------------------
// Drag Handles
// ---------------------------
function updateHandlesPositions() {
    const width = waveformCanvas.width;
    startHandle.style.left = (clipStart / audioBuffer.duration * width) + 'px';
    endHandle.style.left = (clipEnd / audioBuffer.duration * width) + 'px';
}

let draggingHandle = null;

// ---------- Mouse drag ----------
[startHandle, endHandle].forEach(handle => {
    handle.addEventListener('mousedown', e => {
        draggingHandle = handle;
    });
});

document.addEventListener('mouseup', () => {
    draggingHandle = null;
});

document.addEventListener('mousemove', e => {
    if (!draggingHandle || !audioBuffer) return;

    const rect = waveformCanvas.getBoundingClientRect();
    let pos = e.clientX - rect.left;
    pos = Math.max(0, Math.min(pos, rect.width));
    const time = (pos / rect.width) * audioBuffer.duration;

    if (draggingHandle === startHandle) {
        clipStart = Math.min(time, clipEnd);
    } else {
        clipEnd = Math.max(time, clipStart);
    }
    updateHandlesPositions();
});

// ---------- Mobile touch drag ----------
[startHandle, endHandle].forEach(handle => {
    handle.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        const rect = waveformCanvas.getBoundingClientRect();
        handle.dataset.touchOffsetX = touch.clientX - rect.left;
        draggingHandle = handle;
    });
});

document.addEventListener('touchmove', e => {
    if (!draggingHandle || !audioBuffer) return;
    e.preventDefault(); // prevent scrolling while dragging

    const touch = e.touches[0];
    const rect = waveformCanvas.getBoundingClientRect();
    let pos = touch.clientX - rect.left - parseFloat(draggingHandle.dataset.touchOffsetX || 0);

    // Clamp position inside canvas
    pos = Math.max(0, Math.min(pos, waveformCanvas.width));
    const time = (pos / waveformCanvas.width) * audioBuffer.duration;

    if (draggingHandle === startHandle) {
        clipStart = Math.min(time, clipEnd);
    } else {
        clipEnd = Math.max(time, clipStart);
    }
    updateHandlesPositions();
}, { passive: false });

document.addEventListener('touchend', () => {
    draggingHandle = null;
});

// ---------------------------
// Helper: AudioBuffer -> WAV Blob
// ---------------------------
function audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    let offset = 0;
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; 
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numChannels * 2, true); offset += 4;
    view.setUint16(offset, numChannels * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, length - 44, true); offset += 4;

    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            let sample = buffer.getChannelData(ch)[i];
            sample = Math.max(-1, Math.min(1, sample));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([view], { type: 'audio/wav' });
}
