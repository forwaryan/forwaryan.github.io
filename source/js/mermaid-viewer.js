(() => {
  const processed = new WeakSet();
  let observerTimer;

  const getSvgSize = svg => {
    const viewBox = svg.getAttribute('viewBox');
    const rect = svg.getBoundingClientRect();
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+/).map(Number);
      if (Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
        return {
          width: Math.ceil(parts[2]),
          height: Math.ceil(parts[3])
        };
      }
    }

    return {
      width: Math.ceil(rect.width || 1000),
      height: Math.ceil(rect.height || 600)
    };
  };

  const setSvgReadableWidth = svg => {
    const naturalWidth = getSvgSize(svg).width;

    if (naturalWidth) {
      svg.style.width = `${naturalWidth}px`;
    }
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
  };

  const createButton = (label, className = 'mermaid-lightbox__button') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  };

  const openLightbox = sourceSvg => {
    const old = document.querySelector('.mermaid-lightbox');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'mermaid-lightbox';

    const toolbar = document.createElement('div');
    toolbar.className = 'mermaid-lightbox__toolbar';

    const title = document.createElement('div');
    title.className = 'mermaid-lightbox__title';
    title.textContent = 'Mermaid 图表';

    const zoomOut = createButton('-');
    const zoomIn = createButton('+');
    const reset = createButton('100%');
    const scaleText = document.createElement('span');
    scaleText.className = 'mermaid-lightbox__scale';
    const close = createButton('关闭');

    toolbar.append(title, zoomOut, scaleText, zoomIn, reset, close);

    const viewport = document.createElement('div');
    viewport.className = 'mermaid-lightbox__viewport';

    const stage = document.createElement('div');
    stage.className = 'mermaid-lightbox__stage';

    const surface = document.createElement('div');
    surface.className = 'mermaid-lightbox__surface';

    const sourceSize = getSvgSize(sourceSvg);
    const clone = sourceSvg.cloneNode(true);
    clone.removeAttribute('style');
    clone.setAttribute('width', sourceSize.width);
    clone.setAttribute('height', sourceSize.height);
    clone.style.width = `${sourceSize.width}px`;
    clone.style.height = `${sourceSize.height}px`;
    clone.style.maxWidth = 'none';
    surface.appendChild(clone);
    stage.appendChild(surface);
    viewport.appendChild(stage);
    overlay.append(toolbar, viewport);
    document.body.appendChild(overlay);
    document.body.classList.add('mermaid-lightbox-open');

    let scale = 1;
    const setScale = nextScale => {
      scale = Math.min(4, Math.max(.5, nextScale));
      surface.style.transform = `scale(${scale})`;
      scaleText.textContent = `${Math.round(scale * 100)}%`;
      requestAnimationFrame(() => {
        stage.style.width = `${Math.ceil(surface.offsetWidth * scale)}px`;
        stage.style.height = `${Math.ceil(surface.offsetHeight * scale)}px`;
      });
    };

    const closeLightbox = () => {
      overlay.remove();
      document.body.classList.remove('mermaid-lightbox-open');
      document.removeEventListener('keydown', handleKeydown);
    };

    const handleKeydown = event => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === '+' || event.key === '=') setScale(scale * 1.2);
      if (event.key === '-') setScale(scale / 1.2);
      if (event.key === '0') setScale(1);
    };

    zoomOut.addEventListener('click', () => setScale(scale / 1.2));
    zoomIn.addEventListener('click', () => setScale(scale * 1.2));
    reset.addEventListener('click', () => setScale(1));
    close.addEventListener('click', closeLightbox);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeLightbox();
    });
    document.addEventListener('keydown', handleKeydown);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    viewport.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = viewport.scrollLeft;
      startTop = viewport.scrollTop;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener('pointermove', event => {
      if (!dragging) return;
      viewport.scrollLeft = startLeft - (event.clientX - startX);
      viewport.scrollTop = startTop - (event.clientY - startY);
    });

    viewport.addEventListener('pointerup', event => {
      dragging = false;
      viewport.classList.remove('is-dragging');
      viewport.releasePointerCapture(event.pointerId);
    });

    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setScale(scale * (event.deltaY > 0 ? .9 : 1.1));
    }, { passive: false });

    const initialScale = Math.min(1.6, Math.max(.75, (window.innerWidth - 96) / sourceSize.width));
    setScale(initialScale);
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (stage.offsetWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (stage.offsetHeight - viewport.clientHeight) / 2);
    });
  };

  const enhanceMermaid = svg => {
    if (processed.has(svg)) return;

    const mermaid = svg.closest('.mermaid');
    const container = mermaid && (mermaid.closest('.code-container') || mermaid);
    if (!container) return;

    processed.add(svg);
    container.classList.add('mermaid-enhanced-container');
    mermaid.classList.add('mermaid-enhanced');
    setSvgReadableWidth(svg);

    if (!container.querySelector('.mermaid-zoom-button')) {
      const button = createButton('查看大图', 'mermaid-zoom-button');
      button.setAttribute('aria-label', '放大 Mermaid 图');
      button.addEventListener('click', () => openLightbox(svg));
      container.appendChild(button);
    }

    svg.addEventListener('click', () => openLightbox(svg));
  };

  const enhanceAll = () => {
    document.querySelectorAll('.post-body .mermaid svg').forEach(enhanceMermaid);
  };

  const scheduleEnhance = () => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(enhanceAll, 80);
  };

  document.addEventListener('DOMContentLoaded', scheduleEnhance);
  document.addEventListener('page:loaded', () => {
    scheduleEnhance();
    setTimeout(enhanceAll, 500);
    setTimeout(enhanceAll, 1200);
  });
  window.addEventListener('load', scheduleEnhance);

  new MutationObserver(scheduleEnhance).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
