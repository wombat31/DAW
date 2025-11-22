# dawapp/audio_utils.py

from pydub import AudioSegment
from io import BytesIO

def mixdown_project(project):
    # Initialize output audio as silent segment of length 0
    output = AudioSegment.silent(duration=0)
    
    # 1. Process all tracks and clips
    for track in project.project_json.get('tracks', []):
        for clip in track.get('clips', []):
            
            # CRITICAL: Get the local server path resolved by the view
            local_path = clip.get('local_path')
            
            if not local_path:
                print(f"Skipping clip {clip.get('filename')}: No valid local path resolved.")
                continue
            
            # --- DEBUGGING ---
            print(f"Attempting to load file from local path: {local_path}")
            
            try:
                clip_audio = AudioSegment.from_file(local_path)
                
                # Success log
                print(f"DEBUG MIXDOWN: Successfully loaded clip with length: {len(clip_audio)}ms")
                
                # Get clip parameters
                start_ms = clip.get('start_time', 0)
                end_ms = clip.get('end_time', len(clip_audio))
                track_position_ms = track.get('position', 0)
                clip_volume = clip.get('volume', 100) # Assumes 0-100 range
                
                # Apply time crop and volume adjustment
                trimmed_audio = clip_audio[start_ms:end_ms]
                
                # Convert volume from 0-100 to dBFS adjustment
                gain_db = 20 * (clip_volume / 100.0) - 20 
                
                adjusted_audio = trimmed_audio.apply_gain(gain_db)
                
                # Calculate the exact end time of this clip on the master track
                clip_end_time_ms = track_position_ms + len(adjusted_audio)
                
                # 🛑 CRITICAL FIX FOR 0-BYTE MIXDOWN 🛑
                # Ensure the master 'output' is long enough to receive the overlay.
                if clip_end_time_ms > len(output):
                    # Extend the master segment to fit the new clip plus a small buffer (1000ms)
                    output = output + AudioSegment.silent(duration=clip_end_time_ms - len(output) + 1000)
                
                # Overlay the adjusted clip onto the master track at the specified position
                output = output.overlay(adjusted_audio, position=track_position_ms)
                
            except Exception as e:
                # CRITICAL: This will show if the file exists but pydub can't process it.
                print(f"CRITICAL PYDUB FAIL: File at {local_path} failed to load. Error: {e}")
                continue

    # 2. Export the final mixed audio
    mp3_io = BytesIO()
    
    # CRITICAL FIX for 0-byte export failure: 
    # Explicitly specify the codec (libmp3lame) and bitrate to ensure 
    # FFmpeg reliably executes the encoding process.
    output.export(
        mp3_io, 
        format="mp3",
        parameters=["-acodec", "libmp3lame", "-b:a", "128k"]
    )
    
    # --- CRITICAL DEBUGGING CHECK ---
    file_size = mp3_io.tell()
    print(f"DEBUG MIXDOWN: Exported audio size: {file_size} bytes.")
    if file_size == 0:
        # If size is 0, the error is likely the mixing logic or a final encoding failure.
        print("ERROR: Mixdown resulted in an EMPTY file (0 bytes). Final check of output.")
    # ---------------------------------
    
    mp3_io.seek(0)
    return mp3_io