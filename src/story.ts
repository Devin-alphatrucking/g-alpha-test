// Story arcs: 3 beats per character. A beat unlocks when friendship reaches NEED[beat].
// Completing a beat plays a dialogue scene with one choice that shapes how the character treats you.
export interface Line {
  who: 'npc' | 'you' | 'note';
  text: string;
}
export interface Option {
  text: string;
  aff: number;
  tag: string; // stored in memory, whitelisted server-side
  mem: string; // how the Journal phrases the memory
  reply: string;
}
export interface Beat {
  title: string;
  item: string;
  reward: number;
  lines: Line[];
  choice: { prompt: string; options: [Option, Option] };
  after: Line[];
}

export const NEED = [10, 30, 60];

const n = (text: string): Line => ({ who: 'npc', text });

export const STORY: Record<string, Beat[]> = {
  maple: [
    {
      title: 'The Lost Recipe', item: 'Recipe card', reward: 90,
      lines: [n("Oh my stars… is that Harold's pie recipe card? I turned the whole house upside down!"), n('It must have slipped into a delivery crate last winter. And you found it for me.')],
      choice: { prompt: 'What do you say?', options: [
        { text: "Always happy to help, Granny.", aff: 6, tag: 'kind', mem: "You said you're always happy to help", reply: "Aren't you a sweetheart. Sit, sit. There's pie." },
        { text: 'Maybe laminate it. Just a thought.', aff: 4, tag: 'joker', mem: 'You suggested laminating the recipe', reply: 'Ha! Laminate it. Harold would have loved you.' },
      ] },
      after: [n("Come by any time. I'll keep a slice warm for you.")],
    },
    {
      title: 'Fair Day', item: 'Pie tin', reward: 140,
      lines: [n('The Town Fair is on Saturday and Rex swears his chilli beats my apple pie. Rubbish!'), n('I need a judge. Someone honest. Someone with a truck.')],
      choice: { prompt: 'Which pie gets your vote?', options: [
        { text: 'Apple, obviously.', aff: 6, tag: 'apple', mem: 'You voted for her apple pie', reply: 'Correct answer. You have taste.' },
        { text: "Cherry, if I'm honest.", aff: 4, tag: 'cherry', mem: 'You voted cherry over apple', reply: "Cherry! Bold. I'll bake one just for you." },
      ] },
      after: [n("Don't tell Rex. He'll say I bribed the judge.")],
    },
    {
      title: 'The Secret Ingredient', item: 'Cinnamon jar', reward: 220,
      lines: [n("Forty years I've kept a secret, and now I'm handing it to you."), n("It's cinnamon from Captain Nemo's old spice route. And a little patience.")],
      choice: { prompt: 'Will you keep the secret?', options: [
        { text: 'Cross my heart.', aff: 6, tag: 'secret', mem: 'You promised to keep her secret', reply: 'I knew I could trust you.' },
        { text: 'Can I tell Rex?', aff: 3, tag: 'tease', mem: 'You teased her about telling Rex', reply: "Don't you dare! …Well. Maybe after the fair." },
      ] },
      after: [n("You're family now, dear. Truly.")],
    },
  ],
  rex: [
    {
      title: 'Blueprint Tube', item: 'Blueprint tube', reward: 90,
      lines: [n("Those are the plans for the new Town Library! Without them I'm building a very expensive shed."), n('You saved my week, mate.')],
      choice: { prompt: 'What do you say?', options: [
        { text: "A library? Count me in for the opening.", aff: 6, tag: 'library', mem: 'You promised to come to the library opening', reply: "You've got a front-row seat, champ." },
        { text: 'A shed would be fine too.', aff: 3, tag: 'shed', mem: 'You joked a shed would be fine', reply: "Ha! Don't give the crew ideas." },
      ] },
      after: [n('Fastest driver in town. I tell everyone.')],
    },
    {
      title: 'Hard Hat Day', item: 'Spare hard hat', reward: 140,
      lines: [n('Safety first! Nobody walks my site without a hard hat. Not even a legend like you.'), n("It's yellow. It's mandatory. It's yours.")],
      choice: { prompt: 'Put it on?', options: [
        { text: 'Obviously.', aff: 6, tag: 'hat', mem: 'You wore the hard hat proudly', reply: 'Looking sharp! Very structural.' },
        { text: 'It clashes with the truck.', aff: 3, tag: 'fashion', mem: 'You said the hat clashes with the truck', reply: "Safety doesn't care about fashion… but it does look good." },
      ] },
      after: [n("The crew voted. You're an honorary foreman.")],
    },
    {
      title: 'Topping Out', item: 'Ceremonial brick', reward: 220,
      lines: [n("The library's roof is on! Tradition says the driver who kept us stocked lays the last brick."), n("That's you. Grab the trowel.")],
      choice: { prompt: 'Where should the brick go?', options: [
        { text: 'Right by the door.', aff: 6, tag: 'door', mem: 'You laid the brick by the library door', reply: 'Perfect. Everyone will see it.' },
        { text: 'Hidden, like a secret.', aff: 4, tag: 'hidden', mem: 'You hid your brick as a secret', reply: 'A secret brick! Maple would approve.' },
      ] },
      after: [n("There'll be a plaque: 'Built with help from the driver.' Not bad, hey?")],
    },
  ],
  pixel: [
    {
      title: 'Mic Check', item: 'Streaming mic', reward: 90,
      lines: [n("That's the mic I ordered three weeks ago! Chat, we are BACK."), n('Okay, real talk: thank you. My old one sounded like a toaster.')],
      choice: { prompt: 'What do you say?', options: [
        { text: 'Say hi to chat for me.', aff: 6, tag: 'hi_chat', mem: 'You said hi to her chat', reply: "Chat says hi back. They're typing 'LEGEND' in all caps." },
        { text: 'Toasters have character.', aff: 4, tag: 'toaster', mem: 'You defended the old toaster mic', reply: 'Ha! Clip that. Clip that!' },
      ] },
      after: [n("You're basically my sponsor now. Unofficially. No money though.")],
    },
    {
      title: 'Subscriber Goal', item: 'Ring light', reward: 140,
      lines: [n('We hit 100 subscribers! A hundred actual humans like my weird face!'), n("I need a ring light for the celebration stream. Can't be a shadow blob.")],
      choice: { prompt: 'How should she celebrate?', options: [
        { text: 'Confetti cannon.', aff: 5, tag: 'confetti', mem: 'You voted for a confetti cannon', reply: 'Chat is going absolutely feral.' },
        { text: 'A quiet thank-you.', aff: 6, tag: 'thanks', mem: 'You suggested a quiet thank-you', reply: "That's actually really sweet. Okay now I'm emotional." },
      ] },
      after: [n('Chat voted you Driver of the Week.')],
    },
    {
      title: 'Road Stream', item: 'Camera mount', reward: 220,
      lines: [n('I want to stream a ride-along. Just you, me, and a camera mount on the dash.'), n("Don't worry, I'll be cool. Mostly.")],
      choice: { prompt: 'Pick the stream title.', options: [
        { text: 'Golden Hour Delivery Run', aff: 6, tag: 'golden', mem: "You named the stream 'Golden Hour Delivery Run'", reply: 'Ooh, catchy. Chat, thumbnails incoming.' },
        { text: 'Pixel Gets Lost', aff: 4, tag: 'lost', mem: "You named the stream 'Pixel Gets Lost'", reply: 'Rude. Accurate. Perfect.' },
      ] },
      after: [n('Best stream ever. Ten out of ten, would ride again.')],
    },
  ],
  doc: [
    {
      title: 'Kitten Carrier', item: 'Kitten carrier', reward: 90,
      lines: [n('Purr-fect timing. This little rescue kitten needs a check-up and a name!'), n("I've been calling her 'Hey You'. She's not impressed.")],
      choice: { prompt: 'Suggest a name.', options: [
        { text: 'Mittens', aff: 6, tag: 'mittens', mem: 'You named the rescue kitten Mittens', reply: "Mittens! She's purring already." },
        { text: 'Captain Floof', aff: 4, tag: 'floof', mem: 'You named the kitten Captain Floof', reply: 'Captain Floof it is. Nemo will be thrilled.' },
      ] },
      after: [n('You have a gift with animals. And with deliveries.')],
    },
    {
      title: 'Night Medicine', item: 'Medicine box', reward: 140,
      lines: [n("A pup down the road needs medicine tonight, and the clinic's run out."), n('Drive safe. But drive quick. Okay, mostly safe.')],
      choice: { prompt: "What do you tell the pup's owner?", options: [
        { text: "Stay calm. Help is coming.", aff: 6, tag: 'calm', mem: 'You kept calm during the emergency', reply: "That's what I'd say. You'd make a great vet." },
        { text: "Lights on, I'm on my way.", aff: 4, tag: 'lights', mem: 'You raced over with your lights on', reply: 'Heroic. Slightly dramatic. I love it.' },
      ] },
      after: [n("The pup's wagging again. Thanks to you.")],
    },
    {
      title: 'Adoption Day', item: 'Adoption papers', reward: 220,
      lines: [n('Mittens has a family! The papers go to them today, and I wanted you here for it.'), n('None of this happens without a driver who shows up.')],
      choice: { prompt: 'Say goodbye to the kitten?', options: [
        { text: 'Give her a gentle pat.', aff: 6, tag: 'pat', mem: 'You said goodbye with a gentle pat', reply: 'She says thank you. In purr.' },
        { text: 'Take a selfie.', aff: 4, tag: 'selfie', mem: 'You took a selfie at adoption day', reply: 'Obviously. This goes on the clinic wall.' },
      ] },
      after: [n('You have a standing invite for tuna sandwiches. For me. Not you.')],
    },
  ],
  cap: [
    {
      title: 'The Sea Chest', item: 'Sea chest', reward: 90,
      lines: [n('Ahoy! My old sea chest has sat in the depot since before you were born.'), n('Smells of salt and old adventures. Pure Darwin, 1978.')],
      choice: { prompt: 'What do you say?', options: [
        { text: 'Tell me about the adventure.', aff: 6, tag: 'story', mem: 'You asked to hear his sea story', reply: 'Ha! Settle in. Tea?' },
        { text: 'It smells like fish.', aff: 3, tag: 'fish', mem: 'You said the chest smells like fish', reply: "That's the finest fish in the southern seas!" },
      ] },
      after: [n("Come back. There's a map in there somewhere.")],
    },
    {
      title: 'Half a Map', item: 'Map fragment', reward: 140,
      lines: [n("Found half a treasure map. The other half's with Granny Maple. Don't ask how."), n('Take this to the fair. And mind the storm.')],
      choice: { prompt: 'What do you think the treasure is?', options: [
        { text: 'Gold, obviously.', aff: 4, tag: 'gold', mem: 'You guessed the treasure was gold', reply: 'Pirates always say gold. Boring!' },
        { text: 'Something better than gold.', aff: 6, tag: 'better', mem: 'You said the treasure is better than gold', reply: "Aye. Now you're thinking like a captain." },
      ] },
      after: [n('Two halves of a map. One honest driver. Perfect.')],
    },
    {
      title: 'Treasure of the Town', item: 'Old compass', reward: 220,
      lines: [n('The map led us here. The treasure is this old lighthouse lamp.'), n("It lit the harbour for sixty years. Now it'll light the town.")],
      choice: { prompt: 'Where should it hang?', options: [
        { text: 'Over the town square.', aff: 6, tag: 'square', mem: 'You hung the lighthouse lamp in the town square', reply: 'Aye, the heart of the town.' },
        { text: 'On top of your house.', aff: 4, tag: 'house', mem: "You wanted the lamp on the captain's house", reply: 'Ha! My neighbours would never sleep.' },
      ] },
      after: [n("Tonight we light the lamp. Everyone's invited. Especially you.")],
    },
  ],
};

export const KEEPSAKE: Record<string, string> = {
  maple: "Harold's Recipe Card",
  rex: 'Golden Hard Hat',
  pixel: 'Pixel’s Mic Charm',
  doc: "Mittens' Collar Bell",
  cap: "Captain's Compass",
};

export const CHAPTERS = [
  { k: 'CHAPTER ONE', t: 'Golden Hour' },
  { k: 'CHAPTER TWO', t: 'Storm Season' },
  { k: 'CHAPTER THREE', t: 'Night Shift' },
  { k: 'CHAPTER FOUR', t: 'Homecoming' },
];
export const chapterOf = (beatsDone: number): number => Math.min(3, Math.floor(beatsDone / 4));

/** tag → Journal sentence, built from the authored options. */
export const TAG_MEM: Record<string, string> = Object.fromEntries(Object.values(STORY).flat().flatMap((b) => b.choice.options.map((o) => [o.tag, o.mem])));
