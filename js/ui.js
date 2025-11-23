export function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.opacity = 1;
    setTimeout(() => t.style.opacity = 0, 2000);
}

export function updateFishCounts(fishes) {
    // Count fish by species
    const counts = {};
    fishes.forEach(f => {
        const id = f.species.id;
        counts[id] = (counts[id] || 0) + 1;
    });

    // Update UI
    const countEls = document.querySelectorAll('.fish-count');
    countEls.forEach(el => {
        const speciesId = el.id.replace('count-', '');
        const count = counts[speciesId] || 0;
        el.innerText = `${count} alive`;
    });
}

export function toggleHelp() {
    const overlay = document.getElementById('helpOverlay');
    overlay.classList.toggle('show');
}

export function updateScore(score) {
    const val = Math.floor(score);
    let displayVal = val.toString();
    
    if (val >= 1000000) {
        displayVal = (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    } else if (val >= 10000) {
        displayVal = (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    
    document.getElementById('scoreDisplay').innerText = displayVal;
}

export function addToGraveyard(fish, deadCount) {
    const list = document.getElementById('graveyardList');
    const div = document.createElement('div');
    div.className = 'tombstone';
    
    // We need to play sound here, but UI shouldn't know about sound directly if possible, 
    // or we pass sound manager. For now, we'll handle sound in the main loop or passing it.
    
    const mins = ((Date.now() - fish.birthTime) / 60000).toFixed(1);
    const reason = fish.deathReason || "passed away";

    div.innerHTML = `
        ${fish.name} (${fish.species.name})
        <span>${reason} after ${mins} minutes</span>
    `;
    
    // Insert at top of list (newest first)
    list.insertBefore(div, list.firstChild); 
    
    if (list.children.length > 30) {
        list.removeChild(list.lastChild);
    }
    
    document.querySelector('.graveyard-title').innerText = `Spirit Memories (${deadCount})`;
}

