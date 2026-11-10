export const SEASONS=['All-season','Spring','Summer','Fall','Winter'];
export const seasonOf=shoe=>SEASONS.includes(shoe?.season)?shoe.season:'All-season';
export const matchesSeason=(shoe,filter)=>filter==='Any season'||seasonOf(shoe)===filter;
const drawings={
  'All-season':'M12 3a9 9 0 1 0 9 9 M12 3v9h9 M16 3v2 M20 6l-2 1 M21 10h2',
  Spring:'M12 12c-8-1-7-7-3-6-2-6 6-6 6 0 5-2 7 5 0 6 M12 12v10 M12 19c-5 0-6-3-6-3 4-1 6 1 6 3 M12 16c4 0 6-3 6-3-4-1-6 1-6 3',
  Summer:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
  Fall:'M20 3C6 2 2 8 5 15c5 7 14 2 15-12Z M3 21 15 9 M7 17v-5 M11 13h5',
  Winter:'M12 2v20 M3.34 7l17.32 10 M3.34 17l17.32-10 M9 4l3 3 3-3 M9 20l3-3 3 3 M3 10l4-1-1-4 M18 19l-1-4 4-1 M3 14l4 1-1 4 M18 5l-1 4 4 1'
};
export function seasonIcon(season){
  return `<svg class="icon season-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${drawings[season]||drawings['All-season']}"/></svg>`;
}
