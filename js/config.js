export const FALLBACK_NAMES = [
    "Chihiro", "Haku", "Totoro", "Kiki", "Jiji", "Ponyo", "Sosuke", "Sophie", "Howl", "Calcifer", 
    "Markl", "Nausicaa", "Sheeta", "Pazu", "San", "Ashitaka", "Yubaba", "Kamaji", "Lin", "No-Face", 
    "Baron", "Muta", "Haru", "Seiji", "Shizuku", "Natori", "Nao", "Toto",
    "Arrietty", "Spiller", "Marnie", "Anna", "Umi", "Shun", "Pod", "Homily", "Sadako",
    "Yakul", "Moro", "Okami", "Nago", "Okkoto", "Gonza", "Toki", "Eboshi", "Jigo", "Kaya", "Hii-sama", "Kohroku",
    "Zeniba", "Boh", "Aogaeru", "Bandai-gaeru", "Chichiyaku", "Aniyaku",
    "Turnip", "Heen", "Lettie", "Honey", "Suliman",
    "Arren", "Therru", "Sparrowhawk", "Ged", "Tenar", "Tehanu", "Cob", "Hare",
    "Jiro", "Nahoko", "Caproni", "Castorp", "Honjo", "Kayo",
    "Fujimoto", "Granmamare", "Lisa", "Koichi", "Toki", "Yoshie", "Noriko", "Kumiko", "Karen",
    "Tombo", "Osono", "Fukuo", "Ursula", "Ket", "Maki", "Madame", "Barsa",
    "Dola", "Charles", "Louis", "Henri", "Motro", "Okami", "Muska", "Uncle Pom"
];

export const FALLBACK_PHRASES = {
    'curious and bubbly': [
        "Sparkles!", "Bloop bloop!", "Is that food?", "Yum yum!", "Friend?", "Swimming!", 
        "Happy bubbles!", "So shiny!", "Did you see that?", "Round and round!", "Tee hee!", 
        "Water is nice!", "Hello up there!", "Wiggle wiggle.", "Play with me!", "I found a bubble!"
    ],
    'playful, clicking, and mysterious': [
        "Click...", "Echoes...", "Hide and seek?", "Catch me!", "Spirits whisper...", 
        "Tee hee!", "Invisible...", "You can't see me.", "Secrets...", "The water remembers.", 
        "Pop!", "Do you know the way?", "Turning...", "Softly now.", "I am here... and there."
    ],
    'slow, wise, and sleepy': [
        "The river knows...", "Zzz...", "Currents shift...", "Patience...", "Drifting...", 
        "Ancient waters...", "Rest now.", "Time flows like water.", "Hrmmm...", "No rush.", 
        "The moss grows slow.", "Quiet thoughts.", "Deep breaths.", "Sleepy tides.", "A long journey."
    ],
    'majestic, ancient, and noble': [
        "Behold.", "The deep calls.", "Golden light.", "Respect the water.", "I watch over all.", 
        "Grace.", "Silence.", "The sky reflects here.", "Do not disturb the flow.", "I have seen ages.", 
        "Noble currents.", "Rise above.", "Tranquility.", "The spirits are watching.", "Pure waters."
    ],
    'silent, hungry, and eerie': [
        "...", "Ah... ah...", "Gold...", "Hungry...", "Feed me...", "Lonely...", 
        "Empty...", "Want...", "More...", "Darkness...", "Cold...", "Waiting...", 
        "Give...", "Shadow...", "Lost..."
    ],
    'energetic, starlike, and fast': [
        "Zoom!", "Twinkle!", "Shooting star!", "Catch me!", "Light!", "Speed!", 
        "Zap!", "Faster!", "Can't stop!", "Glowing!", "Look at me!", "Whoosh!", 
        "Bright!", "Starlight!", "Burning bright!"
    ],
    'aggressive, hunting, and sharp': [
        "Prey...", "Shadows...", "Snap!", "Watching...", "Hunger...", "Darkness...", 
        "Closer...", "Hunt.", "Sharp teeth.", "Silent stalker.", "Fear me.", "Blood in the water.", 
        "My domain.", "Trespasser.", "Got you."
    ],
    'massive, slow, and insatiable': [
        "Gulp.", "Ancient hunger.", "Floating...", "Everything is food.", "Slowly...", 
        "Grow...", "Endless...", "Mouth open.", "Drift to me.", "Heavy...", "Big water.", 
        "Swallow whole.", "Deep belly.", "River god.", "Mountain of flesh."
    ]
};

export const CONFIG = {
    colors: {
        waterTop: '#2F5A6E',
        waterBottom: '#16252B',
        ray: 'rgba(255, 255, 255, 0.03)',
        food: '#E8B67D',
        caustic: 'rgba(164, 221, 219, 0.05)'
    },
    physics: {
        friction: 0.96,
        turnSpeed: 0.08,
        foodGravity: 0.8
    }
};

export const SPECIES = [
    { id: 'basic', name: 'River Spirit', cost: 100, colorBody: '#E86F51', colorFin: '#F4A261', size: 15, speed: 2.5, finType: 'simple', personality: 'curious and bubbly', soundPitch: 1.0 },
    { id: 'starbit', name: 'Star Bit Guppy', cost: 250, colorBody: '#FFD93D', colorFin: '#FFF', size: 10, speed: 4.0, finType: 'simple', personality: 'energetic, starlike, and fast', soundPitch: 1.5 },
    { id: 'kodama', name: 'Kodama Tetra', cost: 350, colorBody: '#F1FAEE', colorFin: '#A8DADC', size: 12, speed: 3.5, finType: 'glow', personality: 'playful, clicking, and mysterious', soundPitch: 1.2 },
    { id: 'forest', name: 'Mossy Carp', cost: 800, colorBody: '#457B9D', colorFin: '#1D3557', size: 25, speed: 1.8, finType: 'flowing', personality: 'slow, wise, and sleepy', soundPitch: 0.8 },
    { id: 'hunter', name: 'Shadow Hunter', cost: 1200, colorBody: '#2C3E50', colorFin: '#E74C3C', size: 30, speed: 3.8, finType: 'fancy', personality: 'aggressive, hunting, and sharp', isPredator: true, soundPitch: 0.6 },
    { id: 'sun', name: 'Sky Spirit', cost: 2000, colorBody: '#fff', colorFin: '#48CAE4', size: 35, speed: 3.0, finType: 'flowing', personality: 'majestic, ancient, and noble', soundPitch: 1.8 },
    { id: 'lord', name: 'River Lord', cost: 5000, colorBody: '#4A5568', colorFin: '#2D3748', size: 60, speed: 1.2, finType: 'flowing', personality: 'massive, slow, and insatiable', isPredator: true, soundPitch: 0.4 }
];

