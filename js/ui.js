export function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.opacity = 1;
    setTimeout(() => t.style.opacity = 0, 2000);
}

export function toggleHelp() {
    const overlay = document.getElementById('helpOverlay');
    overlay.classList.toggle('show');
}

export function updateScore(score) {
    document.getElementById('scoreDisplay').innerText = Math.floor(score);
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
    list.insertBefore(div, list.children[1]); 
    
    if (list.children.length > 31) {
        list.removeChild(list.lastChild);
    }
    
    document.querySelector('.graveyard-title').innerText = `Spirit Memories (${deadCount})`;
}

