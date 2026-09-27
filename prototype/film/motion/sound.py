#!/usr/bin/env python3
"""Score the motion film with ElevenLabs music + sound effects and mix them onto the video.

Usage:
  ELEVENLABS_API_KEY=... python3 sound.py full-context-canvas-motion.mp4
  python3 sound.py full-context-canvas-motion.mp4 --placeholder   # test the mix with synthesized audio

Generated audio is cached in ./audio, so re-running only mixes (delete a file to regenerate it).
Needs an ffmpeg with libx264/aac on PATH, or `pip install imageio-ffmpeg`.
"""
import json, os, shutil, subprocess, sys, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, 'audio')
API = 'https://api.elevenlabs.io'
FILM_SECONDS = 32.6

def ffmpeg_bin():
    exe = shutil.which('ffmpeg')
    if exe: return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

# ---- music: sections follow the film's beats (music_v1 composition plan, 3s minimum per section) ----
MUSIC_PLAN = {
    'positive_global_styles': ['modern minimal electronic', 'clean tech product launch', 'warm analog synths',
                               'crisp percussion', '122 bpm', 'optimistic', 'instrumental'],
    'negative_global_styles': ['vocals', 'lyrics', 'heavy distortion', 'aggressive dubstep', 'lo-fi hiss'],
    'sections': [
        {'section_name': 'Hook', 'duration_ms': 3400, 'lines': [],
         'positive_local_styles': ['sparse plucked synth motif', 'soft kick', 'airy pad'], 'negative_local_styles': ['drums fill']},
        {'section_name': 'Chaos build', 'duration_ms': 4400, 'lines': [],
         'positive_local_styles': ['rising tension', 'busy arpeggios', 'riser', 'snare roll building'], 'negative_local_styles': ['calm']},
        {'section_name': 'Reveal drop', 'duration_ms': 3000, 'lines': [],
         'positive_local_styles': ['brief silence then big clean drop', 'wide chord stab', 'shimmer'], 'negative_local_styles': ['harsh']},
        {'section_name': 'Flow', 'duration_ms': 4400, 'lines': [],
         'positive_local_styles': ['driving groove', 'bouncy bass', 'bright plucks', 'forward motion'], 'negative_local_styles': ['breakdown']},
        {'section_name': 'Insight', 'duration_ms': 8400, 'lines': [],
         'positive_local_styles': ['lighter groove', 'glassy keys', 'confident and clear'], 'negative_local_styles': ['heavy drums']},
        {'section_name': 'Synthesis lift', 'duration_ms': 4800, 'lines': [],
         'positive_local_styles': ['energy lift', 'full groove', 'uplifting chords'], 'negative_local_styles': ['sad']},
        {'section_name': 'Outro', 'duration_ms': 4600, 'lines': [],
         'positive_local_styles': ['resolve on warm chord', 'gentle piano sting', 'fade into air'], 'negative_local_styles': ['abrupt ending']},
    ],
}
MUSIC_PROMPT = ('Instrumental modern minimal electronic track for a 33 second tech product film, 122 bpm, warm synths and crisp '
                'percussion. Sparse intro, tension build with a riser, a clean drop around 8 seconds, driving groove, lighter '
                'middle, uplifting lift, and a warm resolving outro. No vocals.')

# ---- sound effects: name -> (prompt, seconds) ----
SFX = {
    'swell':   ('soft deep cinematic whoosh swell rising, clean UI intro', 1.4),
    'thump':   ('soft punchy UI text impact thump, clean, short', 0.6),
    'pop':     ('bubbly soft UI pop, tiny and clean', 0.5),
    'burst':   ('explosive burst of many paper cards flying outward, fluttery whoosh', 2.0),
    'glitch':  ('short digital glitch stutter, clean UI', 0.6),
    'suck':    ('reverse suction whoosh rising fast into an implosion', 0.8),
    'boom':    ('deep cinematic impact boom with a bright shimmering tail', 2.2),
    'shimmer': ('magical sparkle shimmer, soft and bright', 1.2),
    'stream':  ('gentle continuous airy whoosh of many small objects flying past', 4.2),
    'tick':    ('soft glassy UI tick, very short', 0.5),
    'zap':     ('clean futuristic electric line drawing zap, soft', 0.9),
    'swoosh':  ('smooth quick UI swoosh', 0.6),
    'ding':    ('bright positive UI success chime', 0.9),
    'typing':  ('fast soft laptop keyboard typing, clean', 3.0),
    'riser':   ('warm airy riser swell into calm', 1.6),
    'sting':   ('gentle warm piano chime logo sting', 2.2),
}
# ---- cue sheet: (seconds, sfx, volume) ----
CUES = [(0.05, 'swell', 0.7), (0.75, 'thump', 0.8)]
CUES += [(2.0 + i * 0.09, 'pop', 0.55) for i in range(7)]
CUES += [(3.42, 'burst', 0.9), (5.72, 'glitch', 0.8), (7.5, 'suck', 0.9), (8.18, 'boom', 1.0), (8.45, 'shimmer', 0.5),
         (9.8, 'swoosh', 0.5), (10.2, 'stream', 0.45)]
CUES += [(11.35 + i * 0.26, 'tick', 0.28) for i in range(12)]
CUES += [(15.25, 'swoosh', 0.6), (16.0, 'pop', 0.7), (16.35, 'zap', 0.6), (16.55, 'zap', 0.55), (17.1, 'pop', 0.55), (17.3, 'pop', 0.55),
         (19.45, 'swoosh', 0.6), (19.9, 'pop', 0.6), (20.55, 'zap', 0.8), (21.35, 'ding', 0.8),
         (21.7, 'pop', 0.45), (21.92, 'pop', 0.45), (22.14, 'pop', 0.45),
         (23.5, 'swoosh', 0.7), (24.05, 'thump', 0.7), (24.35, 'thump', 0.7), (24.65, 'thump', 0.75), (24.7, 'typing', 0.35)]
CUES += [(24.98 + i * 0.36, 'pop', 0.35) for i in range(8)]
CUES += [(28.35, 'riser', 0.6), (29.7, 'sting', 0.8)]


def post(path, body, out):
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key: sys.exit('Set ELEVENLABS_API_KEY first.')
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), method='POST',
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    try:
        with urllib.request.urlopen(req, timeout=300) as r, open(out, 'wb') as f: f.write(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{path} failed: HTTP {e.code} {e.read()[:300]!r}')


def generate(placeholder):
    os.makedirs(AUDIO, exist_ok=True)
    ff = ffmpeg_bin()
    music = os.path.join(AUDIO, 'music.mp3')
    if not os.path.exists(music):
        if placeholder:
            subprocess.run([ff, '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=f=220:d=33', '-f', 'lavfi', '-i', 'sine=f=330:d=33',
                            '-filter_complex', 'amix=2,volume=0.3', music], check=True)
        else:
            print('composing music…')
            try:
                post('/v1/music?output_format=mp3_44100_128', {'composition_plan': MUSIC_PLAN, 'model_id': 'music_v1'}, music)
            except RuntimeError as e:
                print('composition plan refused, falling back to a prompt:', e)
                post('/v1/music?output_format=mp3_44100_128', {'prompt': MUSIC_PROMPT, 'music_length_ms': 33000, 'force_instrumental': True}, music)
    for name, (text, secs) in SFX.items():
        out = os.path.join(AUDIO, f'{name}.mp3')
        if os.path.exists(out): continue
        if placeholder:
            subprocess.run([ff, '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', f'anoisesrc=d={secs}:c=pink:a=0.3',
                            '-af', f'afade=t=out:st=0:d={secs}', out], check=True)
        else:
            print('sfx:', name)
            post('/v1/sound-generation?output_format=mp3_44100_128',
                 {'text': text, 'duration_seconds': secs, 'prompt_influence': 0.5, 'model_id': 'eleven_text_to_sound_v2'}, out)


def mix(video, out):
    ff = ffmpeg_bin()
    names = list(SFX)
    args = [ff, '-y', '-loglevel', 'error', '-i', video, '-i', os.path.join(AUDIO, 'music.mp3')]
    for n in names: args += ['-i', os.path.join(AUDIO, f'{n}.mp3')]
    idx = {n: i + 2 for i, n in enumerate(names)}
    uses = {}
    for _, n, _ in CUES: uses[n] = uses.get(n, 0) + 1
    parts, labels, k = [], [], {}
    for n, c in uses.items():   # split each effect into as many copies as it has cues
        parts.append(f'[{idx[n]}:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit={c}' + ''.join(f'[{n}{j}]' for j in range(c)))
    for i, (t, n, v) in enumerate(CUES):
        j = k.get(n, 0); k[n] = j + 1
        ms = int(t * 1000)
        parts.append(f'[{n}{j}]volume={v},adelay={ms}|{ms}[c{i}]'); labels.append(f'[c{i}]')
    parts.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,alimiter=limit=0.9,apad=whole_dur={FILM_SECONDS}[fx]')
    parts.append('[fx]asplit=2[fxmix][fxkey]')
    fade = FILM_SECONDS - 1.6
    parts.append(f'[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.62,atrim=0:{FILM_SECONDS},afade=t=in:d=0.3,afade=t=out:st={fade}:d=1.6[mus]')
    parts.append('[mus][fxkey]sidechaincompress=threshold=0.05:ratio=4:attack=10:release=250[duck]')
    parts.append('[duck][fxmix]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]')
    args += ['-filter_complex', ';'.join(parts), '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
             '-shortest', '-movflags', '+faststart', out]
    subprocess.run(args, check=True)
    print('wrote', out)


if __name__ == '__main__':
    video = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'full-context-canvas-motion.mp4')
    placeholder = '--placeholder' in sys.argv
    if placeholder: AUDIO = os.path.join(HERE, 'audio-placeholder')
    generate(placeholder)
    mix(video, os.path.splitext(video)[0] + ('-placeholder' if placeholder else '-sound') + '.mp4')
