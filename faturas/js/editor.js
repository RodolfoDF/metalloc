// Editor de fatura: nova locação, renovação e edição — com pré-visualização do PDF ao lado.
(function () {
  "use strict";
  const ML = window.ML, C = ML.C, S = ML.S, { $, $$, esc, el, ic, vg } = ML;

  // ---------------------------------------------------------------- seletor de donos (usado no compositor e em “alterar donos”)
  // est = { donos: [{donoId, pct}], subParceiro, subCusto }
  function donosAtivos() { return S.donos.filter((d) => !d.inativo); }
  function distribuirIgual(lista) {
    const n = lista.length; if (!n) return;
    const base = Math.floor(10000 / n) / 100;
    lista.forEach((d, i) => { d.pct = i === n - 1 ? Math.round((100 - base * (n - 1)) * 100) / 100 : base; });
  }
  function validarDonos(est) {
    if (!est.donos.length) return "Marque o(s) dono(s) do equipamento.";
    const soma = est.donos.reduce((s, d) => s + (+d.pct || 0), 0);
    if (est.donos.some((d) => !(+d.pct > 0))) return "Informe o percentual de cada dono.";
    if (Math.abs(soma - 100) > 0.011) return `Os percentuais dos donos devem somar 100% (estão somando ${C.pctBR(soma)}%).`;
    if (est.donos.some((d) => C.ehSub(d))) {
      if (!String(est.subParceiro || "").trim()) return "Informe a empresa parceira da sublocação.";
      if (!(C.numBR(est.subCusto) >= 0)) return "Informe o custo da sublocação.";
    }
    return null;
  }
  function parceirosConhecidos() {
    const s = new Set();
    for (const f of S.faturas) for (const it of f.itens || []) if (it.subParceiro) s.add(it.subParceiro);
    return [...s].sort();
  }
  function seletorDonos(cont, est, aoMudar) {
    function desenhar() {
      const marcado = (id) => est.donos.some((d) => d.donoId === id);
      const temSub = est.donos.some((d) => C.ehSub(d));
      cont.innerHTML = `
        <div class="donos-esc">${donosAtivos().map((d) => `<span class="dono-chip ${d.tipo === "sublocado" ? "sub" : ""} ${marcado(d.id) ? "marcado" : ""}" data-dono="${esc(d.id)}">
          <input type="checkbox" tabindex="-1" ${marcado(d.id) ? "checked" : ""}>${esc(d.nome)}</span>`).join("")}</div>
        ${est.donos.length > 1 ? `<div class="pcts">${est.donos.map((d) => `<label>${esc(S.nomes[d.donoId] || d.nome)}<input inputmode="decimal" data-pct="${esc(d.donoId)}" value="${C.pctBR(d.pct)}">%</label>`).join("")}</div>` : ""}
        ${temSub ? `<div class="linha-campos c2">
          <label class="campo"><span>Empresa parceira (de quem sublocamos)</span><input data-sub="parceiro" list="lista-parceiros" value="${esc(est.subParceiro || "")}"></label>
          <label class="campo"><span>Custo da sublocação (R$)</span><input data-sub="custo" inputmode="decimal" value="${est.subCusto === "" || est.subCusto == null ? "" : C.moeda(C.numBR(est.subCusto), true)}"></label></div>
          <small class="muted">Comissão do representante = ${C.pctBR((S.cfg.comissao || {}).pct || 5)}% sobre (valor da locação − custo da sublocação).</small>
          <datalist id="lista-parceiros">${parceirosConhecidos().map((p) => `<option value="${esc(p)}">`).join("")}</datalist>` : ""}`;
    }
    cont.addEventListener("click", (e) => {
      const ch = e.target.closest("[data-dono]"); if (!ch) return;
      const id = ch.dataset.dono, d = S.donos.find((x) => x.id === id);
      const i = est.donos.findIndex((x) => x.donoId === id);
      if (i >= 0) est.donos.splice(i, 1);
      else if (d.tipo === "sublocado") est.donos = [{ donoId: id, nome: d.nome, pct: 100, tipo: "sublocado" }];
      else { est.donos = est.donos.filter((x) => !C.ehSub(x)); est.donos.push({ donoId: id, nome: d.nome, pct: 0 }); }
      distribuirIgual(est.donos);
      desenhar(); aoMudar && aoMudar();
    });
    cont.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.pct) { const d = est.donos.find((x) => x.donoId === t.dataset.pct); if (d) d.pct = C.numBR(t.value); }
      if (t.dataset.sub === "parceiro") est.subParceiro = t.value;
      if (t.dataset.sub === "custo") est.subCusto = t.value;
      aoMudar && aoMudar();
    });
    cont.addEventListener("focusout", (e) => { if (e.target.dataset.sub === "custo" && e.target.value) e.target.value = C.moeda(C.numBR(e.target.value), true); });
    desenhar();
    return { desenhar };
  }
  function donosDoItem(est) {
    return est.donos.map((d) => {
      const cad = S.donos.find((x) => x.id === d.donoId);
      return { donoId: d.donoId, nome: cad ? cad.nome : d.nome, pct: Math.round((+d.pct || 0) * 100) / 100 };
    });
  }
  function aplicarDonosNoItem(it, est) {
    it.donos = donosDoItem(est);
    if (est.donos.some((d) => C.ehSub(d))) { it.subParceiro = String(est.subParceiro || "").trim(); it.subCusto = Math.round(C.numBR(est.subCusto) * 100) / 100; }
    else { delete it.subParceiro; delete it.subCusto; }
  }
  ML.seletorDonos = seletorDonos; ML.validarDonos = validarDonos; ML.donosDoItem = donosDoItem;

  // ---------------------------------------------------------------- editor
  const proximoLivre = () => { let r = Math.max(1, +S.cfg.proximoRegistro || 1); while (S.loc.has(r)) r++; return r; };
  const equipsConhecidos = () => {
    const s = new Set();
    for (const f of S.faturas) for (const it of f.itens || []) if (it.equip) s.add(it.equip);
    return [...s].sort();
  };
  const copia = (o) => JSON.parse(JSON.stringify(o));

  ML.abrirEditor = function (op) {
    if ($(".editor")) return;
    const modo = op.modo, cfg = S.cfg, d = C.hoje();
    const dias = +cfg.diasVencimento || 15;
    const E = { modo, itens: [], frete: { incluir: true, descricao: "FRETE", qtd: 1, unitario: 0 }, vencAuto: true, discAuto: modo === "nova", atualizarCadastro: false };
    let orig = null, loc = null;

    if (modo === "nova") {
      const per = { ini: d, fim: C.addDias(C.addMeses(d, 1), -1) };
      Object.assign(E, { clienteId: op.clienteId || "", emissorId: cfg.emissorPadraoId || (S.emissores[0] || {}).id || "", sigla: "", regAuto: true, regManual: "", seqInicial: 0,
        servico: "", dataInicio: d, dataEmissao: d, periodoIni: per.ini, periodoFim: per.fim, vencimento: C.addDias(d, dias),
        discriminacao: "", outrasInfo: cfg.textoOutrasInfo || "", obs: "", enderecoObra: "", localNome: "" });
      if (E.clienteId) E.sigla = (S.cli.get(E.clienteId) || {}).sigla || C.sugerirSigla((S.cli.get(E.clienteId) || {}).razaoSocial);
    } else if (modo === "renovar") {
      loc = S.loc.get(op.registro); orig = ML.ultimaFatura(op.registro);
      if (!loc || !orig) return ML.aviso("Locação sem fatura anterior para renovar.", "erro");
      if (loc.status !== "ativa") return ML.aviso("Esta locação está encerrada. Reative em “Dados da locação” para renovar.", "erro");
      const per = orig.periodoIni && orig.periodoFim ? C.proximoPeriodo(orig.periodoIni, orig.periodoFim) : { ini: d, fim: C.addDias(C.addMeses(d, 1), -1) };
      const fr = (orig.itens || []).find((i) => i.frete);
      Object.assign(E, { clienteId: loc.clienteId, emissorId: loc.emissorId, dataEmissao: d, periodoIni: per.ini, periodoFim: per.fim, vencimento: C.addDias(d, dias),
        discriminacao: orig.discriminacao || "", outrasInfo: orig.outrasInfo || cfg.textoOutrasInfo || "", obs: orig.obs || "",
        itens: copia((orig.itens || []).filter((i) => !i.frete)).map((it) => { if (it.periodo) it.descricao = C.trocarPeriodoDescricao(it.descricao, per.ini, per.fim); return it; }),
        frete: fr ? { incluir: true, descricao: fr.descricao || "FRETE", qtd: fr.qtd || 1, unitario: 0 } : { incluir: false, descricao: "FRETE", qtd: 1, unitario: 0 } });
    } else {
      orig = ML.fatura(op.registro, op.seq); loc = S.loc.get(op.registro) || {};
      if (!orig) return ML.aviso("Fatura não encontrada.", "erro");
      const fr = (orig.itens || []).find((i) => i.frete);
      Object.assign(E, { clienteId: (orig.tomador || {}).id || loc.clienteId, emissorId: (orig.prestador || {}).id || loc.emissorId, dataEmissao: orig.dataEmissao || d,
        periodoIni: orig.periodoIni || "", periodoFim: orig.periodoFim || "", vencimento: orig.vencimento || "", vencAuto: false,
        discriminacao: orig.discriminacao || "", outrasInfo: orig.outrasInfo || "", obs: orig.obs || "",
        itens: copia((orig.itens || []).filter((i) => !i.frete)),
        frete: fr ? { incluir: true, descricao: fr.descricao || "FRETE", qtd: fr.qtd || 1, unitario: fr.unitario || 0 } : { incluir: false, descricao: "FRETE", qtd: 1, unitario: 0 } });
    }
    const comp = { equip: "", qtd: 1, unitario: "", donos: [], subParceiro: "", subCusto: "", equipId: "", tag: "" };
    const acharEq = (txt) => {
      const t = String(txt || "").trim().toUpperCase(); if (!t) return null;
      const tag = t.split(" — ")[0].trim();
      return (S.equip || []).find((e) => e.tag.toUpperCase() === tag) || (S.equip || []).find((e) => (e.apelido || "").toUpperCase() === t) || null;
    };
    let sujo = false;

    // ----------------------------- cálculos
    const cliente = () => S.cli.get(E.clienteId);
    const emissor = () => S.emissores.find((e) => e.id === E.emissorId);
    const registroPrev = () => modo === "nova" ? (E.regAuto ? proximoLivre() : (+E.regManual || 0)) : orig.registro;
    const seqPrev = () => modo === "nova" ? (+E.seqInicial || 0) : modo === "renovar" ? orig.seq + 1 : orig.seq;
    const siglaPrev = () => modo === "nova" ? C.limparSigla(E.sigla) : modo === "renovar" ? C.limparSigla((cliente() || {}).sigla || "") : (orig.sigla || "");
    const numeroPrev = () => modo === "editar" ? orig.id : C.numeroFatura(siglaPrev(), registroPrev(), seqPrev(), cfg.digitosRegistro);
    const equipsTxt = () => [...new Set(E.itens.map((i) => i.equip).filter(Boolean))].join(" + ");
    const servicoEfetivo = () => E.servico.trim() || ("LOCAÇÃO DE " + (equipsTxt() || "EQUIPAMENTO") + " - INSTALAÇÃO").toUpperCase();
    function discAutomatica() {
      const reg = E.regAuto ? "{REGISTRO}" : C.padReg(+E.regManual || 0, cfg.digitosRegistro);
      return `CONTRATO ${reg} - ${servicoEfetivo()} – ${C.dataBR(E.dataInicio)}`;
    }
    const itensFinais = () => {
      const l = E.itens.map((i) => Object.assign({}, i, { qtd: +i.qtd || 0, unitario: Math.round(C.numBR(i.unitario) * 100) / 100 }));
      if (E.frete.incluir) l.push({ descricao: E.frete.descricao || "FRETE", qtd: +E.frete.qtd || 1, unitario: Math.round(C.numBR(E.frete.unitario) * 100) / 100, frete: true });
      return l;
    };
    function montarFatura() {
      const cli = cliente() || {}, emi = emissor() || {};
      const itens = itensFinais();
      let disc = modo === "nova" && E.discAuto ? discAutomatica() : E.discriminacao;
      disc = disc.replace(/\{REGISTRO\}/g, C.padReg(registroPrev(), cfg.digitosRegistro));
      const tomador = modo === "editar" && !E.atualizarCadastro ? orig.tomador : Object.assign({}, cli, { sigla: siglaPrev() });
      const prestador = modo === "editar" && !E.atualizarCadastro ? orig.prestador : emi;
      return { id: numeroPrev(), sigla: siglaPrev(), registro: registroPrev(), seq: seqPrev(), dataEmissao: E.dataEmissao, periodoIni: E.periodoIni, periodoFim: E.periodoFim,
        vencimento: E.vencimento, discriminacao: disc, itens, total: C.totalItens(itens), tomador, prestador, outrasInfo: E.outrasInfo,
        status: modo === "editar" ? orig.status : "emitida", atualizadoEm: C.agoraISO() };
    }

    // ----------------------------- tela
    const titulo = modo === "nova" ? "Nova fatura" : modo === "renovar" ? "Renovar locação" : "Editar fatura";
    const ed = el(`<div class="editor" role="dialog" aria-modal="true">
      <div class="editor-cab"><h2>${titulo}</h2><span class="num-prev" data-num></span>
        <div class="direita"><button class="btn peq ver-prev-btn" data-acao="prev" style="display:none">${ic("olho")}Ver PDF</button>
        <button class="ic-btn" data-acao="fechar" title="Fechar">${ic("x")}</button></div></div>
      <div class="editor-corpo"><div class="editor-form"></div>
        <div class="editor-prev"><iframe title="Pré-visualização"></iframe><span class="prev-status" data-prev-st>montando…</span></div></div>
      <div class="editor-rod"><div class="total"><span class="muted">Total</span><span data-total></span></div>
        <button class="btn" data-acao="fechar">Cancelar</button>
        <button class="btn primario" data-acao="salvar">${ic("check")}${modo === "editar" ? "Salvar alterações" : "Emitir fatura"}</button></div></div>`);
    const form = $(".editor-form", ed);
    if (window.matchMedia("(max-width: 1180px)").matches) $(".ver-prev-btn", ed).style.display = "";

    const secCliente = modo === "nova" ? `
      <section class="secao"><h3>Cliente e locação</h3>
        <div style="display:flex;gap:8px;align-items:flex-end">
          <label class="campo" style="flex:1"><span>Cliente</span><input data-k="clienteTxt" list="lista-clientes" placeholder="Digite o nome ou CNPJ" autocomplete="off"></label>
          <button class="btn" data-acao="novo-cliente" title="Cadastrar cliente">${ic("mais")}Novo</button></div>
        <datalist id="lista-clientes">${S.clientes.map((c) => `<option value="${esc(c.razaoSocial)}">${esc((c.fantasia ? c.fantasia + " · " : "") + (c.documento || ""))}</option>`).join("")}</datalist>
        <div class="aviso-linha" data-cli-info hidden></div>
        <div class="linha-campos c3">
          <label class="campo"><span>Sigla do cliente</span><input data-k="sigla" maxlength="5" style="text-transform:uppercase"><small>vai no número da fatura</small></label>
          <label class="campo"><span>Registro</span><select data-k="regAuto"><option value="1">Automático</option><option value="0">Informar manualmente</option></select></label>
          <label class="campo" data-reg-manual hidden><span>Nº do registro</span><input data-k="regManual" type="number" min="1"></label>
          <label class="campo"><span>Período inicial</span><input data-k="seqInicial" type="number" min="0"><small>0 = 1º mês</small></label>
        </div>
        <div class="aviso-linha verm" data-reg-aviso hidden></div>
        <label class="campo"><span>Prestador de serviços</span><select data-k="emissorId">${S.emissores.map((e) => `<option value="${esc(e.id)}">${esc(e.razaoSocial)}</option>`).join("")}</select></label>
      </section>` : `
      <section class="secao"><h3>${modo === "renovar" ? "Renovação" : "Fatura"}</h3>
        <div><b>${esc(ML.nomeCliente(E.clienteId))}</b><br><small class="muted">Locação ${esc(C.padReg(orig.registro, cfg.digitosRegistro))} · ${modo === "renovar" ? `renovando a partir de <b>${esc(orig.id)}</b> (${C.dataBRc(orig.periodoIni)} a ${C.dataBRc(orig.periodoFim)})` : `emitida em ${C.dataBR(orig.dataEmissao)}${orig.emitidoPor ? " por " + esc(orig.emitidoPor) : ""}`}</small></div>
        ${modo === "renovar" && !(cliente() || {}).sigla ? `<div class="aviso-linha lar">Este cliente ainda não tem sigla. Cadastre em Clientes para ela aparecer no número.</div>` : ""}
        ${modo === "editar" ? `<label class="check"><input type="checkbox" data-k="atualizarCadastro"> Atualizar dados do cliente e do prestador com o cadastro atual</label>` : ""}
      </section>`;

    form.innerHTML = secCliente + `
      <section class="secao"><h3>Datas</h3>
        <div class="linha-campos c2">
          <label class="campo"><span>Data de emissão</span><input type="date" data-k="dataEmissao"></label>
          <label class="campo"><span>Vencimento</span><input type="date" data-k="vencimento"><small data-venc-info></small></label>
          <label class="campo"><span>Período — início</span><input type="date" data-k="periodoIni"></label>
          <label class="campo"><span>Período — fim</span><input type="date" data-k="periodoFim"></label>
        </div>
        <div class="chips" data-atalhos-per>
          <button class="chip" data-per="7">7 dias</button><button class="chip" data-per="15">15 dias</button><button class="chip" data-per="m1">1 mês</button>
        </div>
      </section>
      <section class="secao"><h3>Discriminação dos serviços</h3>
        ${modo === "nova" ? `<div class="linha-campos c2">
          <label class="campo"><span>Serviço</span><input data-k="servico" data-placeholder-servico></label>
          <label class="campo"><span>Data de implantação</span><input type="date" data-k="dataInicio"><small>a mesma para todos os equipamentos</small></label></div>
        <div class="linha-campos c2">
          <label class="campo"><span>Local de operação</span><input data-k="localNome" list="lista-locais-ed" placeholder="ex.: GEALI TAGUATINGA" style="text-transform:uppercase"></label>
          <label class="campo"><span>Endereço da obra (opcional)</span><input data-k="enderecoObra" placeholder="para achar no mapa"></label></div>
        <datalist id="lista-locais-ed">${ML.locaisConhecidos().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}
        <label class="campo"><span>Texto da discriminação ${modo === "nova" ? `<a href="#" data-acao="refazer-disc" style="float:right;font-weight:400;color:var(--laranja-esc)">refazer automático</a>` : ""}</span><textarea data-k="discriminacao" rows="2"></textarea></label>
      </section>
      <section class="secao"><h3>Equipamentos <span class="dir muted" data-itens-info></span></h3>
        <div class="compositor">
          ${(S.equip || []).length ? `<label class="campo"><span>Equipamento do inventário (tag)</span><input data-inv list="lista-inv" placeholder="Digite a tag ou o apelido — preenche tipo e donos" autocomplete="off"></label>
          <datalist id="lista-inv">${S.equip.filter((e) => e.situacao !== "inativo").map((e) => `<option value="${esc(ML.rotuloEq(e))}">${esc(ML.NOME_SIT_EQ[ML.situacaoEquip(e)])}</option>`).join("")}</datalist>
          <div class="aviso-linha" data-inv-info hidden></div>` : ""}
          <div class="linha-campos" style="grid-template-columns:1fr 70px 130px">
            <label class="campo"><span>Equipamento</span><input data-c="equip" list="lista-equips" placeholder="ex.: PLATAFORMA ARTICULADA"></label>
            <label class="campo"><span>Qtde</span><input data-c="qtd" inputmode="decimal" value="1"></label>
            <label class="campo"><span>Valor do período</span><input data-c="unitario" inputmode="decimal" placeholder="0,00"></label></div>
          <datalist id="lista-equips">${equipsConhecidos().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
          <div><div class="muted" style="font-size:12.5px;margin-bottom:6px">Dono(s) do equipamento</div><div data-comp-donos></div></div>
          <div class="erro" data-comp-erro hidden></div>
          <button class="btn primario" data-acao="inserir" style="align-self:flex-start">${ic("mais")}Inserir nos itens</button>
        </div>
        <div class="itens-ed" data-itens></div>
      </section>
      <section class="secao"><h3>Outras informações</h3>
        <label class="campo"><span>Texto que sai na fatura</span><textarea data-k="outrasInfo" rows="3"></textarea></label>
        <label class="campo"><span>Observação interna (não sai na fatura)</span><input data-k="obs"></label>
      </section>`;
    document.body.appendChild(ed);
    ML.hidratarIcones(ed);

    // ----------------------------- ligação dos campos
    const campo = (k) => $(`[data-k="${k}"]`, ed);
    for (const k of ["sigla", "regManual", "seqInicial", "emissorId", "dataEmissao", "vencimento", "periodoIni", "periodoFim", "servico", "dataInicio", "discriminacao", "outrasInfo", "obs"]) {
      const c = campo(k); if (c) c.value = E[k] == null ? "" : E[k];
    }
    if (campo("regAuto")) campo("regAuto").value = E.regAuto ? "1" : "0";
    if (campo("clienteTxt") && cliente()) campo("clienteTxt").value = cliente().razaoSocial;

    if (ML.autocompletarEndereco && campo("enderecoObra")) ML.autocompletarEndereco(campo("enderecoObra"));
    const compDonos = seletorDonos($("[data-comp-donos]", ed), comp, () => {});
    ed.addEventListener("input", (e) => {
      const t = e.target, k = t.dataset.k;
      sujo = true;
      if (t.dataset.c) { comp[t.dataset.c] = t.value; return; }
      if (t.dataset.inv != null) {
        const eq = acharEq(t.value), info = $("[data-inv-info]", ed);
        comp.equipId = eq ? eq.id : ""; comp.tag = eq ? eq.tag : "";
        if (!eq) { info.hidden = true; return; }
        comp.equip = eq.tipo || eq.apelido || ""; $('[data-c="equip"]', ed).value = comp.equip;
        comp.donos = (eq.donos || []).map((d) => Object.assign({}, d, { tipo: C.ehSub(d) ? "sublocado" : "dono" }));
        comp.subParceiro = eq.subParceiro || ""; comp.subCusto = eq.subCusto == null ? "" : eq.subCusto;
        compDonos.desenhar();
        const uso = S.emUso.get(eq.id), sitEq = ML.situacaoEquip(eq);
        info.hidden = false;
        info.className = "aviso-linha" + (uso && (!orig || uso.l.registro !== orig.registro) ? " lar" : sitEq === "manutencao" ? " verm" : "");
        info.innerHTML = `<b>${esc(eq.tag)}</b> · ${esc(ML.descEq(eq))}` + (uso && (!orig || uso.l.registro !== orig.registro) ? ` — <b>já está locado</b> para ${esc(ML.nomeCliente(uso.l.clienteId))} (${esc(uso.u.id)})` : sitEq === "manutencao" ? " — <b>em manutenção</b>" : "");
        return;
      }
      if (!k) return;
      if (k === "clienteTxt") {
        const v = t.value.trim().toLowerCase();
        const c = S.clientes.find((x) => (x.razaoSocial || "").toLowerCase() === v) || S.clientes.find((x) => (x.documento || "") && x.documento === t.value.trim());
        E.clienteId = c ? c.id : "";
        if (c) { E.sigla = c.sigla || C.sugerirSigla(c.razaoSocial); campo("sigla").value = E.sigla; }
      } else if (k === "atualizarCadastro") E.atualizarCadastro = t.checked;
      else if (k === "regAuto") E.regAuto = t.value === "1";
      else E[k] = t.value;
      if (k === "discriminacao") E.discAuto = false;
      if (k === "vencimento") E.vencAuto = false;
      if (k === "dataEmissao" && E.vencAuto) { E.vencimento = C.addDias(E.dataEmissao, dias); campo("vencimento").value = E.vencimento; }
      if (k === "periodoIni" || k === "periodoFim") atualizarPeriodoItens();
      if (k === "periodoIni" && modo === "nova" && E.dataInicio === anteriorIni) { E.dataInicio = E.periodoIni; campo("dataInicio").value = E.dataInicio; }
      if (k === "periodoIni") anteriorIni = E.periodoIni;
      atualizar();
    });
    let anteriorIni = E.periodoIni;
    ed.addEventListener("change", (e) => { if (e.target.dataset.k === "regAuto" || e.target.dataset.k === "atualizarCadastro") e.target.dispatchEvent(new Event("input", { bubbles: true })); });
    ed.addEventListener("focusout", (e) => {
      const t = e.target;
      if ((t.dataset.c === "unitario" || t.dataset.campo === "unitario") && t.value) t.value = C.moeda(C.numBR(t.value), true);
    });

    function atualizarPeriodoItens() {
      for (const it of E.itens) if (it.periodo) it.descricao = C.trocarPeriodoDescricao(it.descricao, E.periodoIni, E.periodoFim);
      desenharItens();
    }

    ed.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-acao],[data-per],[data-rem],[data-item-donos]");
      if (!b) return;
      if (b.tagName === "A") e.preventDefault();
      if (b.dataset.per) {
        const p = b.dataset.per, ini = E.periodoIni || C.hoje();
        E.periodoFim = p === "m1" ? C.addDias(C.addMeses(ini, 1), -1) : C.addDias(ini, +p - 1);
        campo("periodoFim").value = E.periodoFim; sujo = true; atualizarPeriodoItens(); return atualizar();
      }
      if (b.dataset.rem != null) { E.itens.splice(+b.dataset.rem, 1); sujo = true; desenharItens(); return atualizar(); }
      if (b.dataset.itemDonos != null) return alterarDonosItem(+b.dataset.itemDonos);
      const a = b.dataset.acao;
      if (a === "fechar") return fechar();
      if (a === "prev") return ed.classList.toggle("ver-prev");
      if (a === "refazer-disc") { E.discAuto = true; campo("discriminacao").value = discAutomatica(); return atualizar(); }
      if (a === "inserir") return inserirItem();
      if (a === "novo-cliente") {
        const c = await ML.editarCliente(null);
        if (c) { E.clienteId = c.id; campo("clienteTxt").value = c.razaoSocial; E.sigla = c.sigla || C.sugerirSigla(c.razaoSocial); campo("sigla").value = E.sigla;
          $("#lista-clientes", ed).insertAdjacentHTML("beforeend", `<option value="${esc(c.razaoSocial)}">`); atualizar(); }
        return;
      }
      if (a === "salvar") return salvar(b);
    });

    function inserirItem() {
      const erro = $("[data-comp-erro]", ed);
      const equip = String(comp.equip || "").trim().toUpperCase();
      let msg = !equip ? "Informe o equipamento." : !(C.numBR(comp.unitario) > 0) ? "Informe o valor do período." : validarDonos(comp);
      if (msg) { erro.textContent = msg; erro.hidden = false; return; }
      erro.hidden = true;
      const it = { descricao: C.descricaoPeriodo(equip, E.periodoIni, E.periodoFim), qtd: C.numBR(comp.qtd) || 1, unitario: Math.round(C.numBR(comp.unitario) * 100) / 100, periodo: true, equip };
      if (comp.equipId) { it.equipId = comp.equipId; it.tag = comp.tag; }
      aplicarDonosNoItem(it, comp);
      E.itens.push(it);
      Object.assign(comp, { equip: "", qtd: 1, unitario: "", donos: [], subParceiro: "", subCusto: "", equipId: "", tag: "" });
      if ($("[data-inv]", ed)) { $("[data-inv]", ed).value = ""; $("[data-inv-info]", ed).hidden = true; }
      $('[data-c="equip"]', ed).value = ""; $('[data-c="qtd"]', ed).value = "1"; $('[data-c="unitario"]', ed).value = "";
      compDonos.desenhar();
      sujo = true; desenharItens(); atualizar();
      $('[data-c="equip"]', ed).focus();
    }

    function alterarDonosItem(i) {
      const it = E.itens[i];
      const est = { donos: (it.donos || []).map((d) => Object.assign({}, d, { tipo: C.ehSub(d) ? "sublocado" : "dono" })), subParceiro: it.subParceiro || "", subCusto: it.subCusto == null ? "" : it.subCusto };
      const corpo = el(`<div><p class="muted" style="margin:0 0 10px">${esc(it.descricao)}</p><div data-sel></div><div class="erro" data-erro hidden style="margin-top:10px"></div></div>`);
      seletorDonos($("[data-sel]", corpo), est);
      ML.modal({ titulo: "Donos do equipamento", corpo, botoes: [{ texto: "Voltar" }, { texto: "Aplicar", classe: "primario", acao: () => {
        const msg = validarDonos(est);
        if (msg) { $("[data-erro]", corpo).textContent = msg; $("[data-erro]", corpo).hidden = false; return false; }
        aplicarDonosNoItem(it, est); sujo = true; desenharItens(); atualizar();
      } }] });
    }

    function desenharItens() {
      const cont = $("[data-itens]", ed);
      const linhas = E.itens.map((it, i) => {
        const tot = Math.round((+it.qtd || 0) * C.numBR(it.unitario) * 100) / 100;
        const txtDonos = C.textoDonosItem(it, S.nomes);
        return `<div class="item-ed" data-i="${i}">
          <textarea class="desc" data-campo="descricao" rows="2">${esc(it.descricao)}</textarea>
          <input data-campo="qtd" inputmode="decimal" value="${esc(C.qtdBR(it.qtd))}" title="Quantidade">
          <input data-campo="unitario" inputmode="decimal" value="${esc(C.moeda(C.numBR(it.unitario), true))}" title="Valor unitário">
          <button class="ic-btn peq" data-rem="${i}" title="Remover item">${ic("lixo")}</button>
          <div class="meta"><b>${C.moeda(tot)}</b> · ${txtDonos ? `Donos: ${esc(txtDonos)}` : `<span class="etq verm">sem dono definido</span>`}
            ${it.subCusto != null && it.subParceiro ? ` · custo ${C.moeda(it.subCusto)}` : ""}
            <button class="btn peq fantasma" data-item-donos="${i}">${ic("donos")}Alterar donos</button>
            ${(S.equip || []).length ? `<select data-campo="equipId" class="sel-tag" title="Equipamento do inventário"><option value="">${it.tag && !S.eqId.has(it.equipId) ? esc(it.tag) + " (fora do inventário)" : "— vincular tag —"}</option>
              ${S.equip.map((e) => `<option value="${esc(e.id)}" ${e.id === it.equipId ? "selected" : ""}>${esc(e.tag)}${e.apelido ? " · " + esc(e.apelido) : ""}</option>`).join("")}</select>` : ""}</div></div>`;
      }).join("");
      const fr = E.frete;
      cont.innerHTML = (linhas || `<div class="vazio" style="padding:14px">Nenhum equipamento inserido ainda. Use o quadro acima.</div>`) + `
        <div class="item-ed frete">
          <label class="check" style="grid-column:1/-1"><input type="checkbox" data-frete="incluir" ${fr.incluir ? "checked" : ""}> Cobrar frete <small class="muted">(sempre o último item · fica fora da comissão · dividido em partes iguais entre os donos)</small></label>
          ${fr.incluir ? `<input data-frete="descricao" value="${esc(fr.descricao)}">
          <input data-frete="qtd" inputmode="decimal" value="${esc(C.qtdBR(fr.qtd))}">
          <input data-frete="unitario" inputmode="decimal" value="${esc(C.moeda(C.numBR(fr.unitario), true))}"><span></span>` : ""}
          ${modo === "nova" && fr.incluir && ML.freteEditor ? ML.freteEditor.html(E) : ""}
        </div>`;
      ML.hidratarIcones(cont);
      $("[data-itens-info]", ed).textContent = E.itens.length ? `${E.itens.length} ${E.itens.length === 1 ? "item" : "itens"} de locação` : "";
    }
    $("[data-itens]", ed).addEventListener("input", (e) => {
      const t = e.target, box = t.closest("[data-i]");
      sujo = true;
      // frete de entrega (prestador, caminhão, valor pago)
      if (t.dataset.fe) {
        if (t.tagName === "SELECT" || t.type === "checkbox") return; // tratado no "change"
        ML.freteEditor.evento(E, t);
        if (t.dataset.fe === "valor") ML.freteEditor.atualizarAlerta(E, cont());
        return;
      }
      if (t.dataset.frete) {
        const k = t.dataset.frete;
        E.frete[k] = k === "incluir" ? t.checked : k === "qtd" ? C.numBR(t.value) : t.value;
        if (k === "incluir") desenharItens();
        else if (ML.freteEditor) ML.freteEditor.atualizarAlerta(E, cont());
        return atualizar();
      }
      if (!box || !t.dataset.campo) return;
      const it = E.itens[+box.dataset.i], k = t.dataset.campo;
      if (k === "equipId") {
        const eq = S.eqId.get(t.value);
        if (!eq) { delete it.equipId; delete it.tag; return atualizar(); }
        it.equipId = eq.id; it.tag = eq.tag;
        if ((eq.donos || []).length) {
          aplicarDonosNoItem(it, { donos: eq.donos.map((d) => Object.assign({}, d)), subParceiro: eq.subParceiro || "", subCusto: eq.subCusto == null ? "" : eq.subCusto });
          ML.aviso(`Tag ${eq.tag} vinculada · donos conforme o inventário.`);
        }
        desenharItens(); return atualizar();
      }
      if (k === "descricao") { it.descricao = t.value; }
      else if (k === "qtd") it.qtd = C.numBR(t.value);
      else it.unitario = C.numBR(t.value);
      const meta = $(".meta b", box); if (meta) meta.textContent = C.moeda(Math.round((+it.qtd || 0) * C.numBR(it.unitario) * 100) / 100);
      atualizar();
    });
    $("[data-itens]", ed).addEventListener("change", (e) => { if (e.target.type === "checkbox") e.target.dispatchEvent(new Event("input", { bubbles: true })); });
    $("[data-itens]", ed).addEventListener("focusout", (e) => {
      if (e.target.dataset.frete === "unitario" || (e.target.dataset.fe === "valor" && e.target.value.trim())) e.target.value = C.moeda(C.numBR(e.target.value), true);
    });
    const cont = () => $("[data-itens]", ed);
    $("[data-itens]", ed).addEventListener("change", (e) => {
      const t = e.target; if (!t.dataset.fe || !(t.tagName === "SELECT" || t.type === "checkbox")) return;
      sujo = true;
      if (ML.freteEditor.evento(E, t, desenharItens)) desenharItens();
    });

    // ----------------------------- atualização de cabeçalho e prévia
    let tmrPrev, urlPrev = "", geracao = 0;
    function atualizar() {
      $("[data-num]", ed).textContent = numeroPrev();
      if (modo === "nova") {
        $("[data-reg-manual]", ed).hidden = E.regAuto;
        const info = $("[data-cli-info]", ed), c = cliente();
        info.hidden = !c;
        if (c) {
          const locs = S.locacoes.filter((l) => l.clienteId === c.id && l.status === "ativa");
          info.innerHTML = `${esc(c.documento || "")}${c.cidade ? " · " + esc(c.cidade) + (c.uf ? "/" + esc(c.uf) : "") : ""}${locs.length ? ` · <b>${locs.length} locação(ões) ativa(s)</b> — para continuar uma delas use “Renovar”` : ""}`;
        }
        const av = $("[data-reg-aviso]", ed), r = +E.regManual;
        if (!E.regAuto && r && S.loc.has(r)) { av.hidden = false; av.textContent = `O registro ${r} já é da locação de ${ML.nomeCliente(S.loc.get(r).clienteId)}. Use outro número ou “Renovar” nessa locação.`; }
        else av.hidden = true;
        const sv = campo("servico"); if (sv) sv.placeholder = servicoEfetivo();
        if (E.discAuto) { E.discriminacao = discAutomatica(); campo("discriminacao").value = E.discriminacao; }
      }
      const vi = $("[data-venc-info]", ed);
      if (vi) vi.textContent = E.vencimento && E.dataEmissao ? `${C.difDias(E.dataEmissao, E.vencimento)} dias após a emissão` : "";
      const itens = itensFinais();
      $("[data-total]", ed).innerHTML = vg(C.totalItens(itens), "medio");
      clearTimeout(tmrPrev);
      $("[data-prev-st]", ed).textContent = "atualizando…"; $("[data-prev-st]", ed).hidden = false;
      tmrPrev = setTimeout(gerarPrevia, 450);
    }
    async function gerarPrevia() {
      const minha = ++geracao;
      try {
        const doc = await window.MLPdf.gerar(montarFatura());
        if (minha !== geracao || !ed.isConnected) return;
        const url = URL.createObjectURL(doc.output("blob"));
        $("iframe", ed).src = url + "#toolbar=0&navpanes=0&view=FitH";
        if (urlPrev) setTimeout(((u) => () => URL.revokeObjectURL(u))(urlPrev), 2000);
        urlPrev = url;
        $("[data-prev-st]", ed).hidden = true;
      } catch (e) { $("[data-prev-st]", ed).textContent = "prévia indisponível: " + ML.msgErro(e); }
    }

    // ----------------------------- salvar
    async function salvar(bt) {
      const f = montarFatura(), itens = f.itens;
      const erros = [];
      if (modo === "nova") {
        if (!E.clienteId) erros.push("Selecione o cliente (escolha da lista ou cadastre em “Novo”).");
        if (!E.emissorId) erros.push("Selecione o prestador de serviços.");
        if (!E.regAuto && !(+E.regManual > 0)) erros.push("Informe o número do registro.");
        if (!E.regAuto && S.loc.has(+E.regManual)) erros.push("Esse registro já está em uso.");
        if (!C.limparSigla(E.sigla)) erros.push("Informe a sigla do cliente (letras).");
      }
      if (!E.dataEmissao) erros.push("Informe a data de emissão.");
      if (!E.vencimento) erros.push("Informe o vencimento.");
      if (!E.itens.length) erros.push("Insira pelo menos um equipamento nos itens.");
      if (itens.some((i) => !String(i.descricao || "").trim())) erros.push("Há item sem descrição.");
      if (!(f.total > 0)) erros.push("O total da fatura está zerado.");
      if (modo === "nova" && ML.freteEditor) { const ef = ML.freteEditor.validar(E); if (ef) erros.push(ef); }
      if (erros.length) return ML.aviso(erros[0], "erro");
      if (modo === "nova" && ML.freteEditor && ML.freteEditor.excesso(E) > 0 && (E.ent || {}).tId &&
        !await ML.confirmar("Frete acima do cobrado", `O valor pago ao prestador fica <b>${C.moeda(ML.freteEditor.excesso(E))}</b> acima do frete cobrado do cliente. Isso fica <b>registrado como ocorrência</b>. Emitir assim mesmo?`, "Emitir e registrar", true)) return;
      if (E.itens.some((i) => !(i.donos || []).length)) {
        if (!await ML.confirmar("Itens sem dono", "Há equipamento sem dono definido — ele fica de fora do rateio entre os donos. Emitir assim mesmo?", "Continuar")) return;
      }
      bt.disabled = true;
      const pf = { dataEmissao: E.dataEmissao, periodoIni: E.periodoIni, periodoFim: E.periodoFim, vencimento: E.vencimento,
        discriminacao: modo === "nova" && E.discAuto ? discAutomatica() : E.discriminacao, itens, outrasInfo: E.outrasInfo, obs: E.obs };
      try {
        let nova;
        if (modo === "nova") {
          const c = cliente(), sig = C.limparSigla(E.sigla);
          if (sig !== (c.sigla || "")) {
            const dados = Object.assign({}, c); delete dados.id; delete dados.sigla;
            const r = await ML.sb.from("fat_clientes").upsert({ id: c.id, sigla: sig, dados, atualizado_em: new Date().toISOString() });
            if (r.error) throw r.error;
          }
          const r = await ML.rpc("fat_nova_locacao", { p_loc: { clienteId: E.clienteId, emissorId: E.emissorId, registro: E.regAuto ? null : +E.regManual,
            seqInicial: +E.seqInicial || 0, servico: servicoEfetivo(), dataInicio: E.dataInicio, equipamento: equipsTxt(), obs: "",
            local: (E.enderecoObra || "").trim() || (E.localNome || "").trim() ? Object.assign({ endereco: (E.enderecoObra || "").trim(), nome: (E.localNome || "").trim().toUpperCase() },
              (() => { const r = ML.coordsEscolhidas ? ML.coordsEscolhidas(campo("enderecoObra")) : null; return r ? ML.localDeSugestao(r) : {}; })()) : null }, p_fat: pf });
          nova = r.fatura;
        } else if (modo === "renovar") {
          nova = await ML.rpc("fat_renovar", { p_registro: orig.registro, p_seq_esperado: orig.seq + 1, p_fat: pf });
        } else {
          if (E.atualizarCadastro) { pf.tomador = f.tomador; pf.prestador = Object.assign({}, f.prestador); }
          nova = await ML.rpc("fat_editar", { p_registro: orig.registro, p_seq: orig.seq, p_fat: pf });
        }
        sujo = false;
        fecharDeVez();
        ML.aviso(modo === "editar" ? `Fatura ${nova.id} salva.` : `Fatura ${nova.id} emitida.`, "ok");
        await ML.recarregarERender();
        // frete de entrega informado na implantação
        if (modo === "nova" && ML.freteEditor && (E.ent || {}).tId) {
          try {
            const exc = await ML.freteEditor.salvar(E, +nova.registro, nova.id);
            await ML.recarregarERender();
            ML.aviso(exc > 0 ? `Frete de entrega registrado — ${C.moeda(exc)} acima do cobrado (ocorrência gravada).` : "Frete de entrega registrado.", exc > 0 ? "erro" : "ok");
          } catch (e) { ML.aviso("A fatura foi emitida, mas o frete de entrega não foi registrado: " + ML.msgErro(e) + " — registre na aba Frete.", "erro"); }
        }
        const atual = ML.fatura(+nova.registro, +nova.seq);
        if (atual) ML.abrirFatura(atual);
        // locação nova: procura o endereço da obra (ou do cliente) e marca no mapa em segundo plano
        const locNova = S.loc.get(+nova.registro);
        if (modo === "nova" && ML.localizarLocacao && locNova && !(locNova.local && locNova.local.lat != null)) {
          ML.localizarLocacao(locNova, { silencioso: true }).then((r) => { if (r) ML.aviso(r.precisao === "endereco" ? "Obra marcada no mapa." : `Obra marcada no mapa — ${ML.textoPrecisao(r.precisao)}.`, "ok"); }).catch(() => {});
        }
      } catch (e) { ML.aviso(ML.msgErro(e), "erro"); }
      finally { bt.disabled = false; }
    }

    async function fechar() {
      if (sujo && !await ML.confirmar("Descartar?", "As alterações desta fatura ainda não foram salvas. Fechar mesmo assim?", "Descartar", true)) return;
      fecharDeVez();
    }
    function fecharDeVez() { ed.remove(); document.removeEventListener("keydown", tecla); if (urlPrev) URL.revokeObjectURL(urlPrev); }
    function tecla(e) { if (e.key === "Escape" && !$("#camada-modais").children.length) fechar(); }
    document.addEventListener("keydown", tecla);

    desenharItens();
    atualizar();
    if (modo === "nova" && !E.clienteId) setTimeout(() => campo("clienteTxt").focus(), 50);
  };
})();
