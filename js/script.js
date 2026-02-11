import { 
  addCar, 
  subscribeToCars, 
  updateCar, 
  deleteCar, 
  toggleSold,
  saveSiteConfig,
  subscribeToConfig,
  loginAdmin,
  logoutAdmin,
  checkAuthState,
  uploadCarImages,
  addLead,
  subscribeToLeads,
  resetPassword
} from './firebase-service.js';

// Dados dos carros (serão carregados do Firebase)
let carros = [];
let filteredCars = [];
let storeWhatsapp = '5511999999999'; // Padrão
let editingCarId = null; 
let currentUser = null; // Usuário logado
let selectedFiles = []; // Armazenar arquivos selecionados para upload
let existingImageUrls = []; // Armazenar URLs existentes durante a edição


// Elementos DOM
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
const header = document.querySelector('header');
const navLinks = document.querySelectorAll('nav a');
const carrosContainer = document.getElementById('carrosContainer');
const adminPanel = document.getElementById('adminPanel');
const adminToggle = document.getElementById('adminToggle');
const carForm = document.getElementById('carForm');
const carModal = document.getElementById('carModal');
const modalClose = document.getElementById('modalClose');
const modalImage = document.getElementById('modalImage');
const btnPrev = document.getElementById('btnPrevImage');
const btnNext = document.getElementById('btnNextImage');
const galleryDots = document.getElementById('galleryDots');

// Variáveis de Estado da Galeria
let currentCarImages = [];
let currentImageIndex = 0;

// Função para exibir skeletons (carregamento premium)
function renderSkeletons() {
  carrosContainer.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'card-skeleton';
    skeleton.innerHTML = `
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-subtitle"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-price"></div>
      <div class="skeleton skeleton-btn"></div>
    `;
    carrosContainer.appendChild(skeleton);
  }
}

// Função para atualizar as estatísticas do dashboard
function updateDashboardStats() {
    const totalCars = carros.length;
    const soldCars = carros.filter(c => c.vendido).length;
    const availableCars = totalCars - soldCars;
    
    // Calcular valor total (removendo R$, pontos e espaços)
    const totalValueNumeric = carros.reduce((acc, car) => {
        if (car.vendido) return acc;
        const price = Number(car.preco.replace(/\D/g, '')) || 0;
        return acc + price;
    }, 0);

    const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });

    document.getElementById('statTotalCars').textContent = totalCars;
    document.getElementById('statTotalValue').textContent = formatter.format(totalValueNumeric);
    document.getElementById('statSoldCars').textContent = soldCars;
    document.getElementById('statAvailableCars').textContent = availableCars;
}

// Função para renderizar a tabela de leads
function renderLeads(leads) {
    const tableBody = document.getElementById('leadsTableBody');
    if (!tableBody) return;

    if (leads.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--muted);">Nenhuma proposta recebida ainda.</td></tr>';
        return;
    }

    tableBody.innerHTML = leads.map(lead => {
        const date = new Date(lead.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr>
                <td>${date}</td>
                <td><strong>${lead.nome || 'Interessado'}</strong></td>
                <td>${lead.veiculo}</td>
                <td>
                    <a href="https://wa.me/${lead.telefone}" target="_blank" class="btn-whatsapp-lead">
                        <i class="fab fa-whatsapp"></i> Responder
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}

// Função para renderizar os cards dos carros
function renderCarros(data = carros) {
  carrosContainer.innerHTML = '';
  
  if (data.length === 0) {
    carrosContainer.innerHTML = `<div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--muted);">
      <i class="fas fa-car-side" style="font-size: 3rem; margin-bottom: 1rem;"></i>
      <p>Nenhum veículo encontrado com os filtros selecionados.</p>
    </div>`;
    return;
  }

  data.forEach(carro => {
    const card = document.createElement('div');
    card.className = `card ${carro.vendido ? 'sold' : ''}`;
    card.dataset.id = carro.id;
    
    // Pegar apenas 6 equipamentos para exibir no card
    const equipamentosPreview = carro.equipamentos ? carro.equipamentos.slice(0, 6) : [];
    // Usar primeira imagem como capa
    const capa = carro.imagens ? carro.imagens[0] : (carro.imagem || 'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=800&q=60');
    
    // Criar link dinâmico para WhatsApp
    const waLink = `https://wa.me/${storeWhatsapp}?text=Olá,%20tenho%20interesse%20no%20${encodeURIComponent(carro.modelo)}%20${carro.ano}`;

    card.innerHTML = `
      <div class="card-image">
        <img src="${capa}" alt="${carro.marca} ${carro.modelo}">
        <div class="card-badge ${carro.badge === 'NOVIDADE' ? 'novidade' : carro.badge === 'PROMOÇÃO' ? 'promocao' : ''}">${carro.badge || 'NOVIDADE'}</div>
      </div>
      <div class="info">
        <div class="card-header">
          <h4>${carro.marca} ${carro.modelo}</h4>
          <p class="card-subtitle">${carro.ano} • ${carro.motor || ''} • ${carro.transmissao} • ${carro.combustivel}</p>
          <div class="card-meta">
            <span><i class="fas fa-tachometer-alt"></i> ${carro.km}</span>
            <span><i class="fas fa-palette"></i> ${carro.cor}</span>
            <span><i class="fas fa-door-closed"></i> ${carro.portas} portas</span>
          </div>
        </div>
        
        <div class="equipamentos">
          <h5><i class="fas fa-list-check"></i> Principais Equipamentos</h5>
          <div class="equipamentos-grid">
            ${equipamentosPreview.map(eq => `
              <div class="equipamento-item">
                <i class="fas fa-check"></i> ${eq}
              </div>
            `).join('')}
          </div>
          ${(carro.equipamentos && carro.equipamentos.length > 6) ? 
            `<div class="equipamento-item" style="margin-top: 0.5rem;">
              <i class="fas fa-ellipsis-h"></i> +${carro.equipamentos.length - 6} itens
            </div>` : ''}
        </div>
        
        <div class="preco-container">
          <div class="preco">
            ${carro.preco}
            <small>à vista</small>
          </div>
          <div class="card-actions">
            <a href="#" class="detalhes" data-id="${carro.id}">
              <i class="fas fa-search"></i> Ver detalhes
            </a>
            <a href="${waLink}" target="_blank" class="btn-whatsapp-click" data-id="${carro.id}">
              <i class="fab fa-whatsapp"></i> Consultar
            </a>
          </div>
        </div>

        <div class="admin-card-actions">
          <button class="btn-edit" data-id="${carro.id}">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn-toggle-sold" data-id="${carro.id}">
            <i class="fas fa-tag"></i> ${carro.vendido ? 'Disponível' : 'Vendido'}
          </button>
          <button class="btn-delete" data-id="${carro.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    
    carrosContainer.appendChild(card);
  });
  
  // Re-aplicar observers e listeners
  attachCardEvents();
}

function attachCardEvents() {
  const cards = document.querySelectorAll('.card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
      }
    });
  }, { threshold: 0.1 });
  cards.forEach(card => observer.observe(card));

  document.querySelectorAll('.detalhes').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const carId = this.dataset.id;
      openCarModal(carId);
    });
  });

  // Listeners para botões do Admin nos cards
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const carId = btn.dataset.id;
      prepareEditCar(carId);
    });
  });

  document.querySelectorAll('.btn-toggle-sold').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const carId = btn.dataset.id;
      const carro = carros.find(c => c.id === carId);
      if (carro) {
        await toggleSold(carId, carro.vendido);
      }
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const carId = btn.dataset.id;
      if (confirm('Tem certeza que deseja excluir este veículo?')) {
        await deleteCar(carId);
      }
    });
  });

  // Listener para capturar Leads ao clicar no WhatsApp
  document.querySelectorAll('.btn-whatsapp-click').forEach(btn => {
    btn.addEventListener('click', async function() {
        if (isAdminMode) return;
        const carId = this.dataset.id;
        const carro = carros.find(c => c.id === carId);
        if (carro) {
            await addLead({
                veiculo: carro.modelo,
                telefone: storeWhatsapp,
                nome: "Interessado no Site"
            });
        }
    });
  });
}

// Funções da Galeria do Modal
function updateGalleryImage() {
  modalImage.style.backgroundImage = `url('${currentCarImages[currentImageIndex]}')`;
  
  // Atualizar bolinhas
  const dots = galleryDots.querySelectorAll('.gallery-dot');
  dots.forEach((dot, index) => {
    if (index === currentImageIndex) dot.classList.add('active');
    else dot.classList.remove('active');
  });
  
  // Controlar visibilidade dos botões se tiver só 1 imagem
  if (currentCarImages.length <= 1) {
    btnPrev.style.display = 'none';
    btnNext.style.display = 'none';
    galleryDots.style.display = 'none';
  } else {
    btnPrev.style.display = 'flex';
    btnNext.style.display = 'flex';
    galleryDots.style.display = 'flex';
  }
}

btnPrev.addEventListener('click', () => {
  currentImageIndex--;
  if (currentImageIndex < 0) currentImageIndex = currentCarImages.length - 1;
  updateGalleryImage();
});

btnNext.addEventListener('click', () => {
  currentImageIndex++;
  if (currentImageIndex >= currentCarImages.length) currentImageIndex = 0;
  updateGalleryImage();
});

// Função para abrir o modal com detalhes do carro
function openCarModal(carId) {
  const carro = carros.find(c => c.id === carId);
  if (!carro) return;
  
  // Configurar galeria
  currentCarImages = carro.imagens || [carro.imagem];
  currentImageIndex = 0;
  
  // Criar bolinhas
  galleryDots.innerHTML = '';
  currentCarImages.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'gallery-dot';
    dot.addEventListener('click', () => {
      currentImageIndex = index;
      updateGalleryImage();
    });
    galleryDots.appendChild(dot);
  });
  
  updateGalleryImage();
  
  // Preencher modal com dados do carro
  document.getElementById('modalTitle').textContent = `${carro.marca} ${carro.modelo}`;
  document.getElementById('modalSubtitle').textContent = `${carro.ano} • ${carro.motor || ''} • ${carro.transmissao} • ${carro.combustivel}`;
  document.getElementById('modalYear').textContent = carro.ano;
  document.getElementById('modalKM').textContent = carro.km;
  document.getElementById('modalTransmission').textContent = carro.transmissao;
  document.getElementById('modalFuel').textContent = carro.combustivel;
  document.getElementById('modalColor').textContent = carro.cor;
  document.getElementById('modalDoors').textContent = `${carro.portas} portas`;
  document.getElementById('modalPrice').textContent = carro.preco;
  
  // Preencher equipamentos
  const equipamentosGrid = document.getElementById('modalEquipamentos');
  equipamentosGrid.innerHTML = '';
  carro.equipamentos.forEach(eq => {
    const item = document.createElement('div');
    item.className = 'equipamento-item';
    item.innerHTML = `<i class="fas fa-check"></i> ${eq}`;
    equipamentosGrid.appendChild(item);
  });
  
  // Atualizar links do modal
  const modalWhatsapp = document.getElementById('modalWhatsapp');
  const modalTestDrive = document.getElementById('modalTestDrive');
  
  modalWhatsapp.href = `https://wa.me/${storeWhatsapp}?text=Olá,%20tenho%20interesse%20no%20${encodeURIComponent(carro.modelo)}%20${carro.ano}`;
  modalTestDrive.href = `https://wa.me/${storeWhatsapp}?text=Olá,%20gostaria%20de%20agendar%20um%20test%20drive%20no%20${encodeURIComponent(carro.modelo)}%20${carro.ano}`;
  
  // Abrir modal e atualizar URL
  carModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Atualizar link direto no navegador (sem recarregar)
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?id=' + carId;
  window.history.pushState({path:newUrl},'',newUrl);
}

// Zoom / Lightbox Logic
const zoomModal = document.getElementById('zoomModal');
const zoomImage = document.getElementById('zoomImage');
const zoomClose = document.getElementById('zoomClose');
const zoomPrev = document.getElementById('zoomPrev');
const zoomNext = document.getElementById('zoomNext');
const zoomCounter = document.getElementById('zoomCounter');

function openZoom() {
  updateZoomImage();
  zoomModal.classList.add('active');
}

function closeZoom() {
  zoomModal.classList.remove('active');
}

function updateZoomImage() {
  zoomImage.src = currentCarImages[currentImageIndex];
  zoomCounter.textContent = `${currentImageIndex + 1} / ${currentCarImages.length}`;
  
  if (currentCarImages.length <= 1) {
    zoomPrev.style.display = 'none';
    zoomNext.style.display = 'none';
  } else {
    zoomPrev.style.display = 'flex';
    zoomNext.style.display = 'flex';
  }
}

// Event Listeners do Zoom
modalImage.addEventListener('click', openZoom);
zoomClose.addEventListener('click', closeZoom);

zoomPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  currentImageIndex--;
  if (currentImageIndex < 0) currentImageIndex = currentCarImages.length - 1;
  updateGalleryImage(); // Atualiza também o modal pequeno
  updateZoomImage();
});

zoomNext.addEventListener('click', (e) => {
  e.stopPropagation();
  currentImageIndex++;
  if (currentImageIndex >= currentCarImages.length) currentImageIndex = 0;
  updateGalleryImage(); // Atualiza também o modal pequeno
  updateZoomImage();
});

// Fechar ao clicar fora da imagem
zoomModal.addEventListener('click', (e) => {
  if (e.target === zoomModal) closeZoom();
});

// Teclado (ESC e Setas)
document.addEventListener('keydown', (e) => {
  if (!carModal.classList.contains('active')) return;
  
  const isZoomActive = zoomModal.classList.contains('active');
  
  if (e.key === 'Escape') {
    if (isZoomActive) closeZoom();
    else {
      carModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  }
  
  if (e.key === 'ArrowLeft') {
    currentImageIndex--;
    if (currentImageIndex < 0) currentImageIndex = currentCarImages.length - 1;
    updateGalleryImage();
    if (isZoomActive) updateZoomImage();
  }
  
  if (e.key === 'ArrowRight') {
    currentImageIndex++;
    if (currentImageIndex >= currentCarImages.length) currentImageIndex = 0;
    updateGalleryImage();
    if (isZoomActive) updateZoomImage();
  }
});

// Preview de múltiplas imagens no Admin
const carImageFile = document.getElementById('carImageFile');
const imagePreview = document.getElementById('imagePreview');
const previewGallery = document.getElementById('previewGallery');
selectedFiles = []; // Array para armazenar os objetos File selecionados
existingImageUrls = []; // Array para armazenar URLs de imagens existentes ao editar

carImageFile.addEventListener('change', (e) => {
  const files = e.target.files;
  if (files.length > 0) {
    selectedFiles = Array.from(files); // Armazenar os objetos File
    previewGallery.innerHTML = ''; // Limpar galeria
    
    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        
        // Adicionar miniatura
        const thumb = document.createElement('img');
        thumb.src = base64;
        thumb.className = 'preview-thumb';
        previewGallery.appendChild(thumb);
        
        // Mostrar a primeira no preview grande
        if (index === 0) {
          imagePreview.style.backgroundImage = `url('${base64}')`;
          imagePreview.classList.add('has-image');
        }
      }
      reader.readAsDataURL(file);
    });
  }
});

// Função para carregar dados no formulário para edição
function prepareEditCar(carId) {
  const carro = carros.find(c => c.id === carId);
  if (!carro) return;

  editingCarId = carId;
  
  // Preencher campos
  document.getElementById('carBrand').value = carro.marca || '';
  document.getElementById('carModel').value = carro.modelo;
  document.getElementById('carYear').value = carro.ano;
  document.getElementById('carTransmission').value = carro.transmissao;
  document.getElementById('carFuel').value = carro.combustivel;
  document.getElementById('carKM').value = carro.km;
  document.getElementById('carColor').value = carro.cor;
  document.getElementById('carEngine').value = carro.motor || '';
  document.getElementById('carPrice').value = carro.preco;
  document.getElementById('carDescription').value = carro.descricao;

  // Preencher equipamentos
  document.querySelectorAll('.equipamentos-checklist input').forEach(cb => {
    cb.checked = carro.equipamentos.includes(cb.value);
  });

  // Preview de imagem
  if (carro.imagens && carro.imagens.length > 0) {
    existingImageUrls = carro.imagens;
    selectedFiles = []; // Limpar arquivos novos ao carregar existente
    imagePreview.style.backgroundImage = `url('${carro.imagens[0]}')`;
    imagePreview.classList.add('has-image');
    
    previewGallery.innerHTML = '';
    carro.imagens.forEach(img => {
      const thumb = document.createElement('img');
      thumb.src = img;
      thumb.className = 'preview-thumb';
      previewGallery.appendChild(thumb);
    });
  }

  // Abrir painel e scroll
  adminPanel.style.display = 'block';
  adminPanel.querySelector('h4').innerHTML = `<i class="fas fa-edit"></i> Editando: ${carro.modelo}`;
  document.querySelector('.admin-submit').textContent = 'Salvar Alterações';
  adminPanel.scrollIntoView({ behavior: 'smooth' });
}

// Função para adicionar ou atualizar carro
async function handleCarSubmit(event) {
  event.preventDefault();
  
  const submitBtn = document.querySelector('.admin-submit');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando Imagens...';

  try {
    let finalImageUrls = [...existingImageUrls];
    const urlInput = document.getElementById('carImageUrl').value;

    // Upload de novas imagens se houver
    if (selectedFiles.length > 0) {
      try {
        const newUrls = await uploadCarImages(selectedFiles);
        finalImageUrls = newUrls;
      } catch (uploadError) {
        console.error("Erro no upload (possivelmente Storage desativado):", uploadError);
        // Se houver erro no upload e tiver URL, usa a URL
        if (urlInput) {
          finalImageUrls = [urlInput];
        } else {
          throw new Error("Não foi possível fazer o upload e nenhuma URL foi fornecida.");
        }
      }
    } else if (urlInput) {
      // Se não tem arquivos mas tem URL
      finalImageUrls = [urlInput];
    }

    if (finalImageUrls.length === 0) {
      finalImageUrls = ["https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=800&q=60"];
    }

    submitBtn.textContent = 'Salvando Dados...';

    // Coletar dados do formulário
    const carData = {
      marca: document.getElementById('carBrand').value,
      modelo: document.getElementById('carModel').value,
      ano: document.getElementById('carYear').value,
      transmissao: document.getElementById('carTransmission').value,
      combustivel: document.getElementById('carFuel').value,
      km: document.getElementById('carKM').value || 'N/A',
      cor: document.getElementById('carColor').value || 'Não informada',
      motor: document.getElementById('carEngine').value,
      preco: document.getElementById('carPrice').value,
      descricao: document.getElementById('carDescription').value || '',
      equipamentos: Array.from(document.querySelectorAll('.equipamentos-checklist input:checked')).map(cb => cb.value),
      imagens: finalImageUrls
    };
    
    if (editingCarId) {
      await updateCar(editingCarId, carData);
      alert('Veículo atualizado com sucesso!');
    } else {
      await addCar(carData);
      alert('Veículo adicionado com sucesso!');
    }

    // Resetar formulário e estado
    carForm.reset();
    editingCarId = null;
    selectedFiles = [];
    existingImageUrls = [];
    document.getElementById('carImageUrl').value = '';
    imagePreview.style.backgroundImage = 'none';
    imagePreview.classList.remove('has-image');
    previewGallery.innerHTML = '';
    adminPanel.style.display = 'none';
    submitBtn.textContent = 'Adicionar Veículo';
    adminPanel.querySelector('h4').innerHTML = `<i class="fas fa-tools"></i> Adicionar Novo Veículo`;
  } catch (error) {
    alert('Erro ao salvar veículo. Verifique o console.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingCarId ? 'Salvar Alterações' : 'Adicionar Veículo';
  }
}

// Menu mobile toggle
menuToggle.addEventListener('click', () => {
  mainNav.classList.toggle('active');
  menuToggle.innerHTML = mainNav.classList.contains('active') 
    ? '<i class="fas fa-times"></i>' 
    : '<i class="fas fa-bars"></i>';
});

// Fechar menu ao clicar em um link
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('active');
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
  });
});

// Header scroll effect
window.addEventListener('scroll', () => {
  if (window.scrollY > 100) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
  
  // Ativar link de navegação correspondente à seção visível
  const sections = document.querySelectorAll('section');
  const scrollPos = window.scrollY + 100;
  
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    const sectionId = section.getAttribute('id');
    
    if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
          link.classList.add('active');
        }
      });
    }
  });
});

// Toggle painel admin
adminToggle.addEventListener('click', (e) => {
  e.preventDefault();
  adminPanel.style.display = adminPanel.style.display === 'block' ? 'none' : 'block';
  
  if (adminPanel.style.display === 'block') {
    adminPanel.scrollIntoView({ behavior: 'smooth' });
  }
});

// Fechar modal
modalClose.addEventListener('click', () => {
  carModal.classList.remove('active');
  document.body.style.overflow = 'auto';
  // Limpar ID da URL ao fechar
  const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.pushState({path:cleanUrl},'',cleanUrl);
});

// Fechar modal ao clicar fora
carModal.addEventListener('click', (e) => {
  if (e.target === carModal) {
    carModal.classList.remove('active');
    document.body.style.overflow = 'auto';
    // Limpar ID da URL ao fechar
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({path:cleanUrl},'',cleanUrl);
  }
});

// Submeter formulário admin
carForm.addEventListener('submit', handleCarSubmit);

// --- LÓGICA DE LOGIN ---
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginClose = document.getElementById('loginClose');
const loginError = document.getElementById('loginError');

// Lógica de Tabs do Admin
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // Ativar botão
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Ativar conteúdo
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `tab-${tabId}`) content.classList.add('active');
        });

        // Atualizar classes no body para controle via CSS
        document.body.classList.remove('tab-veiculos-active', 'tab-conteudo-active');
        document.body.classList.add(`tab-${tabId}-active`);

        // Lógica de Edição da Página
        if (tabId === 'conteudo') {
            setPageEditMode(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setPageEditMode(false);
        }
    });
});

loginClose.addEventListener('click', () => {
    loginModal.classList.remove('active');
});

// Lógica de Visualizar Senha
const togglePassword = document.getElementById('togglePassword');
const loginPassword = document.getElementById('loginPassword');

if (togglePassword && loginPassword) {
    togglePassword.addEventListener('click', () => {
        const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassword.setAttribute('type', type);
        togglePassword.innerHTML = type === 'password' 
            ? '<i class="fas fa-eye"></i>' 
            : '<i class="fas fa-eye-slash"></i>';
    });
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const btn = loginForm.querySelector('.login-btn');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    loginError.textContent = '';

    try {
        await loginAdmin(email, pass);
        loginModal.classList.remove('active');
        loginForm.reset();
    } catch (error) {
        loginError.textContent = 'E-mail ou senha incorretos.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Acessar Painel</span> <i class="fas fa-arrow-right"></i>';
    }
});

// Lógica de recuperar senha
const forgotLink = document.querySelector('.forgot-link');
if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        
        if (!email) {
            alert('Por favor, digite seu e-mail no campo acima antes de clicar em "Esqueci a senha".');
            return;
        }

        if (confirm(`Deseja enviar um e-mail de recuperação para: ${email}?`)) {
            try {
                await resetPassword(email);
                alert('E-mail de recuperação enviado! Verifique sua caixa de entrada e a pasta de spam.');
            } catch (error) {
                alert('Erro ao tentar enviar e-mail. Verifique se o endereço está correto.');
            }
        }
    });
}

// Lógica de Filtros
function applyFilters() {
    const modelSearch = document.getElementById('filterModel').value.toLowerCase();
    const brandFilter = document.getElementById('filterBrand').value;
    const priceRange = document.getElementById('filterPrice').value;

    filteredCars = carros.filter(car => {
        const matchesModel = car.modelo.toLowerCase().includes(modelSearch);
        const matchesBrand = brandFilter === "" || car.modelo.toLowerCase().includes(brandFilter.toLowerCase());
        
        let matchesPrice = true;
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            // Remover 'R$', pontos e espaços para comparar o preço numérico
            const numericPrice = Number(car.preco.replace(/\D/g, ''));
            matchesPrice = numericPrice >= min && numericPrice <= max;
        }

        return matchesModel && matchesBrand && matchesPrice;
    });

    renderCarros(filteredCars);
}

document.getElementById('btnApplyFilters').addEventListener('click', applyFilters);
document.getElementById('filterModel').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') applyFilters();
});

// Lógica de Configurações
const saveConfigBtn = document.getElementById('saveConfigBtn');
const storeWhatsappInput = document.getElementById('storeWhatsapp');

saveConfigBtn.addEventListener('click', async () => {
    const newWhatsapp = storeWhatsappInput.value.replace(/\D/g, '');
    if (newWhatsapp.length < 10) {
        alert('Por favor, insira um número de WhatsApp válido.');
        return;
    }

    saveConfigBtn.disabled = true;
    saveConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        await saveSiteConfig({ storeSettings: { whatsapp: newWhatsapp } });
        alert('Configurações salvas com sucesso!');
    } catch (error) {
        alert('Erro ao salvar configurações.');
    } finally {
        saveConfigBtn.disabled = false;
        saveConfigBtn.innerHTML = 'Salvar Configurações';
    }
});

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  renderSkeletons(); // Mostrar skeletons imediatamente ao carregar

  // Verificar o estado da autenticação
  checkAuthState((user) => {
    currentUser = user;
    const adminLink = document.getElementById('adminToggle');
    
    if (user) {
        adminLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
        adminLink.style.color = 'var(--red)';
        
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) adminPanel.style.display = 'block';
        
        // Resetar para a primeira aba (Dashboard)
        const dashboardTab = document.querySelector('[data-tab="dashboard"]');
        if (dashboardTab) dashboardTab.click();
    } else {
        adminLink.innerHTML = '<i class="fas fa-cog"></i> Admin';
        adminLink.style.color = 'var(--yellow)';
        
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) adminPanel.style.display = 'none';
        
        document.body.classList.remove('tab-veiculos-active', 'tab-conteudo-active');
        setPageEditMode(false); 
    }
  });

  // Carregar Carros do Firebase
  subscribeToCars((data) => {
    carros = data;
    renderCarros();
    updateDashboardStats();
  });

  // Carregar Leads do Firebase
  subscribeToLeads((data) => {
    renderLeads(data);
  });

  // Carregar Configurações do Firebase
  subscribeToConfig((config) => {
    if (config) {
      if (config.storeSettings && config.storeSettings.whatsapp) {
          storeWhatsapp = config.storeSettings.whatsapp;
          storeWhatsappInput.value = storeWhatsapp;
          // Re-renderizar para atualizar os links do WhatsApp nos cards
          renderCarros();
      }

      Object.keys(config).forEach(id => {
        const el = document.getElementById(id);
        if (el && id !== 'storeSettings') {
          if (config[id].content !== undefined) {
            el.innerHTML = config[id].content;
          }
          if (config[id].color) {
            el.style.color = config[id].color;
            el.querySelectorAll('span').forEach(span => {
                span.style.color = config[id].color;
                span.style.background = 'none';
                span.style.webkitTextFillColor = config[id].color;
            });
          }
        }
      });
    }
  });
  
  // Forçar autoplay do vídeo
  const video = document.querySelector('.hero-video');
  if (video) {
    video.muted = true; // Garante mudo
    video.play().catch(error => {
      console.log("Autoplay bloqueado pelo navegador. Usuário precisa interagir.", error);
    });
  }
  
  // Animar elementos ao carregar a página
  document.querySelector('.hero-content').classList.add('reveal', 'active');
  
  // Setup Reveal on Scroll
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.1 }); // 10% visível para ativar
  
  reveals.forEach(el => revealObserver.observe(el));
  
  // Animar features (agora usando a classe reveal se possível, ou mantendo o antigo)
  const features = document.querySelectorAll('.feature');
  features.forEach((feature, index) => {
    feature.style.animation = `fadeUp 0.6s ease forwards ${index * 0.2}s`;
    feature.style.opacity = '0'; // Garantir que comece invisível para a animação funcionar
  });

  // Verificar link direto (ID na URL)
  const urlParams = new URLSearchParams(window.location.search);
  const carIdParam = urlParams.get('id');
  
  if (carIdParam) {
    // Precisamos esperar os carros carregarem para abrir o modal
    const checkCarsLoaded = setInterval(() => {
        if (carros && carros.length > 0) {
            const carExists = carros.find(c => c.id === carIdParam);
            if (carExists) {
                openCarModal(carIdParam);
            }
            clearInterval(checkCarsLoaded);
        }
    }, 500);
    
    // Limpar o intervalo após 10 segundos para não rodar infinito se o ID for inválido
    setTimeout(() => clearInterval(checkCarsLoaded), 10000);
  }
});

// O carregamento inicial agora é feito via subscribeToConfig no DOMContentLoaded


// Lógica do Admin Mode
let isAdminMode = false;
let currentEditingElement = null;
const adminToggleBtn = document.getElementById('adminToggle');
const adminSaveBtn = document.getElementById('adminSaveBtn');
const adminToolbar = document.getElementById('adminTextToolbar');
const adminColorPicker = document.getElementById('adminColorPicker');
const adminResetColor = document.getElementById('adminResetColor');

// Toolbar flutuante: posicionar e ativar
function showToolbar(el) {
  if (!isAdminMode) return;
  currentEditingElement = el;
  adminToolbar.classList.add('active');
  
  const rect = el.getBoundingClientRect();
  // Posicionar acima do elemento. Usamos absolute agora, então calculamos com scroll.
  adminToolbar.style.top = `${rect.top + window.scrollY - 60}px`;
  adminToolbar.style.left = `${rect.left + window.scrollX}px`;
  
  // Sincronizar cor atual
  const currentColor = window.getComputedStyle(el).color;
  adminColorPicker.value = rgbToHex(currentColor);
}

function hideToolbar() {
  adminToolbar.classList.remove('active');
  currentEditingElement = null;
}

function rgbToHex(rgb) {
  if (!rgb) return "#ffffff";
  if (rgb.startsWith('#')) return rgb;
  
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
  if (!match) return "#ffffff";
  
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// Eventos da Toolbar
adminColorPicker.addEventListener('input', (e) => {
  if (currentEditingElement) {
    const newColor = e.target.value;
    currentEditingElement.style.color = newColor;
    
    // Aplicar também a spans internos para que herdem a cor (ex: spans azuis ou com gradiente)
    const children = currentEditingElement.querySelectorAll('span');
    children.forEach(span => {
      span.style.color = newColor;
      span.style.background = 'none';
      span.style.webkitTextFillColor = newColor;
    });
  }
});

adminResetColor.addEventListener('click', () => {
  if (currentEditingElement) {
    currentEditingElement.style.color = ''; // Reseta para o padrão do CSS
    
    // Resetar spans internos
    currentEditingElement.querySelectorAll('span').forEach(span => {
      span.style.color = '';
      span.style.background = '';
      span.style.webkitTextFillColor = '';
    });
    
    adminColorPicker.value = rgbToHex(window.getComputedStyle(currentEditingElement).color);
  }
});

// Configurar botão de Admin do menu
if (adminToggleBtn) {
  adminToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser) {
        // Se já está logado e clica no botão (que agora é SAIR)
        if (confirm('Deseja sair do modo administrativo?')) {
            logoutAdmin();
        }
    } else {
        // Se não está logado, abre o modal
        loginModal.classList.add('active');
    }
  });
}

// Função para ativar/desativar edição dos elementos da página
function setPageEditMode(enable) {
  isAdminMode = enable;
  document.body.classList.toggle('admin-mode-active', isAdminMode);
  if (!isAdminMode) hideToolbar();

  const editableIds = [
    'headerLogoName', 'heroTitle', 'heroSubtitle', 'aboutTitle', 'aboutText', 
    'stockTitle', 'stockSubtitle', 'ctaTitle', 'ctaSubtitle', 
    'footerAboutTitle', 'footerAboutText', 'footerAddress', 'footerPhone', 'footerEmail',
    'footerHoursTitle', 'footerHoursMonday', 'footerHoursSaturday', 'footerHoursSunday', 'footerCopyright'
  ];
  
  editableIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.contentEditable = enable ? "true" : "false";
      el.classList.toggle('editable-element', enable);
      
      el.onclick = null; 
      
      if (enable) {
        el.onclick = (e) => {
          e.stopPropagation();
          showToolbar(el);
        };
      }

      if (enable && el.tagName === 'A') {
        el.dataset.href = el.getAttribute('href');
        el.removeAttribute('href');
      } else if (!enable && el.tagName === 'A' && el.dataset.href) {
        el.setAttribute('href', el.dataset.href);
      }
    }
  });

  // Mostrar/Ocultar botão de Salvar Tudo
  const saveBtn = document.getElementById('adminSaveBtn');
  if (saveBtn) {
    saveBtn.style.display = isAdminMode ? 'flex' : 'none';
  }
}

// Fechar toolbar ao clicar fora
document.addEventListener('click', (e) => {
  if (isAdminMode && !adminToolbar.contains(e.target) && !e.target.classList.contains('editable-element')) {
    hideToolbar();
  }
});

// Salvar todas as alterações (incluindo cores)
if (adminSaveBtn) {
  adminSaveBtn.addEventListener('click', () => {
    const currentConfig = {};
    const editableIds = [
      'headerLogoName', 'heroTitle', 'heroSubtitle', 'aboutTitle', 'aboutText', 
      'stockTitle', 'stockSubtitle', 'ctaTitle', 'ctaSubtitle', 
      'footerAboutTitle', 'footerAboutText', 'footerAddress', 'footerPhone', 'footerEmail',
      'footerHoursTitle', 'footerHoursMonday', 'footerHoursSaturday', 'footerHoursSunday', 'footerCopyright'
    ];
    
    editableIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        currentConfig[id] = {
          content: el.innerHTML,
          color: el.style.color || null
        };
      }
    });
    
    saveSiteConfig(currentConfig);
    
    const originalText = adminSaveBtn.innerHTML;
    adminSaveBtn.innerHTML = '<i class="fas fa-check"></i> Salvo com Sucesso!';
    adminSaveBtn.style.background = '#27ae60';
    
    setTimeout(() => {
      adminSaveBtn.innerHTML = originalText;
      adminSaveBtn.style.background = '#2ecc71';
      toggleAdminMode();
    }, 2000);
  });
}
