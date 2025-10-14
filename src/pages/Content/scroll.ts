export default async function scrollInDirection(direction: 'up' | 'down' | 'left' | 'right') {
    let amount = 400;
    let x = 0;
    let y = 0;
  
    switch (direction) {
      case 'up':
        y = -amount;
        break;
      case 'down':
        y = amount;
        break;
      case 'left':
        amount = 50;
        x = -amount;
        break;
      case 'right':
        amount = 50;
        x = amount;
        break;
    }
  
    window.scrollBy({
      top: y,
      left: x,
      behavior: 'smooth'
    });
  }