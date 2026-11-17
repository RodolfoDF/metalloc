// Frete: prestadores (caminhões prancha), entrega/devolução de cada locação, pagamento aos prestadores
// e controle para o frete pago não passar do que foi cobrado do cliente.
(function () {
  "use strict";
  const ML = window.ML, C = ML.C, S = ML.S, { $, $$, esc, el, ic, vg } = ML;
  const TIPOS_CAM = ["3/4", "toco", "truck", "bitruck"];
  const NOME_TIPO = { entrega: "Entrega", devolucao: "Devolução", outro: "Outro" };
  const FORMAS = ["Pix", "Transferência", "Dinheiro", "Boleto", "Outro"];
  const r2 = (n) => Math.round((+n || 0) * 100) / 100;
  const soma = (l, k) => r2(l.reduce((s, x) => s + (+x[k] || 0), 0));
  const nomeT = (id) => { const t = (S.transp || []).find((x) => x.id === +id); return t ? t.nome : ""; };
  const camTxt = (c) => [c.placa, c.tipo].filter(Boolean).join(" · ");

  // ------------------------------------------------------------ dados
  ML.freteCobrado = (registro) => r2((S.fatsDe.get(registro) || []).filter((f) => f.status !== "cancelada")
    .reduce((s, f) => s + (f.itens || []).filter((i) => i.frete).reduce((a, i) => a + (+i.qtd || 0) * (+i.unitario || 0), 0), 0));
  // resumo do frete de uma locação (semId: ignora um frete que está sendo editado)
  function resumo(registro, semId) {
    const fs = (S.fretes || []).filter((f) => f.registro === registro && f.id !== semId);
    const cobrado = ML.freteCobrado(registro);
    const por = (t) => fs.filter((f) => f.tipo === t);
    const pago = soma(fs, "valor");
    return { cobrado, fs, entrega: soma(por("entrega"), "valor"), devolucao: soma(por("devolucao"), "valor"), outro: soma(por("outro"), "valor"),
      pago, saldo: r2(cobrado - pago), temEntrega: por("entrega").length > 0, temDev: por("devolucao").length > 0 };
  }
  ML.resumoFrete = resumo;
  const inicio = () => ((S.cfg.frete || {}).inicio || "");
  // situação do frete da locação
  function estado(l, rs) {
    if (rs.pago > rs.cobrado + 0.004) return "excedeu";
    const controla = !inicio() || (l.dataInicio || "") >= inicio();
    if (!rs.temEntrega) return !rs.cobrado && !rs.fs.length ? "fora" : controla && l.status === "ativa" ? "sem_entrega" : rs.fs.length ? "ok" : "fora";
    if (!rs.temDev) return l.status === "ativa" ? "aguarda_dev" : "dev_pendente";
    return "ok";
  }
  const NOME_EST = { excedeu: "Acima do cobrado", sem_entrega: "Entrega não registrada", aguarda_dev: "Aguardando devolução", dev_pendente: "Devolução não registrada", ok: "Concluído", fora: "—" };
  const COR_EST = { excedeu: "verm", sem_entrega: "lar", aguarda_dev: "", dev_pendente: "lar", ok: "verde", fora: "" };
  const etqEst = (s) => s === "fora" ? '<span class="muted">—</span>' : `<span class="etq ${COR_EST[s]}">${NOME_EST[s]}</span>`;
  ML.qtdFretesAPagar = () => (S.fretes || []).filter((f) => !f.pago_em).length;

  // chip na lista de locações
  ML.chipFrete = function (l) {
    const rs = resumo(l.registro);
    if (!rs.cobrado && !rs.fs.length) return "";
    const st = estado(l, rs);
    const txt = !rs.temEntrega ? `frete ${C.moeda(rs.cobrado)} · entrega não registrada`
      : `frete: cobrado ${C.moeda(rs.cobrado)} · pago ${C.moeda(rs.pago)}${!rs.temDev ? ` · teto devolução ${C.moeda(Math.max(0, rs.saldo))}` : ""}`;
    return `<button type="button" class="frete-chip ${st}" data-frete-loc="${l.registro}" title="Frete desta locação">${ic("caminhao")}${esc(txt)}</button>`;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-frete-loc]"); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    detalheLocacao(S.loc.get(+b.dataset.freteLoc));
  }, true);

  // ================================================================ tela
  ML.TELAS.fretes = function (main) {
    const st = S.ui.fre || (S.ui.fre = { aba: "locacoes", filtro: "ativa", busca: "", transp: "", sel: new Set() });
    const hoje = ML.hoje(), mes = hoje.slice(0, 7), ano = hoje.slice(0, 4);
    const fretes = S.fretes || [], transp = S.transp || [];
    const aPagar = fretes.filter((f) => !f.pago_em);
    const pagMes = fretes.filter((f) => (f.pago_em || "").startsWith(mes));
    const linhas = S.locacoes.map((l) => { const rs = resumo(l.registro); return { l, rs, st: estado(l, rs), cli: S.cli.get(l.clienteId) || {} }; });
    const semEntrega = linhas.filter((x) => x.st === "sem_entrega");
    const ocs = S.freteOc || [];
    const nomeMes = new Date(+mes.slice(0, 4), +mes.slice(5) - 1, 15).toLocaleDateString("pt-BR", { month: "long" });

    main.innerHTML = `
      <div class="pag-cab"><h1>Frete</h1>
        <button class="btn" data-acao="regras">${ic("config")}Ajustes</button>
        <button class="btn" data-acao="excel">${ic("excel")}Exportar Excel</button>
        <button class="btn" data-acao="novo-prest">${ic("mais")}Novo prestador</button>
        <button class="btn primario" data-acao="registrar">${ic("caminhao")}Registrar frete</button>
        <div class="sub">O frete é cobrado do cliente na fatura de implantação e pago ao prestador quando o serviço é feito. A entrega e a devolução, somadas, não devem passar do valor cobrado.</div></div>
      <div class="grade kpis">
        <button class="cartao kpi destaque" data-aba="apagar"><span class="rot">A pagar aos prestadores</span><span class="seta">${ic("seta")}</span>${vg(soma(aPagar, "valor"))}
          <span class="det">${aPagar.length} frete${aPagar.length === 1 ? "" : "s"} em aberto</span></button>
        <button class="cartao kpi" data-aba="todos"><span class="rot">Pago em ${nomeMes}</span><span class="seta">${ic("seta")}</span>${vg(soma(pagMes, "valor"))}
          <span class="det">${C.moeda(soma(fretes.filter((f) => (f.pago_em || "").startsWith(ano)), "valor"))} no ano</span></button>
        <button class="cartao kpi ${semEntrega.length ? "atencao" : ""}" data-filtro-rapido="sem_entrega"><span class="rot">Entregas sem registro</span><span class="seta">${ic("seta")}</span>
          <span class="valor"><span class="int">${semEntrega.length}</span></span><span class="det">locações ativas sem o frete de entrega lançado</span></button>
        <button class="cartao kpi ${ocs.length ? "alerta" : ""}" data-aba="ocorrencias"><span class="rot">Frete acima do cobrado</span><span class="seta">${ic("seta")}</span>
          <span class="valor"><span class="int">${ocs.length}</span></span><span class="det">${ocs.length ? C.moeda(soma(ocs, "excesso")) + " pagos a mais no total" : "nenhuma ocorrência"}</span></button>
      </div>
      <div class="filtros">
        <div class="alternar">${[["locacoes", "Por locação"], ["apagar", `A pagar${aPagar.length ? ` (${aPagar.length})` : ""}`], ["todos", "Todos os fretes"], ["prestadores", `Prestadores (${transp.filter((t) => t.ativo).length})`], ["ocorrencias", `Ocorrências${ocs.length ? ` (${ocs.length})` : ""}`]]
          .map(([k, t]) => `<button data-aba="${k}" class="${st.aba === k ? "ativo" : ""}">${t}</button>`).join("")}</div>
        ${st.aba === "locacoes" ? `<select data-f="filtro">${[["ativa", "Locações ativas"], ["pendentes", "Com pendência"], ["sem_entrega", "Entrega não registrada"], ["aguarda_dev", "Aguardando devolução"], ["excedeu", "Acima do cobrado"], ["encerrada", "Encerradas"], ["todas", "Todas"]]
          .map(([k, t]) => `<option value="${k}" ${st.filtro === k ? "selected" : ""}>${t}</option>`).join("")}</select>` : ""}
        ${st.aba === "apagar" || st.aba === "todos" ? `<select data-f="transp"><option value="">Todos os prestadores</option>${transp.map((t) => `<option value="${t.id}" ${String(t.id) === st.transp ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}</select>` : ""}
        ${st.aba !== "prestadores" ? `<input data-f="busca" placeholder="Filtrar por cliente, locação, placa…" value="${esc(st.busca)}" style="min-width:240px">` : ""}
      </div>
      <div data-area></div>`;
    const area = $("[data-area]", main);
    const q = C.semAcento(st.busca || "").toLowerCase();
    const casa = (...t) => !q || C.semAcento(t.join(" ")).toLowerCase().includes(q);
    const nomeCli = (reg) => { const l = S.loc.get(reg); const c = l && S.cli.get(l.clienteId); return c ? c.razaoSocial : ""; };
    const regTxt = (reg) => C.padReg(reg, S.cfg.digitosRegistro);

    if (st.aba === "locacoes") {
      const f = st.filtro;
      const lista = linhas.filter((x) => f === "todas" ? (x.rs.cobrado || x.rs.fs.length || x.l.status === "ativa")
        : f === "ativa" ? x.l.status === "ativa" : f === "encerrada" ? x.l.status === "encerrada" && (x.rs.cobrado || x.rs.fs.length)
        : f === "pendentes" ? ["sem_entrega", "dev_pendente", "excedeu"].includes(x.st) : x.st === f)
        .filter((x) => casa(x.cli.razaoSocial, x.cli.sigla, regTxt(x.l.registro), (x.l.local || {}).nome, x.rs.fs.map((y) => y.transportador + " " + y.placa).join(" ")))
        .sort((a, b) => ["excedeu", "sem_entrega", "dev_pendente", "aguarda_dev", "ok", "fora"].indexOf(a.st) - ["excedeu", "sem_entrega", "dev_pendente", "aguarda_dev", "ok", "fora"].indexOf(b.st) || b.l.registro - a.l.registro);
      area.innerHTML = lista.length ? `<div class="cartao"><div class="tabela-wrap"><table class="tab"><thead><tr><th>Locação</th><th class="direita">Cobrado do cliente</th><th>Entrega</th><th>Devolução</th>
        <th class="direita" title="Quanto ainda pode ser pago sem passar do cobrado">Saldo / teto</th><th>Situação</th><th></th></tr></thead><tbody>
        ${lista.map(({ l, rs, st: s, cli }) => {
          const ent = rs.fs.filter((y) => y.tipo === "entrega"), dev = rs.fs.filter((y) => y.tipo === "devolucao");
          const cel = (ls) => ls.length ? ls.map((y) => `<b class="num">${C.moeda(y.valor)}</b> <small class="muted">${esc(y.transportador || "")}${y.placa ? " · " + esc(y.placa) : ""}${y.pago_em ? "" : " · a pagar"}</small>`).join("<br>") : '<span class="muted">—</span>';
          return `<tr class="clicavel ${s === "excedeu" ? "linha-verm" : ""}" data-det="${l.registro}">
            <td><span class="cli-nome" style="max-width:280px">${cli.sigla ? `<span class="sigla">${esc(cli.sigla)}</span> ` : ""}${esc(cli.razaoSocial || "")}</span>
              <small class="muted">Locação ${esc(regTxt(l.registro))}${l.local && (l.local.nome || l.local.endereco) ? " · " + esc(l.local.nome || l.local.endereco) : ""}${l.status === "encerrada" ? " · encerrada" : ""}</small></td>
            <td class="direita num">${rs.cobrado ? C.moeda(rs.cobrado) : '<span class="muted">não cobrado</span>'}</td>
            <td>${cel(ent)}</td><td>${cel(dev)}</td>
            <td class="direita num"><b class="${rs.saldo < 0 ? "txt-verm" : ""}">${C.moeda(rs.saldo)}</b></td><td>${etqEst(s)}</td>
            <td class="acoes-td">${!rs.temEntrega ? `<button class="btn peq ${s === "sem_entrega" ? "primario" : ""}" data-reg-tipo="${l.registro}:entrega">${ic("caminhao")}Entrega</button>`
              : !rs.temDev ? `<button class="btn peq ${l.status === "encerrada" ? "primario" : ""}" data-reg-tipo="${l.registro}:devolucao">${ic("caminhao")}Devolução</button>` : ""}</td></tr>`;
        }).join("")}</tbody></table></div></div>`
        : `<div class="cartao vazio">Nenhuma locação neste filtro.</div>`;
    } else if (st.aba === "apagar") {
      const lista = aPagar.filter((f) => (!st.transp || String(f.transportador_id) === st.transp) && casa(f.transportador, f.placa, nomeCli(f.registro), regTxt(f.registro)));
      const porT = new Map();
      for (const f of lista) { const k = f.transportador_id || 0; if (!porT.has(k)) porT.set(k, []); porT.get(k).push(f); }
      area.innerHTML = porT.size ? [...porT.entries()].map(([id, ls]) => {
        const t = transp.find((x) => x.id === id) || { nome: ls[0].transportador || "Sem prestador", dados: {} };
        return `<div class="cartao" style="margin-bottom:14px">
          <div class="cartao-cab"><label class="check"><input type="checkbox" data-sel-grupo="${id}" ${ls.every((f) => st.sel.has(f.id)) ? "checked" : ""}></label>
            <h2>${esc(t.nome)}</h2><span class="muted">${ls.length} frete${ls.length === 1 ? "" : "s"}</span>
            <div class="acoes">${vg(soma(ls, "valor"), "medio")}<button class="btn peq primario" data-pagar-grupo="${id}">${ic("check")}Pagar tudo</button></div></div>
          ${bancoHtml(t)}
          ${tabelaFretes(ls, { sel: true })}</div>`;
      }).join("") : `<div class="cartao vazio" style="padding:36px">${ic("check")}<p style="margin:8px 0 0"><b>Nada a pagar.</b> Todos os fretes registrados estão pagos.</p></div>`;
      const sel = aPagar.filter((f) => st.sel.has(f.id));
      if (sel.length) area.insertAdjacentHTML("beforeend", `<div class="barra-sel"><span>${sel.length} selecionado(s) · <b>${C.moeda(soma(sel, "valor"))}</b></span>
        <button class="btn fantasma peq" data-acao="limpar-sel">Limpar</button><button class="btn primario" data-acao="pagar-sel">${ic("dinheiro")}Registrar pagamento</button></div>`);
    } else if (st.aba === "todos") {
      const lista = fretes.filter((f) => (!st.transp || String(f.transportador_id) === st.transp) && casa(f.transportador, f.placa, nomeCli(f.registro), regTxt(f.registro), f.fatura));
      area.innerHTML = lista.length ? `<div class="cartao">${tabelaFretes(lista, { status: true })}</div>` : `<div class="cartao vazio">Nenhum frete registrado ainda. Use <b>Registrar frete</b> ou informe a entrega ao emitir a fatura de implantação.</div>`;
    } else if (st.aba === "prestadores") {
      area.innerHTML = transp.length ? `<div class="grade-prest">${transp.slice().sort((a, b) => (b.ativo - a.ativo) || a.nome.localeCompare(b.nome, "pt-BR")).map((t) => {
        const fs = fretes.filter((f) => f.transportador_id === t.id), ab = fs.filter((f) => !f.pago_em);
        return `<div class="cartao prest ${t.ativo ? "" : "inativo"}">
          <div class="prest-cab"><span class="avatar">${esc((t.nome || "?").slice(0, 1).toUpperCase())}</span><div style="flex:1;min-width:0"><b>${esc(t.nome)}</b>
            <small class="muted">${[t.dados.telefone, t.dados.documento].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small></div>
            ${t.ativo ? "" : '<span class="etq">inativo</span>'}<button class="ic-btn peq" data-edit-prest="${t.id}" title="Editar">${ic("editar")}</button></div>
          <div class="prest-cams">${(t.dados.caminhoes || []).map((c) => `<span class="cam-chip">${ic("caminhao")}<b>${esc(c.placa || "sem placa")}</b>${c.tipo ? `<small>${esc(c.tipo)}</small>` : ""}</span>`).join("") || '<span class="muted">nenhum caminhão cadastrado</span>'}</div>
          ${bancoHtml(t, true)}
          <div class="prest-rodape"><span>${fs.length} frete${fs.length === 1 ? "" : "s"}</span><span>${ab.length ? `<b class="txt-lar">${C.moeda(soma(ab, "valor"))} a pagar</b>` : "nada a pagar"}</span></div></div>`;
      }).join("")}</div>` : `<div class="cartao vazio" style="padding:36px">Nenhum prestador cadastrado. <button class="btn primario peq" data-acao="novo-prest">${ic("mais")}Cadastrar o primeiro</button></div>`;
    } else {
      const lista = ocs.filter((o) => casa(o.transportador, nomeCli(o.registro), regTxt(o.registro), o.justificativa));
      area.innerHTML = `<div class="aviso-linha verm" style="margin-bottom:12px">${ic("alerta")} Registro permanente: cada vez que um frete é lançado acima do valor cobrado do cliente, fica gravado aqui com a justificativa — mesmo que o frete seja alterado ou apagado depois.</div>` +
        (lista.length ? `<div class="cartao"><div class="tabela-wrap"><table class="tab"><thead><tr><th>Quando</th><th>Locação</th><th>Frete</th><th>Prestador</th><th class="direita">Cobrado</th><th class="direita">Total pago</th><th class="direita">Acima</th><th>Justificativa</th><th>Por</th></tr></thead><tbody>
          ${lista.map((o) => `<tr><td class="nowrap">${C.dataBR(String(o.quando).slice(0, 10))}</td><td><span class="cli-nome" style="max-width:220px">${esc(nomeCli(o.registro))}</span><small class="muted">Locação ${esc(regTxt(o.registro))}</small></td>
            <td>${NOME_TIPO[o.tipo] || esc(o.tipo)}<small class="muted bl">${C.moeda(o.valor)}</small></td><td>${esc(o.transportador)}</td><td class="direita num">${C.moeda(o.cobrado)}</td><td class="direita num">${C.moeda(o.total_pago)}</td>
            <td class="direita num"><b class="txt-verm">${C.moeda(o.excesso)}</b></td><td><small>${esc(o.justificativa)}</small></td><td><small class="muted">${esc(o.usuario)}</small></td></tr>`).join("")}
          </tbody><tfoot><tr><td colspan="6">${lista.length} ocorrência(s)</td><td class="direita num">${C.moeda(soma(lista, "excesso"))}</td><td colspan="2"></td></tr></tfoot></table></div></div>`
          : `<div class="cartao vazio">${ic("check")} Nenhum frete foi pago acima do valor cobrado.</div>`);
    }

    function tabelaFretes(ls, o) {
      return `<div class="tabela-wrap"><table class="tab"><thead><tr>${o.sel ? "<th></th>" : ""}<th>Data</th><th>Frete</th><th>Locação</th>${o.sel ? "" : "<th>Prestador</th>"}<th>Caminhão</th><th class="direita">Valor pago</th>${o.status ? "<th>Pagamento</th>" : ""}<th></th></tr></thead><tbody>
        ${ls.map((f) => `<tr class="${f.excesso > 0 ? "linha-verm" : ""}">${o.sel ? `<td><input type="checkbox" data-sel="${f.id}" ${st.sel.has(f.id) ? "checked" : ""}></td>` : ""}
          <td class="nowrap">${C.dataBR(f.data)}</td><td>${NOME_TIPO[f.tipo]}${f.excesso > 0 ? `<small class="txt-verm bl">${C.moeda(f.excesso)} acima do cobrado</small>` : ""}</td>
          <td><span class="cli-nome" style="max-width:240px">${esc(nomeCli(f.registro))}</span><small class="muted">Locação ${esc(regTxt(f.registro))}${f.fatura ? " · fatura " + esc(f.fatura) : ""}</small></td>
          ${o.sel ? "" : `<td>${esc(f.transportador || "—")}</td>`}<td>${esc([f.placa, f.tipo_caminhao].filter(Boolean).join(" · ") || "—")}</td>
          <td class="direita num"><b>${C.moeda(f.valor)}</b></td>
          ${o.status ? `<td>${f.pago_em ? `<span class="sit paga">Pago ${C.dataBRc ? C.dataBRc(f.pago_em) : C.dataBR(f.pago_em)}</span><small class="muted">${esc(f.forma || "")}</small>` : '<span class="sit aberta">A pagar</span>'}</td>` : ""}
          <td class="acoes-td">${f.pago_em ? `<button class="ic-btn peq" title="Desfazer pagamento" data-despagar="${f.id}">${ic("renovar")}</button>` : ""}<button class="ic-btn peq" title="Editar frete" data-edit-frete="${f.id}">${ic("editar")}</button></td></tr>`).join("")}
        </tbody><tfoot><tr>${o.sel ? "<td></td>" : ""}<td colspan="${o.sel ? 4 : 5}">${ls.length} frete(s)</td><td class="direita num">${C.moeda(soma(ls, "valor"))}</td>${o.status ? "<td></td>" : ""}<td></td></tr></tfoot></table></div>`;
    }

    main.addEventListener("click", (e) => {
      const t = e.target.closest("[data-aba],[data-acao],[data-filtro-rapido],[data-det],[data-reg-tipo],[data-edit-prest],[data-edit-frete],[data-despagar],[data-pagar-grupo],[data-sel],[data-sel-grupo]"); if (!t) return;
      if (t.dataset.sel != null) { e.stopPropagation(); const id = +t.dataset.sel; t.checked ? st.sel.add(id) : st.sel.delete(id); return ML.render(); }
      if (t.dataset.selGrupo != null) { aPagar.filter((f) => String(f.transportador_id || 0) === t.dataset.selGrupo).forEach((f) => (t.checked ? st.sel.add(f.id) : st.sel.delete(f.id))); return ML.render(); }
      if (t.dataset.aba) { st.aba = t.dataset.aba; return ML.render(); }
      if (t.dataset.filtroRapido) { st.aba = "locacoes"; st.filtro = t.dataset.filtroRapido; return ML.render(); }
      if (t.dataset.regTipo) { e.stopPropagation(); const [r, tp] = t.dataset.regTipo.split(":"); return registrarFrete({ registro: +r, tipo: tp }); }
      if (t.dataset.editPrest) return editarPrestador(transp.find((x) => x.id === +t.dataset.editPrest));
      if (t.dataset.editFrete) return registrarFrete({ frete: fretes.find((f) => f.id === +t.dataset.editFrete) });
      if (t.dataset.despagar) return desfazerPagamento(fretes.find((f) => f.id === +t.dataset.despagar));
      if (t.dataset.pagarGrupo) return pagar(aPagar.filter((f) => String(f.transportador_id || 0) === t.dataset.pagarGrupo));
      if (t.dataset.det) return detalheLocacao(S.loc.get(+t.dataset.det));
      const a = t.dataset.acao;
      if (a === "registrar") return registrarFrete({});
      if (a === "novo-prest") return editarPrestador(null);
      if (a === "regras") return ajustes();
      if (a === "excel") return exportar();
      if (a === "limpar-sel") { st.sel.clear(); return ML.render(); }
      if (a === "pagar-sel") return pagar(aPagar.filter((f) => st.sel.has(f.id)));
    });
    main.addEventListener("change", (e) => { const k = e.target.dataset.f; if (k && k !== "busca") { st[k] = e.target.value; st.sel.clear(); ML.render(); } });
    let tm = 0;
    main.addEventListener("input", (e) => { if (e.target.dataset.f === "busca") { clearTimeout(tm); const v = e.target.value; tm = setTimeout(() => { st.busca = v; ML.render(); const i = $("[data-f=busca]", main); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); } });
  };

  function bancoHtml(t, compacto) {
    const d = t.dados || {};
    const pix = d.pix ? `<span><b>Pix${d.tipoPix ? " (" + esc(d.tipoPix) + ")" : ""}:</b> ${esc(d.pix)}</span>` : "";
    const conta = d.banco || d.conta ? `<span><b>${esc(d.banco || "Banco")}</b>${d.agencia ? " · ag. " + esc(d.agencia) : ""}${d.conta ? " · " + esc(d.tipoConta || "conta") + " " + esc(d.conta) : ""}</span>` : "";
    const tit = d.titular ? `<span>Titular: ${esc(d.titular)}${d.docTitular ? " · " + esc(d.docTitular) : ""}</span>` : "";
    if (!pix && !conta) return compacto ? '<div class="prest-banco muted">sem dados bancários</div>' : "";
    return `<div class="prest-banco">${pix}${conta}${tit}</div>`;
  }

  // ================================================================ detalhe da locação
  function detalheLocacao(l) {
    if (!l) return;
    const rs = resumo(l.registro), cli = S.cli.get(l.clienteId) || {}, s = estado(l, rs);
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="aviso-linha"><b>${esc(cli.razaoSocial || "")}</b> · locação ${esc(C.padReg(l.registro, S.cfg.digitosRegistro))}${l.local && (l.local.nome || l.local.endereco) ? " · " + esc(l.local.nome || l.local.endereco) : ""}</div>
      ${resumoHtml(rs)}
      <div>${etqEst(s)}</div>
      ${rs.fs.length ? `<div class="tabela-wrap"><table class="tab"><thead><tr><th>Data</th><th>Frete</th><th>Prestador / caminhão</th><th class="direita">Valor</th><th>Pagamento</th><th></th></tr></thead><tbody>
        ${rs.fs.map((f) => `<tr><td class="nowrap">${C.dataBR(f.data)}</td><td>${NOME_TIPO[f.tipo]}</td><td>${esc(f.transportador || "—")}<small class="muted bl">${esc([f.placa, f.tipo_caminhao].filter(Boolean).join(" · "))}</small></td>
          <td class="direita num"><b>${C.moeda(f.valor)}</b></td><td>${f.pago_em ? `<span class="sit paga">Pago</span>` : '<span class="sit aberta">A pagar</span>'}</td>
          <td><button class="ic-btn peq" data-edit-frete="${f.id}" title="Editar">${ic("editar")}</button></td></tr>`).join("")}</tbody></table></div>`
        : '<div class="muted">Nenhum frete registrado nesta locação.</div>'}</div>`);
    const botoes = [{ texto: "Fechar" }];
    if (!rs.temDev) botoes.push({ texto: rs.temEntrega ? "Registrar devolução" : "Registrar entrega", classe: "primario", icone: "caminhao", acao: () => { registrarFrete({ registro: l.registro, tipo: rs.temEntrega ? "devolucao" : "entrega" }); } });
    else botoes.push({ texto: "Outro frete", acao: () => { registrarFrete({ registro: l.registro, tipo: "outro" }); } });
    const m = ML.modal({ titulo: "Frete da locação", corpo, classe: "medio", botoes });
    corpo.addEventListener("click", (e) => { const b = e.target.closest("[data-edit-frete]"); if (b) { m.fechar(); registrarFrete({ frete: (S.fretes || []).find((f) => f.id === +b.dataset.editFrete) }); } });
  }
  function resumoHtml(rs, tipo) {
    const teto = Math.max(0, rs.saldo);
    return `<div class="frete-resumo">
      <div><span>Cobrado do cliente</span><b>${C.moeda(rs.cobrado)}</b></div>
      <div><span>Pago na entrega</span><b>${rs.temEntrega ? C.moeda(rs.entrega) : "—"}</b></div>
      ${rs.devolucao || rs.temDev ? `<div><span>Pago na devolução</span><b>${C.moeda(rs.devolucao)}</b></div>` : ""}
      ${rs.outro ? `<div><span>Outros fretes</span><b>${C.moeda(rs.outro)}</b></div>` : ""}
      <div class="teto ${rs.saldo < 0 ? "neg" : ""}"><span>${tipo === "devolucao" ? "Teto para negociar a devolução" : tipo ? "Disponível para este frete" : "Saldo"}</span><b>${C.moeda(rs.saldo < 0 ? rs.saldo : teto)}</b></div></div>`;
  }

  // ================================================================ registrar / editar frete
  function registrarFrete({ registro, tipo, frete }) {
    const ed = frete || null;
    let reg = ed ? ed.registro : registro || null;
    let tp = ed ? ed.tipo : tipo || "entrega";
    const ativos = (S.transp || []).filter((t) => t.ativo || (ed && t.id === ed.transportador_id));
    const opcoesLoc = S.locacoes.filter((l) => l.status === "ativa" || l.registro === reg)
      .map((l) => ({ l, c: S.cli.get(l.clienteId) || {} })).sort((a, b) => (a.c.razaoSocial || "").localeCompare(b.c.razaoSocial || ""));
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      ${reg && !ed ? "" : `<label class="campo"><span>Locação</span><select name="registro" ${ed ? "disabled" : ""}><option value="">— escolha a locação —</option>
        ${opcoesLoc.map(({ l, c }) => `<option value="${l.registro}" ${l.registro === reg ? "selected" : ""}>${esc(c.sigla ? c.sigla + " · " : "")}${esc(c.razaoSocial || "")} — ${esc(C.padReg(l.registro, S.cfg.digitosRegistro))}${l.local && (l.local.nome || l.local.endereco) ? " · " + esc(l.local.nome || l.local.endereco) : ""}</option>`).join("")}</select></label>`}
      <div data-cab></div>
      <div class="alternar" data-tipos>${["entrega", "devolucao", "outro"].map((k) => `<button type="button" data-tipo="${k}" class="${tp === k ? "ativo" : ""}">${NOME_TIPO[k]}</button>`).join("")}</div>
      <div data-resumo></div>
      <div class="linha-campos c2">
        <label class="campo"><span>Prestador (frete)</span><select name="transp"><option value="">— escolha —</option>${ativos.map((t) => `<option value="${t.id}" ${ed && ed.transportador_id === t.id ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}
          <option value="novo">+ Cadastrar novo prestador…</option></select></label>
        <label class="campo"><span>Caminhão prancha</span><select name="cam"></select></label></div>
      <div class="linha-campos c2">
        <label class="campo"><span>Data do serviço</span><input type="date" name="data" value="${esc(ed ? ed.data : ML.hoje())}"></label>
        <label class="campo"><span>Valor pago ao prestador</span><input name="valor" inputmode="decimal" value="${ed ? esc(C.moeda(ed.valor, true)) : ""}" placeholder="0,00"></label></div>
      <div data-excesso></div>
      <div class="linha-campos c3">
        <label class="check" style="align-self:end;padding-bottom:9px"><input type="checkbox" name="pago" ${ed && ed.pago_em ? "checked" : ""}> Já foi pago ao prestador</label>
        <label class="campo" data-pg ${ed && ed.pago_em ? "" : "hidden"}><span>Pago em</span><input type="date" name="pago_em" value="${esc((ed && ed.pago_em) || ML.hoje())}"></label>
        <label class="campo" data-pg ${ed && ed.pago_em ? "" : "hidden"}><span>Forma</span><select name="forma">${FORMAS.map((f) => `<option ${ed && ed.forma === f ? "selected" : ""}>${f}</option>`).join("")}</select></label></div>
      <label class="campo"><span>Observação (opcional)</span><input name="obs" value="${esc(ed ? ed.obs : "")}" placeholder="ex.: retirada às 7h, km rodados…"></label></div>`);
    const v = (n) => $(`[name=${n}]`, corpo);
    let excede = 0;
    function caminhoes() {
      const t = (S.transp || []).find((x) => x.id === +v("transp").value);
      const cams = t ? t.dados.caminhoes || [] : [];
      const atual = ed && ed.transportador_id === (t && t.id) ? ed.placa : "";
      v("cam").innerHTML = (cams.length ? "" : '<option value="">— sem caminhão cadastrado —</option>') +
        cams.map((c, i) => `<option value="${i}" ${c.placa === atual ? "selected" : ""}>${esc(camTxt(c))}</option>`).join("");
    }
    function cabecalho() {
      const l = reg && S.loc.get(reg), c = l ? S.cli.get(l.clienteId) || {} : null;
      $("[data-cab]", corpo).innerHTML = c && !(registro && !ed) ? "" : c ? `<div class="aviso-linha"><b>${esc(c.razaoSocial || "")}</b> · locação ${esc(C.padReg(reg, S.cfg.digitosRegistro))}${l.local && (l.local.nome || l.local.endereco) ? " · " + esc(l.local.nome || l.local.endereco) : ""}</div>` : "";
    }
    function recalcular() {
      const box = $("[data-resumo]", corpo), exc = $("[data-excesso]", corpo);
      if (!reg) { box.innerHTML = '<div class="muted">Escolha a locação para ver quanto foi cobrado de frete do cliente.</div>'; exc.innerHTML = ""; excede = 0; return; }
      const rs = resumo(reg, ed && ed.id);
      box.innerHTML = resumoHtml(rs, tp) + (tp === "devolucao" ? `<small class="muted">Compare antes de fechar com o prestador: a devolução não deve passar de <b>${C.moeda(Math.max(0, rs.saldo))}</b>.</small>` : "");
      const val = r2(C.numBR(v("valor").value));
      const novoExc = val > 0 ? r2(Math.max(0, rs.pago + val - rs.cobrado)) : 0;
      if ((novoExc > 0) !== (excede > 0) || (novoExc > 0 && !$("[name=just]", exc))) {
        exc.innerHTML = novoExc > 0 ? `<div class="aviso-linha verm frete-alerta">${ic("alerta")}<div><b data-exc-txt></b>
          <label class="campo" style="margin-top:8px"><span>Justificativa (obrigatória — fica registrada)</span><input name="just" value="${esc(ed ? ed.justificativa : "")}" placeholder="ex.: cliente pediu entrega urgente em Anápolis"></label></div></div>` : "";
      }
      excede = novoExc;
      const t = $("[data-exc-txt]", exc);
      if (t) t.textContent = `Atenção: com este valor o frete pago fica ${C.moeda(novoExc)} acima do que foi cobrado do cliente (${C.moeda(rs.cobrado)}).`;
    }
    const m = ML.modal({ titulo: ed ? "Editar frete" : "Registrar frete", corpo, classe: "medio", botoes: [
      ...(ed ? [{ texto: "Excluir", classe: "perigo", esquerda: true, acao: async () => {
        if (!await ML.confirmar("Excluir frete", `Apagar o frete de <b>${C.moeda(ed.valor)}</b> (${NOME_TIPO[ed.tipo]}, ${esc(ed.transportador || "")})?${ed.excesso > 0 ? " A ocorrência de valor acima do cobrado continua registrada." : ""}`, "Excluir", true)) return false;
        const r = await ML.sb.from("fat_fretes").delete().eq("id", ed.id); if (r.error) throw r.error;
        ML.aviso("Frete excluído."); await ML.recarregarERender();
      } }] : []),
      { texto: "Cancelar" },
      { texto: ed ? "Salvar" : "Registrar frete", classe: "primario", icone: "check", acao: async () => {
        if (!reg) throw new Error("Escolha a locação.");
        const tId = v("transp").value;
        if (!tId || tId === "novo") throw new Error("Escolha o prestador que fez o frete.");
        const val = r2(C.numBR(v("valor").value));
        if (!(val > 0)) throw new Error("Informe o valor pago ao prestador.");
        if (!v("data").value) throw new Error("Informe a data do serviço.");
        recalcular();
        const just = ($("[name=just]", corpo) || {}).value || "";
        if (excede > 0) {
          if (!just.trim()) { $("[name=just]", corpo).focus(); throw new Error("Explique por que o frete passou do valor cobrado do cliente."); }
          if (!await ML.confirmar("Frete acima do cobrado", `O frete pago vai ficar <b>${C.moeda(excede)}</b> acima do valor cobrado do cliente. Isso fica <b>registrado como ocorrência</b>. Confirmar?`, "Registrar mesmo assim", true)) return false;
        }
        const t = (S.transp || []).find((x) => x.id === +tId), cam = ((t && t.dados.caminhoes) || [])[+v("cam").value] || {};
        const pago = v("pago").checked;
        const linha = { registro: reg, tipo: tp, data: v("data").value, transportador_id: +tId, transportador: t ? t.nome : "", placa: cam.placa || "", tipo_caminhao: cam.tipo || "",
          valor: val, justificativa: excede > 0 ? just.trim() : "", pago_em: pago ? v("pago_em").value || ML.hoje() : null, forma: pago ? v("forma").value : "", obs: v("obs").value.trim() };
        const r = ed ? await ML.sb.from("fat_fretes").update(linha).eq("id", ed.id) : await ML.sb.from("fat_fretes").insert(linha);
        if (r.error) throw r.error;
        ML.aviso(excede > 0 ? "Frete registrado — ocorrência de valor acima do cobrado gravada." : ed ? "Frete salvo." : `${NOME_TIPO[tp]} registrada.`, excede > 0 ? "erro" : "ok");
        await ML.recarregarERender();
      } }] });
    caminhoes(); cabecalho(); recalcular();
    corpo.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tipo]"); if (!b) return;
      tp = b.dataset.tipo; $$("[data-tipo]", corpo).forEach((x) => x.classList.toggle("ativo", x === b)); recalcular();
    });
    corpo.addEventListener("change", (e) => {
      const n = e.target.name;
      if (n === "registro") { reg = +e.target.value || null; recalcular(); }
      if (n === "transp") {
        if (e.target.value === "novo") {
          e.target.value = "";
          editarPrestador(null, (novo) => {
            e.target.insertBefore(el(`<option value="${novo.id}">${esc(novo.nome)}</option>`), e.target.querySelector("[value=novo]"));
            e.target.value = String(novo.id); caminhoes();
          });
        }
        caminhoes();
      }
      if (n === "pago") $$("[data-pg]", corpo).forEach((x) => (x.hidden = !e.target.checked));
    });
    corpo.addEventListener("input", (e) => { if (e.target.name === "valor") recalcular(); });
    corpo.addEventListener("focusout", (e) => { if (e.target.name === "valor" && e.target.value.trim()) e.target.value = C.moeda(C.numBR(e.target.value), true); });
    return m;
  }
  ML.registrarFrete = registrarFrete;

  // ================================================================ encerrar locação (pede o frete de devolução)
  function encerrarLocacao(l) {
    if (!l) return;
    const cli = S.cli.get(l.clienteId) || {}, rs = resumo(l.registro), hoje = ML.hoje();
    const abertas = (S.fatsDe.get(l.registro) || []).filter((f) => f.status === "emitida");
    const ativos = (S.transp || []).filter((t) => t.ativo);
    const devs = rs.fs.filter((f) => f.tipo === "devolucao");
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="aviso-linha"><b>${esc(cli.razaoSocial || "")}</b> · locação ${esc(C.padReg(l.registro, S.cfg.digitosRegistro))}${l.local && (l.local.nome || l.local.endereco) ? " · " + esc(l.local.nome || l.local.endereco) : ""}</div>
      ${abertas.length ? `<div class="aviso-linha lar">${ic("alerta")} Esta locação tem ${abertas.length} fatura${abertas.length === 1 ? "" : "s"} em aberto (${C.moeda(soma(abertas, "total"))}). Encerrar não cancela as faturas — elas continuam na cobrança.</div>` : ""}
      <label class="campo" style="max-width:240px"><span>Data da devolução / encerramento</span><input type="date" name="data" value="${hoje}"></label>
      <div class="sec-tit">${ic("caminhao")} Frete de devolução</div>
      ${devs.length ? `<div class="aviso-linha verde">${ic("check")} Devolução já registrada: ${devs.map((f) => `<b>${C.moeda(f.valor)}</b> · ${esc(f.transportador || "")}${f.placa ? " · " + esc(f.placa) : ""}`).join("; ")}</div>${resumoHtml(rs)}` : `
        ${resumoHtml(rs, "devolucao")}
        <small class="muted">Combine o frete com o prestador dentro do teto. Se passar, o app exige justificativa e grava uma ocorrência.</small>
        <label class="check"><input type="checkbox" name="semfrete"> Sem frete de devolução (o cliente devolveu o equipamento por conta própria)</label>
        <div data-campos-frete style="display:flex;flex-direction:column;gap:12px">
          <div class="linha-campos c2">
            <label class="campo"><span>Prestador (frete)</span><select name="transp"><option value="">— escolha —</option>${ativos.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join("")}<option value="novo">+ Cadastrar novo prestador…</option></select></label>
            <label class="campo"><span>Caminhão prancha</span><select name="cam"><option value="">— escolha o prestador —</option></select></label></div>
          <div class="linha-campos c2">
            <label class="campo"><span>Valor pago ao prestador</span><input name="valor" inputmode="decimal" placeholder="0,00"></label>
            <label class="check" style="align-self:end;padding-bottom:9px"><input type="checkbox" name="pago"> Já foi pago ao prestador</label></div>
          <div class="linha-campos c2" data-pg hidden>
            <label class="campo"><span>Pago em</span><input type="date" name="pago_em" value="${hoje}"></label>
            <label class="campo"><span>Forma</span><select name="forma">${FORMAS.map((f) => `<option>${f}</option>`).join("")}</select></label></div>
          <div data-excesso></div>
        </div>`}
      <label class="campo"><span>Observação (opcional)</span><input name="obs" placeholder="ex.: equipamento voltou com avaria no cesto"></label></div>`);
    const v = (n) => $(`[name=${n}]`, corpo);
    let excede = 0;
    const semFrete = () => !!(v("semfrete") && v("semfrete").checked);
    function caminhoes() {
      if (!v("transp")) return;
      const t = (S.transp || []).find((x) => x.id === +v("transp").value), cams = t ? t.dados.caminhoes || [] : [];
      v("cam").innerHTML = cams.length ? cams.map((c, i) => `<option value="${i}">${esc(camTxt(c))}</option>`).join("") : `<option value="">${t ? "— sem caminhão cadastrado —" : "— escolha o prestador —"}</option>`;
    }
    function recalcular() {
      const exc = $("[data-excesso]", corpo); if (!exc) return;
      const val = r2(C.numBR(v("valor").value));
      const novo = !semFrete() && val > 0 ? r2(Math.max(0, rs.pago + val - rs.cobrado)) : 0;
      if ((novo > 0) !== !!$("[name=just]", exc)) {
        exc.innerHTML = novo > 0 ? `<div class="aviso-linha verm frete-alerta">${ic("alerta")}<div><b data-exc-txt></b>
          <label class="campo" style="margin-top:8px"><span>Justificativa (obrigatória — fica registrada)</span><input name="just" placeholder="ex.: retirada urgente em Anápolis no fim de semana"></label></div></div>` : "";
      }
      excede = novo;
      const t = $("[data-exc-txt]", exc);
      if (t) t.textContent = `Atenção: com este valor o frete pago fica ${C.moeda(novo)} acima do que foi cobrado do cliente (${C.moeda(rs.cobrado)}).`;
    }
    ML.modal({ titulo: "Encerrar locação", corpo, classe: "medio", botoes: [{ texto: "Cancelar" }, { texto: "Encerrar locação", classe: "primario", icone: "check", acao: async () => {
      const data = v("data").value; if (!data) throw new Error("Informe a data da devolução.");
      let linha = null;
      if (!devs.length && !semFrete()) {
        const tId = v("transp").value;
        if (!tId || tId === "novo") throw new Error("Escolha o prestador do frete de devolução — ou marque “Sem frete de devolução”.");
        const val = r2(C.numBR(v("valor").value));
        if (!(val > 0)) throw new Error("Informe o valor pago ao prestador pela devolução.");
        recalcular();
        const just = ($("[name=just]", corpo) || {}).value || "";
        if (excede > 0) {
          if (!just.trim()) { $("[name=just]", corpo).focus(); throw new Error("Explique por que o frete passou do valor cobrado do cliente."); }
          if (!await ML.confirmar("Frete acima do cobrado", `O frete pago vai ficar <b>${C.moeda(excede)}</b> acima do valor cobrado do cliente. Isso fica <b>registrado como ocorrência</b>. Confirmar o encerramento?`, "Registrar e encerrar", true)) return false;
        }
        const t = (S.transp || []).find((x) => x.id === +tId), cam = ((t && t.dados.caminhoes) || [])[+v("cam").value] || {};
        const pago = v("pago").checked;
        linha = { registro: l.registro, tipo: "devolucao", data, transportador_id: +tId, transportador: t ? t.nome : "", placa: cam.placa || "", tipo_caminhao: cam.tipo || "",
          valor: val, justificativa: excede > 0 ? just.trim() : "", pago_em: pago ? v("pago_em").value || hoje : null, forma: pago ? v("forma").value : "", obs: v("obs").value.trim() };
      } else if (!devs.length && !await ML.confirmar("Encerrar sem frete", "Encerrar a locação <b>sem registrar frete de devolução</b>? Use só quando o cliente devolveu o equipamento por conta própria.", "Encerrar sem frete")) return false;
      if (linha) { const r = await ML.sb.from("fat_fretes").insert(linha); if (r.error) throw r.error; }
      await ML.rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: Object.assign({ status: "encerrada", dataEncerramento: data },
        semFrete() ? { devolucaoSemFrete: true } : {}, v("obs").value.trim() ? { obsEncerramento: v("obs").value.trim() } : {}) });
      ML.aviso(linha && excede > 0 ? "Locação encerrada — frete acima do cobrado registrado como ocorrência." : linha ? "Locação encerrada e frete de devolução registrado." : "Locação encerrada.", linha && excede > 0 ? "erro" : "ok");
      await ML.recarregarERender();
    } }] });
    caminhoes(); recalcular();
    corpo.addEventListener("change", (e) => {
      const n = e.target.name;
      if (n === "semfrete") { $("[data-campos-frete]", corpo).hidden = e.target.checked; recalcular(); }
      if (n === "pago") $("[data-pg]", corpo).hidden = !e.target.checked;
      if (n === "transp") {
        if (e.target.value === "novo") {
          e.target.value = "";
          editarPrestador(null, (novo) => { e.target.insertBefore(el(`<option value="${novo.id}">${esc(novo.nome)}</option>`), e.target.querySelector("[value=novo]")); e.target.value = String(novo.id); caminhoes(); });
        }
        caminhoes();
      }
    });
    corpo.addEventListener("input", (e) => { if (e.target.name === "valor") recalcular(); });
    corpo.addEventListener("focusout", (e) => { if (e.target.name === "valor" && e.target.value.trim()) e.target.value = C.moeda(C.numBR(e.target.value), true); });
  }
  ML.encerrarLocacao = encerrarLocacao;

  // ================================================================ pagamento aos prestadores
  function pagar(ls) {
    if (!ls.length) return ML.aviso("Selecione os fretes a pagar.");
    const porT = new Map();
    for (const f of ls) { const k = f.transportador || "Sem prestador"; porT.set(k, (porT.get(k) || 0) + f.valor); }
    const total = soma(ls, "valor");
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="tabela-wrap"><table class="tab"><thead><tr><th>Prestador</th><th class="direita">Valor</th></tr></thead><tbody>
        ${[...porT.entries()].map(([n, vl]) => `<tr><td><b>${esc(n)}</b></td><td class="direita num">${C.moeda(vl)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>${ls.length} frete(s)</td><td class="direita num">${C.moeda(total)}</td></tr></tfoot></table></div>
      <div class="linha-campos c2">
        <label class="campo"><span>Data do pagamento</span><input type="date" name="data" value="${ML.hoje()}"></label>
        <label class="campo"><span>Forma</span><select name="forma">${FORMAS.map((f) => `<option>${f}</option>`).join("")}</select></label></div></div>`);
    ML.modal({ titulo: "Registrar pagamento de frete", corpo, classe: "medio", botoes: [{ texto: "Cancelar" }, { texto: `Confirmar ${C.moeda(total)}`, classe: "primario", icone: "check", acao: async () => {
      const data = $("[name=data]", corpo).value; if (!data) throw new Error("Informe a data do pagamento.");
      const r = await ML.sb.from("fat_fretes").update({ pago_em: data, forma: $("[name=forma]", corpo).value }).in("id", ls.map((f) => f.id));
      if (r.error) throw r.error;
      S.ui.fre && S.ui.fre.sel.clear();
      ML.aviso(`Pagamento de ${C.moeda(total)} registrado.`, "ok"); await ML.recarregarERender();
    } }] });
  }
  async function desfazerPagamento(f) {
    if (!f) return;
    if (!await ML.confirmar("Desfazer pagamento", `O frete de <b>${C.moeda(f.valor)}</b> (${esc(f.transportador || "")}) volta para <b>a pagar</b>.`, "Desfazer")) return;
    const r = await ML.sb.from("fat_fretes").update({ pago_em: null, forma: "" }).eq("id", f.id);
    if (r.error) return ML.aviso(ML.msgErro(r.error), "erro");
    ML.aviso("Pagamento desfeito."); await ML.recarregarERender();
  }

  // ================================================================ prestadores
  function editarPrestador(t, aoSalvar) {
    const d = (t && t.dados) || {};
    let cams = (d.caminhoes || []).map((c) => Object.assign({}, c));
    if (!cams.length) cams.push({ placa: "", tipo: "" });
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="linha-campos c3">
        <label class="campo" style="grid-column:span 2"><span>Nome do prestador *</span><input name="nome" value="${esc(t ? t.nome : "")}" placeholder="nome ou empresa"></label>
        <label class="campo"><span>Telefone / WhatsApp</span><input name="telefone" value="${esc(d.telefone || "")}" placeholder="(61) 9 ...."></label></div>
      <label class="campo"><span>CPF / CNPJ</span><input name="documento" value="${esc(d.documento || "")}"></label>
      <div class="sec-tit">${ic("caminhao")} Caminhões prancha</div>
      <div data-cams></div>
      <button type="button" class="btn peq fantasma" data-add-cam style="align-self:flex-start">${ic("mais")}Adicionar caminhão</button>
      <div class="sec-tit">${ic("dinheiro")} Dados bancários</div>
      <div class="linha-campos c3">
        <label class="campo"><span>Tipo da chave Pix</span><select name="tipoPix">${["", "CPF", "CNPJ", "Telefone", "E-mail", "Aleatória"].map((x) => `<option ${d.tipoPix === x ? "selected" : ""} value="${x}">${x || "—"}</option>`).join("")}</select></label>
        <label class="campo" style="grid-column:span 2"><span>Chave Pix</span><input name="pix" value="${esc(d.pix || "")}"></label></div>
      <div class="linha-campos c4">
        <label class="campo"><span>Banco</span><input name="banco" value="${esc(d.banco || "")}"></label>
        <label class="campo"><span>Agência</span><input name="agencia" value="${esc(d.agencia || "")}"></label>
        <label class="campo"><span>Conta</span><input name="conta" value="${esc(d.conta || "")}"></label>
        <label class="campo"><span>Tipo</span><select name="tipoConta">${["corrente", "poupança", "pagamento"].map((x) => `<option ${d.tipoConta === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
      <div class="linha-campos c2">
        <label class="campo"><span>Titular da conta (se for outra pessoa)</span><input name="titular" value="${esc(d.titular || "")}"></label>
        <label class="campo"><span>CPF/CNPJ do titular</span><input name="docTitular" value="${esc(d.docTitular || "")}"></label></div>
      <label class="campo"><span>Observações</span><input name="obs" value="${esc(d.obs || "")}"></label>
      ${t ? `<label class="check"><input type="checkbox" name="ativo" ${t.ativo ? "checked" : ""}> Ativo (aparece na hora de registrar frete)</label>` : ""}</div>`);
    function desenharCams() {
      $("[data-cams]", corpo).innerHTML = cams.map((c, i) => `<div class="cam-linha" data-ci="${i}">
        <input data-cf="placa" value="${esc(c.placa || "")}" placeholder="Placa (ex.: ABC1D23)" style="text-transform:uppercase">
        <select data-cf="tipo"><option value="">tipo da prancha…</option>${TIPOS_CAM.map((x) => `<option ${c.tipo === x ? "selected" : ""}>${x}</option>`).join("")}</select>
        <input data-cf="obs" value="${esc(c.obs || "")}" placeholder="obs. (capacidade, modelo…)">
        <button type="button" class="ic-btn peq" data-rem-cam="${i}" title="Remover">${ic("lixo")}</button></div>`).join("");
      ML.hidratarIcones && ML.hidratarIcones($("[data-cams]", corpo));
    }
    desenharCams();
    corpo.addEventListener("input", (e) => { const b = e.target.closest("[data-ci]"); if (b && e.target.dataset.cf) cams[+b.dataset.ci][e.target.dataset.cf] = e.target.dataset.cf === "placa" ? e.target.value.toUpperCase().trim() : e.target.value; });
    corpo.addEventListener("change", (e) => { const b = e.target.closest("[data-ci]"); if (b && e.target.dataset.cf) cams[+b.dataset.ci][e.target.dataset.cf] = e.target.dataset.cf === "placa" ? e.target.value.toUpperCase().trim() : e.target.value; });
    corpo.addEventListener("click", (e) => {
      if (e.target.closest("[data-add-cam]")) { cams.push({ placa: "", tipo: "" }); desenharCams(); $$("[data-cf=placa]", corpo).pop().focus(); }
      const r = e.target.closest("[data-rem-cam]"); if (r) { cams.splice(+r.dataset.remCam, 1); desenharCams(); }
    });
    ML.modal({ titulo: t ? "Editar prestador de frete" : "Novo prestador de frete", corpo, classe: "medio", botoes: [{ texto: "Cancelar" }, { texto: "Salvar", classe: "primario", acao: async () => {
      const v = (n) => ($(`[name=${n}]`, corpo) || {}).value || "";
      const nome = v("nome").trim().toUpperCase();
      if (!nome) throw new Error("Informe o nome do prestador.");
      const caminhoes = cams.filter((c) => c.placa || c.tipo).map((c, i) => ({ id: c.id || "c" + Date.now().toString(36) + i, placa: (c.placa || "").toUpperCase().replace(/\s+/g, ""), tipo: c.tipo || "", obs: (c.obs || "").trim() }));
      const placas = caminhoes.map((c) => c.placa).filter(Boolean);
      if (new Set(placas).size !== placas.length) throw new Error("Há placa repetida.");
      const dados = { telefone: v("telefone").trim(), documento: v("documento").trim(), tipoPix: v("tipoPix"), pix: v("pix").trim(), banco: v("banco").trim(), agencia: v("agencia").trim(),
        conta: v("conta").trim(), tipoConta: v("tipoConta"), titular: v("titular").trim(), docTitular: v("docTitular").trim(), obs: v("obs").trim(), caminhoes };
      const linha = { nome, dados, ativo: t ? !!($("[name=ativo]", corpo) || {}).checked : true, atualizado_em: new Date().toISOString() };
      const r = t ? await ML.sb.from("fat_transportadores").update(linha).eq("id", t.id).select() : await ML.sb.from("fat_transportadores").insert(linha).select();
      if (r.error) throw r.error;
      const novo = Object.assign({}, r.data[0], { id: +r.data[0].id });
      ML.aviso(`Prestador ${nome} salvo.`, "ok");
      if (aoSalvar) { S.transp = (S.transp || []).filter((x) => x.id !== novo.id).concat(novo); aoSalvar(novo); }
      else await ML.recarregarERender();
    } }] });
  }
  ML.editarPrestador = editarPrestador;

  // ================================================================ ajustes e exportação
  function ajustes() {
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <label class="campo"><span>Cobrar o registro da entrega a partir de (opcional)</span><input type="date" name="inicio" value="${esc(inicio())}">
        <small>Locações implantadas antes desta data não aparecem como “entrega não registrada” (o frete delas foi acertado fora do app). Ainda dá para registrar a devolução delas normalmente.</small></label></div>`);
    ML.modal({ titulo: "Ajustes do frete", corpo, classe: "medio", botoes: [{ texto: "Cancelar" }, { texto: "Salvar", classe: "primario", acao: async () => {
      await ML.salvarConfig({ frete: Object.assign({}, S.cfg.frete || {}, { inicio: $("[name=inicio]", corpo).value }) });
      ML.aviso("Ajustes salvos.", "ok"); await ML.recarregarERender();
    } }] });
  }
  async function exportar() {
    const fretes = S.fretes || [];
    if (!fretes.length) return ML.aviso("Nenhum frete para exportar.");
    try {
      ML.aviso("Gerando planilha…");
      await ML.carregarScript("vendor/exceljs.min.js");
      const wb = new window.ExcelJS.Workbook(), ws = wb.addWorksheet("Fretes", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [{ header: "Data", key: "data", width: 12 }, { header: "Frete", key: "tipo", width: 11 }, { header: "Locação", key: "reg", width: 11 }, { header: "Cliente", key: "cli", width: 38 },
        { header: "Prestador", key: "tr", width: 28 }, { header: "Placa", key: "placa", width: 11 }, { header: "Prancha", key: "cam", width: 10 }, { header: "Valor pago", key: "valor", width: 13 },
        { header: "Cobrado do cliente (locação)", key: "cob", width: 16 }, { header: "Acima do cobrado", key: "exc", width: 14 }, { header: "Pagamento", key: "pg", width: 12 }, { header: "Forma", key: "forma", width: 13 },
        { header: "Fatura", key: "fat", width: 16 }, { header: "Justificativa", key: "just", width: 36 }, { header: "Obs.", key: "obs", width: 30 }];
      const dt = (s) => s ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null;
      for (const f of fretes.slice().sort((a, b) => (a.data || "").localeCompare(b.data || ""))) {
        const l = S.loc.get(f.registro), c = l ? S.cli.get(l.clienteId) || {} : {};
        ws.addRow({ data: dt(f.data), tipo: NOME_TIPO[f.tipo], reg: C.padReg(f.registro, S.cfg.digitosRegistro), cli: c.razaoSocial || "", tr: f.transportador, placa: f.placa, cam: f.tipo_caminhao,
          valor: f.valor, cob: ML.freteCobrado(f.registro), exc: f.excesso || null, pg: f.pago_em ? dt(f.pago_em) : "A pagar", forma: f.forma, fat: f.fatura, just: f.justificativa, obs: f.obs });
      }
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9480F" } };
      ["valor", "cob", "exc"].forEach((k) => (ws.getColumn(k).numFmt = '"R$" #,##0.00'));
      ["data", "pg"].forEach((k) => (ws.getColumn(k).numFmt = "dd/mm/yyyy"));
      ws.autoFilter = { from: "A1", to: "O1" };
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      a.download = `Fretes ${ML.hoje()}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    } catch (e) { ML.aviso(ML.msgErro(e), "erro"); }
  }

  // ================================================================ entrega na fatura de implantação (editor)
  // E.ent = { tId, cam, valor, pago, just }
  ML.freteEditor = {
    html(E) {
      const en = E.ent || (E.ent = { tId: "", cam: "0", valor: "", pago: false, just: "" });
      const ts = (S.transp || []).filter((t) => t.ativo);
      const t = ts.find((x) => String(x.id) === String(en.tId)), cams = t ? t.dados.caminhoes || [] : [];
      return `<div class="frete-ent" style="grid-column:1/-1">
        <div class="fe-tit">${ic("caminhao")}<b>Entrega</b> — quem faz o frete? <small class="muted">opcional agora · dá para registrar depois na aba Frete</small></div>
        <div class="fe-linha">
          <select data-fe="tId"><option value="">— prestador —</option>${ts.map((x) => `<option value="${x.id}" ${String(x.id) === String(en.tId) ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}<option value="novo">+ Cadastrar novo…</option></select>
          <select data-fe="cam" ${t ? "" : "disabled"}>${cams.length ? cams.map((c, i) => `<option value="${i}" ${String(i) === String(en.cam) ? "selected" : ""}>${esc(camTxt(c))}</option>`).join("") : `<option value="">${t ? "sem caminhão cadastrado" : "caminhão"}</option>`}</select>
          <input data-fe="valor" inputmode="decimal" placeholder="valor pago ao prestador" value="${esc(en.valor)}">
          <label class="check"><input type="checkbox" data-fe="pago" ${en.pago ? "checked" : ""}> já pago</label></div>
        <div data-fe-alerta>${this.alertaHtml(E)}</div></div>`;
    },
    excesso(E) {
      const en = E.ent || {}, val = r2(C.numBR(en.valor || 0)), cob = E.frete && E.frete.incluir ? r2((+E.frete.qtd || 0) * C.numBR(E.frete.unitario)) : 0;
      return val > 0 ? r2(Math.max(0, val - cob)) : 0;
    },
    alertaHtml(E) {
      const x = this.excesso(E); if (!(x > 0)) return "";
      return `<div class="aviso-linha verm frete-alerta">${ic("alerta")}<div><b data-fe-txt>${this.textoAlerta(E)}</b>
        <input data-fe="just" value="${esc((E.ent || {}).just || "")}" placeholder="Justificativa obrigatória (fica registrada)" style="margin-top:6px;width:100%"></div></div>`;
    },
    textoAlerta(E) {
      const cob = E.frete && E.frete.incluir ? r2((+E.frete.qtd || 0) * C.numBR(E.frete.unitario)) : 0;
      return `O valor pago ao prestador passa ${C.moeda(this.excesso(E))} do frete cobrado do cliente (${C.moeda(cob)}).`;
    },
    // trata um campo; devolve true quando o bloco precisa ser redesenhado
    evento(E, t, aoNovo) {
      const en = E.ent || (E.ent = {}), k = t.dataset.fe;
      if (k === "tId" && t.value === "novo") { t.value = en.tId || ""; editarPrestador(null, (novo) => { en.tId = String(novo.id); en.cam = "0"; aoNovo && aoNovo(); }); return false; }
      if (k === "pago") en.pago = t.checked; else en[k] = t.value;
      if (k === "tId") { en.cam = "0"; return true; }
      return false;
    },
    // atualiza só o alerta (sem tirar o foco de quem está digitando)
    atualizarAlerta(E, raiz) {
      const box = $("[data-fe-alerta]", raiz); if (!box) return;
      const tem = !!$("[data-fe=just]", box), precisa = this.excesso(E) > 0;
      if (tem !== precisa) { box.innerHTML = this.alertaHtml(E); ML.hidratarIcones && ML.hidratarIcones(box); }
      else if (precisa) $("[data-fe-txt]", box).textContent = this.textoAlerta(E);
    },
    validar(E) {
      const en = E.ent || {}; if (!E.frete || !E.frete.incluir) return "";
      const val = r2(C.numBR(en.valor || 0));
      if (en.tId && !(val > 0)) return "Informe o valor pago ao prestador do frete (ou deixe o prestador em branco para registrar depois).";
      if (val > 0 && !en.tId) return "Escolha o prestador que fez o frete de entrega.";
      if (this.excesso(E) > 0 && !String(en.just || "").trim()) return "O frete pago passa do valor cobrado do cliente: escreva a justificativa.";
      return "";
    },
    async salvar(E, registro, fatura) {
      const en = E.ent || {}; if (!E.frete || !E.frete.incluir || !en.tId) return null;
      const t = (S.transp || []).find((x) => String(x.id) === String(en.tId)), cam = ((t && t.dados.caminhoes) || [])[+en.cam || 0] || {};
      const r = await ML.sb.from("fat_fretes").insert({ registro, tipo: "entrega", data: E.dataInicio || E.dataEmissao || ML.hoje(), transportador_id: +en.tId, transportador: t ? t.nome : "",
        placa: cam.placa || "", tipo_caminhao: cam.tipo || "", valor: r2(C.numBR(en.valor)), fatura: fatura || "", justificativa: this.excesso(E) > 0 ? String(en.just || "").trim() : "",
        pago_em: en.pago ? ML.hoje() : null, forma: en.pago ? "Pix" : "" });
      if (r.error) throw r.error;
      return this.excesso(E);
    },
  };
})();
