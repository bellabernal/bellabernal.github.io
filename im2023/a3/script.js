const list_items = document.querySelectorAll('.list-item');
const lists = document.querySelectorAll('.list');

let draggedItem = null;

/*The javascript for drag and drop was so difficult at first, I initially went for using getElemenntbyID, but
had many errors, and situations were I would go to console and it would no longer recognise the element. I then 
found using a bit of research a way I could use querySelectorAll. As I had many elements, and realised it was going 
to be to difficult to have each element only be placed in its own certain box I opted to use querySelectorAll, which meant every 
icon when dragged and placed into a box had the same drag enter, drag over and drop effects. This was 
not the initial idea, but unfortunately with my limited knowledge in code and javascript I was only able to create this 
simple drag and drop effect. I did try multiple times, but had to many errors and issues. I then decided due to 
this being about information deisgn I now had to come up with a way to show my answers, since the javascript was 
not going to do this on its own. Thats when I decided to add a button where an image occurs showing the correct answers to 
which icons match which words. This was a great problem solving method I think works well and therefore still suited my design principle of information design.  */

for (let i = 0; i < list_items.length; i++) {
	const item = list_items[i];

	item.addEventListener('dragstart', function () {
		draggedItem = item;
		setTimeout(function () {
			item.style.display = 'none';
		}, 0)
	});

	item.addEventListener('dragend', function () {
		setTimeout(function () {
			draggedItem.style.display = 'block';
			draggedItem = null;
		}, 0);
	})

	for (let j = 0; j < lists.length; j ++) {
		const list = lists[j];

		list.addEventListener('dragover', function (e) {
			e.preventDefault();
		
			/* I had to ensure the javascript calls the preventDefault method during the dragover event 
			so it indicates that drop is allowed at that location. */
		});
		
		list.addEventListener('dragenter', function (e) {
			e.preventDefault();
			this.style.backgroundColor = "#009FB7";
	
				/* I had to ensure the javascript calls the preventDefault method during the dragover event 
			so it indicates that drop is allowed at that location. */
		
		});

		list.addEventListener('dragleave', function (e) {
			this.style.backgroundColor = "#009FB7";
		});
		/* Using style.backgroundColor property I am able to change the colour when the drag leaves. In this 
		case I made the colour #009FB7" a darker blue, so that the initial divs the icons sit in dissapears, making 
		the overall design more functional and ensuring the user must place the icons in one of the three boxes. It provides great feedback
		in knowing that this box shouldn't have an icon within it.   */

		list.addEventListener('drop', function (e) {
			console.log('drop');
			this.append(draggedItem);
			this.style.backgroundColor = "pink";
		});

			/* The append method is mainly used to append the icon to where it has been dropped. It allows for the user 
			to place the icon within the box of choice, if two are placed, the other will fall beneath it but still within the same box.
			I decided to create another colour change, using the same previous java, this time on the drop function. This colour change, allows the 
			user to know their icon has been placed into a box. Using colours to change the drag enter, drag leave and drop functions is 
			a great way to ensure users know what interactions are occuring, and also add colour and therefore connect to the chosen 
			adjective playful.  */
	}
}