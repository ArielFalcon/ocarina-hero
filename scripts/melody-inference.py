#!/usr/bin/env python3
import argparse
import contextlib
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / '.runtime-melody/source'
MAX_DURATION_SECONDS = json.loads((ROOT / 'src/core/audio-limits.json').read_text())['maxDurationSeconds']
REVISION = '6d9d758f167d5fd2b56aa26da0618c4d451896b2'
DIGEST = 'd56d10ede86aaf2053fca10047e0120ccb75b05f7e55f4dcaba90a0b2be159cb'
BASIC_PITCH = ROOT / '.runtime-melody/basic-pitch/nmp.onnx'
BASIC_PITCH_DIGEST = '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec'
DECODER = 'segnet-basic-pitch-viterbi-v2'
sys.path.insert(0, str(SOURCE))
sys.path.insert(0, str(ROOT / 'scripts'))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--sample-rate', required=True, type=int)
    args = parser.parse_args()
    import numpy as np
    import scipy.signal
    import torch
    import onnxruntime
    import melody_decoder
    from MSnet.cfp import feature_extraction, lognorm, norm
    from MSnet.model import MSnet_melody
    if not 8000 <= args.sample_rate <= 192000:
        raise ValueError('Invalid sample rate')
    raw = pathlib.Path(args.input).read_bytes()
    if not raw or len(raw) % 4 or len(raw) > 192000 * MAX_DURATION_SECONDS * 4 or len(raw) // 4 > args.sample_rate * MAX_DURATION_SECONDS:
        raise ValueError('Invalid PCM length')
    audio = np.frombuffer(raw, dtype='<f4')
    if not np.isfinite(audio).all():
        raise ValueError('Nonfinite PCM')
    checkpoint = SOURCE / 'MSnet/pretrain_model/MSnet_melody'
    if hashlib.sha256(checkpoint.read_bytes()).hexdigest() != DIGEST:
        raise ValueError('Checkpoint SHA-256 mismatch')
    if not BASIC_PITCH.exists() or hashlib.sha256(BASIC_PITCH.read_bytes()).hexdigest() != BASIC_PITCH_DIGEST:
        raise ValueError('Basic Pitch model missing or SHA-256 mismatch; run npm run setup:melody')
    engine = {'id': 'melodic-segnet', 'revision': REVISION, 'checkpointSha256': DIGEST, 'decoder': DECODER, 'basicPitchSha256': BASIC_PITCH_DIGEST}
    duration = len(audio) / args.sample_rate
    audio = scipy.signal.resample_poly(audio, 44100, args.sample_rate).astype(np.float32)
    if len(audio) <= 256:
        print(json.dumps({'schemaVersion': 1, 'engine': engine, 'sampleRate': 44100, 'durationSeconds': duration, 'hopSeconds': 256 / 44100, 'frames': []}))
        return
    with contextlib.redirect_stdout(sys.stderr), torch.no_grad():
        _, times, centers, a, b, c = feature_extraction(audio, 44100, Hop=256, StartFreq=20.0, StopFreq=2048.0, NumPerOct=60)
        def normalized(x):
            x = lognorm(x)
            return np.zeros_like(x) if np.max(x) == np.min(x) else norm(x)
        data = np.stack([normalized(a), normalized(b), normalized(c)])
        net = MSnet_melody().float().cpu().eval()
        net.load_state_dict(torch.load(checkpoint, map_location='cpu'))
        prediction, _ = net(torch.from_numpy(data[None]).float())
        scores = prediction[0, 0].numpy()
        session = onnxruntime.InferenceSession(str(BASIC_PITCH), providers=['CPUExecutionProvider'])
        bp_audio = scipy.signal.resample_poly(audio, melody_decoder.BP_RATE, 44100).astype(np.float32)
        # One pass: note (88) and onset (88) posteriors side by side, split after stitching.
        bp_times, bp_both = melody_decoder.basic_pitch_frames(lambda window: np.concatenate(session.run(
            ['StatefulPartitionedCall:1', 'StatefulPartitionedCall:2'], {'serving_default_input_2:0': window}), axis=2)[0], bp_audio)
        bp_notes, bp_onsets = bp_both[:, :88], bp_both[:, 88:]
    keep = times < duration
    times, scores = times[keep], scores[:, keep]
    hop = 256 / 44100
    unvoiced, pooled = melody_decoder.semitone_salience(scores, np.asarray(centers))
    notes = melody_decoder.to_semitone_grid(times, bp_times, bp_notes)
    minimum = melody_decoder.minimum_note_seconds(melody_decoder.to_semitone_grid(times, bp_times, bp_onsets), notes, hop)
    path = melody_decoder.decode(unvoiced, pooled, notes, hop, min_note_seconds=minimum)
    # Frequencies are decoded semitone centres; modelScore is the strongest SegNet score supporting the frame's decision.
    support = melody_decoder.path_scores(scores, np.asarray(centers), path)
    frames = [{'timeSeconds': float(t), 'frequencyHz': 0.0 if m < 0 else 440.0 * 2 ** ((m - 69) / 12), 'modelScore': float(score)}
              for t, m, score in zip(times, path, support)]
    print(json.dumps({'schemaVersion': 1, 'engine': engine, 'sampleRate': 44100, 'durationSeconds': duration, 'hopSeconds': 256 / 44100, 'frames': frames}, allow_nan=False))


if __name__ == '__main__':
    main()
