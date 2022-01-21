import MidiParser from 'midi-parser-js';
import midiFile from "!!binary-loader!./music.mid";

const midiData = new Uint8Array(midiFile.length);
for (let i = 0; i < midiFile.length; i++) {
    midiData[i] = midiFile.charCodeAt(i);
}

const obj = MidiParser.parse(midiData);

console.log(obj);

document.addEventListener('DOMContentLoaded', () => {

  const track = 7;
  const yMin = Math.min(...obj.track[track].event.filter(e => e.type == 9).map(e => e.data[0]));
  const yMax = Math.max(...obj.track[track].event.filter(e => e.type == 9).map(e => e.data[0]));
  console.log({ yMin, yMax })
  let xPos = 0;
  for ( const event of obj.track[track].event ) {
    if ( event.type == 9 ) {
      // console.log({ note: event.data[0], time: event.deltaTime });
      const yPos = window.innerHeight - (event.data[0] * (window.innerHeight / 127));
      const elm = document.createElement('div');
      elm.classList.add('note');
      elm.style.top = `${yPos}px`;
      elm.style.left = `${xPos += (event.deltaTime/5)}px`;
      document.body.appendChild(elm);
    }
  }

});
