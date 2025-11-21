// daw.js
document.addEventListener("DOMContentLoaded", () => {
    // Django CSRF helper
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

    // Clip info panel elements
    const clipInfoName = document.getElementById('clip-name');
    const clipInfoStart = document.getElementById('clip-start');
    const clipInfoEnd = document.getElementById('clip-end');
    const clipInfoLength = document.getElementById('clip-length');

    // Constants
    const projectData = window.PROJECT_DATA || { id: null, tracks: [] };
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
    // Render timeline ruler
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

        ruler.style.width = container.offsetWidth + 'px'; // responsive
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
    // Create Clip Element (persistent duration)
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
    
        // Ensure unique ID
        clip.instanceId = clip.instanceId || Date.now().toString() + Math.random().toFixed(4).substring(2);
        clipEl.dataset.instanceId = clip.instanceId;
        clipEl.dataset.track = timeline.dataset.track;
        clipEl.dataset.clip = JSON.stringify(clip);
    
        // Compute initial width (fallback minimal width)
        let timelineScale = timeline.offsetWidth / MAX_DURATION;
        clipEl.style.left = (clip.startTime * timelineScale) + 'px';
        clipEl.style.width = ((clip.duration || 0.1) * timelineScale) + 'px';
    
        // Load audio metadata to get actual duration
        const audio = new Audio(clip.file);
        audio.addEventListener('loadedmetadata', () => {
            if (!clip.duration || clip.duration === 5) {
                clip.duration = audio.duration;
    
                // Update dataset so future renders pick up real duration
                clipEl.dataset.clip = JSON.stringify(clip);
    
                // Update visual width
                const timelineScale = timeline.offsetWidth / MAX_DURATION;
                clipEl.style.width = clip.duration * timelineScale + 'px';
            }
        });
    
        // -----------------------------
        // Dragstart
        // -----------------------------
        clipEl.addEventListener('dragstart', e => {
            const rect = clipEl.getBoundingClientRect();
            e.dataTransfer.setData('clip', clipEl.dataset.clip);
            e.dataTransfer.setData('fromTrack', timeline.dataset.track);
            e.dataTransfer.setData('instanceId', clip.instanceId);
            e.dataTransfer.setData('offsetX', e.clientX - rect.left);
            e.dataTransfer.effectAllowed = 'move';
        });
    
        // -----------------------------
        // Dragend
        // -----------------------------
        clipEl.addEventListener('dragend', e => {
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
    
        // -----------------------------
        // Click for audio/info
        // -----------------------------
        clipEl.addEventListener('click', () => {
            audioPlayer.pause();
            audioPlayer.src = clip.file;
            audioPlayer.currentTime = clip.startTime || 0;
            audioPlayer.play();
            clipInfoName.textContent = clip.filename;
            clipInfoStart.textContent = (clip.startTime || 0).toFixed(2);
            clipInfoEnd.textContent = ((clip.startTime || 0) + (clip.duration || 0)).toFixed(2);
            clipInfoLength.textContent = (clip.duration || 0).toFixed(2);
        });
    
        // Append to timeline
        timeline.appendChild(clipEl);
    }


    // -----------------------------
    // Render Tracks
    // -----------------------------
    function renderTracks() {
        renderTimelineRuler();
        container.innerHTML = '';

        projectData.tracks.forEach((track, index) => {
            const trackEl = document.createElement('div');
            trackEl.className = 'track';
            trackEl.dataset.track = index;
            trackEl.innerHTML = `
                <h3>Track ${index + 1}</h3>
                <div class="timeline" data-track="${index}" style="position: relative; width: 100%; height:60px; background:#eee; border:1px solid #ccc;"></div>

            `;
            container.appendChild(trackEl);
            const timeline = trackEl.querySelector('.timeline');

            // Drag over
            timeline.addEventListener('dragover', e => e.preventDefault());

            // Drop
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

                clip.startTime = Math.round((dropX / TIMELINE_WIDTH * MAX_DURATION) / GRID_INTERVAL) * GRID_INTERVAL;

                if (fromTrack === targetTrackIndex.toString()) {
                    // Move within same track
                    const existingClip = projectData.tracks[targetTrackIndex].clips.find(c => c.instanceId === instanceId);
                    if (existingClip) existingClip.startTime = clip.startTime;
                } else {
                    // Remove from old track
                    if (fromTrack !== 'library' && fromTrack !== "") {
                        projectData.tracks[fromTrack].clips = projectData.tracks[fromTrack].clips.filter(c => c.instanceId !== instanceId);
                    }
                    // Assign new ID if from library
                    if (fromTrack === 'library') clip.instanceId = Date.now().toString() + Math.random().toFixed(4).substring(2);
                    // Add to target
                    if (!projectData.tracks[targetTrackIndex].clips.some(c => c.instanceId === clip.instanceId)) {
                        projectData.tracks[targetTrackIndex].clips.push(clip);
                    }
                }

                renderTracks();
            });

            // Render clips
            (track.clips || []).forEach(clip => createClipElement(clip, timeline));
        });

        updatePlayheadHeight();
    }

    // -----------------------------
    // Render Clip Library
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
            clipEl.addEventListener('click', () => {
                audioPlayer.pause();
                audioPlayer.src = clip.file;
                audioPlayer.play();
            });
            clipLibrary.appendChild(clipEl);
        });
    }

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
        const audio = new Audio(clip.file);
        audio.currentTime = offset;
        audio.play();
        scheduledClips.push({ instanceId: clip.instanceId, audio, startTime: clip.startTime, duration: clip.duration });
    }

    function stopAllClipAudio() {
        scheduledClips.forEach(obj => { try { obj.audio.pause(); obj.audio.currentTime = 0; } catch {} });
        scheduledClips = [];
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

        // Update playhead position
        const left = (currentTime / MAX_DURATION) * TIMELINE_WIDTH;
        playhead.style.left = (container.offsetLeft + left) + 'px';

        // Stop all currently playing clips
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

        // Update playhead position
        const left = (currentTime / MAX_DURATION) * TIMELINE_WIDTH;
        playhead.style.left = (container.offsetLeft + left) + 'px';

        // Stop all currently playing clips
        stopAllClipAudio();
    }

    // Attach buttons
    controlsContainer.querySelector('#rewind-btn').addEventListener('click', rewindPlayback);
    controlsContainer.querySelector('#forward-btn').addEventListener('click', fastForwardPlayback);


    function playLoop(timestamp) {
        if (!isPlaying) return;
        if (!lastUpdateTime) lastUpdateTime = timestamp;
        const delta = (timestamp - lastUpdateTime) / 1000;
        lastUpdateTime = timestamp;

        currentTime += delta;
        if (currentTime >= MAX_DURATION) { stopPlayback(); return; }

        const left = (currentTime / MAX_DURATION) * TIMELINE_WIDTH;
        playhead.style.left = (container.offsetLeft + left) + "px";

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
    // INIT
    // -----------------------------
    renderTracks();
    fetch('/api/effects/')
        .then(resp => resp.ok ? resp.json() : [])
        .then(clips => { window.AVAILABLE_CLIPS = Array.isArray(clips) ? clips : clips.results || []; renderClipLibrary(); })
        .catch(err => { console.error(err); window.AVAILABLE_CLIPS = []; renderClipLibrary(); });
        
    window.addEventListener('resize', () => {
        renderTracks(); // Re-render tracks, clips, and ruler on resize
    });
    
    // -----------------------------
    // Save Project
    // -----------------------------
    document.getElementById('save-project').addEventListener('click', () => {
    
        const payload = {
            id: window.PROJECT_DATA.id,
            title: window.PROJECT_DATA.title || "Untitled Project",
            project_json: { tracks: window.PROJECT_DATA.tracks }  // <-- this matches the model
        };
    
        fetch(`/api/projects/${window.PROJECT_DATA.id}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        })
        .then(resp => {
            if (!resp.ok) throw new Error(`Failed to save project: ${resp.status}`);
            return resp.json();
        })
        .then(data => {
            console.log("Project saved:", data);
            alert("Project saved successfully.");
        })
        .catch(err => {
            console.error(err);
            alert("Save failed. Check console.");
        });
    });


    // -----------------------------
    // Upload MP3s
    // -----------------------------
    const uploadDropzone = document.getElementById('upload-dropzone');
    const uploadedClipsList = document.getElementById('uploaded-clips-list');
    
    uploadDropzone.addEventListener('dragover', e => {
        e.preventDefault();
        uploadDropzone.style.backgroundColor = '#e0f7fa';
    });
    
    uploadDropzone.addEventListener('dragleave', e => {
        e.preventDefault();
        uploadDropzone.style.backgroundColor = '#f8f8f8';
    });
    
    uploadDropzone.addEventListener('drop', e => {
        e.preventDefault();
        uploadDropzone.style.backgroundColor = '#f8f8f8';
    
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            if (file.type !== 'audio/mpeg' && file.type !== 'audio/mp3') {
                alert('Only MP3 files are supported.');
                return;
            }
    
            const reader = new FileReader();
            reader.onload = function(evt) {
                const audioUrl = evt.target.result;
                const clip = {
                    filename: file.name,
                    file: audioUrl,
                    duration: 5 // default; real duration will be read later
                };
    
                // Create draggable element for the uploaded clip
                const clipEl = document.createElement('div');
                clipEl.className = 'clip library-clip';
                clipEl.textContent = clip.filename;
                clipEl.dataset.clip = JSON.stringify(clip);
                clipEl.draggable = true;
    
                // Drag start
                clipEl.addEventListener('dragstart', e => {
                    e.dataTransfer.setData('clip', clipEl.dataset.clip);
                    e.dataTransfer.setData('fromTrack', 'library');
                    e.dataTransfer.effectAllowed = 'copy';
                });
    
                // Click to preview
                clipEl.addEventListener('click', () => {
                    audioPlayer.pause();
                    audioPlayer.src = audioUrl;
                    audioPlayer.play();
                });
    
                uploadedClipsList.appendChild(clipEl);
            };
    
            reader.readAsDataURL(file); // Convert MP3 to base64 URL
        });
    });

});
