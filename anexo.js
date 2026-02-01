// ==================================================
// ANEXO.JS - SISTEMA COMPLETO CORRIGIDO
// ==================================================

// Variáveis globais
let cropper = null;
let currentImgEl = null;
let currentTab = 'ocr';
let editingMode = false;
let ocrResult = null;

// ==================================================
// FUNÇÕES DE SANITIZAÇÃO E SEGURANÇA
// ==================================================

function sanitizeTextarea(textarea) {
  if (!textarea || !textarea.value) return;
  
  const original = textarea.value;
  let sanitized = original;
  
  // Remove emojis
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  sanitized = sanitized.replace(emojiRegex, '');
  
  // Remove scripts
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Remove asteriscos de negrito (ChatGPT)
  sanitized = sanitized.replace(/\*\*(.*?)\*\*/g, '$1');
  sanitized = sanitized.replace(/\*(.*?)\*/g, '$1');
  
  // Remove tags perigosas mas permite formatação básica
  const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  sanitized = sanitized.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match;
    }
    return '';
  });
  
  // Remove marcações de IA
  sanitized = sanitized.replace(/^(Assistente|ChatGPT|IA|OpenAI|Resposta|Modelo):\s*/gmi, '');
  sanitized = sanitized.replace(/^(Espero que isso ajude|Isso deve ajudar|Aqui está|Conteúdo gerado|Lembre-se que|Nota:|Observação:|Importante:).*$/gmi, '');
  sanitized = sanitized.replace(/^(\*+\s*)+/gm, '• ');
  
  if (sanitized !== original) {
    const cursorPos = textarea.selectionStart;
    textarea.value = sanitized;
    const newCursorPos = Math.max(0, cursorPos - (original.length - sanitized.length));
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarTextoEducacional(texto) {
  if (!texto) return '';
  
  let formatado = escapeHtml(texto);
  
  // Converte títulos (linhas sem pontuação no final e curtas)
  formatado = formatado.replace(/^(.{1,60})(?=\n|$)/gm, function(match, p1) {
    if (!p1.match(/[.,;:!?]$/) && p1.trim().length > 3) {
      return `<strong style="font-size: 1.1em; display: block; margin-top: 15px; color: var(--azul-principal);">${p1}</strong>`;
    }
    return p1;
  });
  
  // Converte quebras de linha
  formatado = formatado.replace(/\n\n+/g, '</p><p style="margin: 10px 0;">');
  formatado = formatado.replace(/\n/g, '<br>');
  
  // Formata listas
  formatado = formatado.replace(/^•\s+(.*?)(?=<br>|$)/gm, '<li style="margin: 5px 0 5px 20px;">$1</li>');
  formatado = formatado.replace(/^(\d+\.)\s+(.*?)(?=<br>|$)/gm, '<li style="margin: 5px 0 5px 20px;" value="$1">$2</li>');
  
  // Fórmulas matemáticas
  formatado = formatado.replace(/(\$\$)(.*?)\1/g, '<span class="formula">$2</span>');
  formatado = formatado.replace(/(\$)(.*?)\1/g, '<span class="formula-inline">$2</span>');
  
  if (!formatado.startsWith('<p>') && !formatado.startsWith('<li>') && !formatado.startsWith('<strong')) {
    formatado = '<p style="margin: 10px 0;">' + formatado + '</p>';
  }
  
  return formatado;
}

// ==================================================
// FUNÇÕES DE NAVEGAÇÃO
// ==================================================

function atualizarTabAtiva(tab) {
  currentTab = tab;
  
  const botoes = document.querySelectorAll('.anexo-tab-btn');
  botoes.forEach(btn => btn.classList.remove('ativo'));
  
  const paineis = ['anexoOcr', 'anexoChatGPT', 'anexoFoto'];
  paineis.forEach(id => {
    const painel = document.getElementById(id);
    if (painel) painel.style.display = 'none';
  });
  
  let botaoIndex;
  switch(tab) {
    case 'ocr': botaoIndex = 0; break;
    case 'chatgpt': botaoIndex = 1; break;
    case 'foto': botaoIndex = 2; break;
    default: botaoIndex = 0;
  }
  
  if (botoes[botaoIndex]) {
    botoes[botaoIndex].classList.add('ativo');
  }
}

function mostrarAnexoTexto() {
  atualizarTabAtiva('ocr');
  const painel = document.getElementById('anexoOcr');
  if (painel) {
    painel.style.display = 'block';
    setTimeout(() => {
      const textarea = painel.querySelector('.anexo-textarea-super');
      if (textarea && textarea.value) textarea.focus();
    }, 100);
  }
}

function mostrarAnexoChatGPT() {
  atualizarTabAtiva('chatgpt');
  const painel = document.getElementById('anexoChatGPT');
  if (painel) {
    painel.style.display = 'block';
    setTimeout(() => {
      const textarea = painel.querySelector('.anexo-textarea-super');
      if (textarea) textarea.focus();
    }, 100);
  }
}

function mostrarAnexoFoto() {
  atualizarTabAtiva('foto');
  const painel = document.getElementById('anexoFoto');
  if (painel) {
    painel.style.display = 'block';
    // Foca no textarea de descrição se existir
    setTimeout(() => {
      const textarea = painel.querySelector('.descricao-foto');
      if (textarea) textarea.focus();
    }, 100);
  }
}

// ==================================================
// FUNÇÕES PRINCIPAIS
// ==================================================

function abrirAnexo() {
  console.log('📂 Abrindo painel de anexos...');
  
  const container = document.getElementById('anexoContainerContent');
  if (!container) {
    console.error('❌ Container não encontrado');
    return;
  }
  
  editingMode = window.anexoSalvo !== null;
  
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) btnAdd.style.display = 'none';
  
  if (editingMode && window.anexoSalvo) {
    carregarAnexoExistente();
  } else {
    limparCamposAnexo();
  }
  
  setTimeout(() => {
    if (!currentTab) mostrarAnexoTexto();
  }, 50);
}

function carregarAnexoExistente() {
  if (!window.anexoSalvo) return;
  
  const { tipo, data } = window.anexoSalvo;
  
  switch(tipo) {
    case 'texto':
      mostrarAnexoTexto();
      const textareaOcr = document.querySelector('#anexoOcr .anexo-textarea-super');
      if (textareaOcr) {
        textareaOcr.value = data;
        showToast('📝 Modo edição ativado.', 'info');
      }
      break;
      
    case 'imagem':
      mostrarAnexoFoto();
      const preview = document.getElementById('previewFoto');
      if (preview) {
        preview.innerHTML = `
          <div style="position: relative; display: inline-block;">
            <img src="${data}" 
                 style="max-width:100%; max-height:400px; border-radius:8px; box-shadow: var(--sombra);"
                 alt="Foto existente">
          </div>
        `;
        showToast('🖼️ Modo edição ativado.', 'info');
      }
      break;
  }
}

function fecharAnexo() {
  console.log('📂 Fechando painel de anexos...');
  
  const container = document.getElementById('anexoContainerContent');
  if (!container) return;
  
  container.style.display = 'none';
  
  if (!window.anexoSalvo) {
    const btnAdd = document.getElementById('btnAdicionarAnexo');
    if (btnAdd) btnAdd.style.display = 'inline-block';
  }
  
  editingMode = false;
}

function limparCamposAnexo() {
  // Limpa textareas
  const textareas = document.querySelectorAll('.anexo-textarea-super, .descricao-foto');
  textareas.forEach(ta => ta.value = '');
  
  // Limpa previews
  const previews = ['previewOcr', 'previewFoto'];
  previews.forEach(id => {
    const preview = document.getElementById(id);
    if (preview) {
      preview.innerHTML = `
        <div style="color: var(--cinza-texto); text-align: center; padding: 20px;">
          <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;"></i>
          <p style="margin: 0; font-size: 0.95rem;">${id === 'previewOcr' ? 'Carregue uma foto para extrair texto' : 'Pré-visualização da imagem'}</p>
        </div>
      `;
    }
  });
  
  // Esconde controles
  const controles = ['cropperControls', 'ocrControls'];
  controles.forEach(id => {
    const controle = document.getElementById(id);
    if (controle) controle.style.display = 'none';
  });
  
  // Destrói cropper
  if (cropper) {
    cropper.destroy();
    cropper = null;
    currentImgEl = null;
  }
  
  ocrResult = null;
}

// ==================================================
// FUNÇÕES DO CHATGPT (CORRIGIDAS)
// ==================================================

async function abrirChatGPT() {
  console.log('🤖 Abrindo ChatGPT...');
  
  try {
    const form = document.forms['planoForm'];
    let tema = '';
    
    if (form && form.tema) {
      tema = form.tema.value.trim();
    }
    
    if (!tema) {
      tema = 'Tema não definido';
    }
    
    // Prompt melhorado (sem asteriscos para negrito)
    const prompt = `COMO ESPECIALISTA EM EDUCAÇÃO, GERE UM CONTEÚDO DIDÁTICO SOBRE: "${tema}"

CRITÉRIOS ESTRITOS:
1. FORMATO: Apenas conteúdo educacional puro, SEM introduções, SEM conclusões, SEM assinaturas.
2. ESTRUTURA:
   - TÍTULO PRINCIPAL (apenas texto, SEM asteriscos)
   - CONCEITO CHAVE (explicação objetiva)
   - PONTOS IMPORTANTES (lista com marcadores •)
   - EXEMPLOS PRÁTICOS (2-3 exemplos aplicáveis)
   - ATIVIDADE SUGERIDA (1 sugestão simples)
3. RESTRIÇÕES:
   - NÃO use emojis
   - NÃO use asteriscos (*) de qualquer tipo
   - NÃO use expressões como "espero que ajude"
   - NÃO inclua "ChatGPT", "IA" ou "OpenAI"
   - NÃO faça introduções ou conclusões
   - USE português de Portugal ou Moçambique
4. FORMATAÇÃO:
   - NÃO use negrito com asteriscos
   - Listas com marcadores (•) apenas
   - Parágrafos curtos
   - Linguagem clara e acessível

GERE APENAS O CONTEÚDO, SEM COMENTÁRIOS ADICIONAIS.`;

    // Método 1: Tentar copiar para clipboard
    let copied = false;
    try {
      await navigator.clipboard.writeText(prompt);
      copied = true;
      console.log('✅ Prompt copiado para área de transferência');
    } catch (e) {
      console.warn('⚠️ Clipboard API falhou, usando fallback');
    }
    
    // Método 2: Abrir nova janela com tentativa de autopreenchimento
    const chatGPTUrl = 'https://chat.openai.com/';
    const novaJanela = window.open(chatGPTUrl, '_blank');
    
    // Mostrar mensagem amigável
    if (copied) {
      showToast('📋 Prompt copiado! Abrindo ChatGPT...', 'success');
      
      // Espera um pouco e mostra instruções
      setTimeout(() => {
        if (novaJanela && !novaJanela.closed) {
          try {
            // Tenta focar na nova janela
            novaJanela.focus();
            
            // Mostra alerta com instruções
            setTimeout(() => {
              alert('✅ Prompt copiado!\n\n1. Vá para o ChatGPT\n2. Clique na caixa de texto\n3. Cole com Ctrl+V\n4. Pressione Enter');
            }, 1500);
          } catch (e) {
            // Cross-origin, não podemos interagir diretamente
          }
        }
      }, 1000);
    } else {
      // Fallback: mostra modal com prompt
      mostrarModalPrompt(prompt);
    }
    
  } catch (error) {
    console.error('❌ Erro ao abrir ChatGPT:', error);
    showToast('⚠️ Erro ao abrir ChatGPT. Tente novamente.', 'error');
  }
}

function mostrarModalPrompt(prompt) {
  const modalHtml = `
    <div id="promptModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center;">
      <div style="background:white; border-radius:12px; padding:30px; max-width:600px; max-height:80vh; overflow-y:auto; box-shadow:0 10px 40px rgba(0,0,0,0.3);">
        <h3 style="color:var(--azul-principal); margin-top:0; display:flex; align-items:center; gap:10px;">
          <i class="fas fa-robot"></i> Prompt para ChatGPT
        </h3>
        <p style="color:var(--cinza-texto); margin-bottom:20px;">
          Copie este prompt e cole no ChatGPT:
        </p>
        <div style="position: relative;">
          <textarea id="promptText" style="width:100%; height:300px; padding:15px; border:2px solid var(--cinza-borda); border-radius:8px; font-family:monospace; font-size:14px; line-height:1.5; resize:none; margin-bottom:20px;">${prompt}</textarea>
          <button onclick="copiarPromptEAbrir()" style="position:absolute; top:10px; right:10px; padding:8px 15px; background:var(--verde-salvar); color:white; border:none; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:5px; font-size:0.9rem;">
            <i class="fas fa-copy"></i> Copiar & Abrir
          </button>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button onclick="fecharPromptModal()" style="padding:12px 24px; background:var(--cinza-texto); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:500;">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function copiarPromptEAbrir() {
  const textarea = document.getElementById('promptText');
  textarea.select();
  textarea.setSelectionRange(0, 99999);
  
  let copied = false;
  try {
    navigator.clipboard.writeText(textarea.value);
    copied = true;
  } catch (err) {
    document.execCommand('copy');
    copied = true;
  }
  
  if (copied) {
    showToast('✅ Prompt copiado! Abrindo ChatGPT...', 'success');
    
    // Abre ChatGPT em nova janela
    window.open('https://chat.openai.com/', '_blank');
    
    // Fecha o modal após 1 segundo
    setTimeout(() => {
      fecharPromptModal();
    }, 1000);
  }
}

function fecharPromptModal() {
  const modal = document.getElementById('promptModal');
  if (modal) modal.remove();
}

// ==================================================
// FUNÇÕES DE OCR CORRIGIDAS
// ==================================================

async function initOCR() {
  console.log('🔍 Verificando suporte OCR...');
  
  // Verifica se Tesseract está carregado
  if (typeof Tesseract === 'undefined') {
    console.warn('⚠️ Tesseract.js não encontrado');
    
    // Carrega Tesseract dinamicamente se necessário
    return carregarTesseract();
  }
  
  return true;
}

function carregarTesseract() {
  return new Promise((resolve) => {
    console.log('📦 Carregando Tesseract.js...');
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@v3.0.3/dist/tesseract.min.js';
    script.onload = () => {
      console.log('✅ Tesseract.js carregado');
      resolve(true);
    };
    script.onerror = () => {
      console.error('❌ Falha ao carregar Tesseract.js');
      showToast('⚠️ OCR avançado não disponível. Use extração manual.', 'warning');
      resolve(false);
    };
    
    document.head.appendChild(script);
  });
}

async function processarOCRInteligente(imageDataUrl) {
  console.log('🧠 Iniciando OCR...');
  
  // Verifica se Tesseract está disponível
  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract não carregado');
  }
  
  try {
    // Usa worker local para evitar problemas de CORS
    const worker = Tesseract.createWorker({
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v3.0.3/dist/worker.min.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v4.0.3/tesseract-core.wasm.js',
    });
    
    await worker.load();
    await worker.loadLanguage('por');
    await worker.initialize('por');
    
    // Configurações otimizadas para material educativo
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // Assume bloco uniforme
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()[]{}\"\'+-*/=<>$%&@# \n',
      preserve_interword_spaces: '1'
    });
    
    console.log('📸 Processando imagem...');
    const { data: { text, confidence } } = await worker.recognize(imageDataUrl);
    await worker.terminate();
    
    console.log(`📊 Confiança: ${confidence}%`);
    
    // Pós-processamento
    let processedText = posProcessarTextoOCR(text, confidence);
    processedText = detectarFormulasMatematicas(processedText);
    processedText = filtrarRodapesCabeçalhos(processedText);
    processedText = estruturarTextoEducacional(processedText);
    
    ocrResult = {
      textoBruto: text,
      textoProcessado: processedText,
      confianca: confidence,
      imagem: imageDataUrl
    };
    
    return ocrResult;
    
  } catch (error) {
    console.error('❌ Erro no OCR:', error);
    
    // Fallback: tenta OCR mais simples
    return processarOCRFallback(imageDataUrl);
  }
}

async function processarOCRFallback(imageDataUrl) {
  console.log('🔄 Usando fallback OCR...');
  
  try {
    // Cria worker simples
    const worker = await Tesseract.createWorker();
    await worker.loadLanguage('eng+por'); // Inglês e Português
    await worker.initialize('eng+por');
    
    const { data: { text } } = await worker.recognize(imageDataUrl);
    await worker.terminate();
    
    // Processamento básico
    let processedText = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    ocrResult = {
      textoBruto: text,
      textoProcessado: processedText,
      confianca: 50, // Confiança baixa para fallback
      imagem: imageDataUrl
    };
    
    return ocrResult;
    
  } catch (fallbackError) {
    console.error('❌ Fallback também falhou:', fallbackError);
    throw new Error('OCR não disponível. Digite o texto manualmente.');
  }
}

function posProcessarTextoOCR(texto, confianca) {
  let processado = texto;
  
  // Correções comuns
  const correcoes = {
    'rn': 'm',
    'vv': 'w',
    'cl': 'd',
    'O': '0',
    'l': '1',
    'I': '1',
    '|': '1',
    'Z': '2',
    'S': '5',
    'B': '8',
  };
  
  Object.entries(correcoes).forEach(([erro, correcao]) => {
    const regex = new RegExp(erro, 'gi');
    processado = processado.replace(regex, correcao);
  });
  
  // Limpeza
  processado = processado.replace(/\s+/g, ' ');
  processado = processado.replace(/\n\s*\n/g, '\n\n');
  processado = processado.trim();
  
  return processado;
}

function detectarFormulasMatematicas(texto) {
  let marcado = texto;
  
  const padroes = [
    // Frações
    { regex: /(\d+)\s*\/\s*(\d+)/g, substituicao: '$1⁄$2' },
    
    // Expoentes
    { regex: /(\w+)\s*\^\s*(\d+)/g, substituicao: '$1<sup>$2</sup>' },
    
    // Subscritos
    { regex: /(\w+)\s*_\s*(\d+)/g, substituicao: '$1<sub>$2</sub>' },
    
    // Símbolos
    { regex: /!=/g, substituicao: '≠' },
    { regex: /<=/g, substituicao: '≤' },
    { regex: />=/g, substituicao: '≥' },
    { regex: /->/g, substituicao: '→' },
    { regex: /pi/gi, substituicao: 'π' },
    
    // Químicas
    { regex: /H\s*2\s*O/g, substituicao: 'H₂O' },
    { regex: /C\s*O\s*2/g, substituicao: 'CO₂' },
    { regex: /(\w)\s*(\d+)/g, substituicao: '$1<sub>$2</sub>' },
    
    // Físicas
    { regex: /F\s*=\s*m\s*a/g, substituicao: 'F = m·a' },
    { regex: /v\s*=\s*d\s*\/\s*t/g, substituicao: 'v = d/t' },
  ];
  
  padroes.forEach(({ regex, substituicao }) => {
    marcado = marcado.replace(regex, substituicao);
  });
  
  return marcado;
}

function filtrarRodapesCabeçalhos(texto) {
  const linhas = texto.split('\n');
  const filtradas = [];
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    
    // Ignora números de página
    if (linha.length <= 3 && /^\d+$/.test(linha)) {
      continue;
    }
    
    // Ignora rodapés comuns
    if (linha.toLowerCase().includes('página') || 
        linha.toLowerCase().includes('page') ||
        linha.match(/^\d+\s*\/\s*\d+$/)) {
      continue;
    }
    
    filtradas.push(linhas[i]);
  }
  
  return filtradas.join('\n');
}

function estruturarTextoEducacional(texto) {
  const linhas = texto.split('\n');
  const resultado = [];
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const proxima = linhas[i + 1] || '';
    
    // Detecta títulos (linhas curtas sem pontuação)
    if (linha.length > 10 && linha.length < 80 && 
        !linha.match(/[.,;:!?]$/) &&
        proxima.length > 20) {
      resultado.push(linha);
    } else {
      resultado.push(linha);
    }
  }
  
  return resultado.join('\n');
}

function carregarImagemOCR(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validação
  const maxSizeMB = 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    showToast(`⚠️ Imagem muito grande! Máximo: ${maxSizeMB}MB`, 'warning');
    return;
  }
  
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    showToast('⚠️ Formato não suportado! Use JPG, PNG.', 'warning');
    return;
  }
  
  // Mostra loading
  const preview = document.getElementById('previewOcr');
  if (preview) {
    preview.innerHTML = `
      <div style="color: var(--azul-principal); text-align: center; padding: 30px;">
        <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--azul-principal); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
        <p style="margin: 0; font-size: 0.95rem;">Processando imagem...</p>
        <p style="margin: 5px 0 0 0; font-size: 0.8rem; color: var(--cinza-texto);">Isso pode levar alguns segundos</p>
      </div>
    `;
  }
  
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    const imageDataUrl = e.target.result;
    
    try {
      // Processa OCR
      const resultado = await processarOCRInteligente(imageDataUrl);
      
      // Atualiza preview
      if (preview) {
        preview.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 15px;">
            <div style="text-align: center;">
              <h4 style="color: var(--azul-principal); margin: 0 0 10px 0;">
                <i class="fas fa-image"></i> Imagem Original
              </h4>
              <img src="${imageDataUrl}" 
                   style="max-width:100%; max-height:200px; border-radius:8px; box-shadow: var(--sombra);"
                   alt="Imagem carregada">
            </div>
            <div style="text-align: center;">
              <h4 style="color: var(--verde-ocr); margin: 0 0 10px 0;">
                <i class="fas fa-font"></i> Texto Extraído
                <span style="font-size: 0.8rem; color: ${resultado.confianca > 70 ? 'var(--verde-salvar)' : 'var(--laranja-chatgpt)'}; margin-left: 10px;">
                  (${resultado.confianca.toFixed(0)}% confiança)
                </span>
              </h4>
              <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; max-height: 200px; overflow-y: auto; text-align: left; font-size: 0.9rem; line-height: 1.5;">
                ${resultado.textoProcessado.split('\n').slice(0, 10).join('<br>')}
                ${resultado.textoProcessado.split('\n').length > 10 ? '<br>...' : ''}
              </div>
            </div>
          </div>
        `;
      }
      
      // Preenche textarea
      const textarea = document.querySelector('#anexoOcr .anexo-textarea-super');
      if (textarea) {
        textarea.value = resultado.textoProcessado;
        showToast(`✅ OCR concluído! (${resultado.confianca.toFixed(0)}% confiança)`, 'success');
      }
      
      // Mostra controles
      const ocrControls = document.getElementById('ocrControls');
      if (ocrControls) ocrControls.style.display = 'block';
      
    } catch (error) {
      console.error('Erro no OCR:', error);
      
      // Fallback: mostra apenas a imagem
      if (preview) {
        preview.innerHTML = `
          <div style="text-align: center;">
            <h4 style="color: var(--azul-principal); margin: 0 0 15px 0;">
              <i class="fas fa-image"></i> Imagem Carregada
            </h4>
            <img src="${imageDataUrl}" 
                 style="max-width:100%; max-height:300px; border-radius:8px; box-shadow: var(--sombra);"
                 alt="Imagem carregada">
            <p style="color: var(--cinza-texto); margin-top: 15px; font-size: 0.9rem;">
              <i class="fas fa-edit"></i> Digite o texto manualmente na caixa abaixo
            </p>
          </div>
        `;
      }
      
      showToast('ℹ️ Digite o texto manualmente ou tente outra imagem.', 'info');
    }
  };
  
  reader.onerror = function() {
    console.error('❌ Erro ao ler arquivo');
    showToast('⚠️ Erro ao carregar imagem.', 'error');
  };
  
  reader.readAsDataURL(file);
}

// ==================================================
// FUNÇÕES DE FOTO COM TEXTO (CORRIGIDAS)
// ==================================================

function carregarFoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validação
  const maxSizeMB = 8;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    alert(`⚠️ Imagem muito grande! Máximo: ${maxSizeMB}MB`);
    return;
  }
  
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    alert('⚠️ Formato não suportado! Use JPG, PNG ou WebP.');
    return;
  }
  
  // Mostra loading
  const preview = document.getElementById('previewFoto');
  if (preview) {
    preview.innerHTML = `
      <div style="color: var(--azul-principal); text-align: center; padding: 20px;">
        <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--azul-principal); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
        <p style="margin: 0; font-size: 0.9rem;">Carregando imagem...</p>
      </div>
    `;
  }
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const imageDataUrl = e.target.result;
    
    if (!preview) return;
    
    // Limpa e mostra a imagem
    preview.innerHTML = '';
    
    // Cria container para imagem
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      max-width: 100%;
      max-height: 60vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    preview.appendChild(wrapper);
    
    // Cria imagem
    const img = document.createElement('img');
    img.id = 'imgCrop';
    img.src = imageDataUrl;
    img.style.cssText = `
      max-width: 100%;
      max-height: 60vh;
      display: block;
      object-fit: contain;
    `;
    img.alt = 'Imagem para recorte';
    wrapper.appendChild(img);
    currentImgEl = img;
    
    // Mostra controles do cropper
    const cropperControls = document.getElementById('cropperControls');
    if (cropperControls) {
      cropperControls.style.display = 'block';
    }
    
    // Inicializa cropper quando imagem carregar
    img.onload = function() {
      if (typeof Cropper === 'undefined') {
        console.warn('Cropper não carregado');
        return;
      }
      
      try {
        if (cropper) {
          cropper.destroy();
          cropper = null;
        }
        
        cropper = new Cropper(img, {
          viewMode: 1,
          dragMode: 'crop',
          aspectRatio: null,
          autoCropArea: 0.8,
          responsive: true,
          restore: true,
          modal: true,
          guides: true,
          center: true,
          highlight: true,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: true,
          ready: function() {
            console.log('✅ Cropper pronto');
          }
        });
      } catch (error) {
        console.error('❌ Erro no cropper:', error);
        // Continua sem cropper
      }
    };
  };
  
  reader.readAsDataURL(file);
}

// Funções do cropper (mantidas)
function rotateLeft() { if (cropper) cropper.rotate(-90); }
function rotateRight() { if (cropper) cropper.rotate(90); }
function zoomIn() { if (cropper) cropper.zoom(0.1); }
function zoomOut() { if (cropper) cropper.zoom(-0.1); }
function resetCropper() { if (cropper) cropper.reset(); }

function salvarFotoPreview() {
  if (!cropper) {
    showToast('⚠️ Nenhuma imagem carregada.', 'warning');
    return;
  }
  
  try {
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 1600,
      maxHeight: 1600,
      fillColor: '#fff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    
    if (!canvas) {
      throw new Error('Erro ao criar recorte');
    }
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const preview = document.getElementById('previewFoto');
    
    if (!preview) return;
    
    // Atualiza preview mantendo textarea
    preview.innerHTML = '';
    
    // Imagem recortada
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = 'text-align: center; margin-bottom: 20px;';
    imgContainer.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <img src="${dataUrl}" 
             style="max-width:100%; max-height:350px; border-radius:8px; box-shadow: var(--sombra);"
             alt="Foto recortada">
        <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">
          ${Math.round(dataUrl.length / 1024)} KB
        </div>
      </div>
    `;
    preview.appendChild(imgContainer);
    
    // Textarea para descrição
    const descricaoContainer = document.createElement('div');
    descricaoContainer.style.cssText = 'margin-top: 15px;';
    descricaoContainer.innerHTML = `
      <label style="display: block; color: var(--azul-principal); font-weight: 500; margin-bottom: 8px; font-size: 0.95rem;">
        <i class="fas fa-font"></i> Descrição da foto (opcional):
      </label>
      <textarea class="descricao-foto" 
                placeholder="Adicione uma descrição, legenda ou observação sobre esta foto..."
                style="width:100%; min-height:100px; padding:12px; border:2px solid var(--cinza-borda); border-radius:8px; font-family:inherit; font-size:0.95rem; resize:vertical;"></textarea>
    `;
    preview.appendChild(descricaoContainer);
    
    // Destrói cropper
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    
    // Esconde controles
    const cropperControls = document.getElementById('cropperControls');
    if (cropperControls) cropperControls.style.display = 'none';
    
    showToast('✅ Foto recortada salva! Adicione uma descrição se quiser.', 'success');
    
  } catch (error) {
    console.error('❌ Erro ao salvar recorte:', error);
    showToast('⚠️ Erro ao salvar recorte.', 'error');
  }
}

// ==================================================
// FUNÇÕES DE SALVAR ANEXO (ATUALIZADAS)
// ==================================================

function salvarAnexo() {
  const planoPreview = document.getElementById('anexoPreview');
  if (!planoPreview) {
    alert('❌ Área de preview não encontrada.');
    return;
  }
  
  // Prepara container
  planoPreview.innerHTML = `
    <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafd 100%); border-radius: var(--borda-arredondada); padding: 20px; margin-top: 20px; border: 2px solid var(--azul-suave); box-shadow: var(--sombra); position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid var(--azul-suave); padding-bottom: 10px;">
        <h4 style="color: var(--azul-principal); margin: 0; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-paperclip"></i>
          Anexo Incluído
        </h4>
        <button id="btnEditarAnexo" style="background: var(--azul-principal); color: white; border: none; border-radius: 6px; padding: 6px 12px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          <i class="fas fa-edit"></i> Editar
        </button>
      </div>
      <div id="anexoContent" style="margin-bottom: 16px;"></div>
      <div id="anexoControls"></div>
    </div>
  `;
  
  let conteudoHTML = '';
  let tipo = '';
  let dados = {};
  
  switch(currentTab) {
    case 'ocr': {
      const painel = document.getElementById('anexoOcr');
      const textarea = painel ? painel.querySelector('.anexo-textarea-super') : null;
      const texto = textarea ? textarea.value.trim() : '';
      
      if (!texto) {
        showToast('⚠️ Extraia ou digite o texto antes de salvar.', 'warning');
        return;
      }
      
      tipo = 'texto';
      dados = { texto, tipo: 'ocr' };
      
      conteudoHTML = `
        <div style="background: var(--branco); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 20px;">
          <div style="font-size: 0.9rem; color: var(--verde-ocr); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-font"></i> Texto extraído de material
          </div>
          <div style="white-space: pre-wrap; max-height: 300px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 6px; line-height: 1.6;">
            ${formatarTextoEducacional(texto)}
          </div>
        </div>
      `;
      break;
    }
    
    case 'chatgpt': {
      const painel = document.getElementById('anexoChatGPT');
      const textarea = painel ? painel.querySelector('.anexo-textarea-super') : null;
      const texto = textarea ? textarea.value.trim() : '';
      
      if (!texto) {
        showToast('⚠️ Cole o conteúdo gerado antes de salvar.', 'warning');
        return;
      }
      
      tipo = 'texto';
      dados = { texto, tipo: 'chatgpt' };
      
      conteudoHTML = `
        <div style="background: var(--branco); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 20px;">
          <div style="font-size: 0.9rem; color: var(--laranja-chatgpt); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-robot"></i> Conteúdo gerado por IA
          </div>
          <div style="white-space: pre-wrap; max-height: 300px; overflow-y: auto; padding: 10px; background: #fff8e1; border-radius: 6px; line-height: 1.6;">
            ${formatarTextoEducacional(texto)}
          </div>
        </div>
      `;
      break;
    }
    
    case 'foto': {
      const painel = document.getElementById('anexoFoto');
      const previewImg = painel ? painel.querySelector('#previewFoto img') : null;
      const textareaDesc = painel ? painel.querySelector('.descricao-foto') : null;
      const descricao = textareaDesc ? textareaDesc.value.trim() : '';
      
      if (!previewImg || !previewImg.src) {
        showToast('⚠️ Carregue uma foto antes de salvar.', 'warning');
        return;
      }
      
      tipo = 'imagem';
      dados = { imagem: previewImg.src, descricao };
      
      const tamanhoKB = Math.round(previewImg.src.length / 1024);
      
      conteudoHTML = `
        <div style="text-align: center;">
          <div style="font-size: 0.9rem; color: var(--azul-principal); margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fas fa-image"></i> Imagem anexada • ${tamanhoKB} KB
          </div>
          <img src="${previewImg.src}" 
               style="max-width:100%; max-height:350px; border-radius:8px; box-shadow: var(--sombra); object-fit: contain;"
               alt="Anexo de imagem">
          ${descricao ? `
            <div style="margin-top: 20px; text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid var(--azul-principal);">
              <div style="font-size: 0.9rem; color: var(--azul-principal); margin-bottom: 8px; font-weight: 500;">
                <i class="fas fa-comment-alt"></i> Descrição:
              </div>
              <div style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5;">${escapeHtml(descricao).replace(/\n/g, '<br>')}</div>
            </div>
          ` : ''}
        </div>
      `;
      break;
    }
    
    default:
      showToast('⚠️ Selecione um tipo de anexo.', 'warning');
      return;
  }
  
  // Salva globalmente
  window.anexoSalvo = { tipo, data: dados };
  
  // Adiciona conteúdo
  const anexoContent = planoPreview.querySelector('#anexoContent');
  if (anexoContent) {
    anexoContent.innerHTML = conteudoHTML;
  }
  
  // Mostra preview
  planoPreview.style.display = 'block';
  
  // Botão remover
  let btnRemover = document.getElementById('btnRemoverAnexoVisible');
  if (!btnRemover) {
    btnRemover = document.createElement('button');
    btnRemover.id = 'btnRemoverAnexoVisible';
    btnRemover.innerHTML = '<i class="fas fa-trash-alt"></i> Remover Anexo';
    btnRemover.style.cssText = `
      margin-top: 15px; 
      padding: 10px 18px; 
      background: var(--vermelho-remover); 
      color: var(--branco); 
      border: none; 
      border-radius: 8px; 
      cursor: pointer;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: var(--transicao);
    `;
    btnRemover.onmouseover = function() { this.style.transform = 'translateY(-2px)'; };
    btnRemover.onmouseout = function() { this.style.transform = 'translateY(0)'; };
    btnRemover.onclick = removerAnexoVisivel;
    
    const anexoControls = planoPreview.querySelector('#anexoControls');
    if (anexoControls) {
      anexoControls.appendChild(btnRemover);
    }
  } else {
    btnRemover.style.display = 'inline-flex';
  }
  
  // Botão editar
  const btnEditar = document.getElementById('btnEditarAnexo');
  if (btnEditar) {
    btnEditar.onclick = function() {
      abrirAnexo();
    };
  }
  
  // Esconde botão adicionar
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) btnAdd.style.display = 'none';
  
  // Fecha painel
  fecharAnexo();
  
  // Session storage
  atualizarSessionStorage(tipo, dados);
  
  // Feedback
  showToast('✅ Anexo salvo! Clique em "Editar" para modificar.', 'success');
}

function atualizarSessionStorage(tipo, dados) {
  try {
    let planoData = {};
    const planoDataJSON = sessionStorage.getItem('planoData');
    
    if (planoDataJSON) {
      planoData = JSON.parse(planoDataJSON);
    }
    
    planoData.anexoTipo = tipo;
    
    if (tipo === 'imagem') {
      planoData.anexoImagem = dados.imagem;
      planoData.anexoDescricao = dados.descricao || '';
      planoData.anexoTexto = '';
    } else {
      planoData.anexoTexto = dados.texto;
      planoData.anexoImagem = null;
      planoData.anexoDescricao = '';
    }
    
    sessionStorage.setItem('planoData', JSON.stringify(planoData));
    
  } catch (error) {
    console.warn('⚠️ Erro sessionStorage:', error);
  }
}

function removerAnexoVisivel() {
  const planoPreview = document.getElementById('anexoPreview');
  if (planoPreview) {
    planoPreview.style.display = 'none';
  }
  
  window.anexoSalvo = null;
  
  const btnRemover = document.getElementById('btnRemoverAnexoVisible');
  if (btnRemover) {
    btnRemover.style.display = 'none';
  }
  
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) {
    btnAdd.style.display = 'inline-block';
  }
  
  const container = document.getElementById('anexoContainerContent');
  if (container) {
    container.style.display = 'none';
  }
  
  limparSessionStorage();
  limparCamposAnexo();
  
  showToast('🗑️ Anexo removido!', 'info');
}

function limparSessionStorage() {
  try {
    const planoDataJSON = sessionStorage.getItem('planoData');
    if (planoDataJSON) {
      const planoData = JSON.parse(planoDataJSON);
      delete planoData.anexoTipo;
      delete planoData.anexoImagem;
      delete planoData.anexoTexto;
      delete planoData.anexoDescricao;
      sessionStorage.setItem('planoData', JSON.stringify(planoData));
    }
  } catch (error) {
    console.warn('⚠️ Erro ao limpar storage:', error);
  }
}

// ==================================================
// INICIALIZAÇÃO
// ==================================================

function initAnexoInterface() {
  console.log('🚀 Inicializando sistema de anexo...');
  
  // Event listeners para sanitização
  const textareas = document.querySelectorAll('.anexo-textarea-super, .descricao-foto');
  textareas.forEach(textarea => {
    textarea.addEventListener('input', function() {
      sanitizeTextarea(this);
    });
  });
  
  // Hover effects
  const todosBotoes = document.querySelectorAll('.anexo-tab-btn, .btn-ocr, .btn-foto, .btn-cropper, .btn-acao');
  todosBotoes.forEach(btn => {
    btn.addEventListener('mouseenter', function() {
      if (!this.classList.contains('ativo')) {
        this.style.transform = 'translateY(-2px)';
      }
    });
    
    btn.addEventListener('mouseleave', function() {
      if (!this.classList.contains('ativo')) {
        this.style.transform = 'translateY(0)';
      }
    });
  });
  
  // Drag and drop OCR
  const previewOcr = document.getElementById('previewOcr');
  if (previewOcr) {
    setupDragAndDrop(previewOcr, carregarImagemOCR);
  }
  
  // Drag and drop foto
  const previewFoto = document.getElementById('previewFoto');
  if (previewFoto) {
    setupDragAndDrop(previewFoto, carregarFoto);
  }
  
  // Mostra tab OCR por padrão
  setTimeout(() => {
    if (!document.querySelector('.anexo-painel[style*="block"]')) {
      mostrarAnexoTexto();
    }
  }, 100);
  
  console.log('✅ Sistema de anexo inicializado');
}

function setupDragAndDrop(element, callback) {
  element.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.style.borderColor = 'var(--azul-principal)';
    this.style.background = 'var(--azul-suave)';
  });
  
  element.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.style.borderColor = '';
    this.style.background = '';
  });
  
  element.addEventListener('drop', function(e) {
    e.preventDefault();
    this.style.borderColor = '';
    this.style.background = '';
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const event = { target: { files: files } };
      callback(event);
    }
  });
}

function showToast(mensagem, tipo = 'info') {
  // Remove toast existente
  const toastExistente = document.querySelector('.toast-anexo');
  if (toastExistente) {
    toastExistente.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast-anexo';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    box-shadow: var(--sombra-hover);
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 400px;
  `;
  
  const cores = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  
  toast.style.background = cores[tipo] || cores.info;
  
  const icones = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `<i class="fas ${icones[tipo]}"></i> ${mensagem}`;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// ==================================================
// EXPORTAÇÃO
// ==================================================

window.mostrarAnexoTexto = mostrarAnexoTexto;
window.mostrarAnexoChatGPT = mostrarAnexoChatGPT;
window.mostrarAnexoFoto = mostrarAnexoFoto;
window.abrirAnexo = abrirAnexo;
window.fecharAnexo = fecharAnexo;
window.abrirChatGPT = abrirChatGPT;
window.carregarFoto = carregarFoto;
window.carregarImagemOCR = carregarImagemOCR;
window.salvarFotoPreview = salvarFotoPreview;
window.salvarAnexo = salvarAnexo;
window.removerAnexoVisivel = removerAnexoVisivel;
window.sanitizeTextarea = sanitizeTextarea;
window.rotateLeft = rotateLeft;
window.rotateRight = rotateRight;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetCropper = resetCropper;
window.initAnexoInterface = initAnexoInterface;
window.showToast = showToast;
window.copiarPromptEAbrir = copiarPromptEAbrir;
window.fecharPromptModal = fecharPromptModal;

// ==================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ==================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnexoInterface);
} else {
  initAnexoInterface();
}

// CSS para animações
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .formula {
    font-family: "Times New Roman", serif;
    font-style: italic;
    background: #f0f8ff;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #d0e0ff;
    color: #7e57c2;
  }
  
  .formula-inline {
    font-family: "Times New Roman", serif;
    font-style: italic;
  }
  
  sup, sub {
    font-size: 0.8em;
    line-height: 0;
  }
  
  sup {
    vertical-align: super;
  }
  
  sub {
    vertical-align: sub;
  }
`;
document.head.appendChild(style);

console.log('✅ anexo.js carregado!');