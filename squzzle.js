var dragPiece = null;                // Puzzle piece currently being dragged
var startX, startY;                  // Position where dragged puzzle piece was grabbed
var puzzle = {                       // Object storing all key values
		difficulty: 2,          // Difficulty level of the puzzle (generally relates to the number of pieces)
		multiplier: 6,          // Unknown
		minWidth: 50,           // Minimum allowed width of a single piece, in pixels
		minHeight: 50,          // Minimum allowed height of a single piece, in pixels
		rows: null,             // Total rows in the puzzle
		columns: null,          // Total columns in the puzzle
		width: null,            // Width of the source image, in pixels
		height: null,           // Height of the source image, in pixels
		pieceWidth: null,       // Width of a single piece, in pixels
		pieceHeight: null,      // Height of a single piece, in pixels
		nubWidth: null,         // The amount of extra width given to a piece by an external connector nub, in pixels
		nubHeight: null         // The amount of extra height given to a piece by an external connector nub, in pixels
	};


/**
 * Render the puzzle and perform all setup and initialisations needed
 */
function setupPuzzle() {
	// Determine the size of the puzzle
	puzzle.width = document.getElementById("puzzleImg").width;
	puzzle.height =	document.getElementById("puzzleImg").height;

	// Calculate how many rows and columns of pieces we will have
	puzzle.columns = Math.floor((puzzle.width/puzzle.height) * puzzle.multiplier * puzzle.difficulty);
	puzzle.rows = Math.floor((puzzle.width/puzzle.width) * puzzle.multiplier * puzzle.difficulty);
	
	// Determine the dimensions of a single piece
	puzzle.pieceWidth = Math.floor(puzzle.width / puzzle.columns);
	puzzle.pieceHeight = Math.floor(puzzle.height / puzzle.rows);
	
	// Calculate the amount an exterior nub will contribute to the side it's on
	puzzle.nubWidth = puzzle.pieceWidth / 3;
	puzzle.nubHeight = puzzle.pieceHeight / 3;
	
	// Validate these selected values
	setLimits();

	// Listen to drag events at the root in case we move too fast on a piece	
	document.body.addEventListener('mousemove', moveDrag, false);
	document.body.addEventListener('mouseup', endDrag, false);
	
	// Draw the puzzle pieces
	renderPuzzle();
}


/**
 * Draw all pieces on the board
 */
function renderPuzzle() {
	for (var row = 0; row < puzzle.rows; row++) {
		for (var column = 0; column < puzzle.columns; column++) {
			drawPiece(Math.random() * 1000, Math.random() * 300, puzzle.pieceWidth, puzzle.pieceHeight, row, column);
		}
	}
}


/**
 * Render the specified piece
 * @param integer x The horizontal position of the piece in the puzzle grid, where 0 is the left-most position
 * @param integer y The vertical position of the piece in the puzzle grid, where 0 is the top-most position
 * @param float width The width of the piece in pixels (excluding the joining parts)
 * @param float height The height of the piece in pixels (excluding the joining parts)
 * @param integer row The row the piece is found in, where the first row is 0 (top)
 * @param integer column The column the piece is found in, where the first column is 0 (left)
 */
function drawPiece(x, y, width, height, row, column) {
	// Define the units of measure for the puzzle piece
	var ux = width / 12;
	var uy = height / 12;
	
	// Create the base puzzle piece's path element
	var puzzlePiece = document.createElementNS("http://www.w3.org/2000/svg", "path");
	
	// Build the path shape
	var nubs = getNubs(row, column);                            // Determine the outline shape of this piece
	var d = "M" + puzzle.nubWidth + "," + puzzle.nubHeight + getPieceSides(ux, uy, nubs) + " z";        // Build the shape definition parameter
	puzzlePiece.setAttributeNS(null, "d", d);                   // Apply the definition to the actual shape element
	puzzlePiece.matrix = [1, 0, 0, 1, x, y];                    // Track each piece's transformation matrix within the object itself for simpler manipulation
	puzzlePiece.setAttributeNS(null, "transform", "matrix(" + puzzlePiece.matrix.join(',') + ")");     // Apply a default transformation so we can later parse it
	
	// Set the fill for the piece, which paints it with the puzzle's image
	var patternId = "XR" + row + "C" + column;                  // Curiously, we can't use the form R#C#, or the pattern fails to display
	createPiecePattern(row, column, patternId, nubs);
	puzzlePiece.setAttributeNS(null, "fill", "url(#" + patternId + ")");
	
	// Add the piece to the layout
	document.getElementById('viewport').appendChild(puzzlePiece);
	
	// Apply event listeners to the puzzle piece
	puzzlePiece.addEventListener('mousedown', startDrag, false);
}


/**
 * Returns a nub array specifing the shape type of each side of a puzzle piece
 * @param integer row The row the piece is found in, where the first row is 0 (top)
 * @param integer column The column the piece is found in, where the first column is 0 (left)
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
 * @param integer row The row the piece is found in, where the first row is 0 (top)
 * @param integer column The column the piece is found in, where the first column is 0 (left)
 * @param string id The id to give to the pattern, for use when linking shapes to it
 * @param array nubs An array four values of -1, 0, or 1 values, ordered by side going clockwise from the top, where:
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
	
	// Determine the actual width and height of the piece
	var actualPieceWidth = puzzle.pieceWidth;         // Base width of the pattern without nubs
	var actualPieceHeight = puzzle.pieceHeight;       // Base height of the pattern without nubs
	var offsetX = 0;                                  // Amount to shift pattern by horizontally
	var offsetY = 0;                                  // Amount to shift pattern by vertically
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
	image.setAttributeNS("http://www.w3.org/1999/xlink", "href", "puzzles/puzzle1.jpg");
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
 * @param float ux The size of one horizontal unit in pixels
 * @param float uy The size of one vertical unit in pixels
 * @param array nubs An array four values of -1, 0, or 1 values, ordered by side going clockwise from the top, where:
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
 * Handle grabbing a puzzle piece
 */
function startDrag(evt) {
	// Drop any other pieces being dragged before starting another one
	if (dragPiece) { endDrag(); }

	// Store a reference to the dragged piece
	dragPiece = evt.target;
	
	// Apply the drag handlers to handle moving it around the screen
	dragPiece.addEventListener('mousemove', moveDrag, false);
	dragPiece.addEventListener('mouseup', endDrag, false);
	//dragPiece.addEventListener('mouseout', endDrag, false);
	
	// Get the starting position to drag from to allow us to monitor movements later
	startX = evt.clientX - dragPiece.matrix[4];
	startY = evt.clientY - dragPiece.matrix[5];
	
	// Move the element to the top
	dragPiece.parentNode.appendChild(dragPiece);
	
	// Pick up the piece, casting a shadow
	var angle = Math.random() * 0.2 - 0.1;
	dragPiece.setAttributeNS(null, 'transform', 'matrix(' + dragPiece.matrix.join(',') + ')');
	dragPiece.setAttributeNS(null, "class", "dragging");           // Apply a class which grants the floating shadow
}


/**
 * Handle moving a dragged puzzle piece
 */
function moveDrag(evt) {
	if (dragPiece) {
		// Get the current position and determine the offsets
		var dx = evt.clientX - startX;
		var dy = evt.clientY - startY;
		
		// Move the piece to the new position
		dragPiece.matrix[4] = dx;
		dragPiece.matrix[5] = dy;
		dragPiece.setAttributeNS(null, 'transform', 'matrix(' + dragPiece.matrix.join(',') + ')');
	}
}


/**
 * Handle dropping a puzzle piece
 */
function endDrag(evt) {
	if (dragPiece) {
		// Drop the piece, straightening it again
		dragPiece.matrix[0] = 1;
		dragPiece.matrix[1] = 0;
		dragPiece.matrix[2] = 0;
		dragPiece.matrix[3] = 1;
		dragPiece.setAttributeNS(null, 'transform', 'matrix(' + dragPiece.matrix.join(',') + ')');
		
		// Remove the drag handlers, since we are no longer moving the piece
		dragPiece.removeEventListener('mousemove', moveDrag, false);
		dragPiece.removeEventListener('mouseup', endDrag, false);
		dragPiece.removeEventListener('mouseout', endDrag, false);
		dragPiece.setAttributeNS(null, "class", "");         // Clear the class, to remove the shadow
		dragPiece = null;
	}
}


/**
 * Ensure the selected values for the puzzle have not gone beyond acceptable limits and adjust them if so
 */
function setLimits() {
	// Determine the limiting settings for puzzle dimensions
	// It is assumed that the main puzzle has already been loaded and primary dimensions are known
	maxAcross = Math.min(puzzle.columns, Math.floor(puzzle.width / puzzle.minWidth));
	maxDown = Math.min(puzzle.rows, Math.floor(puzzle.height / puzzle.minHeight));

	// Check to make sure current settings are within bounds
	if (puzzle.columns > maxAcross) {
		puzzle.columns = maxAcross;
	}

	if (puzzle.rows > maxDown) {
		puzzle.rows = maxDown;
	}
}
