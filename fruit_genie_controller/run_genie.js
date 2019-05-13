const CHECKPOINTS_DIR = 'https://storage.googleapis.com/magentadata/js/checkpoints';
const GENIE_CHECKPOINT = `${CHECKPOINTS_DIR}/piano_genie/model/epiano/stp_iq_auto_contour_dt_166006`;

const PianoGenie = require("./services/PianoGenie")

let genieReady = false;
let genie = new PianoGenie(GENIE_CHECKPOINT)

genie.initialize().then(() => {
  genieReady = true;
  process.send({genieReady: true})
})

process.on('message', (msg) => {
  if (genieReady) {
    process.send({ note: genie.next(msg.note, 0.25), button: msg.note });
  }
});
