const Tonal                           = require("tonal");
const SerialPort                      = require('serialport')
const Speaker                         = require('audio-speaker/stream');
const Generator                       = require('audio-generator/stream');

const FIRST_BUTTON_PRESSED_MASK       = 0b00000001;
const SECOND_BUTTON_PRESSED_MASK      = 0b00000010
const THIRD_BUTTON_PRESSED_MASK       = 0b00000100
const FOURTH_BUTTON_PRESSED_MASK      = 0b00001000
const FIFTH_BUTTON_PRESSED_MASK       = 0b00010000
const SIXTH_BUTTON_PRESSED_MASK       = 0b00100000
const SEVENTH_BUTTON_PRESSED_MASK     = 0b01000000
const EIGHTH_BUTTON_PRESSED_MASK      = 0b10000000

const ARDUINO_CONTROLLER_BAUD         = 9600;

const { fork }                = require('child_process');
const forked                  = fork('run_genie.js');

const buttonMap               = new Map();
const pressedMap              = new Map();

let LOWEST_NOTE               = 24;
let NUM_CHANNELS              = 3;
let NUM_BUTTONS               = 8;
let genieReady                = false;
let currentNotes              = [];

const arduino = new SerialPort('/dev/ttyACM0', {
  baudRate: ARDUINO_CONTROLLER_BAUD
})

// Setup the arduino port to listen for key presses
let Readline = SerialPort.parsers.Readline
let parser = new Readline()
arduino.pipe(parser);

forked.on('message', (msg) => {
  if (msg.genieReady == true) {
    genieReady = true;
    arduino.write("S\n");
  } else {
    noteOn(msg.note + LOWEST_NOTE, msg.button)
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
})

handleButtonValue = function(button, value) {
  if (!genieReady) {
    // Wait for Tensorflow to load Piano Genie network
    return;
  }

  if (pressedMap.has(button)) {
    if (pressedMap.get(button) != value) {
      if (!value) {
        forked.send({note: button})
      } else {
        noteOff(button)
      }
    }
  } else {
    if (!value) {
      forked.send({note: button})
    } else {
      noteOff(button)
    }
  }
  pressedMap.set(button, value);
}

noteOn = function(note, button) {
  // Add to current list of output notes
  currentNotes.push(note);
  buttonMap.set(button, note)
}

noteOff = function(button) {
  if (buttonMap.has(button)) {
    let note = buttonMap.get(button)
    currentNotes.splice(currentNotes.indexOf(note), 1);
    buttonMap.delete(button);
  }
}

startAudioOutput = function() {
  let stream = Generator(function (time) {
      var τ = Math.PI * 2;
      let notesToPlay = []
      for (let note of currentNotes) {
        let frequency = Tonal.Note.freq(Tonal.Note.fromMidi(note))
        notesToPlay.push(Math.sin(τ * time * frequency))
      }
      return notesToPlay;
  })

  stream.pipe(Speaker({}));
}

startAudioOutput();

process.on('exit', function(code) {
  keyboard.close();
  forked.kill();

  // Turn off any stray notes
  for (let i = 0 ; i < NUM_BUTTONS; i++) {
    noteOff(i)
  }

  return console.log(`About to exit with code ${code}`);
});