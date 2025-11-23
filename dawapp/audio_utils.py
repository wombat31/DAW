# dawapp/audio_utils.py
from pydub import AudioSegment
from io import BytesIO

def mixdown_project(project):
    """
    Mixes down a DAW project into a single MP3 file, respecting:
      - clip start times on timeline
      - track positions
      - clip volume
      - clip trimming
    The final output is trimmed to the end of the last clip on the timeline.
    Returns a BytesIO object containing the MP3.
    """
    tracks = project.project_json.get('tracks', [])

    # -----------------------------
    # 1️⃣ Determine total project length
    # -----------------------------
    max_end_ms = 0
    for track_idx, track in enumerate(tracks):
        track_position_ms = track.get('position', 0)
        for clip_idx, clip in enumerate(track.get('clips', [])):
            local_path = clip.get('local_path')
            if not local_path:
                continue
            try:
                clip_audio = AudioSegment.from_file(local_path)
            except Exception as e:
                print(f"[ERROR] Failed to load clip '{clip.get('filename')}': {e}")
                continue

            # Determine clip start time
            clip_start_s = clip.get('startTime') if clip.get('startTime') is not None else clip.get('start_time', 0)
            clip_start_ms = track_position_ms + int(clip_start_s * 1000)

            # Optional trimming
            start_trim_ms = int(clip.get('startTrim', 0))
            end_trim_ms = int(clip.get('endTrim', len(clip_audio)))
            clip_duration_ms = end_trim_ms - start_trim_ms

            clip_end_ms = clip_start_ms + clip_duration_ms
            max_end_ms = max(max_end_ms, clip_end_ms)

    print(f"[INFO] Total project length: {max_end_ms}ms")

    # -----------------------------
    # 2️⃣ Initialize master output to exact length
    # -----------------------------
    output = AudioSegment.silent(duration=max_end_ms)

    # -----------------------------
    # 3️⃣ Overlay each clip
    # -----------------------------
    for track_idx, track in enumerate(tracks):
        track_position_ms = track.get('position', 0)
        for clip_idx, clip in enumerate(track.get('clips', [])):
            local_path = clip.get('local_path')
            if not local_path:
                print(f"[SKIP] Clip '{clip.get('filename')}' has no local path.")
                continue
            try:
                clip_audio = AudioSegment.from_file(local_path)

                # Optional trimming
                start_trim_ms = int(clip.get('startTrim', 0))
                end_trim_ms = int(clip.get('endTrim', len(clip_audio)))
                trimmed_audio = clip_audio[start_trim_ms:end_trim_ms]

                # Volume adjustment (0-100 scale)
                clip_volume = clip.get('volume', 100)
                gain_db = 20 * (clip_volume / 100.0) - 20
                adjusted_audio = trimmed_audio.apply_gain(gain_db)

                # Clip absolute start time on timeline
                clip_start_s = clip.get('startTime') if clip.get('startTime') is not None else clip.get('start_time', 0)
                clip_start_ms = track_position_ms + int(clip_start_s * 1000)

                # Overlay onto master track
                output = output.overlay(adjusted_audio, position=clip_start_ms)

                print(f"[OVERLAY] Track {track_idx} Clip {clip_idx} '{clip.get('filename')}' at {clip_start_ms}ms, duration {len(adjusted_audio)}ms")

            except Exception as e:
                print(f"[ERROR] Failed to overlay clip '{clip.get('filename')}': {e}")
                continue

    # -----------------------------
    # 4️⃣ Export to MP3
    # -----------------------------
    mp3_io = BytesIO()
    try:
        output.export(
            mp3_io,
            format="mp3",
            parameters=["-acodec", "libmp3lame", "-b:a", "128k"]
        )
        mp3_io.seek(0, 2)  # move pointer to end
        file_size = mp3_io.tell()
        mp3_io.seek(0)
        print(f"[EXPORT] Final MP3 size: {file_size} bytes")

        if file_size == 0:
            print("[WARNING] Export resulted in 0-byte file. Check clip paths and FFmpeg installation.")

    except Exception as e:
        print(f"[ERROR] Failed to export MP3: {e}")
        raise e

    return mp3_io
