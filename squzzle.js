// TODO: On double-click of a group, send it to the back (but not below the rect)
$ = function(selector) { return document.querySelector(selector); };
$$ = function(selector) { return document.querySelectorAll(selector); };

var panning = false;            // False when not panning the play area, otherwise an object with properties startX, startY to record where the drag began, taking into account previous drag movements
var dragPiece = {};             // Set of pieces currently being dragged where the property is either "mouse" if the mouse started moving it or else "touch#" where # is the touch identifier
// touchedPiece.startX, touchedPiece.startY;             // Position where dragged puzzle piece was grabbed
var app = {                     // Object storing all global application data
	zoomLevel: 1,                  // Current zoom level, where 1 represents no scaling
	pan: { dx: 0, dy: 0 }          // x and y offset of the view based on panning
};
var puzzle = {                  // Object storing all key values
		pieces: 200,               // Approximately how many pieces to have
		minWidth: 50,              // Minimum allowed width of a single piece, in pixels
		minHeight: 50,             // Minimum allowed height of a single piece, in pixels
		rows: null,                // Total rows in the puzzle
		columns: null,             // Total columns in the puzzle
		width: null,               // Width of the source image, in pixels
		height: null,              // Height of the source image, in pixels
		pieceWidth: null,          // Width of a single piece, in pixels
		pieceHeight: null,         // Height of a single piece, in pixels
		nubWidth: null,            // The amount of extra width given to a piece by an external connector nub, in pixels
		nubHeight: null,           // The amount of extra height given to a piece by an external connector nub, in pixels
		snapThreshold: 20          // Distance a piece may be from an exact fit before it snaps into place, in pixels
	};

function logAction(msg) {
	$('#log').firstChild.nodeValue = $('#log').firstChild.nodeValue + "\n" + msg;
}

/**
 * Render the puzzle and perform all setup and initialisations needed
 */
function setupPuzzle() {
	// Determine the size of the puzzle
	puzzle.width = document.getElementById("puzzleImg").width = 800;
	puzzle.height =	document.getElementById("puzzleImg").height = 800;

	// For these dimensions, get the angle of the triangle
	var angleTan = puzzle.width / puzzle.height;

	// Determine the area of each piece
	var pieceArea = puzzle.width * puzzle.height / puzzle.pieces;

	// Determine the size of each piece (without nubs)
	var pieceHeight = Math.sqrt(pieceArea / angleTan);
	var pieceWidth = pieceArea / pieceHeight;

	// Calculate how many rows and columns of pieces we will have
	puzzle.columns = Math.floor(puzzle.width / pieceWidth);
	puzzle.rows = Math.floor(puzzle.height / pieceHeight);
	
	// Determine the dimensions of a single piece
	puzzle.pieceWidth = Math.floor(pieceWidth);
	puzzle.pieceHeight = Math.floor(pieceHeight);

	// Calculate the amount an exterior nub will contribute to the side it's on
	puzzle.nubWidth = puzzle.pieceWidth / 3;
	puzzle.nubHeight = puzzle.pieceHeight / 3;

	// Setup pan dragging, which allows moving around the screen by dragging the background
	document.body.addEventListener('mousedown', startPan, false);
	document.body.addEventListener('touchstart', startTouchPan, false);

	// Listen to drag events at the root in case we move too fast on a piece	
	document.body.addEventListener('mousemove', moveDrag, false);
	document.body.addEventListener('touchmove', moveTouchPan, false);
	document.body.addEventListener('mouseup', endDrag, false);
	document.body.addEventListener('touchend', endTouchPan, false);
	document.body.addEventListener('mousewheel', zoomView, false);
	
	// Size the play area to fit the image
	var mainArea = $("#viewport");
	mainArea.setAttributeNS(null, "width", "100%");
	mainArea.setAttributeNS(null, "height", "100%");
	mainArea.setAttributeNS(null, "viewBox", "0 0 " + document.body.offsetWidth + " " + document.body.offsetHeight);
	
	// Size the background
	var bg = $("#background");
	bg.setAttributeNS(null, "width", puzzle.pieceWidth * puzzle.columns);
	bg.setAttributeNS(null, "height", puzzle.pieceHeight * puzzle.rows);

	// Draw the puzzle pieces
	renderPuzzle();
}


/**
 * Draw all pieces on the board
 */
function renderPuzzle() {
	var scatterFactor = 2;

	for (var row = 0; row < puzzle.rows; row++) {
		for (var column = 0; column < puzzle.columns; column++) {
			drawPiece(Math.random() * puzzle.width * scatterFactor - (column * puzzle.pieceWidth), Math.random() * puzzle.height * scatterFactor - (row * puzzle.pieceHeight), puzzle.pieceWidth, puzzle.pieceHeight, row, column);
//			drawPiece(0, 0, puzzle.pieceWidth, puzzle.pieceHeight, row, column);       // Perfectly aligned (debug)
		}
	}
}


/**
 * Render the specified piece
 * @param  x {Number} The horizontal offset position of the piece in the puzzle grid, where 0 is the left-most position of the piece when fitted in its correct position
 * @param y {Number} The vertical offset position of the piece in the puzzle grid, where 0 is the top-most position of the piece when fitted in its correct position
 * @param width {Number} The width of the piece in pixels (excluding the joining parts)
 * @param height {Number} The height of the piece in pixels (excluding the joining parts)
 * @param row {Number} The row the piece is found in, where the first row is 0 (top)
 * @param column {Number} The column the piece is found in, where the first column is 0 (left)
 */
function drawPiece(x, y, width, height, row, column) {
	// Define the units of measure for the puzzle piece
	var ux = width / 12;
	var uy = height / 12;

	// Create the wrapping group for the piece
	var group = document.createElementNS("http://www.w3.org/2000/svg", "g");

	// Create the base puzzle piece's path element
	var puzzlePiece = document.createElementNS("http://www.w3.org/2000/svg", "path");
	
	// Build the path shape
	var nubs = getNubs(row, column);                            // Determine the outline shape of this piece
	var d = "M" + puzzle.nubWidth + "," + puzzle.nubHeight + getPieceSides(ux, uy, nubs) + " z";        // Build the shape definition parameter
	puzzlePiece.setAttributeNS(null, "d", d);                   // Apply the definition to the actual shape element
	group.matrix = [1, 0, 0, 1, x, y];                          // Track each piece's transformation matrix within the object itself for simpler manipulation
	puzzlePiece.setAttributeNS(null, "id", "PR" + row + "C" + column);     // Tag the piece id in a way that makes it easy to obtain any piece just by knowing its position in the puzzle
	puzzlePiece.setAttributeNS(null, "transform", "matrix(1,0,0,1," + (column * puzzle.pieceWidth) + "," + (row * puzzle.pieceHeight) + ")");     // Position the path within the group according to it's position within the puzzle; we move the parent group, not the path, but pieces need to remain correctly aligned relatively when grouped together
	
	// Set the fill for the piece, which paints it with the puzzle's image
	var patternId = "XR" + row + "C" + column;                  // Curiously, we can't use the form R#C#, or the pattern fails to display
	createPiecePattern(row, column, patternId, nubs);
	puzzlePiece.setAttributeNS(null, "fill", "url(#" + patternId + ")");
	
	// Position the puzzle piece
	group.setAttributeNS(null, "transform", "matrix(" + group.matrix.join(',') + ")");     // Apply a default transformation so we can later parse it
	
	// Add the piece to the layout
	group.appendChild(puzzlePiece);
	document.getElementById('viewport').appendChild(group);
	
	// Apply event listeners to the puzzle piece
	puzzlePiece.addEventListener('mousedown', startDrag, false);
	puzzlePiece.addEventListener('touchstart', startTouchDrag, false);
	puzzlePiece.addEventListener('dblclick', dropPiece, false);
	group.addEventListener('click', sendToBack, false);
}


/**
 * Returns a nub array specifing the shape type of each side of a puzzle piece
 * @param row {Number} The row the piece is found in, where the first row is 0 (top)
 * @param column {Number} The column the piece is found in, where the first column is 0 (left)
 * @return array Returns an array four values of -1, 0, or 1 values, ordered by side going clockwise from the top, where:
 *			 1 means the puzzle piece should come inside the piece on the given side
 *			 0 means no nub should be present (flat)
 *			 -1 means the puzzle piece should protrude on the given side
 */
function getNubs(row, column) {
	var nubs = [0, 0, 0, 0];       // Default to no sides having connectors (nubs)
	
	if (row > 0) {
		nubs[0] = (((row + column) % 2) * 2) - 1;
	}
	if (column < (puzzle.columns - 1)) {
		nubs[1] = (((row + column + 1) % 2) * 2) - 1;
	}
	if (row < (puzzle.rows - 1)) {
		nubs[2] = (((row + column) % 2) * 2) - 1;
	}
	if (column > 0) {
		nubs[3] = (((row + column + 1) % 2) * 2) - 1;
	}

	return nubs;
}


/**
 * Creates a pattern for use with a single puzzle piece
 * @param row {Number} The row the piece is found in, where the first row is 0 (top); if set to -1, set the pattern to be sized to the full puzzle image, ignore nubs in this case
 * @param column {Number} The column the piece is found in, where the first column is 0 (left); ignored if row is -1
 * @param id {String} The id to give to the pattern, for use when linking shapes to it
 * @param nubs {Array} An array four values of -1, 0, or 1 values, ordered by side going clockwise from the top, where:
 *			 1 means the puzzle piece should come inside the piece on the given side
 *			 0 means no nub should be present (flat)
 *			 -1 means the puzzle piece should protrude on the given side
 */
function createPiecePattern(row, column, id, nubs) {
	// Create the pattern for this piece, of the following form:
	/*
		<pattern id="img1" patternUnits="userSpaceOnUse" width="900" height="1355">
			<image xlink:href="puzzles/puzzle1.jpg" x="-200" y="-200" width="900" height="1355" />
		</pattern>
	*/
	
	var offsetX = 0;                                  // Amount to shift pattern by horizontally
	var offsetY = 0;                                  // Amount to shift pattern by vertically
	
	if (row == -1) {
		// Create a pattern for the full puzzle
		var actualPieceWidth = puzzle.width;         // Width of the entire puzzle
		var actualPieceHeight = puzzle.height;       // Height of the entire puzzle
		var imageX = 0;                              // No image shifting for the full puzzle image
		var imageY = 0;                              // No image shifting for the full puzzle image
	} else {
		// Determine the actual width and height of the piece
		var actualPieceWidth = puzzle.pieceWidth;         // Base width of the pattern without nubs
		var actualPieceHeight = puzzle.pieceHeight;       // Base height of the pattern without nubs
		var imageX = -column * puzzle.pieceWidth;         // Horizontal image position within the pattern, offset to match puzzle piece's location
		var imageY = -row * puzzle.pieceHeight;           // Vertical image position within the pattern, offset to match puzzle piece's location
		
		// Adjust actual piece dimensions for nub protrusions
		if (nubs[0] < 0) { actualPieceHeight += puzzle.nubHeight; imageY += puzzle.nubHeight; }
		if (nubs[1] < 0) { actualPieceWidth += puzzle.nubWidth; }
		if (nubs[2] < 0) { actualPieceHeight += puzzle.nubHeight; }
		if (nubs[3] < 0) { actualPieceWidth += puzzle.nubWidth; imageX += puzzle.nubWidth; }
	
		// Correct base pattern position for top-left no nub protrusion cases
		if (nubs[0] >= 0) { offsetY += puzzle.nubHeight; }
		if (nubs[3] >= 0) { offsetX += puzzle.nubWidth; }
	}
	
	// Define the base pattern
	var pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
	pattern.setAttributeNS(null, "id", id);
	pattern.setAttributeNS(null, "patternUnits", "userSpaceOnUse");
	pattern.setAttributeNS(null, "width", actualPieceWidth);
	pattern.setAttributeNS(null, "height", actualPieceHeight);
	pattern.setAttributeNS(null, "x", offsetX);
	pattern.setAttributeNS(null, "y", offsetY);
	
	// Add the image element
	var image = document.createElementNS("http://www.w3.org/2000/svg", "image");
	image.setAttributeNS("http://www.w3.org/1999/xlink", "href", "puzzles/3.jpg");
	image.setAttributeNS(null, "x", imageX);
	image.setAttributeNS(null, "y", imageY);
	image.setAttributeNS(null, "width", puzzle.width);
	image.setAttributeNS(null, "height", puzzle.height);
	pattern.appendChild(image);
	
	// Insert the pattern into the page definitions
	document.getElementById("puzzleDefs").appendChild(pattern);
}


/**
 * Returns the shape code for the sides of the piece's path
 * @param ux {Number} The size of one horizontal unit in pixels
 * @param uy {Number} The size of one vertical unit in pixels
 * @param nubs {Array} An array four values of -1, 0, or 1 values, ordered by side going clockwise from the top, where:
 *			 1 means the puzzle piece should come inside the piece on the given side
 *			 0 means no nub should be present (flat)
 *			 -1 means the puzzle piece should protrude on the given side
 */
function getPieceSides(ux, uy, nubs) {
	var puzzlePath = [['l',4,0], ['c',0,0,1,0,1,1], ['c',0,1,-1,1,-1,2], ['c',0,1,2,1,2,1], ['c',0,0,2,0,2,-1], ['c',0,-1,-1,-1,-1,-2], ['c',0,-1,1,-1,1,-1], ['l',4,0]];	 // Define the shape of a single side
	var side = 0;				// Current side, used to iterate within the do...while loop
	var swap;						// Temporary variable for use when swapping values
	var d = "";					// Path string to define and return
	
	// Build all four sides, rotating the reference side 90 degrees each loop
	do {
		for (var i = 0; i < puzzlePath.length; i++) {
			d += " " + puzzlePath[i][0];				// Pull out the movement action character
			
			// Build the coordinate parameters for the movement, scaling according to the ux,uy unit sizes
			for (var t = 1; t < puzzlePath[i].length; t += 2) {
				if (side % 2) {
					d += (puzzlePath[i][t] * ux * nubs[side]) + "," + (puzzlePath[i][t + 1] * uy) + " ";
				} else {
					d += (puzzlePath[i][t] * ux) + "," + (puzzlePath[i][t + 1] * uy * nubs[side]) + " ";
				}
				
				// Rotate these coordinates for the next loop
				if (side < 3) {
					swap = puzzlePath[i][t];
					puzzlePath[i][t] = -puzzlePath[i][t + 1];
					puzzlePath[i][t + 1] = swap;
				}
			}
		}
		
		side++;	 // Advance to the next side
	} while (side < 4);
	
	return d;
}


/**
 * Returns the bounding box object for the given puzzle piece
 * @param piece {SVGPath} The puzzle element
 * @return SVGRect Returns the bounding rectangle for the given puzzle piece which has width, height, x, and y properties
 */
function getPieceBox(piece) {
	return piece.getBBox();
}


/**
 * Send the double-clicked group to the back if the shift key is held down when clicking
 */
function sendToBack(evt) {
	// Move it to the bottom of the stack, just above the background box
	if (evt.shiftKey) {
		$("#viewport").insertBefore(this, $("#background").nextSibling);
	}
}


/**
 * Begin panning the main view
 */
function startPan(evt) {
	// Get the viewbox's current position
	var viewBox = $("#viewport").getAttributeNS(null, "viewBox").split(" ");
	
	// Record where we started dragging
	panning = {
		touchId: 'mouse',
		startX: (evt.clientX * app.zoomLevel) + parseInt(viewBox[0], 10),
		startY: (evt.clientY * app.zoomLevel) + parseInt(viewBox[1], 10)
	};
}


/**
 * Begin panning the main view by touch
 */
function startTouchPan(evt) {
	// Don't start touch panning if we are actively dragging pieces
	for (var draggers in dragPiece) {
		if (dragPiece.hasOwnProperty(draggers)) {
			return;
		}
	}

	// Do not start a new pan if there is already one in progress and if the target isn't a piece
	if ((panning === false) && (evt.target.nodeName != "path")) {
		// Get the viewbox's current position
		var viewBox = $("#viewport").getAttributeNS(null, "viewBox").split(" ");

		// Record where we started dragging
		panning = {
			touchId: evt.changedTouches[0].identifier, // Tracks which touch point is dragging the board so we know when to end
			startX: (evt.changedTouches[0].clientX * app.zoomLevel) + parseInt(viewBox[0], 10),
			startY: (evt.changedTouches[0].clientY * app.zoomLevel) + parseInt(viewBox[1], 10)
		};
	}
}


/**
 * Handle grabbing a puzzle piece
 */
function startDrag(evt) {
	// Prevent dragging pieces if the board is being panned
	if (panning) { return; }

	// Drop any other pieces being dragged before starting another one
	if (dragPiece.mouse) { endDrag(); }

	// Store a reference to the dragged piece
	dragPiece.mouse = evt.target.parentNode;
	
	// Apply the drag handlers to handle moving it around the screen
	dragPiece.mouse.addEventListener('mousemove', moveDrag, false);
	dragPiece.mouse.addEventListener('mouseup', endDrag, false);
	
	// Get the starting position to drag from to allow us to monitor movements later
	dragPiece.mouse.startX = evt.clientX * app.zoomLevel - dragPiece.mouse.matrix[4];
	dragPiece.mouse.startY = evt.clientY * app.zoomLevel - dragPiece.mouse.matrix[5];
	
	// Move the element to the top
	dragPiece.mouse.parentNode.appendChild(dragPiece.mouse);
	
	// Pick up the piece, casting a shadow
	var angle = Math.random() * 0.2 - 0.1;
	dragPiece.mouse.setAttributeNS(null, 'transform', 'matrix(' + dragPiece.mouse.matrix.join(',') + ')');
}


/**
 * Handle grabbing a puzzle piece by touch
 */
function startTouchDrag(evt) {
	// Prevent dragging pieces if the board is being panned
	if (panning) { return; }

	// Make sure the target piece isn't already being actively dragged
	for (var draggers in dragPiece) {
		if (dragPiece.hasOwnProperty(draggers) && (dragPiece[draggers] == evt.target)) {
			return;
		}
	}

	// Get the relevant starting touch
	var touch = evt.targetTouches[0];

	// Store a reference to the dragged piece
	dragPiece["touch" + touch.identifier] = evt.target.parentNode;
	var touchedPiece = dragPiece["touch" + touch.identifier]; // Get a quick reference to this new entry
	touchedPiece.touchId = evt.targetTouches[0].identifier; // Track which touch point is moving this piece so we only drop it in response to that touch ending

	// Apply the drag handlers to handle moving it around the screen
	touchedPiece.addEventListener('touchmove', moveTouchDrag, false);
	touchedPiece.addEventListener('touchend', endTouchDrag, false);

	// Get the starting position to drag from to allow us to monitor movements later
	touchedPiece.startX = evt.targetTouches[0].clientX * app.zoomLevel - touchedPiece.matrix[4];
	touchedPiece.startY = evt.targetTouches[0].clientY * app.zoomLevel - touchedPiece.matrix[5];

	// Move the element to the top
	touchedPiece.parentNode.appendChild(touchedPiece);

	// Pick up the piece, casting a shadow
	var angle = Math.random() * 0.2 - 0.1;
	touchedPiece.setAttributeNS(null, 'transform', 'matrix(' + touchedPiece.matrix.join(',') + ')');
}


/**
 * Handle moving a dragged puzzle piece
 */
function moveDrag(evt) {
	if (dragPiece.mouse) {
		// Get the current position and determine the offsets
		var dx = (evt.clientX * app.zoomLevel) - dragPiece.mouse.startX;
		var dy = (evt.clientY * app.zoomLevel) - dragPiece.mouse.startY;
		
		// Move the piece to the new position
		dragPiece.mouse.matrix[4] = dx;
		dragPiece.mouse.matrix[5] = dy;
		dragPiece.mouse.setAttributeNS(null, 'transform', 'matrix(' + dragPiece.mouse.matrix.join(',') + ')');
	} else if (panning) {
		// Determine where we've moved
		app.pan.dx = panning.startX - (evt.clientX * app.zoomLevel);
		app.pan.dy = panning.startY - (evt.clientY * app.zoomLevel);

		// Move the main play area
		updateViewbox();
	}
}


/**
 * Handle moving a dragged puzzle piece by touch
 */
function moveTouchDrag(evt) {
	// Prevent gestures using the drag
	evt.preventDefault();

	var touch = false; // Touch point that is dragging the piece or board
	var touchedPiece = evt.target.parentNode; // Get the piece that is being moved

	if (dragPiece.hasOwnProperty("touch" + touchedPiece.touchId)) {
		// Find the dragging touch point
		for (var i = 0; i < evt.changedTouches.length; i++) {
			if (touchedPiece.touchId == evt.changedTouches[i].identifier) {
				touch = evt.changedTouches[i];
				break;
			}
		}

		// Do not update the piece's position if the dragging touch didn't move
		if (!touch) { return; }

		// Get the current position and determine the offsets
		var dx = (touch.clientX * app.zoomLevel) - touchedPiece.startX;
		var dy = (touch.clientY * app.zoomLevel) - touchedPiece.startY;

		// Move the piece to the new position
		touchedPiece.matrix[4] = dx;
		touchedPiece.matrix[5] = dy;
		touchedPiece.setAttributeNS(null, 'transform', 'matrix(' + touchedPiece.matrix.join(',') + ')');
	}
}


/**
 * Handle moving a dragged board by touch
 */
function moveTouchPan(evt) {
	// Prevent gestures using the drag
	evt.preventDefault();

	if (panning) {
		// Find the dragging touch point
		for (var i = 0; i < evt.changedTouches.length; i++) {
			if (panning.touchId == evt.changedTouches[i].identifier) {
				touch = evt.changedTouches[i];
				break;
			}
		}

		// Do not update the board's position if the dragging touch didn't move
		if (!touch) { return; }

		// Determine where we've moved
		app.pan.dx = panning.startX - (touch.clientX * app.zoomLevel);
		app.pan.dy = panning.startY - (touch.clientY * app.zoomLevel);

		// Move the main play area
		updateViewbox();
	}
}


/**
 * Verify the ended touch is the one dragging the piece and drop it if so
 * @param evt {Object} The touch event
 */
function endTouchDrag(evt) {
	var touchedPiece = evt.target.parentNode; // Get the piece being dropped

	// Only continue if that piece was being dragged
	if (dragPiece["touch" + touchedPiece.touchId]) {
		for (var i = 0; i < evt.changedTouches.length; i++) {
			// Only drop the piece if the ended touch is the one that initially started dragging the piece
			if (touchedPiece.touchId == evt.changedTouches[i].identifier) {
				setPiece(touchedPiece);
				delete dragPiece["touch" + touchedPiece.touchId]; // Clear the drag entry for this touch point
			}
		}
	}
}


/**
 * Verify the ended touch is the one dragging the board and drop it if so
 * @param evt {Object} The touch event
 */
function endTouchPan(evt) {
	if (panning && (panning.touchId != 'mouse')) {
		for (var i = 0; i < evt.changedTouches.length; i++) {
			// Only stop dragging the board if the ended touch is the one that initially started dragging it
			if (panning.touchId == evt.changedTouches[i].identifier) {
				panning = false;
			}
		}
	}
}


/**
 * Handle dropping a puzzle piece
 * @param evt {Object} The mouse event
 */
function endDrag(evt) {
	if (dragPiece.mouse) {
		// Drop the piece dragged by the mouse
		setPiece(dragPiece.mouse);

		// Deselect the piece to prevent any further movement
		delete dragPiece.mouse;
	}

	// Stop panning the play area
	panning = false;
}


/**
 * Set the specified piece down into the puzzle and link it to matching pieces if reasonable
 * @param piece {Object} The piece being dropped
 */
function setPiece (piece) {
	// Create an array of pieces in the current group, so that when we check for snapping, merges that occur won't disrupt the loop
	var pieces = [];
	for (var i = 0; i < piece.childNodes.length; i++) { pieces.push(piece.childNodes.item(i)); }

	// Check to see if the piece should snap to any matching pieces adjacent to it (check all pieces in the dragged group)
	for (var i = 0; i < pieces.length; i++) {
		snapPiece(pieces[i]);
	}

	// Drop the piece, clearing any special transformations that may have been made
	piece.matrix[0] = 1;
	piece.matrix[1] = 0;
	piece.matrix[2] = 0;
	piece.matrix[3] = 1;
	piece.setAttributeNS(null, 'transform', 'matrix(' + piece.matrix.join(',') + ')');

	// Remove the drag handlers, since we are no longer moving the piece
	piece.removeEventListener('mousemove', moveDrag, false);
	piece.removeEventListener('mouseup', endDrag, false);
	piece.removeEventListener('mouseout', endDrag, false);
	piece.removeEventListener('touchmove', moveTouchDrag, false);
	piece.removeEventListener('touchend', endTouchDrag, false);
}


/**
 * Check all non-linked sides to see if we have successfully connected to a piece
 * @param piece {SVGPath} The puzzle piece path element to check
 * @internal If a link is found, group or merge the groups of the linked pieces
 */
function snapPiece(piece) {
	// Find the midpoint of the puzzle piece's side and the opposite side of the adjacent piece
	// If the distance is below the snap threshold, snap them together
	var pieceRowCol = getPieceRowCol(piece);          // Get the row and column of this piece
	var piecePos = getPiecePosition(piece);           // Get the screen coordinate (x, y) of the puzzle piece's top-left and bottom-right corners (ignoring nubs)
	var adjacentCoord = [0, -1];                      // Puzzle column/row offset identifying how to find the adjacent piece
	var comparePiece;                                 // Puzzle piece to compare against for adjacency
	var compareId;                                    // The id of the comparison puzzle piece
	var comparePos;                                   // Screen coordinates of the comparison piece's top-left and bottom-right corners (ignoring nubs)
	var swap;                                         // Temporary swap variable
	var midpointA, midpointB;                         // Midpoint coordinates of the given piece and the comparison piece for the sides being compared

	for (var side = 0; side < 4; side++) {
		// Calculate the comparison puzzle piece's id on the side to check
		compareId = "PR" + (pieceRowCol.row + adjacentCoord[1]) + "C" + (pieceRowCol.column + adjacentCoord[0]);
		
		// Rotate the adjacency before we hit the loop skip, so we ensure it always happens
		swap = adjacentCoord[0];
		adjacentCoord[0] = -adjacentCoord[1];
		adjacentCoord[1] = swap;
		
		// Retrieve the puzzle piece to compare against
		comparePiece = document.getElementById(compareId);

		if (!comparePiece) { continue; }              // If no such piece exists (such as if it is beyond the edge of the puzzle), skip the check

		// Skip check if the comparison piece is already snapped to the current piece
		if ((piece.parentNode.nodeName == "g") && (piece.parentNode == comparePiece.parentNode)) { continue; }

		// Get the coordinates of the piece's base box
		comparePos = getPiecePosition(comparePiece);
		
		// Retrieve the two midpoints from opposing sides
		midpointA = getMidpoint(piecePos, side);
		midpointB = getMidpoint(comparePos, (side + 2) % 4);    // The opposing side is 2 sides away from the current one, wrapping around as necessary

		// Snap the pieces if the two sides are sufficiently aligned
		if (getDistance(midpointA, midpointB) < puzzle.snapThreshold) {
			joinPieces(comparePiece, piece);           // Provide the current piece as the second argument so it moves instead of the compared piece
			checkVictory();                            // Check to see if we've beaten the game or not
		}
	}
}


/**
 * Join two groups of pieces together, moving pieceB to align with pieceA as necessary
 * @param pieceA {SVGPath} The piece to align to and merge into
 * @param pieceB {SVGPath} The piece to align and group into pieceA
 */
function joinPieces(pieceA, pieceB) {
	// Move all pieces in the pieceB's group into pieceA's group
	var group = pieceB.parentNode;
	while (group.firstChild) {
		pieceA.parentNode.appendChild(group.firstChild);
	}
	
	// Remove the empty group
	group.parentNode.removeChild(group);
}


/**
 * Returns the screen coordinates for a given puzzle piece's base box (puzzle piece without nubs considered)
 * @param piece {SVGPath} The puzzle piece path element
 * @return object Returns a box object for the piece's base, ignoring nubs, with properties x1, y1, x2, y2, where (x1, y1) is the top-left and (x2, y2) is the bottom right
 */
function getPiecePosition(piece) {
	var rowCol = getPieceRowCol(piece);          // Get the row and column of this piece, so we know where it is pre-transformation
	
	// Determine the top-left coordinate, accounting for any movements from its natural position caused by translations
	var box = {
		x1: (rowCol.column * puzzle.pieceWidth) + piece.parentNode.matrix[4] + puzzle.nubWidth,      // Include the nub width here since the sides are missing nubs, but the base positioning takes them into account
		y1: (rowCol.row * puzzle.pieceHeight) + piece.parentNode.matrix[5] + puzzle.nubHeight
	};
	
	// The bottom-right coordinates are now easy to determine
	box.x2 = box.x1 + puzzle.pieceWidth;
	box.y2 = box.y1 + puzzle.pieceHeight;
	
	// Return the final box object
	return box;
}


/**
 * Returns the midpoint coordinates for a given puzzle piece on a specific side
 * @param box {Object} A coordinate box defining the top-left and bottom-right positions for a puzzle piece, with properties x1, y1, x2, y2, where (x1, y1) is the top-left and (x2, y2) is the bottom-right
 * @param side {Number} The side index in the range 0..3, where 0 is the top, then the other sides proceed clockwise
 * @return object Returns a coordinate object for the midpoint on the specified side with x and y properties
 */
function getMidpoint(box, side) {
	// Since we are just dealing with a grid-aligned box, we have a greatly simplified midpoint calculation
	switch (side) {
		case 0: // Top
			return { x: (box.x1 + box.x2) / 2, y: box.y1 };
		case 1: // Right
			return { x: box.x2, y: (box.y1 + box.y2) / 2 };
		case 2: // Bottom
			return { x: (box.x1 + box.x2) / 2, y: box.y2 };
		case 3: // Left
			return { x: box.x1, y: (box.y1 + box.y2) / 2 };
		default: // Illegal value
			return false;
	}
}


/**
 * Returns the distance between two points, A and B
 * @param A {Object} An object representing a coordinate, with properties x and y
 * @param B {Object} An object representing a coordinate, with properties x and y
 * @return float Returns the distance between the two points A and B
 */
function getDistance(A, B) {
	return Math.sqrt(Math.pow(A.x - B.x, 2) + Math.pow(A.y - B.y, 2));
}


/**
 * Return the row and column of a given puzzle piece
 * @param piece {SVGPath} The path element for a given puzzle piece
 * @return object Returns an object with properties for the piece's row and column values
 */
function getPieceRowCol(piece) {
	var id = piece.getAttributeNS(null, "id");         // Get the piece id, which contains the row and column
	var pattern =/\d+/g;                               // Define the regex expression to extract just the integers found within it
	var position = id.match(pattern);                  // Parse out the integers
	
	// Return the object defining the piece's row and column
	return {
		row: parseInt(position[0], 10),
		column: parseInt(position[1], 10)
	}
}


/**
 * Check the game to see if all pieces have been matched
 */
function checkVictory() {
	// Get all puzzle groups so we can count them, victory is achieved when only one group remains
	var groups = document.getElementsByTagName("g");
	
	// Flag victory if only one group was found
	if (groups.length == 1) {
		alert("Congratulations, you win!");
		
		// Remove the pieces and set the main display background to the full puzzle image to effectively remove the creases between pieces
		groups.item(0).parentNode.removeChild(groups.item(0));
		
		// Create a full puzzle spanning pattern
		createPiecePattern(-1, -1, "ALL", null);
		
		// Set the background holder to the full puzzle image
		document.getElementById("background").setAttributeNS(null, "fill", "url(#ALL)");
	}
}


/**
 * Zoom the view in or out based on the mouse wheel movement
 * @param evt {Object} The event object
 */
function zoomView(evt) {
	if (evt.wheelDelta < 0) {
		setZoom(app.zoomLevel + 0.1);
	} else {
		setZoom(app.zoomLevel - 0.1);
	}
}


/**
 * Set the display zoom level
 * @param level {Number} The zoom scaling factor, where 1 represents no scaling (100% size)
 */
function setZoom(level) {
	// Disallow zooming while dragging a piece
	if (dragPiece) { return; }

	var prevZoom = app.zoomLevel;       // Get the previous zoom level to allow us to keep the view centered

	// Prevent the zoom from going too low or too high
	app.zoomLevel = Math.min(4, Math.max(0.1, level));

	// We also need to adjust the pan to keep the centre in the centre of the window
	app.pan.dx += ((document.body.offsetWidth / 2 * prevZoom) - (document.body.offsetWidth / 2 * app.zoomLevel));
	app.pan.dy += ((document.body.offsetHeight / 2 * prevZoom) - (document.body.offsetHeight / 2 * app.zoomLevel));

	// Update the viewport to reflect the zoom change
	updateViewbox();
}


/**
 * Update the SVG viewbox to account for changes in position (panning) and scaling (zooming)
 */
function updateViewbox() {
	$('#viewport').setAttributeNS(null, "viewBox", Math.round(app.pan.dx) + " " + Math.round(app.pan.dy) + " " + Math.round(document.body.offsetWidth * app.zoomLevel) + " " + Math.round(document.body.offsetHeight * app.zoomLevel));
}


/**
 * Push a piece (and all connected pieces) to the back
 * @param evt {Object} The click event for the piece being pushed back
 */
function dropPiece(evt) {
	// Store a reference to the dragged piece
	var piece = evt.target.parentNode;

	// Move the element to the top
	var firstPiece = $('#viewport>g');
	piece.parentNode.insertBefore(piece, firstPiece);

	// Terminate the drag
	endDrag();
}