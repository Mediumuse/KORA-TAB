"use strict";

const LEFT_STRINGS = [
  { number: 11, note: "E", midi: 64 },
  { number: 10, note: "C", midi: 60 },
  { number: 9, note: "A", midi: 57 },
  { number: 8, note: "F", midi: 53 },
  { number: 7, note: "D", midi: 50 },
  { number: 6, note: "B♭", midi: 46 },
  { number: 5, note: "G", midi: 43 },
  { number: 4, note: "E", midi: 40 },
  { number: 3, note: "D", midi: 38 },
  { number: 2, note: "C", midi: 36 },
  { number: 1, note: "F", midi: 29 }
];

const RIGHT_STRINGS = [
  { number: 10, note: "A", midi: 69 },
  { number: 9, note: "G", midi: 67 },
  { number: 8, note: "F", midi: 65 },
  { number: 7, note: "D", midi: 62 },
  { number: 6, note: "B♭", midi: 58 },
  { number: 5, note: "G", midi: 55 },
  { number: 4, note: "E", midi: 52 },
  { number: 3, note: "C", midi: 48 },
  { number: 2, note: "A", midi: 45 },
  { number: 1, note: "F", midi: 41 }
];

const MIDI_NOTES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const GREENSLEEVES_MIDI = window.GREENSLEEVES_MIDI;
const F_MAJOR_SCALE_MIDI = window.F_MAJOR_SCALE_MIDI;
const byMidi = new Map();
for (const string of LEFT_STRINGS) byMidi.set(string.midi, { ...string, side: "left" });
for (const string of RIGHT_STRINGS) byMidi.set(string.midi, { ...string, side: "right" });

const elements = {
  fileInput: document.querySelector("#midi-file"),
  dropZone: document.querySelector("#drop-zone"),
  fileName: document.querySelector("#file-name"),
  loadFMajorScale: document.querySelector("#load-f-major-scale"),
  loadGreensleeves: document.querySelector("#load-greensleeves"),
  mapView: document.querySelector("#map-view"),
  mapSongName: document.querySelector("#map-song-name"),
  mapCurrentTime: document.querySelector("#map-current-time"),
  mapTotalTime: document.querySelector("#map-total-time"),
  mapSeek: document.querySelector("#map-seek"),
  mapStop: document.querySelector("#map-stop"),
  mapPlayPause: document.querySelector("#map-play-pause"),
  mapPlayIcon: document.querySelector("#map-play-icon"),
  mapPlayLabel: document.querySelector("#map-play-label"),
  mapSpeed: document.querySelector("#map-speed"),
  fullscreenToggle: document.querySelector("#fullscreen-toggle"),
  songName: document.querySelector("#song-name"),
  playState: document.querySelector("#play-state"),
  seek: document.querySelector("#seek"),
  currentTime: document.querySelector("#current-time"),
  totalTime: document.querySelector("#total-time"),
  stop: document.querySelector("#stop"),
  playPause: document.querySelector("#play-pause"),
  playIcon: document.querySelector("#play-icon"),
  playLabel: document.querySelector("#play-label"),
  speed: document.querySelector("#speed"),
  feedback: document.querySelector("#feedback"),
  stringMap: document.querySelector("#string-map"),
  unmappedPanel: document.querySelector("#unmapped-panel"),
  unmappedCount: document.querySelector("#unmapped-count"),
  unmappedNotes: document.querySelector("#unmapped-notes")
};

let song = null;
let startedAt = 0;
let positionAtStart = 0;
let position = 0;
let playing = false;
let hasStarted = false;
let animationFrame = 0;
let seeking = false;
let resumeAfterSeek = false;
let audioContext = null;
let schedulerTimer = 0;
let audioStartedAt = 0;
let nextNoteIndex = 0;
const activeSources = new Set();

function addStringCell(parent, string, side) {
  const cell = document.createElement("div");
  cell.className = `string-cell ${side}`;
  cell.dataset.midi = String(string.midi);
  const label = document.createElement("span");
  label.className = "string-label";
  const note = document.createElement("span");
  note.className = "string-note";
  note.textContent = string.note;
  const number = document.createElement("span");
  number.className = "string-number";
  number.textContent = String(string.number);
  label.append(note);
  cell.append(number);
  const slot = document.createElement("button");
  slot.className = "string-slot";
  slot.type = "button";
  slot.setAttribute("aria-label", `${side} hand, string ${string.number}, ${noteName(string.midi)}`);
  if (side === "left") cell.append(label, slot);
  else cell.append(slot, label);
  parent.append(cell);
}

function renderMap() {
  for (let i = 0; i < LEFT_STRINGS.length; i++) {
    const row = document.createElement("div");
    row.className = "map-row";
    addStringCell(row, LEFT_STRINGS[i], "left");
    const divider = document.createElement("span");
    divider.className = "map-divider";
    divider.setAttribute("aria-hidden", "true");
    row.append(divider);
    if (i < RIGHT_STRINGS.length) {
      addStringCell(row, RIGHT_STRINGS[i], "right");
    } else {
      const empty = document.createElement("span");
      empty.className = "empty-cell";
      row.append(empty);
    }
    elements.stringMap.append(row);
  }
}

function noteName(note) {
  return `${MIDI_NOTES[note % 12]}${Math.floor(note / 12) - 1}`;
}

function readUint32(bytes, offset) {
  if (offset + 4 > bytes.length) throw new Error("The MIDI file ends unexpectedly.");
  return bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readVariableLength(bytes, cursor) {
  let value = 0;
  for (let i = 0; i < 4; i++) {
    if (cursor.offset >= cursor.end) throw new Error("The MIDI file contains an incomplete event.");
    const byte = bytes[cursor.offset++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("The MIDI file contains an invalid variable-length value.");
}

function parseMidi(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 14 || String.fromCharCode(...bytes.subarray(0, 4)) !== "MThd") {
    throw new Error("This file is not a valid Standard MIDI File.");
  }

  const headerLength = readUint32(bytes, 4);
  if (headerLength < 6 || 8 + headerLength > bytes.length) throw new Error("The MIDI header is incomplete.");
  const view = new DataView(buffer);
  const format = view.getUint16(8);
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (format > 1) throw new Error("Type 2 MIDI files contain separate sequences and are not supported.");
  if ((division & 0x8000) !== 0 || division === 0) throw new Error("This MIDI file uses an unsupported time division.");

  const allEvents = [];
  const tempos = [{ tick: 0, microseconds: 500000 }];
  let finalTick = 0;
  let offset = 8 + headerLength;
  let actualTracks = 0;

  while (offset + 8 <= bytes.length && actualTracks < trackCount) {
    const chunkName = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const chunkLength = readUint32(bytes, offset + 4);
    offset += 8;
    if (offset + chunkLength > bytes.length) throw new Error("A MIDI track is incomplete.");
    const end = offset + chunkLength;
    if (chunkName !== "MTrk") {
      offset = end;
      continue;
    }

    const cursor = { offset, end };
    let tick = 0;
    let runningStatus = 0;
    while (cursor.offset < cursor.end) {
      tick += readVariableLength(bytes, cursor);
      finalTick = Math.max(finalTick, tick);
      if (cursor.offset >= cursor.end) throw new Error("The MIDI file contains an incomplete event.");
      let status = bytes[cursor.offset];
      if (status & 0x80) {
        cursor.offset++;
        if (status < 0xf0) runningStatus = status;
        else if (status !== 0xf8 && status !== 0xf9 && status !== 0xfa && status !== 0xfb && status !== 0xfc && status !== 0xfe) runningStatus = 0;
      } else {
        if (!runningStatus) throw new Error("The MIDI file contains an event without a status byte.");
        status = runningStatus;
      }

      if (status === 0xff) {
        if (cursor.offset >= cursor.end) throw new Error("The MIDI file contains incomplete metadata.");
        const type = bytes[cursor.offset++];
        const length = readVariableLength(bytes, cursor);
        if (cursor.offset + length > cursor.end) throw new Error("The MIDI file contains incomplete metadata.");
        if (type === 0x51 && length === 3) {
          const microseconds = (bytes[cursor.offset] << 16) | (bytes[cursor.offset + 1] << 8) | bytes[cursor.offset + 2];
          if (microseconds > 0) tempos.push({ tick, microseconds });
        }
        cursor.offset += length;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        cursor.offset += readVariableLength(bytes, cursor);
        if (cursor.offset > cursor.end) throw new Error("The MIDI file contains incomplete system-exclusive data.");
        continue;
      }
      if (status >= 0xf0) {
        const length = status === 0xf1 || status === 0xf3 ? 1 : status === 0xf2 ? 2 : 0;
        cursor.offset += length;
        if (cursor.offset > cursor.end) throw new Error("The MIDI file contains an incomplete system event.");
        continue;
      }

      const kind = status & 0xf0;
      const channel = status & 0x0f;
      const dataLength = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
      if (cursor.offset + dataLength > cursor.end) throw new Error("The MIDI file contains an incomplete channel event.");
      const note = bytes[cursor.offset++];
      const velocity = dataLength === 2 ? bytes[cursor.offset++] : 0;
      if (kind === 0x90 || kind === 0x80) {
        const on = kind === 0x90 && velocity > 0;
        allEvents.push({ tick, note, channel, on, velocity, track: actualTracks });
      }
    }
    actualTracks++;
    offset = end;
  }
  if (actualTracks !== trackCount) throw new Error("The MIDI file is missing one or more tracks.");
  if (allEvents.length === 0) throw new Error("No playable notes were found in this MIDI file.");

  const ticksPerQuarter = division & 0x7fff;
  tempos.sort((a, b) => a.tick - b.tick);
  const tempoMap = [];
  for (const tempo of tempos) {
    const previous = tempoMap[tempoMap.length - 1];
    if (previous && previous.tick === tempo.tick) {
      previous.microseconds = tempo.microseconds;
    } else {
      tempoMap.push({ ...tempo, seconds: 0 });
    }
  }
  for (let i = 1; i < tempoMap.length; i++) {
    const previous = tempoMap[i - 1];
    tempoMap[i].seconds = previous.seconds
      + ((tempoMap[i].tick - previous.tick) * previous.microseconds) / (ticksPerQuarter * 1e6);
  }

  function tickToSeconds(targetTick) {
    let low = 0;
    let high = tempoMap.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (tempoMap[middle].tick <= targetTick) low = middle;
      else high = middle - 1;
    }
    const tempo = tempoMap[low];
    return tempo.seconds + ((targetTick - tempo.tick) * tempo.microseconds) / (ticksPerQuarter * 1e6);
  }

  allEvents.sort((a, b) => a.tick - b.tick);
  const openNotes = new Map();
  const notes = [];
  for (const event of allEvents) {
    const key = `${event.channel}:${event.note}`;
    if (event.on) {
      const active = {
        note: event.note,
        velocity: event.velocity,
        channel: event.channel,
        track: event.track,
        startTick: event.tick,
        endTick: null
      };
      notes.push(active);
      const queue = openNotes.get(key) || [];
      queue.push(active);
      openNotes.set(key, queue);
    } else {
      const queue = openNotes.get(key);
      if (queue && queue.length) {
        const active = queue.shift();
        active.endTick = event.tick;
        if (queue.length === 0) openNotes.delete(key);
      }
    }
  }

  const lastNoteStart = Math.max(...allEvents.map((event) => event.on ? tickToSeconds(event.tick) : 0));
  const duration = Math.max(0.1, tickToSeconds(finalTick), lastNoteStart + 0.1);
  for (const note of notes) {
    note.start = tickToSeconds(note.startTick);
    note.end = note.endTick === null ? duration : tickToSeconds(note.endTick);
    if (note.end <= note.start) note.end = Math.min(duration, note.start + 0.05);
  }
  const sortedNotes = notes.filter((note) => note.start < duration).sort((a, b) => a.start - b.start || a.note - b.note);
  if (sortedNotes.length === 0) throw new Error("No playable notes were found in this MIDI file.");
  return { notes: sortedNotes, duration, trackCount: actualTracks };
}

function formatTime(seconds) {
  const wholeSeconds = Math.floor(Math.max(0, seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function showFeedback(message, isError = false) {
  elements.feedback.textContent = message;
  elements.feedback.classList.toggle("error", isError);
}

function updateTransport() {
  elements.currentTime.textContent = formatTime(position);
  if (!seeking && song) elements.seek.value = String(Math.round((position / song.duration) * 1000));
  const percent = song ? (position / song.duration) * 100 : 0;
  elements.seek.style.setProperty("--progress", `${percent}%`);
  elements.playState.textContent = playing ? "PLAYING" : (song && position >= song.duration ? "FINISHED" : (hasStarted ? "PAUSED" : "READY"));
  elements.playState.classList.toggle("playing", playing);
  elements.playLabel.textContent = playing ? "Pause" : (position >= (song?.duration || 0) && song ? "Play again" : "Play along");
  elements.playIcon.classList.toggle("pause", playing);
  elements.playPause.setAttribute("aria-label", playing ? "Pause" : "Play");
  elements.mapSongName.textContent = elements.songName.textContent;
  elements.mapCurrentTime.textContent = formatTime(position);
  elements.mapTotalTime.textContent = song ? formatTime(song.duration) : "0:00";
  if (!seeking && song) elements.mapSeek.value = elements.seek.value;
  elements.mapSeek.disabled = !song;
  elements.mapSeek.style.setProperty("--progress", `${percent}%`);
  elements.mapStop.disabled = !song;
  elements.mapPlayPause.disabled = !song;
  elements.mapPlayIcon.classList.toggle("pause", playing);
  elements.mapPlayLabel.textContent = playing ? "Pause" : (position >= (song?.duration || 0) && song ? "Replay" : "Play");
  elements.mapPlayPause.setAttribute("aria-label", playing ? "Pause" : (position >= (song?.duration || 0) && song ? "Play again" : "Play"));
  elements.mapSpeed.value = elements.speed.value;
}

function updateHighlights() {
  const active = new Set();
  const upcoming = new Set();
  if (song) {
    for (const note of song.notes) {
      const string = byMidi.get(note.note);
      if (!string) continue;
      if (hasStarted && note.start <= position && position < note.end) active.add(`${string.side}-${string.number}`);
      else if (note.start > position && note.start - position < 0.4) upcoming.add(`${string.side}-${string.number}`);
    }
  }
  for (const cell of elements.stringMap.querySelectorAll(".string-cell")) {
    const string = byMidi.get(Number(cell.dataset.midi));
    const slot = cell.querySelector(".string-slot");
    const key = `${string.side}-${string.number}`;
    const isActive = active.has(key);
    slot.classList.toggle("active", isActive);
    slot.classList.toggle("upcoming", !isActive && upcoming.has(key));
  }
}

function renderUnmappedNotes() {
  const counts = new Map();
  if (song) {
    for (const note of song.notes) {
      if (!byMidi.has(note.note)) counts.set(note.note, (counts.get(note.note) || 0) + 1);
    }
  }
  elements.unmappedNotes.replaceChildren();
  for (const [note, count] of [...counts].sort((a, b) => a[0] - b[0])) {
    const tag = document.createElement("span");
    tag.className = "unmapped-note";
    tag.textContent = `${noteName(note)} · ${count}`;
    elements.unmappedNotes.append(tag);
  }
  elements.unmappedCount.textContent = `${counts.size} ${counts.size === 1 ? "pitch" : "pitches"}`;
  elements.unmappedPanel.hidden = counts.size === 0;
}

function animationTick() {
  if (!playing || !song) return;
  position = positionAtStart + ((performance.now() - startedAt) / 1000) * Number(elements.speed.value);
  if (position >= song.duration) {
    position = song.duration;
    playing = false;
    cancelAnimationFrame(animationFrame);
    stopScheduledAudio();
    showFeedback("Playback finished. Press play to start again.");
  } else {
    animationFrame = requestAnimationFrame(animationTick);
  }
  updateTransport();
  updateHighlights();
}

function stopScheduledAudio() {
  window.clearInterval(schedulerTimer);
  schedulerTimer = 0;
  for (const source of activeSources) source.stop();
  activeSources.clear();
}

function scheduleNote(note, startTime, duration) {
  if (duration <= 0) return;
  const fundamental = audioContext.createOscillator();
  const harmonic = audioContext.createOscillator();
  const harmonicGain = audioContext.createGain();
  const gain = audioContext.createGain();
  const velocity = Math.max(0.1, note.velocity / 127);
  fundamental.type = "triangle";
  fundamental.frequency.value = 440 * (2 ** ((note.note - 69) / 12));
  harmonic.type = "sine";
  harmonic.frequency.value = fundamental.frequency.value * 2;
  harmonicGain.gain.value = 0.18;
  fundamental.connect(gain);
  harmonic.connect(harmonicGain);
  harmonicGain.connect(gain);
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity * 0.12), startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(0.02, duration));
  for (const source of [fundamental, harmonic]) {
    activeSources.add(source);
    source.addEventListener("ended", () => activeSources.delete(source), { once: true });
    source.start(startTime);
    source.stop(startTime + duration + 0.025);
  }
}

async function auditionString(midi) {
  try {
    if (!audioContext) {
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextType) throw new Error("This browser does not support synthesized audio playback.");
      audioContext = new AudioContextType();
    }
    await audioContext.resume();
    scheduleNote({ note: midi, velocity: 96 }, audioContext.currentTime, 0.65);
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : "The string note could not be played.", true);
  }
}

function lowerBoundNote(positionInSong) {
  let low = 0;
  let high = song.notes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (song.notes[middle].start < positionInSong) low = middle + 1;
    else high = middle;
  }
  return low;
}

function scheduleAudioWindow() {
  if (!playing || !song || !audioContext) return;
  const speed = Number(elements.speed.value);
  const playhead = positionAtStart + (audioContext.currentTime - audioStartedAt) * speed;
  const windowEnd = playhead + 0.14 * speed;
  const audioNow = audioContext.currentTime;
  while (nextNoteIndex < song.notes.length && song.notes[nextNoteIndex].start <= windowEnd) {
    const note = song.notes[nextNoteIndex++];
    if (note.end <= playhead) continue;
    const delay = Math.max(0, (note.start - playhead) / speed);
    const duration = Math.max(0.02, (note.end - Math.max(note.start, playhead)) / speed);
    scheduleNote(note, audioNow + delay, duration);
  }
}

function beginAudioScheduling() {
  stopScheduledAudio();
  nextNoteIndex = lowerBoundNote(position);
  for (let i = 0; i < nextNoteIndex; i++) {
    const note = song.notes[i];
    if (note.end > position) {
      scheduleNote(note, audioContext.currentTime, (note.end - position) / Number(elements.speed.value));
    }
  }
  scheduleAudioWindow();
  schedulerTimer = window.setInterval(scheduleAudioWindow, 25);
}

function pausePlayback() {
  if (!playing) return;
  position = Math.min(song.duration, positionAtStart + ((performance.now() - startedAt) / 1000) * Number(elements.speed.value));
  playing = false;
  cancelAnimationFrame(animationFrame);
  stopScheduledAudio();
  updateTransport();
  updateHighlights();
}

async function startPlayback() {
  if (!song) return;
  try {
    if (!audioContext) {
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextType) throw new Error("This browser does not support synthesized audio playback.");
      audioContext = new AudioContextType();
    }
    await audioContext.resume();
    if (position >= song.duration) position = 0;
    playing = true;
    hasStarted = true;
    positionAtStart = position;
    startedAt = performance.now();
    audioStartedAt = audioContext.currentTime;
    beginAudioScheduling();
    showFeedback("Follow the highlighted strings as the synthesized notes play.");
    updateTransport();
    animationFrame = requestAnimationFrame(animationTick);
  } catch (error) {
    playing = false;
    showFeedback(error instanceof Error ? error.message : "Synthesized audio could not be started.", true);
    updateTransport();
  }
}

function stopPlayback() {
  playing = false;
  hasStarted = false;
  cancelAnimationFrame(animationFrame);
  stopScheduledAudio();
  position = 0;
  updateTransport();
  updateHighlights();
  if (song) showFeedback("Playback stopped.");
}

async function loadFile(file) {
  if (!file) return;
  pausePlayback();
  try {
    const parsed = parseMidi(await file.arrayBuffer());
    setSong(parsed, file.name.replace(/\.(mid|midi)$/i, ""), `${file.name} · ${parsed.trackCount} ${parsed.trackCount === 1 ? "track" : "tracks"}`);
  } catch (error) {
    song = null;
    position = 0;
    hasStarted = false;
    elements.songName.textContent = "No MIDI loaded";
    elements.fileName.textContent = "or drop a .mid file here";
    elements.totalTime.textContent = "0:00";
    elements.seek.disabled = true;
    elements.playPause.disabled = true;
    elements.stop.disabled = true;
    elements.unmappedPanel.hidden = true;
    updateTransport();
    updateHighlights();
    showFeedback(error instanceof Error ? error.message : "The MIDI file could not be read.", true);
  }
}

function setSong(parsed, title, description) {
  pausePlayback();
  song = parsed;
  position = 0;
  hasStarted = false;
  elements.songName.textContent = title;
  elements.fileName.textContent = description;
  elements.totalTime.textContent = formatTime(parsed.duration);
  elements.seek.disabled = false;
  elements.playPause.disabled = false;
  elements.stop.disabled = false;
  renderUnmappedNotes();
  updateTransport();
  updateHighlights();
  const mapped = parsed.notes.filter((note) => byMidi.has(note.note)).length;
  const unmapped = parsed.notes.length - mapped;
  if (unmapped > 0) {
    showFeedback(`${parsed.notes.length} notes loaded · ${unmapped} note${unmapped === 1 ? "" : "s"} outside the map are listed below.`);
  } else {
    showFeedback(`${parsed.notes.length} notes loaded · every note matches a Kora string. Press play to hear the tune.`);
  }
}

function loadGreensleeves() {
  try {
    const binary = atob(GREENSLEEVES_MIDI);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = parseMidi(bytes.buffer);
    setSong(parsed, "Greensleeves - D minor", `Kora-fit sample · ${parsed.trackCount} tracks`);
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : "The Greensleeves MIDI could not be loaded.", true);
  }
}

function loadFMajorScale() {
  try {
    const binary = atob(F_MAJOR_SCALE_MIDI);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = parseMidi(bytes.buffer);
    setSong(parsed, "F major scale - F1", `Scale sample · ${parsed.trackCount} track`);
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : "The F major scale MIDI could not be loaded.", true);
  }
}

elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files[0]));
elements.loadFMajorScale.addEventListener("click", loadFMajorScale);
elements.loadGreensleeves.addEventListener("click", loadGreensleeves);
elements.stringMap.addEventListener("click", (event) => {
  const slot = event.target.closest(".string-slot");
  if (!slot) return;
  const cell = slot.closest(".string-cell");
  if (cell) void auditionString(Number(cell.dataset.midi));
});
elements.fullscreenToggle.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === elements.mapView) {
      await document.exitFullscreen();
    } else if (!document.fullscreenElement) {
      await elements.mapView.requestFullscreen();
    } else {
      await document.exitFullscreen();
      await elements.mapView.requestFullscreen();
    }
  } catch (error) {
    showFeedback(error instanceof Error ? `Fullscreen could not be changed: ${error.message}` : "Fullscreen could not be changed.", true);
  }
});
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === elements.mapView;
  elements.fullscreenToggle.setAttribute("aria-pressed", String(isFullscreen));
  elements.fullscreenToggle.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  elements.fullscreenToggle.querySelector("span").textContent = isFullscreen ? "Exit fullscreen" : "Fullscreen";
});
elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    elements.fileInput.click();
  }
});
elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("drag-over");
});
elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("drag-over"));
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("drag-over");
  const [file] = event.dataTransfer.files;
  if (file) loadFile(file);
});
elements.playPause.addEventListener("click", () => {
  if (playing) pausePlayback();
  else startPlayback();
});
elements.stop.addEventListener("click", stopPlayback);
elements.mapPlayPause.addEventListener("click", () => elements.playPause.click());
elements.mapStop.addEventListener("click", () => elements.stop.click());
elements.mapSeek.addEventListener("input", () => {
  elements.seek.value = elements.mapSeek.value;
  elements.seek.dispatchEvent(new Event("input", { bubbles: true }));
  elements.mapCurrentTime.textContent = elements.currentTime.textContent;
  elements.mapSeek.style.setProperty("--progress", `${elements.mapSeek.value / 10}%`);
});
elements.mapSeek.addEventListener("change", () => {
  elements.seek.dispatchEvent(new Event("change", { bubbles: true }));
});
elements.seek.addEventListener("input", () => {
  if (!song) return;
  if (!seeking && playing) {
    resumeAfterSeek = true;
    pausePlayback();
  }
  hasStarted = true;
  seeking = true;
  position = (Number(elements.seek.value) / 1000) * song.duration;
  elements.currentTime.textContent = formatTime(position);
  elements.seek.style.setProperty("--progress", `${elements.seek.value / 10}%`);
  elements.mapCurrentTime.textContent = elements.currentTime.textContent;
  elements.mapSeek.style.setProperty("--progress", `${elements.seek.value / 10}%`);
  updateHighlights();
});
elements.seek.addEventListener("change", () => {
  seeking = false;
  if (resumeAfterSeek) {
    resumeAfterSeek = false;
    startPlayback();
  }
  updateTransport();
  updateHighlights();
});
function updatePlaybackSpeed(speed) {
  const previousSpeed = Number(elements.speed.dataset.previous || "1");
  if (playing) {
    position = Math.min(song.duration, positionAtStart + ((performance.now() - startedAt) / 1000) * previousSpeed);
    positionAtStart = position;
    startedAt = performance.now();
    audioStartedAt = audioContext.currentTime;
    beginAudioScheduling();
  }
  elements.speed.value = speed;
  elements.mapSpeed.value = speed;
  elements.speed.dataset.previous = speed;
}
elements.speed.addEventListener("change", () => updatePlaybackSpeed(elements.speed.value));
elements.mapSpeed.addEventListener("change", () => updatePlaybackSpeed(elements.mapSpeed.value));

elements.seek.disabled = true;
elements.stop.disabled = true;
renderMap();
updateTransport();
updateHighlights();
