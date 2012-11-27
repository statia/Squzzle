var dragPiece = null;         // Puzzle piece currently being dragged

/**
 * Render the specified piece
 * @param integer x The horizontal position of the piece in the puzzle grid, where 0 is the left-most position
 * @param integer y The vertical position of the piece in the puzzle grid, where 0 is the top-most position
 * @param float width The width of the piece in pixels (excluding the joining parts)
 * @param float height The height of the piece in pixels (excluding the joining parts)
 */
function drawPiece(x, y, width, height) {
	// Create the base puzzle piece's path element
	var puzzlePiece = document.createElementNS("http://www.w3.org/2000/svg", "path");
	
	// Set the fill for the piece, which paints it with the puzzle's image
	puzzlePiece.setAttributeNS(null, "fill", "url(#img1)");
	
	// Define the units of measure for the puzzle piece
	var ux = width / 12;
	var uy = height / 12;
	
	// Define the centre of the puzzle piece
	var cx = x - (6 * ux);
	var cy = y - (6 * uy);

	// Build the path shape
	var d = "M" + cx + "," + cy + getPieceSides(ux, uy, [-1,-1,-1,-1]) + " z";
	puzzlePiece.setAttributeNS(null, "d", d);
	
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
 *       1 means the puzzle piece should come inside the piece on the given side
 *       0 means no nub should be present (flat)
 *       -1 means the puzzle piece should protrude on the given side
 */
function getPieceSides(ux, uy, nubs) {
	var puzzlePath = [['l',4,0], ['c',0,0,1,0,1,1], ['c',0,1,-1,1,-1,2], ['c',0,1,2,1,2,1], ['c',0,0,2,0,2,-1], ['c',0,-1,-1,-1,-1,-2], ['c',0,-1,1,-1,1,-1], ['l',4,0]];   // Define the shape of a single side
	var side = 0;        // Current side, used to iterate within the do...while loop
	var swap;            // Temporary variable for use when swapping values
	var d = "";          // Path string to define and return
	
	// Build all four sides, rotating the reference side 90 degrees each loop
	do {
		for (var i = 0; i < puzzlePath.length; i++) {
			d += " " + puzzlePath[i][0];        // Pull out the movement action character
			
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
		
		side++;   // Advance to the next side
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
	dragPiece.addEventListener('mouseout', endDrag, false);
	
	// Get the starting position to drag from to allow us to monitor movements later (never change this value after being determined)
	if (dragPiece.posX == null) {
		dragPiece.posX = evt.clientX;
		dragPiece.posY = evt.clientY;
	}
	
	// Move the element to the top
	dragPiece.parentNode.appendChild(dragPiece);
}


/**
 * Handle moving a dragged puzzle piece
 */
function moveDrag(evt) {
	// Get the current position and determine the offsets
	var dx = evt.clientX - dragPiece.posX;
	var dy = evt.clientY - dragPiece.posY;
	
	// Move the piece to the new position
	dragPiece.setAttributeNS(null, 'transform', 'translate(' + dx + ',' + dy + ')');
}


/**
 * Handle dropping a puzzle piece
 */
function endDrag(evt) {
	// Remove the drag handlers, since we are no longer moving the piece
	dragPiece.removeEventListener('mousemove', moveDrag, false);
	dragPiece.removeEventListener('mouseup', endDrag, false);
	dragPiece.removeEventListener('mouseout', endDrag, false);
	dragPiece = null;
}