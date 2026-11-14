// Inventário de equipamentos: cadastro, situação (locado automático pela fatura atual), importação de planilha e Excel.
(function () {
  "use strict";
  const ML = window.ML, C = ML.C, S = ML.S, { $, $$, esc, el, ic, vg } = ML;

  const TIPOS = ["PLATAFORMA ARTICULADA", "PLATAFORMA TESOURA", "PLATAFORMA TELESCÓPICA", "PLATAFORMA MASTRO VERTICAL", "MINI CARREGADEIRA",
    "RETROESCAVADEIRA", "CAMINHÃO MUNCK", "MANIPULADOR TELESCÓPICO", "GERADOR"];
  const COR_SIT = { locado: "lar", disponivel: "verde-et", manutencao: "amarelo-et", inativo: "" };
  const badgeEq = (s) => `<span class="sit eq-${s}">${ML.NOME_SIT_EQ[s]}</span>`;

  function tiposConhecidos() {
    const s = new Set(TIPOS);
    (S.equip || []).forEach((e) => e.tipo && s.add(e.tipo));
    S.faturas.forEach((f) => (f.itens || []).forEach((i) => i.equip && !i.frete && s.add(i.equip)));
    return [...s].sort();
  }
  const textoDonosEq = (e) => C.textoDonosItem({ donos: e.donos || [], subParceiro: e.subParceiro }, S.nomes);
  const descEq = (e) => [e.tipo, [e.marca, e.modelo].filter(Boolean).join(" "), e.altura ? C.qtdBR(e.altura) + " m" : ""].filter(Boolean).join(" · ");
  ML.descEq = descEq;
  ML.rotuloEq = (e) => `${e.tag} — ${[e.apelido, e.tipo, e.marca, e.altura ? C.qtdBR(e.altura) + " m" : ""].filter(Boolean).join(" · ")}`;

  // ================================================================ tela
  ML.TELAS.equipamentos = function (main) {
    const st = S.ui.eq || (S.ui.eq = { modo: "quadro", sit: "todos", busca: "", tipo: "", dono: "" });
    const todos = S.equip || [];
    const cont = { todos: todos.length, locado: 0, disponivel: 0, manutencao: 0, inativo: 0 };
    todos.forEach((e) => { cont[ML.situacaoEquip(e)]++; });
    const ativos = todos.length - cont.inativo;
    const ocup = ativos ? Math.round(cont.locado / ativos * 100) : 0;
    const b = C.semAcento(st.busca).toLowerCase();
    const lista = todos.filter((e) => {
      const sit = ML.situacaoEquip(e), uso = S.emUso.get(e.id);
      if (st.sit !== "todos" && sit !== st.sit) return false;
      if (st.tipo && e.tipo !== st.tipo) return false;
      if (st.dono && !(e.donos || []).some((d) => d.donoId === st.dono)) return false;
      if (!b) return true;
      return C.semAcento([e.tag, e.apelido, e.tipo, e.marca, e.modelo, e.serie, textoDonosEq(e), uso ? ML.nomeCliente(uso.l.clienteId) : ""].join(" ")).toLowerCase().includes(b);
    });
    const tipos = [...new Set(todos.map((e) => e.tipo).filter(Boolean))].sort();
    main.innerHTML = `
      <div class="pag-cab"><h1>Equipamentos</h1>
        <div class="alternar"><button data-modo="quadro" class="${st.modo === "quadro" ? "ativo" : ""}">${ic("quadro")} Quadro</button><button data-modo="lista" class="${st.modo === "lista" ? "ativo" : ""}">${ic("lista")} Lista</button></div>
        <label class="btn" style="cursor:pointer">${ic("subir")}Importar planilha<input type="file" accept=".xlsx,.csv" data-importar hidden></label>
        <button class="btn" data-acao="exportar">${ic("excel")}Exportar Excel</button>
        <button class="btn primario" data-acao="novo">${ic("mais")}Novo equipamento</button></div>
      <div class="grade kpis">
        <button class="cartao kpi destaque" data-sit="locado"><span class="rot">Locados agora</span><span class="seta">${ic("seta")}</span>
          <span class="valor"><span class="int">${cont.locado}</span><span class="cs"> de ${ativos}</span></span><span class="det">${ocup}% da frota em operação</span></button>
        <button class="cartao kpi" data-sit="disponivel"><span class="rot">Disponíveis</span><span class="seta">${ic("seta")}</span><span class="valor"><span class="int">${cont.disponivel}</span></span><span class="det">prontos para locar</span></button>
        <button class="cartao kpi" data-sit="manutencao"><span class="rot">Em manutenção</span><span class="seta">${ic("seta")}</span><span class="valor"><span class="int">${cont.manutencao}</span></span><span class="det">fora de operação</span></button>
        <div class="cartao kpi" style="cursor:default"><span class="rot">Ocupação da frota</span>
          <div class="medidor" style="margin:6px 0 2px"><span style="width:${ocup}%;background:var(--laranja)"></span></div>
          <span class="valor medio"><span class="int">${ocup}%</span></span><span class="det">${cont.inativo ? cont.inativo + " inativo(s) fora da conta" : "locados ÷ ativos"}</span></div>
      </div>
      <div class="filtros">
        <input class="busca-local" type="search" placeholder="Buscar tag, apelido, marca, cliente…" value="${esc(st.busca)}" data-f="busca">
        <span class="chips">${[["todos", "Todos"], ["locado", "Locados"], ["disponivel", "Disponíveis"], ["manutencao", "Manutenção"], ["inativo", "Inativos"]]
          .map(([k, t]) => `<button class="chip ${st.sit === k ? "ativo" : ""}" data-sit="${k}">${t}<span class="n">${cont[k]}</span></button>`).join("")}</span>
        <select data-f="tipo"><option value="">Todos os tipos</option>${tipos.map((t) => `<option ${t === st.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select data-f="dono"><option value="">Todos os donos</option>${S.donos.map((d) => `<option value="${esc(d.id)}" ${d.id === st.dono ? "selected" : ""}>${esc(d.nome)}</option>`).join("")}</select>
      </div>
      <div data-area></div>`;
    const area = $("[data-area]", main);
    if (!todos.length) {
      area.innerHTML = `<div class="cartao vazio" style="padding:40px">${ic("equip")}<p style="margin:10px 0 4px"><b>Nenhum equipamento cadastrado ainda.</b></p>
        <p style="margin:0 0 14px">Cadastre um a um em “Novo equipamento” ou importe a planilha da frota (colunas como TAG/ID, TIPO, MARCA, MODELO, ALTURA, PROPRIETÁRIO).</p></div>`;
    } else if (!lista.length) area.innerHTML = `<div class="cartao vazio">Nenhum equipamento com estes filtros.</div>`;
    else if (st.modo === "quadro") {
      area.innerHTML = `<div class="grade cards-eq">${lista.map((e) => {
        const sit = ML.situacaoEquip(e), uso = S.emUso.get(e.id);
        const dias = uso && uso.u.periodoFim ? C.difDias(ML.hoje(), uso.u.periodoFim) : null;
        return `<div class="cartao card-eq ${sit}" data-eq="${esc(e.id)}">
          <div class="ce-topo"><span class="tag-eq">${esc(e.tag)}</span>${badgeEq(sit)}</div>
          <b class="ce-tipo">${esc(e.apelido || e.tipo || "—")}</b>
          <small class="muted">${esc(descEq(e) || "sem dados")}</small>
          <div class="ce-donos">${ic(C.ehSub((e.donos || [])[0]) ? "renovar" : "usuario")}<span>${esc(textoDonosEq(e) || "sem dono definido")}</span></div>
          ${uso ? `<div class="ce-uso"><span class="cli-nome">${esc(ML.nomeCliente(uso.l.clienteId))}</span>${ML.localNome(uso.l) ? `<small>${ic("mapa")} <b>${esc(ML.localNome(uso.l))}</b></small>` : ""}
            <small>${esc(uso.u.id)} · até ${C.dataBRc(uso.u.periodoFim)}${dias != null ? ` · <span class="${dias < 0 ? "txt-verm" : ""}">${ML.textoDias(dias)}</span>` : ""}</small></div>`
            : e.situacao === "manutencao" && e.obs ? `<div class="ce-uso"><small>${esc(e.obs)}</small></div>` : ""}
        </div>`;
      }).join("")}</div>`;
    } else {
      area.innerHTML = `<div class="tabela-wrap"><table class="tab"><thead><tr><th>Tag</th><th>Equipamento</th><th>Marca / modelo</th><th class="direita">Altura</th><th>Donos</th><th>Situação</th><th>Onde está</th></tr></thead><tbody>
        ${lista.map((e) => { const sit = ML.situacaoEquip(e), uso = S.emUso.get(e.id); return `<tr class="clicavel" data-eq="${esc(e.id)}">
          <td><span class="tag-eq">${esc(e.tag)}</span></td><td><b>${esc(e.tipo || "—")}</b>${e.apelido ? `<small class="muted">${esc(e.apelido)}</small>` : ""}</td>
          <td>${esc([e.marca, e.modelo].filter(Boolean).join(" "))}</td><td class="direita num">${e.altura ? C.qtdBR(e.altura) + " m" : ""}</td>
          <td><small>${esc(textoDonosEq(e))}</small></td><td>${badgeEq(sit)}</td>
          <td>${uso ? `<span class="cli-nome" style="max-width:240px">${esc(ML.nomeCliente(uso.l.clienteId))}</span><small class="muted">${esc(uso.u.id)} · até ${C.dataBRc(uso.u.periodoFim)}</small>` : sit === "disponivel" ? '<small class="muted">pátio</small>' : ""}</td></tr>`; }).join("")}
        </tbody></table></div>`;
    }
    main.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-modo],[data-sit],[data-acao],[data-eq]"); if (!t) return;
      if (t.dataset.modo) { st.modo = t.dataset.modo; return ML.render(); }
      if (t.dataset.sit) { st.sit = st.sit === t.dataset.sit && t.dataset.sit !== "todos" ? "todos" : t.dataset.sit; return ML.render(); }
      if (t.dataset.eq) return editarEquipamento(S.eqId.get(t.dataset.eq));
      if (t.dataset.acao === "novo") return editarEquipamento(null);
      if (t.dataset.acao === "exportar") return exportar(lista);
    });
    let tmr;
    $$("[data-f]", main).forEach((inp) => inp.addEventListener(inp.type === "search" ? "input" : "change", () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => { st[inp.dataset.f] = inp.value; ML.render(); if (inp.type === "search") { const n = $('[data-f="busca"]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, inp.type === "search" ? 200 : 0);
    }));
    $("[data-importar]", main).addEventListener("change", (ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (f) importarPlanilha(f); });
  };

  // ================================================================ cadastro
  function proximaTag() {
    let n = 0;
    for (const e of S.equip || []) { const m = /^MTL-?(\d+)$/i.exec(e.tag); if (m) n = Math.max(n, +m[1]); }
    return "MTL-" + String(n + 1).padStart(2, "0");
  }
  function historico(e) {
    const out = [];
    for (const f of S.faturas) if ((f.itens || []).some((i) => i.equipId === e.id || (i.tag && String(i.tag).toUpperCase() === String(e.tag).toUpperCase()))) out.push(f);
    return out.sort((a, b) => (b.dataEmissao || "").localeCompare(a.dataEmissao || ""));
  }

  function editarEquipamento(e) {
    const x = e || { tag: proximaTag(), apelido: "", tipo: "", marca: "", modelo: "", altura: "", alimentacao: "", ano: "", serie: "", donos: [], subParceiro: "", subCusto: "", situacao: "ativo", obs: "" };
    const est = { donos: (x.donos || []).map((d) => Object.assign({}, d, { tipo: C.ehSub(d) ? "sublocado" : "dono" })), subParceiro: x.subParceiro || "", subCusto: x.subCusto == null ? "" : x.subCusto };
    const uso = e && S.emUso.get(e.id), hist = e ? historico(e) : [];
    const totalHist = hist.filter((f) => f.status !== "cancelada").reduce((s, f) => s + (f.itens || []).filter((i) => i.equipId === e.id || String(i.tag || "").toUpperCase() === String(e.tag).toUpperCase())
      .reduce((a, i) => a + Math.round((+i.qtd || 0) * (+i.unitario || 0) * 100) / 100, 0), 0);
    const corpo = el(`<form style="display:flex;flex-direction:column;gap:12px" autocomplete="off">
      ${uso ? `<div class="aviso-linha lar">Locado para <b>${esc(ML.nomeCliente(uso.l.clienteId))}</b> · fatura ${esc(uso.u.id)} · período até ${C.dataBR(uso.u.periodoFim)}</div>` : ""}
      <div class="linha-campos" style="grid-template-columns:130px 1fr">
        <label class="campo"><span>Tag</span><input name="tag" required value="${esc(x.tag)}" style="text-transform:uppercase"></label>
        <label class="campo"><span>Apelido (opcional)</span><input name="apelido" value="${esc(x.apelido || "")}" placeholder="ex.: E450 ALEIJADINHA"></label></div>
      <div class="linha-campos c2">
        <label class="campo"><span>Tipo de equipamento</span><input name="tipo" list="lista-tipos" value="${esc(x.tipo || "")}" style="text-transform:uppercase"></label>
        <label class="campo"><span>Altura de trabalho (m)</span><input name="altura" inputmode="decimal" value="${esc(x.altura === "" || x.altura == null ? "" : C.qtdBR(x.altura))}"></label></div>
      <datalist id="lista-tipos">${tiposConhecidos().map((t) => `<option value="${esc(t)}">`).join("")}</datalist>
      <div class="linha-campos c3">
        <label class="campo"><span>Marca</span><input name="marca" list="lista-marcas" value="${esc(x.marca || "")}"></label>
        <label class="campo"><span>Modelo</span><input name="modelo" value="${esc(x.modelo || "")}"></label>
        <label class="campo"><span>Alimentação</span><select name="alimentacao">${["", "Diesel", "Elétrica", "Bi-energia", "Gasolina", "GLP"].map((a) => `<option ${a === (x.alimentacao || "") ? "selected" : ""}>${a}</option>`).join("")}</select></label></div>
      <datalist id="lista-marcas">${["Genie", "JLG", "Haulotte", "Hangcha", "Manitou", "Skyjack", "Snorkel", "Dingli", "Sinoboom", "LGMG", "Bobcat", "JCB", "Caterpillar", "New Holland", "Case"].map((m) => `<option value="${m}">`).join("")}</datalist>
      <div class="linha-campos c3">
        <label class="campo"><span>Nº de série</span><input name="serie" value="${esc(x.serie || "")}"></label>
        <label class="campo"><span>Ano</span><input name="ano" inputmode="numeric" value="${esc(x.ano || "")}"></label>
        <label class="campo"><span>Situação</span><select name="situacao"><option value="ativo">Ativo</option><option value="manutencao" ${x.situacao === "manutencao" ? "selected" : ""}>Em manutenção</option><option value="inativo" ${x.situacao === "inativo" ? "selected" : ""}>Inativo / vendido / devolvido</option></select></label></div>
      <div><div class="muted" style="font-size:12.5px;margin-bottom:6px">Dono(s) — usados automaticamente quando o equipamento entra numa fatura</div><div data-sel></div></div>
      <label class="campo"><span>Observações</span><textarea name="obs" rows="2">${esc(x.obs || "")}</textarea></label>
      ${e ? `<div class="aviso-linha">${hist.length ? `Aparece em <b>${hist.length}</b> fatura(s) · faturado ${C.moeda(totalHist)} · última: ${esc(hist[0].id)} (${esc((hist[0].tomador || {}).razaoSocial || "")})` : "Ainda não aparece em nenhuma fatura. Ao emitir, escolha esta tag no quadro de equipamentos."}</div>` : ""}
      <div class="erro" data-erro hidden></div></form>`);
    ML.seletorDonos($("[data-sel]", corpo), est);
    const f = corpo;
    const botoes = [{ texto: "Cancelar" }, { texto: "Salvar equipamento", classe: "primario", acao: async () => {
      const erro = $("[data-erro]", corpo);
      const tag = f.tag.value.trim().toUpperCase();
      const msg = !tag ? "Informe a tag." : (S.equip || []).some((o) => o.tag.toUpperCase() === tag && (!e || o.id !== e.id)) ? `A tag ${tag} já existe.` : est.donos.length ? ML.validarDonos(est) : null;
      if (msg) { erro.textContent = msg; erro.hidden = false; return false; }
      const dados = {
        apelido: f.apelido.value.trim(), tipo: f.tipo.value.trim().toUpperCase(), marca: f.marca.value.trim(), modelo: f.modelo.value.trim(),
        altura: f.altura.value.trim() ? C.numBR(f.altura.value) : "", alimentacao: f.alimentacao.value, serie: f.serie.value.trim(), ano: f.ano.value.trim(),
        situacao: f.situacao.value, obs: f.obs.value.trim(), donos: ML.donosDoItem(est),
      };
      if (est.donos.some((d) => C.ehSub(d))) { dados.subParceiro = String(est.subParceiro || "").trim(); dados.subCusto = Math.round(C.numBR(est.subCusto) * 100) / 100; }
      const id = e ? e.id : "e" + Date.now() + Math.floor(Math.random() * 1000);
      const r = await ML.sb.from("fat_equipamentos").upsert({ id, tag, dados, atualizado_em: new Date().toISOString() });
      if (r.error) throw r.error;
      ML.aviso(`Equipamento ${tag} salvo.`, "ok");
      await ML.recarregarERender();
    } }];
    if (e && !uso) botoes.unshift({ texto: "Excluir", classe: "perigo", esquerda: true, acao: async () => {
      if (!await ML.confirmar("Excluir equipamento", `Excluir <b>${esc(e.tag)}</b> do inventário? As faturas antigas continuam com o nome do equipamento.<br><br>Se ele foi vendido ou devolvido, prefira marcar a situação como <b>Inativo</b> para manter o histórico.`, "Excluir", true)) return false;
      const r = await ML.sb.from("fat_equipamentos").delete().eq("id", e.id);
      if (r.error) throw r.error;
      ML.aviso("Equipamento excluído.", "ok"); await ML.recarregarERender();
    } });
    ML.modal({ titulo: e ? `Equipamento ${e.tag}` : "Novo equipamento", corpo, classe: "medio", botoes });
  }
  ML.editarEquipamento = editarEquipamento;

  // ================================================================ importar planilha da frota
  const CAMPOS = {
    tag: ["TAG", "ID", "CODIGO", "COD", "PATRIMONIO", "IDENTIFICACAO"],
    apelido: ["APELIDO", "EQUIPAMENTO", "NOME", "DESCRICAO"],
    tipo: ["TIPO", "TIPO DE EQUIPAMENTO", "CATEGORIA"],
    marca: ["MARCA", "FABRICANTE"], modelo: ["MODELO"],
    altura: ["ALTURA", "ALTURA DE TRABALHO", "ALTURA (M)", "ALTURA TRABALHO"],
    alimentacao: ["ALIMENTACAO", "COMBUSTIVEL", "ENERGIA"],
    serie: ["SERIE", "N SERIE", "NUMERO DE SERIE", "Nº SERIE", "CHASSI"], ano: ["ANO", "ANO FABRICACAO"],
    dono: ["PROPRIETARIO", "DONO", "DONOS", "PROPRIETARIOS"],
  };
  const norm = (t) => C.semAcento(String(t == null ? "" : (t && t.text) || (t && t.result) || t)).toUpperCase().replace(/[º°]/g, "").replace(/\s+/g, " ").trim();
  function deduzirTipo(t) {
    const s = norm(t);
    if (/TESOURA|SCISSOR|\bGS[ -]?\d|PANTOGRAF/.test(s)) return "PLATAFORMA TESOURA";
    if (/ARTICULAD|\bZ[ -]?\d{2}|\bE\d{3}|\bHA\d|\bJLG \d{3}A/.test(s)) return "PLATAFORMA ARTICULADA";
    if (/TELESCOP|\bS[ -]?\d{2}\b/.test(s)) return "PLATAFORMA TELESCÓPICA";
    if (/MUNCK/.test(s)) return "CAMINHÃO MUNCK";
    if (/RETRO/.test(s)) return "RETROESCAVADEIRA";
    if (/MINI ?CARREG|BOBCAT/.test(s)) return "MINI CARREGADEIRA";
    return "";
  }
  function casarDonos(txt) {
    const s = norm(txt);
    if (!s) return [];
    const partes = s.split(/\s*(?:\/|,|;|\+|&|\bE\b)\s*/).filter(Boolean);
    const achados = [];
    for (const p of partes) {
      let d = S.donos.find((x) => x.tipo !== "sublocado" && norm(x.nome).split(" ")[0] === p.split(" ")[0]);
      if (!d && /EMPRESA|METAL ?LOC|F1|AN3/.test(p)) d = S.donos.find((x) => /METAL|EMPRESA/.test(norm(x.nome)));
      if (!d && /SUBLOC|PARCEIR|LOXAM|TERCEIR/.test(p)) d = S.donos.find((x) => x.tipo === "sublocado");
      if (d && !achados.some((a) => a.donoId === d.id)) achados.push({ donoId: d.id, nome: d.nome, pct: 0 });
    }
    const n = achados.length;
    achados.forEach((a, i) => { a.pct = i === n - 1 ? Math.round((100 - Math.floor(10000 / n) / 100 * (n - 1)) * 100) / 100 : Math.floor(10000 / n) / 100; });
    return achados;
  }
  async function lerPlanilha(arq) {
    const nome = arq.name.toLowerCase();
    let linhas = [];
    if (nome.endsWith(".csv")) {
      const txt = await arq.text(), sep = (txt.split("\n")[0].match(/;/g) || []).length >= (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
      linhas = txt.split(/\r?\n/).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
    } else {
      await ML.carregarScript("vendor/exceljs.min.js");
      const wb = new window.ExcelJS.Workbook();
      await wb.xlsx.load(await arq.arrayBuffer());
      // escolhe a aba com mais colunas reconhecidas (ex.: CADASTRO)
      let melhor = null;
      wb.eachSheet((ws) => {
        for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
          const vals = (ws.getRow(r).values || []).slice(1).map(norm);
          const n = Object.values(CAMPOS).filter((alts) => vals.some((v) => alts.includes(v))).length;
          if (n >= 2 && (!melhor || n > melhor.n)) melhor = { ws, r, n };
        }
      });
      if (!melhor) throw new Error("Não encontrei uma linha de títulos (TAG, TIPO, MARCA, PROPRIETÁRIO…) na planilha.");
      melhor.ws.eachRow((row, i) => { if (i >= melhor.r) linhas.push((row.values || []).slice(1).map((v) => v == null ? "" : (v.result != null ? v.result : v.text != null ? v.text : v))); });
      return linhas;
    }
    const iCab = linhas.findIndex((l) => Object.values(CAMPOS).filter((alts) => l.map(norm).some((v) => alts.includes(v))).length >= 2);
    if (iCab < 0) throw new Error("Não encontrei uma linha de títulos (TAG, TIPO, MARCA, PROPRIETÁRIO…) no arquivo.");
    return linhas.slice(iCab);
  }
  async function importarPlanilha(arq) {
    try {
      const linhas = await lerPlanilha(arq);
      const cab = linhas[0].map(norm), col = {};
      for (const [k, alts] of Object.entries(CAMPOS)) { const i = cab.findIndex((c) => alts.includes(c)); if (i >= 0) col[k] = i; }
      const val = (l, k) => (col[k] == null ? "" : String(l[col[k]] == null ? "" : l[col[k]]).trim());
      let n = 0; for (const e of S.equip || []) { const m = /^MTL-?(\d+)$/i.exec(e.tag); if (m) n = Math.max(n, +m[1]); }
      const novos = [];
      for (const l of linhas.slice(1)) {
        if (!l.some((c) => String(c).trim())) continue;
        const apelido = val(l, "apelido"), tipoTxt = val(l, "tipo");
        if (!apelido && !tipoTxt && !val(l, "tag") && !val(l, "marca")) continue;
        const tag = (val(l, "tag") || "MTL-" + String(++n).padStart(2, "0")).toUpperCase();
        const tipo = (tipoTxt ? (deduzirTipo(tipoTxt) || tipoTxt) : deduzirTipo(apelido + " " + val(l, "modelo"))).toUpperCase();
        const alt = val(l, "altura").replace(/[^\d,.]/g, "");
        const donoTxt = val(l, "dono");
        novos.push({ tag, apelido: apelido && apelido.toUpperCase() !== tipo ? apelido : "", tipo, marca: val(l, "marca"), modelo: val(l, "modelo"),
          altura: alt ? C.numBR(alt) : "", alimentacao: val(l, "alimentacao"), serie: val(l, "serie"), ano: val(l, "ano"), donoTxt, donos: casarDonos(donoTxt) });
        const ult = novos[novos.length - 1];
        if (ult.donos.some((d) => C.ehSub(d))) ult.subParceiro = donoTxt.replace(/\(?\s*(SUBLOCAD[AO]S?|PARCEIR[AO]S?|TERCEIR[AO]S?)\s*\)?/gi, "").replace(/[()]/g, "").trim();
      }
      if (!novos.length) throw new Error("Nenhum equipamento encontrado no arquivo.");
      const existe = new Map((S.equip || []).map((e) => [e.tag.toUpperCase(), e]));
      const corpo = el(`<div style="display:flex;flex-direction:column;gap:10px">
        <div class="aviso-linha">${novos.length} equipamento(s) no arquivo · ${novos.filter((x) => existe.has(x.tag)).length} já cadastrado(s) (serão atualizados) · colunas lidas: ${Object.keys(col).join(", ")}</div>
        ${novos.some((x) => x.donoTxt && !x.donos.length) ? `<div class="aviso-linha lar">Alguns proprietários não foram reconhecidos (em laranja). Depois de importar, ajuste os donos no cadastro.</div>` : ""}
        <div class="tabela-wrap" style="max-height:52vh"><table class="tab"><thead><tr><th>Tag</th><th>Tipo</th><th>Marca / modelo</th><th class="direita">Altura</th><th>Proprietário na planilha</th><th>Donos no sistema</th></tr></thead><tbody>
        ${novos.map((x) => `<tr><td><span class="tag-eq">${esc(x.tag)}</span>${existe.has(x.tag) ? ' <small class="muted">atualiza</small>' : ""}</td>
          <td>${esc(x.tipo || "—")}${x.apelido ? `<small class="muted">${esc(x.apelido)}</small>` : ""}</td><td>${esc([x.marca, x.modelo].filter(Boolean).join(" "))}</td>
          <td class="direita">${x.altura ? C.qtdBR(x.altura) + " m" : ""}</td><td>${esc(x.donoTxt)}</td>
          <td>${x.donos.length ? esc(x.donos.map((d) => d.nome + (x.donos.length > 1 ? " " + C.pctBR(d.pct) + "%" : "")).join(" · ")) : x.donoTxt ? '<span class="etq lar">não reconhecido</span>' : ""}</td></tr>`).join("")}
        </tbody></table></div></div>`);
      ML.modal({ titulo: "Importar planilha de equipamentos", corpo, classe: "grande", botoes: [{ texto: "Cancelar" }, { texto: `Importar ${novos.length}`, classe: "primario", acao: async () => {
        const reg = novos.map((x, i) => {
          const ant = existe.get(x.tag);
          const dados = Object.assign({}, ant || { situacao: "ativo", obs: "" });
          delete dados.id; delete dados.tag;
          for (const k of ["apelido", "tipo", "marca", "modelo", "altura", "alimentacao", "serie", "ano"]) if (x[k] !== "" && x[k] != null) dados[k] = x[k];
          if (x.donos.length) dados.donos = x.donos; else if (!dados.donos) dados.donos = [];
          if (x.subParceiro) dados.subParceiro = x.subParceiro;
          return { id: ant ? ant.id : "e" + Date.now() + "_" + i, tag: x.tag, dados, atualizado_em: new Date().toISOString() };
        });
        const r = await ML.sb.from("fat_equipamentos").upsert(reg);
        if (r.error) throw r.error;
        ML.aviso(`${reg.length} equipamento(s) importado(s).`, "ok");
        await ML.recarregarERender();
      } }] });
    } catch (er) { ML.aviso(ML.msgErro(er), "erro"); }
  }

  async function exportar(lista) {
    if (!lista.length) return ML.aviso("Nenhum equipamento para exportar.");
    try {
      ML.aviso("Gerando planilha…");
      await ML.carregarScript("vendor/exceljs.min.js");
      const linhas = lista.map((e) => {
        const sit = ML.situacaoEquip(e), uso = S.emUso.get(e.id);
        return { e, sit, nomeSit: ML.NOME_SIT_EQ[sit], donos: textoDonosEq(e), cliente: uso ? ML.nomeCliente(uso.l.clienteId) : "", fatura: uso ? uso.u.id : "",
          ate: uso ? uso.u.periodoFim : "", local: uso && uso.l.local ? [uso.l.local.nome, uso.l.local.endereco].filter(Boolean).join(" — ") : "" };
      });
      await window.MLRel.inventario(linhas, { arquivo: `Equipamentos ${ML.hoje()}.xlsx`, sub: `Gerado em ${C.dataBR(ML.hoje())} · ${lista.length} equipamentos` });
    } catch (er) { ML.aviso(ML.msgErro(er), "erro"); }
  }
})();
