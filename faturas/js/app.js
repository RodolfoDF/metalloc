// Metal Loc · Faturas (online) — núcleo: acesso, dados, navegação, painel, locações e faturas.
(function () {
  "use strict";
  const C = window.MLCalc;
  const CFG = window.ML_CONFIG;
  const sb = window.supabase.createClient(CFG.url, CFG.chave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "ml-faturas-sessao" } });

  // ================================================================ utilidades de tela
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  const ICONES = {
    painel: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    locacoes: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    donos: '<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    atualizar: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    seta: '<path d="M7 17L17 7M8 7h9v9"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    baixar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    renovar: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    editar: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    lixo: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    alerta: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    baixo: '<path d="M6 9l6 6 6-6"/>',
    excel: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 12l6 6M15 12l-6 6"/>',
    olho: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    numero: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
    dinheiro: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    parar: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    equip: '<path d="M4 20h16M6 20v-3h12v3M8 17l3-9M16 17l-3-9M9.5 12.5h5M7 8h10V5H7z"/>',
    mapa: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    subir: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    quadro: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    alvo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    caminhao: '<path d="M1 7h12v9H1zM13 10h4l4 3.5V16h-8z"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    externo: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
  };
  const ic = (n) => `<i data-ic="${n}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES[n] || ""}</svg></i>`;
  function hidratarIcones(raiz) { $$("i[data-ic]:not(:has(svg))", raiz).forEach((i) => { i.outerHTML = ic(i.dataset.ic); }); }

  // valor em destaque: R$ 72.624,90 com centavos menores
  function vg(v, cls) {
    const s = C.moeda(v, true), [int, cs] = s.split(",");
    return `<span class="valor ${cls || ""}"><span class="rs">R$ </span><span class="int">${int}</span><span class="cs">,${cs}</span></span>`;
  }
  const sitBadge = (s) => `<span class="sit ${s}">${C.NOME_SITUACAO[s]}</span>`;

  function aviso(msg, tipo) {
    const a = el(`<div class="aviso ${tipo === "erro" ? "erro-av" : tipo === "ok" ? "ok-av" : ""}">${esc(msg)}</div>`);
    $("#avisos").appendChild(a);
    setTimeout(() => a.remove(), tipo === "erro" ? 7000 : 3800);
  }

  // ---------------------------------------------------------------- modais
  function modal({ titulo, corpo, botoes, classe, aoFechar, semFecharFora }) {
    const fundo = el(`<div class="fundo-modal"><div class="modal ${classe || ""}" role="dialog" aria-modal="true">
      <div class="modal-cab"><h2>${esc(titulo)}</h2><button class="ic-btn" data-fechar title="Fechar">${ic("x")}</button></div>
      <div class="modal-corpo"></div><div class="modal-rodape"></div></div></div>`);
    const m = { fundo, corpo: $(".modal-corpo", fundo), rodape: $(".modal-rodape", fundo), fechar };
    if (typeof corpo === "string") m.corpo.innerHTML = corpo; else if (corpo) m.corpo.appendChild(corpo);
    if (!botoes || !botoes.length) m.rodape.remove();
    (botoes || []).forEach((b) => {
      const bt = el(`<button class="btn ${b.classe || ""}">${b.icone ? ic(b.icone) : ""}${esc(b.texto)}</button>`);
      bt.addEventListener("click", async () => {
        if (!b.acao) return fechar();
        bt.disabled = true;
        try { const r = await b.acao(m); if (r !== false) fechar(); }
        catch (e) { aviso(msgErro(e), "erro"); }
        finally { bt.disabled = false; }
      });
      (b.esquerda ? (m.rodape.querySelector(".esq") || m.rodape.insertBefore(el('<div class="esq"></div>'), m.rodape.firstChild)) : m.rodape).appendChild(bt);
    });
    function fechar() { fundo.remove(); document.removeEventListener("keydown", tecla); if (aoFechar) aoFechar(); }
    function tecla(e) { if (e.key === "Escape" && fundo === $("#camada-modais").lastElementChild) fechar(); }
    document.addEventListener("keydown", tecla);
    $("[data-fechar]", fundo).addEventListener("click", fechar);
    if (!semFecharFora) fundo.addEventListener("mousedown", (e) => { if (e.target === fundo) fechar(); });
    $("#camada-modais").appendChild(fundo);
    const foco = $("input:not([type=hidden]):not([readonly]), select, textarea", m.corpo);
    if (foco) setTimeout(() => foco.focus(), 30);
    return m;
  }
  function confirmar(titulo, texto, rotulo, perigo) {
    return new Promise((ok) => {
      let resp = false;
      modal({ titulo, corpo: `<p style="margin:0">${texto}</p>`, aoFechar: () => ok(resp),
        botoes: [{ texto: "Voltar" }, { texto: rotulo || "Confirmar", classe: perigo ? "perigo" : "primario", acao: () => { resp = true; } }] });
    });
  }

  // ---------------------------------------------------------------- erros
  function msgErro(e) {
    const m = String((e && (e.message || e.msg || e.error_description)) || e || "Erro");
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    if (/already registered|already exists/i.test(m)) return "Este e-mail já tem cadastro. Use Entrar ou “Esqueci a senha”.";
    if (/rate limit|security purposes|too many/i.test(m)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    if (/Password should be/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
    if (/JWT expired|invalid JWT/i.test(m)) return "Sua sessão expirou. Entre novamente.";
    if (/row-level security|permission denied/i.test(m)) return "Acesso não liberado para esta ação.";
    if (/duplicate key.*numero/i.test(m)) return "Já existe uma fatura com este número.";
    return m;
  }

  // ================================================================ estado e dados
  const S = {
    user: null, op: null, cfg: {}, emissores: [], donos: [], clientes: [], locacoes: [], faturas: [], operadores: [],
    cli: new Map(), loc: new Map(), fatsDe: new Map(), nomes: {}, carregadoEm: 0,
    ui: { modo: "locacao", sit: "todas", locStatus: "ativa", busca: "", de: "", ate: "", abertos: new Set(), especial: "" },
  };

  async function todos(tabela) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from(tabela).select("*").range(de, de + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  async function carregar() {
    const [cfg, emi, donos, cli, locs, fats, ops, conv, eqs, alertas, pagCom, transp, fretes, freteOc] = await Promise.all(["fat_config", "fat_emissores", "fat_donos", "fat_clientes", "fat_locacoes", "fat_faturas", "fat_operadores", "fat_convites", "fat_equipamentos", "fat_alertas", "fat_comissao_pagamentos", "fat_transportadores", "fat_fretes", "fat_frete_ocorrencias"]
      .map((t) => todos(t).catch((e) => { if (/fat_(transportadores|fretes|frete_ocorrencias)/.test(t)) { console.warn(t, e); return []; } throw e; })));
    S.transp = transp.map((t) => Object.assign({}, t, { id: +t.id, dados: t.dados || {} }));
    S.fretes = fretes.map((f) => Object.assign({}, f, { id: +f.id, registro: +f.registro, transportador_id: f.transportador_id == null ? null : +f.transportador_id, valor: +f.valor, cobrado: +f.cobrado, outros: +f.outros, excesso: +f.excesso }))
      .sort((a, b) => (b.data || "").localeCompare(a.data || "") || b.id - a.id);
    S.freteOc = freteOc.map((o) => Object.assign({}, o, { registro: +o.registro, valor: +o.valor, cobrado: +o.cobrado, total_pago: +o.total_pago, excesso: +o.excesso })).sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    S.convites = conv;
    S.alertas = alertas.sort((a, b) => a.id - b.id);
    S.pagCom = pagCom.map((p) => Object.assign({}, p, { valor: +p.valor })).sort((a, b) => (b.data || "").localeCompare(a.data || "") || b.id - a.id);
    S.equip = eqs.map((e) => Object.assign({}, e.dados, { id: e.id, tag: e.tag })).sort((a, b) => a.tag.localeCompare(b.tag, "pt-BR", { numeric: true }));
    S.cfg = Object.assign({ proximoRegistro: 1, digitosRegistro: 4, diasVencimento: 15, avisoDias: 3, textoOutrasInfo: "", comissao: { nome: "Representante", pct: 5, base: "paga", inicio: "" } }, (cfg[0] || {}).dados || {});
    S.emissores = emi.sort((a, b) => a.ordem - b.ordem).map((e) => Object.assign({ id: e.id }, e.dados));
    S.donos = donos.sort((a, b) => a.ordem - b.ordem);
    S.clientes = cli.map((c) => Object.assign({ id: c.id, sigla: c.sigla || "" }, c.dados)).sort((a, b) => (a.razaoSocial || "").localeCompare(b.razaoSocial || ""));
    S.locacoes = locs.map((l) => Object.assign({}, l.dados, { registro: +l.registro, status: l.status, clienteId: l.cliente_id }));
    S.faturas = fats.map((f) => Object.assign({}, f.dados, { registro: +f.registro, seq: +f.seq, id: f.numero, status: f.status, emitidoPor: f.dados.emitidoPor || f.emitido_por || "" }));
    S.operadores = ops;
    indexar();
    S.carregadoEm = Date.now();
  }
  function indexar() {
    S.cli = new Map(S.clientes.map((c) => [c.id, c]));
    S.loc = new Map(S.locacoes.map((l) => [l.registro, l]));
    S.fatsDe = new Map();
    for (const f of S.faturas) { if (!S.fatsDe.has(f.registro)) S.fatsDe.set(f.registro, []); S.fatsDe.get(f.registro).push(f); }
    for (const l of S.fatsDe.values()) l.sort((a, b) => a.seq - b.seq);
    S.nomes = Object.fromEntries(S.donos.map((d) => [d.id, d.nome]));
    // equipamentos em uso: itens da fatura atual (a última) de cada locação ativa
    S.eqId = new Map((S.equip || []).map((e) => [e.id, e]));
    const porTag = new Map((S.equip || []).map((e) => [String(e.tag).toUpperCase(), e]));
    S.emUso = new Map();
    for (const l of S.locacoes) {
      if (l.status !== "ativa") continue;
      const lista = S.fatsDe.get(l.registro) || [], u = lista[lista.length - 1];
      if (!u) continue;
      for (const it of u.itens || []) {
        if (it.frete) continue;
        const e = (it.equipId && S.eqId.get(it.equipId)) || (it.tag && porTag.get(String(it.tag).toUpperCase()));
        if (e && !S.emUso.has(e.id)) S.emUso.set(e.id, { l, u, it });
      }
    }
  }
  // situação do equipamento: locado (pela fatura atual) · manutenção · inativo · disponível
  function situacaoEquip(e) {
    if (S.emUso.has(e.id)) return "locado";
    if (e.situacao === "manutencao") return "manutencao";
    if (e.situacao === "inativo") return "inativo";
    return "disponivel";
  }
  const NOME_SIT_EQ = { locado: "Locado", disponivel: "Disponível", manutencao: "Manutenção", inativo: "Inativo" };
  async function carregarLeaflet() {
    if (!document.querySelector('link[href*="leaflet.css"]')) document.head.appendChild(el('<link rel="stylesheet" href="vendor/leaflet/leaflet.css">'));
    await carregarScript("vendor/leaflet/leaflet.js");
    return window.L;
  }
  // local de operação (onde o equipamento está trabalhando) — fica na locação
  const localNome = (l) => (l && l.local && l.local.nome) || "";
  const localDaFatura = (f) => localNome(S.loc.get(f.registro));
  const locaisConhecidos = () => [...new Set(S.locacoes.map(localNome).filter(Boolean))].sort();
  function chipLocal(l, peq) {
    if (!l) return "";
    const end = (l.local && l.local.endereco) || "", marcado = l.local && l.local.lat != null;
    const n = localNome(l) || (end.length > 40 ? end.slice(0, 38) + "…" : end);
    if (l.status !== "ativa") return n ? `<span class="local-chip fixo">${ic("mapa")}${esc(n)}</span>` : "";
    return `<span class="local-wrap" data-local-wrap="${l.registro}"><button type="button" class="local-chip ${n ? "" : "vazio"} ${peq ? "peq" : ""}" data-local-edit="${l.registro}" title="${marcado ? "Marcado no mapa — clique para alterar" : "Definir o endereço da obra e marcar no mapa"}">${ic("mapa")}${n ? esc(n) : "definir local"}${n && !marcado ? " <small>(sem ponto)</small>" : ""}${ic("editar")}</button></span>`;
  }
  function editarLocalInline(reg, wrap) {
    const l = S.loc.get(reg); if (!l || !wrap) return;
    wrap.innerHTML = `<span class="local-edit"><input list="lista-locais-op" value="${esc(localNome(l))}" placeholder="ex.: GEALI TAGUATINGA" maxlength="60">
      <button type="button" class="ic-btn peq" data-local-ok="${reg}" title="Salvar">${ic("check")}</button><button type="button" class="ic-btn peq" data-local-x title="Cancelar">${ic("x")}</button></span>
      <datalist id="lista-locais-op">${locaisConhecidos().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
    const inp = $("input", wrap); inp.focus(); inp.select();
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); salvarLocalInline(reg, wrap); } if (e.key === "Escape") { e.stopPropagation(); render(); } });
  }
  async function salvarLocalInline(reg, wrap) {
    const l = S.loc.get(reg), inp = $("input", wrap); if (!l || !inp) return;
    const nome = inp.value.trim().toUpperCase();
    if (nome === localNome(l)) return render();
    inp.disabled = true;
    try {
      const local = Object.assign({}, l.local || {}, { nome });
      await rpc("fat_salvar_locacao", { p_registro: reg, p_dados: { local } });
      l.local = local;
      aviso(nome ? `Local de operação: ${nome}` : "Local de operação removido.", "ok");
      // sem endereço da obra: usa o nome do local para achar no mapa (não mexe num ponto marcado à mão)
      const manual = local.lat != null && (!local.precisao || local.precisao === "manual");
      if (nome && !local.endereco && !manual && ML.localizarLocacao) {
        render();
        const r = await ML.localizarLocacao(l, { silencioso: true });
        aviso(r ? (r.precisao === "endereco" ? `${nome}: marcado no mapa.` : `${nome}: marcado no mapa — ${ML.textoPrecisao(r.precisao)}.`) : `Não achei “${nome}” no mapa. Use Mapa → Definir local para marcar.`, r ? "ok" : "erro");
      }
    } catch (e) { aviso(msgErro(e), "erro"); }
    render();
  }
  const ultimaFatura = (reg) => { const l = S.fatsDe.get(reg) || []; return l[l.length - 1] || null; };
  const fatura = (reg, seq) => (S.fatsDe.get(reg) || []).find((f) => f.seq === seq) || null;
  const nomeCliente = (id) => { const c = S.cli.get(id); return c ? c.razaoSocial : "(cliente removido)"; };
  const equipLoc = (l) => {
    const u = ultimaFatura(l.registro);
    const e = u ? [...new Set((u.itens || []).filter((i) => !i.frete).map((i) => i.equip).filter(Boolean))].join(" + ") : "";
    return e || l.equipamento || "";
  };
  const hoje = () => C.hoje();

  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;
    return data;
  }
  async function recarregarERender() {
    try { await carregar(); } catch (e) { aviso(msgErro(e), "erro"); }
    render();
  }
  async function salvarConfig(parcial) {
    const { data, error } = await sb.from("fat_config").select("*").eq("id", 1);
    if (error) throw error;
    const atual = (data && data[0] && data[0].dados) || {};
    const novo = Object.assign({}, atual, parcial);
    const r = await sb.from("fat_config").upsert({ id: 1, dados: novo });
    if (r.error) throw r.error;
    S.cfg = Object.assign(S.cfg, novo);
  }

  // renovações: locações ativas cujo período atual termina em até N dias (ou já terminou)
  function renovacoes(limite) {
    const d = hoje(), out = [];
    for (const l of S.locacoes) {
      if (l.status !== "ativa") continue;
      const u = ultimaFatura(l.registro);
      if (!u || !u.periodoFim) continue;
      const dias = C.difDias(d, u.periodoFim);
      if (dias <= limite) out.push({ l, u, dias });
    }
    return out.sort((a, b) => a.dias - b.dias);
  }
  const avisoDias = () => Math.max(0, +S.cfg.avisoDias || 0);
  function textoDias(dias) {
    if (dias < -1) return `período terminou há ${-dias} dias`;
    if (dias === -1) return "período terminou ontem";
    if (dias === 0) return "período termina hoje";
    if (dias === 1) return "termina amanhã";
    return `termina em ${dias} dias`;
  }

  // ================================================================ acesso
  let modoLogin = "entrar";
  function mostrar(qual) {
    $("#carregando").hidden = qual !== "carregando";
    $("#tela-login").hidden = qual !== "login";
    $("#tela-espera").hidden = qual !== "espera";
    $("#app").hidden = qual !== "app";
  }
  function ajustarLogin() {
    const cad = modoLogin === "cadastro", esq = modoLogin === "esqueci";
    $("#login-titulo").textContent = cad ? "Criar acesso" : esq ? "Recuperar senha" : "Entrar";
    $("#login-sub").textContent = cad ? "O administrador libera seu usuário depois do cadastro." : esq ? "Enviaremos um link para criar uma nova senha." : "Faturas de locação";
    $$("[data-cadastro]").forEach((x) => { x.hidden = !cad; });
    $("[data-senha]").hidden = esq;
    $("[data-senha] input").required = !esq;
    $("[data-senha] input").autocomplete = cad ? "new-password" : "current-password";
    $("#login-botao").textContent = cad ? "Criar acesso" : esq ? "Enviar link" : "Entrar";
    $("#login-alternar").textContent = cad || esq ? "Já tenho acesso — Entrar" : "Primeiro acesso? Criar conta";
    $("#login-esqueci").hidden = cad || esq;
    $("#login-erro").hidden = true; $("#login-ok").hidden = true;
  }
  function ligarLogin() {
    $("#login-alternar").addEventListener("click", (e) => { e.preventDefault(); modoLogin = modoLogin === "entrar" ? "cadastro" : "entrar"; ajustarLogin(); });
    $("#login-esqueci").addEventListener("click", (e) => { e.preventDefault(); modoLogin = "esqueci"; ajustarLogin(); });
    $("#form-login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, bt = $("#login-botao"), erro = $("#login-erro"), ok = $("#login-ok");
      const email = f.email.value.trim(), senha = f.senha.value, nome = f.nome.value.trim();
      erro.hidden = true; ok.hidden = true; bt.disabled = true;
      try {
        if (modoLogin === "entrar") {
          const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
          if (error) throw error;
          await entrar(data.session);
        } else if (modoLogin === "cadastro") {
          if (!nome) throw new Error("Informe seu nome.");
          const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: location.origin + location.pathname } });
          if (error) throw error;
          if (data.session) await entrar(data.session);
          else { ok.textContent = "Cadastro criado! Enviamos um link de confirmação para o seu e-mail. Abra o link e depois entre aqui."; ok.hidden = false; modoLogin = "entrar"; const msg = ok.textContent; ajustarLogin(); ok.textContent = msg; ok.hidden = false; }
        } else {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
          if (error) throw error;
          ok.textContent = "Se este e-mail tiver cadastro, você vai receber um link para criar uma nova senha."; ok.hidden = false;
        }
      } catch (er) { erro.textContent = msgErro(er); erro.hidden = false; }
      finally { bt.disabled = false; }
    });
    $$("[data-sair]").forEach((b) => b.addEventListener("click", sair));
    $("#espera-verificar").addEventListener("click", async () => { const { data } = await sb.auth.getSession(); if (data.session) entrar(data.session); });
  }
  async function sair() {
    try { await sb.auth.signOut(); } catch (e) { /* segue */ }
    S.user = null; S.op = null; modoLogin = "entrar"; ajustarLogin(); mostrar("login");
  }

  async function entrar(sessao) {
    if (!sessao) return mostrar("login");
    mostrar("carregando");
    try {
      S.user = sessao.user;
      let { data, error } = await sb.from("fat_operadores").select("*").eq("user_id", S.user.id);
      if (error) throw error;
      let op = data && data[0];
      if (!op || !op.ativo) { // sem cadastro ou aguardando: registra (entra liberado se houver convite para o e-mail)
        const meta = S.user.user_metadata || {};
        op = await rpc("fat_registrar_me", { p_nome: meta.nome || (S.user.email || "").split("@")[0] });
      }
      S.op = op;
      if (!op.ativo) { $("#espera-email").textContent = S.user.email || ""; return mostrar("espera"); }
      await carregar();
      S.op = S.operadores.find((o) => o.user_id === S.user.id) || op;
      const nome = S.op.nome || S.user.email;
      $("#u-nome").textContent = nome;
      $("#u-papel").textContent = S.op.admin ? "Administrador" : "Operador";
      $("#u-avatar").textContent = nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
      mostrar("app");
      if (!location.hash) location.hash = "#/painel"; else render();
    } catch (e) {
      mostrar("login");
      $("#login-erro").textContent = msgErro(e); $("#login-erro").hidden = false;
    }
  }

  function novaSenhaModal() {
    const corpo = el(`<div><p class="muted" style="margin:0 0 10px">Escolha a nova senha de acesso.</p>
      <label class="campo"><span>Nova senha</span><input type="password" minlength="6" autocomplete="new-password"></label></div>`);
    modal({ titulo: "Criar nova senha", corpo, semFecharFora: true, botoes: [{ texto: "Salvar senha", classe: "primario", acao: async () => {
      const { error } = await sb.auth.updateUser({ password: $("input", corpo).value });
      if (error) throw error;
      aviso("Senha alterada.", "ok");
    } }] });
  }

  // ================================================================ navegação
  const TELAS = {};
  function rotaAtual() { return (location.hash.replace(/^#\/?/, "").split("?")[0] || "painel"); }
  function render() {
    if ($("#app").hidden) return;
    const r = TELAS[rotaAtual()] ? rotaAtual() : "painel";
    $$(".lateral nav a").forEach((a) => a.classList.toggle("ativo", a.dataset.rota === r));
    $("#lateral").classList.remove("aberta");
    const nCom = ML.qtdComissoesAbertas ? ML.qtdComissoesAbertas() : 0;
    $("#nav-comissao").hidden = !nCom; $("#nav-comissao").textContent = nCom;
    const nFre = ML.qtdFretesAPagar ? ML.qtdFretesAPagar() : 0;
    if ($("#nav-frete")) { $("#nav-frete").hidden = !nFre; $("#nav-frete").textContent = nFre; }
    const pend = renovacoes(avisoDias()).length;
    $("#nav-renovar").hidden = !pend; $("#nav-renovar").textContent = pend;
    const dt = new Date();
    const txt = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    $("#data-hoje").textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
    const pag = document.createElement("div");
    $("#conteudo").replaceChildren(pag);
    TELAS[r](pag);
    hidratarIcones(pag);
  }

  // ================================================================ PAINEL
  TELAS.painel = function (main) {
    const d = hoje(), mes = d.slice(0, 7), mesAnt = C.addMeses(d.slice(0, 7) + "-01", -1).slice(0, 7);
    const valida = S.faturas.filter((f) => f.status !== "cancelada");
    const somaMes = (m) => valida.filter((f) => (f.dataEmissao || "").startsWith(m)).reduce((s, f) => s + (+f.total || 0), 0);
    const fatMes = somaMes(mes), fatAnt = somaMes(mesAnt);
    const qMes = valida.filter((f) => (f.dataEmissao || "").startsWith(mes)).length;
    const abertas = S.faturas.filter((f) => C.situacao(f, d) === "aberta"), vencidas = S.faturas.filter((f) => C.situacao(f, d) === "vencida");
    const soma = (l) => l.reduce((s, f) => s + (+f.total || 0), 0);
    const recebMes = S.faturas.filter((f) => f.status === "paga" && (f.pagoEm || "").startsWith(mes));
    const variacao = fatAnt ? Math.round((fatMes - fatAnt) / fatAnt * 100) : null;
    const nomeMes = (m) => { const t = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 15).toLocaleDateString("pt-BR", { month: "long" }); return t; };
    const meses = []; for (let i = 5; i >= 0; i--) meses.push(C.addMeses(mes + "-01", -i).slice(0, 7));
    const valsMes = meses.map(somaMes), maxMes = Math.max(1, ...valsMes);
    const ren = renovacoes(avisoDias()), proximas = renovacoes(7);
    const em7 = abertas.filter((f) => f.vencimento && f.vencimento <= C.addDias(d, 7));
    const semDono = S.faturas.filter((f) => f.status !== "cancelada" && (f.itens || []).some((i) => !i.frete && !(i.donos || []).length));
    const pctV = soma(abertas) + soma(vencidas) ? soma(vencidas) / (soma(abertas) + soma(vencidas)) * 100 : 0;

    main.innerHTML = `
    <div class="pag-cab"><h1>Painel</h1>
      <button class="btn" data-acao="exportar-mes">${ic("excel")}Exportar mês</button>
      <button class="btn primario" data-acao="nova">${ic("mais")}Nova fatura</button></div>
    <div class="grade kpis">
      <button class="cartao kpi destaque" data-ir="lista-mes"><span class="rot">Faturado em ${nomeMes(mes)}</span><span class="seta">${ic("seta")}</span>
        ${variacao == null ? "" : `<span class="chip-var">${variacao >= 0 ? "▲" : "▼"} ${Math.abs(variacao)}% vs ${nomeMes(mesAnt)}</span>`}
        ${vg(fatMes)}<span class="det">${qMes} fatura${qMes === 1 ? "" : "s"} emitida${qMes === 1 ? "" : "s"} no mês</span></button>
      <button class="cartao kpi" data-ir="aberta"><span class="rot">A receber</span><span class="seta">${ic("seta")}</span>${vg(soma(abertas) + soma(vencidas))}
        <span class="det">${abertas.length + vencidas.length} faturas em aberto</span></button>
      <button class="cartao kpi alerta" data-ir="vencida"><span class="rot">Vencidas</span><span class="seta">${ic("seta")}</span>${vg(soma(vencidas))}
        <span class="det">${vencidas.length ? vencidas.length + " fatura" + (vencidas.length === 1 ? "" : "s") + " para cobrar" : "Nenhuma vencida"}</span></button>
      <button class="cartao kpi" data-ir="paga"><span class="rot">Recebido em ${nomeMes(mes)}</span><span class="seta">${ic("seta")}</span>${vg(soma(recebMes))}
        <span class="det">${recebMes.length} pagamento${recebMes.length === 1 ? "" : "s"} registrado${recebMes.length === 1 ? "" : "s"}</span></button>
    </div>
    <div class="grade painel-meio">
      <div class="cartao"><div class="cartao-cab"><h2>Faturamento</h2><span class="muted" style="margin-left:auto;font-size:12px">últimos 6 meses</span></div>
        ${vg(fatMes, "medio")}
        <div class="barras">${meses.map((m, i) => `<div class="barra ${m === mes ? "atual" : ""}"><span class="dica">${C.moeda(valsMes[i])}</span>
          <div class="col" style="height:${Math.max(3, valsMes[i] / maxMes * 100)}%"></div><small>${nomeMes(m).slice(0, 3)}</small></div>`).join("")}</div></div>
      <div class="cartao"><div class="cartao-cab"><h2>A receber</h2></div>${vg(soma(abertas) + soma(vencidas), "medio")}
        <div class="medidor"><span style="width:${100 - pctV}%;background:#3b7ddd"></span><span style="width:${pctV}%;background:#d64535"></span></div>
        <div class="leg"><span class="pt aberta"></span>Em dia<b>${C.moeda(soma(abertas))}</b></div>
        <div class="leg"><span class="pt vencida"></span>Vencidas<b>${C.moeda(soma(vencidas))}</b></div>
        <div class="leg"><span class="pt" style="background:#f59e0b"></span>Vencem em 7 dias<b>${C.moeda(soma(em7))}</b></div></div>
      <div class="cartao"><div class="cartao-cab"><h2>Para fazer hoje</h2></div><div class="afazer">
        <button data-ir="renovar"><span class="ic">${ic("renovar")}</span><span class="tx"><b>Renovar ${ren.length} locaç${ren.length === 1 ? "ão" : "ões"}</b><small>período terminando em até ${avisoDias()} dia${avisoDias() === 1 ? "" : "s"}</small></span><span class="vl">${C.moeda(ren.reduce((s, r) => s + (+r.u.total || 0), 0))}</span>${ic("seta")}</button>
        <button data-ir="vencida"><span class="ic vermelho">${ic("alerta")}</span><span class="tx"><b>Cobrar ${vencidas.length} fatura${vencidas.length === 1 ? "" : "s"} vencida${vencidas.length === 1 ? "" : "s"}</b><small>vencimento já passou</small></span><span class="vl">${C.moeda(soma(vencidas))}</span>${ic("seta")}</button>
        <button data-ir="aberta"><span class="ic azul">${ic("relogio")}</span><span class="tx"><b>${em7.length} fatura${em7.length === 1 ? "" : "s"} vence${em7.length === 1 ? "" : "m"} em 7 dias</b><small>acompanhar pagamento</small></span><span class="vl">${C.moeda(soma(em7))}</span>${ic("seta")}</button>
        ${semDono.length ? `<button data-ir="donos"><span class="ic">${ic("donos")}</span><span class="tx"><b>${semDono.length} fatura${semDono.length === 1 ? "" : "s"} sem dono definido</b><small>necessário para o rateio</small></span>${ic("seta")}</button>` : ""}
      </div></div>
    </div>
    <div class="grade" style="grid-template-columns:1.35fr 1fr;align-items:start">
      <div class="cartao"><div class="cartao-cab"><h2>Renovações dos próximos dias</h2></div>${tabelaRenovacoes(proximas)}</div>
      <div class="cartao"><div class="cartao-cab"><h2>Na rua agora</h2><div class="acoes"><a class="btn peq fantasma" href="#/mapa">${ic("mapa")}Abrir mapa</a></div></div>
        <div class="mini-mapa" data-mini-mapa></div><small class="muted" data-mini-info style="display:block;margin-top:8px"></small></div>
    </div>
    <div class="cartao" style="margin-top:14px"><div class="cartao-cab"><h2>Últimas faturas</h2><div class="acoes"><a class="btn peq fantasma" href="#/locacoes">Ver todas</a></div></div>
      ${tabelaFaturas(S.faturas.slice().sort(ordemRecentes).slice(0, 8), { compacta: true })}</div>`;
    if (window.matchMedia("(max-width: 1180px)").matches) $("[data-mini-mapa]", main).closest(".grade").style.gridTemplateColumns = "1fr";
    if (ML.miniMapa) {
      const n = ML.miniMapa($("[data-mini-mapa]", main)), sem = ML.contarSemLocal();
      $("[data-mini-info]", main).innerHTML = `${n} locação(ões) no mapa${sem ? ` · <a href="#/mapa" style="color:var(--laranja-esc)">${sem} sem local definido</a>` : ""}`;
    }
    main.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ir],[data-acao]");
      if (!b) return;
      const ir = b.dataset.ir, ac = b.dataset.acao;
      if (ac === "nova") return ML.abrirEditor({ modo: "nova" });
      if (ac === "exportar-mes") return exportarFaturas(S.faturas.filter((f) => (f.dataEmissao || "").startsWith(mes)).sort(ordemEmissao), `Faturas emitidas em ${nomeMes(mes)} de ${mes.slice(0, 4)}`, `Faturas ${mes}.xlsx`);
      if (ir === "donos") { location.hash = "#/donos"; return; }
      Object.assign(S.ui, { busca: "", de: "", ate: "", especial: "" });
      if (ir === "renovar") Object.assign(S.ui, { modo: "locacao", sit: "todas", locStatus: "ativa", especial: "renovar" });
      else if (ir === "lista-mes") Object.assign(S.ui, { modo: "lista", sit: "todas", de: mes + "-01", ate: C.addDias(C.addMeses(mes + "-01", 1), -1) });
      else if (["aberta", "vencida", "paga"].includes(ir)) Object.assign(S.ui, { modo: "lista", sit: ir });
      location.hash = "#/locacoes";
      if (rotaAtual() === "locacoes") render();
    });
    ligarTabelas(main);
  };

  function tabelaRenovacoes(lista) {
    if (!lista.length) return `<div class="vazio">Nenhuma renovação nos próximos 7 dias.</div>`;
    return `<div class="tabela-wrap" style="max-height:520px"><table class="tab"><thead><tr><th>Locação</th><th>Período atual</th><th class="direita">Valor</th><th></th></tr></thead><tbody>
      ${lista.map(({ l, u, dias }) => `<tr><td><b class="nfat">${esc(u.id)}</b><span class="cli-nome" style="max-width:220px">${esc(nomeCliente(l.clienteId))}</span><small class="muted">${esc(equipLoc(l))}</small></td>
        <td class="nowrap">${C.dataBRc(u.periodoIni)} a ${C.dataBRc(u.periodoFim)}<br><span class="etq ${dias < 0 ? "verm" : dias <= avisoDias() ? "lar" : ""}">${textoDias(dias)}</span></td>
        <td class="direita num nowrap">${C.moeda(u.total)}</td>
        <td class="acoes-td"><button class="btn peq primario" title="Renovar" data-renovar="${l.registro}">${ic("renovar")}</button></td></tr>`).join("")}
      </tbody></table></div>`;
  }

  const ordemRecentes = (a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || "") || b.registro - a.registro || b.seq - a.seq;
  const ordemEmissao = (a, b) => (a.dataEmissao || "").localeCompare(b.dataEmissao || "") || a.registro - b.registro || a.seq - b.seq;

  function tabelaFaturas(lista, o) {
    o = o || {};
    if (!lista.length) return `<div class="vazio">Nenhuma fatura encontrada.</div>`;
    const d = hoje();
    let tot = 0;
    const linhas = lista.map((f) => {
      const s = C.situacao(f, d);
      if (s !== "cancelada") tot += +f.total || 0;
      const equip = [...new Set((f.itens || []).filter((i) => !i.frete).map((i) => i.equip).filter(Boolean))].join(" + ");
      if (o.compacta) return `<tr class="${s} clicavel" data-fat="${f.registro}:${f.seq}"><td class="nfat">${esc(f.id)}</td>
        <td><span class="cli-nome" style="max-width:210px">${esc((f.tomador || {}).razaoSocial)}</span></td><td class="direita num nowrap">${C.moeda(f.total)}</td><td>${sitBadge(s)}</td></tr>`;
      return `<tr class="${s} clicavel" data-fat="${f.registro}:${f.seq}">
        <td class="nfat">${esc(f.id)}</td>
        ${o.semCliente ? "" : `<td><span class="cli-nome" title="${esc((f.tomador || {}).razaoSocial)}">${esc((f.tomador || {}).razaoSocial)}</span>${equip ? `<small class="muted">${esc(equip)}</small>` : ""}${(() => { const l = S.loc.get(f.registro), u = ultimaFatura(f.registro); return l && u && u.seq === f.seq ? chipLocal(l, true) : localDaFatura(f) ? `<small class="muted">${ic("mapa")} ${esc(localDaFatura(f))}</small>` : ""; })()}</td>`}
        <td class="nowrap">${C.dataBR(f.dataEmissao)}</td>
        <td class="nowrap">${f.periodoIni ? C.dataBRc(f.periodoIni) + " a " + C.dataBRc(f.periodoFim) : "—"}</td>
        <td class="nowrap">${C.dataBR(f.vencimento)}</td>
        <td>${sitBadge(s)}${f.status === "paga" && f.pagoEm ? `<br><small class="muted">pago ${C.dataBRc(f.pagoEm)}</small>` : ""}</td>
        <td class="direita num nowrap"><b>${C.moeda(f.total)}</b></td>
        <td class="acoes-td">
          ${s === "aberta" || s === "vencida" ? `<button class="ic-btn peq" title="Marcar como paga" data-pagar="${f.registro}:${f.seq}">${ic("check")}</button>` : ""}
          <button class="ic-btn peq" title="Baixar PDF" data-pdf="${f.registro}:${f.seq}">${ic("baixar")}</button></td></tr>`;
    }).join("");
    const cab = o.compacta ? "" : `<thead><tr><th>Nº</th>${o.semCliente ? "" : "<th>Cliente</th>"}<th>Emissão</th><th>Período</th><th>Vencimento</th><th>Situação</th><th class="direita">Total</th><th></th></tr></thead>`;
    const rod = o.compacta || o.semTotal ? "" : `<tfoot><tr><td colspan="${o.semCliente ? 5 : 6}">${lista.length} fatura${lista.length === 1 ? "" : "s"} · total sem canceladas</td><td class="direita num nowrap">${C.moeda(tot)}</td><td></td></tr></tfoot>`;
    return `<div class="tabela-wrap"><table class="tab">${cab}<tbody>${linhas}</tbody>${rod}</table></div>`;
  }

  // cliques comuns em tabelas de faturas e renovações
  function ligarTabelas(raiz) {
    raiz.addEventListener("click", async (e) => {
      if (e.target.closest("input, select, label")) return; // caixas de seleção dentro da linha
      const t = e.target.closest("[data-pagar],[data-pdf],[data-renovar],[data-fat]");
      if (!t || !raiz.contains(t)) return;
      e.stopPropagation();
      if (t.dataset.renovar) return ML.abrirEditor({ modo: "renovar", registro: +t.dataset.renovar });
      const chave = t.dataset.pagar || t.dataset.pdf || t.dataset.fat;
      const [reg, seq] = chave.split(":").map(Number);
      const f = fatura(reg, seq);
      if (!f) return;
      if (t.dataset.pagar) return marcarPaga(f);
      if (t.dataset.pdf) return baixarPdf(f);
      abrirFatura(f);
    });
  }

  // ================================================================ LOCAÇÕES E FATURAS (unificado)
  TELAS.locacoes = function (main) {
    const u = S.ui, d = hoje();
    const busca = C.semAcento(u.busca).toLowerCase().trim();
    const casa = (f) => {
      if (!busca) return true;
      const t = C.semAcento([f.id, (f.tomador || {}).razaoSocial, (f.tomador || {}).fantasia, (f.tomador || {}).documento, localDaFatura(f), ...(f.itens || []).map((i) => i.equip + " " + i.descricao)].join(" ")).toLowerCase();
      return busca.split(/\s+/).every((p) => t.includes(p));
    };
    const filtraSit = (f) => u.sit === "todas" || C.situacao(f, d) === u.sit;
    const filtraData = (f) => (!u.de || (f.dataEmissao || "") >= u.de) && (!u.ate || (f.dataEmissao || "") <= u.ate) && (!u.local || localDaFatura(f) === u.local);
    const base = S.faturas.filter((f) => casa(f) && filtraData(f));
    const cont = { todas: base.length, aberta: 0, vencida: 0, paga: 0, cancelada: 0 };
    base.forEach((f) => { cont[C.situacao(f, d)]++; });
    const chipsSit = [["todas", "Todas"], ["aberta", "Em aberto"], ["vencida", "Vencidas"], ["paga", "Pagas"], ["cancelada", "Canceladas"]]
      .map(([k, t]) => `<button class="chip ${u.sit === k ? "ativo" : ""}" data-sit="${k}">${k !== "todas" ? `<span class="pt ${k}"></span>` : ""}${t}<span class="n">${cont[k]}</span></button>`).join("");

    main.innerHTML = `
      <div class="pag-cab"><h1>Locações e faturas</h1>
        <div class="alternar"><button data-modo="locacao" class="${u.modo === "locacao" ? "ativo" : ""}">Por locação</button><button data-modo="lista" class="${u.modo === "lista" ? "ativo" : ""}">Todas as faturas</button></div>
        <button class="btn" data-acao="exportar">${ic("excel")}Exportar Excel</button>
        <button class="btn primario" data-acao="nova">${ic("mais")}Nova fatura</button></div>
      <div class="filtros">
        <input class="busca-local" type="search" placeholder="Filtrar por cliente, nº, equipamento…" value="${esc(u.busca)}" data-f="busca">
        <span class="chips">${chipsSit}</span>
        ${locaisConhecidos().length ? `<select data-f="local"><option value="">Todos os locais</option>${locaisConhecidos().map((x) => `<option ${x === u.local ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>` : ""}
        ${u.modo === "locacao" ? `<select data-f="locStatus"><option value="ativa" ${u.locStatus === "ativa" ? "selected" : ""}>Locações ativas</option><option value="encerrada" ${u.locStatus === "encerrada" ? "selected" : ""}>Encerradas</option><option value="todas" ${u.locStatus === "todas" ? "selected" : ""}>Todas as locações</option></select>
          <button class="chip ${u.especial === "renovar" ? "ativo" : ""}" data-especial="renovar">${ic("renovar")}A renovar<span class="n">${renovacoes(avisoDias()).length}</span></button>` : ""}
        <span class="muted" style="font-size:12.5px">Emissão</span><input type="date" data-f="de" value="${u.de}"><span class="muted">a</span><input type="date" data-f="ate" value="${u.ate}">
        ${u.busca || u.de || u.ate || u.local || u.sit !== "todas" || u.especial ? `<button class="btn peq fantasma" data-acao="limpar">${ic("x")}Limpar</button>` : ""}
      </div>
      <div id="lista-area"></div>`;
    const area = $("#lista-area", main);
    let listaExport;
    if (u.modo === "lista") {
      const lista = base.filter(filtraSit).sort((a, b) => (b.dataEmissao || "").localeCompare(a.dataEmissao || "") || b.registro - a.registro || b.seq - a.seq);
      listaExport = lista;
      area.innerHTML = tabelaFaturas(lista);
    } else {
      const pend = new Map(renovacoes(avisoDias()).map((r) => [r.l.registro, r]));
      const grupos = [];
      for (const l of S.locacoes) {
        if (u.locStatus !== "todas" && l.status !== u.locStatus) continue;
        if (u.especial === "renovar" && !pend.has(l.registro)) continue;
        if (u.local && localNome(l) !== u.local) continue;
        const fats = (S.fatsDe.get(l.registro) || []);
        const vis = fats.filter((f) => casa(f) && filtraSit(f) && filtraData(f));
        const nomeOk = !busca || C.semAcento(nomeCliente(l.clienteId) + " " + equipLoc(l) + " " + l.registro + " " + localNome(l)).toLowerCase().includes(busca);
        if (!vis.length && !(nomeOk && u.sit === "todas" && !u.de && !u.ate && fats.length === 0)) continue;
        grupos.push({ l, fats, vis, ult: fats[fats.length - 1], pend: pend.get(l.registro) });
      }
      grupos.sort((a, b) => (!!b.pend - !!a.pend) || (a.pend && b.pend ? a.pend.dias - b.pend.dias : 0)
        || (a.l.status === "ativa" ? 0 : 1) - (b.l.status === "ativa" ? 0 : 1)
        || ((b.ult && b.ult.dataEmissao) || "").localeCompare((a.ult && a.ult.dataEmissao) || ""));
      listaExport = grupos.flatMap((g) => g.vis).sort(ordemEmissao);
      area.innerHTML = grupos.length ? `<div class="locs">${grupos.map(cardLocacao).join("")}</div>` : `<div class="cartao vazio">Nenhuma locação encontrada com estes filtros.</div>`;
    }

    main.addEventListener("click", (e) => {
      const b = e.target.closest("[data-modo],[data-sit],[data-acao],[data-especial],[data-loc-abrir],[data-loc-menu],[data-renovar-loc],[data-encerrar-loc]");
      if (!b) return;
      if (b.dataset.modo) { u.modo = b.dataset.modo; u.especial = ""; return render(); }
      if (b.dataset.sit) { u.sit = b.dataset.sit; return render(); }
      if (b.dataset.especial) { u.especial = u.especial ? "" : b.dataset.especial; if (u.especial) u.locStatus = "ativa"; return render(); }
      if (b.dataset.renovarLoc) { e.stopPropagation(); return ML.abrirEditor({ modo: "renovar", registro: +b.dataset.renovarLoc }); }
      if (b.dataset.encerrarLoc) { e.stopPropagation(); return ML.encerrarLocacao(S.loc.get(+b.dataset.encerrarLoc)); }
      if (b.dataset.locMenu) { e.stopPropagation(); return editarLocacao(S.loc.get(+b.dataset.locMenu)); }
      if (b.dataset.locAbrir) {
        if (e.target.closest(".loc-corpo")) return;
        const r = +b.dataset.locAbrir;
        u.abertos.has(r) ? u.abertos.delete(r) : u.abertos.add(r);
        const card = b.closest(".loc");
        card.classList.toggle("aberto");
        $(".loc-corpo", card).hidden = !u.abertos.has(r);
        return;
      }
      const ac = b.dataset.acao;
      if (ac === "nova") return ML.abrirEditor({ modo: "nova" });
      if (ac === "limpar") { Object.assign(u, { busca: "", de: "", ate: "", sit: "todas", especial: "", local: "" }); $("#busca-global").value = ""; return render(); }
      if (ac === "exportar") {
        const desc = [u.sit !== "todas" ? C.NOME_SITUACAO[u.sit] : "", u.de || u.ate ? `emissão ${u.de ? C.dataBR(u.de) : "…"} a ${u.ate ? C.dataBR(u.ate) : "…"}` : "", u.busca ? `busca “${u.busca}”` : ""].filter(Boolean).join(" · ");
        return exportarFaturas(listaExport, "Faturas de locação" + (desc ? " — " + desc : ""), `Faturas ${hoje()}.xlsx`);
      }
    });
    let tmr;
    $$("[data-f]", main).forEach((inp) => inp.addEventListener(inp.type === "search" ? "input" : "change", () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        u[inp.dataset.f] = inp.value;
        if (inp.dataset.f === "busca") $("#busca-global").value = inp.value;
        const pos = inp.selectionStart; render();
        const novo = $(`[data-f="${inp.dataset.f}"]`); if (novo && inp.type === "search") { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (er) { /* */ } }
      }, inp.type === "search" ? 220 : 0);
    }));
    ligarTabelas(area);
  };

  function cardLocacao(g) {
    const { l, fats, vis, ult, pend } = g;
    const cli = S.cli.get(l.clienteId) || {};
    const d = hoje();
    const totalAberto = fats.filter((f) => ["aberta", "vencida"].includes(C.situacao(f, d))).reduce((s, f) => s + (+f.total || 0), 0);
    const temVencida = fats.some((f) => C.situacao(f, d) === "vencida");
    const aberto = S.ui.abertos.has(l.registro) || (S.ui.busca && vis.length <= 3);
    const dias = ult && ult.periodoFim ? C.difDias(d, ult.periodoFim) : null;
    return `<div class="loc ${l.status} ${aberto ? "aberto" : ""}">
      <div class="loc-cab" data-loc-abrir="${l.registro}">
        <div class="loc-tit"><b>${cli.sigla ? `<span class="sigla">${esc(cli.sigla)}</span> ` : ""}${esc(nomeCliente(l.clienteId))}</b>
          <small>Locação ${esc(C.padReg(l.registro, S.cfg.digitosRegistro))} · ${esc(equipLoc(l) || "sem equipamento")} · ${fats.length} fatura${fats.length === 1 ? "" : "s"}${l.status === "encerrada" ? " · encerrada" : ""}</small>
          <div class="loc-chips">${chipLocal(l)}${ML.chipFrete ? ML.chipFrete(l) : ""}</div></div>
        <div class="loc-per">${ult ? `<span>Última: <b class="nfat">${esc(ult.id)}</b> ${sitBadge(C.situacao(ult, d))}</span>
          <span class="muted">${ult.periodoIni ? C.dataBRc(ult.periodoIni) + " a " + C.dataBRc(ult.periodoFim) : ""}
          ${l.status === "ativa" && dias != null ? ` · <span class="etq ${dias < 0 ? "verm" : pend ? "lar" : ""}">${textoDias(dias)}</span>` : ""}</span>` : `<span class="muted">sem faturas</span>`}
          ${temVencida ? `<span class="etq verm" style="width:max-content">em aberto ${C.moeda(totalAberto)}</span>` : ""}</div>
        ${vg(ult ? ult.total : 0, "medio")}
        <div class="loc-acoes">
          ${l.status === "ativa" ? `<button class="btn peq ${pend ? "primario" : ""}" data-renovar-loc="${l.registro}">${ic("renovar")}Renovar</button>
            <button class="btn peq" data-encerrar-loc="${l.registro}" title="Equipamento devolvido: encerra a locação e registra o frete de devolução">${ic("check")}Encerrar</button>` : ""}
          <button class="ic-btn peq" title="Dados da locação" data-loc-menu="${l.registro}">${ic("editar")}</button>
          <span class="seta-abrir">${ic("baixo")}</span></div>
      </div>
      <div class="loc-corpo" ${aberto ? "" : "hidden"}>${tabelaFaturas(vis.slice().reverse(), { semCliente: true })}</div></div>`;
  }

  function editarLocacao(l) {
    if (!l) return;
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="aviso-linha">Locação <b>${esc(C.padReg(l.registro, S.cfg.digitosRegistro))}</b> · ${esc(nomeCliente(l.clienteId))}</div>
      <label class="campo"><span>Serviço (texto usado na discriminação das novas faturas)</span><input name="servico" value="${esc(l.servico || "")}"></label>
      <div class="linha-campos c2">
        <label class="campo"><span>Data de implantação</span><input type="date" name="dataInicio" value="${esc(l.dataInicio || "")}"></label>
        <label class="campo"><span>Situação da locação</span><select name="status"><option value="ativa">Ativa (gera renovações)</option><option value="encerrada" ${l.status === "encerrada" ? "selected" : ""}>Encerrada (equipamento devolvido)</option></select></label></div>
      <label class="campo"><span>Local de operação (onde o equipamento está trabalhando)</span><input name="localNome" list="lista-locais-op2" value="${esc(localNome(l))}" style="text-transform:uppercase" placeholder="ex.: GEALI TAGUATINGA">
        <datalist id="lista-locais-op2">${locaisConhecidos().map((x) => `<option value="${esc(x)}">`).join("")}</datalist></label>
      <label class="campo"><span>Endereço da obra <small>(o app procura e marca no mapa sozinho)</small></span><input name="enderecoObra" value="${esc((l.local || {}).endereco || "")}" placeholder="rua, número, bairro — ou deixe vazio para usar o endereço do cliente"></label>
      <label class="campo"><span>Prestador de serviços</span><select name="emissorId">${S.emissores.map((e) => `<option value="${esc(e.id)}" ${e.id === l.emissorId ? "selected" : ""}>${esc(e.razaoSocial)}</option>`).join("")}</select></label>
      <label class="campo"><span>Observações internas</span><textarea name="obs">${esc(l.obs || "")}</textarea></label>
      <div class="aviso-linha" style="display:flex;align-items:center;gap:10px">${ic("mapa")}<span style="flex:1">${l.local && l.local.lat != null ? "Local da obra: " + esc(l.local.endereco || "marcado no mapa") : l.local && l.local.endereco ? "Endereço: " + esc(l.local.endereco) + " (sem ponto no mapa)" : "Local da obra ainda não definido"}</span>
        <button type="button" class="btn peq" data-def-local>Definir no mapa</button></div></div>`);
    corpo.addEventListener("click", (e) => { if (e.target.closest("[data-def-local]") && ML.definirLocal) { mm.fechar(); ML.definirLocal(l); } });
    if (ML.autocompletarEndereco) ML.autocompletarEndereco($("[name=enderecoObra]", corpo));
    const mm = modal({ titulo: "Dados da locação", corpo, botoes: [{ texto: "Cancelar" }, { texto: "Salvar", classe: "primario", acao: async () => {
      const v = (n) => $(`[name=${n}]`, corpo).value;
      // endereço escolhido nas sugestões do Google: já vem com o ponto exato
      const esc0 = ML.coordsEscolhidas ? ML.coordsEscolhidas($("[name=enderecoObra]", corpo)) : null;
      await rpc("fat_salvar_locacao", { p_registro: l.registro, p_dados: { servico: v("servico"), dataInicio: v("dataInicio"), status: v("status"), emissorId: v("emissorId"), obs: v("obs"),
        local: Object.assign({}, l.local || {}, { nome: v("localNome").trim().toUpperCase(), endereco: v("enderecoObra").trim() }, esc0 ? ML.localDeSugestao(esc0) : {}) } });
      aviso("Locação salva.", "ok");
      const mudouEnd = !esc0 && v("enderecoObra").trim() !== ((l.local || {}).endereco || "");
      await recarregarERender();
      const atual = S.loc.get(l.registro);
      if (ML.localizarLocacao && atual && atual.status === "ativa" && (mudouEnd || !(atual.local && atual.local.lat != null))) {
        ML.localizarLocacao(atual).then((r) => { if (r) render(); });
      }
    } }] });
  }

  // ================================================================ FATURA: detalhe e ações
  // faturas antigas (sem o endereço gravado) usam o local atual da locação
  async function pdfDoc(f) {
    const l = S.loc.get(f.registro);
    return window.MLPdf.gerar(f.enderecoOperacao == null && l && ML.textoOperacao ? Object.assign({}, f, { enderecoOperacao: ML.textoOperacao(l.local) }) : f);
  }
  async function baixarPdf(f) {
    try {
      const doc = await pdfDoc(f);
      doc.save(window.MLPdf.nomeArquivo(f));
    } catch (e) { aviso("Não consegui gerar o PDF: " + msgErro(e), "erro"); }
  }

  async function abrirFatura(f) {
    const d = hoje(), s = C.situacao(f, d), l = S.loc.get(f.registro) || {};
    const r = C.rateio(f, S.nomes);
    const ult = ultimaFatura(f.registro), ehUltima = ult && ult.seq === f.seq;
    const corpo = el(`<div class="det-grade">
      <div class="det-prev"><iframe title="Fatura"></iframe></div>
      <div class="det-lado">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="nfat" style="font-size:22px">${esc(f.id)}</span>${sitBadge(s)}</div>
        <div><b>${esc((f.tomador || {}).razaoSocial)}</b><br><small class="muted">${esc((f.tomador || {}).documento || "")}</small></div>
        ${vg(f.total, "medio")}
        <dl><dt>Emissão</dt><dd>${C.dataBR(f.dataEmissao)}</dd>
          <dt>Período</dt><dd>${f.periodoIni ? C.dataBR(f.periodoIni) + " a " + C.dataBR(f.periodoFim) : "—"}</dd>
          <dt>Vencimento</dt><dd>${C.dataBR(f.vencimento)}</dd>
          ${f.status === "paga" ? `<dt>Pago em</dt><dd>${C.dataBR(f.pagoEm)}</dd>` : ""}
          <dt>Emitida por</dt><dd>${esc(f.emitidoPor || "—")}</dd>
          ${f.alteradoPor ? `<dt>Alterada por</dt><dd>${esc(f.alteradoPor)}</dd>` : ""}
          ${f.obs ? `<dt>Obs.</dt><dd>${esc(f.obs)}</dd>` : ""}</dl>
        <div><div class="muted" style="font-size:12px;margin-bottom:6px">RATEIO ENTRE DONOS · comissão ${C.pctBR(r.comPct)}%</div>
          <div class="rateio-mini">${r.partes.map((p) => `<div><span>${esc(p.nome)}${p.parceiros && p.parceiros.length ? `<small>sublocado de ${esc(p.parceiros.join(", "))}</small>` : ""}${p.custo ? `<small>custo ${C.moeda(p.custo)}</small>` : ""}</span>
            <span class="direita num">${C.moeda(p.bruto)}<small>comissão ${C.moeda(p.comissao)}${p.frete ? " · frete " + C.moeda(p.frete) : ""}</small></span></div>`).join("") || '<div class="muted">Sem itens de locação</div>'}</div>
          ${(() => { const cs = ML.comissaoDaFatura ? ML.comissaoDaFatura(f) : []; return cs.length ? `<div class="com-fatura">${cs.map((l) => `<span class="sit com-${l.status}" title="${esc(l.nome)}">${esc(l.nome.split(" ")[0])}: comissão ${l.status === "pago" ? "paga " + l.datasPagamento.map(C.dataBRc).join(", ") : l.status === "credito" ? "crédito " + C.moeda(-l.saldo) : "a pagar " + C.moeda(l.saldo)}</span>`).join("")}</div>` : ""; })()}
          ${r.semDono ? `<div class="aviso-linha verm" style="margin-top:8px">Há item sem dono definido. Use “Editar” para marcar os donos.</div>` : ""}</div>
        <div class="botoes-col">
          <button class="btn primario" data-a="pdf">${ic("baixar")}Baixar PDF</button>
          <button class="btn" data-a="abrir">${ic("externo")}Abrir / imprimir</button>
          ${s === "aberta" || s === "vencida" ? `<button class="btn verde" data-a="pagar">${ic("check")}Marcar paga</button>` : ""}
          ${f.status !== "emitida" ? `<button class="btn" data-a="reabrir">${ic("relogio")}Voltar p/ em aberto</button>` : ""}
          <button class="btn" data-a="editar">${ic("editar")}Editar</button>
          <button class="btn" data-a="numero">${ic("numero")}Alterar número</button>
          ${ehUltima && l.status === "ativa" ? `<button class="btn" data-a="renovar">${ic("renovar")}Renovar</button><button class="btn" data-a="encerrar">${ic("check")}Encerrar locação</button>` : ""}
          ${f.status !== "cancelada" ? `<button class="btn perigo" data-a="cancelar">${ic("parar")}Cancelar fatura</button>` : ""}
          ${ehUltima ? `<button class="btn perigo" data-a="excluir">${ic("lixo")}Excluir</button>` : ""}
        </div>
      </div></div>`);
    let url = "";
    const m = modal({ titulo: "Fatura " + f.id, corpo, classe: "grande", aoFechar: () => url && URL.revokeObjectURL(url) });
    try {
      const doc = await pdfDoc(f);
      url = URL.createObjectURL(doc.output("blob"));
      $("iframe", corpo).src = url + "#toolbar=0&navpanes=0&view=FitH";
    } catch (e) { $(".det-prev", corpo).innerHTML = `<div class="vazio">Não consegui montar a visualização: ${esc(msgErro(e))}</div>`; }
    corpo.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const a = b.dataset.a;
      try {
        if (a === "pdf") return baixarPdf(f);
        if (a === "abrir") return url && window.open(url, "_blank");
        if (a === "pagar") { if (await marcarPaga(f)) m.fechar(); return; }
        if (a === "reabrir") { await mudarStatus(f, "emitida"); m.fechar(); return; }
        if (a === "editar") { m.fechar(); return ML.abrirEditor({ modo: "editar", registro: f.registro, seq: f.seq }); }
        if (a === "renovar") { m.fechar(); return ML.abrirEditor({ modo: "renovar", registro: f.registro }); }
        if (a === "encerrar") { m.fechar(); return ML.encerrarLocacao(S.loc.get(f.registro)); }
        if (a === "numero") { m.fechar(); return alterarNumero(f); }
        if (a === "cancelar") {
          if (!await confirmar("Cancelar fatura", `A fatura <b>${esc(f.id)}</b> ficará marcada como <b>cancelada</b> (com selo no PDF) e sai dos totais. Ela continua no histórico.`, "Cancelar fatura", true)) return;
          await mudarStatus(f, "cancelada"); m.fechar(); return;
        }
        if (a === "excluir") {
          if (!await confirmar("Excluir fatura", `Excluir de vez a fatura <b>${esc(f.id)}</b>? ${(S.fatsDe.get(f.registro) || []).length === 1 ? "Como é a única da locação, a locação também será removida." : "As anteriores desta locação continuam."}`, "Excluir", true)) return;
          await rpc("fat_excluir", { p_registro: f.registro, p_seq: f.seq });
          aviso("Fatura excluída.", "ok"); m.fechar(); await recarregarERender(); return;
        }
      } catch (er) { aviso(msgErro(er), "erro"); }
    });
  }

  async function mudarStatus(f, status, pagoEm) {
    await rpc("fat_editar", { p_registro: f.registro, p_seq: f.seq, p_fat: { status, pagoEm: pagoEm || "" } });
    aviso(status === "paga" ? `Fatura ${f.id} marcada como paga.` : status === "cancelada" ? `Fatura ${f.id} cancelada.` : `Fatura ${f.id} voltou para em aberto.`, "ok");
    await recarregarERender();
  }
  function marcarPaga(f) {
    return new Promise((ok) => {
      let feito = false;
      const corpo = el(`<div><p style="margin:0 0 12px">Fatura <b>${esc(f.id)}</b> · ${esc((f.tomador || {}).razaoSocial)} · <b>${C.moeda(f.total)}</b></p>
        <label class="campo"><span>Data do pagamento</span><input type="date" value="${hoje()}"></label></div>`);
      modal({ titulo: "Registrar pagamento", corpo, aoFechar: () => ok(feito), botoes: [{ texto: "Voltar" }, { texto: "Marcar como paga", classe: "primario", icone: "check", acao: async () => {
        const dt = $("input", corpo).value;
        if (!dt) throw new Error("Informe a data do pagamento.");
        await mudarStatus(f, "paga", dt); feito = true;
      } }] });
    });
  }

  function alterarNumero(f) {
    const dig = S.cfg.digitosRegistro;
    const usados = new Set(S.faturas.filter((x) => x !== f).map((x) => x.id));
    const lc = S.loc.get(f.registro), siglaF = f.sigla || (f.tomador || {}).sigla || ((lc && S.cli.get(lc.clienteId)) || {}).sigla || "";
    const sug = C.numeroData(siglaF, f.dataEmissao, usados);
    const corpo = el(`<div style="display:flex;flex-direction:column;gap:12px">
      <div class="aviso-linha">Número atual: <b>${esc(f.id)}</b></div>
      <label class="campo"><span>Número da fatura</span><input name="num" maxlength="40" value="${esc(f.id)}" style="text-transform:uppercase">
        ${sug !== f.id ? `<small>Pela data de emissão (${C.dataBR(f.dataEmissao)}): <a href="#" data-sug>${esc(sug)}</a></small>` : ""}</label>
      <details class="avancado"><summary>Avançado: mover para outro registro de locação ou período</summary>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
          <div class="linha-campos c2">
            <label class="campo"><span>Registro da locação</span><input type="number" min="1" name="reg" value="${f.registro}"></label>
            <label class="campo"><span>Período (0 = 1º mês)</span><input type="number" min="0" name="seq" value="${f.seq}"></label></div>
          <div data-escopo hidden style="display:flex;flex-direction:column;gap:8px">
            <label class="check"><input type="radio" name="esc" value="toda" checked> Mudar a locação inteira (todas as ${(S.fatsDe.get(f.registro) || []).length} faturas deste registro)</label>
            <label class="check"><input type="radio" name="esc" value="so"> Mudar só esta fatura</label></div>
          <small class="muted">Faturas com número pela data ou digitado à mão mantêm o número; só mudam de locação/período.</small></div></details>
      <div class="aviso-linha lar" data-prev hidden></div></div>`);
    const atualizar = () => {
      const reg = +$("[name=reg]", corpo).value, seq = +$("[name=seq]", corpo).value, num = $("[name=num]", corpo).value.trim().toUpperCase();
      $("[data-escopo]", corpo).hidden = reg === f.registro;
      const pv = $("[data-prev]", corpo), rep = num && num !== f.id && usados.has(num);
      pv.hidden = !rep; if (rep) pv.innerHTML = `Já existe a fatura <b>${esc(num)}</b>.`;
    };
    corpo.addEventListener("input", atualizar); atualizar();
    corpo.addEventListener("click", (e) => { if (e.target.closest("[data-sug]")) { e.preventDefault(); $("[name=num]", corpo).value = sug; atualizar(); } });
    modal({ titulo: "Alterar número da fatura", corpo, botoes: [{ texto: "Voltar" }, { texto: "Alterar número", classe: "primario", acao: async () => {
      const reg = +$("[name=reg]", corpo).value, seq = +$("[name=seq]", corpo).value, num = $("[name=num]", corpo).value.trim().toUpperCase();
      if (!num) throw new Error("Informe o número da fatura.");
      if (num !== f.id && usados.has(num)) throw new Error(`Já existe a fatura ${num}.`);
      let alvo = { registro: f.registro, seq: f.seq }, msg = [];
      if (reg !== f.registro || seq !== f.seq) {
        const toda = reg !== f.registro && $("[name=esc]:checked", corpo).value === "toda";
        const r = await rpc("fat_alterar_numero", { p_registro: f.registro, p_seq: f.seq, p_novo_reg: reg, p_novo_seq: seq, p_toda: toda });
        alvo = { registro: reg, seq }; msg.push("locação/período alterados");
        if (r && r.fatura && r.fatura.id === num) { aviso(`Fatura ${num}: ${msg.join(", ")}.`, "ok"); return recarregarERender(); }
      }
      if (num !== f.id || msg.length) {
        const d = await rpc("fat_definir_numero", { p_registro: alvo.registro, p_seq: alvo.seq, p_numero: num });
        msg.unshift("número " + (d && d.id || num));
      }
      aviso(msg.length ? `Alterado: ${msg.join(", ")}.` : "Nada foi alterado.", msg.length ? "ok" : undefined);
      await recarregarERender();
    } }] });
  }

  // ================================================================ Excel
  const carregados = {};
  function carregarScript(src) {
    if (!carregados[src]) carregados[src] = new Promise((ok, erro) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => erro(new Error("Não consegui carregar " + src)); document.head.appendChild(s); });
    return carregados[src];
  }
  async function exportarFaturas(lista, titulo, arquivo) {
    if (!lista || !lista.length) return aviso("Nenhuma fatura para exportar com estes filtros.");
    try {
      aviso("Gerando planilha…");
      await carregarScript("vendor/exceljs.min.js");
      await window.MLRel.faturas(lista, { nomes: S.nomes, local: localDaFatura, titulo, sub: `Gerado em ${C.dataBR(hoje())} por ${S.op.nome || S.user.email} · ${lista.length} faturas`, hoje: hoje(), arquivo });
    } catch (e) { aviso(msgErro(e), "erro"); }
  }

  // ================================================================ inicialização
  function iniciar() {
    hidratarIcones(document);
    ligarLogin(); ajustarLogin();
    // edição do local de operação direto na lista (captura: não abre a fatura nem fecha o cartão)
    document.addEventListener("click", (e) => {
      const ed = e.target.closest("[data-local-edit]"), ok = e.target.closest("[data-local-ok]"), x = e.target.closest("[data-local-x]");
      // abre "Local da obra": endereço com sugestões do Google + mapa
      if (ed) { e.stopPropagation(); e.preventDefault(); return ML.definirLocal ? ML.definirLocal(S.loc.get(+ed.dataset.localEdit)) : editarLocalInline(+ed.dataset.localEdit, ed.closest("[data-local-wrap]")); }
      if (ok) { e.stopPropagation(); e.preventDefault(); return salvarLocalInline(+ok.dataset.localOk, ok.closest("[data-local-wrap]")); }
      if (x) { e.stopPropagation(); e.preventDefault(); return render(); }
      if (e.target.closest(".local-edit")) e.stopPropagation();
    }, true);
    window.addEventListener("hashchange", render);
    $("#btn-menu").addEventListener("click", () => $("#lateral").classList.toggle("aberta"));
    $("#btn-atualizar").addEventListener("click", async () => { await recarregarERender(); aviso("Dados atualizados."); });
    const bg = $("#busca-global");
    let tmr;
    bg.addEventListener("input", () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        S.ui.busca = bg.value; S.ui.especial = "";
        if (rotaAtual() !== "locacoes") location.hash = "#/locacoes"; else render();
        setTimeout(() => bg.focus(), 0);
      }, 250);
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); bg.focus(); bg.select(); }
    });
    // ao voltar para a aba depois de um tempo, atualiza (outros operadores podem ter emitido)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && S.op && S.op.ativo && Date.now() - S.carregadoEm > 60000 && !$("#camada-modais").children.length && !$(".editor")) recarregarERender();
    });
    sb.auth.onAuthStateChange((ev, sessao) => {
      if (ev === "PASSWORD_RECOVERY") setTimeout(novaSenhaModal, 300);
      if (ev === "SIGNED_OUT" && S.user) { S.user = null; mostrar("login"); }
    });
    sb.auth.getSession().then(({ data }) => { if (data.session) entrar(data.session); else mostrar("login"); }).catch(() => mostrar("login"));
    // pré-carrega fontes e logotipo do PDF em segundo plano
    setTimeout(() => window.MLPdf.preparar().catch(() => {}), 1500);
  }

  // expõe para os outros arquivos (editor.js, telas.js)
  window.ML = { sb, S, C, $, $$, esc, el, ic, vg, sitBadge, aviso, modal, confirmar, msgErro, rpc, carregar, recarregarERender, render, TELAS,
    hidratarIcones, salvarConfig, ultimaFatura, fatura, nomeCliente, equipLoc, abrirFatura, baixarPdf, exportarFaturas, carregarScript,
    tabelaFaturas, ligarTabelas, renovacoes, localNome, locaisConhecidos, hoje, todos, situacaoEquip, NOME_SIT_EQ, carregarLeaflet, editarLocacao, textoDias, avisoDias, abrirEditor: null };
  document.addEventListener("DOMContentLoaded", () => setTimeout(iniciar, 0));
})();
