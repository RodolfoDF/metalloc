// Mapa dos equipamentos na rua: local da obra de cada locação ativa.
// Motor principal: Google Maps (mapa, busca de endereço e sugestões enquanto digita).
// Se o Google não carregar (sem internet, chave bloqueada…), cai no OpenStreetMap gratuito.
(function () {
  "use strict";
  const ML = window.ML, C = ML.C, S = ML.S, { $, $$, esc, el, ic } = ML;
  const CENTRO = [-15.79, -47.88]; // Brasília
  const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATRIB = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
  const CFG = window.ML_CONFIG || {};
  const DF_SW = { lat: -16.7, lng: -49.3 }, DF_NE = { lat: -15.1, lng: -47.0 };

  // ------------------------------------------------------------ carregamento do motor
  let googleFalhou = false, motorP = null;
  function carregarGoogle() {
    if (!CFG.googleMapsChave) return Promise.reject(new Error("sem chave do Google"));
    if (window.google && google.maps && google.maps.importLibrary) return Promise.resolve(google);
    return new Promise((ok, erro) => {
      const cb = "__mlGoogle" + Date.now();
      const t = setTimeout(() => erro(new Error("Google Maps não respondeu")), 12000);
      window[cb] = () => { clearTimeout(t); delete window[cb]; ok(window.google); };
      // chave recusada (site não autorizado, cobrança desativada…): volta para o mapa gratuito
      window.gm_authFailure = () => {
        googleFalhou = true; motorP = null;
        ML.aviso("O Google Maps recusou a chave — usando o mapa gratuito por enquanto.", "erro");
        if (/^#\/(mapa|painel)/.test(location.hash) && ML.render) setTimeout(ML.render, 50);
      };
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(CFG.googleMapsChave) +
        "&v=weekly&language=pt-BR&region=BR&libraries=marker,places,geocoding&loading=async&callback=" + cb;
      s.async = true;
      s.onerror = () => { clearTimeout(t); erro(new Error("não consegui carregar o Google Maps")); };
      document.head.appendChild(s);
    });
  }
  function motor() {
    if (googleFalhou) return ML.carregarLeaflet().then((L) => ({ tipo: "osm", L }));
    if (!motorP) motorP = carregarGoogle().then((g) => ({ tipo: "google", g }))
      .catch((e) => { console.warn("Mapa: usando OpenStreetMap —", e && e.message); googleFalhou = true; return ML.carregarLeaflet().then((L) => ({ tipo: "osm", L })); });
    return motorP;
  }
  ML.motorMapa = motor;
  const usaGoogle = () => !googleFalhou && !!CFG.googleMapsChave;

  // ------------------------------------------------------------ mapa genérico (mesma interface nos dois motores)
  // criarMapa(div, {mini}) → { centrar(ll, zoom), enquadrar(pts, zoomMax), pino(ll, html, popup) → {abrir, ll},
  //   aoClicar(fn(ll)), marcador(ll, aoArrastar) → {mover(ll)}, zoom(), ajustar() }
  async function criarMapa(div, o) {
    o = o || {};
    const mt = await motor();
    if (mt.tipo === "google") { await google.maps.importLibrary("maps"); await google.maps.importLibrary("marker"); return mapaGoogle(div, o); }
    return mapaLeaflet(mt.L, div, o);
  }
  function mapaGoogle(div, o) {
    const gm = google.maps;
    div.classList.add("mapa-google");
    const m = new gm.Map(div, { center: { lat: CENTRO[0], lng: CENTRO[1] }, zoom: 11, mapId: CFG.googleMapaId || "DEMO_MAP_ID",
      mapTypeControl: !o.mini, mapTypeControlOptions: { style: gm.MapTypeControlStyle.DROPDOWN_MENU }, streetViewControl: !o.mini, fullscreenControl: !o.mini,
      zoomControl: !o.mini, clickableIcons: false, gestureHandling: o.mini ? "cooperative" : "greedy" });
    const iw = new gm.InfoWindow({ minWidth: o.mini ? 220 : 240 });
    const Adv = gm.marker && gm.marker.AdvancedMarkerElement;
    const pt = (ll) => ({ lat: +ll[0], lng: +ll[1] });
    const api = {
      tipo: "google", nativo: m,
      centrar(ll, z) { m.setCenter(pt(ll)); if (z) m.setZoom(z); },
      enquadrar(pts, zMax) {
        if (!pts.length) return;
        if (pts.length === 1) return api.centrar(pts[0], zMax);
        const b = new gm.LatLngBounds(); pts.forEach((p) => b.extend(pt(p)));
        m.fitBounds(b, 40);
        gm.event.addListenerOnce(m, "idle", () => { if (m.getZoom() > zMax) m.setZoom(zMax); });
      },
      pino(ll, html, popup) {
        const conteudo = el(`<div class="pin-g">${html}</div>`);
        const mk = new Adv({ map: m, position: pt(ll), content: conteudo, gmpClickable: true });
        const abrir = () => { iw.setContent(el(popup)); iw.open({ anchor: mk, map: m }); };
        mk.addEventListener("gmp-click", abrir);
        return { abrir, ll };
      },
      aoClicar(fn) { m.addListener("click", (e) => e.latLng && fn([e.latLng.lat(), e.latLng.lng()])); },
      marcador(ll, aoArrastar) {
        const mk = new Adv({ map: m, position: pt(ll), gmpDraggable: true });
        mk.addListener("dragend", () => { const p = mk.position; aoArrastar([typeof p.lat === "function" ? p.lat() : p.lat, typeof p.lng === "function" ? p.lng() : p.lng]); });
        return { mover(n) { mk.position = pt(n); } };
      },
      zoom: () => m.getZoom(),
      ajustar() {},
    };
    return api;
  }
  function mapaLeaflet(L, div, o) {
    const m = L.map(div, Object.assign({ zoomControl: !o.mini, attributionControl: true }, o.mini ? { scrollWheelZoom: false, dragging: !L.Browser.mobile } : {})).setView(CENTRO, 11);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATRIB }).addTo(m);
    const api = {
      tipo: "osm", nativo: m,
      centrar(ll, z) { m.setView(ll, z || m.getZoom()); },
      enquadrar(pts, zMax) { if (pts.length === 1) m.setView(pts[0], zMax); else if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: zMax }); },
      pino(ll, html, popup) {
        const mk = L.marker(ll, { icon: L.divIcon({ className: "", iconSize: null, iconAnchor: [16, 34], popupAnchor: [0, -30], html }), riseOnHover: true })
          .addTo(m).bindPopup(popup, { minWidth: o.mini ? 220 : 240 });
        return { abrir: () => mk.openPopup(), ll };
      },
      aoClicar(fn) { m.on("click", (e) => fn([e.latlng.lat, e.latlng.lng])); },
      marcador(ll, aoArrastar) {
        const mk = L.marker(ll, { draggable: true }).addTo(m);
        mk.on("dragend", () => { const p = mk.getLatLng(); aoArrastar([p.lat, p.lng]); });
        return { mover(n) { mk.setLatLng(n); } };
      },
      zoom: () => m.getZoom(),
      ajustar() { setTimeout(() => m.invalidateSize(), 80); },
    };
    return api;
  }

  // locações ativas com a situação para a cor do marcador
  function ativas() {
    const d = ML.hoje(), av = ML.avisoDias();
    return S.locacoes.filter((l) => l.status === "ativa").map((l) => {
      const fats = S.fatsDe.get(l.registro) || [], u = fats[fats.length - 1];
      const dias = u && u.periodoFim ? C.difDias(d, u.periodoFim) : null;
      const vencida = fats.some((f) => C.situacao(f, d) === "vencida");
      const estado = dias != null && dias < 0 ? "atrasada" : vencida ? "cobrar" : dias != null && dias <= av ? "renovar" : "ok";
      const equips = (u ? (u.itens || []).filter((i) => !i.frete) : []).map((i) => {
        const e = (i.equipId && S.eqId.get(i.equipId)) || null;
        return e ? e.tag + (e.apelido ? " " + e.apelido : "") : i.equip || "";
      }).filter(Boolean);
      const cli = S.cli.get(l.clienteId) || {};
      const temPos = l.local && isFinite(+l.local.lat) && isFinite(+l.local.lng) && l.local.lat !== "" && l.local.lat != null;
      return { l, u, dias, estado, equips, cli, temPos };
    });
  }
  const NOME_EST = { ok: "Em dia", renovar: "Renovar", atrasada: "Período vencido", cobrar: "Fatura vencida" };
  // ponto achado automaticamente pelo mapa gratuito (dá para refazer com o Google)
  const doOsm = (x) => x.temPos && x.l.local.precisao && x.l.local.precisao !== "manual" && x.l.local.motor !== "google";

  function pinHtml(x) {
    const rot = esc(x.cli.sigla || String(x.l.registro));
    return `<div class="pin pin-${x.estado} ${x.l.local && /bairro|rua/.test(x.l.local.precisao || "") ? "pin-aprox" : ""}"><span>${rot}</span></div>`;
  }
  function popupHtml(x) {
    return `<div class="pop"><b>${esc(x.cli.razaoSocial || "")}</b>
      <small>Locação ${esc(C.padReg(x.l.registro, S.cfg.digitosRegistro))}${x.u ? " · " + esc(x.u.id) : ""}</small>
      ${x.l.local && x.l.local.nome ? `<div class="pop-local">${ic("mapa")}<b>${esc(x.l.local.nome)}</b></div>` : ""}
      <div class="pop-eq">${x.equips.map((e) => `<span class="etq">${esc(e)}</span>`).join(" ") || '<span class="muted">sem equipamento</span>'}</div>
      ${x.u && x.u.periodoFim ? `<div>Período até <b>${C.dataBR(x.u.periodoFim)}</b> · <span class="pin-txt-${x.estado}">${esc(x.dias != null ? ML.textoDias(x.dias) : "")}</span></div>` : ""}
      ${x.l.local && x.l.local.endereco ? `<small class="muted">${esc(x.l.local.endereco)}</small>` : ""}
      ${x.l.local && /bairro|rua/.test(x.l.local.precisao || "") ? `<small class="pin-txt-renovar">posição ${esc(ML.textoPrecisao(x.l.local.precisao))} — confira</small>` : x.l.local && x.l.local.fonte === "cliente" ? `<small class="muted">marcado pelo endereço do cliente</small>` : ""}
      <div class="pop-acoes"><button class="btn peq primario" data-pop-renovar="${x.l.registro}">${ic("renovar")}Renovar</button>
        <button class="btn peq" data-pop-local="${x.l.registro}">${ic("mapa")}Mudar local</button></div></div>`;
  }
  // ================================================================ tela Mapa
  ML.TELAS.mapa = function (main) {
    const st = S.ui.mapa || (S.ui.mapa = { filtro: "todas" });
    const lista = ativas();
    const cont = { todas: lista.length, renovar: lista.filter((x) => x.estado === "renovar" || x.estado === "atrasada").length, cobrar: lista.filter((x) => x.estado === "cobrar").length, semlocal: lista.filter((x) => !x.temPos).length };
    const filtra = (x) => st.filtro === "todas" || (st.filtro === "renovar" && (x.estado === "renovar" || x.estado === "atrasada")) || (st.filtro === "cobrar" && x.estado === "cobrar") || (st.filtro === "semlocal" && !x.temPos);
    const vis = lista.filter(filtra).sort((a, b) => (a.temPos - b.temPos) || ((a.dias ?? 999) - (b.dias ?? 999)));
    const nEq = lista.reduce((s, x) => s + x.equips.length, 0);
    main.innerHTML = `
      <div class="pag-cab"><h1>Mapa</h1>
        <div class="legenda-mapa">${["ok", "renovar", "atrasada", "cobrar"].map((k) => `<span><i class="pt-mapa pin-${k}"></i>${NOME_EST[k]}</span>`).join("")}</div>
        ${cont.semlocal ? `<button class="btn primario" data-acao="localizar-todas">${ic("alvo")}Localizar automaticamente (${cont.semlocal})</button>` : ""}
        <div class="sub">${lista.length} locações ativas · ${nEq} equipamento(s) na rua · ${cont.semlocal ? `<b>${cont.semlocal} sem ponto no mapa</b>` : "todas no mapa"}</div></div>
      <div class="mapa-grade">
        <div class="cartao mapa-cartao"><div class="mapa-grande" data-mapa></div></div>
        <div class="cartao mapa-lado">
          <div class="chips" style="margin-bottom:10px">${[["todas", "Todas"], ["renovar", "Renovar"], ["cobrar", "Cobrar"], ["semlocal", "Sem local"]]
            .map(([k, t]) => `<button class="chip ${st.filtro === k ? "ativo" : ""}" data-filtro="${k}">${t}<span class="n">${cont[k]}</span></button>`).join("")}</div>
          <div class="mapa-lista">${vis.map((x) => `<div class="ml-item" data-reg="${x.l.registro}">
            <i class="pt-mapa pin-${x.estado}"></i>
            <div class="ml-tx"><b>${x.cli.sigla ? `<span class="sigla">${esc(x.cli.sigla)}</span> ` : ""}${esc(x.cli.razaoSocial || "")}</b>
              <small>${x.l.local && x.l.local.nome ? esc(x.l.local.nome) + " · " : ""}${esc(x.equips.join(" · ") || "sem equipamento")}</small>
              <small>${x.u && x.u.periodoFim ? "até " + C.dataBRc(x.u.periodoFim) + " · " + esc(ML.textoDias(x.dias)) : ""}</small></div>
            ${x.temPos ? `<button class="ic-btn peq" title="Ver no mapa" data-ir="${x.l.registro}">${ic("alvo")}</button>` : `<button class="btn peq" data-local="${x.l.registro}">${ic("mapa")}Definir local</button>`}
          </div>`).join("") || '<div class="vazio">Nada aqui.</div>'}</div></div>
      </div>`;
    const div = $("[data-mapa]", main);
    const marcadores = new Map();
    criarMapa(div).then((mp) => {
      if (!div.isConnected) return;
      const pts = [];
      for (const x of lista.filter((y) => y.temPos && filtra(y))) {
        const ll = [+x.l.local.lat, +x.l.local.lng];
        marcadores.set(x.l.registro, mp.pino(ll, pinHtml(x), popupHtml(x))); pts.push(ll);
      }
      mp.enquadrar(pts, 14);
      main._mapa = mp; mp.ajustar();
      // com o Google ativo, os pontos achados antes pelo mapa gratuito podem ser refeitos
      const bt = $("[data-acao=localizar-todas]", main), nOsm = mp.tipo === "google" ? lista.filter(doOsm).length : 0;
      if (nOsm) {
        const n = cont.semlocal + nOsm;
        const html = `${ic("alvo")}Localizar com Google (${n})`;
        if (bt) bt.innerHTML = html; else $(".pag-cab", main).insertBefore(el(`<button class="btn primario" data-acao="localizar-todas" title="Procura de novo, no Google, os endereços que o mapa gratuito achou só aproximado">${html}</button>`), $(".pag-cab .sub", main));
      }
      if (mp.tipo === "google") atualizarAntigos(lista);
    }).catch((e) => { div.innerHTML = `<div class="vazio">Não consegui carregar o mapa: ${esc(ML.msgErro(e))}</div>`; });
    main.addEventListener("click", (e) => {
      const t = e.target.closest("[data-filtro],[data-ir],[data-local],[data-pop-renovar],[data-pop-local],[data-reg],[data-acao]"); if (!t) return;
      if (t.dataset.acao === "localizar-todas") return localizarTodas(lista);
      if (t.dataset.filtro) { st.filtro = t.dataset.filtro; return ML.render(); }
      if (t.dataset.popRenovar) return ML.abrirEditor({ modo: "renovar", registro: +t.dataset.popRenovar });
      if (t.dataset.popLocal || t.dataset.local) return definirLocal(S.loc.get(+(t.dataset.popLocal || t.dataset.local)));
      const reg = +(t.dataset.ir || t.dataset.reg), mk = marcadores.get(reg);
      if (mk && main._mapa) { main._mapa.centrar(mk.ll, Math.max(main._mapa.zoom(), 14)); mk.abrir(); }
      else if (t.dataset.reg && !mk) definirLocal(S.loc.get(reg));
    });
  };

  // ================================================================ cartão do Painel
  ML.miniMapa = function (div) {
    const lista = ativas().filter((x) => x.temPos);
    criarMapa(div, { mini: true }).then((mp) => {
      if (!div.isConnected) return;
      const pts = lista.map((x) => { const ll = [+x.l.local.lat, +x.l.local.lng]; mp.pino(ll, pinHtml(x), popupHtml(x)); return ll; });
      mp.enquadrar(pts, 13); mp.ajustar();
      div.addEventListener("click", (e) => {
        const t = e.target.closest("[data-pop-renovar],[data-pop-local]"); if (!t) return;
        if (t.dataset.popRenovar) ML.abrirEditor({ modo: "renovar", registro: +t.dataset.popRenovar });
        else definirLocal(S.loc.get(+t.dataset.popLocal));
      });
    }).catch(() => { div.innerHTML = '<div class="vazio">Mapa indisponível.</div>'; });
    return lista.length;
  };
  ML.contarSemLocal = () => ativas().filter((x) => !x.temPos).length;

  // ================================================================ busca automática de endereço (OpenStreetMap)
  // Tenta, em ordem: endereço completo → CEP (ViaCEP) → endereço simplificado → bairro.
  // Só aceita resultado de rua ou bairro (cidade inteira não serve para o mapa).
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  let ultimaConsulta = 0;
  async function nominatim(q) {
    const falta = 1100 - (Date.now() - ultimaConsulta); // regra do serviço gratuito: 1 consulta por segundo
    if (falta > 0) await esperar(falta);
    ultimaConsulta = Date.now();
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=5&accept-language=pt-BR&viewbox=-49.3,-15.1,-47.0,-16.7&bounded=0&q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("busca de endereço indisponível (" + r.status + ")");
    return r.json();
  }
  // tipo do que foi achado: "lugar" (rua, prédio, comércio…), "regiao" (bairro / região administrativa) ou "cidade"
  function tipoAchado(x, cidade, uf) {
    const cat = String(x.category || x.class || ""), at = String(x.addresstype || x.type || "");
    if (/^(highway|building|amenity|shop|office|craft|tourism|leisure|man_made|landuse|railway|healthcare|emergency|club|historic|aeroway)$/.test(cat)) return "lugar";
    if (/suburb|neighbourhood|quarter|city_district|borough|hamlet|village|isolated_dwelling|locality|allotments|residential|farm/.test(at)) return "regiao";
    if (/city|town|municipality/.test(at)) {
      // no DF as regiões administrativas (Samambaia, Sobradinho…) aparecem como "cidade": valem como região
      const nome = C.semAcento(String(x.name || x.display_name || "").split(",")[0]).toUpperCase().trim();
      if (String(uf || "").toUpperCase() === "DF" && nome && nome !== C.semAcento(cidade || "BRASILIA").toUpperCase().trim() && nome !== "BRASILIA") return "regiao";
    }
    return "cidade";
  }
  async function viaCep(cep) {
    const d = String(cep || "").replace(/\D/g, "");
    if (d.length !== 8) return null;
    try { const r = await fetch(`https://viacep.com.br/ws/${d}/json/`); const j = await r.json(); return j && !j.erro ? j : null; } catch (e) { return null; }
  }
  // tira complementos (lote, bloco, conjunto, sala, nº…) mantendo quadra, rua e bairro; só palavras inteiras
  const simplificar = (t) => String(t || "").replace(/\b(EDIF[IÍ]CIO|ED\.|BAIRRO)\s+(?=[A-ZÀ-Ú])/gi, (m, p1) => /BAIRRO/i.test(p1) ? "" : "§")
    .replace(/§[^,]*/g, " ")
    .replace(/\b(LOTES?|LT|BLOCO|BL|CONJUNTO|CONJ|CJ|CASA|LOJA|SALA|APTO?|AP|MOD|ANDAR|PARTE|SOBRELOJA|EDIF[IÍ]CIO|ED|NUMERO|N[º°]|NO|KM)(?=[\s.\d,]|$)\.?\s*[\w\/º°-]*/gi, " ")
    .replace(/\bS\/N\b/gi, " ").replace(/\bCEP\b[:\s]*[\d.-]+/gi, " ").replace(/\b\d+[º°]\s*\w*/g, " ")
    .replace(/\s*[,;]\s*/g, ", ").replace(/(,\s*)+/g, ", ").replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").replace(/\s+,/g, ",");
  const semParenteses = (t) => String(t || "").replace(/\(.*?\)/g, "").trim();
  // precisão: "endereco" (achou o endereço), "rua" (achou a rua/quadra), "bairro" (só a região)
  const ABREV = [[/\bQD\.?\b/gi, "QUADRA"], [/\bST\.?\s+HAB\b\.?/gi, "SETOR HABITACIONAL"], [/\bHAB\.\s/gi, "HABITACIONAL "], [/\bCONJ\.?\b/gi, "CONJUNTO"], [/\bLT\.?\b/gi, "LOTE"], [/\bAV\.?\b/gi, "AVENIDA"], [/´|`/g, "'"]];
  function normalizar(t) {
    let s = String(t || "").replace(/\s*\/\s*([A-Z]{2})\b/gi, ", $1"); // "SANTA MARIA/DF" → "SANTA MARIA, DF"
    for (const [re, por] of ABREV) s = s.replace(re, por);
    return s.replace(/\s+/g, " ").trim();
  }
  // regiões administrativas do DF e cidades do entorno: se aparecerem no texto, servem de último recurso
  const REGIOES = ["Plano Piloto", "Asa Norte", "Asa Sul", "Noroeste", "Sudoeste", "Octogonal", "Cruzeiro", "Lago Sul", "Lago Norte", "Varjão", "Park Way",
    "Núcleo Bandeirante", "Candangolândia", "Riacho Fundo II", "Riacho Fundo", "Guará", "SIA", "SCIA", "Estrutural", "Águas Claras", "Arniqueira", "Vicente Pires",
    "Taguatinga", "Ceilândia", "Sol Nascente", "Pôr do Sol", "Samambaia", "Recanto das Emas", "Gama", "Santa Maria", "São Sebastião", "Jardim Botânico",
    "Paranoá", "Itapoã", "Sobradinho II", "Sobradinho", "Fercal", "Planaltina", "Brazlândia"].map((n) => [n, "DF"])
    .concat([["Valparaíso de Goiás", "GO"], ["Valparaíso", "GO"], ["Cidade Ocidental", "GO"], ["Novo Gama", "GO"], ["Luziânia", "GO"], ["Águas Lindas", "GO"],
      ["Santo Antônio do Descoberto", "GO"], ["Formosa", "GO"], ["Planaltina de Goiás", "GO"], ["Alexânia", "GO"], ["Anápolis", "GO"], ["Goiânia", "GO"]]);
  // siglas de setores de Brasília → nome que o mapa conhece
  const SIGLAS = { SCES: "Setor de Clubes Esportivos Sul", SCEN: "Setor de Clubes Esportivos Norte", SHIS: "Lago Sul", SHIN: "Lago Norte", SMDB: "Setor de Mansões Dom Bosco",
    SMPW: "Park Way", SOF: "Setor de Oficinas", SAAN: "Setor de Armazenagem e Abastecimento Norte", SIG: "Setor de Indústrias Gráficas", SCS: "Setor Comercial Sul",
    SCN: "Setor Comercial Norte", SBS: "Setor Bancário Sul", SBN: "Setor Bancário Norte", SAUS: "Setor de Autarquias Sul", SAUN: "Setor de Autarquias Norte",
    SGAN: "Asa Norte", SGAS: "Asa Sul", SQS: "Asa Sul", SQN: "Asa Norte", CLS: "Asa Sul", CLN: "Asa Norte", SHN: "Setor Hoteleiro Norte", SHS: "Setor Hoteleiro Sul",
    SEPN: "Asa Norte", SEPS: "Asa Sul", SHCS: "Asa Sul", SMAS: "Setor de Múltiplas Atividades Sul", SHTN: "Lago Norte", SMLN: "Lago Norte", SHA: "Arniqueira",
    ADE: "Águas Claras", SIA: "SIA", SCIA: "SCIA", SRTVS: "Asa Sul", SRTVN: "Asa Norte", SDS: "Setor de Diversões Sul", SDN: "Setor de Diversões Norte",
    QNM: "Ceilândia", QNN: "Ceilândia", QNO: "Ceilândia", QNP: "Ceilândia", QNQ: "Ceilândia", QNR: "Ceilândia", QNL: "Taguatinga", QNA: "Taguatinga",
    QNB: "Taguatinga", QNC: "Taguatinga", QND: "Taguatinga", QNE: "Taguatinga", QNF: "Taguatinga", QNG: "Taguatinga", QNH: "Taguatinga", QNJ: "Taguatinga",
    QSA: "Taguatinga", QSB: "Taguatinga", QSC: "Taguatinga", QSD: "Taguatinga", QSE: "Taguatinga", QSF: "Taguatinga", DAIA: "DAIA Anápolis" };
  function siglaNoTexto(t) {
    for (const w of C.semAcento(t).toUpperCase().split(/[^A-Z0-9]+/)) if (SIGLAS[w]) return SIGLAS[w];
    return null;
  }
  const distKm = (a, b) => { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };
  function regiaoNoTexto(t) {
    const u = " " + C.semAcento(t).toUpperCase().replace(/[^A-Z0-9 ]/g, " ") + " ";
    for (const [n, uf] of REGIOES) if (u.includes(" " + C.semAcento(n).toUpperCase() + " ")) return [n, uf];
    return null;
  }
  async function geocodificarOsm(o) {
    o = Object.assign({}, o, { endereco: normalizar(o.endereco) });
    // se o texto já diz a UF (", DF", ", GO"), não mistura com a cidade do cliente
    const ufTexto = (/,\s*([A-Z]{2})\s*$/i.exec(o.endereco) || [])[1];
    if (ufTexto) { o.uf = ufTexto.toUpperCase(); o.cidade = ""; }
    const cidade = String(o.cidade || "").trim(), uf = String(o.uf || "").trim();
    const contem = (t, sub) => C.semAcento(t).toUpperCase().includes(C.semAcento(sub).toUpperCase());
    const comCidade = (t) => [t, cidade && !contem(t, cidade) ? cidade : "", uf && !new RegExp("\\b" + uf + "\\b", "i").test(t) ? uf : ""].filter(Boolean).join(", ");
    const end = String(o.endereco || "").trim();
    const tent = []; // [consulta, nível]
    if (end && o.fonte === "obra" && (ufTexto || regiaoNoTexto(end))) tent.push([end, "endereco"]); // obra pode ser em outra cidade que a do cliente
    if (end) tent.push([comCidade(end), "endereco"]);
    const v = await viaCep(o.cep || (/\b\d{2}\.?\d{3}-?\d{3}\b/.exec(end) || [])[0]);
    if (v && v.logradouro) tent.push([`${v.logradouro}, ${semParenteses(v.bairro)}, ${v.localidade}, ${v.uf}`, "rua"]);
    if (end) { const sp = simplificar(end); if (sp && sp !== end) { if (o.fonte === "obra" && (ufTexto || regiaoNoTexto(end))) tent.push([sp, "rua"]); tent.push([comCidade(sp), "rua"]); } }
    // região: bairro do CEP e as últimas partes do endereço (costuma ser o bairro)
    const regioes = [];
    if (v && v.bairro) { regioes.push(semParenteses(v.bairro)); const m = /\((.*?)\)/.exec(v.bairro); if (m) regioes.push(m[1]); }
    const partes = simplificar(end).split(",").map((x) => x.trim()).filter((x) => x.length > 3 && !/^\d+$/.test(x));
    regioes.push(...partes.slice(-2).reverse());
    regioes.forEach((r) => tent.push([comCidade(r), "bairro"]));
    const sg = siglaNoTexto(end);
    if (sg) tent.push([/Anápolis/.test(sg) ? `${sg}, GO` : `${sg}, Brasília, DF`, "regiao"]);
    const rg = regiaoNoTexto(end);
    if (rg) tent.push([`${rg[0]}, ${rg[1]}`, "regiao"]);
    const vistos = new Set();
    for (const [q, nivel] of tent) {
      const k = C.semAcento(q).toLowerCase(); if (vistos.has(k)) continue; vistos.add(k);
      const lista = await nominatim(q);
      const bons = lista.map((x) => ({ x, t: tipoAchado(x, cidade, uf) })).filter((y) => y.t !== "cidade" || nivel === "regiao");
      const melhor = bons.find((y) => y.t === "lugar") || bons[0];
      if (!melhor) continue;
      let precisao = melhor.t === "regiao" || nivel === "regiao" ? "bairro" : nivel;
      // conferências: número da quadra/lote tem que bater; resultado de estrada é aproximado; vários lugares longe entre si = ambíguo
      const nums = (q.match(/\b\d{2,4}\b/g) || []).filter((n) => !/^(19|20)\d\d$/.test(n));
      const texto = String(melhor.x.display_name || "") + " " + String(melhor.x.name || "");
      if (precisao !== "bairro" && nums.length && !nums.some((n) => new RegExp("\\b0*" + (+n) + "\\b").test(texto))) precisao = "bairro";
      if (precisao === "endereco" && String(melhor.x.category || "") === "highway" && !nums.length) precisao = "rua";
      const outros = bons.filter((y) => y !== melhor && y.t !== "cidade");
      if (precisao !== "bairro" && outros.some((y) => distKm({ lat: +melhor.x.lat, lon: +melhor.x.lon }, { lat: +y.x.lat, lon: +y.x.lon }) > 5)) precisao = "bairro";
      return { lat: Math.round(+melhor.x.lat * 1e6) / 1e6, lng: Math.round(+melhor.x.lon * 1e6) / 1e6, precisao, achado: melhor.x.display_name, consulta: q, motor: "osm" };
    }
    return null;
  }

  // ================================================================ busca com o Google
  const arred = (n) => Math.round(+n * 1e6) / 1e6;
  const latDe = (p) => typeof p.lat === "function" ? p.lat() : +p.lat;
  const lngDe = (p) => typeof p.lng === "function" ? p.lng() : +p.lng;
  const ORDEM = { endereco: 3, rua: 2, bairro: 1 };
  // precisão de um resultado do Geocoding; null = amplo demais (cidade inteira, estado…)
  function precisaoGeocode(r, nivel) {
    const t = r.types || [], lt = r.geometry && r.geometry.location_type;
    const temBairro = t.some((x) => /sublocality|neighborhood|administrative_area_level_[345]/.test(x));
    if (!temBairro && t.some((x) => /^(country|administrative_area_level_1|administrative_area_level_2|locality|colloquial_area|postal_code_prefix)$/.test(x)))
      return nivel === "regiao" && !/^Bras[ií]lia\b/.test(r.formatted_address || "") ? "bairro" : null;
    if (lt !== "ROOFTOP" && t.some((x) => /^sublocality_level_[345]$/.test(x))) return nivel === "regiao" ? "bairro" : "rua"; // quadra / conjunto
    let p = lt === "ROOFTOP" || lt === "RANGE_INTERPOLATED" || t.some((x) => /establishment|point_of_interest|premise|street_address/.test(x)) ? "endereco"
      : t.some((x) => /^(route|intersection|postal_code)$/.test(x)) ? "rua" : "bairro";
    if (r.partial_match && lt !== "ROOFTOP" && p === "endereco") p = "rua";
    if (nivel === "rua" && p === "endereco") p = "rua";
    if (nivel === "regiao") p = "bairro";
    return p;
  }
  const precisaoPred = (tipos) => (tipos || []).some((x) => /establishment|point_of_interest|street_address|premise/.test(x)) ? "endereco"
    : (tipos || []).some((x) => /^route$/.test(x)) ? "rua" : "bairro";
  async function sugestoes(q, tok) {
    const { AutocompleteSuggestion } = await google.maps.importLibrary("places");
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q, sessionToken: tok, includedRegionCodes: ["br"],
      locationBias: { center: { lat: CENTRO[0], lng: CENTRO[1] }, radius: 50000 }, language: "pt-BR", region: "br" });
    return (suggestions || []).map((s) => s.placePrediction).filter(Boolean);
  }
  async function coordsDaSugestao(p) {
    const place = p.toPlace();
    await place.fetchFields({ fields: ["location", "formattedAddress"] });
    const achado = place.formattedAddress || (p.text && p.text.text) || "";
    return { lat: arred(latDe(place.location)), lng: arred(lngDe(place.location)), placeId: place.id, achado, precisao: precisaoPred(p.types), motor: "google" };
  }
  // nome de obra / estabelecimento (ex.: "GEALI TAGUATINGA"): a 1ª sugestão do Google, se ficar perto de Brasília
  async function lugarPorTexto(q) {
    const { AutocompleteSessionToken } = await google.maps.importLibrary("places");
    const preds = await sugestoes(q, new AutocompleteSessionToken());
    if (!preds.length) return null;
    const r = await coordsDaSugestao(preds[0]);
    const longe = distKm({ lat: CENTRO[0], lon: CENTRO[1] }, { lat: r.lat, lon: r.lng }) > 200;
    const citaCidade = (preds[0].text && C.semAcento(preds[0].text.text).toUpperCase().split(/[ ,-]+/).filter((w) => w.length > 3).some((w) => C.semAcento(q).toUpperCase().includes(w)));
    if (longe && !citaCidade) return null;
    const c = confere(q, r.achado); if (c === "nao") return null;
    if (c === "aprox" && r.precisao !== "bairro") r.precisao = "bairro";
    return Object.assign(r, { consulta: q });
  }
  // o resultado bate com o que foi digitado? "nao" = outro lugar (outra UF / outra região do DF); "aprox" = número da quadra não confere
  function confere(q, achado) {
    const A = " " + C.semAcento(achado || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ") + " ";
    const ufQ = (/,\s*([A-Z]{2})\s*$/i.exec(q) || [])[1], ufA = (/ - ([A-Z]{2}),/.exec(achado || "") || [])[1] || (/,\s*([A-Z]{2})\s*\d{5}/.exec(achado || "") || [])[1];
    if (ufQ && ufA && ufQ.toUpperCase() !== ufA) return "nao";
    // código da quadra (QNM 34, SQS 308, QR 415…) presente no resultado vale mais que o nome da região (os limites das RAs variam)
    const codigos = (C.semAcento(q).toUpperCase().match(/\b[A-Z]{2,5}\s*\d{1,4}\b/g) || []).filter((c) => !/^(LOTE|LT|CASA|SALA|LOJA|APTO?|BLOCO|BL|KM|ANDAR|N)\s*\d/.test(c))
      .map((c) => c.replace(/^([A-Z]+)\s*(\d+)$/, "$1 $2"));
    const temCodigo = codigos.some((c) => A.includes(" " + c.replace(/ 0*(\d+)$/, " $1") + " "));
    const rg = regiaoNoTexto(q);
    if (rg && !temCodigo && !A.includes(" " + C.semAcento(rg[0]).toUpperCase() + " ")) return "nao";
    const nums = (q.match(/\b\d{2,4}\b/g) || []).filter((n) => !/^(19|20)\d\d$/.test(n) && !/^\d{5}/.test(n));
    if (nums.length && !nums.some((n) => new RegExp(" 0*" + (+n) + " ").test(A))) return "aprox";
    return "ok";
  }
  async function geocodificarGoogle(o) {
    const { Geocoder } = await google.maps.importLibrary("geocoding");
    const gc = new Geocoder();
    o = Object.assign({}, o, { endereco: normalizar(o.endereco) });
    const ufTexto = (/,\s*([A-Z]{2})\s*$/i.exec(o.endereco) || [])[1];
    if (ufTexto) { o.uf = ufTexto.toUpperCase(); o.cidade = ""; }
    const cidade = String(o.cidade || "").trim(), uf = String(o.uf || "").trim();
    const contem = (t, sub) => C.semAcento(t).toUpperCase().includes(C.semAcento(sub).toUpperCase());
    const comCidade = (t) => [t, cidade && !contem(t, cidade) ? cidade : "", uf && !new RegExp("\\b" + uf + "\\b", "i").test(t) ? uf : ""].filter(Boolean).join(", ");
    const end = String(o.endereco || "").trim();
    const cep = String(o.cep || (/\b\d{2}\.?\d{3}-?\d{3}\b/.exec(end) || [])[0] || "").replace(/\D/g, "");
    const tent = [];
    if (end && o.fonte === "obra" && (ufTexto || regiaoNoTexto(end))) tent.push([end, "endereco"]);
    if (end) tent.push([comCidade(end), "endereco"]);
    if (cep.length === 8) tent.push([cep.slice(0, 5) + "-" + cep.slice(5) + ", Brasil", "rua"]);
    if (end) { const sp = simplificar(end); if (sp && sp !== end) tent.push([comCidade(sp), "rua"]); }
    const sg = siglaNoTexto(end);
    if (sg) tent.push([/Anápolis/.test(sg) ? `${sg}, GO` : `${sg}, Brasília, DF`, "regiao"]);
    const rg = regiaoNoTexto(end);
    if (rg) tent.push([`${rg[0]}, ${rg[1]}`, "regiao"]);
    let melhor = null;
    const vistos = new Set();
    for (const [q, nivel] of tent) {
      const k = C.semAcento(q).toLowerCase(); if (vistos.has(k)) continue; vistos.add(k);
      let res = [];
      try { res = (await gc.geocode({ address: q, region: "br", bounds: { south: DF_SW.lat, west: DF_SW.lng, north: DF_NE.lat, east: DF_NE.lng }, componentRestrictions: { country: "BR" } })).results || []; }
      catch (e) { if (e && e.code === "ZERO_RESULTS") continue; throw e; }
      for (const r of res.slice(0, 3)) {
        let p = precisaoGeocode(r, nivel); if (!p) continue;
        const c = confere(q, r.formatted_address); if (c === "nao") continue;
        if (c === "aprox" && p !== "bairro") p = "bairro";
        const cand = { lat: arred(latDe(r.geometry.location)), lng: arred(lngDe(r.geometry.location)), precisao: p, achado: r.formatted_address, consulta: q, placeId: r.place_id, motor: "google" };
        if (!melhor || ORDEM[p] > ORDEM[melhor.precisao]) melhor = cand;
        break;
      }
      if (melhor && melhor.precisao === "endereco") return melhor;
      // o texto original não deu endereço exato: tenta como lugar/estabelecimento antes de simplificar
      if (nivel === "endereco" && q === tent[0][0] && end) {
        const lu = await lugarPorTexto(end).catch(() => null);
        if (lu && (!melhor || ORDEM[lu.precisao] > ORDEM[melhor.precisao])) melhor = lu;
        if (melhor && melhor.precisao === "endereco") return melhor;
      }
    }
    return melhor;
  }
  ML.geocodificar = async function (o) {
    const mt = await motor();
    if (mt.tipo === "google") {
      try { const r = await geocodificarGoogle(o); if (r) return r; }
      catch (e) { console.warn("Busca Google:", e); }
    }
    return geocodificarOsm(o);
  };

  // sugestões de endereço enquanto digita (Google). aoEscolher({lat, lng, achado, precisao, placeId})
  ML.autocompletarEndereco = function (input, aoEscolher) {
    if (!input || input._ac || !usaGoogle()) return;
    input._ac = true; input.setAttribute("autocomplete", "off");
    (input.closest(".campo") || input.parentElement).classList.add("ac-caixa");
    const lista = el('<div class="ac-lista" hidden></div>');
    input.insertAdjacentElement("afterend", lista);
    let tok = null, timer = 0, seq = 0, itens = [], ativo = -1;
    const fechar = () => { lista.hidden = true; ativo = -1; };
    const marcarAtivo = () => $$("[data-i]", lista).forEach((b, i) => b.classList.toggle("ativo", i === ativo));
    input.addEventListener("input", () => {
      if (input._acSet) return;
      ["lat", "lng", "place", "prec", "achado"].forEach((k) => delete input.dataset[k]);
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 4) return fechar();
      timer = setTimeout(async () => {
        const meu = ++seq;
        try {
          const mt = await motor(); if (mt.tipo !== "google") return;
          const { AutocompleteSessionToken } = await google.maps.importLibrary("places");
          tok = tok || new AutocompleteSessionToken();
          const ps = (await sugestoes(q, tok)).slice(0, 5);
          if (meu !== seq || document.activeElement !== input) return;
          itens = ps;
          if (!itens.length) return fechar();
          lista.innerHTML = itens.map((p, i) => `<button type="button" data-i="${i}">${ic("mapa")}<span><b>${esc(p.mainText ? p.mainText.text : p.text.text)}</b><small>${esc(p.secondaryText ? p.secondaryText.text : "")}</small></span></button>`).join("") +
            '<div class="ac-rodape">sugestões do Google</div>';
          lista.hidden = false; ativo = -1;
        } catch (e) { console.warn("Sugestões Google:", e); fechar(); }
      }, 300);
    });
    async function escolher(i) {
      const p = itens[i]; if (!p) return;
      fechar();
      try {
        const r = await coordsDaSugestao(p);
        tok = null;
        input._acSet = true; input.value = r.achado.replace(/,\s*Brasil$/, ""); input.dispatchEvent(new Event("input", { bubbles: true })); input._acSet = false;
        Object.assign(input.dataset, { lat: r.lat, lng: r.lng, place: r.placeId || "", prec: r.precisao, achado: r.achado });
        if (aoEscolher) aoEscolher(r);
      } catch (e) { ML.aviso("Não consegui abrir esse endereço: " + ML.msgErro(e), "erro"); }
    }
    lista.addEventListener("mousedown", (e) => { const b = e.target.closest("[data-i]"); if (b) { e.preventDefault(); escolher(+b.dataset.i); } });
    input.addEventListener("keydown", (e) => {
      if (lista.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ativo = (ativo + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length; marcarAtivo(); }
      else if (e.key === "Enter" && ativo >= 0) { e.preventDefault(); e.stopImmediatePropagation(); escolher(ativo); }
      else if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); fechar(); }
    });
    input.addEventListener("blur", () => setTimeout(fechar, 150));
  };
  // ponto já escolhido numa sugestão (para gravar sem procurar de novo)
  ML.coordsEscolhidas = (input) => input && input.dataset && input.dataset.lat ? { lat: +input.dataset.lat, lng: +input.dataset.lng, placeId: input.dataset.place || "",
    precisao: input.dataset.prec || "endereco", achado: input.dataset.achado || "", motor: "google" } : null;
  // grava o ponto vindo de uma sugestão
  ML.localDeSugestao = (r) => ({ lat: r.lat, lng: r.lng, precisao: r.precisao, fonte: "obra", achado: r.achado, motor: "google", placeId: r.placeId || "", geoEm: ML.hoje() });

  // pontos do Google guardados há mais de 30 dias: renova pela identificação do lugar (regra do Google)
  let renovando = false;
  async function atualizarAntigos(lista) {
    if (renovando) return; renovando = true;
    try {
      const limite = C.addDias ? C.addDias(ML.hoje(), -30) : null;
      const velhos = lista.filter((x) => x.temPos && x.l.local.motor === "google" && x.l.local.placeId && x.l.local.precisao !== "manual" && (!x.l.local.geoEm || (limite && x.l.local.geoEm < limite))).slice(0, 10);
      if (!velhos.length) return;
      const { Place } = await google.maps.importLibrary("places");
      for (const x of velhos) {
        try {
          const pl = new Place({ id: x.l.local.placeId });
          await pl.fetchFields({ fields: ["location"] });
          const local = Object.assign({}, x.l.local, { lat: arred(latDe(pl.location)), lng: arred(lngDe(pl.location)), geoEm: ML.hoje() });
          await ML.rpc("fat_salvar_locacao", { p_registro: x.l.registro, p_dados: { local } });
          x.l.local = local;
        } catch (e) { console.warn("Renovar ponto:", e); }
      }
    } finally { renovando = false; }
  }
  ML.textoPrecisao = (p) => p === "endereco" ? "endereço" : p === "rua" ? "aproximado (rua/quadra)" : p === "bairro" ? "aproximado (bairro/região)" : "marcado à mão";
  // endereço a usar: o da obra; se não houver, o do cliente
  function enderecoParaBusca(l) {
    const loc = l.local || {}, cli = S.cli.get(l.clienteId) || {};
    if (loc.endereco) return { endereco: loc.endereco, cidade: cli.cidade, uf: cli.uf, fonte: "obra" };
    if (loc.nome) return { endereco: loc.nome, cidade: cli.cidade, uf: cli.uf, fonte: "obra", soLocal: true };
    if (cli.endereco || cli.cep) return { endereco: cli.endereco || "", cidade: cli.cidade, uf: cli.uf, cep: cli.cep, fonte: "cliente" };
    return null;
  }
  // procura e grava; devolve o resultado (ou null se não achou)
  ML.localizarLocacao = async function (l, o) {
    o = o || {};
    if (!l) return null;
    const alvo = enderecoParaBusca(l);
    if (!alvo) { if (!o.silencioso) ML.aviso("Sem endereço da obra nem do cliente para procurar.", "erro"); return null; }
    if (!o.silencioso) ML.aviso("Procurando o endereço no mapa…");
    let r = null;
    try { r = await ML.geocodificar(alvo); } catch (e) { if (!o.silencioso) ML.aviso(ML.msgErro(e), "erro"); return null; }
    if (!r) { if (!o.silencioso) ML.aviso("Não achei esse endereço. Abra “Definir local” e clique no ponto da obra no mapa.", "erro"); return null; }
    const local = Object.assign({}, l.local || {}, { lat: r.lat, lng: r.lng, precisao: r.precisao, fonte: alvo.fonte, achado: r.achado, motor: r.motor || "osm", placeId: r.placeId || "", geoEm: ML.hoje() });
    if (!local.endereco && alvo.fonte === "cliente") local.endereco = "";
    await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local } });
    l.local = local;
    if (!o.silencioso) ML.aviso(r.precisao === "endereco" ? "Marcado no mapa." : `Marcado no mapa — ${ML.textoPrecisao(r.precisao)}. Confira o ponto.`, "ok");
    return r;
  };
  async function localizarTodas(lista) {
    const g = (await motor()).tipo === "google";
    const fila = lista.filter((x) => (!x.temPos || (g && doOsm(x))) && enderecoParaBusca(x.l));
    if (!fila.length) return ML.aviso("Nenhuma locação sem ponto tem endereço para procurar. Cadastre o endereço da obra ou do cliente.", "erro");
    const corpo = el(`<div><p style="margin:0 0 10px">Procurando ${fila.length} endereço(s)${g ? " no Google" : ` — leva cerca de ${Math.ceil(fila.length * 2.5)} segundos (o serviço gratuito aceita uma busca por segundo)`}.</p>
      <div class="medidor"><span data-barra style="width:0%;background:var(--laranja)"></span></div><div data-log class="log-geo"></div></div>`);
    let parar = false;
    const m = ML.modal({ titulo: "Localizar automaticamente", corpo, classe: "medio", aoFechar: () => { parar = true; } });
    let ok = 0, aprox = 0;
    for (let i = 0; i < fila.length && !parar; i++) {
      const x = fila[i];
      let r = null;
      try { r = await ML.localizarLocacao(x.l, { silencioso: true }); } catch (e) { r = null; }
      if (r) { ok++; if (r.precisao !== "endereco") aprox++; }
      $("[data-barra]", corpo).style.width = Math.round((i + 1) / fila.length * 100) + "%";
      $("[data-log]", corpo).insertAdjacentHTML("beforeend", `<div>${r ? (r.precisao === "endereco" ? "✅" : "🟠") : "❌"} ${esc(x.cli.razaoSocial || "")} <small class="muted">${r ? ML.textoPrecisao(r.precisao) : "não encontrado"}</small></div>`);
    }
    $("[data-log]", corpo).insertAdjacentHTML("beforeend", `<p style="margin:10px 0 0"><b>${ok} de ${fila.length} marcados</b>${aprox ? ` · ${aprox} aproximado(s) — vale conferir` : ""}. ${ok < fila.length ? "Os que faltaram: use “Definir local” e clique no ponto da obra." : ""}</p>`);
    await ML.recarregarERender();
    if (!parar) setTimeout(() => m.fechar(), 4000);
  }

  // ================================================================ definir o local da obra
  function definirLocal(l) {
    if (!l) return;
    const cli = S.cli.get(l.clienteId) || {};
    const loc = l.local || {};
    const sugestao = loc.endereco || [cli.endereco, cli.cidade, cli.uf].filter(Boolean).join(", ");
    let pos = isFinite(+loc.lat) && loc.lat !== "" && loc.lat != null ? [+loc.lat, +loc.lng] : null;
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:10px">
      <div class="aviso-linha"><b>${esc(cli.razaoSocial || "")}</b> · locação ${esc(C.padReg(l.registro, S.cfg.digitosRegistro))}</div>
      <label class="campo"><span>Local de operação</span><input data-nome-local list="lista-locais-mapa" value="${esc(loc.nome || "")}" placeholder="ex.: GEALI TAGUATINGA" style="text-transform:uppercase">
        <datalist id="lista-locais-mapa">${ML.locaisConhecidos().map((x) => `<option value="${esc(x)}">`).join("")}</datalist></label>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <label class="campo" style="flex:1"><span>Endereço da obra</span><input data-end value="${esc(sugestao)}" placeholder="Rua, número, bairro, cidade"></label>
        <button class="btn" data-buscar>${ic("busca")}Buscar</button></div>
      <div data-resultados class="resultados-geo" hidden></div>
      <div class="mapa-modal" data-mapa></div>
      <small class="muted" data-geo-info>Clique no mapa para marcar o ponto exato da obra, ou arraste o marcador.</small>
      <div class="erro" data-erro hidden></div></div>`);
    let mapa = null, mk = null, precisao = loc.precisao || (pos ? "manual" : ""), pendente = null, extra = {};
    const marcar = (ll, centrar, prec, info) => {
      pos = [Math.round(ll[0] * 1e6) / 1e6, Math.round(ll[1] * 1e6) / 1e6];
      precisao = prec || "manual";
      extra = info || {};
      if (!mapa) { pendente = centrar; return; }
      if (!mk) mk = mapa.marcador(pos, (p) => { pos = [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]; precisao = "manual"; extra = {}; });
      else mk.mover(pos);
      if (centrar) mapa.centrar(pos, precisao === "bairro" ? 14 : Math.max(mapa.zoom(), 16));
    };
    const botoes = [{ texto: "Cancelar" }, { texto: "Salvar local", classe: "primario", acao: async () => {
      if (!pos) { $("[data-erro]", corpo).textContent = "Marque o ponto da obra no mapa (busque o endereço ou clique no mapa)."; $("[data-erro]", corpo).hidden = false; return false; }
      const base = Object.assign({}, loc); ["achado", "motor", "placeId", "geoEm"].forEach((k) => delete base[k]);
      await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local: Object.assign(base, { nome: $("[data-nome-local]", corpo).value.trim().toUpperCase(), endereco: $("[data-end]", corpo).value.trim(), lat: pos[0], lng: pos[1], precisao, fonte: "obra" },
        precisao !== "manual" && extra.motor ? { achado: extra.achado || "", motor: extra.motor, placeId: extra.placeId || "", geoEm: ML.hoje() } : {}) } });
      ML.aviso("Local da obra salvo.", "ok"); await ML.recarregarERender();
    } }];
    if (l.local && l.local.lat != null) botoes.unshift({ texto: "Remover do mapa", classe: "perigo", esquerda: true, acao: async () => {
      await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local: loc.nome ? { nome: loc.nome } : null } });
      ML.aviso("Ponto do mapa removido."); await ML.recarregarERender();
    } });
    ML.modal({ titulo: "Local da obra", corpo, classe: "medio", botoes });
    const info = $("[data-geo-info]", corpo);
    const mostrar = (r) => {
      info.innerHTML = r.precisao === "endereco" ? `✅ Achei: <i>${esc(r.achado)}</i>. Se não for o ponto exato, arraste o marcador.`
        : `🟠 ${r.precisao === "rua" ? "Achei a rua/quadra" : "Achei só o bairro/região"}: <i>${esc(r.achado)}</i>. Arraste o marcador até a obra para ficar exato.`;
    };
    criarMapa($("[data-mapa]", corpo)).then((mp) => {
      mapa = mp;
      mapa.aoClicar((ll) => marcar(ll, false, "manual"));
      if (pos) { const pr = precisao, ex = extra; marcar(pos, false, pr, ex); mapa.centrar(pos, pendente || pr !== "bairro" ? 16 : 14); }
      mapa.ajustar();
      if (mapa.tipo === "google") info.textContent = "Comece a digitar o endereço e escolha uma sugestão — ou clique no mapa / arraste o marcador. Dá para trocar para satélite no canto do mapa.";
    }).catch((e) => { $("[data-mapa]", corpo).innerHTML = `<div class="vazio">Não consegui carregar o mapa: ${esc(ML.msgErro(e))}</div>`; });
    // sugestões do Google enquanto digita
    ML.autocompletarEndereco($("[data-end]", corpo), (r) => { $("[data-resultados]", corpo).hidden = true; marcar([r.lat, r.lng], true, r.precisao, r); mostrar(r); });
    // abriu sem ponto e com endereço: procura sozinho
    if (!pos && $("[data-end]", corpo).value.trim()) setTimeout(buscar, 150);
    async function buscar() {
      const q = $("[data-end]", corpo).value.trim(), res = $("[data-resultados]", corpo);
      if (!q) return;
      res.hidden = false; res.innerHTML = '<div class="muted" style="padding:8px">Procurando o endereço…</div>';
      try {
        const usaCliente = !loc.endereco && q === sugestao;
        const r = await ML.geocodificar({ endereco: q, cidade: cli.cidade, uf: cli.uf, cep: usaCliente ? cli.cep : "", fonte: usaCliente ? "cliente" : "obra" });
        if (!corpo.isConnected) return;
        if (!r) { res.innerHTML = '<div class="muted" style="padding:8px">Não achei esse endereço. Aproxime o mapa e clique no ponto da obra.</div>'; return; }
        res.hidden = true;
        marcar([r.lat, r.lng], true, r.precisao, r);
        mostrar(r);
      } catch (e) { res.innerHTML = '<div class="muted" style="padding:8px">A busca de endereços não respondeu. Clique direto no mapa para marcar.</div>'; }
    }
    $("[data-buscar]", corpo).addEventListener("click", buscar);
    $("[data-end]", corpo).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } });
  }
  ML.definirLocal = definirLocal;
})();
