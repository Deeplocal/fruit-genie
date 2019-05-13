const Tonal                           = require('tonal');
const Key                             = require('tonal-key');
const SerialPort                      = require('serialport')

const NOTES                           = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const MODES                           = ["major pentatonic", "minor pentatonic", "mixolydian pentatonic", "dorian", "lydian", "phrygian", "locrian"];
const CHORD_TIME                      = 30;
const LONG_RANDOM_SUSTAIN             = 2000;
const SHORT_RANDOM_SUSTAIN            = 200;

const FIRST_BUTTON_PRESSED_MASK       = 0b00000001;
const SECOND_BUTTON_PRESSED_MASK      = 0b00000010
const THIRD_BUTTON_PRESSED_MASK       = 0b00000100
const FOURTH_BUTTON_PRESSED_MASK      = 0b00001000
const FIFTH_BUTTON_PRESSED_MASK       = 0b00010000
const SIXTH_BUTTON_PRESSED_MASK       = 0b00100000
const SEVENTH_BUTTON_PRESSED_MASK     = 0b01000000
const EIGHTH_BUTTON_PRESSED_MASK      = 0b10000000

const MIDI_BAUD_RATE                  = 38400;
const ARDUINO_CONTROLLER_BAUD         = 9600;

const { fork }                = require('child_process');
const forked                  = fork('run_genie.js');
const forkedTimer             = fork('run_timer.js');

const pressedMap = new Map();
const port = new SerialPort('/dev/ttyAMA0', {
  baudRate: MIDI_BAUD_RATE
})

const keyboard = new SerialPort('/dev/ttyACM0', {
  baudRate: ARDUINO_CONTROLLER_BAUD
})

let currentKey                = "C";
let currentMode               = "major pentatonic";
let progressionIntervals      = [1, 5, 6, 4];
let currentChordNotes         = ["C"]
let currentNoteIndex          = 0;
let chosenChords              = Key.secDomChords(`${currentKey.toUpperCase()} ${currentMode}`, progressionIntervals);
let chosenChordNotes          = [];
let chosenNotes               = Tonal.Scale.notes(`${currentKey} ${currentMode}`);
let currentModeIndex          = 0;
let randomizeCrowdIndex       = 0;
let lastNoteTime              = new Date().getTime();


let Readline = SerialPort.parsers.Readline
let parser = new Readline()
keyboard.pipe(parser);

let LOWEST_NOTE               = 24;
let NUM_CHANNELS              = 3;
let NUM_BUTTONS               = 8;
let chordNotesToPlay          = [];
let randomNotesToPlay         = [];
let randomTimers              = [];

let processing                = false;
let genieReady                = false;

forkedTimer.on('message', (msg) => {
  if (randomizeCrowdIndex != 0) {
    if (Math.random() > 0.7) {
      playRandom();
    }
  }
})

forked.on('message', (msg) => {
  if (msg.genieReady == true) {
    genieReady = true;
    keyboard.write("S\n");
  } else {
    processing = false;
    let [nextNote, chordNotes ] = transformNote(msg.note, msg.button);
    for (let note of chordNotes) {
      noteOn(1, note + LOWEST_NOTE, msg.button)
    }
    noteOn(0, nextNote + LOWEST_NOTE, msg.button)
    if (chordNotesToPlay.length > 0) {
      for (let i = 0; i < chordNotesToPlay.length; i++) {
        if (chordNotesToPlay[i] != nextNote) {
          noteOn(0, chordNotes[i % chordNotes.length] + LOWEST_NOTE, chordNotesToPlay[i])
        }
      }
    }
    chordNotesToPlay = [];
    // noteOn(2, msg.note + LOWEST_NOTE, msg.button)
  }
});

let channelMap = new Map();

for (let i = 0; i < NUM_CHANNELS; i++) {
  channelMap.set(i, new Map())
  for (let j = 0; j < NUM_BUTTONS; j++) {
    channelMap.get(i).set(j, []);
  }
}

let context = this;
parser.on('data', (data) => {
  if (data[0] == 'C') {
    if (data.length >= 3) {
      randomizeCrowdIndex = parseInt(data.slice(1, data.length));
    }
  } else if (data[0] == 'K') {
    if (data.length >= 3) {
      currentKey = NOTES[parseInt(data.slice(1, data.length)) % NOTES.length];
      refreshNotesForCurrentKey();
    }
  } else if (data[0] == 'M') {
    if (data.length >= 3) {
      currentModeIndex = parseInt(data.slice(1, data.length)) % MODES.length;
      refreshNotesForCurrentKey();
    }
  } else {
    let dataByte = parseInt(data);

    let firstButton = !(FIRST_BUTTON_PRESSED_MASK & dataByte);
    let secondButton = !(SECOND_BUTTON_PRESSED_MASK & dataByte);
    let thirdButton = !(THIRD_BUTTON_PRESSED_MASK & dataByte);
    let fourthButton = !(FOURTH_BUTTON_PRESSED_MASK & dataByte);
    let fifthButton = !(FIFTH_BUTTON_PRESSED_MASK & dataByte);
    let sixthButton = !(SIXTH_BUTTON_PRESSED_MASK & dataByte);
    let seventhButton = !(SEVENTH_BUTTON_PRESSED_MASK & dataByte);
    let eighthButton = !(EIGHTH_BUTTON_PRESSED_MASK & dataByte);

    handleButtonValue(0, firstButton);
    handleButtonValue(1, secondButton);
    handleButtonValue(2, thirdButton);
    handleButtonValue(3, fourthButton);
    handleButtonValue(4, fifthButton);
    handleButtonValue(5, sixthButton);
    handleButtonValue(6, seventhButton);
    handleButtonValue(7, eighthButton);
  }
})

handleButtonValue = function(button, value) {
  if (!genieReady) {
    return;
  }

  if (pressedMap.has(button)) {
    if (pressedMap.get(button) != value) {
      if (!value) {
        if (!processing) {
          processing = true;
          forked.send({note: button})
          lastNoteTime = new Date().getTime();
        } else if ((new Date().getTime() - lastNoteTime) < CHORD_TIME) {
          // we're trying to play a chord;
          chordNotesToPlay.push(button);
        }
      } else {
        noteOff(button)
      }
    }
  } else {
    if (!value) {
      if (!processing) {
        forked.send({note: button})
        processing = true;
      } else if ((new Date().getTime() - lastNoteTime) < CHORD_TIME) {
        // we're trying to play a chord;
        chordNotesToPlay.push(button);
      }
    } else {
      noteOff(button)
    }
  }
  pressedMap.set(button, value);
}

playRandom = function() {
  let numberOfRandomNotes = 1;
  let randomNumber = Math.random();
  if (randomNumber > 0.9) {
    numberOfRandomNotes = 2;
  } else if (randomNumber > 0.95) {
    numberOfRandomNotes = 3;
  }

  setTimeout(() => {
    for (let i = 0; i < numberOfRandomNotes; i++) {
      if (randomNotesToPlay.length == 0) {
        randomNotesToPlay = [0, 1, 2, 3, 4, 5, 6, 7];
      }

      let randomNoteToPlay = (randomNotesToPlay.splice(Math.floor(Math.random() * randomNotesToPlay.length), 1))[0];
      handleButtonValue(randomNoteToPlay, 0)
      setTimeout(() => {
        handleButtonValue(randomNoteToPlay, 1)
      }, randomizeCrowdIndex == 1 ? LONG_RANDOM_SUSTAIN : SHORT_RANDOM_SUSTAIN);
    }
  }, Math.random() * 15);
}

transformNote = function(nextNote, button) {
  let noteText = Tonal.Note.fromMidi(nextNote);
  let splitText = noteText.split("");
  let note = noteText.slice(0, noteText.length - 1);
  let octave = splitText[splitText.length - 1];
  let transformedNote = null;

  if (chosenNotes.indexOf(note) > -1) {
    transformedNote = note;
  } else {
    let smallestDistance = 13;
    transformedNote = chosenNotes[0];

    for (let i = 0 ; i < chosenNotes.length; i++) {
      let noteDistance = Tonal.Distance.semitones(chosenNotes[i], note);
      if (noteDistance < smallestDistance) {
        transformedNote = chosenNotes[i];
        smallestDistance = noteDistance;
      }
    }
  }

  let chord = chosenChordNotes[0];
  for (let chordNotes of chosenChordNotes) {
    if (chordNotes.indexOf(transformedNote) > 0) {
      chord = chordNotes;
      break;
    }
  }

  let chordMidi = chord.map((chordNote) => {
    return Tonal.Note.midi(`${chordNote}${octave}`);
  })
  return [Tonal.Note.midi(`${transformedNote}${octave}`), chordMidi];
}

noteOn = function(channel, note, button) {
  port.write(Buffer.from([0x90 + channel, note, 50]))
  channelMap.get(channel).get(button).push(note);
}

noteOff = function(button) {
  for (let channel of channelMap.keys()) {
    for (let note of channelMap.get(channel).get(button)) {
      port.write(Buffer.from([0x80 + channel, note, 50]))
    }
    channelMap.get(channel).set(button, [])
  }
}

refreshNotesForCurrentKey = function() {
  progressionIntervals      = [1, 5, 6, 4];
  currentChordNotes         = ["C"]
  currentNoteIndex          = 0;
  chosenChords              = Key.secDomChords(`${currentKey.toUpperCase()} major`, progressionIntervals);
  chosenChordNotes          = [];
  chosenNotes               = Tonal.Scale.notes(`${currentKey} ${MODES[currentModeIndex % MODES.length]}`);

  for (let i = 0; i < chosenChords.length; i++) {
    chosenChordNotes.push(Tonal.Chord.notes(chosenChords[i]))
  }

  console.log(`Key Change: ${currentKey} ${MODES[currentModeIndex % MODES.length]}`)
}

refreshNotesForCurrentKey();

process.on('exit', function(code) {
  keyboard.close();
  port.close()
  forked.kill();
  forkedTimer.kill();

  for (let i = 0 ; i < NUM_BUTTONS; i++) {
    noteOff(i)
  }
  return console.log(`About to exit with code ${code}`);
});

