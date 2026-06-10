"""Kokoro TTS worker for mdviewer.

Persistent JSON-lines worker: loads the Kokoro ONNX model once, then
synthesizes WAV files on request. Protocol (one JSON object per line):

  stdin  -> {"id": 1, "type": "synth", "text": "...", "voice": "af_heart",
             "speed": 1.0, "outPath": "/tmp/seg-1.wav"}
            {"type": "shutdown"}
  stdout <- {"type": "ready", "version": 1}
            {"id": 1, "type": "result", "wavPath": "...",
             "durationSeconds": 1.23, "sampleRate": 24000}
            {"id": 1, "type": "error", "error": "..."}
            {"type": "fatal", "error": "..."}  (then non-zero exit)

All protocol lines are flushed immediately. Diagnostics go to stderr only —
stdout is reserved for protocol JSON (the Node client ignores non-JSON
lines defensively, but we never emit them on purpose).
"""

import argparse
import json
import sys


def emit(obj):
    print(json.dumps(obj), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--voices", required=True)
    args = parser.parse_args()

    try:
        from kokoro_onnx import Kokoro
        import soundfile as sf
        model = Kokoro(args.model, args.voices)
    except Exception as exc:  # import failure, missing files, bad model
        emit({"type": "fatal", "error": f"{type(exc).__name__}: {exc}"})
        sys.exit(1)

    emit({"type": "ready", "version": 1})

    for raw in sys.stdin:  # EOF (parent died) ends the loop -> clean exit
        raw = raw.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
        except json.JSONDecodeError:
            print(f"[kokoro_worker] ignoring non-JSON line: {raw[:80]}", file=sys.stderr)
            continue

        if req.get("type") == "shutdown":
            sys.exit(0)

        if req.get("type") != "synth":
            emit({"id": req.get("id"), "type": "error",
                  "error": f"unknown request type: {req.get('type')!r}"})
            continue

        req_id = req.get("id")
        try:
            samples, sample_rate = model.create(
                req["text"],
                voice=req.get("voice", "af_heart"),
                speed=float(req.get("speed", 1.0)),
            )
            out_path = req["outPath"]
            sf.write(out_path, samples, sample_rate)
            emit({
                "id": req_id,
                "type": "result",
                "wavPath": out_path,
                "durationSeconds": round(len(samples) / sample_rate, 3),
                "sampleRate": sample_rate,
            })
        except Exception as exc:
            emit({"id": req_id, "type": "error",
                  "error": f"{type(exc).__name__}: {exc}"})


if __name__ == "__main__":
    main()
