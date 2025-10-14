export default function showTooltipAtPosition(x: number, y: number, tooltipText: string) {
    const tooltip = document.createElement('div');
    tooltip.classList.add('web-agent-tooltip');
  
    const text = document.createElement('span');
    text.innerText = tooltipText;
    text.classList.add('tooltip-text');
    
    const circle = document.createElement('div');
    circle.classList.add('progress-circle');
  
    const circleText = document.createElement('span');
    circleText.classList.add('progress-text');
    circleText.innerText = '0%';
    circle.appendChild(circleText);
  
    tooltip.appendChild(text);
    tooltip.appendChild(circle);
  
    document.body.appendChild(tooltip);
  
    tooltip.style.top = `${y}px`;
    tooltip.style.left = `${x}px`;
  
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      if (progress <= 100) {
        circleText.innerText = `${progress}%`;
        circle.style.background = `conic-gradient(#ffffff ${progress * 3.6}deg, #2196f3 0deg)`;
      }
      if (progress >= 101) {
        clearInterval(interval);
        tooltip.remove();
      }
    }, 30); // (30ms = 3 seconds total)
  }
  