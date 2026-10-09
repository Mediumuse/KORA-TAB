# Kora String Map

A standalone browser app for practicing Kora parts from MIDI files. Open `index.html` in a modern browser, choose or drop a `.mid`/`.midi` file, then use the transport controls to follow the highlighted strings and hear synthesized playback.

## Hosting on GitHub Pages

The repository includes a GitHub Actions workflow that deploys the site whenever changes are pushed to `main`. In the repository settings, open **Pages** and choose **GitHub Actions** as the build and deployment source. The initial setup may require an administrator, and Pages availability for a private repository depends on the GitHub plan. Check the repository's Pages visibility settings before sharing the site URL.

## Playback controls

- Play/pause and stop.
- Seek through the piece and choose a playback speed from 0.5× to 1.5×.
- Use the compact playback bar at the bottom of the Kora Map to control playback, seek, and change speed without leaving the map.
- Press any string circle on the map to audition its tuned note.
- Toggle the string map fullscreen while playback continues.
- Hear a lightweight, plucked-string-style Web Audio synthesis synchronized with the map.
- Strings light up for the duration of their MIDI notes; shortly upcoming notes get a subtle preview.
- Notes without a matching string are listed instead of being silently assigned to the wrong string.
- Load the Kora-fit multi-track “Greensleeves - D minor” demo, or download `greensleeves-Dm-kora.mid`.
- Load the ascending and descending F-major scale sample starting at F1, or download `f-major-scale.mid`.
- Load the ascending and descending F-major pentatonic sample starting at F1, or download `f-major-pentatonic.mid`.
- Load “Greensleeves” in D minor from the included `greensleeves-Dm.mid` sample.

## MIDI and tuning

The parser supports Standard MIDI File format 0 and 1, including multiple tracks and tempo changes. Format 2 and SMPTE time-division files are not supported.

The included [F major scale MIDI](./f-major-scale.mid) plays the ascending F-major pitches available on the map, starting at F1, then G2 and A2, up to A4, and descends back to F1 at 120 BPM. The app loads the same sample from [f-major-scale-sample.js](./f-major-scale-sample.js) when opened directly from disk.

The included [F major pentatonic MIDI](./f-major-pentatonic.mid) uses F, G, A, C, and D, omitting the fourth and seventh degrees of the major scale. It ascends from F1 through the available mapped notes to A4, then descends back to F1 at 120 BPM; [f-major-pentatonic-sample.js](./f-major-pentatonic-sample.js) embeds the same data for local use.

The original Greensleeves MIDI is [greensleeves-Dm.mid](./greensleeves-Dm.mid). You can upload it to the player to see which pitches are outside the mapped strings. The playable Kora-fit copy is [greensleeves-Dm-kora.mid](./greensleeves-Dm-kora.mid); its A1 notes are raised to A2, and its data is loaded by [greensleeves-sample.js](./greensleeves-sample.js) so the sample works when `index.html` is opened directly from disk. B2, C♯3, and B3 remain out of range because shifting them by an octave does not match a Kora string.

The string map uses the note names in `Kora tab string map.png`. It is currently set to standard, equal-tempered F major (Silaba). Since the image does not specify octaves, the app uses the confirmed assumption that pitches ascend with string number on each side: left string 1 starts at F1, and right string 1 starts at F2. This assigns MIDI pitches F1, C2, D2, E2, G2, B♭2, D3, F3, A3, C4, E4 to the left strings 1–11, and F2, A2, C3, E3, G3, B♭3, D4, F4, G4, A4 to the right strings 1–10. Alternate tunings listed in the reference are not selectable because they use microtonal intervals that this MIDI map cannot represent.

## Kora reference

For further reading, [Kora Jaliya: The Art of the Kora](https://www.kora-music.com/e/frame.htm) describes the instrument, its 21-string layout, and playing techniques. Its sections on [scales and tunings](https://www.kora-music.com/e/skalen.htm) discuss F-based tuning as well as traditional tunings with variable, sometimes microtonal intervals. This app currently follows the specific 21-string, equal-tempered map above.
