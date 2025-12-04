
const PARTS_LIST = [
    'Body.png',
    'Tail.png',
    'Fin.png', // Dorsal
    'Pectoral Fin 1.png',
    'Pectoral Fin 2.png',
    'Pelvic Fin 1.png',
    'Pelvic Fin 2.png'
];

// Map standard filenames to logical keys for the config
const PART_KEYS = {
    'Body.png': 'body',
    'Tail.png': 'tail',
    'Fin.png': 'dorsalFin',
    'Pectoral Fin 1.png': 'pectoralFin1',
    'Pectoral Fin 2.png': 'pectoralFin2',
    'Pelvic Fin 1.png': 'pelvicFin1',
    'Pelvic Fin 2.png': 'pelvicFin2'
};

// Default configuration
let config = {
    body: { x: 0, y: 0, scale: 1.0, zIndex: 10, flipY: false, pivotX: 0, pivotY: 0 },
    tail: { x: 80, y: 0, scale: 1.0, zIndex: 5, flipY: false, pivotX: 0, pivotY: 0 },
    dorsalFin: { x: 0, y: -40, scale: 1.0, zIndex: 8, flipY: false, pivotX: 0, pivotY: 0 },
    pectoralFin1: { x: -20, y: 20, scale: 1.0, zIndex: 12, flipY: false, pivotX: 0, pivotY: 0 },
    pectoralFin2: { x: 20, y: 20, scale: 1.0, zIndex: 4, flipY: false, pivotX: 0, pivotY: 0 },
    pelvicFin1: { x: -10, y: 50, scale: 1.0, zIndex: 11, flipY: false, pivotX: 0, pivotY: 0 },
    pelvicFin2: { x: 10, y: 50, scale: 1.0, zIndex: 6, flipY: false, pivotX: 0, pivotY: 0 }
};

let selectedPartKey = null;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let initialPartPos = { x: 0, y: 0 };

// DOM Elements
const fishContainer = document.getElementById('fishContainer');
const layerList = document.getElementById('layerList');
const loadBtn = document.getElementById('loadBtn');
const folderPathInput = document.getElementById('folderPath');
const controls = document.getElementById('selectedControls');
const inputs = {
    x: document.getElementById('posX'),
    y: document.getElementById('posY'),
    scale: document.getElementById('scale'),
    zIndex: document.getElementById('zIndex'),
    flipY: document.getElementById('flipY'),
    pivotX: document.getElementById('pivotX'),
    pivotY: document.getElementById('pivotY')
};
const output = document.getElementById('output');
const exportBtn = document.getElementById('exportBtn');

// Initialize
function init() {
    loadBtn.addEventListener('click', loadImages);
    exportBtn.addEventListener('click', exportConfig);
    
    // Input listeners
    Object.keys(inputs).forEach(key => {
        inputs[key].addEventListener('input', updateSelectedPartFromInput);
        if(key === 'flipY') inputs[key].addEventListener('change', updateSelectedPartFromInput);
    });

    loadImages(); // Load default
}

function loadImages() {
    const folder = folderPathInput.value.replace(/\/$/, '');
    fishContainer.innerHTML = '';
    layerList.innerHTML = '';
    
    PARTS_LIST.forEach(filename => {
        const key = PART_KEYS[filename];
        if (!config[key]) return; // Skip if not in config map

        // Create DOM element for workspace
        const wrapper = document.createElement('div');
        wrapper.className = 'fish-part';
        wrapper.id = `part-${key}`;
        wrapper.dataset.key = key;
        
        const img = document.createElement('img');
        img.src = `${folder}/${filename}`;
        img.draggable = false;
        
        // Pivot marker
        const pivot = document.createElement('div');
        pivot.className = 'pivot-marker';
        
        wrapper.appendChild(img);
        wrapper.appendChild(pivot);
        fishContainer.appendChild(wrapper);

        // Setup drag events
        wrapper.addEventListener('mousedown', onMouseDown);

        // Create layer list item
        const item = document.createElement('div');
        item.className = 'layer-item';
        item.innerText = key;
        item.dataset.key = key;
        item.addEventListener('click', () => selectPart(key));
        layerList.appendChild(item);

        // Initial Render
        updatePartTransform(key);
    });

    // Select first layer
    selectPart('body');
}

function selectPart(key) {
    selectedPartKey = key;
    
    // Update UI highlights
    document.querySelectorAll('.fish-part').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById(`part-${key}`);
    if(el) el.classList.add('selected');

    document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector(`.layer-item[data-key="${key}"]`);
    if(item) item.classList.add('active');

    // Populate controls
    if(config[key]) {
        document.getElementById('selectedName').innerText = key;
        controls.style.display = 'block';
        
        inputs.x.value = config[key].x;
        inputs.y.value = config[key].y;
        inputs.scale.value = config[key].scale;
        inputs.zIndex.value = config[key].zIndex;
        inputs.flipY.checked = config[key].flipY;
        inputs.pivotX.value = config[key].pivotX;
        inputs.pivotY.value = config[key].pivotY;
    }
}

function updatePartTransform(key) {
    const cfg = config[key];
    const el = document.getElementById(`part-${key}`);
    if (!el) return;

    el.style.left = `${cfg.x}px`;
    el.style.top = `${cfg.y}px`;
    el.style.zIndex = cfg.zIndex;
    
    // Pivot logic for the DOM element visual
    // We want the "center" of the div to be the transform origin, but visually offset by pivotX/Y
    // Actually, standard way: use transform for everything.
    
    // But dragging logic relies on left/top being position.
    // Pivot should affect rotation/scaling origin.
    // The green dot shows where the pivot is relative to the image center.
    
    const pivotDiv = el.querySelector('.pivot-marker');
    // Center of image is 50%, 50%. Pivot is offset from that.
    pivotDiv.style.left = `calc(50% + ${cfg.pivotX}px)`;
    pivotDiv.style.top = `calc(50% + ${cfg.pivotY}px)`;

    // Flip
    const scaleY = cfg.flipY ? -1 : 1;
    const scale = cfg.scale;
    
    // Note: In CSS, transform-origin is usually 50% 50%. 
    // If we want to visualize rotation around pivot, we would set transform-origin.
    // But here we are just positioning. 
    el.style.transform = `translate(-50%, -50%) scale(${scale}, ${scale * scaleY})`;
}

function updateSelectedPartFromInput() {
    if (!selectedPartKey) return;
    
    const cfg = config[selectedPartKey];
    cfg.x = parseFloat(inputs.x.value);
    cfg.y = parseFloat(inputs.y.value);
    cfg.scale = parseFloat(inputs.scale.value);
    cfg.zIndex = parseInt(inputs.zIndex.value);
    cfg.flipY = inputs.flipY.checked;
    cfg.pivotX = parseFloat(inputs.pivotX.value);
    cfg.pivotY = parseFloat(inputs.pivotY.value);

    updatePartTransform(selectedPartKey);
}

function onMouseDown(e) {
    if(e.target.classList.contains('fish-part') || e.target.parentElement.classList.contains('fish-part')) {
        e.stopPropagation(); // Prevent workspace events if any
        
        const target = e.target.classList.contains('fish-part') ? e.target : e.target.parentElement;
        const key = target.dataset.key;
        
        selectPart(key);
        
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        initialPartPos = { x: config[key].x, y: config[key].y };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
}

function onMouseMove(e) {
    if (!isDragging || !selectedPartKey) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    config[selectedPartKey].x = Math.round(initialPartPos.x + dx);
    config[selectedPartKey].y = Math.round(initialPartPos.y + dy);
    
    inputs.x.value = config[selectedPartKey].x;
    inputs.y.value = config[selectedPartKey].y;
    
    updatePartTransform(selectedPartKey);
}

function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
}

function exportConfig() {
    output.value = JSON.stringify(config, null, 2);
    // console.log(JSON.stringify(config, null, 2));
    alert('Configuration JSON generated below!');
}

init();
