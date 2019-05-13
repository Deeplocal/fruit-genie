const QUARTER_NOTE_TIME_MS = 240;

let timer = 0;
setInterval(() => {
  timer++;
  process.send({ tick: timer });
}, QUARTER_NOTE_TIME_MS);
