const draggableListItems = document.querySelectorAll('.draggable-list li');
const endMessage = document.getElementById('endMessage');

let selectedId;

let dropTargetId;

let matchingCounter = 0;

addEventListeners();

function dragStart() {
  selectedId = this.id;
}

function dragEnter() {
  this.classList.add('over');
}

function dragLeave() {
  this.classList.remove('over');
}

function dragOver(ev) {
  ev.preventDefault();
}

function dragDrop() {
  dropTargetId = this.id;

  if (checkForMatch(selectedId, dropTargetId)) {
    document.getElementById(selectedId).style.display = 'none';
    document.getElementById(dropTargetId).style.display = 'none';
    matchingCounter++;
  } else if (checkForMatch2(selectedId, dropTargetId)) {
    document.getElementById(selectedId).style.display = 'none';
    document.getElementById(dropTargetId).style.display = 'none';
    matchingCounter++;
  }

  if (matchingCounter === 10) {
    endMessage.style.display = 'block';
  }

  this.classList.remove('over');
}

function checkForMatch(selected, dropTarget) {
  switch (selected) {
    case 'e1':
      return dropTarget === 's1' ? true : false;

    case 'e2':
      return dropTarget === 's2' ? true : false;

    case 'e3':
      return dropTarget === 's3' ? true : false;

    case 'e4':
      return dropTarget === 's4' ? true : false;

    case 'e5':
      return dropTarget === 's5' ? true : false;

    case 'e6':
        return dropTarget === 's6' ? true : false;

    case 'e7':
          return dropTarget === 's7' ? true : false;

    case 'e8':
            return dropTarget === 's8' ? true : false;
    case 'e9':
              return dropTarget === 's9' ? true : false;
    case 'e10':
        return dropTarget === 's10' ? true : false;
  

    default:
      return false;
  }
}

function checkForMatch2(selected, dropTarget) {
  switch (selected) {
    case 's1':
      return dropTarget === 'e1' ? true : false;

    case 's2':
      return dropTarget === 'e2' ? true : false;

    case 's3':
      return dropTarget === 'e3' ? true : false;

    case 's4':
      return dropTarget === 'e4' ? true : false;

    case 's5':
      return dropTarget === 'e5' ? true : false;
    
      case 's6':
        return dropTarget === 'e6' ? true : false;


        case 's7':
          return dropTarget === 'e7' ? true : false;
     
          case 's8':
          return dropTarget === 'e8' ? true : false;

      case 's9':
        return dropTarget === 'e9' ? true : false;
      
    case 's10':
        return dropTarget === 'e10' ? true : false;

    default:
      return false;
  }
}

function playAgain() {
  matchingCounter = 0;
  endMessage.style.display = 'none';
  draggableListItems.forEach(item => {
    document.getElementById(item.id).style.display = 'block';
  })
}

function addEventListeners() {
  draggableListItems.forEach (item => {
    item.addEventListener('dragstart', dragStart);
    item.addEventListener('dragenter', dragEnter);
    item.addEventListener('drop', dragDrop);
    item.addEventListener('dragover', dragOver);
    item.addEventListener('dragleave', dragLeave);
  })

  //timer//
  let timeSecond = 120;
const timeH = document.querySelector("section");

displayTime(timeSecond);

const countDown = setInterval(() => {
  timeSecond--;
  displayTime(timeSecond);
  if (timeSecond == 0 || timeSecond < 1) {
    endCount();
    clearInterval(countDown);
  }
}, 1000);

function displayTime(second) {
  const min = Math.floor(second / 60);
  const sec = Math.floor(second % 60);
  timeH.innerHTML = `
  ${min < 10 ? "0" : ""}${min}:${sec < 10 ? "0" : ""}${sec}
  `;
}

function endCount() {
  timeH.innerHTML = "TIMES OVER!";
}
}