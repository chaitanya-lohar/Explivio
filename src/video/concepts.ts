import {icons, type LucideIcon} from 'lucide-react';

/*
 * Concept → icon and emoji (2026-11-11). Diagram items get a matching icon (Lucide, MIT licence) and each scene a big
 * illustration emoji (Noto Color Emoji in the cloud renderer). A fixed dictionary, checked in order: predictable, no
 * network, no model call. Gemini may also give a scene its own `emoji`, which wins over this.
 */

type Concept = [RegExp, keyof typeof icons, string];

// Word stems (matched at a word start). More specific entries come first.
const CONCEPTS: Concept[] = [
  // Weather, water, earth
  [/\b(rain|precipit|shower|drizzl)/i, 'CloudRain', '🌧️'],
  [/\b(storm|thunder|lightning)/i, 'CloudLightning', '⛈️'],
  [/\b(snow|ice|frozen|freez|glacier)/i, 'Snowflake', '❄️'],
  [/\b(cloud|condens|vapou?r|fog|mist)/i, 'Cloud', '☁️'],
  [/\b(evapor|steam|boil)/i, 'CloudFog', '♨️'],
  [/\b(sun|solar|sunlight|daylight)/i, 'Sun', '☀️'],
  [/\b(heat\b|heating|heated|hot\b|warm|temperatur|thermo)/i, 'Thermometer', '🌡️'],
  [/\b(cool\b|cooling|cold|chill)/i, 'ThermometerSnowflake', '🥶'],
  [/\b(wind|air\b|breeze|atmospher)/i, 'Wind', '🌬️'],
  [/\b(ocean|sea\b|seas\b|lake|wave)/i, 'Ship', '🌊'],
  [/\b(river|stream|flow\b|flows|flowing|runoff)/i, 'Droplets', '🏞️'],
  [/\b(water|droplet|liquid|moist)/i, 'Droplet', '💧'],
  [/\b(volcan|lava|magma|erupt)/i, 'Mountain', '🌋'],
  [/\b(earthquake|tecton|plates?\b|faults?\b)/i, 'Activity', '🌍'],
  [/\b(mountain|hill|rock|stone|crust|mantle|core\b)/i, 'Mountain', '⛰️'],
  [/\b(earth|planet|globe|world)/i, 'Globe', '🌍'],
  [/\b(moon|lunar)/i, 'Moon', '🌙'],
  [/\b(stars?\b|starlight|galax|universe|space|orbit|astronom)/i, 'Orbit', '🪐'],
  [/\b(rocket|launch|nasa)/i, 'Rocket', '🚀'],
  [/\b(climate|weather|season)/i, 'CloudSun', '🌦️'],
  // Life and health
  [/\b(plant|leaf|leaves|tree|forest|photosynth|chlorophyll|flower)/i, 'Leaf', '🌿'],
  [/\b(seed|grow|sprout)/i, 'Sprout', '🌱'],
  [/\b(animal|species|wildlife|evolution)/i, 'PawPrint', '🦊'],
  [/\b(cells?\b|cellular|bacteri|microb|virus|germ)/i, 'Microscope', '🦠'],
  [/\b(dna|genes?\b|genetic|chromosom)/i, 'Dna', '🧬'],
  [/\b(immun|vaccin|antibod|defen[cs]e)/i, 'ShieldCheck', '💉'],
  [/\b(heart|blood|pulse|circulat)/i, 'HeartPulse', '❤️'],
  [/\b(brain|neuro|memory|think|minds?\b|learn)/i, 'Brain', '🧠'],
  [/\b(health|medic|doctor|disease|hospital)/i, 'Stethoscope', '🩺'],
  [/\b(food|nutri|diet|eat\b|eating|vitamin|sugar|glucose)/i, 'Apple', '🍎'],
  [/\b(sleep|rest\b|resting|dream)/i, 'BedDouble', '😴'],
  [/\b(oxygen|breath|lung)/i, 'Wind', '🫁'],
  // Science
  [/\b(atom|molecul|particle|electron|proton|quantum)/i, 'Atom', '⚛️'],
  [/\b(chemi|reaction|acid|compound|element)/i, 'FlaskConical', '🧪'],
  [/\b(electric|current|voltage|circuit|battery|charge)/i, 'Zap', '⚡'],
  [/\b(magnet)/i, 'Magnet', '🧲'],
  [/\b(light\b|photon|laser|ray\b|rays\b)/i, 'Lightbulb', '💡'],
  [/\b(sound|noise|audio|vibrat|hear)/i, 'Volume2', '🔊'],
  [/\b(energy|power|fuel)/i, 'BatteryCharging', '🔋'],
  [/\b(gravity|weight|mass\b|force)/i, 'ArrowDownToLine', '🍏'],
  [/\b(speed|fast\b|faster|velocity|accelerat|motion)/i, 'Gauge', '🏎️'],
  [/\b(math|number|equation|calculat|fraction|geometr|algebra)/i, 'Calculator', '🔢'],
  [/\b(measure|ruler|length|distance)/i, 'Ruler', '📏'],
  [/\b(experiment|tests?\b|testing|lab\b|research|scien)/i, 'Microscope', '🔬'],
  // Technology
  [/\b(ai\b|artificial|machine learning|neural|model\b)/i, 'Bot', '🤖'],
  [/\b(robot|automat)/i, 'Bot', '🤖'],
  [/\b(server|cloud computing|data ?cent)/i, 'Server', '🖥️'],
  [/\b(database|storage|record|table)/i, 'Database', '🗄️'],
  [/\b(network|internet|router|packet|connect)/i, 'Network', '🌐'],
  [/\b(wifi|wireless|signal|radio)/i, 'Wifi', '📶'],
  [/\b(code|program|software|app\b|apps\b|algorithm|function)/i, 'Code', '💻'],
  [/\b(api|request|response|endpoint|middleware)/i, 'Plug', '🔌'],
  [/\b(computer|laptop|device|chip|processor|cpu|gpu)/i, 'Cpu', '💻'],
  [/\b(phone|mobile|smartphone)/i, 'Smartphone', '📱'],
  [/\b(secur|password|encrypt|privacy|lock|hack)/i, 'Lock', '🔒'],
  [/\b(search|find|look ?up|index)/i, 'Search', '🔍'],
  [/\b(user|people|person|team|social|community)/i, 'Users', '👥'],
  [/\b(message|chat|email|mail|send)/i, 'MessageCircle', '💬'],
  [/\b(file|document|page)/i, 'FileText', '📄'],
  [/\b(video|camera|film|photo)/i, 'Video', '🎬'],
  // Society, history, money
  [/\b(money|coin|cash|price|costs?\b|pay\b|payment|bank)/i, 'Coins', '💰'],
  [/\b(inflation|economy|econom|market|trade|stock)/i, 'TrendingUp', '📈'],
  [/\b(business|company|jobs?\b|career)/i, 'Briefcase', '💼'],
  [/\b(factory|industr|manufactur|machine)/i, 'Factory', '🏭'],
  [/\b(city|building|house|home|architect)/i, 'Building', '🏙️'],
  [/\b(cars?\b|vehicle|transport|traffic|road)/i, 'Car', '🚗'],
  [/\b(history|ancient|empire|roman|kings?\b|kingdom|queen|dynasty|war\b|revolution)/i, 'Landmark', '🏛️'],
  [/\b(laws?\b|rules?\b|court|justice|rights?\b)/i, 'Scale', '⚖️'],
  [/\b(govern|politic|democra|vote|election)/i, 'Vote', '🗳️'],
  [/\b(book|read\b|reading|library|story|literat|write|writing)/i, 'BookOpen', '📚'],
  [/\b(school|teach|student|education|lesson)/i, 'GraduationCap', '🎓'],
  [/\b(art\b|arts\b|artist|artwork|paint|music|song|creative)/i, 'Palette', '🎨'],
  [/\b(maps?\b|travel|journey|explor|countr)/i, 'Map', '🗺️'],
  [/\b(time\b|clock|hour|minute|year|century|dates?\b)/i, 'Clock', '⏰'],
  [/\b(idea|insight|discover|invent)/i, 'Lightbulb', '💡'],
  [/\b(goal|target|aim\b|focus)/i, 'Target', '🎯'],
  [/\b(question)/i, 'CircleQuestionMark', '❓'],
  [/\b(increase|rises?\b|rising|more\b)/i, 'TrendingUp', '📈'],
  [/\b(decrease|falls?\b|falling|drops?\b|less\b|decline)/i, 'TrendingDown', '📉'],
  [/\b(cycle|repeat|loop|again)/i, 'RefreshCw', '🔄'],
  [/\b(step|process|stage|phase)/i, 'ListOrdered', '🪜'],
  [/\b(warn|risk|danger|problem|error)/i, 'TriangleAlert', '⚠️'],
  [/\b(success|done|finish|result|output)/i, 'CircleCheck', '✅'],
];

function find(text: string): Concept | undefined {
  return CONCEPTS.find(([pattern, icon]) => pattern.test(text) && icons[icon]);
}

/** The icon for a diagram label, or null when nothing fits (then the template draws its usual dot/number). */
export function iconFor(label: string): LucideIcon | null {
  const concept = find(label);
  return concept ? icons[concept[1]] : null;
}

const EMOJI = /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;
export const isEmoji = (value: unknown): value is string => typeof value === 'string' && value.length <= 16 && EMOJI.test(value.trim());

/** The scene's illustration: its own `emoji` if valid, else one from its texts (heading first), else 💡. */
export function emojiFor(own: unknown, ...texts: (string | undefined)[]): string {
  if (isEmoji(own)) return own.trim();
  for (const text of texts) {
    if (!text) continue;
    const concept = find(text);
    if (concept) return concept[2];
  }
  return '💡';
}
