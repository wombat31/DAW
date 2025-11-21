# dawapp/audio_utils.py
from pydub import AudioSegment

def mixdown_project(project):
    final_mix = AudioSegment.silent(duration=0)
    
    for track in project.project_json.get('tracks', []):
        for clip in track.get('clips', []):
            audio_file_path = clip['file_path']  # full path on server
            audio = AudioSegment.from_file(audio_file_path)
            # adjust volume (in dB)
            audio += clip.get('volume_db', 0)
            # overlay at correct position
            start_ms = clip.get('start_ms', 0)
            final_mix = final_mix.overlay(audio, position=start_ms)
    
    output_path = f"/home/podcastmaker/mysite/media/mixdowns/{project.title}.mp3"
    final_mix.export(output_path, format="mp3")
    return output_path
