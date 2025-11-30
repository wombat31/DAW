// --- Configuration: Generates a 256-color palette (8-bit) including transparent (index 0) ---
function generate256Palette() {
    const p = [];

    // Add transparent color first (Index 0)
    p.push('#ffffff00');

    // 216 Color Cube (6x6x6)
    const values = [0, 51, 102, 153, 204, 255]; // 00, 33, 66, 99, CC, FF
    for (const r of values) {
        for (const g of values) {
            for (const b of values) {
                const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
                p.push(hex);
            }
        }
    }

    // Add Grayscale shades to fill up to 256
    const neededGrays = 256 - p.length;
    const grayStep = Math.floor(255 / (neededGrays + 1));

    for (let i = 1; i <= neededGrays; i++) {
        const val = Math.round(i * grayStep);
        const gray = val.toString(16).padStart(2, '0');
        p.push(`#${gray}${gray}${gray}`.toUpperCase());
    }

    return p;
}
const PALETTE = generate256Palette();

// --- Global State ---
let canvas;
let ctx;
let gridSize = 32; // Default size
let pixelData = [];
let selectedColorIndex = 1; // Default to Black
let currentTool = 'pencil'; // 'pencil', 'eraser', 'brush', 'bucket', 'rectangle', 'circle_tool'
let currentShape = 'square'; // 'square', 'circle', 'heart', 'octagon'
let isDrawing = false;
const CANVAS_MAX_SIZE = 500; // Max display size of the canvas in pixels

// --- Global State for Shape Tools ---
let startGridX = null;
let startGridY = null;
let lastGridX = 0;
let lastGridY = 0;
let drawingPreview = null; // Used to hold the pixelData backup when drawing a shape

// --- DOM Elements ---
const sizeButtons = document.querySelectorAll('.size-btn');
const customSizeBtn = document.getElementById('custom-size-btn');
const customInputDiv = document.getElementById('custom-input');
const setCustomSizeBtn = document.getElementById('set-custom-size-btn');
const customSizeInput = document.getElementById('custom-size');
const colorPalette = document.getElementById('color-palette');
const toolButtons = document.querySelectorAll('.tool-btn');
const shapeButtons = document.querySelectorAll('.shape-btn');
const exportPngBtn = document.getElementById('export-png-btn');
const saveProjectBtn = document.getElementById('save-project-btn');
const loadProjectInput = document.getElementById('load-project-input');
const messageBox = document.getElementById('message-box');

// --- Utility Functions ---

/** Shows a temporary message to the user. */
function showMessage(msg, isError = false) {
    messageBox.textContent = msg;
    messageBox.className = `mt-4 text-center font-medium ${isError ? 'text-red-600' : 'text-green-600'}`;
    setTimeout(() => {
        messageBox.textContent = '';
        messageBox.className = 'mt-4 text-center font-medium';
    }, 3000);
}

/** Converts a color index to its hex/rgba value. */
function getColor(index) {
    return PALETTE[index] || PALETTE[0]; // Fallback to transparent
}

/** Gets the coordinates of a touch/mouse event relative to the canvas. */
function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (event.touches) {
        // Handle touch events (use the first touch)
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        // Handle mouse events
        clientX = event.clientX;
        clientY = event.clientY;
    }

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

/** Checks if a pixel coordinate (gridX, gridY) is inside the current shape mask. */
function isPixelInShape(gridX, gridY) {
    if (currentShape === 'square') {
        return true; // Full canvas is the mask
    }

    // Convert grid coordinates (0 to gridSize-1) to normalized coordinates (-1.0 to 1.0)
    // Center point (normalized) is (0, 0)
    const xNorm = (gridX / (gridSize - 1)) * 2 - 1;
    const yNorm = (gridY / (gridSize - 1)) * 2 - 1;

    if (currentShape === 'circle') {
        // Simple circle equation: x^2 + y^2 <= R^2 (R=1.0)
        return (xNorm * xNorm + yNorm * yNorm) <= 1.0;
    }

    if (currentShape === 'heart') {
        // Better heart shape using adjusted coordinates
        const x = xNorm * 1.3;
        const y = -yNorm * 1.3 + 0.3; // Flip Y and shift up

        // Heart equation
        const left = (x * x + y * y - 1);
        const heartFunction = left * left * left - x * x * y * y * y;

        return heartFunction <= 0;
    }

    if (currentShape === 'octagon') {
        // Octagon shape logic (Square with cut corners)
        const L = 0.35; // Normalized size of the corner cut (from center, 0 to 1)

        // Check if outside the 4 corner squares
        if (xNorm > 1 - L && yNorm > 1 - L) return false;
        if (xNorm < -1 + L && yNorm > 1 - L) return false;
        if (xNorm > 1 - L && yNorm < -1 + L) return false;
        if (xNorm < -1 + L && yNorm < -1 + L) return false;

        return true;
    }


    return true; // Default to square if shape is unknown
}


// --- Core Drawing Logic ---

/** Initializes the pixel data array with transparent color. */
function initializePixelData() {
    pixelData = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
        pixelData.push(0); // 0 is the index for transparent
    }
}

/** Renders the grid based on the provided pixel data, applying the shape mask. */
function renderGridData(data) {
    // Clear the canvas visually
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pixelSize = canvas.width / gridSize;

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const index = y * gridSize + x;
            const colorIndex = data[index];
            const pixelInShape = isPixelInShape(x, y);
            const isTransparent = colorIndex === 0;

            // 1. Draw user pixel color if it's inside the mask and not transparent
            if (pixelInShape && !isTransparent) {
                ctx.fillStyle = getColor(colorIndex);
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }

            // 2. Draw Checkerboard/Mask Overlay
            if (pixelInShape && isTransparent) {
                // Draw a subtle checkerboard pattern for transparency inside the shape
                if ((x + y) % 2 === 0) {
                        ctx.fillStyle = 'rgba(0,0,0,0.05)';
                        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            } else if (!pixelInShape) {
                // Draw the dark mask overlay outside the shape
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Dark semi-transparent overlay
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
    }
}

/** Redefines the standard drawGrid to use the main pixelData state. */
function drawGrid() {
    renderGridData(pixelData);
}

/** Sets a single pixel color and draws it immediately for optimization. */
function setPixel(gridX, gridY, colorIndex) {
    if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return;

    const index = gridY * gridSize + gridX;

    // Check if the pixel is inside the shape. If not, only allow erasing (setting to 0).
    if (!isPixelInShape(gridX, gridY) && colorIndex !== 0) {
            return; // Prevent drawing color outside the shape
    }

    if (pixelData[index] === colorIndex) return;

    pixelData[index] = colorIndex;

    const pixelSize = canvas.width / gridSize;

    // Optimization: Redraw only the single pixel
    ctx.clearRect(gridX * pixelSize, gridY * pixelSize, pixelSize, pixelSize);

    const pixelInShape = isPixelInShape(gridX, gridY);

    if (colorIndex !== 0 && pixelInShape) {
        ctx.fillStyle = getColor(colorIndex);
        ctx.fillRect(gridX * pixelSize, gridY * pixelSize, pixelSize, pixelSize);
    } else {
        // Redraw the background/mask
        if (pixelInShape && (gridX + gridY) % 2 === 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.05)';
                ctx.fillRect(gridX * pixelSize, gridY * pixelSize, pixelSize, pixelSize);
        } else if (!pixelInShape) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(gridX * pixelSize, gridY * pixelSize, pixelSize, pixelSize);
        }
    }
}

/** Draws a 2x2 square area using the brush tool. */
function drawBrush(gridX, gridY) {
    const size = 2; // Fixed 2x2 brush size
    const colorToUse = currentTool === 'eraser' ? 0 : selectedColorIndex;

    let startX = gridX - (size - 1);
    let startY = gridY - (size - 1);

    for (let y = startY; y <= startY + 1; y++) {
        for (let x = startX; x <= startX + 1; x++) {
            setPixel(x, y, colorToUse); // setPixel handles the shape mask check
        }
    }
}

/** Implements the queue-based flood fill algorithm. */
function floodFill(startX, startY) {
    if (!isPixelInShape(startX, startY)) {
        return;
    }

    const targetIndex = startY * gridSize + startX;
    if (targetIndex < 0 || targetIndex >= pixelData.length) return;

    const targetColorIndex = pixelData[targetIndex];
    const newColorIndex = selectedColorIndex;

    if (targetColorIndex === newColorIndex) return;

    const queue = [{ x: startX, y: startY }];
    let pixelsChanged = 0;

    while (queue.length > 0) {
        const { x, y } = queue.shift();
        const index = y * gridSize + x;

        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize ||
            pixelData[index] !== targetColorIndex ||
            !isPixelInShape(x, y)) {
            continue;
        }

        pixelData[index] = newColorIndex;
        pixelsChanged++;

        // Add neighbors to the queue
        queue.push({ x: x + 1, y: y });
        queue.push({ x: x - 1, y: y });
        queue.push({ x: x, y: y + 1 });
        queue.push({ x: x, y: y - 1 });
    }

    if (pixelsChanged > 0) {
        drawGrid(); // Redraw the whole grid after flood fill
    }
}

/** Applies the selected non-shape tool (Pencil, Eraser, Brush) based on grid coordinates. */
function applyLineTool(gridX, gridY) {
    const colorToUse = currentTool === 'eraser' ? 0 : selectedColorIndex;

    switch (currentTool) {
        case 'pencil':
        case 'eraser':
            setPixel(gridX, gridY, colorToUse);
            break;
        case 'brush':
            drawBrush(gridX, gridY);
            break;
    }
}

/** Draws a preview of the shape (Rectangle or Circle) on the canvas. */
function drawShapePreview(endGridX, endGridY) {
    if (startGridX === null || startGridY === null || !drawingPreview) return;

    let currentData = [...drawingPreview]; // Start with the saved base state
    const colorToUse = selectedColorIndex;

    const x0 = Math.min(startGridX, endGridX);
    const x1 = Math.max(startGridX, endGridX);
    const y0 = Math.min(startGridY, endGridY);
    const y1 = Math.max(startGridY, endGridY);

    if (currentTool === 'rectangle') {
        // Draw filled rectangle
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                // Check bounds and shape mask
                if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && isPixelInShape(x, y)) {
                    const index = y * gridSize + x;
                    currentData[index] = colorToUse;
                }
            }
        }
    } else if (currentTool === 'circle_tool') {
        const centerX = (x0 + x1) / 2;
        const centerY = (y0 + y1) / 2;
        // Radius is half the largest bounding box dimension
        const radius = Math.max(x1 - x0, y1 - y0) / 2;
        const radiusSq = radius * radius;

        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const distSq = (x - centerX) ** 2 + (y - centerY) ** 2;

                // Check if inside circle, bounds, and shape mask
                if (distSq <= radiusSq && x >= 0 && x < gridSize && y >= 0 && y < gridSize && isPixelInShape(x, y)) {
                    const index = y * gridSize + x;
                    currentData[index] = colorToUse;
                }
            }
        }
    }

    // Render the temporary data to show the preview
    renderGridData(currentData);
}

/** Handles drawing a single pixel or shape based on canvas coordinates. */
function handleDrawing(canvasX, canvasY) {
    const pixelSize = canvas.width / gridSize;
    const gridX = Math.floor(canvasX / pixelSize);
    const gridY = Math.floor(canvasY / pixelSize);

    lastGridX = gridX;
    lastGridY = gridY;

    if (currentTool === 'rectangle' || currentTool === 'circle_tool') {
        drawShapePreview(gridX, gridY);
    } else {
        applyLineTool(gridX, gridY);
    }
}

/** Starts the drawing process. */
function startDrawing(event) {
    isDrawing = true;
    event.preventDefault(); // Prevent default touch behavior (like scrolling)
    const coords = getCanvasCoords(event);
    const pixelSize = canvas.width / gridSize;
    const gridX = Math.floor(coords.x / pixelSize);
    const gridY = Math.floor(coords.y / pixelSize);

    lastGridX = gridX;
    lastGridY = gridY;

    if (currentTool === 'bucket') {
        floodFill(gridX, gridY);
        stopDrawing(event); // Stop drawing immediately after bucket fill
        return;
    }

    // Handle new shape tools: initialize state
    if (currentTool === 'rectangle' || currentTool === 'circle_tool') {
        startGridX = gridX;
        startGridY = gridY;
        drawingPreview = [...pixelData]; // Store the base state before drawing started
        return;
    }

    // Pencil, Eraser, Brush
    handleDrawing(coords.x, coords.y);
}

/** Continues the drawing process (for pencil, eraser, brush, and shape preview). */
function continueDrawing(event) {
    if (!isDrawing || currentTool === 'bucket') return;
    event.preventDefault();
    const coords = getCanvasCoords(event);
    handleDrawing(coords.x, coords.y);
}

/** Stops the drawing process and commits shape changes. */
function stopDrawing(event) {
    if (!isDrawing) return;

    // For shape tools, commit the final preview to the main pixel data
    if (currentTool === 'rectangle' || currentTool === 'circle_tool') {
        if (drawingPreview) {
            // Commit the shape based on startGrid and the last known position (lastGridX/Y)
            const colorToUse = selectedColorIndex;

            const x0 = Math.min(startGridX, lastGridX);
            const x1 = Math.max(startGridX, lastGridX);
            const y0 = Math.min(startGridY, lastGridY);
            const y1 = Math.max(startGridY, lastGridY);

            // Restore the state *before* the shape was drawn
            pixelData = drawingPreview;

            // Now draw the shape onto pixelData
            if (currentTool === 'rectangle') {
                for (let y = y0; y <= y1; y++) {
                    for (let x = x0; x <= x1; x++) {
                        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && isPixelInShape(x, y)) {
                            const index = y * gridSize + x;
                            pixelData[index] = colorToUse;
                        }
                    }
                }
            } else if (currentTool === 'circle_tool') {
                const centerX = (x0 + x1) / 2;
                const centerY = (y0 + y1) / 2;
                const radius = Math.max(x1 - x0, y1 - y0) / 2;
                const radiusSq = radius * radius;

                for (let y = y0; y <= y1; y++) {
                    for (let x = x0; x <= x1; x++) {
                        const distSq = (x - centerX) ** 2 + (y - centerY) ** 2;

                        if (distSq <= radiusSq && x >= 0 && x < gridSize && y >= 0 && y < gridSize && isPixelInShape(x, y)) {
                            const index = y * gridSize + x;
                            pixelData[index] = colorToUse;
                        }
                    }
                }
            }

            drawingPreview = null; // Clear temp state
        }
    }

    isDrawing = false;
    startGridX = null;
    startGridY = null;
    drawGrid(); // Final redraw after committing the shape or stopping line tools
}

// --- Initialization and Setup ---

/** Updates the canvas data-tool attribute and cursor. */
function updateCanvasCursor() {
    canvas.setAttribute('data-tool', currentTool);
}

/** Sets up the canvas size and state for a new project. */
function setupCanvas(newSize, newPixelData = null) {
    gridSize = newSize;

    // Set the visual canvas size (always fixed max size)
    canvas.width = CANVAS_MAX_SIZE;
    canvas.height = CANVAS_MAX_SIZE;

    // Set the canvas style to maintain aspect ratio and be responsive
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.maxWidth = `${CANVAS_MAX_SIZE}px`;
    canvas.style.maxHeight = `${CANVAS_MAX_SIZE}px`;

    if (newPixelData && newPixelData.length === gridSize * gridSize) {
        pixelData = newPixelData;
        showMessage(`Loaded ${gridSize}x${gridSize} project.`);
    } else {
        initializePixelData();
        showMessage(`Started new ${gridSize}x${gridSize} project.`);
    }
    drawGrid(); // Redraw with new size and shape/mask
}

/** Renders the color swatches in the palette panel. */
function renderPalette() {
    colorPalette.innerHTML = '';
    PALETTE.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch rounded-sm shadow-inner';
        swatch.style.backgroundColor = color === '#ffffff00' ? 'transparent' : color;

        // Use a checkerboard pattern for the transparent color
        if (index === 0) {
            swatch.style.background = 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 50% 50%';
            swatch.style.border = '1px solid #ef4444'; // Red border for transparent
        }

        swatch.dataset.index = index;

        // Set initial active state (Black is index 1 by default)
        if (index === selectedColorIndex) {
            swatch.classList.add('active');
        }

        swatch.addEventListener('click', () => {
            // Remove active class from all swatches
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            // Set new active class
            swatch.classList.add('active');
            selectedColorIndex = index;

            // Optional: auto-switch tools when selecting transparent/color
            if (currentTool === 'eraser' && index !== 0) {
                selectTool('pencil');
            }
        });
        colorPalette.appendChild(swatch);
    });
}

/** Handles tool selection UI and state. */
function selectTool(toolName) {
    currentTool = toolName;

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active-tool'));
    const selectedBtn = document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active-tool');
    }

    // Update cursor
    updateCanvasCursor();

    // Ensure color state aligns with tool (Eraser uses transparent)
    if (toolName === 'eraser') {
        selectedColorIndex = 0;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        document.querySelector(`.color-swatch[data-index="0"]`)?.classList.add('active');
    }
}

/** Handles shape selection UI and state. */
function selectShape(shapeName) {
    currentShape = shapeName;

    // Update UI
    document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active-shape'));
    const selectedBtn = document.querySelector(`.shape-btn[data-shape="${shapeName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active-shape');
    }

    // Redraw the grid to apply the new mask instantly
    drawGrid();
    showMessage(`Canvas shape changed to ${shapeName}.`);
}


/** Main initialization function. */
function init() {
    canvas = document.getElementById('editorCanvas');
    ctx = canvas.getContext('2d');

    // Initial canvas setup
    setupCanvas(32);
    renderPalette();
    selectTool('pencil');
    selectShape('square');

    // --- Event Listeners ---

    // Size buttons
    sizeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = parseInt(btn.dataset.size);
            setupCanvas(size);
            customInputDiv.classList.add('hidden');
        });
    });

    // Custom size logic
    customSizeBtn.addEventListener('click', () => customInputDiv.classList.toggle('hidden'));
    setCustomSizeBtn.addEventListener('click', () => {
        const size = parseInt(customSizeInput.value);
        if (size >= 8 && size <= 256) {
            setupCanvas(size);
            customInputDiv.classList.add('hidden');
        } else {
            showMessage("Size must be between 8 and 256.", true);
        }
    });

    // Tool buttons
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => selectTool(btn.dataset.tool));
    });

    // Shape buttons
    shapeButtons.forEach(btn => {
        btn.addEventListener('click', () => selectShape(btn.dataset.shape));
    });

    // Drawing Listeners (Mouse and Touch)
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', continueDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', continueDrawing);
    canvas.addEventListener('touchend', stopDrawing);

    // Export and Save Listeners
    exportPngBtn.addEventListener('click', exportAsPNG);
    saveProjectBtn.addEventListener('click', saveProject);
    loadProjectInput.addEventListener('change', loadProject);

}

// --- File Handling Logic ---

/** Exports the current canvas as a PNG file. */
function exportAsPNG() {
    try {
        // Prompt user for a filename
        const defaultName = `sprite_${currentShape}_${gridSize}x${gridSize}`;
        const userFileName = prompt("Enter a name for your sprite:", defaultName);

        // If user cancels, don't export
        if (userFileName === null) {
            return;
        }

        // Use default if user enters empty string
        const fileName = userFileName.trim() || defaultName;

        // Temporarily scale the canvas content up for a higher-resolution PNG export
        const exportCanvas = document.createElement('canvas');
        const exportScale = 8; // Export at 8x resolution (e.g., 32x32 -> 256x256)

        exportCanvas.width = gridSize * exportScale;
        exportCanvas.height = gridSize * exportScale;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.imageSmoothingEnabled = false; // Crucial for pixel art

        // Draw all pixels onto the temporary high-res canvas, respecting the mask
        const pixelSize = exportScale; // The size of one pixel on the export canvas
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const index = y * gridSize + x;
                const colorIndex = pixelData[index];

                // Only draw if the pixel is inside the shape and not transparent
                if (isPixelInShape(x, y) && colorIndex !== 0) {
                    exportCtx.fillStyle = getColor(colorIndex);
                    exportCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                } else {
                    // Ensure transparent pixels are truly transparent in the output PNG
                    exportCtx.clearRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }

        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage("Sprite exported successfully as PNG!");
    } catch (error) {
        showMessage("Error exporting PNG. Try again!", true);
        console.error("PNG Export Error:", error);
    }
}

/** Saves the current pixel data and size as a downloadable JSON project file. */
function saveProject() {
    try {
        // Prompt user for a filename
        const defaultName = `sprite_project_${gridSize}x${gridSize}`;
        const userFileName = prompt("Enter a name for your project:", defaultName);

        // If user cancels, don't save
        if (userFileName === null) {
            return;
        }

        // Use default if user enters empty string
        const fileName = userFileName.trim() || defaultName;

        const project = {
            version: 4,
            gridSize: gridSize,
            pixelData: pixelData,
            currentShape: currentShape
        };

        const dataStr = JSON.stringify(project);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${fileName}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showMessage("Project saved successfully as JSON!");
    } catch (error) {
        showMessage("Error saving project. Try again!", true);
        console.error("Save Project Error:", error);
    }
}

/** Loads a project from a user-selected JSON file. */
function loadProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const project = JSON.parse(e.target.result);

            if (project && project.gridSize && Array.isArray(project.pixelData)) {
                const newSize = project.gridSize;
                const newData = project.pixelData;

                // Basic validation
                if (newSize * newSize === newData.length && newSize >= 8 && newSize <= 256) {
                    setupCanvas(newSize, newData);
                    // Set the shape if it exists in the file, otherwise default to square
                    selectShape(project.currentShape || 'square');

                    // Clear file input to allow loading the same file again if needed
                    event.target.value = '';
                } else {
                    throw new Error("Invalid project data size or dimensions.");
                }
            } else {
                throw new Error("Project file is corrupt or missing data.");
            }
        } catch (error) {
            showMessage(`Error loading project: ${error.message}`, true);
            console.error("Load Project Error:", error);
        }
    };
    reader.readAsText(file);
}

// Initialize the app when the window loads
window.onload = init;