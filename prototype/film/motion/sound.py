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
FILM_SECONDS = 44.4
# cue times below are written in scene time; the first 15.2s of scene time play over 18.6s of film
ft = lambda x: x * 18.6 / 15.2 if x <= 15.2 else x + 3.4

def ffmpeg_bin():
    exe = shutil.which('ffmpeg')
    if exe: return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

# ---- music: sections follow the film's beats (music_v1 composition plan, 3s minimum per section) ----
MUSIC_PLAN = {
    'positive_global_styles': ['modern organic electronic', 'warm analog synths', 'soft felt piano', 'gentle organic percussion',
                               'breathing pads', '124 bpm', 'playful and bouncy', 'optimistic', 'instrumental'],
    'negative_global_styles': ['vocals', 'lyrics', 'harsh distortion', 'aggressive EDM', 'abrupt ending', 'lo-fi hiss'],
    'sections': [
        {'section_name': 'Hook', 'duration_ms': 4160, 'lines': [],
         'positive_local_styles': ['bouncy playful plucks', 'light finger snaps', 'felt piano motif', 'airy pad'], 'negative_local_styles': ['drums']},
        {'section_name': 'Chaos build', 'duration_ms': 5370, 'lines': [],
         'positive_local_styles': ['rising tension', 'fluttering arpeggios', 'soft riser', 'building percussion'], 'negative_local_styles': ['calm']},
        {'section_name': 'Reveal', 'duration_ms': 3660, 'lines': [],
         'positive_local_styles': ['short breath of silence then a calm warm chord', 'peaceful', 'gentle shimmer'], 'negative_local_styles': ['harsh hit']},
        {'section_name': 'Flow', 'duration_ms': 5370, 'lines': [],
         'positive_local_styles': ['lively bouncy groove', 'round bass', 'playful bright plucks', 'light percussion'], 'negative_local_styles': ['breakdown']},
        {'section_name': 'Insight', 'duration_ms': 8400, 'lines': [],
         'positive_local_styles': ['lighter groove', 'glassy keys', 'clear and confident'], 'negative_local_styles': ['heavy drums']},
        {'section_name': 'Synthesis lift', 'duration_ms': 4800, 'lines': [],
         'positive_local_styles': ['energy lift', 'full groove', 'uplifting chords'], 'negative_local_styles': ['sad']},
        {'section_name': 'Living memory', 'duration_ms': 4600, 'lines': [],
         'positive_local_styles': ['heartbeat-like soft pulse', 'soaring warm pads', 'wonder'], 'negative_local_styles': ['busy drums']},
        {'section_name': 'Neurons fire', 'duration_ms': 3000, 'lines': [],
         'positive_local_styles': ['bright sparkling arpeggio burst', 'peak energy', 'joyful'], 'negative_local_styles': ['dark']},
        {'section_name': 'Outro', 'duration_ms': 6000, 'lines': [],
         'positive_local_styles': ['drums drop out', 'final warm sustained chord that rings out slowly', 'soft piano notes decaying into silence', 'natural long ending'],
         'negative_local_styles': ['abrupt stop', 'new melody', 'drums']},
    ],
}
MUSIC_PROMPT = ('Instrumental modern organic electronic track for a 44 second product film, 124 bpm, playful, warm synths, soft felt piano and '
                'gentle organic percussion. Sparse intro, rising build, a calm warm chord around 10 seconds, flowing groove, lighter middle, '
                'uplifting lift, a heartbeat-like wonder section, a bright burst at 36 seconds, then a long natural outro where a warm '
                'chord rings out and decays into silence. No vocals.')

# ---- sound effects: name -> (prompt, seconds) ----
SFX = {
    'swell':    ('soft airy breath swelling in, warm and organic', 1.4),
    'heart':    ('soft muffled heartbeat thump, warm and organic', 0.7),
    'drop':     ('soft round water droplet bloop, gentle and organic', 0.5),
    'flutter':  ('gentle airy flutter of many paper cards drifting outward, soft whoosh, no harsh hits', 2.2),
    'tap':      ('two soft felt blocks gently tapping together, warm muted wooden click, calm', 0.6),
    'calm':     ('peaceful warm felt piano chord with a soft airy shimmer, serene and gentle', 2.6),
    'glitch':   ('short soft static flutter, subtle', 0.6),
    'inhale':   ('deep soft breath inhale rising, organic, pulling inward', 0.9),
    'bloom':    ('deep warm organic bloom like ink spreading in water, soft low swell with a shimmering airy tail', 2.4),
    'shimmer':  ('soft magical sparkle shimmer, gentle and bright', 1.2),
    'breeze':   ('very soft quiet airy breeze, calm and peaceful, barely there', 4.2),
    'bubble':   ('tiny soft bubble pop underwater, gentle', 0.5),
    'synapse':  ('organic synapse firing, soft wet crackle with a gentle bubbly tail, biological, not electronic', 1.0),
    'breath':   ('soft breathy whoosh, organic', 0.7),
    'marimba':  ('warm soft marimba note, gentle success', 1.0),
    'typing':   ('soft muffled gentle typing', 3.0),
    'riser':    ('warm airy organic swell rising', 1.6),
    'pulse':    ('deep warm organic pulsing hum like a slow heartbeat, living and biological', 3.2),
    'tendril':  ('organic tendrils growing, soft wet stretching with gentle bubbly texture', 1.3),
    'fire':     ('cascade of soft organic synapse sparks spreading outward, like neurons firing, gentle crackle', 2.2),
    'swarm':    ('soft swirling swarm of tiny particles gathering, airy shimmer', 2.0),
    'sting':    ('warm gentle felt piano chord with soft chime, ringing out and fading naturally', 3.5),
}
# ---- cue sheet: (seconds, sfx, volume) ----
CUES = [(0.05, 'swell', 0.5), (0.75, 'heart', 0.7)]
CUES += [(2.0 + i * 0.09, 'drop', 0.4) for i in range(7)]
CUES += [(3.42, 'flutter', 0.6), (5.72, 'glitch', 0.3), (7.45, 'inhale', 0.45), (8.68, 'tap', 0.8), (8.72, 'calm', 0.75), (8.9, 'shimmer', 0.3),
         (9.8, 'breath', 0.4), (10.2, 'breeze', 0.12)]
CUES += [(11.35 + i * 0.26, 'bubble', 0.24) for i in range(12)]
CUES += [(15.25, 'breath', 0.55), (16.0, 'drop', 0.6), (16.35, 'synapse', 0.65), (16.55, 'synapse', 0.55), (17.1, 'drop', 0.5), (17.3, 'drop', 0.5),
         (19.45, 'breath', 0.55), (19.9, 'drop', 0.55), (20.55, 'synapse', 0.8), (21.35, 'marimba', 0.7),
         (21.7, 'drop', 0.4), (21.92, 'drop', 0.4), (22.14, 'drop', 0.4),
         (23.5, 'breath', 0.6), (24.05, 'heart', 0.7), (24.35, 'heart', 0.7), (24.65, 'heart', 0.75), (24.7, 'typing', 0.3)]
CUES += [(24.98 + i * 0.36, 'drop', 0.32) for i in range(8)]
CUES += [(28.4, 'riser', 0.5), (29.0, 'inhale', 0.6), (29.6, 'pulse', 0.7), (30.0, 'drop', 0.5), (30.15, 'drop', 0.5), (30.3, 'drop', 0.5),
         (30.35, 'tendril', 0.65), (30.55, 'tendril', 0.55), (30.75, 'tendril', 0.5),
         (32.95, 'inhale', 0.5), (33.05, 'bloom', 0.85), (33.9, 'fire', 0.8), (35.9, 'swarm', 0.7), (38.0, 'sting', 0.85), (38.32, 'tap', 0.5)]

CUES = [(ft(t), n, v) for t, n, v in CUES]


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
    fade = FILM_SECONDS - 3.5
    parts.append(f'[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.62,atrim=0:{FILM_SECONDS},afade=t=in:d=0.3,afade=t=out:st={fade}:d=3.5:curve=qsin[mus]')
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
