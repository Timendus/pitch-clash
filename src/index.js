document.addEventListener('DOMContentLoaded', () => {

  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('2d');
  const playerSprite = document.querySelector('#sprites > #player');

  // canvas.width = 1000;
  // canvas.height = 333;
  context.drawImage(playerSprite, 0, 0, playerSprite.width, playerSprite.height);

});
