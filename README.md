# Kora String Map

A standalone browser app for practicing Kora parts from MIDI files. Open `index.html` in a modern browser, choose or drop a `.mid`/`.midi` file, then use the transport controls to follow the highlighted strings and hear synthesized playback.

## Playback controls

- Play/pause and stop.
- Seek through the piece and choose a playback speed from 0.5× to 1.5×.
- Toggle the string map fullscreen while playback continues.
- Hear a lightweight, plucked-string-style Web Audio synthesis synchronized with the map.
- Strings light up for the duration of their MIDI notes; shortly upcoming notes get a subtle preview.
- Notes without a matching string are listed instead of being silently assigned to the wrong string.
- Load the built-in public-domain “Frère Jacques” demo in F major, or download its MIDI file from `frere-jacques-f.mid`.
- Try the low-register “Greensleeves” in D minor from `greensleeves-Dm.mid`.

## MIDI and tuning

The parser supports Standard MIDI File format 0 and 1, including multiple tracks and tempo changes. Format 2 and SMPTE time-division files are not supported.

The included 32-note “Frère Jacques” melody is supplied as [frere-jacques-f.mid](./frere-jacques-f.mid). Use **Try Frère Jacques in F** to load it in the player, then press play to hear the synthesized notes and follow the map.

The string map uses the note names in `Kora tab string map.png`. Since the image does not specify octaves, the app uses the confirmed assumption that pitches ascend with string number on each side: left string 1 starts at F1, and right string 1 starts at F2. This assigns MIDI pitches F1, C2, D2, E2, G2, B♭2, D3, F3, A3, C4, E4 to the left strings 1–11, and F2, A2, C3, E3, G3, B♭3, D4, F4, G4, A4 to the right strings 1–10.
