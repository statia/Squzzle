var dragPiece = null;                // Puzzle piece currently being dragged
var startX, startY;                  // Position where dragged puzzle piece was grabbed
var puzzle = {                       // Object storing all key values
		difficulty: 1,          // Difficulty level of the puzzle (generally relates to the number of pieces)
		multiplier: 6,          // Unknown
		minWidth: 50,           // Minimum allowed width of a single piece, in pixels
		minHeight: 50           // Minimum allowed height of a single piece, in pixels
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
			//drawPiece(Math.random() * 1000, Math.random() * 1000, puzzle.pieceWidth, puzzle.pieceHeight, row, column);
			drawPiece(0, 0, puzzle.pieceWidth, puzzle.pieceHeight, row, column);
		}
	}
}


/**
 * Render the specified piece
 * @param integer x The horizontal position of the piece in the puzzle grid, where 0 is the left-most position
 * @param integer y The vertical position of the piece in the puzzle grid, where 0 is the top-most position
 * @param float width The width of the piece in pixels (excluding the joining parts)
 * @param float height The height of the piece in pixels (excluding the joining parts)
 */
function drawPiece(x, y, width, height, row, column) {
	// Define the clip path id
	var clipId = "R" + row + "C" + column;
	
	// Create the base puzzle piece's path element
	var puzzleMaskPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	
	// Define the units of measure for the puzzle piece
	var ux = width / 12;
	var uy = height / 12;
	
	// Build the path shape
	var d = "M0,0" + getPieceSides(ux, uy, [-1,-1,-1,-1]) + " z";
	puzzleMaskPath.setAttributeNS(null, "d", d);
	
	// Add the path to the current definitions and create a clip path for it
	var puzzleClipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
	puzzleClipPath.setAttributeNS(null, "id", clipId);
	puzzleClipPath.appendChild(puzzleMaskPath);
	document.getElementById("puzzleDefs").appendChild(puzzleClipPath);
	
	// Create the physical puzzle piece, which will be masked
	var puzzlePiece = document.createElementNS("http://www.w3.org/2000/svg", "image");
	puzzlePiece.setAttributeNS("http://www.w3.org/2000/svg", "xlink:href", "puzzles/puzzle1.jpg");
	puzzlePiece.setAttributeNS("http://www.w3.org/2000/svg", "x", x);
	puzzlePiece.setAttributeNS("http://www.w3.org/2000/svg", "y", y);
	puzzlePiece.setAttributeNS("http://www.w3.org/2000/svg", "width", "766");
	puzzlePiece.setAttributeNS("http://www.w3.org/2000/svg", "height", "1110");
	//puzzlePiece.setAttributeNS(null, "style", "clip-path: url(#" + clipId + ");");
	
	// Set the fill for the piece, which paints it with the puzzle's image
	//puzzlePiece.matrix = [1,0,0,1,x,y];                          // Track each piece's transformation matrix within the object itself for simpler manipulation
	//puzzlePiece.setAttributeNS(null, "transform", "matrix(" + puzzlePiece.matrix.join(',') + ")");
	
	// Add the piece to the layout
	document.getElementById('viewport').appendChild(puzzlePiece);
	
	// Apply event listeners to the puzzle piece
	puzzlePiece.addEventListener('mousedown', startDrag, false);
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
	
	// Pick up the piece, rotating it slightly
	var angle = Math.random() * 0.2 - 0.1;
	dragPiece.matrix[0] = Math.cos(angle);
	dragPiece.matrix[1] = Math.sin(angle);
	dragPiece.matrix[2] = -Math.sin(angle);
	dragPiece.matrix[3] = Math.cos(angle);
	dragPiece.setAttributeNS(null, 'transform', 'matrix(' + dragPiece.matrix.join(',') + ')');
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
