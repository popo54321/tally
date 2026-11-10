// Fonts, colour slots and the ready-made colour themes, plus the text sizes on offer.

export const FONTS = [
  {key:'min',
   body:"'Archivo',system-ui,sans-serif", display:"'Archivo',system-ui,sans-serif", mono:"'JetBrains Mono',monospace",
   displayWeight:'900', displaySpacing:'-0.5px', displayTransform:'uppercase'},
  {key:'bold',
   body:"'Archivo',system-ui,sans-serif", display:"'Bangers',system-ui,cursive", mono:"'JetBrains Mono',monospace",
   displayWeight:'400', displaySpacing:'1.2px', displayTransform:'uppercase'},
  {key:'zen',
   body:"Georgia,'Noto Serif',serif", display:"Georgia,'Noto Serif',serif", mono:"'JetBrains Mono',monospace",
   displayWeight:'700', displaySpacing:'0.2px', displayTransform:'none'},
  {key:'cyber',
   body:"'JetBrains Mono',monospace", display:"'JetBrains Mono',monospace", mono:"'JetBrains Mono',monospace",
   displayWeight:'700', displaySpacing:'1px', displayTransform:'uppercase'}
];

export const THEME_VARS = [
  {v:'--bg',          def:'#dde6da'},
  {v:'--panel',       def:'#fbfaf7'},
  {v:'--panel-2',     def:'#f0edf4'},
  {v:'--line',        def:'#6b7a68'},
  {v:'--line-soft',   def:'#cfd6ca'},
  {v:'--ink',         def:'#39403a'},
  {v:'--ink-dim',     def:'#51594f'},
  {v:'--ink-faint',   def:'#95a08e'},
  {v:'--brass',       def:'#8a7fb0'},
  {v:'--brass-bright',def:'#a396c9'},
  {v:'--orange',      def:'#b96b80'},
  {v:'--gold',        def:'#e8d5dd'},
  {v:'--on-accent',   def:'#39403a'},
  {v:'--good',        def:'#7fa87f'},
  {v:'--warn',        def:'#cfa25e'},
  {v:'--rust',        def:'#c47b7b'},
  {v:'--sage',        def:'#7fa87f'},
  {v:'--on-bg',       def:'#39403a'}
];

export const THEME_PRESETS = [
  {key:'min',  colors:{
    '--bg':'#e6e6e6','--panel':'#ffffff','--panel-2':'#f4f4f4','--line':'#000000','--line-soft':'#c9c9c9',
    '--ink':'#000000','--ink-dim':'#3d3d3d','--ink-faint':'#767676',
    '--brass':'#000000','--brass-bright':'#2b2b2b','--orange':'#000000','--gold':'#cfcfcf','--on-accent':'#000000',
    '--good':'#2e2e2e','--warn':'#8a8a8a','--rust':'#000000','--sage':'#2e2e2e','--on-bg':'#000000'}},
  {key:'bold', colors:{
    '--bg':'#0d0f14','--panel':'#171a21','--panel-2':'#1f242e','--line':'#333a48','--line-soft':'#262b36',
    '--ink':'#f0f3f8','--ink-dim':'#a8b2c4','--ink-faint':'#6f7a8d',
    '--brass':'#00a2ff','--brass-bright':'#4cc3ff','--orange':'#ff2d2d','--gold':'#ff2d2d','--on-accent':'#ffffff',
    '--good':'#00e676','--warn':'#ffb300','--rust':'#ff1744','--sage':'#00e676','--on-bg':'#f0f3f8'}},
  {key:'zen',  colors:{}},
  {key:'cyber',colors:{
    '--bg':'#000000','--panel':'#08080d','--panel-2':'#101018','--line':'#2a3340','--line-soft':'#181c24',
    '--ink':'#e6faff','--ink-dim':'#8fb8c4','--ink-faint':'#5a7681',
    '--brass':'#00e5ff','--brass-bright':'#66f0ff','--orange':'#ff2bd6','--gold':'#00e5ff','--on-accent':'#000000',
    '--good':'#00ffa3','--warn':'#ffd400','--rust':'#ff2bd6','--sage':'#00ffa3','--on-bg':'#e6faff'}},
  {key:'tact', colors:{
    '--bg':'#3b3f33','--panel':'#d9cfb8','--panel-2':'#c9bfa4','--line':'#2b2e26','--line-soft':'#a89c82',
    '--ink':'#262922','--ink-dim':'#4a4c40','--ink-faint':'#6f7263',
    '--brass':'#5f6a3f','--brass-bright':'#7d8a55','--orange':'#7a5228','--gold':'#b8a271','--on-accent':'#262922',
    '--good':'#5f8a44','--warn':'#b8842b','--rust':'#8f3f2f','--sage':'#5f8a44','--on-bg':'#e2d9c4'}}
];
export const HEXRE = /^#[0-9a-f]{6}$/i;
export const TEXT_SCALES = [0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
