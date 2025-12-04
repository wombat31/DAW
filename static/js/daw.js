// daw.js
document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------
    // Django CSRF helper
    // -----------------------------
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    console.log("DAW JS Loaded");

    const container = document.getElementById('daw-container');
    const clipLibrary = document.getElementById('clip-library');
    const controlsContainer = document.getElementById('controls');

    const clipInfoName = document.getElementById('clip-name');
    const clipInfoStart = document.getElementById('clip-start');
    const clipInfoEnd = document.getElementById('clip-end');
    const clipInfoLength = document.getElementById('clip-length');

    // -----------------------------
    // Constants
    // -----------------------------
    const windowData = window.PROJECT_DATA;
    const projectData = {
        id: windowData.id,
        title: windowData.title || "Untitled Project",
        tracks: windowData.project_json?.tracks?.length === 4
            ? windowData.project_json.tracks
            : [{ clips: [] }, { clips: [] }, { clips: [] }, { clips: [] }]
    };

    const MAX_DURATION = 120; // seconds
    const TIMELINE_WIDTH = 1000; // px
    const GRID_INTERVAL = 1; // seconds

    let audioPlayer = new Audio();
    let currentTime = 0;
    let playheadRAF = null;
    let isPlaying = false;
    let scheduledClips = [];
    let lastUpdateTime = 0;

    // -----------------------------
    // Playhead
    // -----------------------------
    let playhead = document.getElementById('daw-playhead');
    if (!playhead) {
        playhead = document.createElement('div');
        playhead.id = 'daw-playhead';
        playhead.style.position = 'absolute';
        playhead.style.width = '2px';
        playhead.style.background = 'red';
        playhead.style.pointerEvents = 'none';
        playhead.style.zIndex = '5000';
        container.parentNode.insertBefore(playhead, container);
    }

    function updatePlayheadHeight() {
        playhead.style.height = container.offsetHeight + "px";
        playhead.style.top = container.offsetTop + "px";
    }

    // -----------------------------
    // Timeline ruler
    // -----------------------------
    function renderTimelineRuler() {
        let ruler = document.getElementById('timeline-ruler');
        if (!ruler) {
            ruler = document.createElement('div');
            ruler.id = 'timeline-ruler';
            ruler.style.position = 'relative';
            ruler.style.height = '20px';
            ruler.style.backgroundColor = '#ddd';
            ruler.style.marginBottom = '5px';
            container.parentNode.insertBefore(ruler, container);
        }

        ruler.style.width = container.offsetWidth + 'px';
        ruler.innerHTML = '';

        for (let t = 0; t <= MAX_DURATION; t += 5) {
            const left = (t / MAX_DURATION) * container.offsetWidth;
            const marker = document.createElement('div');
            marker.textContent = t;
            marker.style.position = 'absolute';
            marker.style.left = left + 'px';
            marker.style.top = '0';
            marker.style.fontSize = '10px';
            marker.style.borderLeft = '1px solid #333';
            marker.style.paddingLeft = '2px';
            ruler.appendChild(marker);
        }
    }

    // -----------------------------
    // Clip element
    // -----------------------------
    function createClipElement(clip, timeline) {
        const clipEl = document.createElement('div');
        clipEl.className = 'clip timeline-clip';
        clipEl.textContent = clip.name || clip.filename || "Unnamed";
        clipEl.style.position = 'absolute';
        clipEl.style.top = '0';
        clipEl.style.height = '100%';
        clipEl.style.backgroundColor = '#4caf50';
        clipEl.style.color = '#fff';
        clipEl.style.padding = '0 5px';
        clipEl.style.cursor = 'pointer';
        clipEl.style.userSelect = 'none';
        clipEl.style.boxSizing = 'border-box';
        clipEl.style.whiteSpace = 'nowrap';
        clipEl.style.overflow = 'hidden';
        clipEl.draggable = true;

        // ---------------- Unique ID ----------------
        clip.instanceId = clip.instanceId || Date.now().toString() + Math.random().toFixed(4).substring(2);
        clipEl.dataset.instanceId = clip.instanceId;
        clipEl.dataset.track = timeline.dataset.track;
        clipEl.dataset.clip = JSON.stringify(clip);

        // ---------------- Initialize effects ----------------
        clip.effects = clip.effects || {
            fadeIn: 0,       // seconds
            fadeOut: 0,      // seconds
            echo: false,
            radio1910: false
        };

        // ---------------- Timeline positioning ----------------
        const timelineScale = timeline.offsetWidth / MAX_DURATION;
        const clipStart = clip.startTime ?? clip.start_time ?? 0;
        clipEl.style.left = clipStart * timelineScale + 'px';
        clipEl.style.width = ((clip.duration ?? 0.1) * timelineScale) + 'px';

        // Load audio metadata for accurate duration
        const audio = new Audio(clip.file);
        audio.addEventListener('loadedmetadata', () => {
            if (!clip.duration || clip.duration === 5) {
                clip.duration = audio.duration;
                clipEl.dataset.clip = JSON.stringify(clip);
                clipEl.style.width = clip.duration * timelineScale + 'px';
            }
        });

        // ---------------- Drag / Click management ----------------
        let isDragging = false;

        // ---------- Desktop drag ----------
        clipEl.addEventListener('dragstart', e => {
            isDragging = true;
            const rect = clipEl.getBoundingClientRect();
            e.dataTransfer.setData('clip', clipEl.dataset.clip);
            e.dataTransfer.setData('fromTrack', timeline.dataset.track);
            e.dataTransfer.setData('instanceId', clip.instanceId);
            e.dataTransfer.setData('offsetX', e.clientX - rect.left);
            e.dataTransfer.effectAllowed = 'move';
        });

        clipEl.addEventListener('dragend', e => {
            setTimeout(() => { isDragging = false; }, 0);
            const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
            const isOverTimeline = elemUnder && elemUnder.closest('.timeline');
            const trackIndex = parseInt(clipEl.dataset.track);
            const instanceId = clip.instanceId;
            if (!isOverTimeline) {
                if (confirm(`Delete clip "${clip.filename}"?`)) {
                    projectData.tracks[trackIndex].clips =
                        projectData.tracks[trackIndex].clips.filter(c => c.instanceId !== instanceId);
                    renderTracks();
                } else renderTracks();
            }
        });

        // ---------- Click to select (no auto-play) ----------
        clipEl.addEventListener('click', () => {
            if (isDragging) return; // prevent click while dragging

            // Update clip info panel
            if (clipInfoName) clipInfoName.textContent = clip.filename;
            if (clipInfoStart) clipInfoStart.textContent = (clip.startTime || 0).toFixed(2);
            if (clipInfoEnd) clipInfoEnd.textContent = ((clip.startTime || 0) + (clip.duration || 0)).toFixed(2);
            if (clipInfoLength) clipInfoLength.textContent = (clip.duration || 0).toFixed(2);

            // Show effects in panel
            if (window.showClipEffectsPanel) window.showClipEffectsPanel(clip);

            // Store selected clip globally for preview button
            window.selectedClip = clip;
        });

        // Preview button in effects panel
        const previewBtn = document.getElementById('preview-clip');
        previewBtn.addEventListener('click', () => {
            if (!window.selectedClip) return;
        
            const clip = window.selectedClip;
        
            // Toggle: if playing, stop it
            if (audioPlayer && !audioPlayer.paused && audioPlayer.dataset.currentClip === clip.file) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                previewBtn.textContent = '▶ Preview';
                return;
            }
        
            // Otherwise, play it
            audioPlayer.pause();
            audioPlayer.src = clip.file;
            audioPlayer.dataset.currentClip = clip.file;
            audioPlayer.currentTime = 0;
            audioPlayer.play();
            previewBtn.textContent = '⏹ Stop Preview';
        
            // Reset button text when audio ends naturally
            audioPlayer.addEventListener('ended', () => {
                previewBtn.textContent = '▶ Preview';
            }, { once: true });
        });
        


        // ---------- Mobile touch drag ----------
        clipEl.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = clipEl.getBoundingClientRect();
            clipEl.dataset.touchOffsetX = touch.clientX - rect.left;
        });

        clipEl.addEventListener('touchmove', e => {
            e.preventDefault();
            const touch = e.touches[0];
            const timelineRect = timeline.getBoundingClientRect();
            let newLeft = touch.clientX - timelineRect.left - parseFloat(clipEl.dataset.touchOffsetX);
            newLeft = Math.max(0, Math.min(newLeft, timeline.offsetWidth - clipEl.offsetWidth));
            clipEl.style.left = newLeft + 'px';
        });

        clipEl.addEventListener('touchend', e => {
            const timelineWidth = timeline.offsetWidth;
            const newStartTime = (parseFloat(clipEl.style.left) / timelineWidth) * MAX_DURATION;
            clip.startTime = Math.round(newStartTime / GRID_INTERVAL) * GRID_INTERVAL;
            renderTracks(); // snap clip and refresh UI
        });

        // ---------------- Append ----------------
        timeline.appendChild(clipEl);
        return clipEl;
    }


    // Web Audio Preview (single instance for panel)
    let audioCtx = null;
    let previewAudio = null;
    let previewSource = null;
    let effectNodes = {
        gainNode: null,
        echoNode: null,
        radioNode: null
    };

    window.showClipEffectsPanel = function(clip) {
        const panel = document.getElementById('clip-effects');
        if (!panel) return;

        // Highlight selected clip
        document.querySelectorAll('.timeline-clip, .library-clip').forEach(c => c.classList.remove('selected-clip'));
        const trackClipEl = document.querySelector(`[data-instance-id="${clip.instanceId}"]`);
        if (trackClipEl) trackClipEl.classList.add('selected-clip');

        // Clear previous content
        panel.innerHTML = `<h3>Effects for "${clip.filename || 'Unnamed'}"</h3>`;

        // Ensure clip.effects exists
        clip.effects = clip.effects || { fadeIn: 0, fadeOut: 0, echo: false, radio1910: false };

        // ----- Fade In Slider -----
        const fadeInLabel = document.createElement('label');
        fadeInLabel.textContent = `Fade In (sec): ${clip.effects.fadeIn}`;
        const fadeInSlider = document.createElement('input');
        fadeInSlider.type = 'range';
        fadeInSlider.min = 0;
        fadeInSlider.max = 5;
        fadeInSlider.step = 0.1;
        fadeInSlider.value = clip.effects.fadeIn;
        fadeInSlider.addEventListener('input', e => {
            clip.effects.fadeIn = parseFloat(e.target.value);
            fadeInLabel.textContent = `Fade In (sec): ${clip.effects.fadeIn}`;
        });
        panel.appendChild(fadeInLabel);
        panel.appendChild(fadeInSlider);

        // ----- Fade Out Slider -----
        const fadeOutLabel = document.createElement('label');
        fadeOutLabel.textContent = `Fade Out (sec): ${clip.effects.fadeOut}`;
        const fadeOutSlider = document.createElement('input');
        fadeOutSlider.type = 'range';
        fadeOutSlider.min = 0;
        fadeOutSlider.max = 5;
        fadeOutSlider.step = 0.1;
        fadeOutSlider.value = clip.effects.fadeOut;
        fadeOutSlider.addEventListener('input', e => {
            clip.effects.fadeOut = parseFloat(e.target.value);
            fadeOutLabel.textContent = `Fade Out (sec): ${clip.effects.fadeOut}`;
        });
        panel.appendChild(fadeOutLabel);
        panel.appendChild(fadeOutSlider);

        // ----- Echo Toggle -----
        const echoLabel = document.createElement('label');
        const echoCheckbox = document.createElement('input');
        echoCheckbox.type = 'checkbox';
        echoCheckbox.checked = clip.effects.echo;
        echoCheckbox.addEventListener('change', e => {
            clip.effects.echo = e.target.checked;
            if (previewAudio && previewSource) {
                if (clip.effects.echo) enableEcho(previewSource);
                else disableEcho();
            }
        });
        echoLabel.appendChild(echoCheckbox);
        echoLabel.appendChild(document.createTextNode(' Echo (live)'));
        panel.appendChild(echoLabel);

        // ----- 1910s Radio Toggle -----
        const radioLabel = document.createElement('label');
        const radioCheckbox = document.createElement('input');
        radioCheckbox.type = 'checkbox';
        radioCheckbox.checked = clip.effects.radio1910;
        radioCheckbox.addEventListener('change', e => {
            clip.effects.radio1910 = e.target.checked;
            if (previewAudio && previewSource) {
                if (clip.effects.radio1910) enableRadio(previewSource);
                else disableRadio();
            }
        });
        radioLabel.appendChild(radioCheckbox);
        radioLabel.appendChild(document.createTextNode(' 1910s Radio (live)'));
        panel.appendChild(radioLabel);

        // ----- Preview Button -----
        const previewBtn = document.createElement('button');
        previewBtn.textContent = '▶ Preview';
        previewBtn.style.width = '100%';
        previewBtn.addEventListener('click', () => {
            if (previewAudio) {
                previewAudio.pause();
                previewAudio.currentTime = 0;
            }

            previewAudio = new Audio(clip.file);
            previewAudio.crossOrigin = "anonymous";

            // Create MediaElementSource and store globally for live toggling
            previewSource = applyLiveEffects(previewAudio, clip.effects);

            previewAudio.play();
        });
        panel.appendChild(previewBtn);
    };


    // Apply live effects to the preview audio
    function applyLiveEffects(audio, effects) {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Disconnect previous chain if exists
        if (previewSource) previewSource.disconnect();
        Object.values(effectNodes).forEach(node => { if (node) node.disconnect(); });
        effectNodes = { gainNode: null, echoNode: null, radioNode: null };

        previewSource = audioCtx.createMediaElementSource(audio);

        // Gain node for fade in/out
        const gainNode = audioCtx.createGain();
        previewSource.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        effectNodes.gainNode = gainNode;

        // Schedule fades when metadata is loaded
        if (audio.readyState >= 1) {
            scheduleFade(audio, gainNode, effects);
        } else {
            audio.addEventListener('loadedmetadata', () => scheduleFade(audio, gainNode, effects), { once: true });
        }

        // Echo
        if (effects.echo) enableEcho(gainNode);

        // 1910s Radio effect
        if (effects.radio1910) enableRadio(gainNode);

        return previewSource;
    }

    // Schedule fade in/out
    function scheduleFade(audio, gainNode, effects) {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        const duration = audio.duration || 5;

        // ----- Fade In -----
        gainNode.gain.setValueAtTime(0, now); // always start at 0
        if (effects.fadeIn && effects.fadeIn > 0) {
            gainNode.gain.linearRampToValueAtTime(1, now + effects.fadeIn);
        } else {
            gainNode.gain.setValueAtTime(1, now);
        }

        // ----- Fade Out -----
        if (effects.fadeOut && effects.fadeOut > 0) {
            const fadeOutStart = now + duration - effects.fadeOut;
            if (fadeOutStart > now) {
                gainNode.gain.setValueAtTime(1, fadeOutStart);
                gainNode.gain.linearRampToValueAtTime(0, fadeOutStart + effects.fadeOut);
            } else {
                // if fadeOut longer than duration, just ramp from 1 → 0 over full duration
                gainNode.gain.setValueAtTime(1, now);
                gainNode.gain.linearRampToValueAtTime(0, now + duration);
            }
        }
    }


    // Enable echo
    function enableEcho(inputNode) {
        if (effectNodes.echoNode) effectNodes.echoNode.disconnect();

        const delay = audioCtx.createDelay();
        delay.delayTime.value = 0.2; // slightly shorter delay

        const feedback = audioCtx.createGain();
        feedback.gain.value = 0.3; // less saturation

        inputNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(audioCtx.destination);


        inputNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(audioCtx.destination);

        effectNodes.echoNode = delay;
    }

    // Disable echo
    function disableEcho() {
        if (effectNodes.echoNode) { effectNodes.echoNode.disconnect(); effectNodes.echoNode = null; }
    }

    // Enable 1910s Radio
    function enableRadio(inputNode) {
        if (effectNodes.radioNode) effectNodes.radioNode.disconnect();

        // Create a more aggressive 1910s radio filter
        const highPass = audioCtx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 400; // remove more bass

        const lowPass = audioCtx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 2500; // remove more highs

        const bandPass = audioCtx.createBiquadFilter();
        bandPass.type = 'bandpass';
        bandPass.frequency.value = 1200; // center a bit higher
        bandPass.Q.value = 4;             // narrower bandwidth for that old-timey effect

        // Connect the chain: input -> highPass -> lowPass -> bandPass -> destination
        inputNode.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(bandPass);
        bandPass.connect(audioCtx.destination);

        effectNodes.radioNode = bandPass;
    }



    // Disable radio
    function disableRadio() {
        if (effectNodes.radioNode) { effectNodes.radioNode.disconnect(); effectNodes.radioNode = null; }
    }
    // -----------------------------
    // Render tracks
    // -----------------------------
    function renderTracks() {
        renderTimelineRuler();
        container.innerHTML = '';

        // Ensure exactly 4 tracks
        while (projectData.tracks.length < 4) {
            projectData.tracks.push({ clips: [], volume: 100 });
        }

        projectData.tracks.forEach((track, index) => {
            const trackEl = document.createElement('div');
            trackEl.className = 'track';
            trackEl.dataset.track = index;

            // Track header with Volume label + slider + numeric display
            trackEl.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
                    <h3 style="margin:0;">Track ${index + 1}</h3>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="font-weight:500;">Volume:</span>
                        <input type="range" min="0" max="100" value="${track.volume || 100}" data-track="${index}" style="width:100px;">
                        <span class="volume-label" id="volume-label-${index}">${track.volume || 100}</span>
                    </div>
                </div>
                <div class="timeline" data-track="${index}" style="position: relative; width: 100%; height:60px; background:#eee; border:1px solid #ccc;"></div>
            `;

            container.appendChild(trackEl);
            const timeline = trackEl.querySelector('.timeline');

            // Volume slider handling with live playback
            const volumeSlider = trackEl.querySelector('input[type="range"]');
            const volumeLabel = trackEl.querySelector(`#volume-label-${index}`);
            volumeSlider.addEventListener('input', e => {
                const tIndex = parseInt(e.target.dataset.track);
                const newVolume = parseInt(e.target.value);

                // Update project data
                projectData.tracks[tIndex].volume = newVolume;
                volumeLabel.textContent = newVolume;

                // Update volume for all currently playing clips on this track
                scheduledClips.forEach(s => {
                    if (s.audio && s.trackIndex === tIndex) {
                        s.audio.volume = newVolume / 100;
                    }
                });
            });

            // Drag & drop for clips
            timeline.addEventListener('dragover', e => e.preventDefault());
            timeline.addEventListener('drop', e => {
                e.preventDefault();
                const clipJSON = e.dataTransfer.getData('clip');
                if (!clipJSON) return;

                const clip = JSON.parse(clipJSON);
                clip.duration = clip.duration || 5;
                const offsetX = parseFloat(e.dataTransfer.getData('offsetX') || 0);
                const fromTrack = e.dataTransfer.getData('fromTrack');
                const instanceId = e.dataTransfer.getData('instanceId');
                const targetTrackIndex = parseInt(timeline.dataset.track);

                const rect = timeline.getBoundingClientRect();
                let dropX = e.clientX - rect.left - offsetX;
                dropX = Math.max(0, dropX);

                clip.startTime = Math.round((dropX / timeline.offsetWidth * MAX_DURATION) / GRID_INTERVAL) * GRID_INTERVAL;

                if (fromTrack === targetTrackIndex.toString()) {
                    const existingClip = projectData.tracks[targetTrackIndex].clips.find(c => c.instanceId === instanceId);
                    if (existingClip) existingClip.startTime = clip.startTime;
                } else {
                    if (fromTrack !== 'library' && fromTrack !== "") {
                        projectData.tracks[fromTrack].clips = projectData.tracks[fromTrack].clips.filter(c => c.instanceId !== instanceId);
                    }
                    if (fromTrack === 'library') clip.instanceId = Date.now().toString() + Math.random().toFixed(4).substring(2);
                    if (!projectData.tracks[targetTrackIndex].clips.some(c => c.instanceId === clip.instanceId)) {
                        projectData.tracks[targetTrackIndex].clips.push(clip);
                    }
                }

                renderTracks();
            });

            // Render clips for this track
            (track.clips || []).forEach(clip => {
                clip.trackIndex = index; // store track index for live volume control
                createClipElement(clip, timeline);
            });
        });

        updatePlayheadHeight();
    }

    // -----------------------------
    // Render clip library & user uploads
    // -----------------------------
    function renderClipLibrary() {
        clipLibrary.innerHTML = '<h3>Available Sounds</h3>';
        if (!window.AVAILABLE_CLIPS || !Array.isArray(window.AVAILABLE_CLIPS) || window.AVAILABLE_CLIPS.length === 0) {
            clipLibrary.innerHTML += '<p>No sounds available.</p>';
            return;
        }

        window.AVAILABLE_CLIPS.forEach(clip => {
            const clipEl = document.createElement('div');
            clipEl.className = 'clip library-clip';
            clipEl.textContent = clip.name || "Unnamed Clip";
            clipEl.style.width = '100%';
            clipEl.style.display = 'block';
            clipEl.draggable = true;
            clipEl.dataset.clip = JSON.stringify({ filename: clip.name, file: clip.file, duration: clip.duration || 5 });
            clipEl.addEventListener('dragstart', e => {
                e.dataTransfer.setData('clip', clipEl.dataset.clip);
                e.dataTransfer.setData('fromTrack', 'library');
                e.dataTransfer.effectAllowed = 'copy';
            });
            // Store currently playing clip for accurate comparison
            clipEl.addEventListener('click', () => {
                // Check if this exact clip is currently playing
                const isSameClip = audioPlayer.dataset.currentClip === clip.file;
                
                if (isSameClip && !audioPlayer.paused) {
                    // Stop playback
                    audioPlayer.pause();
                    audioPlayer.currentTime = 0;
                } else if (isSameClip && audioPlayer.paused) {
                    // Resume playback
                    audioPlayer.play();
                } else {
                    // Load and play new clip
                    audioPlayer.pause();
                    audioPlayer.src = clip.file;
                    audioPlayer.dataset.currentClip = clip.file;
                    audioPlayer.currentTime = 0;
                    audioPlayer.play();
                }
            });
            clipLibrary.appendChild(clipEl);
        });
    }

    function loadUserUploads() {
        fetch('/api/media/uploads/')
            .then(r => r.ok ? r.json() : [])
            .then(uploads => {
                const uploadedClipsList = document.getElementById('uploaded-clips-list');
                const uploadDropzone = document.getElementById('upload-dropzone');
                uploadedClipsList.innerHTML = '';

                if (!uploads.length) {
                    uploadDropzone.style.display = 'flex';
                    uploadDropzone.style.border = '2px dashed #999';
                    uploadDropzone.style.background = '#f8f8f8';
                    uploadDropzone.style.pointerEvents = 'auto';
                    uploadDropzone.innerHTML = 'Drag and drop an MP3 file here (limit: 1)';
                    return;
                }

                uploadDropzone.style.display = 'flex';
                uploadDropzone.style.border = '2px solid #4CAF50';
                uploadDropzone.style.background = '#e8f5e9';
                uploadDropzone.style.pointerEvents = 'none';
                uploadDropzone.innerHTML = '<span style="color:#2e7d32;">✓ Upload limit reached</span>';

                uploads.forEach(file => {
                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:5px;';

                    const clipEl = document.createElement('div');
                    clipEl.className = 'clip library-clip';
                    clipEl.style.cssText = 'flex:1;margin:0;';
                    clipEl.textContent = file.filename;
                    clipEl.draggable = true;
                    clipEl.dataset.clip = JSON.stringify({ filename: file.filename, file: file.file_url, duration: 5 });

                    clipEl.addEventListener('dragstart', e => {
                        e.dataTransfer.setData('clip', clipEl.dataset.clip);
                        e.dataTransfer.setData('fromTrack', 'library');
                        e.dataTransfer.effectAllowed = 'copy';
                    });

                    // Inside loadUserUploads() function - Replace the uploaded clip click handler (around line 633)
                    clipEl.addEventListener('click', () => {
                        // Check if this exact clip is currently playing
                        const isSameClip = audioPlayer.dataset.currentClip === file.file_url;
                        
                        if (isSameClip && !audioPlayer.paused) {
                            // Stop playback
                            audioPlayer.pause();
                            audioPlayer.currentTime = 0;
                        } else if (isSameClip && audioPlayer.paused) {
                            // Resume playback
                            audioPlayer.play();
                        } else {
                            // Load and play new clip
                            audioPlayer.pause();
                            audioPlayer.src = file.file_url;
                            audioPlayer.dataset.currentClip = file.file_url;
                            audioPlayer.currentTime = 0;
                            audioPlayer.play();
                        }
                    });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Replace';
                    deleteBtn.style.cssText = 'background:#e74c3c;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;';
                    deleteBtn.addEventListener('click', () => {
                        if (confirm('Delete this upload and remove it from all tracks?')) {
                            const fileUrl = file.file_url;
                            projectData.tracks.forEach(track => {
                                track.clips = track.clips.filter(clip => clip.file !== fileUrl);
                            });
                            renderTracks();

                            fetch('/api/media/delete/' + file.id + '/', {
                                method: 'POST',
                                headers: {'X-CSRFToken': getCookie('csrftoken')}
                            })
                            .then(r => r.json())
                            .then(data => {
                                if (data.success) {
                                    loadUserUploads();
                                } else {
                                    alert(data.error || 'Delete failed');
                                }
                            })
                            .catch(err => console.error(err));
                        }
                    });

                    wrapper.appendChild(clipEl);
                    wrapper.appendChild(deleteBtn);
                    uploadedClipsList.appendChild(wrapper);
                });
            })
            .catch(err => console.error('Failed to load uploads:', err));
    }

    // -----------------------------
    // Upload dropzone
    // -----------------------------
    const uploadDropzone = document.getElementById('upload-dropzone');
    uploadDropzone.addEventListener('dragover', e => { e.preventDefault(); uploadDropzone.style.backgroundColor = '#e0f7fa'; });
    uploadDropzone.addEventListener('dragleave', e => { e.preventDefault(); uploadDropzone.style.backgroundColor = '#f8f8f8'; });
    uploadDropzone.addEventListener('drop', e => {
        e.preventDefault();
        uploadDropzone.style.backgroundColor = '#f8f8f8';
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            if (!['audio/mpeg', 'audio/mp3'].includes(file.type)) { alert('Only MP3 files supported.'); return; }
            const formData = new FormData();
            formData.append('file', file);
            formData.append('filename', file.name);
            formData.append('project_id', projectData.id);
            fetch('/api/media/upload/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                body: formData
            })
            .then(resp => resp.ok ? resp.json() : Promise.reject(resp))
            .then(data => {
                console.log('Uploaded file:', data);
                loadUserUploads();
            })
            .catch(err => { console.error(err); alert('Upload failed'); });
        });
    });

     // -----------------------------
    // Playback Helpers
    // -----------------------------
    function getAllClips() {
        const result = [];
        projectData.tracks.forEach((track, tIndex) => {
            (track.clips || []).forEach(clip => result.push({ ...clip, trackIndex: tIndex }));
        });
        return result;
    }

    function playClip(clip, offset = 0) {
        const trackSettings = projectData.tracks[clip.trackIndex] || {};
        const trackVolume = (trackSettings.volume ?? 100) / 100; // 0–1

        const audio = new Audio(clip.file);
        audio.volume = trackVolume;
        audio.currentTime = offset;
        audio.play();

        // Include trackIndex for live volume updates
        scheduledClips.push({
            instanceId: clip.instanceId,
            audio,
            startTime: clip.startTime,
            duration: clip.duration,
            trackIndex: clip.trackIndex
        });
    }




    function stopAllClipAudio() {
        scheduledClips.forEach(obj => { try { obj.audio.pause(); obj.audio.currentTime = 0; } catch {} });
        scheduledClips = [];
    }

    function updatePlayheadPosition() {
        const left = (currentTime / MAX_DURATION) * container.offsetWidth;
        playhead.style.left = (container.offsetLeft + left) + "px";
    }


    // -----------------------------
    // Playback Controls
    // -----------------------------

    function rewindPlayback() {
        const allClips = getAllClips();
        const minStartTime = allClips.length ? Math.min(...allClips.map(c => c.startTime)) : 0;

        // Step back 5 seconds
        currentTime = Math.max(minStartTime, currentTime - 5);

        // Snap to grid
        currentTime = Math.round(currentTime / GRID_INTERVAL) * GRID_INTERVAL;

        // Update playhead position relative to container width
        const left = (currentTime / MAX_DURATION) * container.offsetWidth;
        playhead.style.left = (container.offsetLeft + left) + 'px';

        // Stop any currently playing clips
        stopAllClipAudio();
    }



    function fastForwardPlayback() {
        const allClips = getAllClips();
        const maxEndTime = allClips.length
            ? Math.max(...allClips.map(c => c.startTime + c.duration))
            : MAX_DURATION;

        // Step forward 5 seconds
        currentTime = Math.min(maxEndTime, currentTime + 5);

        // Snap to grid
        currentTime = Math.round(currentTime / GRID_INTERVAL) * GRID_INTERVAL;

        // Update playhead position relative to container width
        const left = (currentTime / MAX_DURATION) * container.offsetWidth;
        playhead.style.left = (container.offsetLeft + left) + 'px';

        // Stop any currently playing clips
        stopAllClipAudio();
    }



    // Attach buttons
    controlsContainer.querySelector('#rewind-btn').addEventListener('click', rewindPlayback);
    controlsContainer.querySelector('#forward-btn').addEventListener('click', fastForwardPlayback);


    function playLoop(timestamp) {
        if (!isPlaying) return;
        if (!lastUpdateTime) lastUpdateTime = timestamp;

        const delta = (timestamp - lastUpdateTime) / 1000; // seconds since last frame
        lastUpdateTime = timestamp;

        currentTime += delta;
        if (currentTime >= MAX_DURATION) {
            stopPlayback();
            return;
        }

        // Update playhead based on container width
        const left = (currentTime / MAX_DURATION) * container.offsetWidth;
        playhead.style.left = (container.offsetLeft + left) + "px";

        // Schedule clips
        getAllClips().forEach(clip => {
            const alreadyPlaying = scheduledClips.some(c => c.instanceId === clip.instanceId);
            if (!alreadyPlaying && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
                playClip(clip, currentTime - clip.startTime);
            }
        });

        playheadRAF = requestAnimationFrame(playLoop);
    }


    function startPlayback() { if (isPlaying) return; isPlaying = true; lastUpdateTime = 0; stopAllClipAudio(); playheadRAF = requestAnimationFrame(playLoop); }
    function pausePlayback() { isPlaying = false; cancelAnimationFrame(playheadRAF); scheduledClips.forEach(s => s.audio.pause()); }
    function stopPlayback() { isPlaying = false; cancelAnimationFrame(playheadRAF); stopAllClipAudio(); currentTime = 0; playhead.style.left = container.offsetLeft + "px"; }

    // Attach controls
    controlsContainer.querySelector('#play-btn').addEventListener('click', startPlayback);
    controlsContainer.querySelector('#pause-btn').addEventListener('click', pausePlayback);
    controlsContainer.querySelector('#stop-btn').addEventListener('click', stopPlayback);

    // -----------------------------
    // Save Project
    // -----------------------------
    const saveButton = document.getElementById('save-project');
    if (saveButton && !saveButton.dataset.listenerAttached) {
        saveButton.addEventListener('click', () => {
            // Update clip start times and track volume before saving
            projectData.tracks.forEach(track => {
                track.clips.forEach(clip => {
                    clip.start_time = clip.startTime; // ensures backend gets start in seconds
                });
            });

            const payload = {
                id: projectData.id,
                title: projectData.title || "Untitled Project",
                project_json: { tracks: projectData.tracks }
            };

            fetch(`/api/projects/${projectData.id}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(payload)
            })
            .then(resp => resp.ok ? resp.json() : Promise.reject(resp))
            .then(data => {
                console.log("Project saved:", data);
                alert("Project saved successfully.");
            })
            .catch(err => {
                console.error(err);
                alert("Save failed");
            });
        });
        saveButton.dataset.listenerAttached = "true";
    }



    // -----------------------------
    // Export Project
    // -----------------------------
    document.getElementById('export-project').addEventListener('click', () => {
        const exportUrl = `/api/export/${projectData.id}/`;
        const a = document.createElement('a');
        a.href = exportUrl;
        a.download = (projectData.title || 'Untitled Project') + ".mp3";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // -----------------------------
    // INIT
    // -----------------------------
    renderTracks();
    fetch('/api/effects/')
        .then(resp => resp.ok ? resp.json() : [])
        .then(clips => { window.AVAILABLE_CLIPS = Array.isArray(clips) ? clips : clips.results || []; renderClipLibrary(); })
        .catch(err => { console.error(err); window.AVAILABLE_CLIPS = []; renderClipLibrary(); });

    loadUserUploads();

    window.addEventListener('resize', () => {
        renderTracks();
        loadUserUploads();
        updatePlayheadPosition(); // <-- reposition playhead proportionally
    });


    // ---------------------------------------
    // Resize playback controls when small
    // ---------------------------------------
    function updateToolbarButtons() {
        const buttons = document.querySelectorAll('#controls button');
        buttons.forEach(btn => {
            if (btn.offsetWidth < 60) { // threshold for hiding text
                btn.dataset.small = "true";
            } else {
                btn.dataset.small = "false";
            }
        });
    }

    window.addEventListener('resize', updateToolbarButtons);
    updateToolbarButtons(); // initial call

    function resizeUtilityBar() {
        const panels = document.getElementById('daw-bottom-panels');
        const utility = document.querySelector('.utility-bar');
        if (panels && utility) {
            utility.style.width = panels.offsetWidth + 'px';
        }
    }

    window.addEventListener('resize', resizeUtilityBar);
    resizeUtilityBar(); // initial call

    // -----------------------------------------
    // Web Audio Preview Setup
    // -----------------------------------------




});
