/* 
   Deeplocal Fruit Genie Prototype
*/

// The number of fruit "buttons"
const int NUM_OF_BUTTONS = 8;

// Cap touch threshold. Change this if you need more or less sensitivity
const int CAP_THRESH = 2000;

// Communication to the Raspberry Pi
//  Each bit in flagByte corresponds to the status of a button
//  Bit 0 = button 0, etc
uint8_t flagByte = 0;

// buttons[] holds the pin number for each fruit wire
int buttons[NUM_OF_BUTTONS] = 
{
  23,
  22,
  19,
  18,
  17,
  16,
  15,
  1
};

// state[] holds the cap touch reading for each of the fruit buttons and updates on each iteration of the loop
int state[NUM_OF_BUTTONS] = 
{
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
};

bool flag[NUM_OF_BUTTONS] = 
{
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
};

uint8_t buildPacket(bool* flag) 
{
  uint8_t packet = 0;

  // Check to make sure we won't hang the program
  if(NUM_OF_BUTTONS > 8) 
  {
    Serial.println("You'll need to redefine the communication protocol (change the buildPacket function) to get this to work.");
    Serial.println("Ending now.");
    // Hang
    while(1); 
  }

  // Set each bit of flagByte to 1 or 0 based on the status in the flag array
  for(int i=0;i<NUM_OF_BUTTONS;i++) 
  {
    packet |= (flag[i]<<i);
  }

  return packet;
}

//The setup function. Called once when the Teensy is turned on or restarted
void setup() 
{
  Serial.begin(115200);
}

//The loop function. Called over-and-over once the setup function has been called.
void loop() 
{
  // Update all the buttons. There should not be any long
  // delays in loop(), so this runs repetitively at a rate
  // faster than the buttons could be pressed and released.
  for (int i=0; i < NUM_OF_BUTTONS; i++) 
  {
    state[i] = touchRead(buttons[i]);
  }

  // Check the status of each fruit button
  //   The CAP_THRESH+100 and CAP_THRESH-100 act as a bit of hysteresis to prevent the
  //   captouch buttons for rapidly changing due to minor fluctuations in capacitance.
  for (int i=0; i < NUM_OF_BUTTONS; i++) {
    if((flag[i] == 0) && 
       (state[i] > CAP_THRESH+100)) 
    {
        flag[i] = 1;
    } 
    else if ((flag[i] == 1) && 
             (state[i] < CAP_THRESH-100)) 
    {
        flag[i] = 0;
    }
  }

  flagByte = buildPacket(flag);  
  Serial.print("0b");
  Serial.println(flagByte);

  //for(inti=0;i<NUM_OF_BUTTONS;i++) 
  //{
  //  Serial.println(state[i];
  //}
  
  delay(5);
}
