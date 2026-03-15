// ==================================================
// ANEXO.JS - SISTEMA DE ANEXOS PARA PLANOVIP.HTML
// VERSÃO CORRIGIDA - COMUNICAÇÃO COM MODAL
// ==================================================

// =============================================
// CONFIGURAÇÕES
// =============================================
const CONFIG = {
    MAX_IMAGE_SIZE: 8 * 1024 * 1024, // 8MB
    MAX_TEXT_LENGTH: 5000,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    IA_API_KEY: 'AIzaSyDcFXBuOiwKfNX2J7qKSVdiXt8ngPxDJJ0',
    IA_MODEL: 'gemini-2.5-flash-lite',
    IA_TIMEOUT: 15000
};

// =============================================
// VARIÁVEIS GLOBAIS
// =============================================
let cropper = null;
let imagemAtual = null;
let abaAtiva = 'texto';
let streamingInterval = null;

// =============================================
// FUNÇÕES DE NAVEGAÇÃO ENTRE ABAS (3 TIPOS)
// =============================================
function mudarAba(aba) {
    console.log('📌 Mudando para aba:', aba);
    
    // Atualizar variável
    abaAtiva = aba;
    
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === aba) {
            btn.classList.add('active');
        }
    });
    
    // Atualizar painéis
    const painelTexto = document.getElementById('painelTexto');
    const painelChatGPT = document.getElementById('painelChatGPT');
    const painelFoto = document.getElementById('painelFoto');
    
    if (painelTexto) painelTexto.classList.remove('active');
    if (painelChatGPT) painelChatGPT.classList.remove('active');
    if (painelFoto) painelFoto.classList.remove('active');
    
    if (aba === 'texto' && painelTexto) painelTexto.classList.add('active');
    else if (aba === 'chatgpt' && painelChatGPT) painelChatGPT.classList.add('active');
    else if (aba === 'foto' && painelFoto) painelFoto.classList.add('active');
    
    // Limpar streaming se necessário
    if (aba !== 'chatgpt' && streamingInterval) {
        clearInterval(streamingInterval);
        streamingInterval = null;
    }
}

// =============================================
// FUNÇÕES DE TEXTO
// =============================================
function sanitizarTexto(texto) {
    if (!texto) return '';
    
    // Remover scripts e tags perigosas
    let sanitizado = texto
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<\/?(iframe|object|embed|link|meta)[^>]*>/gi, '')
        .replace(/[<>]/g, ''); // Remover tags HTML simples
    
    // Limitar tamanho
    if (sanitizado.length > CONFIG.MAX_TEXT_LENGTH) {
        sanitizado = sanitizado.substring(0, CONFIG.MAX_TEXT_LENGTH);
    }
    
    return sanitizado;
}

// =============================================
// FUNÇÕES DE IA (GEMINI) + FALLBACK CHATGPT
// =============================================
function gerarConteudoIA() {
    console.log('🤖 Gerando conteúdo com IA...');
    
    // Obter dados do formulário principal
    const form = document.forms['planoForm'];
    if (!form) {
        alert('❌ Formulário principal não encontrado!');
        return;
    }
    
    const tema = form.tema?.value?.trim() || '';
    const disciplina = form.disciplina?.value?.trim() || '';
    const classe = form.classe?.value || '';
    
    if (!tema) {
        alert('⚠️ Preencha o TEMA da aula no formulário principal primeiro!');
        return;
    }
    
    // Desabilitar botão
    const btn = event.target;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> GERANDO...';
    btn.disabled = true;
    
    // Limpar streaming anterior
    if (streamingInterval) {
        clearInterval(streamingInterval);
        streamingInterval = null;
    }
    
    // Esconder textarea e mostrar streaming
    const textarea = document.getElementById('textoIA');
    const streamingContainer = document.getElementById('streamingContainer');
    const streamingTexto = document.getElementById('streamingTexto');
    
    if (!textarea || !streamingContainer || !streamingTexto) {
        alert('❌ Elementos não encontrados!');
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        return;
    }
    
    textarea.style.display = 'none';
    streamingContainer.style.display = 'block';
    streamingTexto.textContent = '';
    
    // Obter conteúdos da tabela (se existirem)
    let conteudosExistentes = '';
    const tabela = document.getElementById('tabelaPlano');
    if (tabela) {
        const linhas = tabela.querySelectorAll('tbody tr');
        if (linhas.length >= 2) {
            const celulaConteudo = linhas[1].querySelector('td:nth-child(3)');
            if (celulaConteudo) {
                conteudosExistentes = celulaConteudo.innerText || '';
            }
        }
    }
    
    // Construir prompt
    const prompt = `Como especialista em educação em Moçambique, desenvolva um texto didático detalhado sobre "${tema}" para servir como anexo/quadro mural.

Contexto:
- Disciplina: ${disciplina}
- Classe: ${classe}
- Conteúdos já abordados: ${conteudosExistentes.substring(0, 200)}

O texto deve conter:
1. CONCEITO FUNDAMENTAL: Explicação clara e objetiva do tema
2. PONTOS-CHAVE: Lista dos aspectos mais importantes (use marcadores)
3. EXEMPLOS PRÁTICOS: 2-4 exemplos aplicáveis
4. CURIOSIDADES OU APLICAÇÕES: Informações adicionais

Formato:
- Use parágrafos curtos e linguagem acessível
- Organize com títulos em negrito
- Apenas o conteúdo, sem introduções

IMPORTANTE: Responda APENAS o conteúdo do anexo, sem texto adicional.`;

    // Tentar API Gemini
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.IA_MODEL}:generateContent?key=${CONFIG.IA_API_KEY}`, {
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
        streamarTexto(texto, streamingContainer, streamingTexto, textarea, btn, textoOriginal);
    })
    .catch(error => {
        console.error('Erro na IA:', error);
        
        // FALLBACK: Abrir ChatGPT automaticamente
        streamingContainer.style.display = 'none';
        textarea.style.display = 'block';
        
        // Abrir ChatGPT com o prompt
        abrirChatGPTComPrompt(prompt);
        
        // Restaurar botão
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        
        alert('⚠️ IA temporariamente indisponível. O ChatGPT foi aberto com o prompt!\n\nCole o resultado no campo abaixo.');
    });
}

// Função para abrir ChatGPT com prompt via URL parameter
function abrirChatGPTComPrompt(prompt) {
    const promptEncoded = encodeURIComponent(prompt);
    const chatUrl = `https://chatgpt.com/?q=${promptEncoded}`;
    window.open(chatUrl, '_blank');
}

// Função para abrir ChatGPT (chamada manual)
function abrirChatGPT() {
    const form = document.forms['planoForm'];
    const tema = form?.tema?.value?.trim() || 'Tema da aula';
    const disciplina = form?.disciplina?.value?.trim() || '';
    
    const prompt = `Como especialista em educação, desenvolva um resumo didáctico sobre "${tema}" com os seguintes elementos:

1. CONCEITO PRINCIPAL: Explique de forma clara e objectiva
2. PONTOS-CHAVE: Liste os aspectos mais importantes (use marcadores)
3. EXEMPLOS PRÁTICOS: Dê 2-3 exemplos aplicáveis ao contexto escolar (se aplicável)
4. DICA: use português de Portugal ou Moçambique.

Formato: Use parágrafos curtos, linguagem acessível e evite jargões excessivos.
Restrição: Não use emojis, não use palavras ou frases em negrito.`;
    
    abrirChatGPTComPrompt(prompt);
}

function streamarTexto(textoCompleto, container, elemento, textarea, btn, textoOriginal) {
    let index = 0;
    const textoLimpo = textoCompleto.replace(/\*\*/g, '').trim();
    
    streamingInterval = setInterval(() => {
        if (index < textoLimpo.length) {
            elemento.textContent += textoLimpo.charAt(index);
            index++;
        } else {
            clearInterval(streamingInterval);
            streamingInterval = null;
            
            setTimeout(() => {
                textarea.value = textoLimpo;
                textarea.style.display = 'block';
                container.style.display = 'none';
                
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                
                alert('✅ Conteúdo gerado com sucesso!');
            }, 500);
        }
    }, 20);
}

// =============================================
// FUNÇÕES DE FOTO
// =============================================
function abrirCamera() {
    document.getElementById('inputCamera').click();
}

function abrirGaleria() {
    document.getElementById('inputGaleria').click();
}

function carregarFoto(input) {
    const file = input.files?.[0];
    if (!file) return;
    
    // Validar tipo
    if (!CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert('⚠️ Formato não suportado! Use JPG, PNG, GIF ou WebP.');
        return;
    }
    
    // Validar tamanho
    if (file.size > CONFIG.MAX_IMAGE_SIZE) {
        alert(`⚠️ Imagem muito grande! Máximo ${CONFIG.MAX_IMAGE_SIZE / (1024*1024)}MB.`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('previewFoto');
        preview.innerHTML = `<img src="${e.target.result}" id="imgCrop" style="max-width:100%; max-height:300px; border-radius:8px;">`;
        
        const img = document.getElementById('imgCrop');
        imagemAtual = e.target.result;
        
        // Mostrar controles do cropper
        document.getElementById('cropperControls').style.display = 'block';
        
        // Inicializar cropper
        setTimeout(() => {
            if (cropper) cropper.destroy();
            
            if (typeof Cropper !== 'undefined') {
                cropper = new Cropper(img, {
                    viewMode: 1,
                    dragMode: 'crop',
                    aspectRatio: NaN,
                    autoCropArea: 0.8,
                    restore: true,
                    guides: true,
                    center: true,
                    cropBoxMovable: true,
                    cropBoxResizable: true
                });
            } else {
                console.error('Cropper não carregado');
                alert('⚠️ Editor de imagem não disponível');
            }
        }, 100);
    };
    reader.readAsDataURL(file);
}

function rotacionarEsquerda() {
    if (cropper) cropper.rotate(-90);
}

function rotacionarDireita() {
    if (cropper) cropper.rotate(90);
}

function zoomMais() {
    if (cropper) cropper.zoom(0.1);
}

function zoomMenos() {
    if (cropper) cropper.zoom(-0.1);
}

function resetarCropper() {
    if (cropper) cropper.reset();
}

function aplicarCorte() {
    if (!cropper) {
        alert('⚠️ Nenhuma imagem carregada!');
        return;
    }
    
    const canvas = cropper.getCroppedCanvas({
        maxWidth: 800,
        maxHeight: 800,
        fillColor: '#fff'
    });
    
    if (!canvas) return;
    
    imagemAtual = canvas.toDataURL('image/jpeg', 0.9);
    
    const preview = document.getElementById('previewFoto');
    preview.innerHTML = `<img src="${imagemAtual}" style="max-width:100%; max-height:300px; border-radius:8px;">`;
    
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    
    document.getElementById('cropperControls').style.display = 'none';
}

// =============================================
// FUNÇÕES PRINCIPAIS - COMUNICAÇÃO COM PLANOVIP
// =============================================
function salvarAnexo() {
    console.log('💾 Salvando anexo...');
    
    let tipo = '';
    let dados = '';
    
    switch(abaAtiva) {
        case 'texto':
            const textoManual = document.getElementById('textoManual')?.value.trim();
            if (!textoManual) {
                alert('⚠️ Digite o texto do anexo!');
                return;
            }
            tipo = 'texto';
            dados = sanitizarTexto(textoManual);
            break;
            
        case 'chatgpt':
            const textoIA = document.getElementById('textoIA')?.value.trim();
            if (!textoIA) {
                alert('⚠️ Gere o conteúdo primeiro!');
                return;
            }
            tipo = 'texto';
            dados = sanitizarTexto(textoIA);
            break;
            
        case 'foto':
            if (!imagemAtual) {
                alert('⚠️ Selecione e recorte uma imagem!');
                return;
            }
            tipo = 'imagem';
            dados = imagemAtual;
            break;
            
        default:
            alert('⚠️ Selecione um tipo de anexo!');
            return;
    }
    
    // Chamar a função do planovip.html
    if (window.salvarAnexoDoModal && typeof window.salvarAnexoDoModal === 'function') {
        window.salvarAnexoDoModal(tipo, dados);
    } else {
        // Fallback: tentar encontrar a função no escopo pai
        console.warn('salvarAnexoDoModal não encontrado, tentando fallback...');
        
        if (window.parent && window.parent.salvarAnexoDoModal) {
            window.parent.salvarAnexoDoModal(tipo, dados);
        } else if (window.opener && window.opener.salvarAnexoDoModal) {
            window.opener.salvarAnexoDoModal(tipo, dados);
        } else {
            // Último recurso: salvar localmente e tentar fechar
            console.log('Anexo salvo localmente:', { tipo, dados });
            
            // Salvar no sessionStorage
            try {
                const planoData = JSON.parse(sessionStorage.getItem('planoData') || '{}');
                planoData.anexoTipo = tipo;
                if (tipo === 'imagem') {
                    planoData.anexoImagem = dados;
                    planoData.anexoTexto = null;
                } else {
                    planoData.anexoTexto = dados;
                    planoData.anexoImagem = null;
                }
                sessionStorage.setItem('planoData', JSON.stringify(planoData));
            } catch (e) {}
            
            alert('✅ Anexo salvo localmente!');
            
            // Tentar fechar modal
            fecharAnexo();
        }
    }
}

function fecharAnexo() {
    console.log('🔒 Fechando anexo...');
    
    // Tentar fechar modal no planovip
    if (window.fecharModalAnexo && typeof window.fecharModalAnexo === 'function') {
        window.fecharModalAnexo();
    } else if (window.parent && window.parent.fecharModalAnexo) {
        window.parent.fecharModalAnexo();
    } else if (window.opener && window.opener.fecharModalAnexo) {
        window.opener.fecharModalAnexo();
    } else {
        // Fallback: esconder elementos
        const container = document.getElementById('anexoContainerContent');
        if (container) container.style.display = 'none';
        
        const modal = document.getElementById('anexoModal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }
    
    // Limpar campos
    limparCampos();
}

function limparCampos() {
    document.getElementById('textoManual').value = '';
    document.getElementById('textoIA').value = '';
    
    const preview = document.getElementById('previewFoto');
    if (preview) {
        preview.innerHTML = `
            <div style="color: var(--gray);">
                <i class="fas fa-cloud-upload-alt" style="font-size: 40px;"></i>
                <p>Nenhuma imagem selecionada</p>
            </div>
        `;
    }
    
    document.getElementById('cropperControls').style.display = 'none';
    
    imagemAtual = null;
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

// =============================================
// FUNÇÃO DE INICIALIZAÇÃO (chamada pelo planovip)
// =============================================
function inicializarAnexos() {
    console.log('🚀 Inicializando interface do anexo...');
    
    // Configurar textareas para sanitização
    const textoManual = document.getElementById('textoManual');
    if (textoManual) {
        textoManual.addEventListener('input', function() {
            this.value = sanitizarTexto(this.value);
        });
    }
    
    const textoIA = document.getElementById('textoIA');
    if (textoIA) {
        textoIA.addEventListener('input', function() {
            this.value = sanitizarTexto(this.value);
        });
    }
    
    // Configurar preview de foto para drag & drop
    const previewFoto = document.getElementById('previewFoto');
    if (previewFoto) {
        previewFoto.addEventListener('dragover', (e) => {
            e.preventDefault();
            previewFoto.style.borderColor = '#f59e0b';
        });
        
        previewFoto.addEventListener('dragleave', () => {
            previewFoto.style.borderColor = 'rgba(255,255,255,0.2)';
        });
        
        previewFoto.addEventListener('drop', (e) => {
            e.preventDefault();
            previewFoto.style.borderColor = 'rgba(255,255,255,0.2)';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                // Simular um input change
                const fakeInput = { files: [file] };
                carregarFoto(fakeInput);
            }
        });
    }
    
    // Configurar botão de fechar manual
    const closeBtn = document.querySelector('[onclick="fecharAnexo()"]');
    if (!closeBtn) {
        // Se não existir, adicionar um
        const footer = document.querySelector('.anexo-footer');
        if (footer) {
            const cancelBtn = footer.querySelector('.btn-footer.cancelar');
            if (cancelBtn) {
                cancelBtn.setAttribute('onclick', 'fecharAnexo()');
            }
        }
    }
    
    console.log('✅ Interface do anexo pronta!');
}

// =============================================
// CARREGAR ANEXO SALVO
// =============================================
function carregarAnexoSalvo(anexo) {
    if (!anexo) return;
    
    console.log('📂 Carregando anexo salvo:', anexo.tipo);
    
    if (anexo.tipo === 'imagem') {
        imagemAtual = anexo.data;
        
        const preview = document.getElementById('previewFoto');
        if (preview) {
            preview.innerHTML = `<img src="${anexo.data}" style="max-width:100%; max-height:300px; border-radius:8px;">`;
        }
        
        mudarAba('foto');
    } else {
        const textareaIA = document.getElementById('textoIA');
        const textareaManual = document.getElementById('textoManual');
        
        if (textareaIA) {
            textareaIA.value = anexo.data;
        }
        
        if (textareaManual) {
            textareaManual.value = anexo.data;
        }
        
        mudarAba('texto');
    }
}

// =============================================
// INICIALIZAÇÃO AUTOMÁTICA
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar apenas se estiver em um contexto adequado
    if (document.getElementById('painelTexto')) {
        inicializarAnexos();
    }
});

// =============================================
// EXPORTAR FUNÇÕES PARA O ESCOPO GLOBAL
// =============================================
window.mudarAba = mudarAba;
window.gerarConteudoIA = gerarConteudoIA;
window.abrirChatGPT = abrirChatGPT;
window.abrirCamera = abrirCamera;
window.abrirGaleria = abrirGaleria;
window.carregarFoto = carregarFoto;
window.rotacionarEsquerda = rotacionarEsquerda;
window.rotacionarDireita = rotacionarDireita;
window.zoomMais = zoomMais;
window.zoomMenos = zoomMenos;
window.resetarCropper = resetarCropper;
window.aplicarCorte = aplicarCorte;
window.salvarAnexo = salvarAnexo;
window.fecharAnexo = fecharAnexo;
window.carregarAnexoSalvo = carregarAnexoSalvo;
window.inicializarAnexos = inicializarAnexos;
window.sanitizarTexto = sanitizarTexto;

console.log('✅ anexo.js carregado com sucesso!');
