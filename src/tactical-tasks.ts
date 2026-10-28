// Original compact schematic task graphics; not a substitute for doctrinal multipoint overlays.
export const tacticalTasks=['Fix','Disrupt','Block','Delay','Isolate','Neutralise','Occupy','Secure','Seize','Attack by fire','Support by fire','Breach','Clear','Destroy','Follow and assume','Follow and support'] as const;
export function taskArtwork(task:string):string {
 const text=(value:string,x=50,y=43)=>`<text x="${x}" y="${y}" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-weight="700" font-size="15">${value}</text>`;
 const circle='<circle cx="50" cy="38" r="21"/>';
 switch(task){
  case 'Fix':return '<path d="M13 38h24m-8-7 8 7-8 7M87 38H63m8-7-8 7 8 7M50 14v48"/>'+text('F',50,11);
  case 'Disrupt':return '<path d="M12 53l17-30 14 30 14-30 17 30M68 47l6 6 2-10"/>'+text('D',86,36);
  case 'Block':return '<path d="M18 38h56M64 27l11 11-11 11M77 17v42"/>'+text('B',30,27);
  case 'Delay':return '<path d="M15 51l18-26 17 26 18-26 16 26M72 47l12 4-1-12"/>'+text('D',50,17);
  case 'Isolate':return '<circle cx="50" cy="38" r="23" stroke-dasharray="7 4"/><path d="M50 8v14m-5-6 5 6 5-6M20 38h15m-6-5 6 5-6 5M80 38H65m6-5-6 5 6 5M50 68V54m-5 6 5-6 5 6"/>';
  case 'Neutralise':return circle+text('N');
  case 'Occupy':return circle+text('O');
  case 'Secure':return circle+text('S');
  case 'Seize':return '<path d="M50 13a25 25 0 1 1-25 25M15 37l10-9 8 10"/>'+text('S');
  case 'Attack by fire':return '<path d="M15 54l35-30 35 30M50 24v32M42 34l8-10 8 10"/>'+text('ABF',50,15);
  case 'Support by fire':return '<path d="M15 54l35-30 35 30M50 24v32M42 34l8-10 8 10"/>'+text('SBF',50,15);
  case 'Breach':return '<path d="M17 20h24v36H17M83 20H59v36h24M20 38h60M70 30l10 8-10 8"/>'+text('B',50,12);
  case 'Clear':return '<path d="M18 20v36h64V20M30 47l38-22m-12 0 12 0-5 11"/>'+text('C',50,16);
  case 'Destroy':return '<path d="M25 13l50 50M75 13L25 63"/>'+text('D');
  case 'Follow and assume':return '<path d="M15 38h65M69 27l11 11-11 11M35 22v32"/>'+text('A',50,16);
  case 'Follow and support':return '<path d="M15 38h65M69 27l11 11-11 11M35 22v32"/>'+text('S',50,16);
  default:return text('?');
 }
}
