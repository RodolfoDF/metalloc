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
      html: `<div class="pin pin-${x.estado}"><span>${rot}</span></div>` });
  }
  function popupHtml(x) {
    return `<div class="pop"><b>${esc(x.cli.razaoSocial || "")}</b>
      <small>Locação ${esc(C.padReg(x.l.registro, S.cfg.digitosRegistro))}${x.u ? " · " + esc(x.u.id) : ""}</small>
      <div class="pop-eq">${x.equips.map((e) => `<span class="etq">${esc(e)}</span>`).join(" ") || '<span class="muted">sem equipamento</span>'}</div>
      ${x.u && x.u.periodoFim ? `<div>Período até <b>${C.dataBR(x.u.periodoFim)}</b> · <span class="pin-txt-${x.estado}">${esc(x.dias != null ? ML.textoDias(x.dias) : "")}</span></div>` : ""}
      ${x.l.local && x.l.local.endereco ? `<small class="muted">${esc(x.l.local.endereco)}</small>` : ""}
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
        <div class="sub">${lista.length} locações ativas · ${nEq} equipamento(s) na rua · ${cont.semlocal ? `<b>${cont.semlocal} sem local definido</b>` : "todas com local"}</div></div>
      <div class="mapa-grade">
        <div class="cartao mapa-cartao"><div class="mapa-grande" data-mapa></div></div>
        <div class="cartao mapa-lado">
          <div class="chips" style="margin-bottom:10px">${[["todas", "Todas"], ["renovar", "Renovar"], ["cobrar", "Cobrar"], ["semlocal", "Sem local"]]
            .map(([k, t]) => `<button class="chip ${st.filtro === k ? "ativo" : ""}" data-filtro="${k}">${t}<span class="n">${cont[k]}</span></button>`).join("")}</div>
          <div class="mapa-lista">${vis.map((x) => `<div class="ml-item" data-reg="${x.l.registro}">
            <i class="pt-mapa pin-${x.estado}"></i>
            <div class="ml-tx"><b>${x.cli.sigla ? `<span class="sigla">${esc(x.cli.sigla)}</span> ` : ""}${esc(x.cli.razaoSocial || "")}</b>
              <small>${esc(x.equips.join(" · ") || "sem equipamento")}</small>
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
      const t = e.target.closest("[data-filtro],[data-ir],[data-local],[data-pop-renovar],[data-pop-local],[data-reg]"); if (!t) return;
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

  // ================================================================ definir o local da obra
  function definirLocal(l) {
    if (!l) return;
    const cli = S.cli.get(l.clienteId) || {};
    const loc = l.local || {};
    const sugestao = loc.endereco || [cli.endereco, cli.cidade, cli.uf].filter(Boolean).join(", ");
    let pos = isFinite(+loc.lat) && loc.lat !== "" && loc.lat != null ? [+loc.lat, +loc.lng] : null;
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:10px">
      <div class="aviso-linha"><b>${esc(cli.razaoSocial || "")}</b> · locação ${esc(C.padReg(l.registro, S.cfg.digitosRegistro))}</div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <label class="campo" style="flex:1"><span>Endereço da obra</span><input data-end value="${esc(sugestao)}" placeholder="Rua, número, bairro, cidade"></label>
        <button class="btn" data-buscar>${ic("busca")}Buscar</button></div>
      <div data-resultados class="resultados-geo" hidden></div>
      <div class="mapa-modal" data-mapa></div>
      <small class="muted">Clique no mapa para marcar o ponto exato da obra, ou arraste o marcador. Endereços de Brasília (quadras, conjuntos) nem sempre são achados pela busca — nesse caso, aproxime o mapa e clique no local.</small>
      <div class="erro" data-erro hidden></div></div>`);
    let mapa = null, mk = null, Lr = null;
    const marcar = (ll, centrar) => {
      pos = [Math.round(ll[0] * 1e6) / 1e6, Math.round(ll[1] * 1e6) / 1e6];
      if (!mapa) return;
      if (!mk) { mk = Lr.marker(pos, { draggable: true }).addTo(mapa); mk.on("dragend", () => { const p = mk.getLatLng(); pos = [p.lat, p.lng]; }); }
      else mk.setLatLng(pos);
      if (centrar) mapa.setView(pos, Math.max(mapa.getZoom(), 16));
    };
    const botoes = [{ texto: "Cancelar" }, { texto: "Salvar local", classe: "primario", acao: async () => {
      if (!pos) { $("[data-erro]", corpo).textContent = "Marque o ponto da obra no mapa (busque o endereço ou clique no mapa)."; $("[data-erro]", corpo).hidden = false; return false; }
      await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local: { endereco: $("[data-end]", corpo).value.trim(), lat: pos[0], lng: pos[1] } } });
      ML.aviso("Local da obra salvo.", "ok"); await ML.recarregarERender();
    } }];
    if (l.local) botoes.unshift({ texto: "Remover local", classe: "perigo", esquerda: true, acao: async () => {
      await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { local: null } });
      ML.aviso("Local removido."); await ML.recarregarERender();
    } });
    ML.modal({ titulo: "Local da obra", corpo, classe: "medio", botoes });
    ML.carregarLeaflet().then((L) => {
      Lr = L;
      mapa = novoMapa(L, $("[data-mapa]", corpo));
      mapa.on("click", (e) => marcar([e.latlng.lat, e.latlng.lng], false));
      if (pos) { marcar(pos, false); mapa.setView(pos, 16); }
      setTimeout(() => mapa.invalidateSize(), 80);
    });
    async function buscar() {
      const q = $("[data-end]", corpo).value.trim(), res = $("[data-resultados]", corpo);
      if (!q) return;
      res.hidden = false; res.innerHTML = '<div class="muted" style="padding:8px">Buscando…</div>';
      try {
        const url = "https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=5&accept-language=pt-BR&q=" + encodeURIComponent(q);
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        const lista = await r.json();
        if (!lista.length) { res.innerHTML = '<div class="muted" style="padding:8px">Endereço não encontrado. Tente só bairro e cidade, ou clique direto no mapa.</div>'; return; }
        res.innerHTML = lista.map((x, i) => `<button data-res="${i}">${ic("mapa")}<span>${esc(x.display_name)}</span></button>`).join("");
        res.onclick = (e) => {
          const b = e.target.closest("[data-res]"); if (!b) return;
          const x = lista[+b.dataset.res];
          marcar([+x.lat, +x.lon], true); res.hidden = true;
        };
        if (lista.length === 1) { marcar([+lista[0].lat, +lista[0].lon], true); res.hidden = true; }
      } catch (e) { res.innerHTML = '<div class="muted" style="padding:8px">A busca de endereços não respondeu. Clique direto no mapa para marcar.</div>'; }
    }
    $("[data-buscar]", corpo).addEventListener("click", buscar);
    $("[data-end]", corpo).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } });
  }
  ML.definirLocal = definirLocal;
})();
