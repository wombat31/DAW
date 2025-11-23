# dawapp/audio_utils.py
from pydub import AudioSegment
from io import BytesIO

def mixdown_project(project):
    """
    Mix all tracks into a single AudioSegment, respecting each track's volume and clip start times.
    Exports only up to the end of the last clip.
    """
    output = AudioSegment.silent(duration=0)
    last_clip_end = 0  # Track the end of the last clip in ms

    # Ensure we always have 4 tracks
    tracks = project.project_json.get('tracks', [])
    while len(tracks) < 4:
        tracks.append({'clips': [], 'volume': 100})

    for track_index, track in enumerate(tracks):
        track_volume = track.get('volume', 100)  # 0–100
        track_gain_db = 20 * (track_volume / 100.0) - 20  # Convert to dB

        for clip in track.get('clips', []):
            local_path = clip.get('local_path')
            if not local_path:
                print(f"Skipping clip {clip.get('filename')}: No valid local path.")
                continue

            try:
                clip_audio = AudioSegment.from_file(local_path)

                # Clip start in ms
                start_ms = clip.get('start_time', 0)

                # Apply track volume
                adjusted_audio = clip_audio.apply_gain(track_gain_db)

                # Update the end time of this clip
                clip_end_time_ms = start_ms + len(adjusted_audio)
                if clip_end_time_ms > last_clip_end:
                    last_clip_end = clip_end_time_ms

                # Extend output if necessary
                if clip_end_time_ms > len(output):
                    output = output + AudioSegment.silent(duration=clip_end_time_ms - len(output))

                # Overlay clip at start_ms
                output = output.overlay(adjusted_audio, position=start_ms)

            except Exception as e:
                print(f"Failed to load clip {local_path}: {e}")
                continue

    # Trim output to the last clip's end
    output = output[:last_clip_end]

    # Export to MP3
    mp3_io = BytesIO()
    output.export(mp3_io, format="mp3", parameters=["-acodec", "libmp3lame", "-b:a", "128k"])
    mp3_io.seek(0)

    print(f"DEBUG MIXDOWN: Exported audio size: {mp3_io.getbuffer().nbytes} bytes. Duration: {len(output)} ms.")
    return mp3_io
