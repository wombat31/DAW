#audio_recorder/views.py
import subprocess
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from tempfile import NamedTemporaryFile

from django.shortcuts import render

# Render the recorder page
def record_audio(request):
    return render(request, 'audio_recorder/record.html')


# Convert uploaded WAV to MP3
@csrf_exempt
def convert_to_mp3(request):
    if request.method == "POST" and request.FILES.get("audio"):
        audio_file = request.FILES["audio"]

        # Temporary files for processing
        with NamedTemporaryFile(delete=True, suffix=".wav") as temp_wav, \
             NamedTemporaryFile(delete=True, suffix=".mp3") as temp_mp3:

            # Write uploaded WAV to temp file
            for chunk in audio_file.chunks():
                temp_wav.write(chunk)
            temp_wav.flush()

            # Run system ffmpeg to convert to MP3
            subprocess.run([
                "ffmpeg",
                "-y",  # overwrite output
                "-i", temp_wav.name,
                "-codec:a", "libmp3lame",
                temp_mp3.name
            ], check=True)

            # Return MP3 as download
            with open(temp_mp3.name, "rb") as f:
                response = HttpResponse(f.read(), content_type="audio/mpeg")
                response["Content-Disposition"] = 'attachment; filename="recording.mp3"'
                return response

    return JsonResponse({"error": "No audio uploaded"}, status=400)

