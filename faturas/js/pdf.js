// PDF da fatura (A4) — mesmo desenho do app do Windows (pdf.go), feito com jsPDF no navegador.
(function (raiz) {
  "use strict";
  const C = raiz.MLCalc || (typeof require !== "undefined" ? require("./calc.js") : null);

  const ARQ_FONTES = [
    ["Carlito-Regular.ttf", "Carlito", "normal"], ["Carlito-Bold.ttf", "Carlito", "bold"],
    ["LiberationSans-Regular.ttf", "Arimo", "normal"], ["LiberationSans-Bold.ttf", "Arimo", "bold"],
    ["LiberationSerif-Regular.ttf", "Tinos", "normal"],
  ];
  let cache = null; // { fontes: [[arquivo, base64]...], logo: {dataUrl, w, h} }

  function b64(buf) {
    if (typeof Buffer !== "undefined" && !(typeof window !== "undefined")) return Buffer.from(buf).toString("base64");
    const u = new Uint8Array(buf); let s = ""; const passo = 0x8000;
    for (let i = 0; i < u.length; i += passo) s += String.fromCharCode.apply(null, u.subarray(i, i + passo));
    return btoa(s);
  }

  // ler(caminho) → Promise<ArrayBuffer>; no navegador usa fetch
  async function preparar(ler, base) {
    if (cache) return cache;
    base = base || "";
    ler = ler || ((p) => fetch(p).then((r) => { if (!r.ok) throw new Error("Não consegui carregar " + p); return r.arrayBuffer(); }));
    const fontes = await Promise.all(ARQ_FONTES.map(async ([arq]) => [arq, b64(await ler(base + "fontes/" + arq))]));
    const png = await ler(base + "img/logo.png");
    const dv = new DataView(png); // largura/altura do PNG (IHDR)
    const logo = { dataUrl: "data:image/png;base64," + b64(png), w: dv.getUint32(16), h: dv.getUint32(20) };
    cache = { fontes, logo };
    return cache;
  }

  const preto = [0, 0, 0], navy = [31, 56, 100], azul = [31, 95, 168];
  const xE = 9.0, xD = 192.0;

  function desenhar(doc, f) {
    const cal = ["Carlito", "normal"], calB = ["Carlito", "bold"], ari = ["Arimo", "normal"], ariB = ["Arimo", "bold"], tim = ["Tinos", "normal"];
    const larg = (fnt, tam, s) => { doc.setFont(fnt[0], fnt[1]); doc.setFontSize(tam); return doc.getTextWidth(String(s || "")); };
    const txt = (fnt, tam, x, y, s, cor) => {
      if (s === "" || s == null) return;
      doc.setFont(fnt[0], fnt[1]); doc.setFontSize(tam); doc.setTextColor(...(cor || preto));
      doc.text(String(s), x, y, { baseline: "alphabetic" });
    };
    const txtDir = (fnt, tam, xd, y, s, cor) => txt(fnt, tam, xd - larg(fnt, tam, s), y, s, cor);
    const txtCentro = (fnt, tam, xc, y, s, cor) => txt(fnt, tam, xc - larg(fnt, tam, s) / 2, y, s, cor);
    const txtAjustado = (fnt, tam, x, y, maxW, s) => { while (tam > 6.5 && larg(fnt, tam, s) > maxW) tam -= 0.25; txt(fnt, tam, x, y, s); };
    const linha = (x1, y1, x2, y2, esp, cor) => { doc.setDrawColor(...cor); doc.setLineWidth(esp); doc.line(x1, y1, x2, y2); };
    const ret = (x, y, w, h, esp, cor) => { doc.setDrawColor(...cor); doc.setLineWidth(esp); doc.rect(x, y, w, h, "S"); };
    const quebrar = (fnt, tam, maxW, s) => {
      const out = [];
      for (const par of String(s || "").replace(/\r/g, "").split("\n")) {
        const pal = par.split(/\s+/).filter(Boolean);
        if (!pal.length) { out.push(""); continue; }
        let atual = pal[0];
        for (const p of pal.slice(1)) {
          if (larg(fnt, tam, atual + " " + p) <= maxW) atual += " " + p; else { out.push(atual); atual = p; }
        }
        out.push(atual);
      }
      return out;
    };
    const p = f.prestador || {}, c = f.tomador || {};

    // ---- cabeçalho
    const yTop = 9.2, yCab = 34.2;
    if (cache && cache.logo) {
      let lw = 67.5, lh = lw * cache.logo.h / cache.logo.w;
      if (lh > 25) { lh = 25; lw = lh * cache.logo.w / cache.logo.h; }
      doc.addImage(cache.logo.dataUrl, "PNG", xE + 0.3, yTop, lw, lh, "logo", "FAST");
    }
    txt(ariB, 15, 77.8, 19.3, "FATURA DE LOCAÇÃO");
    txtDir(ari, 10.5, 187.4, 13.6, "Nº da fatura:");
    txtDir(ariB, 15, 187.4, 19.4, f.id);
    txtDir(ari, 10.5, 187.4, 23.2, "Data:");
    txtDir(ari, 12, 190.4, 27.6, C.dataBR(f.dataEmissao));
    linha(xE, yTop, xD, yTop, 0.25, preto);
    linha(xE, yTop, xE, yCab, 0.25, preto);
    linha(xD, yTop, xD, yCab, 0.25, preto);

    const rot = (y, rotulo, valor, fntV, x0) => {
      txt(cal, 11, x0, y, rotulo);
      const x = x0 + larg(cal, 11, rotulo) + 1.3;
      txtAjustado(fntV, 11, x, y, xD - 1.5 - x, valor || "");
    };

    // ---- prestador
    const yP2 = 67.9;
    linha(xE, yCab, xD, yCab, 0.25, preto);
    txtCentro(cal, 11, (xE + xD) / 2, 39.3, "PRESTADOR DE SERVIÇOS");
    let end = p.endereco || "";
    if (p.cep) end += " - CEP: " + p.cep;
    [["Razão Social:", p.razaoSocial], ["CNPJ:", p.cnpj], ["Endereço:", end], ["Cidade:", p.cidade]]
      .forEach((l, i) => rot(45.3 + i * 6.2, l[0], l[1], cal, 10.2));
    linha(xE, yCab, xE, yP2, 0.25, preto);
    linha(xD, yCab, xD, yP2, 0.25, preto);

    // ---- tomador
    const yT2 = 105.8, up = (s) => String(s || "").toUpperCase();
    linha(xE, yP2, xD, yP2, 0.25, preto);
    txtCentro(cal, 11, (xE + xD) / 2, 71.9, "TOMADOR DE SERVIÇOS");
    const yb = 78.4;
    rot(yb, "Nome/Razão Social:", up(c.razaoSocial), calB, 10.5);
    let docm = c.documento || "";
    if (c.ie) docm += "   IE: " + c.ie;
    rot(yb + 6.4, (c.tipoDoc || "CNPJ") + ":", docm, calB, 10.2);
    {
      const y = yb + 12.8;
      txt(cal, 11, 10.5, y, "Endereço:");
      let x = 10.5 + larg(cal, 11, "Endereço:") + 1.3;
      const endT = up(c.endereco), cepT = c.cep || "";
      let tam = 11;
      const total = (tm) => larg(calB, tm, endT) + (cepT ? larg(cal, tm, " CEP: ") + larg(calB, tm, cepT) : 0);
      while (tam > 6.5 && total(tam) > xD - 1.5 - x) tam -= 0.25;
      txt(calB, tam, x, y, endT); x += larg(calB, tam, endT);
      if (cepT) { txt(cal, tam, x, y, " CEP: "); x += larg(cal, tam, " CEP: "); txt(calB, tam, x, y, cepT); }
    }
    let cid = c.cidade || "";
    if (c.uf) cid = (cid ? cid + " - " : "") + c.uf;
    rot(yb + 19.2, "Cidade:", up(cid), calB, 10.5);
    rot(yb + 25.6, "E-mail:", c.email, cal, 10.5);
    linha(xE, yP2, xE, yT2, 0.25, preto);
    linha(xD, yP2, xD, yT2, 0.25, preto);

    // ---- discriminação
    ret(xE, yT2, xD - xE, 5.0, 0.25, preto);
    txtCentro(cal, 11, (xE + xD) / 2, 109.2, "DISCRIMINAÇÃO DOS SERVIÇOS");
    const yD = yT2 + 5.0;
    const lin = quebrar(cal, 11, xD - xE - 1.5, f.discriminacao);
    const hD = Math.max(18.0, lin.length * 4.7 + 2.5);
    lin.forEach((l, i) => txt(cal, 11, xE + 0.6, yD + 3.8 + i * 4.7, l));
    linha(xE, yD, xE, yD + hD, 0.25, preto);
    linha(xD, yD, xD, yD + hD, 0.25, preto);
    linha(xE, yD + hD, xD, yD + hD, 0.25, preto);

    // ---- itens
    const cq = 136.2, cu = 146.2, ct = 169.3, yI = yD + hD + 0.5, hL = 5.54;
    const grade = (y, h) => { linha(xE, y + h, xD, y + h, 0.25, navy); for (const x of [xE, cq, cu, ct, xD]) linha(x, y, x, y + h, 0.25, navy); };
    linha(xE, yI, xD, yI, 0.25, navy);
    grade(yI, hL);
    const bl = (y, h) => y + h / 2 + 1.35;
    txt(cal, 11, xE + 0.4, bl(yI, hL), "Descrição", azul);
    txtDir(cal, 11, cu - 0.4, bl(yI, hL), "Qtde", azul);
    txtDir(cal, 11, ct - 0.4, bl(yI, hL), "Unitário", azul);
    txtDir(cal, 11, xD - 0.4, bl(yI, hL), "Total", azul);
    let y = yI + hL;
    for (const it of f.itens || []) {
      const ls = quebrar(cal, 11, cq - xE - 1, it.descricao);
      const h = hL + (ls.length - 1) * 4.7;
      grade(y, h);
      ls.forEach((l, i) => txt(cal, 11, xE + 0.4, y + hL / 2 + 1.35 + i * 4.7, l));
      const b = bl(y, hL);
      txtCentro(cal, 11, (cq + cu) / 2, b, C.qtdBR(it.qtd));
      txtDir(cal, 11, ct - 0.4, b, C.moeda(it.unitario));
      txtDir(cal, 11, xD - 0.4, b, C.moeda(Math.round((+it.qtd || 0) * (+it.unitario || 0) * 100) / 100));
      y += h;
    }
    // ---- total
    let ref = "Ref.: ";
    if (f.periodoIni && f.periodoFim) ref += C.dataBRc(f.periodoIni) + " a " + C.dataBRc(f.periodoFim);
    const hT = 5.3;
    linha(xE, y, xE, y + hT, 0.25, preto);
    linha(58.5, y, 58.5, y + hT, 0.25, preto);
    linha(xE, y + hT, 58.5, y + hT, 0.25, preto);
    txt(cal, 11, 14.8, bl(y, hT), ref);
    txtDir(cal, 11, ct - 1.5, bl(y, hT), "TOTAL DA FATURA:", azul);
    linha(ct, y, ct, y + hT, 0.25, navy);
    linha(xD, y, xD, y + hT, 0.25, navy);
    linha(ct, y + hT, xD, y + hT, 0.25, navy);
    txtDir(cal, 11, xD - 0.4, bl(y, hT), C.moeda(f.total));
    y += hT;

    // ---- vencimento
    const yV = y + 14.5, xv1 = 11.5, xv2 = 34.9, xv3 = 73.9, h1 = 5.5, h2 = 5.6, h3 = 6.0, fino = 0.25, grosso = 0.5;
    ret(xv1, yV, 36.5 - xv1, h1, fino, navy);
    linha(xv1 + 0.12, yV, xv1 + 0.12, yV + h1, grosso, navy);
    txt(cal, 11, xv1 + 0.8, bl(yV, h1), "VENCIMENTO:");
    const yr = yV + h1;
    linha(xv1, yr, xv3, yr, fino, navy);
    linha(xv1, yr + h2, xv3, yr + h2, fino, navy);
    linha(xv1, yr + h2 + h3, xv3, yr + h2 + h3, grosso, navy);
    linha(xv1, yr, xv1, yr + h2 + h3, grosso, navy);
    linha(xv2, yr, xv2, yr + h2 + h3, fino, navy);
    linha(xv3, yr, xv3, yr + h2 + h3, grosso, navy);
    txt(cal, 11, xv1 + 0.8, bl(yr, h2), "Data");
    txtCentro(cal, 11, (xv2 + xv3) / 2, bl(yr, h2), "Valor");
    txtCentro(cal, 11, (xv1 + xv2) / 2, bl(yr + h2, h3), C.dataBR(f.vencimento));
    txtCentro(cal, 11, (xv2 + xv3) / 2, bl(yr + h2, h3), C.moeda(f.total));
    y = yr + h2 + h3;

    // ---- dados da conta e outras informações
    const contas = [["Banco", p.banco], ["Agência", p.agencia], ["Conta", p.conta], ["Razão Social", p.titularConta], ["Pix", p.pix]];
    const linhasConta = ["Dados da conta:"].concat(contas.filter((cc) => String(cc[1] || "").trim()).map((cc) => cc[0] + ": " + cc[1]));
    const outras = quebrar(cal, 11, xD - 10.4 - 1.5, f.outrasInfo);
    let passo = 8.2;
    const necess = 11.8 + (linhasConta.length - 1) * passo + 5.6 + 5.9 + outras.length * 4.7;
    if (y + necess > 270) passo = Math.max(4.6, passo - (y + necess - 270) / linhasConta.length);
    const yc = y + 11.6;
    linhasConta.forEach((l, i) => txt(tim, 10.5, xE, yc + i * passo, l));
    const yo = yc + (linhasConta.length - 1) * passo + 5.6;
    txtCentro(cal, 11, (xE + xD) / 2, yo, "OUTRAS INFORMAÇÕES");
    outras.forEach((l, i) => txt(cal, 11, 10.4, yo + 5.9 + i * 4.7, l));

    // ---- rodapé
    linha(xE, 273.9, xD, 273.9, 0.3, preto);
    txt(ariB, 8.5, 11.1, 277.9, C.carimbo(f.atualizadoEm || f.criadoEm));
    txtDir(ari, 8.5, xD, 277.9, "Página 1 de 1");

    // ---- selo de cancelamento
    if (f.status === "cancelada") {
      const s = "CANCELADA", tam = 34, w = larg(ariB, tam, s), cx = 100, cy = 140, a = 24 * Math.PI / 180;
      const cos = Math.cos(a), sin = Math.sin(a);
      // rotação no sentido anti-horário (como no PDF original): y da página cresce para baixo
      const pt = (dx, dy) => [cx + dx * cos + dy * sin, cy - dx * sin + dy * cos];
      const vermelho = [199, 31, 31];
      if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.75, "stroke-opacity": 0.75 }));
      const x0 = -w / 2 - 8, x1 = w / 2 + 8, y0 = -13, y1 = 9;
      const cantos = [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
      doc.setDrawColor(...vermelho); doc.setLineWidth(3);
      for (let i = 0; i < 4; i++) { const [ax, ay] = cantos[i], [bx, by] = cantos[(i + 1) % 4]; doc.line(ax, ay, bx, by); }
      const [tx, ty] = pt(-w / 2, 4.2);
      doc.setFont("Arimo", "bold"); doc.setFontSize(tam); doc.setTextColor(...vermelho);
      doc.text(s, tx, ty, { angle: 24, baseline: "alphabetic" });
      if (doc.GState) doc.setGState(new doc.GState({ opacity: 1, "stroke-opacity": 1 }));
    }
  }

  function novoDoc(jsPDF) {
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    for (const [arq, dados] of cache.fontes) {
      const def = ARQ_FONTES.find((x) => x[0] === arq);
      doc.addFileToVFS(arq, dados);
      doc.addFont(arq, def[1], def[2]);
    }
    return doc;
  }

  // gera o PDF de uma ou várias faturas (uma por página)
  async function gerar(faturas, opcoes) {
    opcoes = opcoes || {};
    await preparar(opcoes.ler, opcoes.base);
    const jsPDF = opcoes.jsPDF || (raiz.jspdf && raiz.jspdf.jsPDF);
    const doc = novoDoc(jsPDF);
    [].concat(faturas).forEach((f, i) => { if (i) doc.addPage(); desenhar(doc, f); });
    const lista = [].concat(faturas);
    doc.setProperties({ title: lista.length === 1 ? "Fatura " + lista[0].id : "Faturas", author: "Metal Loc", creator: "Metal Loc Faturas" });
    return doc;
  }

  function nomeArquivo(f) {
    const cli = String((f.tomador && f.tomador.razaoSocial) || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const d = C.dataBR(f.dataEmissao).replace(/\//g, "-");
    return `Fatura ${f.id} - ${cli} - ${d}.pdf`;
  }

  const API = { preparar, gerar, nomeArquivo };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  raiz.MLPdf = API;
})(typeof window !== "undefined" ? window : globalThis);
