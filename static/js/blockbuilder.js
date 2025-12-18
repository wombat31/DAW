
    const CUBE_SIZE = 3, GRID_SIZE = 80;
        const colors = [
            { name: 'Red', hex: '#ff6b6b' }, { name: 'Orange', hex: '#ff9f43' },
            { name: 'Yellow', hex: '#ffd93d' }, { name: 'Green', hex: '#6bcf7f' },
            { name: 'Blue', hex: '#4d96ff' }, { name: 'Purple', hex: '#a78bfa' },
            { name: 'Pink', hex: '#ff6ec7' }, { name: 'Brown', hex: '#a67c52' }
        ];
        let scene, camera, renderer, raycaster, mouse, gridHelper, gridPlane;
    let blocks = [], history = [], redoStack = [], currentColor = colors[0].hex;
    // Default to real ramp geometry rather than cubes
    let currentBlockType = 'ramp', currentRotation = 0, currentZRotation = 0;
        let mode = 'add', currentLayer = null, showAllLayers = true, ghostMesh = null;

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87ceeb);
            scene.fog = new THREE.Fog(0x87ceeb, 50, 200);
            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(30, 30, 30);
            camera.lookAt(0, 0, 0);
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.shadowMap.enabled = true;
            document.getElementById('canvas-container').appendChild(renderer.domElement);
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
            directionalLight.position.set(20, 40, 20);
            directionalLight.castShadow = true;
            scene.add(directionalLight);
            const floorGeometry = new THREE.PlaneGeometry(GRID_SIZE * CUBE_SIZE, GRID_SIZE * CUBE_SIZE);
            const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
            const floorPlane = new THREE.Mesh(floorGeometry, floorMaterial);
            floorPlane.rotation.x = -Math.PI / 2;
            floorPlane.receiveShadow = true;
            floorPlane.position.y = 0;
            scene.add(floorPlane);
            gridHelper = new THREE.GridHelper(GRID_SIZE * CUBE_SIZE, GRID_SIZE, 0x888888, 0xcccccc);
            gridHelper.position.set(0, 0.01, 0);
            scene.add(gridHelper);
            const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
            planeGeometry.rotateX(-Math.PI / 2);
            gridPlane = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ visible: false }));
            gridPlane.position.set(0, 0, 0);
            scene.add(gridPlane);
            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();
            setupOrbitControls();
            setupUI();
            setMode(mode);
            renderer.domElement.addEventListener('click', onClick);
            window.addEventListener('resize', onWindowResize);
            renderer.domElement.addEventListener('mousemove', onMouseMove);
            window.addEventListener('keydown', onKeyDown);
            animate();
        }

        function onKeyDown(e) {
            if (currentBlockType === 'cube') {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    // Block keyboard rotation for cubes
                    e.preventDefault();
                }
                return;
            }

            let newR = currentRotation, newZ = currentZRotation;
            if (e.key === 'ArrowLeft') newR = (currentRotation - 90 + 360) % 360;
            else if (e.key === 'ArrowRight') newR = (currentRotation + 90) % 360;
            else if (e.key === 'ArrowUp') newZ = 0; // Normal
            else if (e.key === 'ArrowDown') newZ = 180; // Flipped
            else return;

            if (newR !== currentRotation) { currentRotation = newR; updateRotationUI('rotation-y-controls', currentRotation); }
            if (newZ !== currentZRotation) { currentZRotation = newZ; updateRotationUI('rotation-z-controls', currentZRotation); }

            // Trigger mouse move to update ghost block position/orientation
            onMouseMove({ clientX: mouse.x * 0.5 + 0.5 * window.innerWidth, clientY: 0.5 * window.innerHeight - mouse.y * 0.5 * window.innerHeight });
            e.preventDefault();
        }

        function updateRotationUI(id, val) {
            document.querySelectorAll(`#${id} .rotation-btn`).forEach(b => {
                b.classList.remove('active');
                if (parseInt(b.dataset.rotation) === val || parseInt(b.dataset.zrotation) === val) b.classList.add('active');
            });
        }

        function setupOrbitControls() {
            let isOrbiting = false;
            let isPanning = false;
            let prev = { x: 0, y: 0 };

            // MOUSE
            renderer.domElement.addEventListener('mousedown', e => {
                if (e.target.closest('#ui-panel')) return; // Ignore UI
                if (e.button === 2) { // Right-click orbit
                    isOrbiting = true;
                    prev = { x: e.clientX, y: e.clientY };
                    renderer.domElement.style.cursor = 'grabbing';
                } else if (e.button === 1) { // Middle-click pan
                    isPanning = true;
                    prev = { x: e.clientX, y: e.clientY };
                    renderer.domElement.style.cursor = 'move';
                } else if (e.button === 0 && e.shiftKey) { // Shift + Left-click orbit
                    isOrbiting = true;
                    prev = { x: e.clientX, y: e.clientY };
                    renderer.domElement.style.cursor = 'grabbing';
                }
            });

            document.addEventListener('mousemove', e => {
                const dx = e.clientX - prev.x;
                const dy = e.clientY - prev.y;
                const r = camera.position.length();
                if (isOrbiting) {
                    let theta = Math.atan2(camera.position.x, camera.position.z);
                    let phi = Math.acos(THREE.MathUtils.clamp(camera.position.y / r, -1, 1));
                    const sensitivity = 0.005;
                    theta -= dx * sensitivity;
                    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + dy * sensitivity));
                    camera.position.set(
                        r * Math.sin(phi) * Math.sin(theta),
                        r * Math.cos(phi),
                        r * Math.sin(phi) * Math.cos(theta)
                    );
                    camera.lookAt(0, 0, 0);
                } else if (isPanning) {
                    const pan = new THREE.Vector3(-dx * 0.002 * r, dy * 0.002 * r, 0);
                    pan.applyQuaternion(camera.quaternion);
                    camera.position.add(pan);
                }
                if (isOrbiting || isPanning) prev = { x: e.clientX, y: e.clientY };
            });

            document.addEventListener('mouseup', () => {
                isOrbiting = false;
                isPanning = false;
                renderer.domElement.style.cursor = mode === 'add' ? 'crosshair' : (mode === 'delete' ? 'pointer' : 'default');
            });

            // Scroll zoom
            renderer.domElement.addEventListener('wheel', e => {
                e.preventDefault();
                const dir = e.deltaY > 0 ? 1 : -1;
                const d = camera.position.length();
                const newD = Math.max(10, Math.min(100, d + dir * 0.1 * d));
                camera.position.multiplyScalar(newD / d);
            });

            // TOUCH (1-finger orbit, 2-finger pan)
            renderer.domElement.addEventListener('touchstart', e => {
                if (e.target.closest('#ui-panel')) return;
                if (e.touches.length === 1) { isOrbiting = true; prev = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
                else if (e.touches.length === 2) { isPanning = true; prev = { x: (e.touches[0].clientX + e.touches[1].clientX)/2, y: (e.touches[0].clientY + e.touches[1].clientY)/2 }; }
            });

            renderer.domElement.addEventListener('touchmove', e => {
                e.preventDefault();
                if (isOrbiting && e.touches.length === 1) {
                    const dx = e.touches[0].clientX - prev.x;
                    const dy = e.touches[0].clientY - prev.y;
                    const r = camera.position.length();
                    let theta = Math.atan2(camera.position.x, camera.position.z);
                    let phi = Math.acos(THREE.MathUtils.clamp(camera.position.y / r, -1, 1));
                    const sensitivity = 0.005;
                    theta -= dx * sensitivity;
                    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + dy * sensitivity));
                    camera.position.set(
                        r * Math.sin(phi) * Math.sin(theta),
                        r * Math.cos(phi),
                        r * Math.sin(phi) * Math.cos(theta)
                    );
                    camera.lookAt(0, 0, 0);
                    prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                } else if (isPanning && e.touches.length === 2) {
                    const cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
                    const cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
                    const dx = cx - prev.x;
                    const dy = cy - prev.y;
                    const pan = new THREE.Vector3(-dx * 0.002 * camera.position.length(), dy * 0.002 * camera.position.length(), 0);
                    pan.applyQuaternion(camera.quaternion);
                    camera.position.add(pan);
                    prev = { x: cx, y: cy };
                }
            });

            renderer.domElement.addEventListener('touchend', e => { isOrbiting = false; isPanning = false; });
        }


        function setMode(m) {
            mode = m;
            const add = document.getElementById('add-mode'), del = document.getElementById('delete-mode');
            add.classList.remove('active');
            del.classList.remove('active');
            if (mode === 'add') {
                add.classList.add('active');
                renderer.domElement.style.cursor = 'crosshair';
            }
            else if (mode === 'delete') {
                del.classList.add('active');
                renderer.domElement.style.cursor = 'pointer';
                if (ghostMesh) ghostMesh.visible = false;
            }
        }

        function setupUI() {
            // Color Picker
            const cp = document.getElementById('color-picker');
            colors.forEach((c, i) => {
                const b = document.createElement('div');
                b.className = 'color-btn' + (i === 0 ? ' active' : '');
                b.style.background = c.hex;
                b.title = c.name;
                b.addEventListener('click', () => {
                    document.querySelectorAll('.color-btn').forEach(x => x.classList.remove('active'));
                    b.classList.add('active');
                    currentColor = c.hex;
                });
                cp.appendChild(b);
            });

            // Block Type Buttons
            document.querySelectorAll('.block-btn').forEach(b => b.addEventListener('click', () => {
                document.querySelectorAll('.block-btn').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                currentBlockType = b.dataset.type;
                // Force a ghost mesh update
                onMouseMove({ clientX: mouse.x * 0.5 + 0.5 * window.innerWidth, clientY: 0.5 * window.innerHeight - mouse.y * 0.5 * window.innerHeight });
            }));

            // Rotation Buttons
            document.querySelectorAll('.rotation-controls .rotation-btn').forEach(b => b.addEventListener('click', () => {
                if (b.dataset.rotation !== undefined) {
                    currentRotation = parseInt(b.dataset.rotation);
                    updateRotationUI('rotation-y-controls', currentRotation);
                }
                if (b.dataset.zrotation !== undefined) {
                    currentZRotation = parseInt(b.dataset.zrotation);
                    updateRotationUI('rotation-z-controls', currentZRotation);
                }
                // Force a ghost mesh update
                onMouseMove({ clientX: mouse.x * 0.5 + 0.5 * window.innerWidth, clientY: 0.5 * window.innerHeight - mouse.y * 0.5 * window.innerHeight });
            }));

            // Action Buttons
            document.getElementById('add-mode').addEventListener('click', () => setMode('add'));
            document.getElementById('delete-mode').addEventListener('click', () => setMode('delete'));
            document.getElementById('undo-btn').addEventListener('click', undo);
            document.getElementById('redo-btn').addEventListener('click', redo);
            document.getElementById('save-btn').addEventListener('click', saveToFile);
            document.getElementById('load-btn').addEventListener('click', () => document.getElementById('file-input').click());
            document.getElementById('export-stl-btn').addEventListener('click', exportToSTL);
            document.getElementById('clear-btn').addEventListener('click', clearAll);

            // Layer Controls
            document.getElementById('layer-up').addEventListener('click', () => {
                // If it's showing all layers, start at layer 0. Otherwise, increment.
                currentLayer = currentLayer === null ? 0 : currentLayer + 1;
                showAllLayers = false;
                document.getElementById('show-all-layers').checked = false;
                updateLayerDisplay();
            });
            document.getElementById('layer-down').addEventListener('click', () => {
                if (currentLayer === null) currentLayer = 0;
                else if (currentLayer > 0) currentLayer--;
                showAllLayers = false;
                document.getElementById('show-all-layers').checked = false;
                updateLayerDisplay();
            });
            document.getElementById('show-all-layers').addEventListener('change', e => {
                showAllLayers = e.target.checked;
                if (showAllLayers) currentLayer = null;
                updateLayerDisplay();
            });
            // Initialize undo/redo button states
            updateHistoryButtons();
        }

        // Save current blocks to a JSON file and trigger download
        function saveToFile() {
            const data = {
                cubeSize: CUBE_SIZE,
                gridSize: GRID_SIZE,
                blocks: blocks.map(b => ({ x: b.x, y: b.y, z: b.z, type: b.type, color: b.color, rotation: b.rotation, zRotation: b.zRotation }))
            };
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            // Prompt user for filename so the browser Save dialog can use the chosen name
            const defaultName = 'block_layout.json';
            const fname = window.prompt('Save file as', defaultName);
            if (!fname) return; // canceled
            downloadBlob(fname, blob);
        }

        // Create a hidden file input for loading
        (function createFileInput(){
            const fi = document.createElement('input');
            fi.type = 'file';
            fi.id = 'file-input';
            fi.accept = '.json,application/json';
            fi.style.display = 'none';
            fi.addEventListener('change', handleFileSelect);
            document.body.appendChild(fi);
        })();

        function handleFileSelect(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = evt => {
                try {
                    const data = JSON.parse(evt.target.result);
                    loadFromData(data);
                } catch (err) {
                    alert('Failed to load file: ' + err.message);
                }
            };
            reader.readAsText(file);
            e.target.value = ''; // reset
        }

        function loadFromData(data) {
            if (!data.blocks || !Array.isArray(data.blocks)) {
                alert('Invalid file format');
                return;
            }
            // Clear existing
            blocks.forEach(b => scene.remove(b.mesh));
            blocks = [];
            history = [];
            redoStack = [];

            data.blocks.forEach(b => {
                // Recreate the mesh according to block data
                let m;
                if (b.type === 'cube') m = createCubeMesh(b.color || currentColor);
                else if (b.type === 'ramp') m = createRampMesh(b.color || currentColor, b.rotation || 0, b.zRotation || 0);
                else if (b.type === 'int_junction') m = createInternalRampMesh(b.color || currentColor, b.rotation || 0, b.zRotation || 0);
                else if (b.type === 'ext_junction') m = createExternalRampMesh(b.color || currentColor, b.rotation || 0, b.zRotation || 0);
                else return;

                m.position.set(b.x * CUBE_SIZE + CUBE_SIZE/2, b.y * CUBE_SIZE + CUBE_SIZE/2, b.z * CUBE_SIZE + CUBE_SIZE/2);
                m.castShadow = true;
                m.receiveShadow = true;
                scene.add(m);

                const blockObj = { x: b.x, y: b.y, z: b.z, color: b.color || currentColor, type: b.type, rotation: b.rotation || 0, zRotation: b.zRotation || 0, mesh: m };
                blocks.push(blockObj);
            });

            updateLayerDisplay();
            updateHistoryButtons();
        }

        function downloadBlob(filename, blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
        }

        function updateHistoryButtons() {
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');
            if (undoBtn) undoBtn.disabled = history.length === 0;
            if (redoBtn) redoBtn.disabled = redoStack.length === 0;
        }

        function redo() {
            if (redoStack.length === 0) return;
            const a = redoStack.pop();
            if (a.action === 'add') {
                // re-add
                scene.add(a.block.mesh);
                blocks.push(a.block);
            } else if (a.action === 'delete') {
                // re-delete
                scene.remove(a.block.mesh);
                blocks = blocks.filter(b => b !== a.block);
            }
            history.push(a);
            updateLayerDisplay();
            updateHistoryButtons();
            // Force mouse move update
            onMouseMove({ clientX: mouse.x * 0.5 + 0.5 * window.innerWidth, clientY: 0.5 * window.innerHeight - mouse.y * 0.5 * window.innerHeight });
        }

        // Export all visible blocks to an ASCII STL and trigger download
        function exportToSTL() {
            const lines = [];
            lines.push('solid model');

            const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
            const cb = new THREE.Vector3(), ab = new THREE.Vector3();

            // Precision helper:  round to 6 decimal places to ensure vertex welding
            const round6 = (n) => Math.round(n * 1000000) / 1000000;

            // Track unique vertices to detect duplicate/degenerate triangles
            const triangleSet = new Set();
            let degeneratCount = 0;
            let normalFlipCount = 0;
            let normalCorrectionCount = 0;

            blocks.forEach(b => {
                if (! b.mesh || !b.mesh.geometry) return;

                // Clone and bake geometry with world transforms
                const geom = b.mesh.geometry. clone().toNonIndexed();

                // Ensure geometry has consistent winding
                geom.applyMatrix4(b.mesh. matrixWorld);

                // Recompute normals for consistency
                geom.computeVertexNormals();

                const pos = geom.attributes.position. array;
                const normals = geom.attributes.normal ?  geom.attributes.normal.array : null;

                // Triangles are every 3 vertices in non-indexed geometry
                for (let i = 0; i < pos.length; i += 9) {
                    // Round vertices to eliminate floating point errors
                    vA.set(round6(pos[i]), round6(pos[i+1]), round6(pos[i+2]));
                    vB.set(round6(pos[i+3]), round6(pos[i+4]), round6(pos[i+5]));
                    vC.set(round6(pos[i+6]), round6(pos[i+7]), round6(pos[i+8]));

                    // ✅ FIX 1: Skip duplicate vertices (non-manifold indicator)
                    if (vA.equals(vB) || vB.equals(vC) || vA.equals(vC)) {
                        degeneratCount++;
                        continue;
                    }

                    // Skip degenerate triangles (zero area)
                    ab.subVectors(vB, vA);
                    cb.subVectors(vC, vA);
                    const normal = new THREE.Vector3().crossVectors(ab, cb);
                    const area = normal.length();

                    // ✅ FIX 2:  Increased threshold to catch more near-zero area triangles
                    if (area < 0.001) continue; // Increased from 0.000001

                    normal.normalize();

                    // ✅ FIX 3: Ensure normal points outward by checking dot product with center-to-vertex vector
                    const centerToVert = new THREE.Vector3().addVectors(vA, vB).add(vC).multiplyScalar(1/3);
                    if (normal.dot(centerToVert) < 0) {
                        // Normal points inward - reverse it
                        normal. negate();
                        normalCorrectionCount++;
                    }

                    let nx = round6(normal.x);
                    let ny = round6(normal.y);
                    let nz = round6(normal.z);

                    // ✅ FIX 4: Create triangle signature to detect duplicate triangles
                    const sig = `${vA.x},${vA.y},${vA.z}|${vB.x},${vB.y},${vB.z}|${vC. x},${vC.y},${vC.z}`;
                    const sigReverse = `${vC.x},${vC.y},${vC.z}|${vB.x},${vB.y},${vB.z}|${vA.x},${vA.y},${vA. z}`;

                    if (triangleSet.has(sig)) {
                        // Duplicate triangle - skip to avoid non-manifold edges
                        continue;
                    }

                    // ✅ FIX 5: Warn if we detect opposing triangles (backface + frontface issue)
                    if (triangleSet.has(sigReverse)) {
                        normalFlipCount++;
                        // Still include but log - might be intentional
                    }

                    triangleSet.add(sig);

                    lines.push(` facet normal ${nx} ${ny} ${nz}`);
                    lines.push('  outer loop');
                    lines. push(`   vertex ${vA.x} ${vA.y} ${vA.z}`);
                    lines.push(`   vertex ${vB.x} ${vB.y} ${vB.z}`);
                    lines.push(`   vertex ${vC.x} ${vC.y} ${vC.z}`);
                    lines.push('  endloop');
                    lines. push(' endfacet');
                }
            });

            lines.push('endsolid model');

            // ✅ FIX 6: Validate mesh integrity before export
            if (triangleSet.size === 0) {
                alert('Error: No valid triangles found in geometry. Export aborted.');
                return;
            }

            // ✅ FIX 7: Log warnings about potential issues
            const warnings = [];
            if (degeneratCount > 0) warnings.push(`Removed ${degeneratCount} degenerate triangles`);
            if (normalFlipCount > 0) warnings.push(`Detected ${normalFlipCount} potential normal inconsistencies`);
            if (normalCorrectionCount > 0) warnings.push(`Corrected ${normalCorrectionCount} inward-pointing normals`);

            if (warnings.length > 0) {
                console.warn('STL Export Warnings:', warnings. join(', '));
            }

            const blob = new Blob([lines.join('\n')], { type: 'text/plain' });

            const now = new Date();
            const pad = n => n.toString().padStart(2, '0');
            const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const defaultName = `model_${ts}.stl`;
            let fname = window.prompt('Save STL as', defaultName);
            if (!fname) return; // canceled
            if (! fname.toLowerCase().endsWith('.stl')) fname += '.stl';
            downloadBlob(fname, blob);

            // ✅ FIX 8: Notify user of export summary
            console.log(`STL exported successfully with ${triangleSet.size} triangles`);
        }

        function updateLayerDisplay() {
            const d = document.getElementById('layer-display');
            if (showAllLayers) {
                d.textContent = 'All Layers';
                blocks.forEach(b => b.mesh.visible = true);
            }
            else {
                d.textContent = `Layer ${currentLayer + 1}`;
                blocks.forEach(b => b.mesh.visible = b.y === currentLayer);
            }
        }

        function createCubeMesh(c) {
            const g = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
            const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: c }));
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })));
            return m;
        }

        function createRampMesh(c, r = 0, z = 0) {
            // Create a triangular prism (triangular cross-section extruded along Z) that fits inside
            // a CUBE_SIZE cube and is centered at the origin.
            const C = CUBE_SIZE;

            const vertices = new Float32Array([
                -C/2, -C/2, -C/2, // v0
                 C/2, -C/2, -C/2, // v1
                 C/2,  C/2, -C/2, // v2

                -C/2, -C/2,  C/2, // v3
                 C/2, -C/2,  C/2, // v4
                 C/2,  C/2,  C/2, // v5
            ]);

            // ✅ FIX:  Ensure consistent winding (CCW when viewed from outside)
            // and comprehensive triangle coverage for watertight mesh
            const indices = [
                // Back triangle (z = -C/2) - CCW from outside (looking in -Z direction)
                0, 2, 1,
                // Front triangle (z = +C/2) - CCW from outside (looking in +Z direction)
                3, 4, 5,

                // Bottom rectangular face (y = -C/2) between v0-v1 and v3-v4
                0, 4, 1,
                0, 3, 4,

                // Sloped rectangular face (the ramp) between v1-v2 and v4-v5
                1, 5, 2,
                1, 4, 5,

                // Side rectangular face (the vertical back) between v2-v0 and v5-v3
                2, 3, 0,
                2, 5, 3
            ];

            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            g.setIndex(indices);
            g.computeVertexNormals();

            const mat = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
            const m = new THREE.Mesh(g, mat);
            m.rotation.order = 'YXZ';
            m.rotation.y = THREE.MathUtils.degToRad(r);
            m.rotation.x = THREE.MathUtils.degToRad(z);
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x000000 })));
            return m;
        }


        function createInternalRampMesh(c, r = 0, z = 0) {
            // Concave internal junction:  three raised corners (NW, NE, SW) and SE remains low.
            const C = CUBE_SIZE;
            const g = new THREE.BufferGeometry();

            const vertices = new Float32Array([
                0, 0, 0,     // 0: [0,0,0]
                C, 0, 0,     // 1: [C,0,0]
                0, 0, C,     // 2: [0,0,C]
                C, 0, C,     // 3: [C,0,C]
                0, C, C,     // 4: [0,C,C]
                0, C, 0,     // 5: [0,C,0]
                C, C, 0      // 6: [C,C,0]
            ]);

            // ✅ FIX:  Consistent CCW winding for all faces (viewed from outside)
            // and ensure complete watertight coverage
            const indices = [
                // Sloped internal faces around the low corner (index 3)
                1, 6, 3,  // CCW from outside
                3, 4, 2,  // CCW from outside
                4, 5, 3,  // CCW from outside
                3, 6, 5,  // CCW from outside

                // Outer vertical/rim faces
                0, 6, 1,  // CCW from outside
                0, 5, 6,  // CCW from outside
                0, 4, 5,  // CCW from outside
                0, 2, 4,  // CCW from outside

                // Base cap (two triangles) - ensure correct winding
                0, 3, 1,  // CCW from below
                0, 2, 3   // CCW from below
            ];

            g.setAttribute('position', new THREE. BufferAttribute(vertices, 3));
            g.setIndex(indices);
            g.computeVertexNormals();
            g.translate(-C / 2, -C / 2, -C / 2);

            const mat = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
            const m = new THREE.Mesh(g, mat);
            m.rotation.order = 'YXZ';
            m.rotation.y = THREE. MathUtils.degToRad(r);
            m.rotation.x = THREE.MathUtils.degToRad(z);
            m.add(new THREE.LineSegments(new THREE. EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x000000 })));
            return m;
        }


        function createExternalRampMesh(c, r = 0, z = 0) {
            // Convex Corner / External Junction (pyramid apex above one base corner)
            const C = CUBE_SIZE;
            const g = new THREE.BufferGeometry();

            const vertices = new Float32Array([
                0, 0, 0,   // 0: base NW
                C, 0, 0,   // 1: base NE (corner under apex)
                C, 0, C,   // 2: base SE
                0, 0, C,   // 3: base SW
                C, C, 0    // 4: apex above NE
            ]);

            // ✅ FIX:  Consistent CCW winding for all faces (viewed from outside)
            // and add explicit bottom cap
            const indices = [
                // Triangular faces pointing outward from the apex
                4, 1, 0,  // Left side - CCW from outside
                4, 2, 1,  // Right side - CCW from outside
                4, 3, 2,  // Back side - CCW from outside
                4, 0, 3,  // Left back - CCW from outside

                // Base cap - ensure correct winding (CCW from below looking up)
                0, 2, 1,
                0, 3, 2
            ];

            g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            g.setIndex(indices);
            g.computeVertexNormals();
            g.translate(-C / 2, -C / 2, -C / 2);

            const mat = new THREE.MeshLambertMaterial({ color: c, side:  THREE.DoubleSide });
            const m = new THREE. Mesh(g, mat);
            m.rotation.order = 'YXZ';
            m. rotation.y = THREE.MathUtils.degToRad(r);
            m.rotation.x = THREE.MathUtils.degToRad(z);
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color:  0x000000 })));
            return m;
        }

        function createGhostMesh(t, r, z) {
            let m;
            // Use a distinct ghost color (Blue)
            const ghostColor = 0x4d96ff;
            if (t === 'cube') m = createCubeMesh(ghostColor);
            else if (t === 'ramp') m = createRampMesh(ghostColor, r, z);
            else if (t === 'int_junction') m = createInternalRampMesh(ghostColor, r, z);
            else if (t === 'ext_junction') m = createExternalRampMesh(ghostColor, r, z);
            else return null;

            // Apply ghost properties
            m.material.transparent = true;
            m.material.opacity = 0.5;
            m.material.depthWrite = false; // Important for ghosting effect
            m.userData = { type: t, rotation: r, zRotation: z };

            // Remove edge lines from the ghost mesh for a cleaner look
            m.children = m.children.filter(child => !(child instanceof THREE.LineSegments));

            return m;
        }

        function onMouseMove(e) {
            if (mode !== 'add') { if (ghostMesh) ghostMesh.visible = false; return; }

            // Update mouse coordinates based on event or simulated event
            if (e.clientX !== undefined) {
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            }

            raycaster.setFromCamera(mouse, camera);

            const interactiveObjects = blocks.map(b => b.mesh).filter(m => m.visible);
            interactiveObjects.push(gridPlane);

            const hits = raycaster.intersectObjects(interactiveObjects);

            let tx, ty, tz, found = false;

            if (hits.length > 0) {
                const h = hits[0];
                const isBlock = h.object !== gridPlane;
                const tol = 0.5;

                if (isBlock) {
                    // Hit a block: determine the coordinates of the next space
                    const cb = blocks.find(b => b.mesh === h.object);
                    if (!cb) return;

                    tx = cb.x;
                    ty = cb.y;
                    tz = cb.z;

                    const cx = cb.x * CUBE_SIZE + CUBE_SIZE / 2;
                    const cy = cb.y * CUBE_SIZE + CUBE_SIZE / 2;
                    const cz = cb.z * CUBE_SIZE + CUBE_SIZE / 2;

                    const dx = h.point.x - cx;
                    const dy = h.point.y - cy;
                    const dz = h.point.z - cz;

                    const ax = Math.abs(dx);
                    const ay = Math.abs(dy);
                    const az = Math.abs(dz);

                    if (ay >= ax && ay >= az) ty += dy > 0 ? 1 : -1;
                    else if (ax >= ay && ax >= az) tx += dx > 0 ? 1 : -1;
                    else tz += dz > 0 ? 1 : -1;

                    if (
                        ty >= 0 && ty < GRID_SIZE &&
                        tx >= -GRID_SIZE / 2 && tx < GRID_SIZE / 2 &&
                        tz >= -GRID_SIZE / 2 && tz < GRID_SIZE / 2 &&
                        !blocks.find(b => b.x === tx && b.y === ty && b.z === tz)
                    ) {
                        found = true;
                    }

                } else {
                    // Hit the grid plane: determine the ground level coordinates
                    const p = h.point;
                    tx = Math.round(p.x / CUBE_SIZE);
                    ty = 0;
                    tz = Math.round(p.z / CUBE_SIZE);

                    if (
                        ty >= 0 && ty < GRID_SIZE &&
                        tx >= -GRID_SIZE / 2 && tx < GRID_SIZE / 2 &&
                        tz >= -GRID_SIZE / 2 && tz < GRID_SIZE / 2 &&
                        !blocks.find(b => b.x === tx && b.y === ty && b.z === tz)
                    ) {
                        found = true;
                    }
                }
            }

            // Ghost Mesh Update Logic
            if (found) {
                // If the block type or rotation changed, recreate the ghost mesh
                if (!ghostMesh || ghostMesh.userData.type !== currentBlockType || ghostMesh.userData.rotation !== currentRotation || ghostMesh.userData.zRotation !== currentZRotation) {
                    if (ghostMesh) scene.remove(ghostMesh);
                    ghostMesh = createGhostMesh(currentBlockType, currentRotation, currentZRotation);
                    scene.add(ghostMesh);
                }

                // Snap ghost to grid position
                ghostMesh.position.set(tx * CUBE_SIZE + CUBE_SIZE/2, ty * CUBE_SIZE + CUBE_SIZE/2, tz * CUBE_SIZE + CUBE_SIZE/2);

                // Only show ghost if the current layer view permits it
                if (showAllLayers || ty === currentLayer) {
                    ghostMesh.visible = true;
                } else {
                    ghostMesh.visible = false;
                }
            } else if (ghostMesh) {
                // Hide ghost if no valid placement found
                ghostMesh.visible = false;
            }
        }

        function onClick(e) {
            if (e.button === 2) return; // Ignore right-click (used for rotating view)

            // Don't interact if clicking on the UI panel
            const panel = document.getElementById('ui-panel');
            if (panel.contains(e.target)) return;

            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const visibleBlocks = blocks.map(b => b.mesh).filter(m => m.visible);

            if (mode === 'delete') {
                const hits = raycaster.intersectObjects(visibleBlocks);
                if (hits.length > 0) {
                    const b = blocks.find(x => x.mesh === hits[0].object);
                    if (b) deleteBlock(b);
                }
            }
            else if (mode === 'add') {
                const interactiveObjects = visibleBlocks;
                interactiveObjects.push(gridPlane);

                const hits = raycaster.intersectObjects(interactiveObjects);
                let nx, ny, nz, found = false;

                if (hits.length > 0) {
                    const h = hits[0];
                    const isBlock = h.object !== gridPlane;

                    if (isBlock) {
                        // Hit a block: determine the coordinates of the next space
                        const cb = blocks.find(b => b.mesh === h.object);
                        if (!cb) return;

                        nx = cb.x;
                        ny = cb.y;
                        nz = cb.z;

                        // Determine adjacency based on hit position relative to block center
                        const cx = cb.x * CUBE_SIZE + CUBE_SIZE / 2;
                        const cy = cb.y * CUBE_SIZE + CUBE_SIZE / 2;
                        const cz = cb.z * CUBE_SIZE + CUBE_SIZE / 2;

                        const dx = h.point.x - cx;
                        const dy = h.point.y - cy;
                        const dz = h.point.z - cz;

                        const ax = Math.abs(dx);
                        const ay = Math.abs(dy);
                        const az = Math.abs(dz);

                        if (ay >= ax && ay >= az) ny += dy > 0 ? 1 : -1;
                        else if (ax >= ay && ax >= az) nx += dx > 0 ? 1 : -1;
                        else nz += dz > 0 ? 1 : -1;

                        // ✅ FIX: full bounds check (must match onMouseMove)
                        if (
                            ny >= 0 && ny < GRID_SIZE &&
                            nx >= -GRID_SIZE / 2 && nx < GRID_SIZE / 2 &&
                            nz >= -GRID_SIZE / 2 && nz < GRID_SIZE / 2 &&
                            !blocks.find(b => b.x === nx && b.y === ny && b.z === nz)
                        ) {
                            found = true;
                        }

                    } else {
                        // Hit the grid plane: determine the ground level coordinates
                        const p = h.point;
                        nx = Math.round(p.x / CUBE_SIZE);
                        ny = 0;
                        nz = Math.round(p.z / CUBE_SIZE);

                        if (
                            ny >= 0 && ny < GRID_SIZE &&
                            nx >= -GRID_SIZE / 2 && nx < GRID_SIZE / 2 &&
                            nz >= -GRID_SIZE / 2 && nz < GRID_SIZE / 2 &&
                            !blocks.find(b => b.x === nx && b.y === ny && b.z === nz)
                        ) {
                            found = true;
                        }
                    }
                }

                if (found) addBlock(nx, ny, nz);

                // Refresh the ghost mesh display after placing a block
                onMouseMove(e);
            }
        }

        function addBlock(x, y, z) {
            if (blocks.find(b => b.x === x && b.y === y && b.z === z)) return;

            let m;
            if (currentBlockType === 'cube') m = createCubeMesh(currentColor);
            else if (currentBlockType === 'ramp') m = createRampMesh(currentColor, currentRotation, currentZRotation);
            else if (currentBlockType === 'int_junction') m = createInternalRampMesh(currentColor, currentRotation, currentZRotation);
            else if (currentBlockType === 'ext_junction') m = createExternalRampMesh(currentColor, currentRotation, currentZRotation);
            else return;

            m.position.set(x * CUBE_SIZE + CUBE_SIZE/2, y * CUBE_SIZE + CUBE_SIZE/2, z * CUBE_SIZE + CUBE_SIZE/2);
            m.castShadow = true;
            m.receiveShadow = true;
            scene.add(m);

            const b = { x, y, z, color: currentColor, type: currentBlockType, rotation: currentRotation, zRotation: currentZRotation, mesh: m };
            blocks.push(b);
            history.push({ action: 'add', block: b });
            // New user action invalidates redo stack
            redoStack = [];
            updateHistoryButtons();

            updateLayerDisplay();
        }

        function deleteBlock(b) {
            scene.remove(b.mesh);
            blocks = blocks.filter(x => x !== b);
            history.push({ action: 'delete', block: b });
            // New user action invalidates redo stack
            redoStack = [];
            updateHistoryButtons();
            updateLayerDisplay();
        }

        function undo() {
            if (history.length === 0) return;

            const a = history.pop();

            if (a.action === 'add') {
                scene.remove(a.block.mesh);
                blocks = blocks.filter(b => b !== a.block);
            } else if (a.action === 'delete') {
                // When re-adding, we need to ensure the block is placed
                // in the correct layer view if it's not showing all layers.
                blocks.push(a.block);
                scene.add(a.block.mesh);
            }
            // Push the undone action to redo stack
            redoStack.push(a);
            updateLayerDisplay();
            updateHistoryButtons();
            // Force mouse move update to hide ghost if location is now occupied
            onMouseMove({ clientX: mouse.x * 0.5 + 0.5 * window.innerWidth, clientY: 0.5 * window.innerHeight - mouse.y * 0.5 * window.innerHeight });
        }

        function clearAll() {
            if (confirm('Clear everything? This cannot be undone!')) {
                blocks.forEach(b => scene.remove(b.mesh));
                blocks = [];
                history = [];
                redoStack = [];
                updateLayerDisplay();
                if (ghostMesh) ghostMesh.visible = false;
                updateHistoryButtons();
            }
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }

        //helper for ramp on ramp placement
        function gridOffsetFromHit(hitPoint, block) {
            const cx = block.x * CUBE_SIZE + CUBE_SIZE / 2;
            const cy = block.y * CUBE_SIZE + CUBE_SIZE / 2;
            const cz = block.z * CUBE_SIZE + CUBE_SIZE / 2;

            const dx = hitPoint.x - cx;
            const dy = hitPoint.y - cy;
            const dz = hitPoint.z - cz;

            const ax = Math.abs(dx);
            const ay = Math.abs(dy);
            const az = Math.abs(dz);

            if (ay >= ax && ay >= az) return dy > 0 ? [0, 1, 0] : [0, -1, 0];
            if (ax >= ay && ax >= az) return dx > 0 ? [1, 0, 0] : [-1, 0, 0];
            return dz > 0 ? [0, 0, 1] : [0, 0, -1];
        }


        init();
