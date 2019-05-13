/* 
   Deeplocal Fruit Genie Prototype
     based on the Simple Teensy DIY USB-MIDI controller created by Liam Lacey
   
   You must select MIDI from the "Tools > USB Type" menu for this code to compile.

   To change the name of the USB-MIDI device, edit the STR_PRODUCT define
   in the /Applications/Arduino.app/Contents/Java/hardware/teensy/avr/cores/usb_midi/usb_private.h
   file. You may need to clear your computers cache of MIDI devices for the name change to be applied.

   See https://www.pjrc.com/teensy/td_midi.html for the Teensy MIDI library documentation.
*/

// The number of fruit "buttons"
const int NUM_OF_BUTTONS = 8;

// The MIDI channel number where we'll send messages
const int MIDI_CHAN = 1;

// Cap touch threshold. Change this if you need more or less sensitivity
const int CAP_THRESH = 2000;

// buttons[] holds the pin number for each fruit wire
int buttons[NUM_OF_BUTTONS] = {
  23,
  22,
  19,
  18,
  17,
  16,
  15,
  1
};

// state[] is the live status of the fruit buttons and updates on each iteration of the loop
int state[NUM_OF_BUTTONS] = {
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
};

// flag[] changes for each fruit to track NOTE_ON/NOTE_OFF
int flag[NUM_OF_BUTTONS] = {
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
};

// Array to store the MIDI note message for each fruit
const int MIDI_NOTE_NUMS[NUM_OF_BUTTONS] = {39, 41, 43, 45, 47, 49, 51, 53};
// MIDI velocity
const int MIDI_NOTE_VEL = 255;

//==============================================================================
//The setup function. Called once when the Teensy is turned on or restarted
void setup() {
  Serial.begin(9600);
}

//==============================================================================
//The loop function. Called over-and-over once the setup function has been called.
void loop() {
  //==============================================================================
  // Update all the buttons. There should not be any long
  // delays in loop(), so this runs repetitively at a rate
  // faster than the buttons could be pressed and released.
  for (int i=0; i < NUM_OF_BUTTONS; i++) {
    state[i] = touchRead(buttons[i]);
  }

  //==============================================================================
  // Check the status of each fruit button
  for (int i=0; i < NUM_OF_BUTTONS; i++) {
    if((flag[i] == 0) && (state[i] > CAP_THRESH+100)) {
        flag[i] = 1;
        usbMIDI.sendNoteOn(MIDI_NOTE_NUMS[i], MIDI_NOTE_VEL, MIDI_CHAN);
    } else if ((flag[i] == 1) && (state[i] < CAP_THRESH-100)) {
        flag[i] = 0;
        usbMIDI.sendNoteOff(MIDI_NOTE_NUMS[i], 0, MIDI_CHAN);
    }
  }

  //for(inti=0;i<NUM_OF_BUTTONS;i++) {
  //  Serial.println(state[i];
  //}
  delay(5);

  //==============================================================================
  // MIDI Controllers should discard incoming MIDI messages.
  // http://forum.pjrc.com/threads/24179-Teensy-3-Ableton-Analog-CC-causes-midi-crash
  while (usbMIDI.read()) {
    // ignoring incoming messages, so don't do anything here.
  }
}
