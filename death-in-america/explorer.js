/* Death in America: county cause-of-death explorer.
   Shared engine for the 1980-2014 and 2000-2019 IHME pages.
   Page sets window.EXPLORER = { dataDir, geo, defaultCause, defaultYear, rateNote } before loading this file. */
(function () {
  "use strict";
  const CFG = window.EXPLORER;
  const $ = (id) => document.getElementById(id);
  const fmtN = (v) => {
    if (v == null || isNaN(v)) return "n/a";
    if (v >= 100) return Math.round(v).toLocaleString("en-US");
    if (v >= 10) return v.toFixed(1);
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(2);
  };
  const fmtPct = (p) => (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(0) + "%";

  // Palettes: sequential blue (light to dark), and blue/red diverging with a gray midpoint.
  // Dark mode uses its own steps so that higher values read as brighter against the dark surface.
  const PAL = {
    light: {
      seq: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
      div: ["#184f95", "#5598e7", "#b7d3f6", "#f0efec", "#f5c2bb", "#e6766b", "#b42b2a"],
    },
    dark: {
      seq: ["#0d366b", "#104281", "#1c5cab", "#2a78d6", "#5598e7", "#86b6ef", "#cde2fb"],
      div: ["#86b6ef", "#3987e5", "#1c4f8a", "#383835", "#8a2f2b", "#d0473f", "#f19a90"],
    },
  };
  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const isDark = () => {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return !!(darkQuery && darkQuery.matches);
  };
  const pal = () => (isDark() ? PAL.dark : PAL.light);
  const NODATA = () => getComputedStyle(document.documentElement).getPropertyValue("--nodata").trim() || "#d4d4d0";

  const CHANGE_EDGES = [-50, -25, -10, 10, 50, 100];
  const CHANGE_LABELS = ["Fell 50% or more", "Fell 25 to 50%", "Fell 10 to 25%", "Within 10%", "Rose 10 to 50%", "Rose 50 to 100%", "Doubled or more"];

  // Reference cities (approximate city-center coordinates) for orientation only.
  const CITIES = [
    ["Seattle", -122.33, 47.61], ["Portland", -122.68, 45.52], ["San Francisco", -122.42, 37.77], ["Los Angeles", -118.24, 34.05],
    ["Las Vegas", -115.14, 36.17], ["Phoenix", -112.07, 33.45], ["Salt Lake City", -111.89, 40.76], ["Denver", -104.99, 39.74],
    ["Albuquerque", -106.65, 35.08], ["Billings", -108.5, 45.78], ["Fargo", -96.79, 46.88], ["Minneapolis", -93.27, 44.98],
    ["Kansas City", -94.58, 39.1], ["Dallas", -96.8, 32.78], ["Houston", -95.37, 29.76], ["New Orleans", -90.07, 29.95],
    ["Chicago", -87.63, 41.88], ["Detroit", -83.05, 42.33], ["Nashville", -86.78, 36.16], ["Atlanta", -84.39, 33.75],
    ["Miami", -80.19, 25.76], ["Washington", -77.04, 38.91], ["New York", -74.01, 40.71], ["Boston", -71.06, 42.36],
    ["Anchorage", -149.9, 61.22], ["Honolulu", -157.86, 21.31],
  ];

  const S = {
    idx: null, topo: null, cause: CFG.defaultCause || 294, yi: 0, mode: "rate",
    sel: null, cache: {}, data: null, playing: false, timer: null, rankView: "high",
    fipsPos: {}, groupOf: {}, paths: null, zoom: null, svg: null, gZoom: null, path: null, features: null,
  };

  // ---------- helpers ----------
  const ny = () => S.idx.years.length;
  const val = (i, yi) => S.data.v[i * ny() + yi];
  const lo = (i, yi) => S.data.lo[i * ny() + yi];
  const hi = (i, yi) => S.data.hi[i * ny() + yi];
  const causeMeta = (id) => S.idx.causes.find((c) => c.id === id);
  const stateName = (f) => S.idx.states[f.slice(0, 2)] || "";
  const stateAbbr = (f) => ABBR[f.slice(0, 2)] || "";
  const ABBR = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };
  const countyLabel = (f) => S.idx.names[S.fipsPos[f]] + ", " + stateAbbr(f);

  function nice(x) {
    if (x <= 0) return 0;
    const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    return Math.round(x / p) * p;
  }
  function rateEdges(meta) {
    const q = meta.q;
    const raw = [q["0.1"], q["0.25"], q["0.5"], q["0.75"], q["0.9"], q["0.95"]];
    const out = [];
    raw.forEach((x) => {
      let n = nice(x);
      if (out.length && n <= out[out.length - 1]) n = nice(out[out.length - 1] * 1.08 + 1e-9);
      out.push(n);
    });
    return out;
  }
  function binOf(v, edges) {
    let b = 0;
    while (b < edges.length && v >= edges[b]) b++;
    return b;
  }
  function pctChange(i) {
    const a = val(i, 0), b = val(i, S.yi);
    if (a == null || b == null || a === 0) return null;
    return (b / a - 1) * 100;
  }
  function colorFor(i) {
    if (S.mode === "rate") {
      const v = val(i, S.yi);
      if (v == null) return NODATA();
      return pal().seq[binOf(v, S.edges)];
    }
    const p = pctChange(i);
    if (p == null) return NODATA();
    return pal().div[binOf(p, CHANGE_EDGES)];
  }

  // ---------- data ----------
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }
  async function loadCause(id) {
    if (!S.cache[id]) S.cache[id] = getJSON(CFG.dataDir + "c" + id + ".json");
    return S.cache[id];
  }

  // ---------- URL state ----------
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const c = parseInt(h.get("cause"), 10);
    if (c && causeMeta(c)) S.cause = c;
    const y = parseInt(h.get("year"), 10);
    const yi = S.idx.years.indexOf(y);
    S.yi = yi >= 0 ? yi : (CFG.defaultYear ? Math.max(0, S.idx.years.indexOf(CFG.defaultYear)) : ny() - 1);
    if (h.get("view") === "change") S.mode = "change";
    const f = h.get("county");
    if (f && S.fipsPos[f] != null) S.sel = f;
  }
  function writeHash() {
    const h = new URLSearchParams();
    h.set("cause", S.cause);
    h.set("year", S.idx.years[S.yi]);
    if (S.mode === "change") h.set("view", "change");
    if (S.sel) h.set("county", S.sel);
    history.replaceState(null, "", "#" + h.toString());
  }

  // ---------- cause list ----------
  function causeOrder() {
    const last = ny() - 1;
    const nat = (c) => S.idx.national[String(c.id)][last] || 0;
    const overall = S.idx.causes.filter((c) => c.group === "Overall");
    const broad = S.idx.causes.filter((c) => c.group === "Broad groups");
    const specific = S.idx.causes.filter((c) => c.group !== "Overall" && c.group !== "Broad groups").sort((a, b) => nat(b) - nat(a));
    return { overall, broad, specific };
  }
  function buildCauseList() {
    const ul = $("causeList"), sel = $("causeSelect");
    ul.innerHTML = ""; sel.innerHTML = "";
    const o = causeOrder();
    const add = (c) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "cause-btn"; b.type = "button"; b.dataset.id = c.id;
      b.innerHTML = '<span class="nm"></span><span class="rate"></span>';
      b.querySelector(".nm").textContent = c.name;
      b.title = c.group === "Overall" || c.group === "Broad groups" ? c.name : c.name + " (" + c.group + ")";
      b.onclick = () => setCause(c.id);
      li.appendChild(b); ul.appendChild(li);
    };
    const sep = (t) => { const li = document.createElement("li"); li.className = "sep"; li.textContent = t; ul.appendChild(li); };
    o.overall.forEach(add);
    sep("Broad groups"); o.broad.forEach(add);
    sep("Specific causes, ordered by US rate in " + S.idx.years[ny() - 1]); o.specific.forEach(add);
    const og = (label, list) => {
      const g = document.createElement("optgroup"); g.label = label;
      list.forEach((c) => { const op = document.createElement("option"); op.value = c.id; op.textContent = c.name; g.appendChild(op); });
      sel.appendChild(g);
    };
    og("Overall", o.overall); og("Broad groups", o.broad); og("Specific causes", o.specific);
    sel.onchange = () => setCause(parseInt(sel.value, 10));
  }
  function updateCauseList() {
    const y = S.idx.years[S.yi];
    document.querySelectorAll(".cause-btn").forEach((b) => {
      const id = parseInt(b.dataset.id, 10);
      b.classList.toggle("on", id === S.cause);
      b.setAttribute("aria-pressed", id === S.cause ? "true" : "false");
      b.querySelector(".rate").textContent = fmtN(S.idx.national[String(id)][S.yi]);
    });
    $("causeSelect").value = S.cause;
    $("listHint").textContent = "US rate per 100,000, " + y + ", shown beside each cause.";
  }

  // ---------- map ----------
  function buildMap() {
    const W = 975, H = 610;
    const svg = d3.select("#map").attr("viewBox", [0, 0, W, H]).attr("role", "img");
    const counties = topojson.feature(S.topo, S.topo.objects.counties).features.filter((f) => S.fipsPos[f.id] != null);
    const proj = d3.geoAlbersUsa().fitExtent([[10, 10], [W - 10, H - 10]], topojson.feature(S.topo, S.topo.objects.nation));
    const path = d3.geoPath(proj);
    S.path = path; S.features = counties; S.proj = proj;
    const g = svg.append("g");
    S.gZoom = g;
    S.paths = g.append("g").selectAll("path").data(counties).join("path")
      .attr("class", "county").attr("d", path)
      .on("mousemove", (e, f) => { S.hover = f.id; showTip(e, f.id); })
      .on("mouseleave", () => { S.hover = null; hideTip(); })
      .on("click", (e, f) => { e.stopPropagation(); selectCounty(f.id === S.sel ? null : f.id, true); });
    g.append("path").attr("class", "states")
      .attr("d", path(topojson.mesh(S.topo, S.topo.objects.states, (a, b) => a !== b)));
    S.selPath = g.append("path").attr("class", "sel");
    const cg = g.append("g").attr("class", "city");
    CITIES.forEach(([n, lon, lat]) => {
      const p = proj([lon, lat]); if (!p) return;
      const k = cg.append("g").attr("transform", `translate(${p[0]},${p[1]})`);
      k.append("circle").attr("r", 2.2);
      k.append("text").attr("x", 4).attr("y", -3).text(n);
    });
    S.cityG = cg;
    S.zoom = d3.zoom().scaleExtent([1, 14]).translateExtent([[0, 0], [W, H]])
      .filter((e) => (e.type === "wheel" ? e.ctrlKey || e.metaKey : !e.button))
      .on("zoom", (e) => {
        g.attr("transform", e.transform);
        cg.selectAll("g").each(function () {
          const t = d3.select(this).attr("transform").replace(/ scale\([^)]*\)/, "");
          d3.select(this).attr("transform", t + ` scale(${1 / e.transform.k})`);
        });
      });
    svg.call(S.zoom).on("dblclick.zoom", null);
    svg.on("click", () => selectCounty(null, false));
    S.svg = svg; S.W = W; S.H = H;
    $("zIn").onclick = () => svg.transition().duration(300).call(S.zoom.scaleBy, 1.8);
    $("zOut").onclick = () => svg.transition().duration(300).call(S.zoom.scaleBy, 1 / 1.8);
    $("zReset").onclick = () => svg.transition().duration(500).call(S.zoom.transform, d3.zoomIdentity);
  }
  function zoomTo(f) {
    const feat = S.features.find((x) => x.id === f);
    if (!feat) return;
    const [[x0, y0], [x1, y1]] = S.path.bounds(feat);
    const k = Math.min(4.5, 0.3 / Math.max((x1 - x0) / S.W, (y1 - y0) / S.H));
    const kk = Math.max(2, k);
    S.svg.transition().duration(650).call(S.zoom.transform,
      d3.zoomIdentity.translate(S.W / 2, S.H / 2).scale(kk).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }
  function paint() {
    S.paths.attr("fill", (f) => colorFor(S.fipsPos[f.id]));
    const feat = S.sel && S.features.find((x) => x.id === S.sel);
    S.selPath.attr("d", feat ? S.path(feat) : null);
  }

  // ---------- legend + stats ----------
  function drawLegend() {
    const L = $("legend");
    const m = causeMeta(S.cause);
    let h = "";
    if (S.mode === "rate") {
      const e = S.edges, c = pal().seq;
      h += `<div class="ttl">${esc(m.name)}: deaths per 100,000, age-standardized. Same scale for every year.</div><div class="ramp">`;
      for (let b = 0; b < 7; b++) h += `<i style="background:${c[b]}"></i>`;
      h += `<div class="ticks">`;
      e.forEach((x, k) => { h += `<span style="left:${((k + 1) / 7) * 100}%">${fmtN(x)}</span>`; });
      h += `</div>`;
    } else {
      const c = pal().div;
      h += `<div class="ttl">${esc(m.name)}: change in each county's rate, ${S.idx.years[0]} to ${S.idx.years[S.yi]}. Blue means the rate fell; red means it rose.</div><div class="ramp">`;
      for (let b = 0; b < 7; b++) h += `<i style="background:${c[b]}"></i>`;
      h += `<div class="ticks">`;
      CHANGE_EDGES.forEach((x, k) => { h += `<span style="left:${((k + 1) / 7) * 100}%">${x > 0 ? "+" : x < 0 ? "\u2212" : ""}${Math.abs(x)}%</span>`; });
      h += `</div>`;
    }
    h += `</div><div class="nd"><i></i><span>No estimate</span></div>`;
    L.innerHTML = h;
  }
  function yearValues(yi) {
    const out = [];
    for (let i = 0; i < S.idx.fips.length; i++) { const v = val(i, yi); if (v != null) out.push(v); }
    return out.sort((a, b) => a - b);
  }
  const quant = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : null;
  function drawStats() {
    const y = S.idx.years[S.yi];
    const m = causeMeta(S.cause);
    const nat = S.idx.national[String(S.cause)];
    $("causeTitle").textContent = m.name;
    $("yearBig").textContent = y;
    const n0 = nat[0], n1 = nat[S.yi];
    let hs = `United States, ${y}: <strong>${fmtN(n1)}</strong> deaths per 100,000`;
    if (S.yi > 0 && n0) hs += ` (${fmtPct((n1 / n0 - 1) * 100)} since ${S.idx.years[0]})`;
    hs += ".";
    $("headline").innerHTML = hs;
    const vals = yearValues(S.yi);
    const nMiss = S.idx.fips.length - vals.length;
    let st = `Across ${vals.length.toLocaleString("en-US")} counties in ${y}: median ${fmtN(quant(vals, 0.5))}; middle 80% of counties ${fmtN(quant(vals, 0.1))} to ${fmtN(quant(vals, 0.9))}; lowest ${fmtN(vals[0])}; highest ${fmtN(vals[vals.length - 1])}. County figures are unweighted, so small counties count the same as large ones.`;
    if (nMiss) st += ` ${nMiss} counties have no published estimate and are shown in gray.`;
    $("stats").textContent = st;
  }

  // ---------- tooltip ----------
  const tip = () => $("tip");
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function countyHTML(f) {
    const i = S.fipsPos[f];
    const y = S.idx.years[S.yi];
    const v = val(i, S.yi);
    let h = `<b>${esc(S.idx.names[i])}</b>, ${esc(stateName(f))}<br>`;
    if (v == null) {
      h += `<span class="s">IHME did not publish an estimate for this county.</span>`;
      return h;
    }
    h += `<span class="v">${fmtN(v)}</span> <span class="s">per 100,000 in ${y}</span><br>`;
    h += `<span class="s">95% uncertainty interval ${fmtN(lo(i, S.yi))} to ${fmtN(hi(i, S.yi))}</span>`;
    const p = pctChange(i);
    if (S.yi > 0 && p != null) h += `<br><span class="s">${fmtPct(p)} since ${S.idx.years[0]} (${fmtN(val(i, 0))})</span>`;
    const g = S.groupOf[f];
    if (g) h += `<br><span class="s">Estimated jointly with ${esc(g)}; they share one rate.</span>`;
    return h;
  }
  function showTip(e, f) {
    const t = tip();
    t.innerHTML = countyHTML(f);
    t.hidden = false;
    const pad = 14, r = t.getBoundingClientRect();
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + r.width > window.innerWidth - 6) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 6) y = e.clientY - r.height - pad;
    t.style.left = Math.max(6, x) + "px"; t.style.top = Math.max(6, y) + "px";
  }
  function hideTip() { tip().hidden = true; }

  // ---------- trend chart ----------
  function drawTrend() {
    const svg = d3.select("#trend");
    svg.selectAll("*").remove();
    const narrow = (svg.node().clientWidth || 640) < 520;
    const W = narrow ? 420 : 640, H = narrow ? 250 : 270, m = { t: 12, r: narrow ? 92 : 108, b: 28, l: 40 };
    svg.attr("viewBox", [0, 0, W, H]);
    const Y = S.idx.years;
    const x = d3.scaleLinear().domain([Y[0], Y[Y.length - 1]]).range([m.l, W - m.r]);
    // middle 80% band across counties
    const band = Y.map((_, yi) => { const v = yearValues(yi); return [quant(v, 0.1), quant(v, 0.9)]; });
    const nat = S.idx.national[String(S.cause)];
    const series = [];
    if (S.sel) {
      const i = S.fipsPos[S.sel];
      series.push({ key: "county", name: countyLabel(S.sel), color: "var(--s-county)", v: Y.map((_, yi) => val(i, yi)), lo: Y.map((_, yi) => lo(i, yi)), hi: Y.map((_, yi) => hi(i, yi)) });
      const sf = S.sel.slice(0, 2);
      const stv = S.idx.state[sf] && S.idx.state[sf][String(S.cause)];
      if (stv) series.push({ key: "state", name: stateName(S.sel), color: "var(--s-state)", v: stv });
    }
    series.push({ key: "us", name: "United States", color: "var(--s-us)", v: nat });
    let maxV = d3.max(band, (d) => d[1]) || 0;
    series.forEach((s) => { maxV = Math.max(maxV, d3.max(s.hi || s.v) || 0); });
    const y = d3.scaleLinear().domain([0, maxV * 1.06]).nice().range([H - m.b, m.t]);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(5)).join("line")
      .attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format("d")).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    const area = d3.area().defined((d) => d[0] != null && d[1] != null).x((_, k) => x(Y[k])).y0((d) => y(d[0])).y1((d) => y(d[1]));
    svg.append("path").attr("d", area(band)).attr("fill", "var(--band)");
    const line = d3.line().defined((d) => d != null).x((_, k) => x(Y[k])).y((d) => y(d));
    svg.append("line").attr("class", "yr").attr("x1", x(Y[S.yi])).attr("x2", x(Y[S.yi])).attr("y1", m.t).attr("y2", H - m.b);
    series.slice().reverse().forEach((s) => {
      if (s.lo) svg.append("path").attr("d", area(s.lo.map((l, k) => [l, s.hi[k]]))).attr("fill", "var(--ui-band)");
      svg.append("path").attr("d", line(s.v)).attr("fill", "none").attr("stroke", s.color).attr("stroke-width", 2).attr("stroke-linejoin", "round");
    });
    // direct labels at right end, nudged apart
    const ends = series.map((s) => { let k = s.v.length - 1; while (k > 0 && s.v[k] == null) k--; return { s, k, yy: s.v[k] == null ? null : y(s.v[k]) }; }).filter((d) => d.yy != null).sort((a, b) => a.yy - b.yy);
    for (let k = 1; k < ends.length; k++) if (ends[k].yy - ends[k - 1].yy < 13) ends[k].yy = ends[k - 1].yy + 13;
    ends.forEach((d) => {
      const mx = narrow ? 14 : 17; const t = d.s.name.length > mx ? d.s.name.slice(0, mx - 1) + "…" : d.s.name;
      svg.append("text").attr("class", "lbl").attr("x", W - m.r + 6).attr("y", d.yy + 4).text(t);
      svg.append("circle").attr("cx", x(Y[d.k])).attr("cy", y(d.s.v[d.k])).attr("r", 3).attr("fill", d.s.color);
    });
    // legend
    let lg = "";
    series.forEach((s) => { lg += `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`; });
    if (S.sel) lg += `<span><i class="band" style="background:var(--ui-band)"></i>County 95% uncertainty</span>`;
    lg += `<span><i class="band" style="background:var(--band)"></i>Middle 80% of counties</span>`;
    $("trendLegend").innerHTML = lg;
    $("trendTitle").textContent = S.sel ? countyLabel(S.sel) + ": " + causeMeta(S.cause).name : "United States: " + causeMeta(S.cause).name;
    $("trendSub").innerHTML = S.sel
      ? "Deaths per 100,000, age-standardized, " + Y[0] + " to " + Y[Y.length - 1] + '. <a href="#" class="clear-sel" id="clearSel">Clear county</a>'
      : "Deaths per 100,000, age-standardized. Click a county on the map, or search, to compare it with its state and the nation.";
    const cs = $("clearSel"); if (cs) cs.onclick = (e) => { e.preventDefault(); selectCounty(null, false); };
    // hover crosshair
    const hl = svg.append("line").attr("class", "hover-line").attr("y1", m.t).attr("y2", H - m.b).style("display", "none");
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.r - m.l).attr("height", H - m.t - m.b).attr("fill", "transparent")
      .on("mousemove touchmove", (e) => {
        const [px] = d3.pointer(e);
        const yr = Math.round(x.invert(px)); const k = Y.indexOf(Math.max(Y[0], Math.min(Y[Y.length - 1], yr)));
        hl.style("display", null).attr("x1", x(Y[k])).attr("x2", x(Y[k]));
        let h = `<b>${Y[k]}</b>`;
        series.forEach((s) => { h += `<br>${esc(s.name)}: <strong>${fmtN(s.v[k])}</strong>`; });
        h += `<br><span class="s">Middle 80% of counties: ${fmtN(band[k][0])} to ${fmtN(band[k][1])}</span>`;
        const t = tip(); t.innerHTML = h; t.hidden = false;
        const ev = e.touches ? e.touches[0] : e;
        const r = t.getBoundingClientRect();
        let tx = ev.clientX + 14; if (tx + r.width > window.innerWidth - 6) tx = ev.clientX - r.width - 14;
        t.style.left = Math.max(6, tx) + "px"; t.style.top = Math.max(6, ev.clientY - r.height - 10) + "px";
      })
      .on("mouseleave touchend", () => { hl.style("display", "none"); hideTip(); })
      .on("click", (e) => { const [px] = d3.pointer(e); const k = Y.indexOf(Math.round(x.invert(px))); if (k >= 0) { stopPlay(); S.yi = k; render(false); } });
  }

  // ---------- rank table ----------
  function drawRank() {
    const y = S.idx.years[S.yi];
    const seen = new Set(), rows = [];
    for (let i = 0; i < S.idx.fips.length; i++) {
      const f = S.idx.fips[i];
      const v = val(i, S.yi); if (v == null) continue;
      const gk = S.groupKey[f] || f; if (seen.has(gk)) continue; seen.add(gk);
      rows.push({ f, v, i, label: S.groupKey[f] ? S.groupLabel[gk] : countyLabel(f) });
    }
    rows.sort((a, b) => a.v - b.v);
    const pick = S.rankView === "high" ? rows.slice(-10).reverse() : rows.slice(0, 10);
    $("rankTitle").textContent = (S.rankView === "high" ? "Highest" : "Lowest") + " county rates, " + y;
    let h = `<thead><tr><th>#</th><th>County</th><th style="text-align:right">Rate</th><th style="text-align:right">95% UI</th></tr></thead><tbody>`;
    pick.forEach((r, k) => {
      h += `<tr class="pick" data-f="${r.f}" tabindex="0"><td>${k + 1}</td><td>${esc(r.label)}</td><td class="n">${fmtN(r.v)}</td><td class="n">${fmtN(lo(r.i, S.yi))} to ${fmtN(hi(r.i, S.yi))}</td></tr>`;
    });
    $("rankTable").innerHTML = h + "</tbody>";
    $("rankTable").querySelectorAll("tr.pick").forEach((tr) => {
      const go = () => selectCounty(tr.dataset.f, true);
      tr.onclick = go; tr.onkeydown = (e) => { if (e.key === "Enter") go(); };
    });
    $("rankHigh").classList.toggle("on", S.rankView === "high");
    $("rankLow").classList.toggle("on", S.rankView === "low");
  }

  // ---------- actions ----------
  function render(full) {
    const meta = causeMeta(S.cause);
    S.edges = rateEdges(meta);
    paint(); drawLegend(); drawStats(); updateCauseList(); drawTrend(); drawRank();
    if (S.hover && !tip().hidden) tip().innerHTML = countyHTML(S.hover);
    $("yearSlider").value = S.yi;
    $("yearSlider").setAttribute("aria-valuetext", String(S.idx.years[S.yi]));
    $("modeRate").classList.toggle("on", S.mode === "rate");
    $("modeChange").classList.toggle("on", S.mode === "change");
    if (S.sel && full !== false) $("search").value = countyLabel(S.sel);
    writeHash();
  }
  async function setCause(id) {
    S.cause = id;
    $("loading").hidden = false;
    try { S.data = await loadCause(id); } catch (e) { $("loading").textContent = "Could not load data for this cause."; return; }
    $("loading").hidden = true;
    render();
  }
  function selectCounty(f, zoom) {
    S.sel = f;
    if (!f) $("search").value = "";
    render();
    if (f && zoom) zoomTo(f);
  }
  function stopPlay() {
    if (S.timer) clearInterval(S.timer);
    S.timer = null; S.playing = false;
    $("btnPlay").innerHTML = "&#9654; Play";
    $("btnPlay").setAttribute("aria-label", "Play years");
  }
  function startPlay() {
    S.playing = true;
    if (S.yi === ny() - 1) S.yi = 0;
    $("btnPlay").innerHTML = "&#10074;&#10074; Pause";
    $("btnPlay").setAttribute("aria-label", "Pause");
    render(false);
    S.timer = setInterval(() => {
      if (S.yi >= ny() - 1) { stopPlay(); return; }
      S.yi++; render(false);
    }, parseInt($("speed").value, 10));
  }

  // ---------- init ----------
  async function init() {
    try {
      const [idx, topo] = await Promise.all([getJSON(CFG.dataDir + "index.json"), getJSON(CFG.geo)]);
      S.idx = idx; S.topo = topo;
    } catch (e) {
      $("loading").textContent = "The data could not be loaded. Please refresh the page.";
      return;
    }
    S.idx.fips.forEach((f, i) => (S.fipsPos[f] = i));
    // merged estimation units (only groups with two or more mapped counties)
    S.groupKey = {}; S.groupLabel = {};
    (S.idx.merged_groups || []).forEach((g) => {
      if (g.fips.length < 2) return;
      const key = g.fips.join("+");
      const names = g.fips.map((f) => S.idx.names[S.fipsPos[f]]);
      g.fips.forEach((f) => {
        S.groupKey[f] = key;
        const others = g.fips.filter((x) => x !== f).map((x) => S.idx.names[S.fipsPos[x]]);
        S.groupOf[f] = others.join(", ");
      });
      S.groupLabel[key] = names.length > 2 ? names[0] + " and " + (names.length - 1) + " neighbors, " + stateAbbr(g.fips[0]) : names.join(" and ") + ", " + stateAbbr(g.fips[0]);
    });
    readHash();
    const yrs = S.idx.years;
    $("yearSlider").min = 0; $("yearSlider").max = yrs.length - 1;
    $("yMin").textContent = yrs[0]; $("yMax").textContent = yrs[yrs.length - 1];
    $("modeChange").textContent = "Change since " + yrs[0];
    buildCauseList();
    buildMap();
    // search
    const dl = $("countyList");
    const opts = S.idx.fips.map((f) => countyLabel(f)).map((t) => `<option value="${esc(t)}">`);
    dl.innerHTML = opts.join("");
    const labelToF = {}; S.idx.fips.forEach((f) => (labelToF[countyLabel(f).toLowerCase()] = f));
    $("search").addEventListener("change", (e) => { const f = labelToF[e.target.value.trim().toLowerCase()]; if (f) selectCounty(f, true); });
    $("yearSlider").addEventListener("input", (e) => { stopPlay(); S.yi = parseInt(e.target.value, 10); render(false); });
    $("btnPlay").onclick = () => (S.playing ? stopPlay() : startPlay());
    $("speed").onchange = () => { if (S.playing) { stopPlay(); startPlay(); } };
    $("modeRate").onclick = () => { S.mode = "rate"; render(); };
    $("modeChange").onclick = () => { S.mode = "change"; render(); };
    $("rankHigh").onclick = () => { S.rankView = "high"; drawRank(); };
    $("rankLow").onclick = () => { S.rankView = "low"; drawRank(); };
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input, select, textarea")) return;
      if (e.key === "ArrowRight" && S.yi < ny() - 1) { stopPlay(); S.yi++; render(false); }
      if (e.key === "ArrowLeft" && S.yi > 0) { stopPlay(); S.yi--; render(false); }
    });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", () => { if (S.data) render(false); });
    await setCause(S.cause);
    if (S.sel) zoomTo(S.sel);
  }
  init();
})();
