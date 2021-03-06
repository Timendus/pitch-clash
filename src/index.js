import AudioInput from './audioInput';
const io = require('socket.io-client');

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

    checkCollision();
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

  const collisionCanvas = document.createElement('canvas');
  const collisionContext = collisionCanvas.getContext('2d');
  collisionCanvas.width = canvas.width;
  collisionCanvas.height = canvas.height;
  collisionContext.drawImage(level1, 0, 0, canvas.width, canvas.height);
  const collisionMap = collisionContext.getImageData(0,0,canvas.width,canvas.height).data;

  function checkCollision() {
    for ( const player of Object.keys(players) ) {
      const pos = players[player].positions[players[player].positions.length - 1];
      if ( pos[0] >= canvas.width ) {
        console.log("HIT END");
        playing = false;
      }
      const index = Math.min(collisionMap.length - 3, pos[0] * 4 + ( Math.floor(pos[1]) * 4 * canvas.width));
      const [r,g,b] = [collisionMap[index], collisionMap[index+1], collisionMap[index+2]];
      if ( r > 100 && b > 100 && g > 100 ) {
        console.log("GAME END");
        playing = false;
      } else if ( r > 100 ) {
        console.log("ASTEROID COLLIDE");
        players[player].score -= 2;
      }
      const collidePlayer = Object.values(players).find(p => {
        if (p.id == player) return false;
        const hisPos = players[p.id].positions[players[p.id].positions.length - 1];
        return Math.abs(hisPos[0] - pos[0]) < 6 && Math.abs(hisPos[1] - pos[1]) < 6;
      });
      if ( collidePlayer ) {
        console.log("PLAYER COLLIDE");
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
  socket.on('message', async () => {
    // Divide vertical space over the players
    let y = 0;
    for ( const player of Object.keys(players) ) {
      y += canvas.height / (Object.keys(players).length + 1);
      if ( player == socket.id ) {
        players[player].positions = [[20, y]];
        socket.emit('update', players[player]);
        audioInput.setPlayerY(y);
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

  function drawTitle() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(title, 0, 0, canvas.width, canvas.height);
    context.font = '40px Arial';
    context.fillStyle = 'white';
    context.textAlign = "center";
    const numPlayers = Object.keys(players).length;
    context.fillText(`${numPlayers} player${numPlayers > 1 ? 's' : ''}`, 1000, 1150);
  }

  drawTitle();
  interval = setInterval(drawTitle, 100);

  canvas.addEventListener('click', () => {
    socket.emit('message');
  });

  document.querySelector('#start').addEventListener('click', async e => {
    await audioInput.start();
    e.target.remove();
    canvas.classList.remove('hidden');

    socket.emit('join', {
      player: {
        positions: [[20, Math.floor(Math.random() * canvas.height)]],
        color: playerColours[Math.floor(Math.random() * playerColours.length)],
        score: 0
      }
    });
  });

});
