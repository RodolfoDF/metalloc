// Comissões do representante: quanto cada dono deve, pagamentos (acertos), saldo e extrato.
(function () {
  "use strict";
  const ML = window.ML, C = ML.C, S = ML.S, { $, $$, esc, el, ic, vg } = ML;

  const regras = () => Object.assign({ nome: "Representante", pct: 5, base: "paga", inicio: "" }, S.cfg.comissao || {});
  const NOME_ST = { aberto: "A pagar", parcial: "Parcial", pago: "Pago", credito: "Crédito" };
  const FORMAS = ["Pix", "Transferência", "Dinheiro", "Desconto no repasse", "Outro"];
  const stBadge = (s) => `<span class="sit com-${s}">${NOME_ST[s]}</span>`;

  function lancamentos() {
    const r = regras();
    return C.comissoes(S.faturas, S.pagCom || [], { base: r.base, inicio: r.inicio, nomes: S.nomes, hoje: ML.hoje() });
  }
  // comissão que ainda vai ficar devida quando os clientes pagarem (só na regra "paga")
  function previstas() {
    if (regras().base !== "paga") return { valor: 0, n: 0 };
    let c = 0, n = 0;
    for (const f of S.faturas) if (f.status === "emitida") { const r = C.rateio(f, S.nomes); if (r.comissao) { c += r.comissao; n++; } }
    return { valor: Math.round(c * 100) / 100, n };
  }
  ML.qtdComissoesAbertas = () => new Set(lancamentos().filter((l) => l.saldo > 0).map((l) => l.uid)).size;
  ML.saldoComissoes = () => lancamentos().filter((l) => l.saldo > 0).reduce((s, l) => s + l.saldo, 0);
  ML.comissaoDaFatura = (f) => { const r = regras(); return C.comissoes([f], S.pagCom || [], { base: r.base, inicio: r.inicio, nomes: S.nomes }).filter((l) => l.uid === f.uid); };

  ML.TELAS.comissoes = function (main) {
    const st = S.ui.com || (S.ui.com = { aba: "apagar", dono: "", de: "", ate: "", sel: new Set() });
    const r = regras(), hoje = ML.hoje(), mes = hoje.slice(0, 7), ano = hoje.slice(0, 4);
    const todos = lancamentos();
    const filtra = (l) => (!st.dono || l.donoId === st.dono) && (!st.de || (l.competencia || "") >= st.de || !l.competencia) && (!st.ate || !l.competencia || l.competencia <= st.ate);
    const lista = todos.filter(filtra);
    const abertos = lista.filter((l) => l.saldo !== 0);
    const aPagar = todos.filter((l) => l.saldo > 0).reduce((s, l) => s + l.saldo, 0);
    const creditos = todos.filter((l) => l.saldo < 0).reduce((s, l) => s + l.saldo, 0);
    const pagMes = (S.pagCom || []).filter((p) => (p.data || "").startsWith(mes)).reduce((s, p) => s + p.valor, 0);
    const pagAno = (S.pagCom || []).filter((p) => (p.data || "").startsWith(ano)).reduce((s, p) => s + p.valor, 0);
    const prev = previstas();
    const nFat = new Set(todos.filter((l) => l.saldo > 0).map((l) => l.uid)).size;
    const donosCom = [...new Map(todos.map((l) => [l.donoId, l.nome])).entries()];
    const nomeMes = new Date(+mes.slice(0, 4), +mes.slice(5) - 1, 15).toLocaleDateString("pt-BR", { month: "long" });

    main.innerHTML = `
      <div class="pag-cab"><h1>Comissões do representante</h1>
        <button class="btn" data-acao="regras">${ic("config")}Regras</button>
        <button class="btn" data-acao="extrato">${ic("excel")}Extrato Excel</button>
        <button class="btn primario" data-acao="pagar">${ic("dinheiro")}Registrar pagamento</button>
        <div class="sub">${C.pctBR(r.pct)}% sobre a locação de cada dono (frete fora; na sublocação, sobre a margem). Fica devida quando ${r.base === "paga" ? "o cliente <b>paga</b> a fatura" : "a fatura é <b>emitida</b>"}.
          Cada dono paga a comissão da sua parte.${r.inicio ? ` Controle a partir de ${C.dataBR(r.inicio)}.` : ""}</div></div>
      <div class="grade kpis">
        <button class="cartao kpi destaque" data-aba="apagar"><span class="rot">A pagar ao representante</span><span class="seta">${ic("seta")}</span>${vg(aPagar)}
          <span class="det">${nFat} fatura${nFat === 1 ? "" : "s"} com comissão em aberto</span></button>
        <button class="cartao kpi" data-aba="pagamentos"><span class="rot">Pago em ${nomeMes}</span><span class="seta">${ic("seta")}</span>${vg(pagMes)}<span class="det">${C.moeda(pagAno)} no ano</span></button>
        <div class="cartao kpi" style="cursor:default"><span class="rot">${r.base === "paga" ? "Aguardando o cliente pagar" : "Faturas em aberto"}</span>${vg(prev.valor)}
          <span class="det">${r.base === "paga" ? `comissão de ${prev.n} fatura(s) ainda não paga(s)` : "já contadas como devidas"}</span></div>
        <div class="cartao kpi ${creditos ? "alerta" : ""}" style="cursor:default"><span class="rot">Créditos a descontar</span>${vg(-creditos)}
          <span class="det">${creditos ? "comissão paga de fatura cancelada/reaberta" : "nenhum"}</span></div>
      </div>
      <div class="filtros">
        <div class="alternar">${[["apagar", "A pagar"], ["lancamentos", "Todos os lançamentos"], ["pagamentos", "Pagamentos feitos"]].map(([k, t]) => `<button data-aba="${k}" class="${st.aba === k ? "ativo" : ""}">${t}</button>`).join("")}</div>
        <select data-f="dono"><option value="">Todos os donos</option>${donosCom.map(([id, n]) => `<option value="${esc(id)}" ${id === st.dono ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
        ${st.aba !== "pagamentos" ? `<span class="muted" style="font-size:12.5px">${r.base === "paga" ? "Pagas" : "Emitidas"} de</span><input type="date" data-f="de" value="${st.de}"><span class="muted">a</span><input type="date" data-f="ate" value="${st.ate}">` : ""}
      </div>
      <div data-area></div>`;
    const area = $("[data-area]", main);

    if (st.aba === "apagar") {
      const porDono = new Map();
      for (const l of abertos) { if (!porDono.has(l.donoId)) porDono.set(l.donoId, []); porDono.get(l.donoId).push(l); }
      if (!porDono.size) area.innerHTML = `<div class="cartao vazio" style="padding:36px">${ic("check")}<p style="margin:8px 0 0"><b>Nada a pagar.</b> Todas as comissões ${st.dono ? "deste dono " : ""}estão em dia.</p></div>`;
      else area.innerHTML = [...porDono.entries()].sort((a, b) => S.donos.findIndex((d) => d.id === a[0]) - S.donos.findIndex((d) => d.id === b[0])).map(([id, ls]) => {
        const saldo = ls.reduce((s, l) => s + l.saldo, 0);
        return `<div class="cartao" style="margin-bottom:14px" data-grupo="${esc(id)}">
          <div class="cartao-cab"><label class="check"><input type="checkbox" data-sel-grupo="${esc(id)}" ${ls.every((l) => st.sel.has(l.chave)) ? "checked" : ""}></label>
            <h2>${esc(ls[0].nome)}</h2><span class="muted">${ls.length} lançamento${ls.length === 1 ? "" : "s"}</span>
            <div class="acoes">${vg(saldo, "medio")}<button class="btn peq ${saldo < 0 ? "" : "primario"}" data-pagar-dono="${esc(id)}">${ic("check")}${saldo < 0 ? "Registrar devolução" : "Pagar tudo"}</button></div></div>
          ${tabela(ls, true)}</div>`;
      }).join("");
      const totSel = todos.filter((l) => st.sel.has(l.chave)).reduce((s, l) => s + l.saldo, 0);
      if (st.sel.size) area.insertAdjacentHTML("beforeend", `<div class="barra-sel"><span>${st.sel.size} selecionado(s) · <b>${C.moeda(totSel)}</b></span>
        <button class="btn fantasma peq" data-acao="limpar-sel">Limpar</button><button class="btn primario" data-acao="pagar-sel">${ic("dinheiro")}Registrar pagamento dos selecionados</button></div>`);
    } else if (st.aba === "lancamentos") {
      area.innerHTML = lista.length ? `<div class="cartao">${tabela(lista, false, true)}</div>` : `<div class="cartao vazio">Nenhuma comissão ${r.base === "paga" ? "devida (nenhuma fatura paga" : "(nenhuma fatura emitida"} no período).</div>`;
    } else {
      const pags = (S.pagCom || []).filter((p) => !st.dono || p.dono_id === st.dono);
      area.innerHTML = pags.length ? `<div class="cartao"><div class="tabela-wrap"><table class="tab"><thead><tr><th>Data</th><th>Dono que pagou</th><th class="direita">Valor</th><th>Forma</th><th>Faturas</th><th>Obs.</th><th>Registrado por</th><th></th></tr></thead><tbody>
        ${pags.map((p) => `<tr><td class="nowrap">${C.dataBR(p.data)}</td><td><b>${esc(S.nomes[p.dono_id] || p.dono_nome)}</b></td><td class="direita num"><b>${C.moeda(p.valor)}</b></td>
          <td>${esc(p.forma)}</td><td><small>${esc((p.itens || []).map((i) => i.numero).join(", "))}</small></td><td><small>${esc(p.obs)}</small></td>
          <td><small class="muted">${esc(p.criado_por)}</small></td>
          <td class="acoes-td"><button class="ic-btn peq" title="Recibo" data-recibo="${p.id}">${ic("baixar")}</button><button class="ic-btn peq" title="Desfazer este pagamento" data-desfazer="${p.id}">${ic("lixo")}</button></td></tr>`).join("")}
        </tbody><tfoot><tr><td colspan="2">${pags.length} pagamento(s)</td><td class="direita num">${C.moeda(pags.reduce((s, p) => s + p.valor, 0))}</td><td colspan="5"></td></tr></tfoot></table></div></div>`
        : `<div class="cartao vazio">Nenhum pagamento registrado ainda.</div>`;
    }

    function tabela(ls, comSel, comStatus) {
      const tot = (k) => ls.reduce((s, l) => s + l[k], 0);
      return `<div class="tabela-wrap"><table class="tab"><thead><tr>${comSel ? "<th></th>" : ""}<th>Fatura</th><th>Cliente</th>${comStatus ? "<th>Dono</th>" : ""}<th>${r.base === "paga" ? "Paga em" : "Emitida em"}</th>
        <th class="direita">Base</th><th class="direita">Comissão</th><th class="direita">Já pago</th><th class="direita">Saldo</th>${comStatus ? "<th>Situação</th>" : ""}</tr></thead><tbody>
        ${ls.map((l) => `<tr class="com-${l.status} ${l.registro ? "clicavel" : ""}" ${l.registro ? `data-fat="${l.registro}:${l.seq}"` : ""}>
          ${comSel ? `<td><input type="checkbox" data-sel="${esc(l.chave)}" ${st.sel.has(l.chave) ? "checked" : ""}></td>` : ""}
          <td class="nfat">${esc(l.numero)}</td><td><span class="cli-nome" style="max-width:260px">${esc(l.cliente)}</span>${l.status === "credito" ? `<small class="txt-verm">${l.excluida ? "fatura excluída" : "fatura " + (l.situacaoFatura === "cancelada" ? "cancelada" : "reaberta")} — descontar</small>` : ""}</td>
          ${comStatus ? `<td>${esc(l.nome)}</td>` : ""}<td class="nowrap">${l.competencia ? C.dataBR(l.competencia) : "—"}</td>
          <td class="direita num">${l.base ? C.moeda(l.base) : ""}</td><td class="direita num">${C.moeda(l.devido)}</td>
          <td class="direita num">${l.pago ? C.moeda(l.pago) : ""}</td><td class="direita num"><b>${C.moeda(l.saldo)}</b></td>${comStatus ? `<td>${stBadge(l.status)}</td>` : ""}</tr>`).join("")}
        </tbody><tfoot><tr>${comSel ? "<td></td>" : ""}<td colspan="${comStatus ? 4 : 3}">Total</td><td class="direita num">${C.moeda(tot("base"))}</td><td class="direita num">${C.moeda(tot("devido"))}</td>
          <td class="direita num">${C.moeda(tot("pago"))}</td><td class="direita num">${C.moeda(tot("saldo"))}</td>${comStatus ? "<td></td>" : ""}</tr></tfoot></table></div>`;
    }

    main.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-aba],[data-acao],[data-pagar-dono],[data-desfazer],[data-recibo],[data-sel],[data-sel-grupo]"); if (!t) return;
      if (t.dataset.sel != null) { e.stopPropagation(); t.checked ? st.sel.add(t.dataset.sel) : st.sel.delete(t.dataset.sel); return ML.render(); }
      if (t.dataset.selGrupo != null) { abertos.filter((l) => l.donoId === t.dataset.selGrupo).forEach((l) => (t.checked ? st.sel.add(l.chave) : st.sel.delete(l.chave))); return ML.render(); }
      if (t.dataset.aba) { st.aba = t.dataset.aba; return ML.render(); }
      if (t.dataset.pagarDono) return registrarPagamento(todos.filter((l) => l.donoId === t.dataset.pagarDono && l.saldo !== 0));
      if (t.dataset.desfazer) return desfazer((S.pagCom || []).find((p) => String(p.id) === t.dataset.desfazer));
      if (t.dataset.recibo) return recibo((S.pagCom || []).find((p) => String(p.id) === t.dataset.recibo));
      const a = t.dataset.acao;
      if (a === "regras") return editarRegras();
      if (a === "limpar-sel") { st.sel.clear(); return ML.render(); }
      if (a === "pagar-sel") return registrarPagamento(todos.filter((l) => st.sel.has(l.chave)));
      if (a === "pagar") return registrarPagamento(todos.filter((l) => l.saldo !== 0 && (!st.dono || l.donoId === st.dono)));
      if (a === "extrato") return extrato(lista, st);
    });
    main.addEventListener("change", (e) => { const k = e.target.dataset.f; if (k) { st[k] = e.target.value; st.sel.clear(); ML.render(); } });
    ML.ligarTabelas(area);
  };

  // ================================================================ registrar pagamento
  function registrarPagamento(itens) {
    if (!itens.length) return ML.aviso("Não há comissão em aberto para pagar.");
    const porDono = new Map();
    for (const l of itens) { if (!porDono.has(l.donoId)) porDono.set(l.donoId, []); porDono.get(l.donoId).push(l); }
    const total = itens.reduce((s, l) => s + l.saldo, 0);
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="tabela-wrap" style="max-height:40vh"><table class="tab"><thead><tr><th>Dono que paga</th><th class="centro">Faturas</th><th class="direita">Valor</th></tr></thead><tbody>
        ${[...porDono.values()].map((ls) => `<tr><td><b>${esc(ls[0].nome)}</b><small class="muted">${esc(ls.map((l) => l.numero + (l.saldo < 0 ? " (crédito)" : "")).join(", "))}</small></td>
          <td class="centro">${ls.length}</td><td class="direita num"><b>${C.moeda(ls.reduce((s, l) => s + l.saldo, 0))}</b></td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="2">${total < 0 ? "Total devolvido pelo representante (crédito)" : "Total pago ao representante"}</td><td class="direita num">${C.moeda(total)}</td></tr></tfoot></table></div>
      ${itens.some((l) => l.saldo < 0) ? `<div class="aviso-linha lar">Créditos de faturas canceladas/reabertas foram descontados do valor.</div>` : ""}
      <div class="linha-campos c2">
        <label class="campo"><span>Data do pagamento</span><input type="date" name="data" value="${ML.hoje()}"></label>
        <label class="campo"><span>Forma</span><select name="forma">${FORMAS.map((f) => `<option>${f}</option>`).join("")}</select></label></div>
      <label class="campo"><span>Observação (opcional)</span><input name="obs" placeholder="ex.: comprovante Pix 13/11"></label></div>`);
    ML.modal({ titulo: total < 0 ? "Registrar devolução do representante" : "Registrar pagamento de comissão", corpo, classe: "medio", botoes: [{ texto: "Cancelar" }, { texto: `Confirmar ${C.moeda(total)}`, classe: "primario", icone: "check", acao: async () => {
      const data = $("[name=data]", corpo).value;
      if (!data) throw new Error("Informe a data do pagamento.");
      const reg = [...porDono.entries()].map(([id, ls]) => ({
        data, dono_id: id, dono_nome: ls[0].nome, valor: Math.round(ls.reduce((s, l) => s + l.saldo, 0) * 100) / 100,
        forma: $("[name=forma]", corpo).value, obs: $("[name=obs]", corpo).value.trim(), criado_por: S.op.nome || S.user.email,
        itens: ls.map((l) => ({ uid: l.uid, numero: l.numero, cliente: l.cliente, valor: l.saldo })),
      }));
      const r = await ML.sb.from("fat_comissao_pagamentos").insert(reg);
      if (r.error) throw r.error;
      (S.ui.com || {}).sel && S.ui.com.sel.clear();
      ML.aviso(`Pagamento de ${C.moeda(total)} registrado.`, "ok");
      await ML.recarregarERender();
    } }] });
  }

  async function desfazer(p) {
    if (!p) return;
    if (!await ML.confirmar("Desfazer pagamento", `Apagar o pagamento de <b>${C.moeda(p.valor)}</b> de ${C.dataBR(p.data)} (${esc(S.nomes[p.dono_id] || p.dono_nome)})? As comissões voltam para <b>a pagar</b>.`, "Desfazer", true)) return;
    const r = await ML.sb.from("fat_comissao_pagamentos").delete().eq("id", p.id);
    if (r.error) return ML.aviso(ML.msgErro(r.error), "erro");
    ML.aviso("Pagamento desfeito."); await ML.recarregarERender();
  }

  // ================================================================ regras
  function editarRegras() {
    const r = regras();
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="linha-campos c2">
        <label class="campo"><span>Percentual da comissão</span><input name="pct" inputmode="decimal" value="${C.pctBR(r.pct)}"><small>vale para as faturas emitidas a partir de agora</small></label>
        <label class="campo"><span>Nome do representante (opcional)</span><input name="nome" value="${esc(r.nome === "Representante" ? "" : r.nome)}" placeholder="aparece no extrato e no recibo"></label></div>
      <label class="campo"><span>A comissão fica devida quando…</span><select name="base">
        <option value="paga" ${r.base === "paga" ? "selected" : ""}>o cliente paga a fatura (recomendado)</option>
        <option value="emitida" ${r.base === "emitida" ? "selected" : ""}>a fatura é emitida</option></select>
        <small>Com “paga”, o representante só recebe sobre o que entrou no caixa; fatura cancelada ou reaberta depois de paga vira crédito para descontar.</small></label>
      <label class="campo"><span>Controlar a partir de (opcional)</span><input type="date" name="inicio" value="${esc(r.inicio || "")}">
        <small>Comissões anteriores a esta data são consideradas já acertadas fora do app.</small></label></div>`);
    ML.modal({ titulo: "Regras da comissão", corpo, classe: "medio", botoes: [{ texto: "Cancelar" }, { texto: "Salvar", classe: "primario", acao: async () => {
      const pct = C.numBR($("[name=pct]", corpo).value);
      if (!(pct >= 0 && pct <= 100)) throw new Error("Percentual inválido.");
      await ML.salvarConfig({ comissao: { nome: $("[name=nome]", corpo).value.trim() || "Representante", pct, base: $("[name=base]", corpo).value, inicio: $("[name=inicio]", corpo).value } });
      ML.aviso("Regras salvas.", "ok"); await ML.recarregarERender();
    } }] });
  }

  // ================================================================ extrato e recibo
  async function extrato(lista, st) {
    if (!lista.length && !(S.pagCom || []).length) return ML.aviso("Nada para exportar.");
    try {
      ML.aviso("Gerando planilha…");
      await ML.carregarScript("vendor/exceljs.min.js");
      const r = regras();
      const pags = (S.pagCom || []).filter((p) => !st.dono || p.dono_id === st.dono);
      await window.MLRel.comissoes(lista, pags, { regras: r, nomes: S.nomes,
        sub: `${r.nome && r.nome !== "Representante" ? r.nome + " · " : ""}${C.pctBR(r.pct)}% · devida quando a fatura é ${r.base === "paga" ? "paga" : "emitida"} · gerado em ${C.dataBR(ML.hoje())}`,
        arquivo: `Comissões ${ML.hoje()}.xlsx` });
    } catch (e) { ML.aviso(ML.msgErro(e), "erro"); }
  }
  function recibo(p) {
    if (!p) return;
    const r = regras(), emi = S.emissores[0] || {};
    const w = window.open("", "_blank");
    if (!w) return ML.aviso("Permita pop-ups para abrir o recibo.", "erro");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo de comissão ${C.dataBR(p.data)}</title>
      <style>body{font:14px/1.5 Arial,sans-serif;max-width:720px;margin:32px auto;padding:0 20px;color:#111}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:16px 0}
      td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}td.v,th.v{text-align:right}.ass{margin-top:70px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:12px}
      .top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #d9480f;padding-bottom:10px;margin-bottom:18px}img{height:48px}@media print{button{display:none}}</style></head><body>
      <div class="top"><img src="${location.href.split("#")[0].replace(/index\.html$/, "")}img/logo.png"><div style="text-align:right"><b>RECIBO DE COMISSÃO</b><br>${C.dataBR(p.data)}</div></div>
      <p>Recebi de <b>${esc(S.nomes[p.dono_id] || p.dono_nome)}</b>${emi.razaoSocial ? ` (equipamentos locados por ${esc(emi.razaoSocial)})` : ""} a importância de <b>${C.moeda(p.valor)}</b>,
        referente à comissão de representante (${C.pctBR(r.pct)}%) das faturas abaixo, paga via ${esc(p.forma || "—")}.</p>
      <table><tr><th>Fatura</th><th>Cliente</th><th class="v">Comissão</th></tr>
        ${(p.itens || []).map((i) => `<tr><td>${esc(i.numero)}</td><td>${esc(i.cliente || "")}</td><td class="v">${C.moeda(i.valor)}</td></tr>`).join("")}
        <tr><th colspan="2">Total</th><th class="v">${C.moeda(p.valor)}</th></tr></table>
      ${p.obs ? `<p>Obs.: ${esc(p.obs)}</p>` : ""}
      <div class="ass"><div>${esc(r.nome && r.nome !== "Representante" ? r.nome : "Representante")}</div><div>${esc(S.nomes[p.dono_id] || p.dono_nome)}</div></div>
      <p style="margin-top:30px"><button onclick="print()">Imprimir / salvar PDF</button></p></body></html>`);
    w.document.close();
  }
})();
