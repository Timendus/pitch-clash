const io = require('socket.io-client');

window.addEventListener('load', () => {

  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 2000;
  canvas.height = 1333;
  context.lineCap = 'round';

  const playerSprite = document.querySelector('#sprites > #player');
  const title = document.querySelector('#levels > #title');
  const level1 = document.querySelector('#levels > #level1');

  const socket = io("http://localhost:3000/pitch-clash");
  const players = {};
  const keys = {};
  let playing = true;
  let interval;

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
    if ( keys[38] || keys[40] ) pos[1] += keys[38] ? -2 : 0 + keys[40] ? 2 : 0;
    me.positions.push(pos);
    me.score += 1;
    socket.volatile.emit('update', me, { volatile: true });
  }

  socket.on('join', player => players[player.id] = player);
  socket.on('update', player => players[player.id] = player);
  socket.on('leave', player => delete players[player.id]);
  socket.on('disconnect', () => window.location.reload());
  socket.on('message', () => {
    clearInterval(interval);
    requestAnimationFrame(clockTick);
  });

  window.addEventListener('keydown', e => keys[e.keyCode] = true);
  window.addEventListener('keyup', e => keys[e.keyCode] = false);

  // And start!

  socket.emit('join', {
    player: {
      positions: [[20, Math.floor(Math.random() * canvas.height)]],
      color: '#FF3322',
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

  canvas.addEventListener('click', () => {
    socket.emit('message');
  });

});
