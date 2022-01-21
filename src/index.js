const io = require('socket.io-client');

window.addEventListener('load', () => {

  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1333;
  canvas.height = 2000;
  context.lineCap = 'round';

  const playerSprite = document.querySelector('#sprites > #player');
  const level1 = document.querySelector('#levels > #level1');

  const socket = io("http://localhost:3000/pitch-clash");
  const players = {};
  const keys = {};

  function clockTick() {
    drawPlayers();
    moveMe();
    requestAnimationFrame(clockTick);
  }

  function drawPlayers() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(level1, 0, 0, canvas.width, canvas.height);
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

  function moveMe() {
    const me = Object.values(players).find(p => p.id == socket.id);
    if ( !me ) return;
    const pos = me.positions[me.positions.length - 1];
    pos[0] += 1;
    if ( keys[38] || keys[40] ) pos[1] += keys[38] ? -2 : 0 + keys[40] ? 2 : 0;
    me.positions.push(pos);
    socket.volatile.emit('update', me, { volatile: true });
  }

  socket.on('join', player => players[player.id] = player);
  socket.on('update', player => players[player.id] = player);
  socket.on('leave', player => delete players[player.id]);
  socket.on('disconnect', () => window.location.reload());

  window.addEventListener('keydown', e => keys[e.keyCode] = true);
  window.addEventListener('keyup', e => keys[e.keyCode] = false);

  // And start!

  socket.emit('join', {
    player: {
      positions: [[20, 30]],
      color: '#FF3322'
    }
  });

  requestAnimationFrame(clockTick);

});
