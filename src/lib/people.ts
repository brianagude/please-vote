// The background people on a state's guide come from that state's own set
// (public/people/<code>/, drawn by scripts/make-people.mjs), where some signs
// show the state's name. These rules repeat the ones in global.css with the
// state's folder, and come later on the page, so they win.
export function peopleCss(code: string) {
  const u = (f: string) => `url("/people/${code}/${f}.svg")`;
  // The animations get their own names ("boil-l-ny"), so they can never mix with the generic set's frames.
  const boil = (name: string, side: string) =>
    `@keyframes ${name}-${code}{0%{background-image:${u(`${side}-0`)}}33%{background-image:${u(`${side}-1`)}}66%{background-image:${u(`${side}-2`)}}}`;
  return [
    `@media (min-width:1120px){body::before{background-image:${u("left-0")}}body::after{background-image:${u("right-0")}}}`,
    `.strip-top{background-image:${u("top-0")}}.strip-bottom{background-image:${u("bottom-0")}}`,
    `@media (min-width:1120px) and (prefers-reduced-motion:no-preference){.boil body::before{animation-name:boil-l-${code}}.boil body::after{animation-name:boil-r-${code}}}`,
    `@media (max-width:1119px) and (prefers-reduced-motion:no-preference){.boil .strip-top{animation-name:boil-t-${code}}.boil .strip-bottom{animation-name:boil-b-${code}}}`,
    boil("boil-l", "left"),
    boil("boil-r", "right"),
    boil("boil-t", "top"),
    boil("boil-b", "bottom"),
  ].join("\n");
}
