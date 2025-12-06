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

// Resume AudioContext on user interaction (iOS/Safari requirement)
document.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { once: false });

document.addEventListener('touchstart', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { once: false });

// Track current clip positions
let clipStart = 0;
let clipEnd = 0;

//Timer variables
let recordingStartTime = 0;
let recordingInterval = null;
const MAX_RECORDING_TIME = 120; // 2 minutes in seconds

const recordingTimer = document.getElementById('recordingTimer');

// ---------------------------
// Recording (Start/Continue)
// ---------------------------
startBtn.onclick = async () => {
    // Check remaining time before starting
    const currentDuration = audioBuffer ? audioBuffer.duration : 0;
    const remainingTime = MAX_RECORDING_TIME - currentDuration;

    if (remainingTime <= 0.1) { // Small buffer to prevent issues
        alert("Maximum recording limit reached (2 minutes). Please clip or start over.");
        return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();

    // Start timer
    recordingStartTime = Date.now();
    recordingTimer.style.display = 'block';

    // Initial timer display starts from the current duration
    const initialMinutes = Math.floor(currentDuration / 60);
    const initialSeconds = Math.floor(currentDuration % 60);
    recordingTimer.textContent = `${String(initialMinutes).padStart(2, '0')}:${String(initialSeconds).padStart(2, '0')}`;

    recordingInterval = setInterval(() => {
        // Calculate elapsed time for the CURRENT recording session
        const sessionElapsed = Math.floor((Date.now() - recordingStartTime) / 1000);

        // Calculate total time
        const totalElapsed = currentDuration + sessionElapsed;

        const minutes = Math.floor(totalElapsed / 60);
        const seconds = Math.floor(totalElapsed % 60);
        recordingTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Auto-stop at 2 minutes
        if (totalElapsed >= MAX_RECORDING_TIME) {
            // Stop the media recorder directly to prevent exceeding the limit
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            clearInterval(recordingInterval);
        }
    }, 100); // Update every 100ms for smooth display

    startBtn.disabled = true;
    stopBtn.disabled = false;
    startOverBtn.disabled = false;
};

// ---------------------------
// Stop Recording (and Concatenate)
// ---------------------------
stopBtn.onclick = async () => {
    stopBtn.disabled = true;

    // Stop and hide timer
    clearInterval(recordingInterval);
    recordingTimer.style.display = 'none';

    // 1. Get the new recorded Blob
    recordedBlob = await new Promise(resolve => {
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = [];
            resolve(blob);
        };
        mediaRecorder.stop();
    });

    // Resume AudioContext if suspended (iOS requirement)
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const arrayBuffer = await recordedBlob.arrayBuffer();
    const newAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // --- FIX: Normalize the new buffer's amplitude to prevent loudness spikes ---
    normalizeAudioBuffer(newAudioBuffer); 
    // --------------------------------------------------------------------------

    let finalBuffer;

    if (audioBuffer) {
        // --- Concatenation Logic ---
        const oldDuration = audioBuffer.duration;
        const newDuration = newAudioBuffer.duration;
        const totalDuration = oldDuration + newDuration;
        const sampleRate = audioBuffer.sampleRate;

        // Create a new buffer with the total length
        finalBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            Math.floor(totalDuration * sampleRate),
            sampleRate
        );

        // Copy audio data
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const oldChannelData = audioBuffer.getChannelData(ch);
            const newChannelData = newAudioBuffer.getChannelData(ch);

            // Copy old data to the start (offset 0)
            finalBuffer.copyToChannel(oldChannelData, ch, 0);
            // Copy new data immediately after the old data
            finalBuffer.copyToChannel(newChannelData, ch, oldChannelData.length);
        }
        // ---------------------------
    } else {
        // First recording: use the new buffer directly
        finalBuffer = newAudioBuffer;
    }

    // Update the global audioBuffer
    audioBuffer = finalBuffer;

    // Initialize/update clip positions
    clipStart = 0;
    clipEnd = audioBuffer.duration;

    // Update button label
    startBtn.textContent = 'Continue Recording';

    // Enable buttons
    applyClipBtn.disabled = false;
    downloadBtn.disabled = false;

    // Render waveform and update handles
    renderWaveform();
    updateHandlesPositions();

    // Convert to proper WAV format for iOS/Safari compatibility
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    preview.src = URL.createObjectURL(wavBlob);
    preview.load(); // Force Safari to load the audio

    startBtn.disabled = false;
};
// ---------------------------
// Start Over
// ---------------------------
startOverBtn.onclick = () => {
    // Clear timer if still running
    clearInterval(recordingInterval);
    recordingTimer.style.display = 'none';

    audioBuffer = null;
    previousBuffer = null;
    recordedBlob = null;

    clipStart = 0;
    clipEnd = 0;

    // Properly reset audio preview for iOS/Safari
    preview.pause();
    preview.removeAttribute('src');
    preview.load(); // Force Safari to reset the audio element

    applyClipBtn.disabled = true;
    undoBtn.disabled = true;
    downloadBtn.disabled = true;

    ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);

    // Hide handles when no audio
    startHandle.style.left = '0px';
    endHandle.style.left = '0px';

    // Reset button label
    startBtn.textContent = 'Start Recording';
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
// Download MP3 (iOS & Android compatible)
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

        // Detect if user is on mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Use Web Share API ONLY for mobile devices
        if (isMobile && navigator.share && navigator.canShare) {
            try {
                const file = new File([mp3Blob], 'recording.mp3', { type: 'audio/mpeg' });

                // Check if files can be shared
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Audio Recording',
                        text: 'My audio recording'
                    });
                    return; // Successfully shared
                }
            } catch (err) {
                // User cancelled or share not supported, fall through to download
                if (err.name !== 'AbortError') {
                    console.log('Share failed:', err);
                }
            }
        }

        // Desktop or fallback: Traditional download
        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recording.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
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
    if (!audioBuffer) return;

    const rect = waveformCanvas.getBoundingClientRect();
    const width = rect.width; // Use actual rendered width, not canvas.width

    const startPos = (clipStart / audioBuffer.duration) * width;
    const endPos = (clipEnd / audioBuffer.duration) * width;

    // Clamp positions to stay within bounds
    startHandle.style.left = Math.max(0, Math.min(startPos, width)) + 'px';
    endHandle.style.left = Math.max(0, Math.min(endPos, width)) + 'px';
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
        e.preventDefault();
        draggingHandle = handle;
    });
});

document.addEventListener('touchmove', e => {
    if (!draggingHandle || !audioBuffer) return;
    e.preventDefault(); // prevent scrolling while dragging

    const touch = e.touches[0];
    const rect = waveformCanvas.getBoundingClientRect();
    let pos = touch.clientX - rect.left;

    // Clamp position inside canvas
    pos = Math.max(0, Math.min(pos, rect.width));
    const time = (pos / rect.width) * audioBuffer.duration;

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
// Helper: Normalization (Volume Consistency Fix)
// ---------------------------
function normalizeAudioBuffer(buffer) {
    let maxAmplitude = 0;
    
    // Find the maximum absolute amplitude across all channels
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const channelData = buffer.getChannelData(ch);
        for (let i = 0; i < channelData.length; i++) {
            const amplitude = Math.abs(channelData[i]);
            if (amplitude > maxAmplitude) {
                maxAmplitude = amplitude;
            }
        }
    }

    // Clamp max amplitude to 1.0 (to avoid scaling silent audio or audio already at max)
    if (maxAmplitude > 1.0) {
        maxAmplitude = 1.0; 
    }
    
    // If the max amplitude is non-zero, scale the buffer data
    if (maxAmplitude > 0.0) {
        const scaleFactor = 1.0 / maxAmplitude;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const channelData = buffer.getChannelData(ch);
            for (let i = 0; i < channelData.length; i++) {
                // Apply the scaling factor to every sample
                channelData[i] *= scaleFactor; 
            }
        }
    }
}


// ---------------------------
// Helper: AudioBuffer -> WAV Blob
// ---------------------------
function audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    // Calculate total length: 44 bytes for header + (total samples * num channels * 2 bytes/sample for 16-bit)
    const length = buffer.length * numChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    let offset = 0;
    // RIFF Chunk Descriptor
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    // Format Chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // Sub-chunk size
    view.setUint16(offset, 1, true); offset += 2; // Audio format (1=PCM)
    view.setUint16(offset, numChannels, true); offset += 2; // Number of channels
    view.setUint32(offset, sampleRate, true); offset += 4; // Sample rate
    view.setUint32(offset, sampleRate * numChannels * 2, true); offset += 4; // Byte rate
    view.setUint16(offset, numChannels * 2, true); offset += 2; // Block align (bytes/sample)
    view.setUint16(offset, 16, true); offset += 2; // Bits per sample (16-bit)
    // Data Chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, length - 44, true); offset += 4; // Data size

    // Write the actual audio data (16-bit PCM)
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            let sample = buffer.getChannelData(ch)[i];
            // Clamp and convert to 16-bit integer
            sample = Math.max(-1, Math.min(1, sample));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([view], { type: 'audio/wav' });
}

// ---------------------------
// Handle Window Resize
// ---------------------------
window.addEventListener('resize', () => {
    if (audioBuffer) {
        renderWaveform();
        updateHandlesPositions();
    }
});