// ==================================================
// ANEXO.JS - TODA A LÓGICA DO SISTEMA
// ==================================================

// =============================================
// CONFIGURAÇÕES DA IA (MESMA DO PLANOVIP)
// =============================================
const IA_CONFIG = {
    API_KEY: 'AIzaSyDcFXBuOiwKfNX2J7qKSVdiXt8ngPxDJJ0', // Sua chave
    MODELO: 'gemini-2.5-flash-lite',
    TIMEOUT: 15000,
    MAX_REQUISICOES_POR_MINUTO: 15,
    stats: {
        requisicoesHoje: 0,
        errosHoje: 0,
        fallbacksHoje: 0,
        ultimoReset: new Date().toDateString()
    }
};

// Variáveis globais
let cropper = null;
let currentImgEl = null;
let currentTab = 'texto';
let streamingInterval = null;

// ==================================================
// FUNÇÕES DE SANITIZAÇÃO E SEGURANÇA
// ==================================================

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
  
  // Remove tags HTML perigosas
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|link|meta)[^>]*>/gi, '');
  
  if (sanitized !== original) {
    const cursorPos = textarea.selectionStart;
    textarea.value = sanitized;
    textarea.setSelectionRange(cursorPos - (original.length - sanitized.length), cursorPos - (original.length - sanitized.length));
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

// ==================================================
// FUNÇÕES DE NAVEGAÇÃO ENTRE TABS
// ==================================================

function atualizarTabAtiva(tab) {
  currentTab = tab;
  
  const botoes = document.querySelectorAll('.anexo-tab-btn');
  botoes.forEach(btn => btn.classList.remove('ativo'));
  
  const paineis = ['anexoTexto', 'anexoChatGPT', 'anexoFoto'];
  paineis.forEach(id => {
    const painel = document.getElementById(id);
    if (painel) painel.style.display = 'none';
  });
  
  let botaoIndex;
  switch(tab) {
    case 'texto': botaoIndex = 0; break;
    case 'chatgpt': botaoIndex = 1; break;
    case 'foto': botaoIndex = 2; break;
    default: botaoIndex = 0;
  }
  
  if (botoes[botaoIndex]) {
    botoes[botaoIndex].classList.add('ativo');
  }
}

function mostrarAnexoTexto() {
  atualizarTabAtiva('texto');
  const painel = document.getElementById('anexoTexto');
  if (painel) {
    painel.style.display = 'block';
    setTimeout(() => {
      const textarea = painel.querySelector('.anexo-textarea-super');
      if (textarea) textarea.focus();
    }, 100);
  }
}

function mostrarAnexoChatGPT() {
  atualizarTabAtiva('chatgpt');
  const painel = document.getElementById('anexoChatGPT');
  if (painel) {
    painel.style.display = 'block';
  }
}

function mostrarAnexoFoto() {
  atualizarTabAtiva('foto');
  const painel = document.getElementById('anexoFoto');
  if (painel) {
    painel.style.display = 'block';
  }
}

// ==================================================
// FUNÇÕES PRINCIPAIS DA INTERFACE
// ==================================================

function abrirAnexo() {
  console.log('📂 Abrindo painel de anexos...');
  
  const container = document.getElementById('anexoContainerContent');
  if (!container) {
    console.error('❌ Container não encontrado');
    return;
  }
  
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) btnAdd.style.display = 'none';
  
  limparCamposAnexo();
  
  setTimeout(() => {
    if (!currentTab) mostrarAnexoTexto();
  }, 50);
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
}

function limparCamposAnexo() {
  // Limpar textareas
  const textareas = document.querySelectorAll('.anexo-textarea-super');
  textareas.forEach(ta => ta.value = '');
  
  // Limpar preview de imagem
  const preview = document.getElementById('previewFoto');
  if (preview) {
    preview.innerHTML = `
      <div style="color: var(--gray);">
        <i class="fas fa-image" style="font-size: 2.5rem; margin-bottom: 10px; opacity: 0.5;"></i>
        <p style="margin: 0; font-size: 0.85rem;">Pré-visualização da imagem</p>
      </div>
    `;
  }
  
  // Esconder controles do cropper
  const cropperControls = document.getElementById('cropperControls');
  if (cropperControls) cropperControls.style.display = 'none';
  
  // Destrói o cropper se existir
  if (cropper) {
    cropper.destroy();
    cropper = null;
    currentImgEl = null;
  }
}

// ==================================================
// FUNÇÕES DE GERAÇÃO DE CONTEÚDOS COM IA (STREAMING)
// ==================================================

function gerarConteudosAnexoIA() {
  const form = document.forms['planoForm'];
  if (!form) {
    alert('❌ Formulário principal não encontrado');
    return;
  }
  
  const tema = form.tema?.value?.trim() || '';
  const disciplina = form.disciplina?.value?.trim() || '';
  const classe = form.classe?.value || '';
  
  if (!tema) {
    alert('⚠️ Preencha o tema da aula no formulário principal primeiro.');
    return;
  }

  const btn = event.target.closest('button');
  const originalText = btn.innerHTML;
  
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GERANDO...';
  btn.disabled = true;

  // Limpar streaming anterior
  if (streamingInterval) {
    clearInterval(streamingInterval);
  }

  // Esconder textarea e mostrar container de streaming
  const textarea = document.getElementById('anexoTextareaIA');
  const streamingContainer = document.getElementById('streamingAnexoContainer');
  
  textarea.style.display = 'none';
  streamingContainer.style.display = 'block';
  streamingContainer.innerHTML = `
    <div class="streaming-container">
      <div class="ia-badge">
        <i class="fas fa-robot"></i> IA está gerando conteúdos...
      </div>
      <div id="streamingAnexoText" class="streaming-text"></div>
      <span class="streaming-cursor"></span>
    </div>
  `;

  // Obter os conteúdos da segunda função didáctica (se disponíveis)
  const tabela = document.getElementById('tabelaPlano');
  let conteudosExistentes = '';
  if (tabela) {
    const linhas = tabela.querySelectorAll('tbody tr');
    if (linhas.length >= 2) {
      const celulaConteudo = linhas[1].querySelector('td:nth-child(3)');
      if (celulaConteudo) {
        conteudosExistentes = celulaConteudo.innerText || '';
      }
    }
  }

  const prompt = `Como especialista em educação em Moçambique, desenvolva um texto didáctico detalhado sobre "${tema}" para servir como anexo/quadro mural.

Contexto adicional:
- Disciplina: ${disciplina}
- Classe: ${classe}
- Conteúdos já abordados na aula: ${conteudosExistentes.substring(0, 200)}

O texto deve conter:
1. CONCEITO FUNDAMENTAL: Explicação clara e objectiva do tema
2. PONTOS-CHAVE: Lista dos aspectos mais importantes (use marcadores)
3. EXEMPLOS PRÁTICOS: 2-4 exemplos aplicáveis ao contexto escolar
4. CURIOSIDADES OU APLICAÇÕES: Informações adicionais interessantes

Formato:
- Use parágrafos curtos e linguagem acessível
- Inclua fórmulas matemáticas ou científicas quando aplicável (ex: H₂O, E=mc²)
- Organize o texto de forma didática com títulos em negrito
- Não use emojis, não use introduções como "Claro, aqui está"
- Apenas o conteúdo do anexo, sem texto adicional

IMPORTANTE: O texto deve ser mais desenvolvido que os conteúdos da tabela, servindo como material de apoio para o professor.`;

  // Tentar API Gemini
  fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IA_CONFIG.MODELO}:generateContent?key=${IA_CONFIG.API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    })
  })
  .then(response => {
    if (!response.ok) throw new Error('API falhou');
    return response.json();
  })
  .then(data => {
    const texto = data.candidates[0].content.parts[0].text;
    streamTextoParaAnexo(texto, streamingContainer, textarea, btn, originalText);
  })
  .catch(error => {
    console.log('IA falhou, redirecionando para ChatGPT:', error);
    
    // Fallback: abrir ChatGPT com prompt
    streamingContainer.style.display = 'none';
    textarea.style.display = 'block';
    
    const promptEncoded = encodeURIComponent(prompt);
    window.open(`https://chatgpt.com/?q=${promptEncoded}`, '_blank');
    
    alert('✅ IA temporariamente indisponível. O ChatGPT foi aberto com o prompt pronto!');
    
    btn.innerHTML = originalText;
    btn.disabled = false;
  });
}

function streamTextoParaAnexo(textoCompleto, streamingContainer, textarea, btn, originalText) {
  const streamingTextEl = document.getElementById('streamingAnexoText');
  if (!streamingTextEl) return;
  
  let index = 0;
  const textoLimpo = textoCompleto.replace(/\*\*/g, '').trim();
  
  streamingInterval = setInterval(() => {
    if (index < textoLimpo.length) {
      streamingTextEl.textContent += textoLimpo.charAt(index);
      index++;
    } else {
      clearInterval(streamingInterval);
      streamingInterval = null;
      
      setTimeout(() => {
        textarea.value = textoLimpo;
        textarea.style.display = 'block';
        streamingContainer.style.display = 'none';
        
        btn.innerHTML = originalText;
        btn.disabled = false;
        
        alert('✅ Conteúdos gerados com sucesso!');
      }, 500);
    }
  }, 20);
}

// ==================================================
// FUNÇÕES DE MANIPULAÇÃO DE FOTOS
// ==================================================

function carregarFoto(event) {
  console.log('📸 Carregando foto...');
  
  const file = event.target.files && event.target.files[0];
  if (!file) {
    console.log('❌ Nenhum arquivo selecionado');
    return;
  }
  
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
  
  const preview = document.getElementById('previewFoto');
  if (preview) {
    preview.innerHTML = `
      <div style="color: var(--primary);">
        <div class="spinner" style="width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
        <p style="margin: 0; font-size: 0.85rem;">Carregando imagem...</p>
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
    
    preview.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.id = 'cropperWrapper';
    wrapper.style.cssText = `
      max-width: 100%;
      max-height: 50vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    preview.appendChild(wrapper);
    
    const img = document.createElement('img');
    img.id = 'imgCrop';
    img.src = e.target.result;
    img.style.cssText = `
      max-width: 100%;
      max-height: 50vh;
      display: block;
      object-fit: contain;
    `;
    img.alt = 'Imagem para recorte';
    wrapper.appendChild(img);
    currentImgEl = img;
    
    const cropperControls = document.getElementById('cropperControls');
    if (cropperControls) {
      cropperControls.style.display = 'block';
    }
    
    img.onload = function() {
      console.log('🎨 Inicializando editor de imagem...');
      
      try {
        if (cropper) {
          cropper.destroy();
          cropper = null;
        }
        
        if (typeof Cropper === 'undefined') {
          throw new Error('Biblioteca de edição não carregada');
        }
        
        cropper = new Cropper(img, {
          viewMode: 1,
          dragMode: 'crop',
          initialAspectRatio: 4/3,
          aspectRatio: null,
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
          minCropBoxHeight: 50
        });
        
      } catch (error) {
        console.error('❌ Erro ao inicializar editor:', error);
        alert('⚠️ Não foi possível carregar o editor de imagem.');
        
        preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%; max-height:300px; border-radius:8px;">`;
        
        if (cropperControls) {
          cropperControls.style.display = 'none';
        }
      }
    };
    
    img.onerror = function() {
      console.error('❌ Erro ao carregar imagem');
      alert('⚠️ Erro ao carregar a imagem.');
      preview.innerHTML = `
        <div style="color: var(--vermelho-remover);">
          <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem;"></i>
          <p>Erro ao carregar imagem</p>
        </div>
      `;
    };
  };
  
  reader.onerror = function() {
    console.error('❌ Erro ao ler arquivo');
    alert('⚠️ Erro ao ler o arquivo.');
  };
  
  reader.readAsDataURL(file);
}

function rotateLeft() {
  if (cropper) cropper.rotate(-90);
}

function rotateRight() {
  if (cropper) cropper.rotate(90);
}

function zoomIn() {
  if (cropper) cropper.zoom(0.1);
}

function zoomOut() {
  if (cropper) cropper.zoom(-0.1);
}

function resetCropper() {
  if (cropper) cropper.reset();
}

function salvarFotoPreview() {
  console.log('💾 Salvando recorte...');
  
  if (!cropper) {
    alert('⚠️ Nenhuma imagem carregada para recortar.');
    return;
  }
  
  try {
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 1200,
      maxHeight: 1200,
      fillColor: '#fff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    
    if (!canvas) {
      throw new Error('Não foi possível criar o recorte');
    }
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const preview = document.getElementById('previewFoto');
    
    if (!preview) {
      throw new Error('Área de preview não encontrada');
    }
    
    preview.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <img src="${dataUrl}" 
             style="max-width:100%; max-height:300px; border-radius:8px; box-shadow: var(--shadow);"
             alt="Foto recortada">
        <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">
          ${Math.round(dataUrl.length / 1024)} KB
        </div>
      </div>
    `;
    
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    
    const cropperControls = document.getElementById('cropperControls');
    if (cropperControls) {
      cropperControls.style.display = 'none';
    }
    
    console.log('✅ Recorte salvo com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao salvar recorte:', error);
    alert('⚠️ Erro ao salvar o recorte.');
  }
}

// ==================================================
// FUNÇÕES DE SALVAR E REMOVER ANEXO
// ==================================================

function salvarAnexo() {
  console.log('💾 Salvando anexo...');
  
  const planoPreview = document.getElementById('anexoPreview');
  if (!planoPreview) {
    alert('❌ Erro: Área de preview do plano não encontrada.');
    return;
  }
  
  planoPreview.innerHTML = `
    <div style="background: var(--card-bg); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; margin-top: 20px; box-shadow: var(--shadow);">
      <h4 style="color: var(--light); margin: 0 0 16px 0; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
        <i class="fas fa-paperclip" style="color: var(--accent);"></i>
        ANEXO INCLUÍDO
      </h4>
      <div id="anexoContent" style="margin-bottom: 16px; color: var(--light);"></div>
      <div id="anexoControls"></div>
    </div>
  `;
  
  let conteudoHTML = '';
  let tipo = '';
  let dados = '';
  
  switch(currentTab) {
    case 'texto': {
      const painel = document.getElementById('anexoTexto');
      const textarea = painel ? painel.querySelector('.anexo-textarea-super') : null;
      const texto = textarea ? textarea.value.trim() : '';
      
      if (!texto) {
        alert('⚠️ Digite o texto do anexo antes de salvar.');
        return;
      }
      
      tipo = 'texto';
      dados = texto;
      conteudoHTML = `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; line-height: 1.7; white-space: pre-wrap; color: var(--light);">
          ${escapeHtml(texto).replace(/\n/g, '<br>')}
        </div>
      `;
      break;
    }
    
    case 'chatgpt': {
      const textarea = document.getElementById('anexoTextareaIA');
      const texto = textarea ? textarea.value.trim() : '';
      
      if (!texto) {
        alert('⚠️ Gere ou cole o conteúdo antes de salvar.');
        return;
      }
      
      tipo = 'texto';
      dados = texto;
      conteudoHTML = `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; line-height: 1.7; white-space: pre-wrap; color: var(--light);">
          ${escapeHtml(texto).replace(/\n/g, '<br>')}
        </div>
      `;
      break;
    }
    
    case 'foto': {
      const painel = document.getElementById('anexoFoto');
      const previewImg = painel ? painel.querySelector('#previewFoto img') : null;
      
      if (!previewImg || !previewImg.src || previewImg.src.includes('data:image/svg')) {
        alert('⚠️ Selecione e aplique o recorte em uma foto antes de continuar.');
        return;
      }
      
      tipo = 'imagem';
      dados = previewImg.src;
      const tamanhoKB = Math.round(previewImg.src.length / 1024);
      
      conteudoHTML = `
        <div style="text-align: center; padding: 10px;">
          <img src="${previewImg.src}" 
               style="max-width:100%; max-height:300px; border-radius:8px; box-shadow: var(--shadow); object-fit: contain;"
               alt="Anexo de imagem">
          <p style="color: var(--gray); font-size: 0.8rem; margin-top: 8px;">
            <i class="fas fa-image"></i> Imagem • ${tamanhoKB} KB
          </p>
        </div>
      `;
      break;
    }
    
    default:
      alert('⚠️ Selecione um tipo de anexo antes de salvar.');
      return;
  }
  
  window.anexoSalvo = { tipo, data: dados };
  
  const anexoContent = planoPreview.querySelector('#anexoContent');
  if (anexoContent) {
    anexoContent.innerHTML = conteudoHTML;
  }
  
  planoPreview.style.display = 'block';
  
  let btnRemover = document.getElementById('btnRemoverAnexoVisible');
  if (!btnRemover) {
    btnRemover = document.createElement('button');
    btnRemover.id = 'btnRemoverAnexoVisible';
    btnRemover.innerHTML = '<i class="fas fa-trash-alt"></i> REMOVER ANEXO';
    btnRemover.style.cssText = `
      margin-top: 15px;
      padding: 10px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: var(--transition);
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
  
  const btnAdd = document.getElementById('btnAdicionarAnexo');
  if (btnAdd) btnAdd.style.display = 'none';
  
  fecharAnexo();
  atualizarSessionStorage(tipo, dados);
  
  console.log('✅ Anexo salvo com sucesso');
  alert('✅ Anexo salvo no plano!');
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
      planoData.anexoImagem = dados;
      planoData.anexoTexto = '';
    } else {
      planoData.anexoTexto = dados;
      planoData.anexoImagem = null;
    }
    
    const planoFinal = document.getElementById('planoFinal');
    if (planoFinal && !planoData.html) {
      planoData.html = planoFinal.innerHTML;
    }
    
    sessionStorage.setItem('planoData', JSON.stringify(planoData));
    console.log('💾 Dados salvos no sessionStorage');
    
  } catch (error) {
    console.warn('⚠️ Erro ao atualizar sessionStorage:', error);
  }
}

function removerAnexoVisivel() {
  console.log('🗑️ Removendo anexo...');
  
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
  
  console.log('✅ Anexo removido');
  alert('🗑️ Anexo removido!');
}

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
// FUNÇÕES DO CHATGPT (FALLBACK)
// ==================================================

function abrirChatGPT() {
  console.log('Abrindo ChatGPT como fallback...');
  
  try {
    const form = document.forms['planoForm'];
    let tema = '';
    
    if (form && form.tema) {
      tema = form.tema.value.trim();
    }
    
    if (!tema) {
      tema = 'Tema não definido';
    }
    
    const prompt = `Como especialista em educação, desenvolva um texto didáctico sobre "${tema}" com:
- Conceito fundamental
- Pontos-chave
- Exemplos práticos
- Curiosidades

Use linguagem acessível, parágrafos curtos. Não use emojis.`;
    
    const promptEncoded = encodeURIComponent(prompt);
    window.open(`https://chatgpt.com/?q=${promptEncoded}`, '_blank');
    
    alert('✅ ChatGPT aberto com o prompt pronto!');
    
  } catch (error) {
    console.error('❌ Erro ao abrir ChatGPT:', error);
    window.open('https://chat.openai.com/', '_blank');
  }
}

// ==================================================
// INICIALIZAÇÃO E EXPORTAÇÃO
// ==================================================

function initAnexoInterface() {
  console.log('🚀 Inicializando interface do anexo...');
  
  const textareas = document.querySelectorAll('.anexo-textarea-super');
  textareas.forEach(textarea => {
    textarea.addEventListener('input', function() {
      sanitizeTextarea(this);
    });
  });
  
  const previewFoto = document.getElementById('previewFoto');
  if (previewFoto) {
    previewFoto.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--primary)';
      this.style.background = 'rgba(10, 95, 42, 0.05)';
    });
    
    previewFoto.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      this.style.background = 'rgba(0, 0, 0, 0.2)';
    });
    
    previewFoto.addEventListener('drop', function(e) {
      e.preventDefault();
      this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      this.style.background = 'rgba(0, 0, 0, 0.2)';
      
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        const event = { target: { files: files } };
        carregarFoto(event);
      }
    });
  }
  
  setTimeout(() => {
    if (!document.querySelector('.anexo-painel[style*="block"]')) {
      mostrarAnexoTexto();
    }
  }, 100);
  
  console.log('✅ Interface do anexo inicializada');
}

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// ==================================================
// EXPORTAÇÃO PARA ESCOPO GLOBAL
// ==================================================

window.mostrarAnexoTexto = mostrarAnexoTexto;
window.mostrarAnexoChatGPT = mostrarAnexoChatGPT;
window.mostrarAnexoFoto = mostrarAnexoFoto;
window.abrirAnexo = abrirAnexo;
window.fecharAnexo = fecharAnexo;
window.gerarConteudosAnexoIA = gerarConteudosAnexoIA;
window.abrirChatGPT = abrirChatGPT;
window.carregarFoto = carregarFoto;
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

// ==================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ==================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnexoInterface);
} else {
  initAnexoInterface();
}

console.log('✅ anexo.js carregado com sucesso!');