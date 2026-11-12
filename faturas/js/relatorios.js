// Planilhas Excel (ExcelJS) com as cores da situação: azul em aberto, vermelho vencida, verde paga.
(function (raiz) {
  "use strict";
  const C = raiz.MLCalc || (typeof require !== "undefined" ? require("./calc.js") : null);

  const COR = {
    aberta: { fundo: "FFDCE9F8", texto: "FF1F4E8C" },
    vencida: { fundo: "FFFADBD8", texto: "FFA61B1B" },
    paga: { fundo: "FFDDF1E0", texto: "FF1E6B35" },
    cancelada: { fundo: "FFEDEDED", texto: "FF7F7F7F" },
  };
  const LARANJA = "FFC2410C", ESCURO = "FF1F2937", BORDA = { style: "thin", color: { argb: "FFD9D9D9" } };
  const FMT_R = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  const FMT_D = "dd/mm/yyyy";

  const dataXL = (s) => { const d = C.parseISO(s); return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null; };

  function titulo(ws, texto, sub, ncol) {
    ws.mergeCells(1, 1, 1, ncol);
    const t = ws.getCell(1, 1);
    t.value = texto; t.font = { bold: true, size: 15, color: { argb: ESCURO } };
    ws.getRow(1).height = 24;
    ws.mergeCells(2, 1, 2, ncol);
    const s = ws.getCell(2, 1);
    s.value = sub; s.font = { size: 10, color: { argb: "FF6B7280" } };
    ws.addRow([]);
  }

  function cabecalho(ws, cols) {
    const r = ws.addRow(cols.map((c) => c.t));
    r.height = 20;
    r.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LARANJA } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
    });
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });
    return r.number;
  }

  function linhaDados(ws, valores, cols, sit) {
    const r = ws.addRow(valores);
    r.eachCell({ includeEmpty: true }, (c, i) => {
      const col = cols[i - 1] || {};
      if (col.f === "R") c.numFmt = FMT_R;
      if (col.f === "D") c.numFmt = FMT_D;
      if (col.f === "P") c.numFmt = "0.00\"%\"";
      c.border = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
      c.alignment = { vertical: "middle", horizontal: col.a || (col.f === "R" ? "right" : col.f === "D" ? "center" : "left"), wrapText: !!col.q };
      if (sit && COR[sit]) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR[sit].fundo } };
        c.font = { color: { argb: COR[sit].texto }, bold: i === 1 };
      }
    });
    return r;
  }

  function linhaTotal(ws, rotulo, cols, primeira, ultima, somar) {
    const vals = cols.map((c, i) => (i === 0 ? rotulo : null));
    const r = ws.addRow(vals);
    cols.forEach((c, i) => {
      const cel = r.getCell(i + 1);
      if (somar.includes(i)) {
        const L = ws.getColumn(i + 1).letter;
        cel.value = { formula: `SUM(${L}${primeira}:${L}${ultima})`, result: somar.resultados ? somar.resultados[i] : undefined };
        cel.numFmt = FMT_R;
      }
      cel.font = { bold: true };
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      cel.border = { top: { style: "medium", color: { argb: ESCURO } }, bottom: BORDA, left: BORDA, right: BORDA };
    });
    return r;
  }

  function legenda(ws, col) {
    const r0 = 4;
    [["aberta", "Em aberto"], ["vencida", "Vencida"], ["paga", "Paga"], ["cancelada", "Cancelada"]].forEach(([k, t], i) => {
      const c = ws.getCell(r0 + i, col);
      c.value = t;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR[k].fundo } };
      c.font = { color: { argb: COR[k].texto }, bold: true };
      c.border = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
    });
  }

  async function baixar(wb, nome) {
    const buf = await wb.xlsx.writeBuffer();
    if (typeof window === "undefined") return buf;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return buf;
  }

  function novoLivro(ExcelJS) {
    const wb = new (ExcelJS || raiz.ExcelJS).Workbook();
    wb.creator = "Metal Loc Faturas"; wb.created = new Date();
    return wb;
  }

  // ---------------------------------------------------------------- relatório de faturas
  // faturas: lista já filtrada; ctx: { nomes, titulo, sub, hoje, ExcelJS }
  async function faturas(lista, ctx) {
    const wb = novoLivro(ctx.ExcelJS);
    const ws = wb.addWorksheet("Faturas", { views: [{ state: "frozen", ySplit: 4, showGridLines: false }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    const cols = [
      { t: "Nº da fatura", w: 15, a: "center" }, { t: "Cliente", w: 40, q: 1 }, { t: "Equipamento", w: 26, q: 1 },
      { t: "Emissão", w: 12, f: "D" }, { t: "Período início", w: 13, f: "D" }, { t: "Período fim", w: 13, f: "D" },
      { t: "Vencimento", w: 13, f: "D" }, { t: "Situação", w: 12, a: "center" }, { t: "Pago em", w: 12, f: "D" },
      { t: "Locação", w: 15, f: "R" }, { t: "Frete", w: 13, f: "R" }, { t: "Total", w: 15, f: "R" },
      { t: "Donos", w: 34, q: 1 }, { t: "Emitida por", w: 16 },
    ];
    titulo(ws, ctx.titulo || "Faturas de locação", ctx.sub || "", cols.length);
    const h = cabecalho(ws, cols);
    const tot = { aberta: 0, vencida: 0, paga: 0, cancelada: 0 }, qtd = { aberta: 0, vencida: 0, paga: 0, cancelada: 0 };
    let somaLoc = 0, somaFre = 0, somaTot = 0;
    for (const f of lista) {
      const sit = C.situacao(f, ctx.hoje);
      const r = C.rateio(f, ctx.nomes);
      const equip = [...new Set((f.itens || []).filter((i) => !i.frete).map((i) => i.equip).filter(Boolean))].join(" + ");
      linhaDados(ws, [f.id, (f.tomador || {}).razaoSocial || "", equip, dataXL(f.dataEmissao), dataXL(f.periodoIni), dataXL(f.periodoFim),
        dataXL(f.vencimento), C.NOME_SITUACAO[sit], dataXL(f.pagoEm), r.locacao, r.frete, +f.total || 0,
        C.textoDonos(f, ctx.nomes), f.emitidoPor || ""], cols, sit);
      tot[sit] += +f.total || 0; qtd[sit]++;
      if (sit !== "cancelada") { somaLoc += r.locacao; somaFre += r.frete; somaTot += +f.total || 0; }
    }
    const ult = ws.lastRow.number;
    if (lista.length) {
      const somar = [9, 10, 11]; somar.resultados = { 9: somaLoc, 10: somaFre, 11: somaTot };
      const rt = linhaTotal(ws, "Total (sem canceladas)", cols, h + 1, ult, []);
      [[9, somaLoc], [10, somaFre], [11, somaTot]].forEach(([i, v]) => {
        const L = ws.getColumn(i + 1).letter, cel = rt.getCell(i + 1);
        cel.value = { formula: `SUMIFS(${L}${h + 1}:${L}${ult},H${h + 1}:H${ult},"<>Cancelada")`, result: v };
        cel.numFmt = FMT_R;
      });
    }
    ws.autoFilter = { from: { row: h, column: 1 }, to: { row: h, column: cols.length } };

    // resumo por situação
    const rs = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
    titulo(rs, "Resumo por situação", ctx.sub || "", 3);
    const cr = [{ t: "Situação", w: 18 }, { t: "Faturas", w: 10, a: "center" }, { t: "Valor", w: 18, f: "R" }];
    cabecalho(rs, cr);
    for (const k of ["aberta", "vencida", "paga", "cancelada"]) linhaDados(rs, [C.NOME_SITUACAO[k], qtd[k], tot[k]], cr, k);
    linhaDados(rs, ["A receber (em aberto + vencidas)", qtd.aberta + qtd.vencida, tot.aberta + tot.vencida], cr).eachCell((c) => { c.font = { bold: true }; });
    rs.getColumn(1).width = 34;
    wb.views = [{ activeTab: 0 }];
    return baixar(wb, ctx.arquivo || "Faturas.xlsx");
  }

  // ---------------------------------------------------------------- rateio entre donos
  // rel: resultado de montarRateio (app.js)
  async function rateio(rel, ctx) {
    const wb = novoLivro(ctx.ExcelJS);
    const sub = `${rel.base === "recebido" ? "Recebido (pela data do pagamento)" : "Faturado (pela data de emissão, sem canceladas)"} · ${rel.periodoTexto}`;
    // Resumo por dono
    const ws = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
    const cols = [{ t: "Dono", w: 30 }, { t: "Faturas", w: 9, a: "center" }, { t: "Locação (bruto)", w: 17, f: "R" },
      { t: "Custo sublocação", w: 17, f: "R" }, { t: `Comissão ${rel.comissaoNome} (${C.pctBR(rel.comPct)}%)`, w: 20, f: "R" },
      { t: "Líquido locação", w: 17, f: "R" }, { t: "Frete", w: 14, f: "R" }];
    titulo(ws, "Rateio entre donos e comissão", sub, cols.length);
    const h = cabecalho(ws, cols);
    for (const d of rel.donos) {
      const r = linhaDados(ws, [d.nome + (d.sublocado ? " (sublocação)" : ""), d.faturas, d.bruto, d.custo, d.comissao, d.liquido, d.frete], cols);
      if (!d.donoId) r.eachCell((c) => { c.font = { italic: true, color: { argb: "FFA61B1B" } }; });
    }
    if (rel.donos.length) {
      const ult = ws.lastRow.number;
      const rt = linhaTotal(ws, "Total", cols, h + 1, ult, []);
      [[2, rel.locacao], [3, rel.custo], [4, rel.comissao], [5, rel.liquido], [6, rel.frete]].forEach(([i, v]) => {
        const L = ws.getColumn(i + 1).letter, cel = rt.getCell(i + 1);
        cel.value = { formula: `SUM(${L}${h + 1}:${L}${ult})`, result: v }; cel.numFmt = FMT_R;
      });
      rt.getCell(2).value = rel.faturas; rt.getCell(2).alignment = { horizontal: "center" };
    }
    ws.addRow([]);
    const nota = ws.addRow([`Comissão de ${rel.comissaoNome}: ${C.pctBR(rel.comPct)}% sobre a locação de cada dono (frete fora). Na sublocação, sobre a locação menos o custo pago ao parceiro. O frete é dividido em partes iguais entre os donos da fatura.`]);
    ws.mergeCells(nota.number, 1, nota.number, cols.length);
    nota.getCell(1).alignment = { wrapText: true, vertical: "top" }; nota.height = 32;
    nota.getCell(1).font = { size: 9, color: { argb: "FF6B7280" } };
    if (rel.semDono) {
      const av = ws.addRow([`Atenção: ${rel.semDono} fatura(s) com item sem dono definido.`]);
      av.getCell(1).font = { bold: true, color: { argb: "FFA61B1B" } };
    }

    // Faturas
    const wf = wb.addWorksheet("Faturas", { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
    const cf = [{ t: "Nº da fatura", w: 15, a: "center" }, { t: "Cliente", w: 38, q: 1 }, { t: rel.base === "recebido" ? "Pago em" : "Emissão", w: 12, f: "D" },
      { t: "Situação", w: 12, a: "center" }, { t: "Total", w: 15, f: "R" }, { t: "Locação", w: 15, f: "R" }, { t: "Frete", w: 13, f: "R" },
      { t: "Custo sublocação", w: 15, f: "R" }, { t: "Comissão", w: 13, f: "R" }, { t: "Líquido locação", w: 15, f: "R" }, { t: "Donos", w: 40, q: 1 }];
    titulo(wf, "Faturas do período", sub, cf.length);
    const hf = cabecalho(wf, cf);
    for (const l of rel.linhas) {
      linhaDados(wf, [l.id, l.cliente, dataXL(l.data), C.NOME_SITUACAO[l.situacao], l.total, l.r.locacao, l.r.frete, l.r.custo, l.r.comissao, l.r.liquido, l.donos], cf, l.situacao);
    }
    if (rel.linhas.length) {
      const ult = wf.lastRow.number, rt = linhaTotal(wf, "Total", cf, hf + 1, ult, []);
      [[4, rel.linhas.reduce((s, l) => s + l.total, 0)], [5, rel.locacao], [6, rel.frete], [7, rel.custo], [8, rel.comissao], [9, rel.liquido]].forEach(([i, v]) => {
        const L = wf.getColumn(i + 1).letter, cel = rt.getCell(i + 1);
        cel.value = { formula: `SUM(${L}${hf + 1}:${L}${ult})`, result: v }; cel.numFmt = FMT_R;
      });
    }
    wf.autoFilter = { from: { row: hf, column: 1 }, to: { row: hf, column: cf.length } };
    legenda(wf, cf.length + 2);
    wf.getColumn(cf.length + 2).width = 13;

    // Lançamentos por dono
    const wl = wb.addWorksheet("Lançamentos", { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
    const cl = [{ t: "Dono", w: 26 }, { t: "Nº da fatura", w: 15, a: "center" }, { t: "Cliente", w: 36, q: 1 }, { t: "Data", w: 12, f: "D" },
      { t: "Situação", w: 12, a: "center" }, { t: "Locação (bruto)", w: 15, f: "R" }, { t: "Custo sublocação", w: 15, f: "R" },
      { t: "Comissão", w: 13, f: "R" }, { t: "Líquido locação", w: 15, f: "R" }, { t: "Frete", w: 13, f: "R" }, { t: "Parceiro (sublocação)", w: 24 }];
    titulo(wl, "Lançamentos por dono", sub, cl.length);
    const hl = cabecalho(wl, cl);
    const ordem = new Map(rel.donos.map((d, i) => [d.donoId, i]));
    const lanc = [];
    for (const l of rel.linhas) for (const p of l.r.partes) lanc.push({ l, p });
    lanc.sort((a, b) => (ordem.get(a.p.donoId) ?? 999) - (ordem.get(b.p.donoId) ?? 999) || (a.l.data < b.l.data ? -1 : a.l.data > b.l.data ? 1 : 0));
    for (const { l, p } of lanc) {
      linhaDados(wl, [p.nome, l.id, l.cliente, dataXL(l.data), C.NOME_SITUACAO[l.situacao], p.bruto, p.custo, p.comissao, p.liquido, p.frete, (p.parceiros || []).join(", ")], cl, l.situacao);
    }
    if (lanc.length) {
      const ult = wl.lastRow.number, rt = linhaTotal(wl, "Total", cl, hl + 1, ult, []);
      [[5, rel.locacao], [6, rel.custo], [7, rel.comissao], [8, rel.liquido], [9, rel.frete]].forEach(([i, v]) => {
        const L = wl.getColumn(i + 1).letter, cel = rt.getCell(i + 1);
        cel.value = { formula: `SUM(${L}${hl + 1}:${L}${ult})`, result: v }; cel.numFmt = FMT_R;
      });
    }
    wl.autoFilter = { from: { row: hl, column: 1 }, to: { row: hl, column: cl.length } };
    return baixar(wb, ctx.arquivo || "Rateio.xlsx");
  }

  const API = { faturas, rateio, COR };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  raiz.MLRel = API;
})(typeof window !== "undefined" ? window : globalThis);
