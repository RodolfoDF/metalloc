// Telas de cadastro e controle: Clientes, Donos e comissão, Configurações.
(function () {
  "use strict";
  const ML = window.ML, C = ML.C, S = ML.S, { $, $$, esc, el, ic, vg } = ML;

  // ================================================================ CLIENTES
  const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  ML.editarCliente = function (c) {
    return new Promise((ok) => {
      let salvo = null;
      const x = c || { razaoSocial: "", fantasia: "", tipoDoc: "CNPJ", documento: "", ie: "", endereco: "", cidade: "", uf: "DF", cep: "", email: "", contato: "", obs: "", sigla: "" };
      const corpo = el(`<form style="display:flex;flex-direction:column;gap:12px" autocomplete="off">
        <div class="linha-campos" style="grid-template-columns:1fr 110px">
          <label class="campo"><span>Razão social / nome</span><input name="razaoSocial" required value="${esc(x.razaoSocial)}"></label>
          <label class="campo"><span>Sigla</span><input name="sigla" maxlength="5" style="text-transform:uppercase" value="${esc(x.sigla || "")}"><small>no nº da fatura</small></label></div>
        <label class="campo"><span>Nome fantasia</span><input name="fantasia" value="${esc(x.fantasia)}"></label>
        <div class="linha-campos c3">
          <label class="campo"><span>Tipo</span><select name="tipoDoc"><option ${x.tipoDoc !== "CPF" ? "selected" : ""}>CNPJ</option><option ${x.tipoDoc === "CPF" ? "selected" : ""}>CPF</option></select></label>
          <label class="campo"><span>Documento</span><input name="documento" value="${esc(x.documento)}"></label>
          <label class="campo"><span>Inscrição estadual</span><input name="ie" value="${esc(x.ie)}"></label></div>
        <label class="campo"><span>Endereço</span><input name="endereco" value="${esc(x.endereco)}"></label>
        <div class="linha-campos" style="grid-template-columns:1fr 80px 130px">
          <label class="campo"><span>Cidade</span><input name="cidade" value="${esc(x.cidade)}"></label>
          <label class="campo"><span>UF</span><select name="uf"><option></option>${UFS.map((u) => `<option ${u === x.uf ? "selected" : ""}>${u}</option>`).join("")}</select></label>
          <label class="campo"><span>CEP</span><input name="cep" value="${esc(x.cep)}"></label></div>
        <div class="linha-campos c2">
          <label class="campo"><span>E-mail</span><input name="email" type="email" value="${esc(x.email)}"></label>
          <label class="campo"><span>Contato</span><input name="contato" value="${esc(x.contato)}"></label></div>
        <label class="campo"><span>Observações</span><textarea name="obs" rows="2">${esc(x.obs)}</textarea></label>
        <div class="aviso-linha lar" data-sig-aviso hidden></div></form>`);
      const f = corpo;
      const verSigla = () => {
        const s = C.limparSigla(f.sigla.value), outros = S.clientes.filter((k) => k.sigla === s && (!c || k.id !== c.id));
        const av = $("[data-sig-aviso]", corpo);
        av.hidden = !s || !outros.length;
        if (outros.length) av.textContent = `A sigla ${s} também é usada por: ${outros.map((o) => o.razaoSocial).join(", ")}. Pode manter se for a mesma empresa.`;
      };
      f.razaoSocial.addEventListener("input", () => { if (!c && !f.sigla.dataset.mexeu) { f.sigla.value = C.sugerirSigla(f.razaoSocial.value); verSigla(); } });
      f.sigla.addEventListener("input", () => { f.sigla.dataset.mexeu = "1"; verSigla(); });
      verSigla();
      const botoes = [{ texto: "Cancelar" }, { texto: "Salvar cliente", classe: "primario", acao: async () => {
        const dados = {};
        for (const k of ["razaoSocial", "fantasia", "tipoDoc", "documento", "ie", "endereco", "cidade", "uf", "cep", "email", "contato", "obs"]) dados[k] = String(f[k].value || "").trim();
        dados.razaoSocial = dados.razaoSocial.toUpperCase() === dados.razaoSocial ? dados.razaoSocial : dados.razaoSocial;
        if (!dados.razaoSocial) throw new Error("Informe a razão social.");
        const sigla = C.limparSigla(f.sigla.value) || C.sugerirSigla(dados.razaoSocial);
        const id = c ? c.id : "c" + Date.now() + Math.floor(Math.random() * 1000);
        const r = await ML.sb.from("fat_clientes").upsert({ id, sigla, dados, atualizado_em: new Date().toISOString() });
        if (r.error) throw r.error;
        salvo = Object.assign({ id, sigla }, dados);
        const i = S.clientes.findIndex((k) => k.id === id);
        if (i >= 0) S.clientes[i] = salvo; else S.clientes.push(salvo);
        S.clientes.sort((a, b) => (a.razaoSocial || "").localeCompare(b.razaoSocial || ""));
        S.cli.set(id, salvo);
        ML.aviso("Cliente salvo.", "ok");
      } }];
      if (c && !S.locacoes.some((l) => l.clienteId === c.id)) botoes.unshift({ texto: "Excluir", classe: "perigo", esquerda: true, acao: async () => {
        if (!await ML.confirmar("Excluir cliente", `Excluir <b>${esc(c.razaoSocial)}</b> do cadastro?`, "Excluir", true)) return false;
        const r = await ML.sb.from("fat_clientes").delete().eq("id", c.id);
        if (r.error) throw r.error;
        S.clientes = S.clientes.filter((k) => k.id !== c.id); S.cli.delete(c.id);
        ML.aviso("Cliente excluído.", "ok");
      } });
      ML.modal({ titulo: c ? "Editar cliente" : "Novo cliente", corpo, classe: "medio", botoes, aoFechar: () => { ok(salvo); if (location.hash === "#/clientes") ML.render(); } });
    });
  };

  ML.TELAS.clientes = function (main) {
    const st = S.ui.cli || (S.ui.cli = { busca: "", semSigla: false });
    const d = ML.hoje();
    const stats = new Map();
    for (const f of S.faturas) {
      const id = (f.tomador || {}).id || (S.loc.get(f.registro) || {}).clienteId;
      if (!stats.has(id)) stats.set(id, { n: 0, aberto: 0, venc: 0, ult: "" });
      const s = stats.get(id), sit = C.situacao(f, d);
      s.n++; if (sit === "aberta" || sit === "vencida") s.aberto += +f.total || 0; if (sit === "vencida") s.venc++;
      if ((f.dataEmissao || "") > s.ult) s.ult = f.dataEmissao;
    }
    const ativas = new Map(); for (const l of S.locacoes) if (l.status === "ativa") ativas.set(l.clienteId, (ativas.get(l.clienteId) || 0) + 1);
    const b = C.semAcento(st.busca).toLowerCase();
    const lista = S.clientes.filter((c) => (!b || C.semAcento([c.razaoSocial, c.fantasia, c.documento, c.sigla, c.cidade].join(" ")).toLowerCase().includes(b)) && (!st.semSigla || !c.sigla));
    main.innerHTML = `
      <div class="pag-cab"><h1>Clientes</h1><button class="btn primario" data-acao="novo">${ic("mais")}Novo cliente</button>
        <div class="sub">${S.clientes.length} clientes cadastrados · a sigla vai na frente do número das novas faturas (ex.: VC0002-1)</div></div>
      <div class="filtros"><input class="busca-local" type="search" placeholder="Buscar por nome, CNPJ, sigla, cidade…" value="${esc(st.busca)}" data-busca>
        <label class="check"><input type="checkbox" data-semsigla ${st.semSigla ? "checked" : ""}> Só sem sigla</label></div>
      <div class="tabela-wrap"><table class="tab"><thead><tr><th>Sigla</th><th>Cliente</th><th>Documento</th><th>Cidade</th><th class="centro">Locações ativas</th><th class="centro">Faturas</th><th class="direita">Em aberto</th><th></th></tr></thead><tbody>
      ${lista.map((c) => { const s = stats.get(c.id) || { n: 0, aberto: 0, venc: 0 }; return `<tr class="clicavel" data-cli="${esc(c.id)}">
        <td>${c.sigla ? `<span class="sigla">${esc(c.sigla)}</span>` : `<span class="etq lar">definir</span>`}</td>
        <td><b class="cli-nome">${esc(c.razaoSocial)}</b>${c.fantasia ? `<small class="muted">${esc(c.fantasia)}</small>` : ""}</td>
        <td class="nowrap">${esc(c.documento || "")}</td><td>${esc(c.cidade || "")}${c.uf ? "/" + esc(c.uf) : ""}</td>
        <td class="centro">${ativas.get(c.id) || ""}</td><td class="centro">${s.n || ""}</td>
        <td class="direita num nowrap">${s.aberto ? C.moeda(s.aberto) : ""}${s.venc ? ` <span class="etq verm">${s.venc} vencida${s.venc > 1 ? "s" : ""}</span>` : ""}</td>
        <td class="acoes-td"><button class="btn peq fantasma" data-fat-cli="${esc(c.id)}">Faturas</button></td></tr>`; }).join("") || `<tr><td colspan="8" class="vazio">Nenhum cliente encontrado.</td></tr>`}
      </tbody></table></div>`;
    main.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-acao],[data-cli],[data-fat-cli]"); if (!t) return;
      if (t.dataset.acao === "novo") { await ML.editarCliente(null); return; }
      if (t.dataset.fatCli) {
        e.stopPropagation();
        const c = S.cli.get(t.dataset.fatCli);
        Object.assign(S.ui, { modo: "lista", sit: "todas", busca: c.documento || c.razaoSocial, de: "", ate: "", especial: "" });
        $("#busca-global").value = S.ui.busca; location.hash = "#/locacoes"; return;
      }
      if (t.dataset.cli) ML.editarCliente(S.cli.get(t.dataset.cli));
    });
    let tmr;
    $("[data-busca]", main).addEventListener("input", (e) => { clearTimeout(tmr); tmr = setTimeout(() => { st.busca = e.target.value; ML.render(); const i = $("[data-busca]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200); });
    $("[data-semsigla]", main).addEventListener("change", (e) => { st.semSigla = e.target.checked; ML.render(); });
  };

  // ================================================================ DONOS E COMISSÃO
  ML.TELAS.donos = function (main) {
    const hoje = ML.hoje(), mes = hoje.slice(0, 7);
    const st = S.ui.don || (S.ui.don = { de: mes + "-01", ate: C.addDias(C.addMeses(mes + "-01", 1), -1), base: "faturado" });
    const com = S.cfg.comissao || { nome: "Representante", pct: 5 };
    const rel = C.montarRateio(S.faturas, { de: st.de, ate: st.ate, base: st.base, hoje, nomes: S.nomes, ordemDonos: S.donos.map((d) => d.id), comissaoNome: com.nome, comPct: com.pct });
    const semDono = S.faturas.filter((f) => f.status !== "cancelada" && (f.itens || []).some((i) => !i.frete && !(i.donos || []).length));
    const atalhos = [["Este mês", mes + "-01", C.addDias(C.addMeses(mes + "-01", 1), -1)],
      ["Mês passado", C.addMeses(mes + "-01", -1), C.addDias(mes + "-01", -1)],
      ["Este ano", hoje.slice(0, 4) + "-01-01", hoje.slice(0, 4) + "-12-31"], ["Tudo", "", ""]];
    main.innerHTML = `
      <div class="pag-cab"><h1>Donos e rateio</h1><button class="btn" data-acao="exportar">${ic("excel")}Exportar rateio</button>
        <div class="sub">Comissão do representante: ${C.pctBR(com.pct)}% da locação de cada dono (frete fora; na sublocação, sobre locação − custo). Frete dividido em partes iguais entre os donos da fatura.</div></div>
      <div class="filtros">
        <div class="alternar"><button data-base="faturado" class="${st.base === "faturado" ? "ativo" : ""}">Faturado</button><button data-base="recebido" class="${st.base === "recebido" ? "ativo" : ""}">Recebido</button></div>
        <input type="date" data-f="de" value="${st.de}"><span class="muted">a</span><input type="date" data-f="ate" value="${st.ate}">
        <span class="chips">${atalhos.map(([t, de, ate]) => `<button class="chip ${st.de === de && st.ate === ate ? "ativo" : ""}" data-de="${de}" data-ate="${ate}">${t}</button>`).join("")}</span></div>
      <div class="grade kpis">
        <div class="cartao kpi destaque" style="cursor:default"><span class="rot">Comissão do representante</span>${vg(rel.comissao)}<span class="det">${rel.faturas} faturas · ${rel.base === "recebido" ? "pagas" : "emitidas"} no período</span></div>
        <div class="cartao kpi" style="cursor:default"><span class="rot">Locação (bruto)</span>${vg(rel.locacao)}<span class="det">sem frete</span></div>
        <div class="cartao kpi" style="cursor:default"><span class="rot">Frete</span>${vg(rel.frete)}<span class="det">dividido entre os donos</span></div>
        <div class="cartao kpi" style="cursor:default"><span class="rot">Custo de sublocação</span>${vg(rel.custo)}<span class="det">pago às empresas parceiras</span></div></div>
      <div class="grade cards-donos">${rel.donos.map((dn) => `<div class="cartao card-dono">
        <h3>${dn.sublocado ? ic("renovar") : ic("usuario")}${esc(dn.nome)}${!dn.donoId ? ' <span class="etq verm">definir</span>' : ""}</h3>
        <div class="linha"><span>Locação</span><b>${C.moeda(dn.bruto)}</b></div>
        ${dn.custo ? `<div class="linha"><span>Custo sublocação</span><b>− ${C.moeda(dn.custo)}</b></div>` : ""}
        <div class="linha"><span>Comissão do repr.</span><b>− ${C.moeda(dn.comissao)}</b></div>
        <div class="linha liq"><span>Líquido</span><b>${C.moeda(dn.liquido)}</b></div>
        <div class="linha"><span>Frete</span><b>${C.moeda(dn.frete)}</b></div>
        <div class="linha muted"><span>${dn.faturas} fatura${dn.faturas === 1 ? "" : "s"}</span></div></div>`).join("") || `<div class="cartao vazio">Nenhuma fatura no período.</div>`}</div>
      <div class="cartao" style="margin-bottom:14px"><div class="cartao-cab"><h2>Faturas do período</h2></div>
        ${rel.linhas.length ? `<div class="tabela-wrap"><table class="tab"><thead><tr><th>Nº</th><th>Cliente</th><th>${st.base === "recebido" ? "Pago em" : "Emissão"}</th><th>Situação</th><th class="direita">Locação</th><th class="direita">Frete</th><th class="direita">Custo sub.</th><th class="direita">Comissão</th><th>Donos</th></tr></thead><tbody>
          ${rel.linhas.map((l) => `<tr class="${l.situacao} clicavel" data-fat="${l.registro}:${l.seq}"><td class="nfat">${esc(l.id)}</td><td><span class="cli-nome">${esc(l.cliente)}</span></td>
            <td class="nowrap">${C.dataBR(l.data)}</td><td>${ML.sitBadge(l.situacao)}</td><td class="direita num">${C.moeda(l.r.locacao)}</td><td class="direita num">${C.moeda(l.r.frete)}</td>
            <td class="direita num">${l.r.custo ? C.moeda(l.r.custo) : ""}</td><td class="direita num">${C.moeda(l.r.comissao)}</td><td><small>${esc(l.donos || "—")}</small></td></tr>`).join("")}
          </tbody><tfoot><tr><td colspan="4">Total</td><td class="direita num">${C.moeda(rel.locacao)}</td><td class="direita num">${C.moeda(rel.frete)}</td><td class="direita num">${C.moeda(rel.custo)}</td><td class="direita num">${C.moeda(rel.comissao)}</td><td></td></tr></tfoot></table></div>` : `<div class="vazio">Nenhuma fatura no período.</div>`}</div>
      ${rel.parceiros.length ? `<div class="cartao" style="margin-bottom:14px"><div class="cartao-cab"><h2>Sublocações por empresa parceira</h2><span class="muted" style="font-size:12.5px">equipamentos de parceiros alugados para os nossos clientes</span></div>
        <div class="tabela-wrap"><table class="tab"><thead><tr><th>Parceiro</th><th class="centro">Itens</th><th class="direita">Cobrado do cliente</th><th class="direita">Custo (pagar ao parceiro)</th><th class="direita">Margem</th><th class="direita">Comissão do repr.</th></tr></thead><tbody>
        ${rel.parceiros.map((p) => `<tr><td><b>${esc(p.parceiro)}</b></td><td class="centro">${p.itens}</td><td class="direita num">${C.moeda(p.locacao)}</td><td class="direita num">${C.moeda(p.custo)}</td>
          <td class="direita num"><b>${C.moeda(p.margem)}</b></td><td class="direita num">${C.moeda(p.comissao)}</td></tr>`).join("")}</tbody>
        ${rel.parceiros.length > 1 ? `<tfoot><tr><td>Total</td><td></td><td class="direita num">${C.moeda(rel.parceiros.reduce((a, p) => a + p.locacao, 0))}</td><td class="direita num">${C.moeda(rel.parceiros.reduce((a, p) => a + p.custo, 0))}</td><td class="direita num">${C.moeda(rel.parceiros.reduce((a, p) => a + p.margem, 0))}</td><td class="direita num">${C.moeda(rel.parceiros.reduce((a, p) => a + p.comissao, 0))}</td></tr></tfoot>` : ""}</table></div></div>` : ""}
      <div class="grade" style="grid-template-columns:1fr 1fr">
        <div class="cartao"><div class="cartao-cab"><h2>Cadastro de donos</h2><div class="acoes"><button class="btn peq" data-acao="add-dono">${ic("mais")}Adicionar dono</button></div></div>
          <div class="lista-edit" data-donos-ed>${S.donos.map((dn) => `<div class="lin" data-id="${esc(dn.id)}">
            <input data-nome value="${esc(dn.nome)}" ${dn.tipo === "sublocado" ? "readonly title=\"Dono especial para equipamentos sublocados de parceiros\"" : ""}>
            <label class="check"><input type="checkbox" data-ativo ${dn.inativo ? "" : "checked"}> ativo</label>
            ${dn.tipo === "sublocado" ? `<span class="etq lar">sublocação</span>` : `<span></span>`}</div>`).join("")}</div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">
            <small class="muted" style="flex:1">Percentual e regras da comissão ficam em <a href="#/comissoes" style="color:var(--laranja-esc)">Comissões</a>.</small>
            <button class="btn primario" data-acao="salvar-donos">Salvar donos</button></div></div>
        <div class="cartao"><div class="cartao-cab"><h2>Faturas com item sem dono</h2></div>
          ${semDono.length ? `<div class="tabela-wrap"><table class="tab"><tbody>${semDono.map((f) => `<tr><td class="nfat">${esc(f.id)}</td><td><span class="cli-nome">${esc((f.tomador || {}).razaoSocial)}</span></td>
            <td class="acoes-td"><button class="btn peq" data-def="${f.registro}:${f.seq}">Definir donos</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="vazio">${ic("check")} Todas as faturas têm dono definido.</div>`}</div>
      </div>`;
    if (window.matchMedia("(max-width: 1180px)").matches) main.lastElementChild.style.gridTemplateColumns = "1fr";
    main.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-base],[data-de],[data-acao],[data-def]"); if (!t) return;
      if (t.dataset.base) { st.base = t.dataset.base; return ML.render(); }
      if (t.dataset.de != null && t.dataset.ate != null) { st.de = t.dataset.de; st.ate = t.dataset.ate; return ML.render(); }
      if (t.dataset.def) { const [r, s] = t.dataset.def.split(":").map(Number); return definirDonos(ML.fatura(r, s)); }
      const a = t.dataset.acao;
      if (a === "exportar") {
        if (!rel.linhas.length) return ML.aviso("Nenhuma fatura no período.");
        try { ML.aviso("Gerando planilha…"); await ML.carregarScript("vendor/exceljs.min.js"); await window.MLRel.rateio(rel, { arquivo: `Rateio ${st.base} ${st.de || "inicio"} a ${st.ate || "hoje"}.xlsx` }); }
        catch (er) { ML.aviso(ML.msgErro(er), "erro"); }
      }
      if (a === "add-dono") {
        $("[data-donos-ed]", main).insertAdjacentHTML("beforeend", `<div class="lin" data-id=""><input data-nome placeholder="Nome do novo dono"><label class="check"><input type="checkbox" data-ativo checked> ativo</label><span></span></div>`);
        $("[data-donos-ed] .lin:last-child input", main).focus();
      }
      if (a === "salvar-donos") {
        try {
          const linhas = $$("[data-donos-ed] .lin", main);
          const reg = [];
          linhas.forEach((ln, i) => {
            const nome = $("[data-nome]", ln).value.trim(); if (!nome) return;
            const id = ln.dataset.id || "d" + Date.now() + i;
            const ant = S.donos.find((x) => x.id === id);
            reg.push({ id, nome, tipo: ant ? ant.tipo : "dono", inativo: !$("[data-ativo]", ln).checked, ordem: ant && ant.tipo === "sublocado" ? 99 : i });
          });
          const r = await ML.sb.from("fat_donos").upsert(reg);
          if (r.error) throw r.error;
          ML.aviso("Donos salvos.", "ok");
          await ML.recarregarERender();
        } catch (er) { ML.aviso(ML.msgErro(er), "erro"); }
      }
    });
    main.addEventListener("change", (e) => { const k = e.target.dataset.f; if (k) { st[k] = e.target.value; ML.render(); } });
    ML.ligarTabelas(main);
  };

  function definirDonos(f) {
    if (!f) return;
    const est = { donos: [], subParceiro: "", subCusto: "" };
    const outros = (S.fatsDe.get(f.registro) || []).filter((x) => x.seq !== f.seq && (x.itens || []).some((i) => !i.frete && !(i.donos || []).length));
    const corpo = el(`<div><p style="margin:0 0 10px">Fatura <b>${esc(f.id)}</b> · ${esc((f.tomador || {}).razaoSocial)}<br><small class="muted">Os donos marcados valem para todos os equipamentos desta fatura.</small></p>
      <div data-sel></div>${outros.length ? `<label class="check" style="margin-top:12px"><input type="checkbox" data-prop checked> Aplicar também nas outras ${outros.length} fatura(s) sem dono desta locação</label>` : ""}
      <div class="erro" data-erro hidden style="margin-top:10px"></div></div>`);
    ML.seletorDonos($("[data-sel]", corpo), est);
    ML.modal({ titulo: "Definir donos", corpo, botoes: [{ texto: "Voltar" }, { texto: "Aplicar", classe: "primario", acao: async () => {
      const msg = ML.validarDonos(est);
      if (msg) { $("[data-erro]", corpo).textContent = msg; $("[data-erro]", corpo).hidden = false; return false; }
      if (est.donos.some((d) => C.ehSub(d))) { $("[data-erro]", corpo).textContent = "Para sublocação, edite a fatura e ajuste o item (precisa do parceiro e do custo)."; $("[data-erro]", corpo).hidden = false; return false; }
      const n = await ML.rpc("fat_definir_donos", { p_registro: f.registro, p_seq: f.seq, p_donos: ML.donosDoItem(est), p_propagar: !!$("[data-prop]:checked", corpo) });
      ML.aviso(`Donos definidos em ${n} fatura(s).`, "ok");
      await ML.recarregarERender();
    } }] });
  }

  // ================================================================ ALERTAS NO WHATSAPP
  const DIAS_SEM = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const textoDiasSem = (d) => { d = (d || []).slice().sort(); const k = d.join(","); return k === "1,2,3,4,5,6,7" ? "todos os dias" : k === "1,2,3,4,5" ? "seg a sex" : k === "1,2,3,4,5,6" ? "seg a sáb" : d.map((x) => DIAS_SEM[x]).join(", "); };
  const fone = (t) => { const d = String(t || "").replace(/\D/g, ""); const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d); return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : t; };
  function cartaoAlertas() {
    const lista = S.alertas || [];
    return `<div class="cartao"><div class="cartao-cab"><h2>Alertas no WhatsApp</h2>
        <div class="acoes"><button class="btn peq" data-acao="previa-alerta">${ic("olho")}Ver mensagem de hoje</button><button class="btn peq" data-alerta="">${ic("mais")}Adicionar número</button></div></div>
      <p class="muted" style="margin:0 0 12px;font-size:13px">Todo dia, no horário escolhido, o servidor manda um resumo: locações a renovar, faturas vencidas e as que vencem nos próximos 3 dias. Funciona mesmo com o app fechado.</p>
      ${lista.length ? `<div class="tabela-wrap"><table class="tab"><tbody>${lista.map((a) => {
        const ok = /^enviado/.test(a.ultimo_resultado || ""), semChave = !a.apikey;
        return `<tr><td><b>${esc(a.nome || "—")}</b><small class="muted" style="display:block">${esc(fone(a.telefone))}</small></td>
          <td class="nowrap">${a.ativo ? `${String(a.hora).padStart(2, "0")}:00 · ${esc(textoDiasSem(a.dias))}` : '<span class="etq">pausado</span>'}</td>
          <td>${semChave ? '<span class="etq lar">falta ativar</span>' : a.ultimo_em ? `<span class="etq ${ok ? "" : "verm"}" title="${esc(a.ultimo_resultado || "")}">${ok ? "último envio" : "falhou"} ${C.carimbo(new Date(a.ultimo_em).toLocaleString("sv-SE").replace(" ", "T")).slice(0, 16)}</span>` : '<span class="etq">aguardando 1º envio</span>'}</td>
          <td class="acoes-td"><button class="btn peq" data-alerta-teste="${a.id}" ${semChave ? "disabled" : ""}>Enviar teste</button><button class="ic-btn peq" title="Editar" data-alerta="${a.id}">${ic("editar")}</button></td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="vazio">Nenhum número cadastrado.</div>`}</div>`;
  }
  function editarAlerta(a) {
    const x = a || { nome: "", telefone: "+55 61 ", apikey: "", hora: 8, dias: [1, 2, 3, 4, 5, 6], ativo: true };
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="aviso-linha lar" style="line-height:1.55"><b>Ativação (uma vez, no celular que vai receber):</b><br>
        1. Salve nos contatos o número <b>+34 644 26 33 77</b> (CallMeBot).<br>
        2. Mande para ele, pelo WhatsApp, a mensagem: <b>I allow callmebot to send me messages</b><br>
        3. Em até 2 minutos ele responde com <i>“Your APIKEY is 123456”</i>. Copie esse número no campo <b>Chave</b> abaixo.<br>
        <small>Se não responder, o número do robô pode ter mudado: confira em callmebot.com.</small></div>
      <div class="linha-campos c2">
        <label class="campo"><span>Nome</span><input name="nome" value="${esc(x.nome)}" placeholder="ex.: Escritório"></label>
        <label class="campo"><span>WhatsApp (com DDD)</span><input name="telefone" value="${esc(fone(x.telefone))}"></label></div>
      <div class="linha-campos c2">
        <label class="campo"><span>Chave (APIKEY do CallMeBot)</span><input name="apikey" value="${esc(x.apikey || "")}" autocomplete="off"></label>
        <label class="campo"><span>Horário do resumo</span><select name="hora">${Array.from({ length: 17 }, (_, i) => i + 6).map((h) => `<option value="${h}" ${h === x.hora ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select></label></div>
      <div><div class="muted" style="font-size:12.5px;margin-bottom:6px">Dias da semana</div><div class="chips">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label class="dono-chip ${(x.dias || []).includes(d) ? "marcado" : ""}"><input type="checkbox" name="dia" value="${d}" ${(x.dias || []).includes(d) ? "checked" : ""}>${DIAS_SEM[d]}</label>`).join("")}</div></div>
      <label class="check"><input type="checkbox" name="ativo" ${x.ativo ? "checked" : ""}> Enviar o resumo diário</label>
      ${a && a.ultimo_resultado ? `<small class="muted">Último resultado: ${esc(a.ultimo_resultado)}</small>` : ""}</div>`);
    corpo.addEventListener("change", (e) => { if (e.target.name === "dia") e.target.closest(".dono-chip").classList.toggle("marcado", e.target.checked); });
    const v = (n) => $(`[name=${n}]`, corpo);
    const botoes = [{ texto: "Cancelar" }, { texto: "Salvar", classe: "primario", acao: async () => {
      let tel = v("telefone").value.replace(/\D/g, "");
      if (tel.length === 10 || tel.length === 11) tel = "55" + tel;
      if (!/^55\d{10,11}$/.test(tel)) throw new Error("Informe o WhatsApp com DDD, ex.: +55 61 9102-5021.");
      const dias = $$("[name=dia]:checked", corpo).map((c) => +c.value);
      if (!dias.length) throw new Error("Marque pelo menos um dia da semana.");
      const reg = { nome: v("nome").value.trim(), telefone: "+" + tel, apikey: v("apikey").value.trim(), hora: +v("hora").value, dias, ativo: v("ativo").checked };
      const r = a ? await ML.sb.from("fat_alertas").update(reg).eq("id", a.id) : await ML.sb.from("fat_alertas").insert(reg);
      if (r.error) throw r.error;
      ML.aviso("Alerta salvo.", "ok"); await ML.recarregarERender();
    } }];
    if (a) botoes.unshift({ texto: "Excluir", classe: "perigo", esquerda: true, acao: async () => {
      if (!await ML.confirmar("Excluir número", "Parar de enviar o resumo para este número?", "Excluir", true)) return false;
      const r = await ML.sb.from("fat_alertas").delete().eq("id", a.id); if (r.error) throw r.error;
      await ML.recarregarERender();
    } });
    ML.modal({ titulo: a ? "Alerta no WhatsApp" : "Novo número para alertas", corpo, classe: "medio", botoes });
  }
  async function chamarAlertas(corpo) {
    const { data, error } = await ML.sb.functions.invoke("alertas-whatsapp", { body: corpo });
    if (error) {
      let m = error.message;
      try { const j = await error.context.json(); m = j.erro || m; } catch (e) { /* mantém */ }
      throw new Error(m);
    }
    return data;
  }
  async function previaAlerta(bt) {
    bt.disabled = true;
    try {
      const r = await chamarAlertas({ acao: "previa" });
      ML.modal({ titulo: "Mensagem de hoje", corpo: `<pre class="previa-zap">${esc(r.texto).replace(/\*([^*\n]+)\*/g, "<b>$1</b>")}</pre>`, classe: "medio" });
    } catch (e) { ML.aviso(ML.msgErro(e), "erro"); }
    finally { bt.disabled = false; }
  }
  async function testarAlerta(id, bt) {
    bt.disabled = true; ML.aviso("Enviando teste…");
    try {
      const r = await chamarAlertas({ acao: "teste", id });
      ML.aviso(r.ok ? "Teste enviado — confira o WhatsApp em alguns segundos." : "O WhatsApp recusou: " + r.resposta, r.ok ? "ok" : "erro");
      await ML.recarregarERender();
    } catch (e) { ML.aviso(ML.msgErro(e), "erro"); }
    finally { bt.disabled = false; }
  }

  // ================================================================ CONFIGURAÇÕES
  ML.TELAS.config = function (main) {
    const cfg = S.cfg, admin = !!(S.op && S.op.admin);
    const emi = S.emissores[0] || { id: "f1-veiculos" };
    const campoE = (k, rot, w) => `<label class="campo" ${w ? `style="grid-column:span ${w}"` : ""}><span>${rot}</span><input data-e="${k}" value="${esc(emi[k] || "")}"></label>`;
    main.innerHTML = `
      <div class="pag-cab"><h1>Configurações</h1><div class="sub">Versão online ${esc(window.ML_CONFIG.versao)} · conectado como ${esc(S.user.email)}</div></div>
      <div class="grade" style="grid-template-columns:1.3fr 1fr;align-items:start">
        <div class="grade">
          <div class="cartao"><div class="cartao-cab"><h2>Prestador de serviços (sai na fatura)</h2>
            ${S.emissores.length > 1 ? `<div class="acoes"><select data-emi>${S.emissores.map((e) => `<option value="${esc(e.id)}">${esc(e.razaoSocial)}</option>`).join("")}</select></div>` : ""}</div>
            <div class="linha-campos c2" data-emi-form>
              ${campoE("razaoSocial", "Razão social", 2)}${campoE("cnpj", "CNPJ")}${campoE("cep", "CEP")}${campoE("endereco", "Endereço", 2)}${campoE("cidade", "Cidade")}
              ${campoE("banco", "Banco")}${campoE("agencia", "Agência")}${campoE("conta", "Conta")}${campoE("titularConta", "Titular da conta")}${campoE("pix", "Pix")}</div>
            <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn primario" data-acao="salvar-emi">Salvar prestador</button></div></div>
          <div class="cartao"><div class="cartao-cab"><h2>Numeração e prazos</h2></div>
            <div class="linha-campos c4">
              <label class="campo" style="grid-column:1/-1"><span>Número da fatura</span><select data-c="formatoNumero" data-texto>
                <option value="data" ${cfg.formatoNumero !== "registro" ? "selected" : ""}>Data de emissão — ex.: TEM17112026-0</option>
                <option value="registro" ${cfg.formatoNumero === "registro" ? "selected" : ""}>Registro da locação — ex.: TEM0002-0 (antigo)</option></select>
                <small>Sigla do cliente + data de emissão; o número depois do hífen separa faturas do mesmo cliente no mesmo dia. Dá para digitar o número à mão na fatura.</small></label>
              <label class="campo"><span>Próximo registro</span><input type="number" min="1" data-c="proximoRegistro" value="${esc(cfg.proximoRegistro)}"><small>automático</small></label>
              <label class="campo"><span>Dígitos do registro</span><input type="number" min="1" max="8" data-c="digitosRegistro" value="${esc(cfg.digitosRegistro)}"><small>ex.: 4 → 0002</small></label>
              <label class="campo"><span>Dias p/ vencimento</span><input type="number" min="0" data-c="diasVencimento" value="${esc(cfg.diasVencimento)}"><small>após a emissão</small></label>
              <label class="campo"><span>Aviso de renovação</span><input type="number" min="0" data-c="avisoDias" value="${esc(cfg.avisoDias)}"><small>dias antes do fim</small></label></div>
            <label class="campo" style="margin-top:12px"><span>Texto padrão de “Outras informações”</span><textarea data-c="textoOutrasInfo" rows="3">${esc(cfg.textoOutrasInfo || "")}</textarea></label>
            <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn primario" data-acao="salvar-cfg">Salvar</button></div></div>
          ${admin ? cartaoAlertas() : ""}
        </div>
        <div class="grade">
          <div class="cartao"><div class="cartao-cab"><h2>Operadores</h2></div>
            <div class="tabela-wrap"><table class="tab"><tbody>${S.operadores.sort((a, b) => (a.criado_em || "").localeCompare(b.criado_em || "")).map((o) => `<tr>
              <td><b>${esc(o.nome || "—")}</b><small class="muted" style="display:block">${esc(o.email)}</small></td>
              <td>${o.ativo ? (o.admin ? '<span class="etq lar">administrador</span>' : '<span class="etq">operador</span>') : '<span class="etq verm">aguardando</span>'}</td>
              <td class="acoes-td">${admin && o.user_id !== S.user.id ? `
                ${o.ativo ? `<button class="btn peq" data-op="bloquear" data-u="${o.user_id}">Bloquear</button>` : `<button class="btn peq primario" data-op="liberar" data-u="${o.user_id}">Liberar</button>`}
                ${o.ativo ? `<button class="btn peq fantasma" data-op="${o.admin ? "tirar-admin" : "admin"}" data-u="${o.user_id}">${o.admin ? "Tirar admin" : "Tornar admin"}</button>` : ""}
                <button class="ic-btn peq" title="Remover" data-op="remover" data-u="${o.user_id}">${ic("lixo")}</button>` : o.user_id === S.user.id ? '<small class="muted">você</small>' : ""}</td></tr>`).join("")}</tbody></table></div>
            ${admin ? `<div style="margin-top:14px;border-top:1px solid var(--borda);padding-top:14px;display:flex;flex-direction:column;gap:10px">
              <b style="font-size:13.5px">Incluir operador</b>
              <div class="linha-campos c2"><label class="campo"><span>Nome</span><input data-conv="nome"></label>
                <label class="campo"><span>E-mail</span><input data-conv="email" type="email"></label></div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><label class="check"><input type="checkbox" data-conv="admin"> administrador</label>
                <button class="btn primario peq" data-acao="convidar" style="margin-left:auto">${ic("mais")}Liberar acesso</button></div>
              ${(S.convites || []).length ? `<div class="tabela-wrap"><table class="tab"><tbody>${S.convites.map((c) => `<tr><td><b>${esc(c.nome || "—")}</b><small class="muted" style="display:block">${esc(c.email)}</small></td>
                <td><span class="etq">aguardando 1º acesso</span></td><td class="acoes-td"><button class="ic-btn peq" title="Remover convite" data-desconvidar="${esc(c.email)}">${ic("lixo")}</button></td></tr>`).join("")}</tbody></table></div>` : ""}
              <p class="muted" style="font-size:12.5px;margin:0">Depois de liberar, envie o endereço do app para a pessoa. Ela clica em <b>Primeiro acesso? Criar conta</b> usando <b>este mesmo e-mail</b> e já entra liberada. Se ela já tiver conta no outro app da Metal Loc, é só clicar em <b>Entrar</b>.</p></div>`
            : `<p class="muted" style="font-size:12.5px;margin:10px 0 0">Para incluir alguém, peça ao administrador.</p>`}</div>
          <div class="cartao"><div class="cartao-cab"><h2>Dados</h2></div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <button class="btn" data-acao="backup">${ic("baixar")}Baixar cópia de segurança (JSON)</button>
              ${admin ? `<label class="btn" style="cursor:pointer">${ic("atualizar")}Importar banco.json do app do Windows<input type="file" accept=".json,application/json" data-importar hidden></label>
              <small class="muted">Use o arquivo <b>dados\\banco.json</b> da pasta do app do Windows. Clientes são atualizados; locações e faturas são trocadas pelas do arquivo.</small>` : ""}
            </div></div>
        </div>
      </div>`;
    if (window.matchMedia("(max-width: 1180px)").matches) main.lastElementChild.style.gridTemplateColumns = "1fr";
    let emiAtual = emi.id;
    const sel = $("[data-emi]", main);
    if (sel) sel.addEventListener("change", () => { emiAtual = sel.value; const e = S.emissores.find((x) => x.id === emiAtual) || {}; $$("[data-e]", main).forEach((i) => { i.value = e[i.dataset.e] || ""; }); });

    main.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-acao],[data-op],[data-desconvidar],[data-alerta],[data-alerta-teste]"); if (!t) return;
      try {
        if (t.dataset.alerta != null) return editarAlerta(S.alertas.find((a) => String(a.id) === t.dataset.alerta) || null);
        if (t.dataset.alertaTeste) return testarAlerta(+t.dataset.alertaTeste, t);
        if (t.dataset.acao === "previa-alerta") return previaAlerta(t);
        if (t.dataset.acao === "convidar") {
          const v = (k) => $(`[data-conv="${k}"]`, main);
          const email = v("email").value.trim().toLowerCase(), nome = v("nome").value.trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Informe um e-mail válido.");
          const ja = S.operadores.find((o) => (o.email || "").toLowerCase() === email);
          if (ja) {
            const r = await ML.sb.from("fat_operadores").update({ ativo: true, admin: ja.admin || v("admin").checked, nome: ja.nome || nome }).eq("user_id", ja.user_id);
            if (r.error) throw r.error;
            ML.aviso(`${nome || email} já tinha cadastro e foi liberado.`, "ok");
          } else {
            const r = await ML.sb.from("fat_convites").upsert({ email, nome, admin: v("admin").checked, criado_por: S.op.nome || S.user.email }, { onConflict: "email" });
            if (r.error) throw r.error;
            ML.aviso(`Acesso liberado para ${email}. Envie o endereço do app para a pessoa.`, "ok");
          }
          return ML.recarregarERender();
        }
        if (t.dataset.desconvidar) {
          const r = await ML.sb.from("fat_convites").delete().eq("email", t.dataset.desconvidar);
          if (r.error) throw r.error;
          return ML.recarregarERender();
        }
        if (t.dataset.acao === "salvar-emi") {
          const ant = S.emissores.find((x) => x.id === emiAtual) || {};
          const dados = Object.assign({}, ant); delete dados.id;
          $$("[data-e]", main).forEach((i) => { dados[i.dataset.e] = i.value.trim(); });
          const r = await ML.sb.from("fat_emissores").upsert({ id: emiAtual, dados, ordem: S.emissores.findIndex((x) => x.id === emiAtual) });
          if (r.error) throw r.error;
          if (!S.cfg.emissorPadraoId) await ML.salvarConfig({ emissorPadraoId: emiAtual });
          ML.aviso("Prestador salvo. Vale para as próximas faturas.", "ok"); await ML.recarregarERender();
        }
        if (t.dataset.acao === "salvar-cfg") {
          const p = {};
          $$("[data-c]", main).forEach((i) => { p[i.dataset.c] = i.tagName === "TEXTAREA" || i.hasAttribute("data-texto") ? i.value : Math.max(0, parseInt(i.value, 10) || 0); });
          if (p.proximoRegistro < 1) p.proximoRegistro = 1;
          if (p.digitosRegistro < 1) p.digitosRegistro = 4;
          await ML.salvarConfig(p);
          ML.aviso("Configurações salvas.", "ok"); await ML.recarregarERender();
        }
        if (t.dataset.acao === "backup") {
          const tabelas = ["fat_config", "fat_emissores", "fat_donos", "fat_clientes", "fat_locacoes", "fat_faturas"];
          const out = { geradoEm: new Date().toISOString(), versao: window.ML_CONFIG.versao };
          for (const tb of tabelas) out[tb] = await ML.todos(tb);
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
          a.download = `metalloc-faturas-backup-${ML.hoje()}.json`; a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        }
        if (t.dataset.op) {
          const u = t.dataset.u, op = t.dataset.op;
          if (op === "remover") {
            if (!await ML.confirmar("Remover operador", "Remover o acesso desta pessoa ao sistema?", "Remover", true)) return;
            const r = await ML.sb.from("fat_operadores").delete().eq("user_id", u); if (r.error) throw r.error;
          } else {
            const ch = op === "liberar" ? { ativo: true } : op === "bloquear" ? { ativo: false } : { admin: op === "admin" };
            const r = await ML.sb.from("fat_operadores").update(ch).eq("user_id", u); if (r.error) throw r.error;
          }
          ML.aviso("Operador atualizado.", "ok"); await ML.recarregarERender();
        }
      } catch (er) { ML.aviso(ML.msgErro(er), "erro"); }
    });

    const imp = $("[data-importar]", main);
    if (imp) imp.addEventListener("change", async () => {
      const arq = imp.files[0]; imp.value = "";
      if (!arq) return;
      try {
        const banco = JSON.parse(await arq.text());
        if (!Array.isArray(banco.faturas) || !Array.isArray(banco.clientes)) throw new Error("Este arquivo não parece ser o banco.json do app de faturas.");
        for (const c of banco.clientes) { const ex = S.cli.get(c.id); c.sigla = (ex && ex.sigla) || C.sugerirSigla(c.razaoSocial); }
        const total = banco.faturas.reduce((s, f) => s + (+f.total || 0), 0);
        const ja = S.faturas.length;
        const ok = await ML.confirmar("Importar dados do app do Windows",
          `O arquivo tem <b>${banco.clientes.length}</b> clientes, <b>${(banco.locacoes || []).length}</b> locações e <b>${banco.faturas.length}</b> faturas (total ${C.moeda(total)}).` +
          (ja ? `<br><br><b>Atenção:</b> as ${ja} faturas que já estão no sistema online serão <b>substituídas</b> pelas do arquivo.` : ""), "Importar", !!ja);
        if (!ok) return;
        const r = await ML.rpc("fat_importar", { p_banco: banco, p_substituir: ja > 0 });
        ML.aviso(`Importado: ${r.clientes} clientes, ${r.locacoes} locações, ${r.faturas} faturas.`, "ok");
        await ML.recarregarERender();
      } catch (er) { ML.aviso(ML.msgErro(er), "erro"); }
    });
  };
})();
