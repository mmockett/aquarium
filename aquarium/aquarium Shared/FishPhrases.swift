import Foundation

// MARK: - Fish Personality Phrases
// Ported from JS version - phrases for each personality type
// Expanded with Ghibli-inspired dialogue and themes

enum FishPersonality: String, CaseIterable {
    case curiousAndBubbly = "curious and bubbly"
    case playfulClickingMysterious = "playful, clicking, and mysterious"
    case slowWiseSleepy = "slow, wise, and sleepy"
    case majesticAncientNoble = "majestic, ancient, and noble"
    case silentHungryEerie = "silent, hungry, and eerie"
    case energeticStarlikeFast = "energetic, starlike, and fast"
    case aggressiveHuntingSharp = "aggressive, hunting, and sharp"
    case massiveSlowInsatiable = "massive, slow, and insatiable"
    case colorfulAndRadiant = "colorful and radiant"
}

struct FishPhrases {
    
    static let phrases: [FishPersonality: [String]] = [
        .curiousAndBubbly: [
            // Original
            "Sparkles!", "Bloop bloop!", "Is that food?", "Yum yum!", "Friend?", "Swimming!",
            "Happy bubbles!", "So shiny!", "Did you see that?", "Round and round!", "Tee hee!",
            "Water is nice!", "Hello up there!", "Wiggle wiggle.", "Play with me!", "I found a bubble!",
            // Ponyo-inspired
            "HAM!", "I love you!", "Sosuke!", "I want to be human!", "The sea is so big!",
            "Let's go on an adventure!", "Magic is everywhere!", "I'm a fish! No, a girl!",
            // Totoro-inspired
            "The forest is alive!", "Can you see me?", "Let's grow something!", "Rain is fun!",
            "Acorns!", "The wind is playing!", "Jump jump jump!",
            // General wonder
            "What's that?", "Everything sparkles here!", "I see light above!", "So many friends!",
            "The bubbles are dancing!", "I love swimming!", "Look, a treasure!", "Hello, world!",
            "Every day is magical!", "The water sings!", "I'm so happy!", "Wheee!",
            "Let's explore!", "I wonder what's over there?", "Life is wonderful!"
        ],
        .playfulClickingMysterious: [
            // Original
            "Click...", "Echoes...", "Hide and seek?", "Catch me!", "Spirits whisper...",
            "Tee hee!", "Invisible...", "You can't see me.", "Secrets...", "The water remembers.",
            "Pop!", "Do you know the way?", "Turning...", "Softly now.", "I am here... and there.",
            // Cat Returns / Whisper-inspired
            "Follow the moonlight...", "The Baron sends his regards.", "Between worlds...",
            "Dreams within dreams...", "The clock strikes...", "A door is opening...",
            // Spirited Away-inspired
            "Names have power...", "Don't look back...", "Remember who you are...",
            "The river flows both ways...", "Gold turns to leaves...", "Nothing is as it seems...",
            // General mysterious
            "Listen closely...", "The shadows dance...", "Now you see me...", "Riddles in the deep...",
            "Follow the current...", "What was your name again?", "Time moves differently here...",
            "The old magic stirs...", "Between the ripples...", "Whispers from below...",
            "Can you hear it?", "The spirits are restless...", "A secret path opens...",
            "In the space between breaths...", "The veil is thin tonight..."
        ],
        .slowWiseSleepy: [
            // Original
            "The river knows...", "Zzz...", "Currents shift...", "Patience...", "Drifting...",
            "Ancient waters...", "Rest now.", "Time flows like water.", "Hrmmm...", "No rush.",
            "The moss grows slow.", "Quiet thoughts.", "Deep breaths.", "Sleepy tides.", "A long journey.",
            // Totoro / Forest Spirit-inspired
            "The forest dreams...", "Seeds take time...", "Growth cannot be rushed...",
            "The old trees remember...", "Listen to the wind...", "Nature finds a way...",
            // Nausicaä-inspired
            "The earth heals itself...", "All life is connected...", "Even poison has purpose...",
            "The toxic jungle breathes...", "Patience reveals truth...", "Anger clouds wisdom...",
            // General wisdom
            "I have seen many seasons...", "The young swim so fast...", "Stillness is strength...",
            "Every ripple returns...", "The deep holds memories...", "Wisdom comes with waiting...",
            "Let the current carry you...", "Old bones, old stories...", "The water was here first...",
            "I remember when...", "Sleep brings dreams...", "The moon pulls us all...",
            "In time, all is revealed...", "The ancestors watch...", "Peace in the depths..."
        ],
        .majesticAncientNoble: [
            // Original
            "Behold.", "The deep calls.", "Golden light.", "Respect the water.", "I watch over all.",
            "Grace.", "Silence.", "The sky reflects here.", "Do not disturb the flow.", "I have seen ages.",
            "Noble currents.", "Rise above.", "Tranquility.", "The spirits are watching.", "Pure waters.",
            // Princess Mononoke-inspired
            "The forest god stirs...", "Balance must be maintained.", "Humans forget their place.",
            "The ancient ones remember.", "Blood and life are one.", "Nature's fury is just.",
            "I am the forest.", "The curse spreads...", "Hatred breeds hatred.",
            // Spirited Away (River Spirit/Haku)-inspired
            "I am the river.", "My waters run deep.", "I once had a different name.",
            "The pollution clouds my memory...", "I was beautiful once.", "Return what was taken.",
            // General majesty
            "Bow before the depths.", "I am eternal.", "The ocean bows to none.",
            "My scales hold starlight.", "Kingdoms rise and fall; I remain.",
            "The crown of the deep.", "Sovereignty of the tides.", "I speak for the waters.",
            "Lesser beings scatter.", "My presence is a gift.", "The throne of currents.",
            "Witness true power.", "I have outlived empires.", "Majesty needs no words."
        ],
        .silentHungryEerie: [
            // Original
            "...", "Ah... ah...", "Gold...", "Hungry...", "Feed me...", "Lonely...",
            "Empty...", "Want...", "More...", "Darkness...", "Cold...", "Waiting...",
            "Give...", "Shadow...", "Lost...",
            // No-Face inspired
            "Ah... ah...", "Come closer...", "I want...", "So lonely...", "Gold? More gold?",
            "Sen...", "Please...", "I'll give you anything...", "Don't leave me...",
            "Everyone runs...", "Why won't you stay?", "Consume...", "Never enough...",
            // General eerie
            "The void calls...", "Hollow...", "Forgotten...", "Drifting alone...",
            "No one comes here...", "The silence speaks...", "Abandoned...",
            "Where did everyone go?", "So dark...", "I can't remember...",
            "Was I always like this?", "The hunger never stops...", "Empty inside...",
            "Just one bite...", "Stay with me...", "Don't go...", "Please..."
        ],
        .energeticStarlikeFast: [
            // Original
            "Zoom!", "Twinkle!", "Shooting star!", "Catch me!", "Light!", "Speed!",
            "Zap!", "Faster!", "Can't stop!", "Glowing!", "Look at me!", "Whoosh!",
            "Bright!", "Starlight!", "Burning bright!",
            // Kiki's Delivery Service-inspired
            "Flying high!", "The wind carries me!", "Special delivery!", "I can do this!",
            "Believe in yourself!", "Never give up!", "Adventure awaits!",
            // Ponyo-inspired (transformation energy)
            "I'm changing!", "Magic!", "The power of love!", "Nothing can stop me!",
            "Transformation!", "I feel alive!", "The storm is coming!",
            // General energy
            "Lightning fast!", "Zip zap zoom!", "Try to keep up!", "I'm a comet!",
            "Blazing through!", "No time to rest!", "Energy overflow!", "Sparkle sparkle!",
            "Racing the current!", "Unstoppable!", "Born to shine!", "Flash!",
            "Like a firework!", "Supersonic!", "Leaving trails of light!",
            "The fastest in the sea!", "Blink and you'll miss me!"
        ],
        .aggressiveHuntingSharp: [
            // Original
            "Prey...", "Shadows...", "Snap!", "Watching...", "Hunger...", "Darkness...",
            "Closer...", "Hunt.", "Sharp teeth.", "Silent stalker.", "Fear me.", "Blood in the water.",
            "My domain.", "Trespasser.", "Got you.",
            // Princess Mononoke (wolves/boars)-inspired
            "The forest will have revenge.", "Humans are the enemy.", "I smell fear.",
            "The hunt is sacred.", "Iron and fire mean death.", "We will not forgive.",
            "Run, little one.", "The pack is hungry.", "Nature strikes back.",
            // Predator nature
            "I see you hiding...", "Your fear betrays you.", "The weak fall first.",
            "Circling...", "No escape.", "I am the apex.", "Survival of the fittest.",
            "The food chain speaks.", "Instinct.", "Born to hunt.", "Cold efficiency.",
            "You swam into the wrong waters.", "I own these depths.", "Patience... then strike.",
            "The kill is clean.", "Nature is cruel but fair.", "I do what I must."
        ],
        .massiveSlowInsatiable: [
            // Original
            "Gulp.", "Ancient hunger.", "Floating...", "Everything is food.", "Slowly...",
            "Grow...", "Endless...", "Mouth open.", "Drift to me.", "Heavy...", "Big water.",
            "Swallow whole.", "Deep belly.", "River god.", "Mountain of flesh.",
            // Ponyo (Granmamare / ocean mother)-inspired
            "The sea provides.", "I contain multitudes.", "All returns to me.",
            "The depths are infinite.", "I am the ocean's heart.", "Tides obey my will.",
            // Tales from Earthsea / ancient being-inspired
            "I have always been.", "Before the islands rose...", "The first and the last.",
            "Civilizations are but bubbles.", "I remember the beginning.",
            // General massive presence
            "The weight of ages.", "Gravity bends around me.", "I am the leviathan.",
            "Small things scatter.", "My shadow covers all.", "The seafloor trembles.",
            "Immense.", "Unfathomable.", "I am the abyss.", "Pressure builds...",
            "The great filter.", "All flows into me.", "Cosmic hunger.",
            "I dream of the deep.", "My stomach is a cavern.", "Worlds within worlds."
        ],
        .colorfulAndRadiant: [
            // Original
            "Colors!", "Shining bright!", "I am the prism.", "Look at me glow!", "Radiant!",
            "Painting the water.", "Vibrant!", "Hue upon hue.", "Dazzling...", "Spectrum!",
            "Light dances.", "Chromatic.", "A living rainbow.",
            // Howl's Moving Castle (magic/transformation)-inspired
            "A thousand colors!", "Beauty in motion!", "Transformation is art!",
            "Magic made visible!", "Enchantment!", "The spell of color!",
            // Spirited Away (bathhouse lights)-inspired
            "Like lantern light!", "Festival colors!", "The spirits celebrate!",
            "Glowing like the bathhouse!", "Every scale a jewel!",
            // General radiance
            "I am the sunset!", "Aurora!", "Iridescent dreams!", "Kaleidoscope!",
            "Prismatic wonder!", "Light refracts through me!", "A coral garden!",
            "Nature's palette!", "Tropical paradise!", "Neon dreams!",
            "I carry the rainbow!", "Brilliant!", "Luminous!", "Resplendent!",
            "The sea's treasure!", "Gemstone scales!", "Painted by the gods!",
            "Every angle, a new color!", "I am living art!"
        ]
    ]
    
    /// Get a random phrase for a given personality
    static func randomPhrase(for personality: FishPersonality) -> String {
        guard let personalityPhrases = phrases[personality],
              !personalityPhrases.isEmpty else {
            return "Bloop?"
        }
        return personalityPhrases.randomElement() ?? "Bloop?"
    }
    
    /// Get a random phrase for a personality string (fallback for unknown personalities)
    static func randomPhrase(forPersonalityString personality: String) -> String {
        if let fishPersonality = FishPersonality(rawValue: personality) {
            return randomPhrase(for: fishPersonality)
        }
        // Fallback phrases for unknown personalities
        return ["Bloop?", "Hello...", "Splosh.", "Bubble...", "Swim swim."].randomElement() ?? "Bloop?"
    }
}

