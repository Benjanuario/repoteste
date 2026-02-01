// ==================================================
// ANEXO.JS - TODA A LÓGICA DO SISTEMA (ATUALIZADO)
// ==================================================

// Variáveis globais (MANTIDAS PARA COMPATIBILIDADE)
let cropper = null;
let currentImgEl = null;
let currentTab = 'texto'; // Agora será 'ocr' ao invés de 'texto'
let editingMode = false;
let currentAnexoId = null;

// Nova variável para controle de OCR
let ocrResult = null;

// ==================================================
// FUNÇÕES DE SANITIZAÇÃO E SEGURANÇA (APRIMORADAS)
// ==================================================

/**
 * Sanitiza o conteúdo do textarea removendo emojis e scripts
 * APRIMORADO: Preserva fórmulas matemáticas e formatação educacional
 */
function sanitizeTextarea(textarea) {
  if (!textarea || !textarea.value) return;
  
  const original = textarea.value;
  let sanitized = original;
  
  // Remove emojis e caracteres especiais problemáticos
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  sanitized = sanitized.replace(emojiRegex, '');
  
  // Remove scripts maliciosos
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Remove tags HTML perigosas mas permite algumas tags seguras para formatação
  const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'];
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  sanitized = sanitized.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match; // Mantém tags permitidas
    }
    return ''; // Remove tags não permitidas
  });
  
  // Remove marcações de IA (ChatGPT típico)
  sanitized = sanitized.replace(/^(Assistente|ChatGPT|IA|OpenAI|Resposta):\s*/gmi, '');
  sanitized = sanitized.replace(/^(Espero que isso ajude|Isso deve ajudar|Aqui está|Conteúdo gerado):.*$/gmi, '');
  sanitized = sanitized.replace(/^(Lembre-se que|Nota:|Observação:).*$/gmi, '');
  
  // Remove asteriscos usados como marcadores
  sanitized = sanitized.replace(/^\*\s+/gm, '• ');
  
  if (sanitized !== original) {
    const cursorPos = textarea.selectionStart;
    textarea.value = sanitized;
    const newCursorPos = Math.max(0, cursorPos - (original.length - sanitized.length));
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }
}

/**
 * Escapa caracteres HTML para evitar XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Aplica formatação educacional ao texto (para exibição no preview)
 */
function formatarTextoEducacional(texto) {
  if (!texto) return '';
  
  let formatado = escapeHtml(texto);
  
  // Converte quebras de linha em <br> e parágrafos
  formatado = formatado.replace(/\n\n+/g, '</p><p>');
  formatado = formatado.replace(/\n/g, '<br>');
  
  // Adiciona formatação para fórmulas matemáticas simples
  formatado = formatado.replace(/(\$\$)(.*?)\1/g, '<span class="formula">$2</span>');
  formatado = formatado.replace(/(\$)(.*?)\1/g, '<span class="formula-inline">$2</span>');
  
  // Melhora listas
  formatado = formatado.replace(/^•\s+(.*?)(?=<br>|$)/gm, '<li>$1</li>');
  formatado = formatado.replace(/^(\d+\.)\s+(.*?)(?=<br>|$)/gm, '<li value="$1">$2</li>');
  
  // Envolve em parágrafo se necessário
  if (!formatado.startsWith('<p>') && !formatado.startsWith('<li>')) {
    formatado = '<p>' + formatado + '</p>';
  }
  
  return formatado;
}

// ==================================================
// FUNÇÕES DE NAVEGAÇÃO ENTRE TABS (ATUALIZADAS)
// ==================================================

/**
 * Atualiza a tab ativa visualmente
 */
function atualizarTabAtiva(tab) {
  currentTab = tab;
  
  // Remove classe 'ativo' de todos os botões
  const botoes = document.querySelectorAll('.anexo-tab-btn');
  botoes.forEach(btn => btn.classList.remove('ativo'));
  
  // Esconde todos os painéis
  const paineis = ['anexoOcr', 'anexoChatGPT', 'anexoFoto'];
  paineis.forEach(id => {
    const painel = document.getElementById(id);
    if (painel) painel.style.display = 'none';
  });
  
  // Ativa o botão correto
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

/**
 * Mostra o painel de OCR (substitui o antigo de texto)
 */
function mostrarAnexoTexto() {
  atualizarTabAtiva('ocr');
  const painel = document.getElementById('anexoOcr');
  if (painel) {
    painel.style.display = 'block';
    // Foca no textarea se já houver conteúdo
    setTimeout(() => {
      const textarea = painel.querySelector('.anexo-textarea-super');
      if (textarea && textarea.value) textarea.focus();
    }, 100);
  }
}

/**
 * Mostra o painel do ChatGPT
 */
function mostrarAnexoChatGPT() {
  atualizarTabAtiva('chatgpt');
  const painel = document.getElementById('anexoChatGPT');
  if (painel) {
    painel.style.display = 'block';
    // Foca no textarea
    setTimeout(() => {
      const textarea = painel.querySelector('.anexo-textarea-super');
      if (textarea) textarea.focus();
    }, 100);
  }
}

/**
 * Mostra o painel de foto
 */
function mostrarAnexoFoto() {
  atualizarTabAtiva('foto');
  const painel = document.getElementById('anexoFoto');
  if (painel) {
    painel.style.display = 'block';
  }
}

// ==================================================
// FUNÇÕES PRINCIPAIS DA INTERFACE (MANTIDAS)
// ==================================================

/**
 * Abre o painel de anexos
 */
function abrirAnexo() {
  console.log('📂 Abrindo painel de anexos...');
  
  const container = document.getElementById('anexoContainerContent');
  if (!container) {
    console.error('❌ Container não encontrado');
    return;
  }
  
  // Verifica se estamos em modo de edição
  editingMode = window.anexoSalvo !== null;
  
  // Mostra o container
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Esconde o botão "Adicionar Anexo"
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) btnAdd.style.display = 'none';
  
  // Se estiver editando, carrega o conteúdo existente
  if (editingMode && window.anexoSalvo) {
    carregarAnexoExistente();
  } else {
    // Limpa os campos
    limparCamposAnexo();
  }
  
  // Garante que a tab correta está ativa
  setTimeout(() => {
    if (!currentTab) mostrarAnexoTexto();
  }, 50);
}

/**
 * Carrega anexo existente para edição
 */
function carregarAnexoExistente() {
  if (!window.anexoSalvo) return;
  
  const { tipo, data } = window.anexoSalvo;
  
  switch(tipo) {
    case 'texto':
      // Carrega no painel OCR
      mostrarAnexoTexto();
      const textareaOcr = document.querySelector('#anexoOcr .anexo-textarea-super');
      if (textareaOcr) {
        textareaOcr.value = data;
        showToast('📝 Modo edição ativado. Edite o texto conforme necessário.', 'info');
      }
      break;
      
    case 'imagem':
      // Carrega no painel de foto
      mostrarAnexoFoto();
      const preview = document.getElementById('previewFoto');
      if (preview) {
        preview.innerHTML = `
          <div style="position: relative; display: inline-block;">
            <img src="${data}" 
                 style="max-width:100%; max-height:400px; border-radius:8px; box-shadow: var(--sombra);"
                 alt="Foto existente">
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">
              Imagem existente
            </div>
          </div>
        `;
        showToast('🖼️ Modo edição de imagem ativado.', 'info');
      }
      break;
  }
}

/**
 * Fecha o painel de anexos
 */
function fecharAnexo() {
  console.log('📂 Fechando painel de anexos...');
  
  const container = document.getElementById('anexoContainerContent');
  if (!container) return;
  
  container.style.display = 'none';
  
  // Mostra o botão "Adicionar Anexo" se não houver anexo salvo
  if (!window.anexoSalvo) {
    const btnAdd = document.getElementById('btnAdicionarAnexo');
    if (btnAdd) btnAdd.style.display = 'inline-block';
  }
  
  editingMode = false;
}

/**
 * Limpa todos os campos do anexo
 */
function limparCamposAnexo() {
  // Limpa textareas
  const textareas = document.querySelectorAll('.anexo-textarea-super');
  textareas.forEach(ta => ta.value = '');
  
  // Limpa preview de imagem OCR
  const previewOcr = document.getElementById('previewOcr');
  if (previewOcr) {
    previewOcr.innerHTML = `
      <div style="color: var(--cinza-texto);">
        <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;"></i>
        <p style="margin: 0; font-size: 0.95rem;">Carregue uma foto para extrair texto</p>
      </div>
    `;
  }
  
  // Limpa preview de foto
  const previewFoto = document.getElementById('previewFoto');
  if (previewFoto) {
    previewFoto.innerHTML = `
      <div style="color: var(--cinza-texto);">
        <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;"></i>
        <p style="margin: 0; font-size: 0.95rem;">Pré-visualização da imagem</p>
      </div>
    `;
  }
  
  // Esconde controles do cropper
  const cropperControls = document.getElementById('cropperControls');
  if (cropperControls) cropperControls.style.display = 'none';
  
  // Esconde controles OCR
  const ocrControls = document.getElementById('ocrControls');
  if (ocrControls) ocrControls.style.display = 'none';
  
  // Destrói o cropper se existir
  if (cropper) {
    cropper.destroy();
    cropper = null;
    currentImgEl = null;
  }
  
  ocrResult = null;
}

// ==================================================
// FUNÇÕES DO CHATGPT (APRIMORADAS)
// ==================================================

/**
 * Abre o ChatGPT com o prompt copiado AUTOMATICAMENTE
 * MELHORIA: Tenta preencher automaticamente o prompt
 */
async function abrirChatGPT() {
  console.log('🤖 Abrindo ChatGPT com preenchimento automático...');
  
  try {
    // Obtém o tema do formulário
    const form = document.forms['planoForm'];
    let tema = '';
    
    if (form && form.tema) {
      tema = form.tema.value.trim();
    }
    
    if (!tema) {
      tema = 'Tema não definido';
    }
    
    // Cria o prompt otimizado e melhorado
    const prompt = `COMO ESPECIALISTA EM EDUCAÇÃO, GERE UM CONTEÚDO DIDÁTICO SOBRE: "${tema}"

CRITÉRIOS ESTRITOS:
1. FORMATO DE SAÍDA: Apenas conteúdo educacional puro, sem introduções, sem conclusões, sem assinaturas.
2. ESTRUTURA:
   - TÍTULO PRINCIPAL (fonte maior, negrito)
   - CONCEITO CHAVE (explicação objetiva)
   - PONTOS IMPORTANTES (lista com marcadores •)
   - EXEMPLOS PRÁTICOS (2-3 exemplos aplicáveis)
   - ATIVIDADE SUGERIDA (1 sugestão de atividade)
3. RESTRIÇÕES:
   - NÃO use emojis
   - NÃO use asteriscos (*) como marcadores
   - NÃO use expressões como "espero que ajude"
   - NÃO inclua "ChatGPT", "IA" ou "OpenAI"
   - NÃO faça introduções ou conclusões
   - USE português de Portugal ou Moçambique
4. FORMATAÇÃO:
   - Títulos em negrito e tamanho maior
   - Listas com marcadores (•)
   - Parágrafos curtos e objetivos
   - Linguagem clara e acessível

GERE APENAS O CONTEÚDO, SEM COMENTÁRIOS ADICIONAIS.`;

    // Abre o ChatGPT em nova aba
    const chatGPTWindow = window.open('https://chat.openai.com/', '_blank');
    
    // Tenta métodos diferentes para preencher automaticamente
    setTimeout(async () => {
      try {
        // Método 1: Tentar usar a API do navegador para autopreenchimento
        if (navigator.clipboard && window.clipboardData === undefined) {
          await navigator.clipboard.writeText(prompt);
          showToast('📋 Prompt copiado! Cole no ChatGPT.', 'success');
          
          // Dá instruções para colar
          setTimeout(() => {
            if (chatGPTWindow && !chatGPTWindow.closed) {
              try {
                chatGPTWindow.focus();
                // Não podemos injetar diretamente, mas damos instruções
                alert('Cole o prompt (Ctrl+V) na caixa de entrada do ChatGPT.');
              } catch (e) {
                // Ignora erro de cross-origin
              }
            }
          }, 1000);
        }
      } catch (clipboardError) {
        console.warn('⚠️ Não foi possível copiar automaticamente', clipboardError);
        
        // Método 2: Fallback - mostra o prompt para copiar manualmente
        showToast('📋 Copie manualmente o prompt abaixo.', 'warning');
        
        // Mostra o prompt em um modal
        mostrarModalPrompt(prompt);
      }
    }, 2000); // Espera 2 segundos para o ChatGPT carregar
    
  } catch (error) {
    console.error('❌ Erro ao abrir ChatGPT:', error);
    showToast('⚠️ Erro ao abrir ChatGPT. Tente novamente.', 'error');
  }
}

/**
 * Mostra modal com prompt para copiar manualmente
 */
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
        <textarea id="promptText" style="width:100%; height:300px; padding:15px; border:2px solid var(--cinza-borda); border-radius:8px; font-family:monospace; font-size:14px; line-height:1.5; resize:none; margin-bottom:20px;">${prompt}</textarea>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button onclick="copiarPrompt()" style="padding:12px 24px; background:var(--verde-salvar); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:500; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-copy"></i> Copiar Prompt
          </button>
          <button onclick="fecharPromptModal()" style="padding:12px 24px; background:var(--cinza-texto); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:500;">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function copiarPrompt() {
  const textarea = document.getElementById('promptText');
  textarea.select();
  textarea.setSelectionRange(0, 99999);
  
  try {
    navigator.clipboard.writeText(textarea.value);
    showToast('✅ Prompt copiado para área de transferência!', 'success');
  } catch (err) {
    document.execCommand('copy');
    showToast('✅ Prompt copiado!', 'success');
  }
}

function fecharPromptModal() {
  const modal = document.getElementById('promptModal');
  if (modal) modal.remove();
}

// ==================================================
// FUNÇÕES DE OCR INTELIGENTE (NOVO SISTEMA)
// ==================================================

/**
 * Inicializa o sistema OCR
 */
async function initOCR() {
  console.log('🔍 Inicializando sistema OCR...');
  
  // Verifica se Tesseract está disponível
  if (typeof Tesseract === 'undefined') {
    console.warn('⚠️ Tesseract.js não carregado. Usando fallback manual.');
    showToast('⚠️ OCR avançado não disponível. Use extração manual.', 'warning');
    return false;
  }
  
  return true;
}

/**
 * Processa OCR avançado com detecção de fórmulas
 */
async function processarOCRInteligente(imageDataUrl) {
  console.log('🧠 Processando OCR inteligente...');
  
  showToast('🔍 Analisando imagem...', 'info');
  
  try {
    // 1. Primeiro, OCR básico com Tesseract
    const worker = await Tesseract.createWorker('por+eng'); // Português e Inglês
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: '6', // Assume um bloco uniforme de texto
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()[]{}\"\'+-*/=<>$%&@# \n\u03B1\u03B2\u03B3\u03B4\u03B5\u03B6\u03B7\u03B8\u03B9\u03B0\u0391\u0392\u0393\u0394\u0395\u0396\u0397\u0398\u0399' // Inclui letras gregas
    });
    
    const { data: { text, confidence } } = await worker.recognize(imageDataUrl);
    await worker.terminate();
    
    console.log(`📊 Confiança do OCR: ${confidence}%`);
    
    // 2. Pós-processamento inteligente
    let processedText = posProcessarTextoOCR(text, confidence);
    
    // 3. Detectar e marcar fórmulas matemáticas
    processedText = detectarFormulasMatematicas(processedText);
    
    // 4. Filtrar rodapés e cabeçalhos
    processedText = filtrarRodapesCabeçalhos(processedText);
    
    // 5. Estruturar o texto
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
    showToast('❌ Erro no processamento OCR.', 'error');
    throw error;
  }
}

/**
 * Pós-processamento do texto OCR
 */
function posProcessarTextoOCR(texto, confianca) {
  let processado = texto;
  
  // Corrigir erros comuns de OCR
  const correcoes = {
    'O': '0', // Letra O para número 0 (em contextos numéricos)
    'l': '1', // Letra l para número 1
    'I': '1', // Letra I para número 1
    '|': '1', // Pipe para número 1
    'Z': '2', // Letra Z para número 2
    'S': '5', // Letra S para número 5
    'B': '8', // Letra B para número 8
    'rn': 'm', // rn para m
    'vv': 'w', // vv para w
  };
  
  Object.entries(correcoes).forEach(([erro, correcao]) => {
    const regex = new RegExp(erro, 'g');
    processado = processado.replace(regex, correcao);
  });
  
  // Normalizar espaçamento
  processado = processado.replace(/\s+/g, ' ');
  processado = processado.replace(/\n\s*\n/g, '\n\n');
  
  return processado;
}

/**
 * Detecta fórmulas matemáticas no texto
 */
function detectarFormulasMatematicas(texto) {
  let marcado = texto;
  
  // Padrões comuns de fórmulas
  const padroesFormulas = [
    // Frações
    { regex: /(\d+)\/(\d+)/g, substituicao: '$1⁄$2' },
    
    // Expoentes
    { regex: /(\w+)\^(\d+)/g, substituicao: '$1<sup>$2</sup>' },
    
    // Subscritos
    { regex: /(\w+)_(\d+)/g, substituicao: '$1<sub>$2</sub>' },
    
    // Raízes quadradas (aproximação)
    { regex: /sqrt\(([^)]+)\)/g, substituicao: '√($1)' },
    
    // Símbolos matemáticos comuns
    { regex: /!=/g, substituicao: '≠' },
    { regex: /<=/g, substituicao: '≤' },
    { regex: />=/g, substituicao: '≥' },
    { regex: /->/g, substituicao: '→' },
    { regex: /pi/g, substituicao: 'π' },
    
    // Fórmulas químicas
    { regex: /([A-Z][a-z]?)(\d+)/g, substituicao: '$1<sub>$2</sub>' },
    { regex: /H2O/g, substituicao: 'H<sub>2</sub>O' },
    { regex: /CO2/g, substituicao: 'CO<sub>2</sub>' },
    
    // Fórmulas físicas
    { regex: /F\s*=\s*m\s*a/g, substituicao: 'F = m·a' },
    { regex: /E\s*=\s*m\s*c\^2/g, substituicao: 'E = m·c<sup>2</sup>' },
    { regex: /v\s*=\s*d\/t/g, substituicao: 'v = d/t' },
  ];
  
  padroesFormulas.forEach(({ regex, substituicao }) => {
    marcado = marcado.replace(regex, substituicao);
  });
  
  return marcado;
}

/**
 * Filtra rodapés e cabeçalhos
 */
function filtrarRodapesCabeçalhos(texto) {
  const linhas = texto.split('\n');
  const filtradas = [];
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    
    // Ignora linhas muito curtas que provavelmente são números de página
    if (linha.length <= 3 && /^\d+$/.test(linha)) {
      continue;
    }
    
    // Ignora rodapés comuns
    if (linha.toLowerCase().includes('página') || 
        linha.toLowerCase().includes('page') ||
        linha.match(/^\d+\s*\/\s*\d+$/)) {
      continue;
    }
    
    // Ignora cabeçalhos de capítulos repetidos
    if (i > 0 && linhas[i-1] && linha === linhas[i-1].trim()) {
      continue;
    }
    
    filtradas.push(linhas[i]); // Mantém a linha original (com espaços)
  }
  
  return filtradas.join('\n');
}

/**
 * Estrutura o texto para formato educacional
 */
function estruturarTextoEducacional(texto) {
  let estruturado = texto;
  
  // Detecta títulos (linhas curtas e em maiúsculas ou com pontuação forte)
  const linhas = estruturado.split('\n');
  const resultado = [];
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const proximaLinha = linhas[i + 1] || '';
    
    // Se linha é curta e próxima linha começa com letra minúscula, provavelmente é título
    if (linha.length < 60 && 
        proximaLinha.length > 20 && 
        /^[A-ZÀ-Ú0-9]/.test(linha) &&
        !linha.endsWith('.') && 
        !linha.endsWith(',') &&
        !linha.endsWith(';')) {
      resultado.push(`## ${linha}`);
    } else {
      resultado.push(linha);
    }
  }
  
  estruturado = resultado.join('\n');
  
  return estruturado;
}

/**
 * Carrega imagem para OCR
 */
function carregarImagemOCR(event) {
  console.log('📸 Carregando imagem para OCR...');
  
  const file = event.target.files && event.target.files[0];
  if (!file) {
    console.log('❌ Nenhum arquivo selecionado');
    return;
  }
  
  // Validação
  const maxSizeMB = 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    showToast(`⚠️ Imagem muito grande! Máximo: ${maxSizeMB}MB`, 'warning');
    return;
  }
  
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    showToast('⚠️ Formato não suportado! Use JPG, PNG ou WebP.', 'warning');
    return;
  }
  
  // Mostra loading
  const preview = document.getElementById('previewOcr');
  if (preview) {
    preview.innerHTML = `
      <div style="color: var(--azul-principal); text-align: center;">
        <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--azul-principal); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
        <p style="margin: 0; font-size: 0.95rem;">Carregando imagem...</p>
      </div>
    `;
  }
  
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    const imageDataUrl = e.target.result;
    
    // Mostra a imagem carregada
    if (preview) {
      preview.innerHTML = `
        <div style="position: relative; text-align: center;">
          <img src="${imageDataUrl}" 
               style="max-width:100%; max-height:300px; border-radius:8px; box-shadow: var(--sombra);"
               alt="Imagem para OCR">
          <div style="margin-top: 10px; color: var(--cinza-texto); font-size: 0.9rem;">
            <i class="fas fa-sync-alt fa-spin"></i> Processando OCR...
          </div>
        </div>
      `;
    }
    
    // Processa OCR
    try {
      const resultado = await processarOCRInteligente(imageDataUrl);
      
      // Mostra controles OCR
      const ocrControls = document.getElementById('ocrControls');
      if (ocrControls) {
        ocrControls.style.display = 'block';
      }
      
      // Preenche o textarea com o resultado
      const textarea = document.querySelector('#anexoOcr .anexo-textarea-super');
      if (textarea) {
        textarea.value = resultado.textoProcessado;
        showToast(`✅ OCR concluído! Confiança: ${resultado.confianca.toFixed(1)}%`, 'success');
      }
      
      // Atualiza preview com imagem e texto lado a lado
      if (preview) {
        preview.innerHTML = `
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 300px;">
              <h4 style="color: var(--azul-principal); margin-top: 0;">
                <i class="fas fa-image"></i> Imagem Original
              </h4>
              <img src="${imageDataUrl}" 
                   style="max-width:100%; max-height:250px; border-radius:8px; box-shadow: var(--sombra);"
                   alt="Imagem original">
            </div>
            <div style="flex: 2; min-width: 300px;">
              <h4 style="color: var(--azul-principal); margin-top: 0;">
                <i class="fas fa-font"></i> Texto Extraído
                <span style="font-size: 0.8rem; color: ${resultado.confianca > 85 ? 'var(--verde-salvar)' : resultado.confianca > 70 ? 'var(--laranja-chatgpt)' : 'var(--vermelho-remover)'}">
                  (${resultado.confianca.toFixed(1)}% confiança)
                </span>
              </h4>
              <div style="background: var(--branco); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 15px; max-height: 250px; overflow-y: auto; font-size: 0.95rem; line-height: 1.6;">
                ${formatarTextoEducacional(resultado.textoProcessado)}
              </div>
            </div>
          </div>
        `;
      }
      
    } catch (error) {
      console.error('Erro no OCR:', error);
      showToast('❌ Erro no processamento OCR. Tente novamente.', 'error');
      
      // Fallback: mostra apenas a imagem
      if (preview) {
        preview.innerHTML = `
          <div style="text-align: center;">
            <img src="${imageDataUrl}" 
                 style="max-width:100%; max-height:300px; border-radius:8px; box-shadow: var(--sombra);"
                 alt="Imagem carregada">
            <p style="color: var(--vermelho-remover); margin-top: 10px;">
              <i class="fas fa-exclamation-triangle"></i> Erro no OCR. Use a caixa de texto para digitar manualmente.
            </p>
          </div>
        `;
      }
    }
  };
  
  reader.onerror = function() {
    console.error('❌ Erro ao ler arquivo');
    showToast('⚠️ Erro ao ler o arquivo. Tente novamente.', 'error');
  };
  
  reader.readAsDataURL(file);
}

// ==================================================
// FUNÇÕES DE MANIPULAÇÃO DE FOTOS (MANTIDAS)
// ==================================================

/**
 * Carrega uma foto para edição (para a tab de foto)
 */
function carregarFoto(event) {
  console.log('📸 Carregando foto para recorte...');
  
  const file = event.target.files && event.target.files[0];
  if (!file) {
    console.log('❌ Nenhum arquivo selecionado');
    return;
  }
  
  // Validação do arquivo
  const maxSizeMB = 8;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    alert(`⚠️ A imagem é muito grande! Tamanho máximo: ${maxSizeMB}MB`);
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
      <div style="color: var(--azul-principal);">
        <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--azul-principal); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
        <p style="margin: 0; font-size: 0.9rem;">Carregando imagem...</p>
      </div>
    `;
  }
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    console.log('✅ Imagem carregada com sucesso');
    
    if (!preview) {
      alert('Erro: Área de preview não encontrada.');
      return;
    }
    
    // Limpa o preview
    preview.innerHTML = '';
    
    // Cria container para a imagem
    const wrapper = document.createElement('div');
    wrapper.id = 'cropperWrapper';
    wrapper.style.cssText = `
      max-width: 100%;
      max-height: 60vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    preview.appendChild(wrapper);
    
    // Cria a imagem
    const img = document.createElement('img');
    img.id = 'imgCrop';
    img.src = e.target.result;
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
    
    // Inicializa o Cropper quando a imagem carregar
    img.onload = function() {
      console.log('🎨 Inicializando editor de imagem...');
      
      try {
        // Destrói cropper existente
        if (cropper) {
          cropper.destroy();
          cropper = null;
        }
        
        // Verifica se o Cropper está disponível
        if (typeof Cropper === 'undefined') {
          throw new Error('Biblioteca de edição não carregada');
        }
        
        // Cria novo cropper
        cropper = new Cropper(img, {
          viewMode: 1,
          dragMode: 'crop',
          initialAspectRatio: 4/3,
          aspectRatio: null, // Livre
          preview: null,
          responsive: true,
          restore: true,
          checkCrossOrigin: false,
          checkOrientation: true,
          modal: true,
          guides: true,
          center: true,
          highlight: true,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: true,
          autoCropArea: 0.8,
          minCanvasWidth: 100,
          minCanvasHeight: 100,
          minCropBoxWidth: 50,
          minCropBoxHeight: 50,
          ready: function() {
            console.log('✅ Editor de imagem pronto');
          }
        });
        
      } catch (error) {
        console.error('❌ Erro ao inicializar editor:', error);
        alert('⚠️ Não foi possível carregar o editor de imagem. Tente novamente.');
        
        // Mostra a imagem sem cropper
        preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%; max-height:400px; border-radius:8px;">`;
        
        // Esconde controles do cropper
        if (cropperControls) {
          cropperControls.style.display = 'none';
        }
      }
    };
    
    // Tratamento de erro na carga da imagem
    img.onerror = function() {
      console.error('❌ Erro ao carregar imagem');
      alert('⚠️ Erro ao carregar a imagem. Tente novamente.');
      preview.innerHTML = `
        <div style="color: var(--vermelho-remover);">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
          <p>Erro ao carregar imagem</p>
        </div>
      `;
    };
  };
  
  reader.onerror = function() {
    console.error('❌ Erro ao ler arquivo');
    alert('⚠️ Erro ao ler o arquivo. Tente novamente.');
  };
  
  reader.readAsDataURL(file);
}

/**
 * Funções de controle do Cropper
 */
function rotateLeft() {
  if (cropper) {
    cropper.rotate(-90);
    console.log('↪️ Rotacionado -90°');
  }
}

function rotateRight() {
  if (cropper) {
    cropper.rotate(90);
    console.log('↩️ Rotacionado +90°');
  }
}

function zoomIn() {
  if (cropper) {
    cropper.zoom(0.1);
    console.log('➕ Zoom aumentado');
  }
}

function zoomOut() {
  if (cropper) {
    cropper.zoom(-0.1);
    console.log('➖ Zoom reduzido');
  }
}

function resetCropper() {
  if (cropper) {
    cropper.reset();
    console.log('🔄 Cropper resetado');
  }
}

/**
 * Salva o recorte da foto
 */
function salvarFotoPreview() {
  console.log('💾 Salvando recorte...');
  
  if (!cropper) {
    alert('⚠️ Nenhuma imagem carregada para recortar.');
    return;
  }
  
  try {
    // Obtém o canvas recortado
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 1600,
      maxHeight: 1600,
      fillColor: '#fff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    
    if (!canvas) {
      throw new Error('Não foi possível criar o recorte');
    }
    
    // Converte para data URL (JPEG com 85% qualidade)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const preview = document.getElementById('previewFoto');
    
    if (!preview) {
      throw new Error('Área de preview não encontrada');
    }
    
    // Atualiza o preview com a imagem recortada
    preview.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <img src="${dataUrl}" 
             style="max-width:100%; max-height:400px; border-radius:8px; box-shadow: var(--sombra);"
             alt="Foto recortada">
        <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">
          ${Math.round(dataUrl.length / 1024)} KB
        </div>
      </div>
    `;
    
    // Destrói o cropper
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    
    // Esconde controles do cropper
    const cropperControls = document.getElementById('cropperControls');
    if (cropperControls) {
      cropperControls.style.display = 'none';
    }
    
    console.log('✅ Recorte salvo com sucesso');
    showToast('✅ Foto recortada salva!', 'success');
    
  } catch (error) {
    console.error('❌ Erro ao salvar recorte:', error);
    showToast('⚠️ Erro ao salvar o recorte. Tente novamente.', 'error');
  }
}

// ==================================================
// FUNÇÕES DE SALVAR E REMOVER ANEXO (APRIMORADAS)
// ==================================================

/**
 * Salva o anexo no plano (APRIMORADA para permitir edição)
 */
function salvarAnexo() {
  console.log('💾 Salvando anexo...');
  
  const planoPreview = document.getElementById('anexoPreview');
  if (!planoPreview) {
    alert('❌ Erro: Área de preview do plano não encontrada.');
    return;
  }
  
  // Prepara o container do anexo com botão de edição
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
  let dados = '';
  
  // Obtém conteúdo baseado na tab ativa
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
      dados = texto;
      
      // Formatação especial para OCR
      conteudoHTML = `
        <div style="background: var(--branco); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 20px; line-height: 1.7; font-family: inherit; color: #2c3e50;">
          <div style="font-size: 0.9rem; color: var(--cinza-texto); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-font"></i> Texto extraído/editado
          </div>
          <div style="white-space: pre-wrap; max-height: 300px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 6px;">
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
        showToast('⚠️ Cole o conteúdo gerado no ChatGPT antes de salvar.', 'warning');
        return;
      }
      
      tipo = 'texto';
      dados = texto;
      
      // Formatação especial para conteúdo gerado por IA
      conteudoHTML = `
        <div style="background: var(--branco); border: 1px solid var(--cinza-borda); border-radius: 8px; padding: 20px; line-height: 1.7; font-family: inherit; color: #2c3e50;">
          <div style="font-size: 0.9rem; color: var(--cinza-texto); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-robot"></i> Conteúdo gerado por IA
          </div>
          <div style="white-space: pre-wrap; max-height: 300px; overflow-y: auto; padding: 10px; background: #fff8e1; border-radius: 6px; border-left: 4px solid var(--laranja-chatgpt);">
            ${formatarTextoEducacional(texto)}
          </div>
        </div>
      `;
      break;
    }
    
    case 'foto': {
      const painel = document.getElementById('anexoFoto');
      const previewImg = painel ? painel.querySelector('#previewFoto img') : null;
      
      if (!previewImg || !previewImg.src || previewImg.src.includes('data:image/svg')) {
        showToast('⚠️ Selecione e salve uma foto antes de continuar.', 'warning');
        return;
      }
      
      tipo = 'imagem';
      dados = previewImg.src;
      const tamanhoKB = Math.round(previewImg.src.length / 1024);
      
      conteudoHTML = `
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 0.9rem; color: var(--cinza-texto); margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fas fa-image"></i> Imagem anexada
          </div>
          <img src="${previewImg.src}" 
               style="max-width:100%; max-height:350px; border-radius:8px; box-shadow: var(--sombra); object-fit: contain;"
               alt="Anexo de imagem">
          <p style="color: var(--cinza-texto); font-size: 0.9rem; margin-top: 10px;">
            ${tamanhoKB} KB • Clique em "Editar" para substituir
          </p>
        </div>
      `;
      break;
    }
    
    default:
      showToast('⚠️ Selecione um tipo de anexo antes de salvar.', 'warning');
      return;
  }
  
  // Salva globalmente
  window.anexoSalvo = { tipo, data: dados };
  
  // Adiciona conteúdo ao preview
  const anexoContent = planoPreview.querySelector('#anexoContent');
  if (anexoContent) {
    anexoContent.innerHTML = conteudoHTML;
  }
  
  // Garante que o preview está visível
  planoPreview.style.display = 'block';
  
  // Adiciona botão de remover
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
  
  // Adiciona evento ao botão de editar
  const btnEditar = document.getElementById('btnEditarAnexo');
  if (btnEditar) {
    btnEditar.onclick = function() {
      console.log('✏️ Editando anexo...');
      abrirAnexo(); // Reabre o painel com conteúdo existente
    };
  }
  
  // Esconde botão "Adicionar Anexo"
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) btnAdd.style.display = 'none';
  
  // Fecha o painel
  fecharAnexo();
  
  // Atualiza sessionStorage
  atualizarSessionStorage(tipo, dados);
  
  // Feedback ao usuário
  console.log('✅ Anexo salvo com sucesso');
  showToast('✅ Anexo salvo no plano! Clique em "Editar" para modificar.', 'success');
}

/**
 * Atualiza o sessionStorage com os dados do anexo
 */
function atualizarSessionStorage(tipo, dados) {
  try {
    let planoData = {};
    const planoDataJSON = sessionStorage.getItem('planoData');
    
    if (planoDataJSON) {
      planoData = JSON.parse(planoDataJSON);
    }
    
    // Atualiza dados do anexo
    planoData.anexoTipo = tipo;
    
    if (tipo === 'imagem') {
      planoData.anexoImagem = dados;
      planoData.anexoTexto = '';
    } else {
      planoData.anexoTexto = dados;
      planoData.anexoImagem = null;
    }
    
    // Atualiza HTML do plano se disponível
    const planoFinal = document.getElementById('planoFinal');
    if (planoFinal && !planoData.html) {
      planoData.html = planoFinal.innerHTML;
    }
    
    // Salva no sessionStorage
    sessionStorage.setItem('planoData', JSON.stringify(planoData));
    
    console.log('💾 Dados salvos no sessionStorage');
    
  } catch (error) {
    console.warn('⚠️ Erro ao atualizar sessionStorage:', error);
  }
}

/**
 * Remove o anexo do plano
 */
function removerAnexoVisivel() {
  console.log('🗑️ Removendo anexo...');
  
  // Remove do preview
  const planoPreview = document.getElementById('anexoPreview');
  if (planoPreview) {
    planoPreview.style.display = 'none';
  }
  
  // Limpa variável global
  window.anexoSalvo = null;
  
  // Esconde botão de remover
  const btnRemover = document.getElementById('btnRemoverAnexoVisible');
  if (btnRemover) {
    btnRemover.style.display = 'none';
  }
  
  // Mostra botão de adicionar
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) {
    btnAdd.style.display = 'inline-block';
  }
  
  // Fecha o painel se estiver aberto
  const container = document.getElementById('anexoContainerContent');
  if (container) {
    container.style.display = 'none';
  }
  
  // Limpa sessionStorage
  limparSessionStorage();
  
  // Limpa campos
  limparCamposAnexo();
  
  console.log('✅ Anexo removido');
  showToast('🗑️ Anexo removido!', 'info');
}

/**
 * Limpa os dados do anexo do sessionStorage
 */
function limparSessionStorage() {
  try {
    const planoDataJSON = sessionStorage.getItem('planoData');
    if (planoDataJSON) {
      const planoData = JSON.parse(planoDataJSON);
      delete planoData.anexoTipo;
      delete planoData.anexoImagem;
      delete planoData.anexoTexto;
      sessionStorage.setItem('planoData', JSON.stringify(planoData));
      console.log('🗑️ Dados removidos do sessionStorage');
    }
  } catch (error) {
    console.warn('⚠️ Erro ao limpar sessionStorage:', error);
  }
}

// ==================================================
// INICIALIZAÇÃO E EXPORTAÇÃO
// ==================================================

/**
 * Inicializa a interface do anexo
 */
function initAnexoInterface() {
  console.log('🚀 Inicializando interface do anexo...');
  
  // Adiciona event listeners para sanitização
  const textareas = document.querySelectorAll('.anexo-textarea-super');
  textareas.forEach(textarea => {
    textarea.addEventListener('input', function() {
      sanitizeTextarea(this);
    });
  });
  
  // Adiciona efeitos hover aos botões
  const todosBotoes = document.querySelectorAll('.anexo-tab-btn, .btn-foto, .btn-cropper, .btn-acao');
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
  
  // Configura drag and drop para fotos OCR
  const previewOcr = document.getElementById('previewOcr');
  if (previewOcr) {
    previewOcr.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--azul-principal)';
      this.style.background = 'var(--azul-suave)';
    });
    
    previewOcr.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--cinza-borda)';
      this.style.background = 'var(--branco)';
    });
    
    previewOcr.addEventListener('drop', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--cinza-borda)';
      this.style.background = 'var(--branco)';
      
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        const event = { target: { files: files } };
        carregarImagemOCR(event);
      }
    });
  }
  
  // Configura drag and drop para fotos normais
  const previewFoto = document.getElementById('previewFoto');
  if (previewFoto) {
    previewFoto.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--azul-principal)';
      this.style.background = 'var(--azul-suave)';
    });
    
    previewFoto.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--cinza-borda)';
      this.style.background = 'var(--branco)';
    });
    
    previewFoto.addEventListener('drop', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--cinza-borda)';
      this.style.background = 'var(--branco)';
      
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        const event = { target: { files: files } };
        carregarFoto(event);
      }
    });
  }
  
  // Garante que o painel OCR está ativo por padrão
  setTimeout(() => {
    if (!document.querySelector('.anexo-painel[style*="block"]')) {
      mostrarAnexoTexto();
    }
  }, 100);
  
  // Inicializa OCR
  setTimeout(() => {
    initOCR();
  }, 500);
  
  console.log('✅ Interface do anexo inicializada');
}

/**
 * Mostra toast de notificação
 */
function showToast(mensagem, tipo = 'info') {
  const toast = document.createElement('div');
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
    min-width: 300px;
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
// EXPORTAÇÃO PARA ESCOPO GLOBAL (MANTENDO COMPATIBILIDADE)
// ==================================================

// Exporta todas as funções para acesso global (MESMOS NOMES)
window.mostrarAnexoTexto = mostrarAnexoTexto; // Agora mostra OCR
window.mostrarAnexoChatGPT = mostrarAnexoChatGPT;
window.mostrarAnexoFoto = mostrarAnexoFoto;
window.abrirAnexo = abrirAnexo;
window.fecharAnexo = fecharAnexo;
window.abrirChatGPT = abrirChatGPT;
window.carregarFoto = carregarFoto; // Para tab de foto
window.carregarImagemOCR = carregarImagemOCR; // Nova função para OCR
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

// Novas funções exportadas
window.copiarPrompt = copiarPrompt;
window.fecharPromptModal = fecharPromptModal;

// ==================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ==================================================

// Aguarda o DOM estar pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnexoInterface);
} else {
  // DOM já está pronto
  initAnexoInterface();
}

// Adiciona CSS para animações
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
  }
  
  .formula-inline {
    font-family: "Times New Roman", serif;
    font-style: italic;
  }
  
  .fa-spin {
    animation: spin 1s linear infinite;
  }
  
  .tabela-extraida {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
  }
  
  .tabela-extraida th,
  .tabela-extraida td {
    border: 1px solid var(--cinza-borda);
    padding: 8px 12px;
    text-align: left;
  }
  
  .tabela-extraida th {
    background: var(--azul-suave);
    font-weight: 600;
  }
  
  .tabela-extraida tr:nth-child(even) {
    background: #f8f9fa;
  }
`;
document.head.appendChild(style);

console.log('✅ anexo.js carregado com sucesso! Sistema OCR inteligente ativo.');