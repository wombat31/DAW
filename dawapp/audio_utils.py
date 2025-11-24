from pydub import AudioSegment
from io import BytesIO

def mixdown_project(project):
    """
    Mix all tracks into a single AudioSegment,
    respecting each track's volume and clip start times.
    Export only up to the last clip's end.
    """
    output = AudioSegment.silent(duration=0)
    last_clip_end = 0  # in ms

    tracks = project.project_json.get('tracks', [])
    while len(tracks) < 4:
        tracks.append({'clips': [], 'volume': 100})

    for track in tracks:
        track_volume = track.get('volume', 100)  # 0–100
        # Convert volume 0–100 to dB change
        track_gain_db = -20 + (track_volume / 100.0 * 20)

        for clip in track.get('clips', []):
            local_path = clip.get('local_path')
            if not local_path:
                print(f"Skipping clip {clip.get('filename')}: No valid path")
                continue

            try:
                clip_audio = AudioSegment.from_file(local_path)

                # Clip start time in ms
                start_ms = int(clip.get('start_time', 0) * 1000)

                # Apply track volume
                adjusted_audio = clip_audio.apply_gain(track_gain_db)

                # Update last clip end
                clip_end = start_ms + len(adjusted_audio)
                if clip_end > last_clip_end:
                    last_clip_end = clip_end

                # Extend output if needed
                if clip_end > len(output):
                    output += AudioSegment.silent(duration=clip_end - len(output))

                # Overlay clip at correct start
                output = output.overlay(adjusted_audio, position=start_ms)

            except Exception as e:
                print(f"Failed to load clip {local_path}: {e}")
                continue

    # Trim to last clip
    output = output[:last_clip_end]

    # Export MP3
    mp3_io = BytesIO()
    output.export(mp3_io, format="mp3", parameters=["-acodec", "libmp3lame", "-b:a", "128k"])
    mp3_io.seek(0)

    print(f"DEBUG MIXDOWN: {len(output)} ms, {mp3_io.getbuffer().nbytes} bytes")
    return mp3_io
