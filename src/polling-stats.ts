export function pollingStats(times:readonly number[]){
 const ordered=[...new Set(times.filter(Number.isFinite))].sort((a,b)=>a-b);
 if(ordered.length<2)return null;
 const span=ordered.at(-1)!-ordered[0];if(span<=0)return null;
 const gaps=ordered.slice(1).map((t,i)=>t-ordered[i]).sort((a,b)=>a-b);
 return {samples:ordered.length,hz:(ordered.length-1)*1000/span,medianMs:gaps[Math.floor(gaps.length/2)],p95Ms:gaps[Math.min(gaps.length-1,Math.floor(gaps.length*.95))]};
}
