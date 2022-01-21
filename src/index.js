const io = require('socket.io-client');

function average(arr) {
  return arr.reduce((sum, item) => sum + item, 0) / arr.length;
}

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

function lerp(a, b, t) {
  if (t === 0) {
    return a;
  }
  if (t === 1) {
    return b;
  }
  return t * b + (1 - t) * a;
}

class AudioInput {
  constructor() {
    this.audioCtx = new window.AudioContext();
    this.analyser = this.audioCtx.createAnalyser();

    this.analyser.fftSize = 2048;
    const bufferLength = this.analyser.frequencyBinCount;
    this.uint8TimeDomain = new Uint8Array(bufferLength);
    this.uint8FrequencyData = new Uint8Array(bufferLength);
    this.floatTimeDomain = new Float32Array(bufferLength);

    this.pitches = [];
    this.currentY = 0;
    this.playerY = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
  }

  async stop() {
    this.source.disconnect(this.analyser);
    for (const track of this.stream.getTracks()) {
      track.stop();
    }
  }

  getPitch() {
    this.analyser.getFloatTimeDomainData(this.floatTimeDomain);
    return autoCorrelate(this.floatTimeDomain, this.audioCtx.sampleRate);
  }

  getPlayerY() {
    const pitch = this.getPitch();
    this.pitches.push(pitch);
    while (this.pitches.length > 20) {
      this.pitches.shift();
    }

    const cleanPitches = this.pitches.filter((pitch) => pitch !== null);
    function pitchToY(pitch) {
      const height = 1333;
      const pitchMin = 100;
      const pitchMax = 400;
      const fraction = (pitch - pitchMin) / (pitchMax - pitchMin);
      const yMax = 0;
      const yMin = height;
      return fraction * (yMax - yMin) + yMin;
    }
    if (cleanPitches.length >= 10) {
      const avgPitch = average(cleanPitches);
      const pitchNoise = average(
        cleanPitches.map((pitch) => {
          return Math.abs(avgPitch - pitch);
        })
      );
      const pitchWeight = clamp(1 / pitchNoise, 0, 1);

      if (isFinite(avgPitch)) {
        const y = pitchToY(avgPitch);
        this.currentY = lerp(this.currentY, y, pitchWeight);
      }
      this.playerY = lerp(this.playerY, this.currentY, 0.9);
    }

    return this.playerY;
  }

  setPlayerY(y) {
    this.currentY = y;
    this.playerY = y;
  }

  getByteFrequencyData() {
    this.analyser.getByteFrequencyData(this.uint8FrequencyData);
    return this.uint8FrequencyData;
  }

  getByteTimeDomainData() {
    this.analyser.getByteTimeDomainData(this.uint8TimeDomain);
    return this.uint8TimeDomain;
  }
}

window.addEventListener('load', async () => {

  const audioInput = new AudioInput();

  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 2000;
  canvas.height = 1333;
  context.lineCap = 'round';

  const playerSprite = document.querySelector('#sprites > #player');
  const title = document.querySelector('#levels > #title');
  const level1 = document.querySelector('#levels > #level1');

  const socket = io("https://browserjam-event-server.herokuapp.com/pitch-clash");
  const players = {};
  const keys = {};
  let playing = true;
  let interval;

  const playerColours = [
    '#0FA5FF',
    '#F4B547'
  ];

  function clockTick() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(level1, 0, 0, canvas.width, canvas.height);

    drawPlayers();
    drawScores();

    checkCollission();
    moveMe();

    if ( playing ) requestAnimationFrame(clockTick);
  }

  function drawPlayers() {
    for ( const player of Object.keys(players) ) {
      context.beginPath();
      context.strokeStyle = players[player].color;
      context.lineWidth = 5;
      context.shadowColor = players[player].color;
      context.shadowBlur = 15;
      let pos = players[player].positions[0];
      context.moveTo(pos[0], pos[1]);
      for ( let pos of players[player].positions ) context.lineTo(pos[0], pos[1]);
      context.stroke();
    }
  }

  function drawScores() {
    context.font = '20px Arial';
    context.fillStyle = 'white';
    context.shadowColor = 'rgba(0,0,0,0)';
    for ( const player of Object.keys(players) ) {
      const pos = players[player].positions[players[player].positions.length - 1];
      context.fillText(players[player].score, pos[0] - 20, pos[1] - 20);
    }
  }

  const collissionCanvas = document.createElement('canvas');
  const collissionContext = collissionCanvas.getContext('2d');
  collissionCanvas.width = canvas.width;
  collissionCanvas.height = canvas.height;
  collissionContext.drawImage(level1, 0, 0, canvas.width, canvas.height);
  const collissionMap = collissionContext.getImageData(0,0,canvas.width,canvas.height).data;

  function checkCollission() {
    for ( const player of Object.keys(players) ) {
      const pos = players[player].positions[players[player].positions.length - 1];
      if ( pos[0] >= canvas.width ) {
        console.log("HIT END");
        playing = false;
      }
      const index = pos[0] * 4 + ( pos[1] * 4 * canvas.width);
      const [r,g,b] = [collissionMap[index], collissionMap[index+1], collissionMap[index+2]];
      if ( r > 100 && b > 100 && g > 100 ) {
        playing = false;
      } else if ( r > 100 ) {
        players[player].score -= 2;
      }
      const collidePlayer = Object.values(players).find(p => {
        if (p.id == player) return false;
        const hisPos = players[p.id].positions[players[p.id].positions.length - 1];
        return Math.abs(hisPos[1] - pos[1]) < 6;
      });
      if ( collidePlayer ) {
        console.log("BOOM");
        playing = false;
      }
    }
  }

  function moveMe() {
    const me = Object.values(players).find(p => p.id == socket.id);
    if ( !me ) return;
    const pos = me.positions[me.positions.length - 1];
    pos[0] += 1;
    pos[1] = audioInput.getPlayerY();
    me.positions.push(pos);
    me.score += 1;
    socket.volatile.emit('update', me, { volatile: true });
  }

  socket.on('join', player => players[player.id] = player);
  socket.on('update', player => players[player.id] = player);
  socket.on('leave', player => delete players[player.id]);
  socket.on('disconnect', () => window.location.reload());
  socket.on('message', () => {
    // Divide vertical space over the players
    let y = 0;
    for ( const player of Object.keys(players) ) {
      y += canvas.height / (Object.keys(players).length + 1);
      if ( player == socket.id ) {
        players[player].positions = [[20, y]];
        socket.emit('update', players[player]);
        break;
      }
    }

    // Start the game!
    clearInterval(interval);
    requestAnimationFrame(clockTick);
  });

  window.addEventListener('keydown', e => keys[e.keyCode] = true);
  window.addEventListener('keyup', e => keys[e.keyCode] = false);

  // And start!

  const playerY = 30;
  audioInput.setPlayerY(playerY);

  socket.emit('join', {
    player: {
      positions: [[20, Math.floor(Math.random() * canvas.height)]],
      color: playerColours[Math.floor(Math.random() * playerColours.length)],
      score: 0
    }
  });

  function drawTitle() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(title, 0, 0, canvas.width, canvas.height);
    context.font = '40px Arial';
    context.fillStyle = 'white';
    const numPlayers = Object.keys(players).length;
    context.fillText(`${numPlayers} player${numPlayers > 1 ? 's' : ''}`, 930, 1150);
  }

  drawTitle();
  interval = setInterval(drawTitle, 100);

  canvas.addEventListener('click', async () => {
    await audioInput.start();
    socket.emit('message');
  });

});
