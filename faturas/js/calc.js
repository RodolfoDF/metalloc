// Regras de negócio puras (sem tela): formatação, datas, sigla, situação e rateio entre donos.
(function (raiz) {
  "use strict";

  // ------------------------------------------------------------ formatação
  function moeda(v, semRS) {
    const neg = v < 0;
    const cent = Math.round(Math.abs(+v || 0) * 100);
    let int = String(Math.floor(cent / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const s = (semRS ? "" : "R$ ") + int + "," + String(cent % 100).padStart(2, "0");
    return neg ? "-" + s : s;
  }
  function qtdBR(v) { return String(+v || 0).replace(".", ","); }
  function numBR(v) { // "1.234,5" / "1234,56" / "1234.56" → número
    if (typeof v === "number") return v;
    let s = String(v || "").trim().replace(/[R$\s]/g, "");
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function pctBR(v) { return String(Math.round((+v || 0) * 100) / 100).replace(".", ","); }

  // ------------------------------------------------------------ datas (texto ISO "AAAA-MM-DD", sem fuso)
  const pad2 = (n) => String(n).padStart(2, "0");
  function hoje() { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseISO(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
  function iso(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function addDias(s, n) { const d = parseISO(s); if (!d) return ""; d.setDate(d.getDate() + n); return iso(d); }
  function addMeses(s, n) {
    const d = parseISO(s); if (!d) return "";
    const dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    const ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ult)); return iso(d);
  }
  function difDias(a, b) { const x = parseISO(a), y = parseISO(b); return x && y ? Math.round((y - x) / 864e5) : 0; }
  function dataBR(s) { const d = parseISO(s); return d ? pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() : (s || ""); }
  function dataBRc(s) { const d = parseISO(s); return d ? pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + String(d.getFullYear()).slice(2) : (s || ""); }
  function carimbo(s) { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/.exec(s || ""); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : (s || ""); }
  function agoraISO() { const d = new Date(); return iso(d) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()); }

  // próximo período de uma renovação: mensal se o anterior era mensal; senão a mesma quantidade de dias
  function proximoPeriodo(ini, fim) {
    if (!ini || !fim) return { ini: "", fim: "" };
    const nIni = addDias(fim, 1);
    const mensal = addDias(addMeses(ini, 1), -1) === fim;
    return { ini: nIni, fim: mensal ? addDias(addMeses(nIni, 1), -1) : addDias(nIni, difDias(ini, fim)) };
  }

  // ------------------------------------------------------------ sigla do cliente
  const GENERICAS = new Set(("LTDA ME EPP EIRELI SA S/A S.A CIA DE DA DO DAS DOS E & EM PARA CONSTRUTORA CONSTRUCOES CONSTRUCAO " +
    "ENGENHARIA EMPREENDIMENTOS IMOBILIARIOS IMOBILIARIA SERVICOS SERVICO COMERCIO COMERCIAL INDUSTRIA IND IMPORTACAO EXPORTACAO " +
    "LOCACOES LOCACAO EQUIPAMENTOS PRODUCOES PROJETOS MANUTENCAO LIMPEZA ALIMENTOS INVESTIMENTOS GRUPO OUTROS ASSOCIACAO PRIVATIVA CONDOMINIO").split(" "));
  function semAcento(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function sugerirSigla(nome) {
    const pal = semAcento(nome).toUpperCase().split(/[\s,.]+/).filter(Boolean);
    const sig = pal.filter((p) => !GENERICAS.has(p) && /^[A-Z]+$/.test(p));
    let s = sig.slice(0, 3).map((p) => p[0]).join("");
    if (s.length < 2) s = ((sig[0] || pal[0] || "CLI").replace(/[^A-Z]/g, "")).slice(0, 3);
    return s.slice(0, 4);
  }
  function limparSigla(s) { return semAcento(s).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5); }
  function padReg(reg, dig) { const s = String(reg); return s.length >= (dig || 4) ? s : s.padStart(dig || 4, "0"); }
  function numeroFatura(sigla, reg, seq, dig) { return (sigla || "") + padReg(reg, dig) + "-" + seq; }

  // ------------------------------------------------------------ situação da fatura
  // aberta (azul) · vencida (vermelho) · paga (verde) · cancelada (cinza)
  function situacao(f, dia) {
    if (f.status === "paga") return "paga";
    if (f.status === "cancelada") return "cancelada";
    if (f.vencimento && f.vencimento < (dia || hoje())) return "vencida";
    return "aberta";
  }
  const NOME_SITUACAO = { aberta: "Em aberto", vencida: "Vencida", paga: "Paga", cancelada: "Cancelada" };

  // ------------------------------------------------------------ rateio entre donos (em centavos)
  const cents = (v) => Math.round((+v || 0) * 100);
  const reais = (c) => c / 100;
  function arredInt(num, den) { return num < 0 ? -arredInt(-num, den) : Math.floor((num + Math.floor(den / 2)) / den); }
  // divide "total" pelos pesos (último fica com o resto, para fechar exato)
  function dividir(total, pesos) {
    const somaP = pesos.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return pesos.map((p, i) => {
      if (i === pesos.length - 1) return total - acc;
      const v = arredInt(total * Math.round(p * 1000), Math.round(somaP * 1000));
      acc += v; return v;
    });
  }
  const ehFrete = (it) => !!it.frete;
  const ehSub = (p) => p && (p.donoId === "sub" || p.tipo === "sublocado");

  // Regras:
  //  · cada item de locação é dividido entre os donos marcados (pelo %);
  //  · comissão (pct) sobre a locação de cada dono; no Sublocado, sobre (locação − custo da sublocação);
  //  · o frete não entra na comissão e é dividido em partes iguais entre os donos da fatura.
  function rateio(f, nomes) {
    const pct = f.comissaoPct != null ? +f.comissaoPct : 5;
    const partes = new Map();
    const parte = (id, nome, sub) => {
      const k = id || "";
      if (!partes.has(k)) partes.set(k, { donoId: k, nome: (nomes && nomes[k]) || nome || (k ? "(dono removido)" : "Sem dono definido"), sublocado: !!sub, bruto: 0, custo: 0, frete: 0, comissao: 0, parceiros: [] });
      return partes.get(k);
    };
    let locC = 0, freC = 0, semDono = false;
    for (const it of f.itens || []) {
      const c = cents((+it.qtd || 0) * (+it.unitario || 0));
      if (ehFrete(it)) { freC += c; continue; }
      locC += c;
      let ds = (it.donos && it.donos.length) ? it.donos : (f.donos && f.donos.length ? f.donos : null);
      if (!ds) { semDono = true; ds = [{ donoId: "", nome: "Sem dono definido", pct: 100 }]; }
      const vals = dividir(c, ds.map((d) => +d.pct || 0));
      ds.forEach((d, i) => {
        const p = parte(d.donoId, d.nome, ehSub(d));
        p.bruto += vals[i];
        if (ehSub(d)) {
          p.custo += cents(it.subCusto);
          if (it.subParceiro && !p.parceiros.includes(it.subParceiro)) p.parceiros.push(it.subParceiro);
        }
      });
    }
    const lista = [...partes.values()];
    if (!lista.length && freC) { semDono = true; lista.push(parte("", "Sem dono definido")); }
    // comissão de cada dono
    let comC = 0, custoC = 0;
    for (const p of lista) {
      p.comissao = Math.max(0, arredInt((p.bruto - p.custo) * Math.round(pct * 1000), 100000));
      comC += p.comissao; custoC += p.custo;
    }
    // frete: partes iguais
    if (lista.length) dividir(freC, lista.map(() => 1)).forEach((v, i) => { lista[i].frete = v; });
    return {
      locacao: reais(locC), frete: reais(freC), custo: reais(custoC), comPct: pct, comissao: reais(comC),
      liquido: reais(locC - custoC - comC), semDono,
      partes: lista.map((p) => ({ donoId: p.donoId, nome: p.nome, sublocado: p.sublocado, parceiros: p.parceiros,
        bruto: reais(p.bruto), custo: reais(p.custo), comissao: reais(p.comissao), frete: reais(p.frete),
        liquido: reais(p.bruto - p.custo - p.comissao) })),
    };
  }

  function textoDonosItem(it, nomes) {
    const ds = it.donos || [];
    if (!ds.length) return "";
    return ds.map((d) => {
      const n = (nomes && nomes[d.donoId]) || d.nome;
      let s = ds.length > 1 ? `${n} ${pctBR(d.pct)}%` : n;
      if (ehSub(d) && it.subParceiro) s += ` (${it.subParceiro})`;
      return s;
    }).join(" · ");
  }
  function textoDonos(f, nomes) {
    const vistos = [];
    for (const it of f.itens || []) if (!it.frete) {
      const t = textoDonosItem(it, nomes);
      if (t && !vistos.includes(t)) vistos.push(t);
    }
    return vistos.join(" + ");
  }

  // ------------------------------------------------------------ itens
  function totalItens(itens) { return reais((itens || []).reduce((s, it) => s + cents((+it.qtd || 0) * (+it.unitario || 0)), 0)); }
  function ordenarItens(itens) { return [...(itens || [])].filter((i) => !i.frete).concat((itens || []).filter((i) => i.frete)); }
  function descricaoPeriodo(equip, ini, fim) {
    return `LOCAÇÃO ${String(equip || "").toUpperCase()} PERÍODO ${dataBRc(ini)} a ${dataBRc(fim)}`;
  }
  // troca o período no texto de um item ("... PERÍODO dd/mm/aa a dd/mm/aa")
  function trocarPeriodoDescricao(desc, ini, fim) {
    const novo = `PERÍODO ${dataBRc(ini)} a ${dataBRc(fim)}`;
    const re = /PER[IÍ]ODO\s+\d{2}\/\d{2}\/\d{2,4}\s+(a|à|até)\s+\d{2}\/\d{2}\/\d{2,4}/i;
    return re.test(desc || "") ? desc.replace(re, novo) : desc;
  }

  // ------------------------------------------------------------ relatório de rateio por período
  // base "faturado": faturas não canceladas pela data de emissão; "recebido": pagas pela data do pagamento
  function montarRateio(faturas, o) {
    const base = o.base === "recebido" ? "recebido" : "faturado";
    const rel = { de: o.de || "", ate: o.ate || "", base, comissaoNome: o.comissaoNome || "Comissão", comPct: o.comPct != null ? o.comPct : 5,
      faturas: 0, locacao: 0, frete: 0, custo: 0, comissao: 0, liquido: 0, semDono: 0, donos: [], linhas: [] };
    rel.periodoTexto = rel.de && rel.ate ? `${dataBR(rel.de)} a ${dataBR(rel.ate)}` : rel.de ? `a partir de ${dataBR(rel.de)}` : rel.ate ? `até ${dataBR(rel.ate)}` : "todo o período";
    const acc = new Map(), soma = { loc: 0, fre: 0, cus: 0, com: 0 }, parc = new Map();
    const C2 = (t) => semAcento(t).toUpperCase().replace(/\s+/g, " ");
    for (const f of faturas) {
      let data = f.dataEmissao;
      if (base === "recebido") { if (f.status !== "paga") continue; data = f.pagoEm || ""; }
      else if (f.status === "cancelada") continue;
      if ((rel.de && data < rel.de) || (rel.ate && data > rel.ate)) continue;
      const r = rateio(f, o.nomes);
      rel.faturas++;
      soma.loc += cents(r.locacao); soma.fre += cents(r.frete); soma.cus += cents(r.custo); soma.com += cents(r.comissao);
      if (r.semDono) rel.semDono++;
      for (const p of r.partes) {
        if (!acc.has(p.donoId)) acc.set(p.donoId, { donoId: p.donoId, nome: p.nome, sublocado: p.sublocado, faturas: 0, b: 0, c: 0, m: 0, fr: 0 });
        const a = acc.get(p.donoId);
        a.faturas++; a.b += cents(p.bruto); a.c += cents(p.custo); a.m += cents(p.comissao); a.fr += cents(p.frete);
      }
      for (const it of f.itens || []) {
        if (it.frete || !it.subParceiro || !(it.donos || []).some(ehSub)) continue;
        const k = String(it.subParceiro).trim(), pk = C2(k);
        if (!parc.has(pk)) parc.set(pk, { parceiro: k, itens: 0, faturas: new Set(), b: 0, c: 0 });
        const a = parc.get(pk);
        a.itens++; a.faturas.add(f.id); a.b += cents((+it.qtd || 0) * (+it.unitario || 0)); a.c += cents(it.subCusto);
      }
      rel.linhas.push({ id: f.id, registro: f.registro, seq: f.seq, cliente: (f.tomador || {}).razaoSocial || "", data, emissao: f.dataEmissao,
        pagoEm: f.pagoEm || "", situacao: situacao(f, o.hoje), total: +f.total || 0, donos: textoDonos(f, o.nomes), r });
    }
    rel.locacao = reais(soma.loc); rel.frete = reais(soma.fre); rel.custo = reais(soma.cus); rel.comissao = reais(soma.com);
    rel.liquido = reais(soma.loc - soma.cus - soma.com);
    const ordem = new Map((o.ordemDonos || []).map((id, i) => [id, i]));
    rel.donos = [...acc.values()].map((a) => ({ donoId: a.donoId, nome: a.nome, sublocado: a.sublocado, faturas: a.faturas,
      bruto: reais(a.b), custo: reais(a.c), comissao: reais(a.m), liquido: reais(a.b - a.c - a.m), frete: reais(a.fr) }))
      .sort((x, y) => (x.donoId === "" ? 1e9 : ordem.has(x.donoId) ? ordem.get(x.donoId) : 1e8) - (y.donoId === "" ? 1e9 : ordem.has(y.donoId) ? ordem.get(y.donoId) : 1e8) || x.nome.localeCompare(y.nome));
    rel.parceiros = [...parc.values()].map((a) => ({ parceiro: a.parceiro, itens: a.itens, faturas: a.faturas.size, locacao: reais(a.b), custo: reais(a.c),
      margem: reais(a.b - a.c), comissao: reais(Math.max(0, arredInt((a.b - a.c) * Math.round(rel.comPct * 1000), 100000))) })).sort((x, y) => y.custo - x.custo);
    rel.linhas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.registro - b.registro || a.seq - b.seq));
    return rel;
  }

  // ------------------------------------------------------------ comissões do representante
  // Cada dono paga a comissão da sua parte. Lançamento = (fatura, dono).
  // base "paga": a comissão fica devida quando a fatura é paga (competência = data do pagamento);
  // base "emitida": devida na emissão (competência = data de emissão). Fatura cancelada não gera comissão.
  // Pagamentos já feitos e que deixaram de ser devidos (fatura cancelada/reaberta) viram crédito (saldo negativo).
  function comissoes(faturas, pagamentos, o) {
    o = o || {};
    const base = o.base === "emitida" ? "emitida" : "paga", inicio = o.inicio || "";
    const pagoPor = new Map(); // uid|dono -> {valor, ultimo}
    for (const p of pagamentos || []) for (const it of p.itens || []) {
      const k = it.uid + "|" + p.dono_id;
      const a = pagoPor.get(k) || { c: 0, datas: [] };
      a.c += cents(it.valor); a.datas.push(p.data); pagoPor.set(k, a);
    }
    const out = [], vistos = new Set();
    for (const f of faturas) {
      if (!f.uid) continue;
      const devidaAgora = f.status !== "cancelada" && (base === "emitida" || f.status === "paga");
      const comp = base === "emitida" ? f.dataEmissao : (f.pagoEm || "");
      const r = rateio(f, o.nomes);
      for (const p of r.partes) {
        if (!p.donoId) continue;
        const k = f.uid + "|" + p.donoId, pg = pagoPor.get(k);
        let dev = devidaAgora ? cents(p.comissao) : 0;
        if (dev && inicio && comp && comp < inicio && !pg) continue; // acertado antes de começar o controle
        if (!dev && !pg) continue;
        vistos.add(k);
        const pago = pg ? pg.c : 0, saldo = dev - pago;
        out.push({ chave: k, uid: f.uid, registro: f.registro, seq: f.seq, numero: f.id, cliente: (f.tomador || {}).razaoSocial || "",
          competencia: dev ? comp : "", situacaoFatura: situacao(f, o.hoje), donoId: p.donoId, nome: p.nome, sublocado: p.sublocado,
          base: reais(cents(p.bruto) - cents(p.custo)), pct: r.comPct, devido: reais(dev), pago: reais(pago), saldo: reais(saldo),
          datasPagamento: pg ? pg.datas.slice().sort() : [],
          status: saldo === 0 ? "pago" : saldo < 0 ? "credito" : pago > 0 ? "parcial" : "aberto" });
      }
    }
    // pagamentos de faturas que não existem mais (excluídas): crédito
    for (const [k, pg] of pagoPor) {
      if (vistos.has(k)) continue;
      const [uid, donoId] = k.split("|");
      const ref = (pagamentos || []).flatMap((p) => (p.itens || []).filter((it) => it.uid === uid && p.dono_id === donoId).map((it) => Object.assign({ dono_nome: p.dono_nome }, it)))[0] || {};
      out.push({ chave: k, uid, registro: 0, seq: 0, numero: ref.numero || "(excluída)", cliente: ref.cliente || "", competencia: "", situacaoFatura: "cancelada",
        donoId, nome: (o.nomes && o.nomes[donoId]) || ref.dono_nome || donoId, base: 0, pct: 0, devido: 0, pago: reais(pg.c), saldo: -reais(pg.c),
        datasPagamento: pg.datas.slice().sort(), status: "credito", excluida: true });
    }
    return out.sort((a, b) => (a.competencia || "9").localeCompare(b.competencia || "9") || a.registro - b.registro || a.seq - b.seq || a.nome.localeCompare(b.nome));
  }

  const API = { comissoes, montarRateio, moeda, qtdBR, numBR, pctBR, hoje, parseISO, iso, addDias, addMeses, difDias, dataBR, dataBRc, carimbo, agoraISO,
    proximoPeriodo, sugerirSigla, limparSigla, semAcento, padReg, numeroFatura, situacao, NOME_SITUACAO, rateio, dividir,
    textoDonos, textoDonosItem, totalItens, ordenarItens, descricaoPeriodo, trocarPeriodoDescricao, ehSub };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  raiz.MLCalc = API;
})(typeof window !== "undefined" ? window : globalThis);
