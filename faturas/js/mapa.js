// Mapa dos equipamentos na rua: local da obra de cada locação ativa (OpenStreetMap + Leaflet).
(function () {
  "use strict";
  const ML = window.ML, C = ML.C, S = ML.S, { $, $$, esc, el, ic } = ML;
  const CENTRO = [-15.79, -47.88]; // Brasília
  const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATRIB = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

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

  function pin(L, x) {
    const rot = esc(x.cli.sigla || String(x.l.registro));
    return L.divIcon({ className: "", iconSize: null, iconAnchor: [16, 34], popupAnchor: [0, -30],
      html: `<div class="pin pin-${x.estado} ${x.l.local && /bairro|rua/.test(x.l.local.precisao || "") ? "pin-aprox" : ""}"><span>${rot}</span></div>` });
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
  function novoMapa(L, div, opcoes) {
    const m = L.map(div, Object.assign({ zoomControl: true, attributionControl: true }, opcoes || {})).setView(CENTRO, 11);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATRIB }).addTo(m);
    return m;
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
    ML.carregarLeaflet().then((L) => {
      if (!div.isConnected) return;
      const m = novoMapa(L, div);
      const pts = [];
      for (const x of lista.filter((y) => y.temPos && filtra(y))) {
        const ll = [+x.l.local.lat, +x.l.local.lng];
        const mk = L.marker(ll, { icon: pin(L, x), riseOnHover: true }).addTo(m).bindPopup(popupHtml(x), { minWidth: 240 });
        marcadores.set(x.l.registro, mk); pts.push(ll);
      }
      if (pts.length === 1) m.setView(pts[0], 14); else if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
      main._mapa = m;
      setTimeout(() => m.invalidateSize(), 60);
    }).catch((e) => { div.innerHTML = `<div class="vazio">Não consegui carregar o mapa: ${esc(ML.msgErro(e))}</div>`; });
    main.addEventListener("click", (e) => {
      const t = e.target.closest("[data-filtro],[data-ir],[data-local],[data-pop-renovar],[data-pop-local],[data-reg],[data-acao]"); if (!t) return;
      if (t.dataset.acao === "localizar-todas") return localizarTodas(lista);
      if (t.dataset.filtro) { st.filtro = t.dataset.filtro; return ML.render(); }
      if (t.dataset.popRenovar) return ML.abrirEditor({ modo: "renovar", registro: +t.dataset.popRenovar });
      if (t.dataset.popLocal || t.dataset.local) return definirLocal(S.loc.get(+(t.dataset.popLocal || t.dataset.local)));
      const reg = +(t.dataset.ir || t.dataset.reg), mk = marcadores.get(reg);
      if (mk && main._mapa) { main._mapa.setView(mk.getLatLng(), Math.max(main._mapa.getZoom(), 14)); mk.openPopup(); }
      else if (t.dataset.reg && !mk) definirLocal(S.loc.get(reg));
    });
  };

  // ================================================================ cartão do Painel
  ML.miniMapa = function (div) {
    const lista = ativas().filter((x) => x.temPos);
    ML.carregarLeaflet().then((L) => {
      if (!div.isConnected) return;
      const m = novoMapa(L, div, { zoomControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile });
      const pts = lista.map((x) => { const ll = [+x.l.local.lat, +x.l.local.lng]; L.marker(ll, { icon: pin(L, x) }).addTo(m).bindPopup(popupHtml(x), { minWidth: 220 }); return ll; });
      if (pts.length === 1) m.setView(pts[0], 13); else if (pts.length) m.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
      setTimeout(() => m.invalidateSize(), 60);
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
  ML.geocodificar = async function (o) {
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
      return { lat: Math.round(+melhor.x.lat * 1e6) / 1e6, lng: Math.round(+melhor.x.lon * 1e6) / 1e6, precisao, achado: melhor.x.display_name, consulta: q };
    }
    return null;
  };
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
    const local = Object.assign({}, l.local || {}, { lat: r.lat, lng: r.lng, precisao: r.precisao, fonte: alvo.fonte, achado: r.achado });
    if (!local.endereco && alvo.fonte === "cliente") local.endereco = "";
    await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local } });
    l.local = local;
    if (!o.silencioso) ML.aviso(r.precisao === "endereco" ? "Marcado no mapa." : `Marcado no mapa — ${ML.textoPrecisao(r.precisao)}. Confira o ponto.`, "ok");
    return r;
  };
  async function localizarTodas(lista) {
    const fila = lista.filter((x) => !x.temPos && enderecoParaBusca(x.l));
    if (!fila.length) return ML.aviso("Nenhuma locação sem ponto tem endereço para procurar. Cadastre o endereço da obra ou do cliente.", "erro");
    const corpo = el(`<div><p style="margin:0 0 10px">Procurando ${fila.length} endereço(s) — leva cerca de ${Math.ceil(fila.length * 2.5)} segundos (o serviço gratuito aceita uma busca por segundo).</p>
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
    let mapa = null, mk = null, Lr = null, precisao = loc.precisao || (pos ? "manual" : ""), pendente = null;
    const marcar = (ll, centrar, prec) => {
      pos = [Math.round(ll[0] * 1e6) / 1e6, Math.round(ll[1] * 1e6) / 1e6];
      precisao = prec || "manual";
      if (!mapa) { pendente = centrar; return; }
      if (!mapa) return;
      if (!mk) { mk = Lr.marker(pos, { draggable: true }).addTo(mapa); mk.on("dragend", () => { const p = mk.getLatLng(); pos = [p.lat, p.lng]; precisao = "manual"; }); }
      else mk.setLatLng(pos);
      if (centrar) mapa.setView(pos, Math.max(mapa.getZoom(), 16));
    };
    const botoes = [{ texto: "Cancelar" }, { texto: "Salvar local", classe: "primario", acao: async () => {
      if (!pos) { $("[data-erro]", corpo).textContent = "Marque o ponto da obra no mapa (busque o endereço ou clique no mapa)."; $("[data-erro]", corpo).hidden = false; return false; }
      await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local: Object.assign({}, loc, { nome: $("[data-nome-local]", corpo).value.trim().toUpperCase(), endereco: $("[data-end]", corpo).value.trim(), lat: pos[0], lng: pos[1], precisao, fonte: "obra" }) } });
      ML.aviso("Local da obra salvo.", "ok"); await ML.recarregarERender();
    } }];
    if (l.local && l.local.lat != null) botoes.unshift({ texto: "Remover do mapa", classe: "perigo", esquerda: true, acao: async () => {
      await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local: loc.nome ? { nome: loc.nome } : null } });
      ML.aviso("Ponto do mapa removido."); await ML.recarregarERender();
    } });
    ML.modal({ titulo: "Local da obra", corpo, classe: "medio", botoes });
    ML.carregarLeaflet().then((L) => {
      Lr = L;
      mapa = novoMapa(L, $("[data-mapa]", corpo));
      mapa.on("click", (e) => marcar([e.latlng.lat, e.latlng.lng], false, "manual"));
      if (pos) { const pr = precisao; marcar(pos, false, pr); mapa.setView(pos, pendente ? 16 : (pr === "bairro" ? 14 : 16)); }
      setTimeout(() => mapa.invalidateSize(), 80);
    });
    // abriu sem ponto e com endereço: procura sozinho
    if (!pos && $("[data-end]", corpo).value.trim()) setTimeout(buscar, 150);
    async function buscar() {
      const q = $("[data-end]", corpo).value.trim(), res = $("[data-resultados]", corpo), info = $("[data-geo-info]", corpo);
      if (!q) return;
      res.hidden = false; res.innerHTML = '<div class="muted" style="padding:8px">Procurando o endereço…</div>';
      try {
        const usaCliente = !loc.endereco && q === sugestao;
        const r = await ML.geocodificar({ endereco: q, cidade: cli.cidade, uf: cli.uf, cep: usaCliente ? cli.cep : "", fonte: usaCliente ? "cliente" : "obra" });
        if (!corpo.isConnected) return;
        if (!r) { res.innerHTML = '<div class="muted" style="padding:8px">Não achei esse endereço. Aproxime o mapa e clique no ponto da obra.</div>'; return; }
        res.hidden = true;
        marcar([r.lat, r.lng], true, r.precisao);
        if (mapa && r.precisao === "bairro") mapa.setView(pos, 14);
        info.innerHTML = r.precisao === "endereco" ? `✅ Achei: <i>${esc(r.achado)}</i>. Se não for o ponto exato, arraste o marcador.`
          : `🟠 ${r.precisao === "rua" ? "Achei a rua/quadra" : "Achei só o bairro/região"}: <i>${esc(r.achado)}</i>. Arraste o marcador até a obra para ficar exato.`;
      } catch (e) { res.innerHTML = '<div class="muted" style="padding:8px">A busca de endereços não respondeu. Clique direto no mapa para marcar.</div>'; }
    }
    $("[data-buscar]", corpo).addEventListener("click", buscar);
    $("[data-end]", corpo).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } });
  }
  ML.definirLocal = definirLocal;
})();
