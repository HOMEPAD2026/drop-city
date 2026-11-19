// street-turf.js — walking (or driving) into one of the city's four sides says whose turf it is: the side's name and the
// coin that holds it (the four biggest coins by market cap, city.js setTurf), with its colour on the ground and its logo
// over the rooftops. A visit counts toward nothing; it's a way to see who runs the city.
export function streetTurf(A) {
  const { S, city, hooks } = A;
  let cur = null, t = 0;
  const el = document.getElementById("turf");
  hooks.step.push((dt) => {
    if ((t += dt) < 0.4) return; t = 0;
    const z = city.turfAt(S.pos.x, S.pos.z), key = z && z.coin ? z.name + z.coin.mint : z ? z.name : "";
    if (key === cur) return; cur = key;
    if (el) { el.hidden = !z; if (z) { const col = "#" + z.color.toString(16).padStart(6, "0"); el.style.setProperty("--tc", col); el.innerHTML = `<small>${z.name}</small><b>${z.coin ? "$" + String(z.coin.symbol).replace(/[<>&]/g, "") + " TURF" : "NO ONE'S TURF"}</b>`; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); } }
    if (z && z.coin) A.sound("tick");
  });
}
