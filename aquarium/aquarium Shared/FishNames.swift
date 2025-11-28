import Foundation

// MARK: - Fish Names (Ghibli-inspired)
// These names are used when a fish is created, matching the JS version
// Expanded with characters from all Studio Ghibli films

struct FishNames {
    static let fallbackNames = [
        // Spirited Away
        "Chihiro", "Haku", "Yubaba", "Kamaji", "Lin", "No-Face", "Zeniba", "Boh",
        "Aogaeru", "Bandai-gaeru", "Chichiyaku", "Aniyaku", "Kashira", "Radish Spirit",
        "River Spirit", "Susuwatari", "Kohaku", "Sen", "Rin",
        
        // My Neighbor Totoro
        "Totoro", "Satsuki", "Mei", "Catbus", "Chibi-Totoro", "Chu-Totoro",
        "Tatsuo", "Yasuko", "Granny", "Kanta", "Makkuro", "Kurosuke",
        
        // Kiki's Delivery Service
        "Kiki", "Jiji", "Tombo", "Osono", "Fukuo", "Ursula", "Ket", "Barsa", "Madame",
        
        // Ponyo
        "Ponyo", "Sosuke", "Fujimoto", "Granmamare", "Lisa", "Koichi",
        "Yoshie", "Noriko", "Kumiko", "Karen", "Toki", "Brunhilde",
        
        // Howl's Moving Castle
        "Sophie", "Howl", "Calcifer", "Markl", "Turnip", "Heen", "Lettie",
        "Honey", "Suliman", "Witch of the Waste", "Jenkins", "Pendragon",
        
        // Princess Mononoke
        "San", "Ashitaka", "Yakul", "Moro", "Okami", "Nago", "Okkoto",
        "Gonza", "Eboshi", "Jigo", "Kaya", "Hii-sama", "Kohroku",
        "Kodama", "Shishigami", "Nightwalker",
        
        // Nausicaä of the Valley of the Wind
        "Nausicaa", "Teto", "Lord Yupa", "Asbel", "Kushana", "Kurotowa",
        "Mito", "Gol", "Gikkuri", "Obaba", "Jihl", "Lastelle",
        
        // Castle in the Sky
        "Sheeta", "Pazu", "Dola", "Charles", "Louis", "Henri", "Motro",
        "Muska", "Uncle Pom", "Kelly", "Mina", "Shalulu", "Romska",
        
        // The Cat Returns
        "Baron", "Muta", "Haru", "Toto", "Lune", "Yuki", "Natori",
        "Cat King", "Natoru", "Hiromi",
        
        // Whisper of the Heart
        "Shizuku", "Seiji", "Nao", "Moon", "Shiho", "Asako", "Kosaka",
        
        // Arrietty
        "Arrietty", "Spiller", "Pod", "Homily", "Sho", "Hara", "Sadako",
        
        // When Marnie Was There
        "Marnie", "Anna", "Setsu", "Kiyomasa", "Sayaka", "Hisako", "Toichi",
        
        // From Up on Poppy Hill
        "Umi", "Shun", "Sora", "Riku", "Sachiko", "Miki", "Shirou",
        
        // Tales from Earthsea
        "Arren", "Therru", "Sparrowhawk", "Ged", "Tenar", "Tehanu", "Cob", "Hare",
        "Lebannen", "Haitaka", "Kumo",
        
        // The Wind Rises
        "Jiro", "Nahoko", "Caproni", "Castorp", "Honjo", "Kayo", "Hattori",
        "Kurokawa", "Satomi", "Kinu",
        
        // Porco Rosso
        "Porco", "Marco", "Gina", "Fio", "Curtis", "Piccolo", "Mamma Aiuto",
        
        // Grave of the Fireflies
        "Seita", "Setsuko", "Obasan",
        
        // Pom Poko
        "Shoukichi", "Okiyo", "Seizaemon", "Oroku", "Gonta", "Tamasaburo",
        "Ponkichi", "Koharu", "Bunta", "Hayashi",
        
        // Ocean Waves
        "Taku", "Rikako", "Yutaka", "Shimizu", "Okada",
        
        // The Tale of the Princess Kaguya
        "Kaguya", "Sutemaru", "Sanuki", "Ona", "Sagami", "Ishitsukuri",
        "Kuramochi", "Abe", "Otomo", "Mikado",
        
        // My Neighbors the Yamadas
        "Takashi", "Matsuko", "Noboru", "Nonoko", "Shige", "Nozomi",
        
        // Additional nature/spirit-inspired names
        "Sakura", "Yuki", "Hana", "Sora", "Ame", "Kaze", "Mizu", "Tsuki",
        "Hoshi", "Kumo", "Nami", "Umi", "Yama", "Mori", "Kawa", "Taki",
        "Hotaru", "Cho", "Tori", "Kitsune", "Tanuki", "Usagi", "Kuma",
        "Shika", "Ryu", "Tatsu", "Hebi", "Koi", "Kingyo", "Medaka",
        
        // Mythological/spiritual names
        "Inari", "Amaterasu", "Susanoo", "Tsukuyomi", "Raijin", "Fujin",
        "Benzaiten", "Ebisu", "Daikoku", "Bishamon", "Hotei", "Jurojin",
        "Kannon", "Jizo", "Tengu", "Kappa", "Oni", "Yurei", "Yokai",
        
        // Seasonal names
        "Haruki", "Natsuki", "Akiko", "Fuyuko", "Koharu", "Konatsu",
        "Chiaki", "Mafuyu", "Hazuki", "Uzuki", "Satsuki", "Minazuki"
    ]
    
    static func randomName() -> String {
        return fallbackNames.randomElement() ?? "Spirit"
    }
}

